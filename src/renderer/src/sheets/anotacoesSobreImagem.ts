import type { PdfSheet, PdfText, SheetImportField } from '@shared/types/sheetImport'
import { ehRotuloPlausivel } from './camposDoTexto'

/**
 * A ficha que é uma IMAGEM com texto escrito por cima.
 *
 * É o terceiro tipo de ficha que apareceu, e ele não se parece com nenhum dos outros dois. A de
 * Ordem Paranormal é formulário; a de Oblivio é documento de texto; a de Kids on Bikes é uma ARTE —
 * o desenho inteiro, incluindo os nomes dos campos, é pixel. Quem preenche abre num anotador de PDF
 * e digita por cima. O arquivo em branco tem UM fragmento de texto; o preenchido tem 41, e os 41 são
 * exatamente o que a pessoa escreveu.
 *
 * O que isso significa, e é a limitação central deste módulo: NÃO EXISTE RÓTULO PRA CASAR. Os nomes
 * dos campos não estão no arquivo em lugar nenhum. Dá pra saber que a pessoa escreveu "d20" na
 * metade direita da primeira página; não dá pra saber que aquilo é o dado de Força, porque a palavra
 * "Força" é desenho. Chutar pela posição — "o primeiro dado da grade é sempre o primeiro atributo" —
 * funcionaria nesta ficha e mentiria com cara de certeza em qualquer outra arte.
 *
 * Então o que este módulo faz é o que dá pra fazer sem inventar: RECONSTRUIR o que foi escrito, na
 * ordem em que está na página, e entregar isso pro usuário organizar. Nada se perde, e nada é
 * apresentado como se o app soubesse o que é.
 */

/**
 * Acima desta densidade de texto por página, o PDF é um DOCUMENTO, não uma arte anotada.
 *
 * Medido nas fichas de referência: Oblivio (texto de verdade, com as regras impressas junto) tem 68
 * fragmentos por página; Kids on Bikes preenchida tem 20,5. Os dois grupos não chegam perto de se
 * encostar, e 40 fica no meio com folga dos dois lados.
 *
 * A conta é por PÁGINA e não no total porque ficha longa não é ficha densa: a de Oblivio tem 13
 * páginas e a de Kids on Bikes, 2.
 */
const TEXTOS_POR_PAGINA = 40

/** Menos que isto não é nem anotação: é PDF de imagem pura, e não há o que importar. */
export const TEXTO_MINIMO = 3

/** Mesma linha, na vertical. */
const MESMA_LINHA = 3

/**
 * Espaço horizontal que ainda conta como "mesma linha", em múltiplos da altura da fonte.
 *
 * É proporcional porque um vão de 24 pontos é um espaço normal num texto de corpo 26 e é uma coluna
 * inteira num de corpo 9. Calibrado no arquivo real: "bike preta intensa:" e "Você" são o mesmo
 * texto partido pelo extrator, com 3 pontos entre eles; já "d20" e "d12" são os dados de DOIS
 * atributos diferentes, com 24 pontos entre eles e corpo 26. O fator 0,8 separa os dois casos.
 */
const FATOR_DE_ESPACO = 0.8

/**
 * Duas linhas seguidas de um mesmo parágrafo, na vertical, em múltiplos da altura da fonte.
 *
 * 1,8 sai de medir os dois lados: dentro dos parágrafos reais desta ficha as linhas ficam a 1,3–1,4
 * alturas uma da outra, e dois campos DIFERENTES preenchidos um embaixo do outro ("Novo Aluno
 * Misterioso" e a linha seguinte) ficam a 2,2. Com o teto em 2,2 os dois campos viravam um
 * parágrafo só.
 */
const FATOR_DE_ENTRELINHA = 1.8

/** Quanto a margem esquerda pode variar dentro do mesmo parágrafo. É o que separa as COLUNAS. */
const MARGEM = 12

interface Paragrafo {
  page: number
  x: number
  /** Y da última linha adicionada — é por ela que a próxima linha decide se continua o parágrafo. */
  y: number
  linhas: string[]
}

/**
 * É uma arte anotada?
 *
 * Duas condições, e as duas são necessárias: não ter campo de formulário (senão é o caso fácil, e o
 * formulário é sempre melhor que qualquer palpite) e ter texto ESPARSO. A segunda é o que separa
 * esta ficha de um documento de texto, onde `camposDoTexto` faz um trabalho muito melhor porque lá
 * existem rótulos impressos pra casar.
 */
export function pareceAnotacaoSobreImagem(sheet: PdfSheet): boolean {
  if (sheet.fields.length > 0) return false
  if (sheet.texts.length < TEXTO_MINIMO) return false
  const paginas = Math.max(1, sheet.pageCount)
  return sheet.texts.length / paginas < TEXTOS_POR_PAGINA
}

/**
 * O que foi escrito na ficha, remontado em parágrafos e em ordem de leitura.
 *
 * O extrator de PDF devolve fragmentos, não frases: "Heróico: Você não precisa da", "permissão do
 * Mestre para", "gastar Fichas de Adversidade". Sem remontar, cada pedaço vira uma linha solta e o
 * texto chega picado na ficha do app — que foi o que aconteceu na primeira leitura deste arquivo.
 *
 * A remontagem é em dois passos, e o segundo respeita COLUNA: a página 2 desta ficha tem dois blocos
 * de texto lado a lado, com as mesmas alturas. Juntar por altura só, sem olhar a margem esquerda,
 * intercala os dois e produz "Heróico: Você não precisa da Pegs Apoio nas rodas Você pode permissão
 * do Mestre para levar um passageiro em pé" — frase que não existe em lugar nenhum.
 */
export function paragrafosDaFicha(sheet: PdfSheet): string[] {
  return regioesDaFicha(sheet).flat()
}

/** Os parágrafos com posição, antes de virar texto. Ver `paragrafosDaFicha` e `regioesDaFicha`. */
function paragrafosCrus(sheet: PdfSheet): Paragrafo[] {
  /**
   * Ordem de leitura: página, depois de cima pra baixo, depois da esquerda pra direita.
   *
   * O Y entra ARREDONDADO em faixas do tamanho de uma linha, e não cru, porque dois fragmentos da
   * mesma linha quase nunca têm o Y idêntico — nesta ficha, "d4" está em 543 e "d8" em 544. Com o Y
   * cru, "d8" vinha antes de "d4" e o passo seguinte os via como vizinhos com folga negativa,
   * grudando os dados de dois atributos numa coisa só ("d8 d4").
   */
  const faixa = (item: PdfText): number => Math.round(item.y / MESMA_LINHA)
  const ordenado = [...sheet.texts].sort(
    (a, b) => a.page - b.page || faixa(b) - faixa(a) || a.x - b.x
  )

  // 1. LINHAS: fragmentos na mesma altura e horizontalmente vizinhos.
  const linhas: {
    page: number
    x: number
    y: number
    fim: number
    /** `null` quando o PDF não declara altura de fonte — aí esta linha não junta com nenhuma. */
    altura: number | null
    partes: string[]
  }[] = []
  for (const item of ordenado) {
    const atual = linhas[linhas.length - 1]
    const vizinho =
      atual !== undefined &&
      atual.altura !== null &&
      atual.page === item.page &&
      Math.abs(atual.y - item.y) <= MESMA_LINHA &&
      item.x - atual.fim <= atual.altura * FATOR_DE_ESPACO
    if (vizinho) {
      atual.partes.push(item.text.trim())
      atual.fim = item.x + item.width
      continue
    }
    linhas.push({
      page: item.page,
      x: item.x,
      y: item.y,
      fim: item.x + item.width,
      altura: alturaUtil(item),
      partes: [item.text.trim()]
    })
  }

  // 2. PARÁGRAFOS: linhas seguidas, na mesma coluna, sem buraco vertical entre elas.
  const paragrafos: Paragrafo[] = []
  for (const linha of linhas) {
    const texto = linha.partes.join(' ').trim()
    if (!texto) continue
    /**
     * A busca é de trás pra frente, e não só no último parágrafo: em página de duas colunas as
     * linhas chegam alternadas (esquerda, direita, esquerda…), e olhar apenas o anterior faria toda
     * linha começar um parágrafo novo.
     */
    /**
     * Linha que é ela mesma um "Rótulo: valor" COMEÇA parágrafo, nunca continua o de cima.
     *
     * `camposDoTexto` já tinha essa regra (ver `linhasSeguintes` lá) e aqui faltava — e o efeito
     * apareceu no corpus fabricado: uma ficha datilografada de poucas linhas, que cai neste caminho
     * por ter texto esparso, virava UM campo só com a ficha inteira dentro ("Nome = Otávio Lins
     * Ocupacao: Fotógrafo Idade: 29 Sanidade: 58"). Quatro campos viravam um, e o nome do
     * personagem saía com a ficha grudada nele.
     *
     * Não atrapalha a arte anotada, que é o que este caminho existe pra ler: ali a continuação é
     * pedaço de frase ("rolagem de combate, adicione +3"), e pedaço de frase não tem rótulo.
     */
    const comecaCampoNovo = ehRotuloDaPessoa(texto)

    const continuacao = comecaCampoNovo
      ? undefined
      : [...paragrafos]
          .reverse()
          .find(
            (p) =>
              p.page === linha.page &&
              Math.abs(p.x - linha.x) <= MARGEM &&
              p.y - linha.y > 0 &&
              linha.altura !== null &&
              p.y - linha.y <= linha.altura * FATOR_DE_ENTRELINHA
          )
    if (continuacao) {
      continuacao.linhas.push(texto)
      continuacao.y = linha.y
      continue
    }
    paragrafos.push({ page: linha.page, x: linha.x, y: linha.y, linhas: [texto] })
  }

  return paragrafos
}

/**
 * Os parágrafos agrupados por REGIÃO da página, cada região na ordem em que se lê.
 *
 * É o conserto da bagunça que sobrava no Kids on Bikes. A ficha tem duas colunas bem separadas — a
 * identidade à esquerda (x entre 32 e 198) e os dados dos atributos à direita (x entre 415 e 533) —,
 * e ordenar tudo por altura INTERCALA as duas: "rodrigo barreto / 11 / Novo Aluno Misterioso / +1 /
 * d20 / xxxxx / supersticioso / d6". Nada disso está errado, e mesmo assim não dá pra ler, porque a
 * pessoa não escreveu naquela ordem.
 *
 * Agrupar por região é honesto de um jeito que adivinhar significado não é: não afirma que o "d20" é
 * o dado de Força — só devolve junto o que foi escrito junto. E numa ficha de uma coluna só ela
 * degrada sozinha pra um grupo, sem mudar nada.
 */
export function regioesDaFicha(sheet: PdfSheet): string[][] {
  return porRegiao(paragrafosCrus(sheet)).map((regiao) =>
    regiao.map((p) => p.linhas.join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  )
}

/**
 * Onde uma COLUNA acaba e a outra começa, em pontos de PDF.
 *
 * Medido nas duas páginas do arquivo real: dentro de uma mesma coluna a maior variação de margem é
 * 62 pontos (recuo de item de lista); entre colunas diferentes são 201 e 217. 120 passa no meio, com
 * folga dos dois lados.
 */
const ENTRE_COLUNAS = 120

function porRegiao(paragrafos: Paragrafo[]): Paragrafo[][] {
  const regioes: Paragrafo[][] = []
  // Por página, e dentro dela por margem esquerda: é a margem que separa uma coluna da outra.
  const paginas = [...new Set(paragrafos.map((p) => p.page))].sort((a, b) => a - b)

  for (const pagina of paginas) {
    const daPagina = [...paragrafos.filter((p) => p.page === pagina)].sort((a, b) => a.x - b.x)
    let atual: Paragrafo[] = []
    let ultimoX: number | null = null

    for (const paragrafo of daPagina) {
      if (ultimoX !== null && paragrafo.x - ultimoX > ENTRE_COLUNAS) {
        regioes.push(atual)
        atual = []
      }
      atual.push(paragrafo)
      ultimoX = paragrafo.x
    }
    if (atual.length > 0) regioes.push(atual)
  }

  // Dentro da região, de cima pra baixo — que é como se lê uma coluna.
  return regioes.map((regiao) => [...regiao].sort((a, b) => b.y - a.y))
}

/**
 * A altura da fonte, ou `null` quando o PDF não declara uma.
 *
 * As duas juntas — "mesma linha" e "mesmo parágrafo" — são medidas em múltiplos dela, então sem
 * altura não há régua. A resposta a isso é NÃO JUNTAR, e não chutar um valor: com um piso inventado
 * de 10 pontos, um arquivo de entrelinha 17 tinha todas as suas linhas dentro do limite e a página
 * inteira virava um parágrafo só. Perder a remontagem custa linhas soltas; colar tudo custa a ficha.
 */
function alturaUtil(item: PdfText): number | null {
  return item.height > 0 ? item.height : null
}

/** Rótulo digitado pela própria pessoa, na forma "Heróico: você não precisa…". */
const ROTULO_E_VALOR = /^([^:]{2,28})\s*:\s*(\S[\s\S]*)$/

/**
 * O texto começa com um rótulo que a PESSOA escreveu?
 *
 * Mesma régua que `camposDeAnotacao` usa pra decidir o que vira campo, extraída porque a remontagem
 * de parágrafos precisa dela ANTES: linha que é "Rótulo: valor" começa parágrafo novo em vez de
 * continuar o de cima. Sem isso, uma ficha datilografada de poucas linhas — que cai neste caminho
 * por ter texto esparso — virava um campo só com a ficha inteira dentro.
 */
function rotuloDaPessoa(texto: string): { label: string; value: string } | null {
  const match = ROTULO_E_VALOR.exec(texto)
  if (!match) return null
  const label = match[1].trim()
  // A régua do que é rótulo é UMA, a de `camposDoTexto` — a revisão de código pegou uma cópia dela
  // aqui, e cópia é o jeito de as duas leituras da ficha passarem a discordar.
  return ehRotuloPlausivel(label) ? { label, value: match[2].trim() } : null
}

function ehRotuloDaPessoa(texto: string): boolean {
  return rotuloDaPessoa(texto) !== null
}

/** A partir daqui o valor é descrição, não dado solto. Mesmo número do leitor de Oblivio. */
const TAMANHO_DE_HABILIDADE = 25

/**
 * Um parágrafo escrito como "Rótulo: valor" vira CAMPO; o resto continua texto.
 *
 * Quem preenche uma arte anotada escreve assim quando quer nomear o que está escrevendo — nesta
 * ficha, "Heróico: Você não precisa da permissão do Mestre…" e "Durão: Se você perder uma rolagem…"
 * são as vantagens do personagem, nomeadas pela própria pessoa. É o único rótulo confiável que este
 * tipo de arquivo tem, porque foi DIGITADO, não desenhado.
 */
export function camposDeAnotacao(paragrafos: string[]): {
  fields: SheetImportField[]
  restante: string[]
  /**
   * Os parágrafos JÁ RESOLVIDOS: os que viraram campo (inclusive os descartados por repetição) e os
   * que foram jogados fora de propósito.
   *
   * Quem monta o texto solto precisa desta lista, e não da de campos. A frase repetida some da lista
   * de campos e, sem isto, reaparecia no texto como se nunca tivesse sido tratada — o mesmo conteúdo
   * duas vezes na ficha, com dois nomes diferentes.
   */
  consumidos: Set<string>
} {
  const fields: SheetImportField[] = []
  const restante: string[] = []
  const consumidos = new Set<string>()

  for (const paragrafo of paragrafos) {
    const rotulado = rotuloDaPessoa(paragrafo)
    if (rotulado) {
      const { label, value } = rotulado
      /**
       * Parágrafo nomeado pela própria pessoa é HABILIDADE, e vai pro bloco de habilidades.
       *
       * Numa arte anotada, o que ela nomeia e descreve por extenso é a vantagem/talento que escolheu
       * — "Durão: Se você perder uma rolagem de combate…". Sem grupo, esses campos caíam numa seção
       * genérica, e o usuário viu o resultado: uma seção chamada só "FICHA", que não diz nada. É a
       * mesma régua que o leitor de Oblivio já usava pros talentos dele, agora valendo pros dois.
       */
      fields.push(
        value.length > TAMANHO_DE_HABILIDADE ? { label, value, group: 'Habilidades' } : { label, value }
      )
      consumidos.add(paragrafo)
      continue
    }

    if (ehSoMarca(paragrafo)) {
      consumidos.add(paragrafo)
      continue
    }
    restante.push(paragrafo)
  }

  return { fields: semRepetirOMesmoTexto(fields), restante, consumidos }
}

/**
 * Parágrafo que é só MARCA DE CAIXINHA — "X", "X X", "checked".
 *
 * Numa arte anotada, o X marca uma caixa do DESENHO, e o que ele marca é pixel. Um "X" sozinho na
 * ficha não informa nada a ninguém: nem que caixa era, nem de que lista. É diferente de "xxxxxxxx",
 * que é a pessoa escrevendo x pra ocupar um campo — isso é conteúdo dela, e fica.
 */
function ehSoMarca(paragrafo: string): boolean {
  const limpo = paragrafo.trim()
  return limpo.length <= 5 && MARCAS.test(limpo)
}

/**
 * O que é só uma MARCA de "sim" numa ficha desenhada — X, tique, quadradinho marcado.
 *
 * `\s` no lugar do espaço-e-tabulação que estavam escritos LITERALMENTE dentro da classe: uma
 * tabulação de verdade no meio de uma expressão regular é invisível na leitura e indistinguível de
 * um espaço, então ninguém consegue conferir se ela está lá. O `\s` diz a mesma coisa por escrito.
 */
const MARCAS = /^[xX✓✔☑][\s✓✔☑xX]*$/

/**
 * Tira o campo que repete o MESMO VALOR sob um rótulo menos específico.
 *
 * Quem preenche uma arte anotada escreve a mesma coisa em mais de um lugar da ficha — na Kids on
 * Bikes, "Você ganha +1 em testes de Luta." aparece nas duas páginas, uma vez como "preta intensa" e
 * outra como "bike preta intensa", porque na página 1 a palavra "bike" faz parte do DESENHO e na 2
 * não. São a mesma anotação, e importar as duas é a bagunça que o usuário já apontou.
 *
 * O corte exige as duas coisas: valor idêntico E um rótulo contido no outro. Só o valor não bastaria
 * — duas vantagens podem ter a mesma descrição curta —, e só o rótulo muito menos. Quando os rótulos
 * não se contêm, os dois ficam: aí são nomes diferentes de verdade, e escolher um seria chute.
 */
function semRepetirOMesmoTexto(fields: SheetImportField[]): SheetImportField[] {
  const mantidos: SheetImportField[] = []

  for (const campo of fields) {
    const anterior = mantidos.findIndex(
      (outro) =>
        outro.value === campo.value &&
        (contem(outro.label, campo.label) || contem(campo.label, outro.label))
    )
    if (anterior < 0) {
      mantidos.push(campo)
      continue
    }
    // Fica o rótulo mais longo: é o que traz a palavra que o outro perdeu pro desenho.
    if (campo.label.length > mantidos[anterior].label.length) mantidos[anterior] = campo
  }

  return mantidos
}

function contem(maior: string, menor: string): boolean {
  return maior.toLocaleLowerCase('pt-BR').includes(menor.toLocaleLowerCase('pt-BR'))
}

/**
 * Palpite de NOME do personagem: o primeiro texto da página 1.
 *
 * Em ficha de RPG o nome fica no alto e à esquerda de tudo — é a primeira coisa que se lê e a
 * primeira que se preenche. É palpite, e é assumido como tal: a alternativa que existia era o nome
 * do ARQUIVO, que nesta ficha daria "Ficha Kids on Bikes - Preenchida" como nome do personagem. O
 * campo é editável na tela de conferência, então errar custa uma correção e acertar poupa digitação.
 */
export function palpiteDeNome(paragrafos: string[]): string {
  const primeiro = paragrafos[0]?.trim() ?? ''
  if (!primeiro || primeiro.length > 40) return ''
  if (!/[\p{L}]{2}/u.test(primeiro)) return ''
  if (ehTituloDeFicha(primeiro)) return ''
  /**
   * "KIDS ON BIKES" em cima de "CHARACTER SHEET": o nome do JOGO, em caixa alta, seguido do
   * subtítulo que diz que aquilo é uma ficha. É o cabeçalho impresso do modelo, e não um nome —
   * um nome escrito à mão raramente vem todo em maiúsculas com o subtítulo da ficha logo abaixo.
   */
  const segundo = paragrafos[1]?.trim() ?? ''
  if (!/[\p{Ll}]/u.test(primeiro) && ehTituloDeFicha(segundo)) return ''
  return primeiro
}

/**
 * O que NUNCA é nome: o título impresso da própria ficha. Uma arte achatada com "KIDS ON BIKES
 * CHARACTER SHEET" no alto passava por aqui e virava um personagem chamado assim — achado pela
 * quinta leva de PDFs de teste, na importação pela tela. Em português e em inglês, porque a régua
 * do importador é a mesma pras duas.
 */
const TITULO_DE_FICHA = /\b(ficha|sheet|character|personagem|investigador|investigator)\b/iu

export function ehTituloDeFicha(texto: string): boolean {
  return TITULO_DE_FICHA.test(texto)
}
