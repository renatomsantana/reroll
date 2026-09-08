import {
  MAXIMO_DE_PAGINAS_DA_FICHA,
  type PdfSheet,
  type SheetImport,
  type SheetImportField,
  type SheetImportPreset
} from '@shared/types/sheetImport'
import type { SheetWarningId } from '@shared/types/sheetWarning'
import { parseDiceExpression } from '@shared/dice/parseDiceExpression'
import { labelFromFieldName, rotulosExclusivos } from '../labelForField'
import { lerCamposDoTexto } from '../camposDoTexto'
import {
  TEXTO_MINIMO,
  camposDeAnotacao,
  ehTituloDeFicha,
  palpiteDeNome,
  pareceAnotacaoSobreImagem,
  regioesDaFicha
} from '../anotacoesSobreImagem'
import type { SheetReader } from './types'

/**
 * O leitor que NÃO conhece sistema nenhum, e o mais importante dos três, porque é o que atende a
 * ficha que ninguém previu. Apoia-se em duas coisas que valem pra qualquer ficha: campo preenchido
 * tem um RÓTULO IMPRESSO do lado (ver `labelForField`), e rolagem se escreve igual no mundo inteiro,
 * então varrer atrás de notação de dado produz presets sem saber nada do sistema.
 *
 * O que ele NÃO tenta, de propósito: adivinhar quais campos são atributos, quais são perícias e o que
 * é ataque. Isso é conhecimento de sistema, e chutar aqui produz agrupamento errado com cara de certo.
 */

/**
 * Rótulo de campo que quase sempre carrega o nome do personagem — português, inglês e espanhol.
 * O espanhol entrou pela sétima leva de PDFs de teste: uma "Hoja de Personaje" com "Nombre: Paco"
 * caía no nome do ARQUIVO tendo o nome escrito duas linhas acima, porque "nombre" não casa com
 * "nome" (o `\b` para no `b`). Ficha em espanhol é vizinho de porta de quem joga RPG no Brasil.
 */
const NOME_DO_PERSONAGEM = /^(nome|nombre|personagem|personaje|character|name|char)\b/i

/**
 * Marcas de valor VAZIO num formulário. `Off` é o estado desmarcado de caixa de seleção no PDF, e
 * sem esta lista uma ficha em branco importaria 200 campos escritos "Off".
 */
const VAZIO = new Set(['', 'off', 'undefined', 'null'])

/**
 * Texto de INSTRUÇÃO que a ficha traz dentro do campo ("Escolha uma Classe", "Choose a background"):
 * não é o que o jogador escreveu, é o modelo falando com ele. A lista nunca vai estar completa, e
 * vale mesmo assim — cada um que passa faz o app achar que a ficha está preenchida.
 */
/**
 * Tipos de campo que são CAIXA: o valor deles é um estado, não um texto (ver `valorDeFicha`). A
 * decisão sai do TIPO, nunca do valor — a primeira versão tratava "1" como marcado, e a ficha do
 * Matais, que tem Agilidade 1, importou "Agilidade = sim".
 */
const TIPOS_DE_CAIXA = new Set(['checkbox', 'radiobutton', 'btn'])

const INSTRUCAO = /^(escolha|selecione|digite|preencha|insira|choose|select|enter|type)\b/i

/**
 * O valor APROVEITÁVEL de um campo, ou `null` se não houver. Exportado porque os leitores dedicados
 * leem campos direto pelo nome e precisam da MESMA régua: sem isto, o de Ordem Paranormal importava
 * "Classe = Escolha uma Classe" da ficha em branco enquanto o genérico descartava o mesmo valor.
 *
 * Os espaços internos de cada LINHA são colapsados (campo de PDF guarda alinhamento junto do
 * conteúdo, e a ficha real devolveu "5         1" num campo de PV), mas a QUEBRA DE LINHA fica: a
 * ficha de Tormenta20 do Milo traz as habilidades uma por linha.
 */
export function valorDeFicha(bruto: string | undefined, tipo?: string): string | null {
  if (!bruto) return null
  const valor = bruto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (VAZIO.has(valor.toLowerCase())) return null
  if (INSTRUCAO.test(valor)) return null
  /**
   * Caixa MARCADA. O PDF guarda o estado ligado como "On", "Yes" ou o nome do próprio botão, e
   * nenhum desses diz nada pra quem lê a conferência — na ficha do Matais saíam linhas como
   * "Simples = On". O que importa é que está marcada.
   */
  if (tipo !== undefined && TIPOS_DE_CAIXA.has(tipo)) return 'sim'
  return valor
}

export const genericReader: SheetReader = {
  id: 'generico',
  label: 'Ficha genérica',
  /**
   * 0.1 fixo: ele nunca ganha de um leitor dedicado que tenha reconhecido a ficha, e sempre ganha de
   * nada. É o piso do registro, não um palpite sobre esta ficha.
   */
  detect: () => 0.1,
  extract: (sheet) => extrairGenerico(sheet, 'generico', 'Ficha genérica', 0.1)
}

/**
 * Exportado porque os leitores DEDICADOS chamam isto como base e depois melhoram o resultado — o de
 * Ordem Paranormal aproveita os campos e os avisos daqui e só substitui nome, sistema e presets. Sem
 * isso, cada leitor novo recomeçaria do zero a parte chata (rótulo, campo vazio, varredura de dado),
 * que é exatamente a parte que não muda de sistema pra sistema.
 */
export function extrairGenerico(
  original: PdfSheet,
  readerId: string,
  readerLabel: string,
  confidence: number
): SheetImport {
  /** Campo OCULTO não é ficha de ninguém pra este leitor (ver `PdfField.oculto`). */
  const sheet: PdfSheet = original.fields.some((campo) => campo.oculto)
    ? { ...original, fields: original.fields.filter((campo) => !campo.oculto) }
    : original
  const warnings: SheetWarningId[] = []
  const fields: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  let rawText: string | undefined

  const preenchidos = sheet.fields.filter((campo) => valorDeFicha(campo.value, campo.type) !== null)

  /**
   * LIVRO, não ficha. Acima do teto de páginas a varredura não leu nada (ver `sheetFromPdfDocument`),
   * e o que se devolve é o aviso — sem nome, sem campo, sem preset. Sem este corte, os avisos de
   * "PDF sem texto" e "sem formulário" seriam verdadeiros e enganosos ao mesmo tempo.
   */
  if (sheet.pageCount > MAXIMO_DE_PAGINAS_DA_FICHA) {
    return { readerId, readerLabel, confidence, characterName: '', system: '', fields, presets, warnings: ['paginas-demais'] }
  }

  /**
   * A ficha que é ARTE COM ANOTAÇÃO por cima é um caminho à parte. Ela chegava pela porta errada:
   * com 41 fragmentos passava do corte de "PDF é imagem" e caía no caminho de documento de texto, que
   * procura "Rótulo:" impresso — e como ali é tudo desenho, saíam três pedaços de frase soltos, sem
   * nome, com um aviso falso de "é um PDF de texto".
   *
   * Só vale pro GENÉRICO: se um dedicado reconheceu a ficha, então existe estrutura.
   */
  if (readerId === 'generico' && pareceAnotacaoSobreImagem(sheet)) {
    return anotacaoSobreImagem(sheet, readerId, readerLabel, confidence)
  }

  if (sheet.fields.length === 0 && sheet.texts.length < TEXTO_MINIMO) {
    /**
     * PDF que é só IMAGEM. A ficha de Kids on Bikes que o usuário trouxe tem 1,4 MB, duas páginas e
     * exatamente UM fragmento de texto: é um digitalizado, ou uma arte exportada sem texto. Não há
     * nada a extrair sem OCR, e dizer "não achei nada" sem explicar por quê faria parecer defeito do
     * app.
     */
    warnings.push('pdf-sem-texto')
  } else if (sheet.fields.length === 0) {
    warnings.push('sem-formulario')
  } else if (preenchidos.length === 0) {
    warnings.push('formulario-vazio')
  }

  /**
   * Os rótulos impressos distribuídos SEM REPETIR (ver `rotulosExclusivos`) — cada texto rotula um
   * campo só. Calculado uma vez pra ficha inteira, e não campo a campo, porque a exclusividade é uma
   * decisão sobre o conjunto: só dá pra saber que este campo perdeu o rótulo olhando os outros.
   */
  const rotulos = rotulosExclusivos(sheet)

  /**
   * Valores preenchidos que ficaram SEM RÓTULO, nem impresso por perto nem em nome de campo que
   * preste. Não viram linha de conferência (uma linha "1_2 → 7" não informa nada e tira a confiança
   * do resto), mas também não somem — regra dele: "qualquer anotação de player no pdf precisamos
   * trazer". Vão pro `rawText`. Caixa de seleção fica de fora: sem rótulo, um "sim" não diz nem o que
   * foi marcado, é ruído na certa.
   */
  const semRotulo: string[] = []

  for (const campo of preenchidos) {
    const valor = valorDeFicha(campo.value, campo.type) as string
    const label = rotulos.get(campo) ?? labelFromFieldName(campo.name)
    if (!label) {
      if (!TIPOS_DE_CAIXA.has(campo.type ?? '')) semRotulo.push(valor)
      continue
    }
    fields.push({ label, value: valor, fieldName: campo.name })

    const lido = parseDiceExpression(valor)
    if (lido) {
      presets.push({
        name: label,
        // Sem conhecer o sistema não dá pra dizer se isto é acerto ou dano; `other` é a resposta
        // honesta, e a tela mostra assim.
        kind: 'other',
        expression: lido.expression,
        source: valor,
        fieldName: campo.name
      })
    }
  }

  /**
   * Ficha sem formulário: sobra o texto impresso. Rolagem escrita no papel ainda é rolagem, mas só a
   * que está numa CÉLULA, não a que está no meio de uma frase.
   *
   * O corte por comprimento existe porque sem ele a ficha de Oblivio de verdade, que traz as REGRAS
   * impressas junto, encheu a tela de presets como "permanentemente reduzido em 1D4 pontos (". 28
   * caracteres é o mesmo teto de `ehRotulo`. Não acerta sempre, mas o que passa se desmarca numa
   * caixa, enquanto prosa virando preset faz a lista inteira parecer inútil.
   */
  if (sheet.fields.length === 0) {
    // Rótulo e valor tirados do TEXTO impresso (ver `camposDoTexto`) — é o que faz uma ficha sem
    // formulário render um personagem em vez de só um punhado de rolagens soltas.
    const lidoDoTexto = lerCamposDoTexto(sheet)
    fields.push(...lidoDoTexto.campos)

    presets.push(...presetsDoTexto(sheet))

    /**
     * O QUE SOBROU do texto vai junto, como texto da ficha, e só no leitor GENÉRICO. O que não é
     * "Rótulo: valor" era jogado fora, e o Espaço Livre de Oblívio mostrou que é ali que o jogador
     * escreve o que não coube em campo nenhum. O leitor dedicado conhece o modelo e sabe separar o
     * impresso do digitado; o genérico não conhece, então traz tudo. Ficam de fora o título da ficha
     * e o rótulo impresso sem valor ("Nome:"), que são o modelo falando.
     */
    if (readerId === 'generico') {
      const sobra = sheet.texts
        .filter((texto) => !lidoDoTexto.usados.has(texto))
        .map((texto) => texto.text.trim())
        .filter((texto) => /[\p{L}\p{N}]{2}/u.test(texto) && !ehTituloDeFicha(texto) && !texto.endsWith(':'))
      if (sobra.length > 0) rawText = [...new Set(sobra)].join('\n')
    }
  }

  // Repetidos fora (a grade de perícias enche isto de cópias), a ordem preservada.
  const anotacoesSemRotulo = [...new Set(semRotulo)]
  if (anotacoesSemRotulo.length > 0) rawText = [rawText, anotacoesSemRotulo.join('\n')].filter(Boolean).join('\n\n')

  const semRuido = camposSemRepetidos(fields)
  const presetsFinais = presetsSemRepetidos(presets)
  const nome = acharNome(sheet, fields, readerId, leuAlgumaCoisa(sheet, semRuido, presetsFinais))

  /**
   * "Parece o modelo em branco" tem que ser dito mesmo com campos preenchidos, porque ficha em branco
   * não vem vazia: a de Ordem Paranormal traz 76 campos com valor de fábrica. Sem o aviso, a pessoa
   * abriria a conferência com dezenas de zeros e nenhuma pista de que o problema é o arquivo.
   *
   * O sinal são as duas coisas que só existem em ficha usada: um nome escrito NA ficha (e não
   * deduzido do arquivo) e alguma rolagem. O corte é `semRuido`, o que sobrou de verdade pra
   * importar, e não o que veio do PDF — o modelo em branco de Oblivio passava calado.
   */
  const nomeVeioDaFicha = fields.some((campo) => NOME_DO_PERSONAGEM.test(campo.label) && campo.value)
  if (semRuido.length > 0 && !nomeVeioDaFicha && presetsFinais.length === 0) {
    warnings.push('sem-nome-nem-rolagem')
  }

  return {
    readerId,
    readerLabel,
    confidence,
    characterName: nome,
    system: '',
    fields: semRuido,
    presets: presetsFinais,
    warnings,
    rawText
  }
}

/**
 * A leitura de uma ficha que é IMAGEM COM ANOTAÇÃO por cima. O que dá pra entregar é o texto
 * remontado em parágrafos, os parágrafos que a própria pessoa nomeou ("Durão: …") como campos, e um
 * palpite de nome. O que não dá é dizer o que cada coisa é — os nomes dos campos são pixel.
 *
 * Os presets saem da mesma varredura do outro caminho: "Adaga 1d4" escrito à mão numa arte continua
 * sendo rolagem. O que ela não pega, de propósito, é o "d20" solto que esta ficha tem seis vezes, um
 * por atributo: preset chamado "d20" é um botão que o app já tem.
 */
function anotacaoSobreImagem(
  sheet: PdfSheet,
  readerId: string,
  readerLabel: string,
  confidence: number
): SheetImport {
  const regioes = regioesDaFicha(sheet)
  const paragrafos = regioes.flat()
  const { fields, consumidos } = camposDeAnotacao(paragrafos)
  /**
   * O nome vem primeiro do CAMPO, e só depois do palpite pela posição: `palpiteDeNome` chuta o
   * primeiro parágrafo, que numa ficha datilografada costuma ser o TÍTULO ("FICHA DE INVESTIGADOR —
   * Chamado de Cthulhu") e é descartado por longo, caindo no nome do ARQUIVO. Medido numa ficha
   * assim: o app propunha "cthulhu" tendo lido "Nome: Elias Ramos" duas linhas antes.
   */
  const nome = palpiteDoCampoDeNome(fields) || palpiteDeNome(paragrafos)

  /**
   * O texto sem rótulo, DIVIDIDO por região da página, com uma linha em branco entre uma e outra.
   * Antes vinha tudo numa lista só, na ordem de leitura, o que intercalava as colunas da ficha e
   * produzia "rodrigo barreto / 11 / +1 / d20 / xxxxx": nada errado e ainda assim ilegível, porque
   * não é a ordem em que a pessoa escreveu ("dá pra dividir melhor"). Cada região é uma coluna ou um
   * bloco: o que estava junto no papel continua junto aqui.
   */
  const rawText = regioes
    .map((regiao) => regiao.filter((texto) => !consumidos.has(texto)).join('\n'))
    .filter((bloco) => bloco.trim().length > 0)
    .join('\n\n')

  const presets = presetsDoTexto(sheet)
  return {
    readerId,
    readerLabel,
    confidence,
    characterName: nome || nomeDeArquivoComoPalpite(sheet.fileName, readerId, leuAlgumaCoisa(sheet, fields, presets)),
    system: '',
    fields,
    presets,
    rawText,
    warnings: ['arte-com-anotacao']
  }
}

/**
 * Rolagens escritas no TEXTO impresso, pra ficha que não tem formulário.
 *
 * Vale pros dois tipos de ficha sem campo — documento de texto e arte anotada —, e por isso está
 * separada: numa arte, "Adaga 1d4" escrito à mão continua sendo uma rolagem do personagem, mesmo
 * que nada mais na página tenha rótulo.
 */
function presetsDoTexto(sheet: PdfSheet): SheetImportPreset[] {
  const presets: SheetImportPreset[] = []
  for (const texto of sheet.texts) {
    const limpo = texto.text.trim()
    if (!cabeComoNomeDeRolagem(limpo)) continue
    if (!ehNomeDeRolagem(limpo)) continue
    const lido = parseDiceExpression(limpo)
    if (!lido) continue
    presets.push({ name: limpo, kind: 'other', expression: lido.expression, source: limpo })
  }
  return presets
}

/**
 * A FORMA de uma linha de arma: um NOME antes do dado, e no máximo UMA palavra depois, como em
 * "Espada longa 1d8 cortante". Já foi só de TAMANHO, e os livros de Pathfinder 2e mostraram o que
 * passava: "You take 5d6 damage of the", "every 1d20 minutes (1 day)", "2d6 bludgeoning" — frase com
 * o dado no meio, ou célula de dano sem nome antes. Quarenta e oito caracteres continua sendo o teto.
 */
const LINHA_DE_ARMA = /^(?:.*?\p{L}.*?)\s+\d*[dD]\d+(?:\s*[+-]\s*\d+)?(?:\s+[\p{L}()]+)?\s*$/u

function cabeComoNomeDeRolagem(texto: string): boolean {
  if (texto.length > 48) return false
  return LINHA_DE_ARMA.test(texto)
}

/**
 * O texto tem NOME de rolagem, além da notação de dado? Num preset o nome é o que a pessoa lê na
 * lista: "1D4" não nomeia nada, e "1D4 PE. /" é pedaço de frase da página de equipamento de Oblivio.
 * Duas perguntas: sobra alguma PALAVRA depois de tirar a notação, e o que sobra é nome ou frase.
 * "Espada Longa 1d8" passa nas duas; "1D4" morre na primeira, "1D4 PE. /" na segunda.
 */
function ehNomeDeRolagem(texto: string): boolean {
  const semDados = texto.replace(/\d*\s*[dD]\s*\d+/g, ' ')
  if (!/[\p{L}]{2}/u.test(semDados)) return false
  // Pontuação de frase: ponto no fim, ou ponto seguido de espaço no meio.
  if (/\.\s*$|\.\s/.test(texto)) return false
  // Palavra que descreve o DADO não nomeia a rolagem — ver `PALAVRAS_DE_TABELA`.
  const palavras = semDados.split(/[^\p{L}]+/u).filter((p) => p.length > 1)
  if (palavras.length > 0 && palavras.every((p) => PALAVRAS_DE_TABELA.has(p.toLowerCase()))) return false
  return true
}

/**
 * Palavras que são CABEÇALHO DE TABELA, não nome de rolagem. A "TABELA DE FARDOS" de Oblivio tem uma
 * coluna chamada "RESULTADO 1D6": passava por todos os filtros (curta, com notação, com palavra, sem
 * pontuação de frase) e virava o único preset que a ficha produzia.
 *
 * O que elas têm em comum é DESCREVEREM O DADO em vez de nomearem a rolagem. Nos dois idiomas.
 */
const PALAVRAS_DE_TABELA = new Set([
  'resultado',
  'result',
  'dano',
  'damage',
  'teste',
  'test',
  'rolagem',
  'roll',
  'dado',
  'dados',
  'dice',
  'die',
  'total',
  'tabela',
  'table',
  'valor',
  'value'
])

/**
 * Tira linhas repetidas: mesmo rótulo e mesmo valor. Não é capricho — na ficha de Ordem Paranormal em
 * branco, a coluna de atributo das perícias produz QUARENTA linhas idênticas ("PRE = 0"), porque cada
 * perícia tem um campo desses e o rótulo impresso mais próximo de todos eles é a abreviação do
 * atributo. Quarenta linhas iguais são o que faz alguém parar de ler a lista.
 */
function camposSemRepetidos(fields: SheetImportField[]): SheetImportField[] {
  const vistos = new Set<string>()
  return fields.filter((campo) => {
    const chave = `${campo.label}|${campo.value}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

/**
 * Nome do personagem: primeiro um campo cujo rótulo diga isso, depois o nome do arquivo. O nome do
 * arquivo é palpite bom na prática (quem guarda ficha em PDF salva como "Riebeck.pdf") e melhor que
 * deixar em branco: o campo da conferência é editável, então errar custa uma correção de dois
 * segundos, e não sugerir custa a pessoa digitar tudo.
 */
/**
 * A leitura RENDEU alguma coisa? É o que decide se o nome do arquivo pode servir de palpite (ver
 * `nomeDeArquivoComoPalpite`), e é UMA regra pros dois caminhos do genérico — a revisão de código
 * pegou duas fórmulas diferentes, uma por caminho, que já tinham divergido.
 *
 * Três sinais, qualquer um basta: um campo importado, uma rolagem, ou uma LINHA DE CONTEÚDO na
 * página (quatro palavras ou mais que não sejam o título impresso). A ficha datilografada tem prosa,
 * e ali o palpite é bom; a ficha em branco de Kids on Bikes tem UM "X" de caixinha marcada; um
 * formulário em branco tem cinquenta campos vazios; e um modelo achatado tem "KIDS ON BIKES" sobre
 * "CHARACTER SHEET" e mais nada. Esta régua já foi "doze letras na página", e o modelo com o título
 * impresso passava por ela com doze letras exatas.
 */
const PALAVRAS_MINIMAS = 4

function leuAlgumaCoisa(sheet: PdfSheet, fields: SheetImportField[], presets: SheetImportPreset[]): boolean {
  if (fields.length > 0 || presets.length > 0) return true
  /**
   * Formulário com todos os campos vazios é o MODELO EM BRANCO, por mais texto impresso que tenha —
   * a ficha oficial de Pathfinder 2e traz instruções de quatro palavras em toda caixa, e ganhava
   * "RemasterPlayerCoreCharacterSheet Form Fillable" como nome de personagem. O texto só conta como
   * conteúdo em documento SEM formulário, que é a ficha datilografada.
   */
  if (sheet.fields.length > 0) return false
  return sheet.texts.some((texto) => ehLinhaDeConteudo(texto.text))
}

/** Uma linha de CONTEÚDO escrito: quatro palavras ou mais, e não o título impresso da ficha. */
function ehLinhaDeConteudo(texto: string): boolean {
  if (ehTituloDeFicha(texto)) return false
  const palavras = texto.split(/\s+/).filter((palavra) => /\p{L}/u.test(palavra))
  return palavras.length >= PALAVRAS_MINIMAS
}

function acharNome(sheet: PdfSheet, fields: SheetImportField[], readerId: string, leuAlgo: boolean): string {
  const doCampo = palpiteDoCampoDeNome(fields)
  if (doCampo) return doCampo
  return nomeDeArquivoComoPalpite(sheet.fileName, readerId, leuAlgo)
}

/**
 * O nome do ARQUIVO como último recurso, e não sempre.
 *
 * Quando um leitor DEDICADO reconheceu o sistema e mesmo assim não achou nome escrito, o arquivo é
 * quase certamente a ficha em branco baixada do site, e o nome dele é o título dela: o app propunha
 * criar um personagem chamado "Ordem Paranormal - Ficha de Personagem Editável". Vazio é melhor —
 * a conferência não deixa confirmar sem nome, então a pessoa digita o dela.
 *
 * No GENÉRICO o palpite continua: ali ninguém reconheceu nada, e "Elias - ficha.pdf" é o único
 * indício que existe.
 */
function nomeDeArquivoComoPalpite(fileName: string, readerId: string, leuAlgo: boolean): string {
  if (readerId !== 'generico') return ''
  /**
   * E nem no genérico, quando a leitura veio VAZIA: o palpite se justifica por ser o único indício
   * que existe, e isso vale quando existe uma ficha por trás dele. Sem nenhum campo e nenhuma
   * rolagem, propor o nome do arquivo cria um personagem chamado "Ficha Kids on Bikes" com a ficha em
   * branco — era o caso daquela ARTE achatada, com zero campos e UM fragmento de texto, a letra "X".
   * Ficha datilografada sem campo mas com parágrafos continua ganhando o palpite.
   */
  if (!leuAlgo) return ''
  return fileName.replace(/\.pdf$/i, '').trim()
}

/**
 * O valor do campo cujo RÓTULO diz que ali mora o nome do personagem ("Nome", "Personagem",
 * "Character"…); vazio quando não há nenhum, e quem chama decide o que fazer. Separada de `acharNome`
 * porque os dois caminhos do leitor genérico precisam dela e só um tinha.
 */
/**
 * "Character Sheet" e "Ficha de personagem" começam como o rótulo do nome e são o TÍTULO da ficha. A
 * palavra que denuncia é "sheet"/"ficha", e não "character"/"personagem", que são exatamente os
 * rótulos legítimos do campo de nome ("Personagem" em Ordem Paranormal, "Character Name" em D&D).
 */
const ROTULO_DE_TITULO = /\b(ficha|sheet)\b/i

function palpiteDoCampoDeNome(fields: SheetImportField[]): string {
  const doCampo = fields.find((campo) => NOME_DO_PERSONAGEM.test(campo.label) && !ROTULO_DE_TITULO.test(campo.label))
  const valor = doCampo?.value?.trim() ?? ''
  return pareceNomeDePersonagem(valor) ? valor : ''
}

/**
 * Um NOME cabe numa linha e não é frase. O livro de regras de Pathfinder 2e, lido como se fosse ficha
 * antes do teto de páginas, tinha na prosa o par "Character Sheet: Each player will need a character
 * sheet to create their character…", e a frase inteira virou o nome proposto. Sessenta caracteres
 * cabem em "Alexandre Guilherme de Souza Menezes Filho"; ponto seguido de espaço, ou no fim, é frase.
 */
export function pareceNomeDePersonagem(valor: string): boolean {
  if (!valor || valor.length > 60) return false
  // Nome tem LETRA. "123.456.789-00" passou por aqui uma vez (nona leva: o CPF de uma ficha de
  // inscrição proposto como personagem) — número, data e telefone nunca são nome de ninguém.
  if (!/\p{L}/u.test(valor)) return false
  return !/\.\s|\.$/.test(valor)
}

/**
 * Tira presets repetidos: mesma expressão e mesmo nome. Ficha com grade de ataques repete a mesma
 * arma em linhas diferentes, e o modo sem formulário lê o mesmo texto uma vez por fragmento que o
 * extrator devolve. Vinte presets "1d6" iguais na tela é o tipo de resultado que faz alguém fechar a
 * janela.
 */
export function presetsSemRepetidos(presets: SheetImportPreset[]): SheetImportPreset[] {
  const vistos = new Set<string>()
  return presets.filter((preset) => {
    const chave = `${preset.name}|${JSON.stringify(preset.expression)}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}
