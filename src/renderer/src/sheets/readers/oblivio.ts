import type { PdfText, PdfSheet, SheetImportPreset } from '@shared/types/sheetImport'
import { parseDiceExpression } from '@shared/dice/parseDiceExpression'
import { extrairGenerico } from './generic'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de OBLIVIO.
 *
 * Ela é o oposto da de Ordem Paranormal: não tem campo de formulário NENHUM — é um documento do
 * Google Docs exportado, e quem preenche digita dentro dele. Por isso este leitor não tem uma lista
 * de nomes de campo como o outro; ele se apoia inteiro no que `camposDoTexto` extrai do texto
 * impresso, e acrescenta o que só quem conhece o sistema sabe: que sistema é, e como agrupar.
 *
 * É também a prova de que o registro de leitores serve pros DOIS tipos de ficha, que é o que
 * importa pro pedido de aceitar fichas de outros usuários.
 */

/**
 * ATRIBUTOS e ASPECTOS são coisas DIFERENTES na ficha, e agora são grupos diferentes aqui.
 *
 * A própria página separa os dois com dois títulos: "Atributos" (Carne, Força, Prontidão,
 * Determinação, Mente) e, embaixo, "Aspectos" — Coragem, Dor, Fôlego, Proteção e Velocidade, que
 * são DERIVADOS dos primeiros ("é derivada de Determinação e Mente", diz a ficha em cada um deles).
 * Este leitor jogava os dez no mesmo grupo, e a conferência mostrava um quadro de dez atributos que
 * não existe em Oblivio nenhum — cinco deles não são escolha do jogador, são conta.
 *
 * A DETECÇÃO continua olhando os dez juntos (`IMPRESSAO_DIGITAL`): é a assinatura do arquivo, e não
 * muda por causa de como a gente agrupa depois. Ela é por eles, e não pela palavra "Oblivio" — que
 * NÃO aparece em lugar nenhum do arquivo, conferido nas duas versões (em branco e preenchida).
 */
const ATRIBUTOS = ['Carne', 'Força', 'Prontidão', 'Determinação', 'Mente']

const ASPECTOS = ['Coragem', 'Dor', 'Fôlego', 'Proteção', 'Velocidade']

const IMPRESSAO_DIGITAL = [...ATRIBUTOS, ...ASPECTOS]

/** Partes do corpo, que na ficha têm dano acumulado por região. */
const CORPO = ['Torso', 'Braço Direito', 'Braço Esquerdo', 'Perna Direita', 'Perna Esquerda']

const IDENTIFICACAO = ['Nome', 'Papel', 'Motivação']

/**
 * "Descrição" é APARÊNCIA, e não identificação.
 *
 * O conteúdo dela na ficha real é um parágrafo de 280 caracteres sobre cabelo, moletom e cicatriz —
 * exatamente o que o bloco de aparência existe pra guardar. Como campo de seção ele virava uma linha
 * de formulário com um texto que não cabe nela.
 */
const APARENCIA = ['Descrição', 'Aparência']

/**
 * A partir daqui, o que sobrou é HABILIDADE.
 *
 * Numa ficha de Oblivio preenchida, o que não é identificação, atributo ou parte do corpo e ainda
 * assim tem um parágrafo dentro é o talento que o jogador escolheu, escrito por extenso — "Estocada:
 * Você realiza a Ação de Cena 'Mover'…". Eles são o único conteúdo do arquivo com valor comprido: o
 * resto é "2/10", "0/3", nome próprio.
 *
 * O corte é pelo TAMANHO e não por uma lista de talentos porque a lista mudaria a cada suplemento —
 * e uma lista desatualizada devolve o talento novo pra pilha de campos sem grupo, que é justamente o
 * que se quer evitar. Errar aqui custa uma habilidade caindo no lugar errado da ficha; acertar
 * manda o texto pro bloco de habilidades, que é onde se escreve frase.
 */
const TAMANHO_DE_HABILIDADE = 25

/**
 * O EQUIPAMENTO CARREGADO — a parte da ficha que este leitor perdia inteira.
 *
 * Medido na ficha real: o personagem carrega uma "Vestimenta Leve" no torso e uma "Lâmina Curta" no
 * braço esquerdo, com dano 1D4 e um modificador que soma 1d6. Nada disso chegava na importação, e é
 * o que um jogador mais quer ver na ficha depois dos atributos — é a arma dele.
 *
 * A causa era o formato: a página escreve o equipamento como "○ Torso:" seguido do item nas linhas
 * de baixo, e `camposDoTexto` procura "Rótulo: valor" na MESMA linha. O rótulo "Torso:" ainda por
 * cima colide com a região de dano do corpo ("Torso: 0/5"), que aparece antes — então mesmo o que
 * casava era descartado como repetido.
 *
 * Por isso a leitura aqui é por REGIÃO da página, e não por par rótulo/valor: do título
 * "Equipamentos Carregados:" até "Equipamentos Guardados:", cada "○ <Região>:" abre um item e tudo
 * o que vem até o próximo "○" é o texto dele.
 */
const REGIOES_DO_CORPO = /^(Torso|Braço Direito|Braço Esquerdo|Perna Direita|Perna Esquerda):$/

/** O item vira preset quando ele diz o próprio dano — "Dano: 1D4 PE." na ficha real. */
const DANO_DO_ITEM = /Dano:\s*(\d*[dD]\d+(?:\s*[+-]\s*\d+)?)/

interface ItemCarregado {
  regiao: string
  texto: string
}

/**
 * O nome do item pro preset: o começo da linha, sem a ficha técnica e sem o parêntese de exemplos.
 *
 * Na ficha real o item se chama "Lâmina Curta (Adaga, Faca, Punhal…)" — o parêntese é a lista de
 * armas que caem naquela categoria, não parte do nome. Um preset chamado "Lâmina Curta (Adaga,
 * Faca, Punhal…) (dano)" é ilegível no botão, e é o botão que a pessoa vai apertar no meio da mesa.
 */
function nomeCurtoDoItem(item: ItemCarregado): string {
  const semFichaTecnica = item.texto.split(/Espaços de Invent[áa]rio/)[0].trim()
  const semExemplos = semFichaTecnica.split('(')[0].trim()
  return semExemplos.length >= 3 ? semExemplos : semFichaTecnica || item.regiao
}

/**
 * Os itens carregados, na ordem da página. Vazio quando a ficha não tem a seção (modelo antigo) ou
 * quando ninguém equipou nada — os dois casos são normais e não merecem aviso.
 */
function equipamentoCarregado(sheet: PdfSheet): ItemCarregado[] {
  const inicio = sheet.texts.findIndex((t) => /Equipamentos Carregados/i.test(t.text))
  if (inicio < 0) return []
  const fim = sheet.texts.findIndex(
    (t, i) => i > inicio && /Equipamentos Guardados|Espaço Livre|Mazelas/i.test(t.text)
  )
  const trecho = sheet.texts.slice(inicio + 1, fim > 0 ? fim : undefined)

  const itens: ItemCarregado[] = []
  let atual: ItemCarregado | null = null
  for (const fragmento of trecho) {
    const texto = fragmento.text.trim()
    if (!texto || texto === '○' || texto === '●') continue
    const regiao = REGIOES_DO_CORPO.exec(texto)
    if (regiao) {
      atual = { regiao: regiao[1], texto: '' }
      itens.push(atual)
      continue
    }
    if (!atual) continue
    // Fragmentos colados com espaço: o extrator quebra a linha em pedaços ("Espaços de Inventário",
    // ": 1. /", "Limite de Estresse:"), e juntá-los devolve a linha como ela está impressa.
    atual.texto = atual.texto ? `${atual.texto} ${texto}` : texto
  }

  return itens.filter((item) => item.texto.trim().length > 0)
}

/**
 * O INVENTÁRIO GUARDADO — reporte de tester: "não scrapou os itens do inventário".
 *
 * "Equipamentos Guardados:" é uma área LIVRE do documento: o modelo não imprime nada ali (nem as
 * regiões do corpo — guardado não está vestido), e quem preenche digita os itens como lista do
 * Google Docs. Este leitor usava o título só como marcador de FIM dos carregados e jogava fora
 * tudo que vinha depois — o inventário inteiro do personagem.
 *
 * A leitura é a mesma ideia da dos carregados, trocando o que abre um item: aqui não há "○ Torso:",
 * então é o próprio marcador de lista ("○"/"●") que abre. Um trecho que começa com "Mod" cola no
 * item anterior — é o formato do modificador de arma, aninhado no item (visto na ficha real, seção
 * de carregados: "● Mod: Mortal: Adiciona 1d6…"). Sem marcador nenhum, o texto inteiro vira um item
 * só: importar em bloco é melhor que não importar.
 */
function equipamentoGuardado(sheet: PdfSheet): ItemCarregado[] {
  const inicio = sheet.texts.findIndex((t) => /Equipamentos Guardados/i.test(t.text))
  if (inicio < 0) return []
  const fim = sheet.texts.findIndex((t, i) => i > inicio && /Espaço Livre|Mazelas/i.test(t.text))
  const trecho = sheet.texts.slice(inicio + 1, fim > 0 ? fim : undefined)

  const partes: string[] = []
  let atual: string | null = null
  for (const fragmento of trecho) {
    const texto = fragmento.text.trim()
    if (!texto) continue
    if (texto === '○' || texto === '●') {
      if (atual !== null && atual.trim()) partes.push(atual.trim())
      atual = ''
      continue
    }
    atual = atual === null ? texto : `${atual} ${texto}`.trim()
  }
  if (atual !== null && atual.trim()) partes.push(atual.trim())

  const itens: string[] = []
  for (const parte of partes) {
    if (/^Mod\b/i.test(parte) && itens.length > 0) itens[itens.length - 1] += ` ${parte}`
    else itens.push(parte)
  }
  return itens.map((texto) => ({ regiao: nomeCurtoDoItem({ regiao: '', texto }), texto }))
}

/**
 * O preset de DANO de um item — vale pros carregados e pros guardados, que é por que saiu do
 * `extract` pra cá: uma arma guardada na mochila continua sendo a arma da pessoa, e o botão dela
 * custa um clique pra desmarcar na conferência se ninguém quiser.
 */
function presetsDeItens(itens: ItemCarregado[], nomear: (item: ItemCarregado) => string): SheetImportPreset[] {
  return itens
    .map((item): SheetImportPreset | null => {
      const dano = DANO_DO_ITEM.exec(item.texto)
      if (!dano) return null
      // A notação vem do papel ("1D4 PE."), então quem monta a expressão é o mesmo analisador que
      // o resto do app usa — nada de montar `{ groups: [...] }` na mão aqui.
      const lido = parseDiceExpression(dano[1])
      if (!lido) return null
      return {
        name: `${nomear(item)} (dano)`,
        kind: 'damage',
        expression: lido.expression,
        source: item.texto.slice(0, 120)
      }
    })
    .filter((preset): preset is SheetImportPreset => preset !== null)
}

/**
 * As áreas de "Espaço Livre" — regra do usuário: "qualquer anotação de player no pdf precisamos
 * trazer", mesmo a que parece inútil.
 *
 * A ficha tem DUAS: uma entre as Habilidades e o Inventário, outra entre o inventário e as Mazelas
 * (esta com a instrução "Use esse espaço para fazer anotações" impressa). No modelo em branco as
 * duas estão vazias — conferido nos dois PDFs: tudo que aparecer ali é digitado pelo jogador, e
 * este leitor jogava fora. Na ficha real preenchida o jogador digitou as habilidades GERAIS dele na
 * primeira área, e nada chegava.
 *
 * O texto vai pro `rawText`: a conferência mostra como "texto sem rótulo" (com a caixa de trazer ou
 * não) e a montagem manda pro bloco de história — é anotação livre, não tem rótulo pra virar campo.
 * Vazio continua vazio: área sem nada digitado não rende aviso nem linha.
 */
function espacoLivre(sheet: PdfSheet): string {
  const blocos: string[] = []
  sheet.texts.forEach((fragmento, indice) => {
    if (fragmento.text.trim() !== 'Espaço Livre') return
    const linhas: string[] = []
    let ultimo: PdfText | null = null
    for (let i = indice + 1; i < sheet.texts.length; i++) {
      const atual = sheet.texts[i]
      const texto = atual.text.trim()
      // Os títulos que fecham cada área — ver o mapa da ficha no comentário acima.
      if (/^(Inventário|Mazelas)$/.test(texto)) break
      if (!texto || /Use esse espaço para fazer anotações/i.test(texto)) continue
      /**
       * Fragmentos da MESMA LINHA viram uma linha só. O Google Docs exporta o texto justificado
       * palavra por palavra ("Náusea", "ou", "Sem", "Fôlego."), e na ficha real o Espaço Livre
       * chegava assim, uma palavra por linha — ilegível no bloco de história. Mesma página e mesmo
       * `y` (a folga de 2 é a de `MESMA_LINHA` em `camposDoTexto`) é a mesma linha do papel.
       */
      if (ultimo && ultimo.page === atual.page && Math.abs(ultimo.y - atual.y) <= 2) {
        linhas[linhas.length - 1] = `${linhas[linhas.length - 1]} ${texto}`.replace(/\s+([.,;:])/g, '$1')
      } else {
        linhas.push(texto)
      }
      ultimo = atual
    }
    if (linhas.length > 0) blocos.push(linhas.join('\n'))
  })
  return blocos.join('\n\n')
}

export const oblivioReader: SheetReader = {
  id: 'oblivio',
  label: 'Oblivio',

  detect: (sheet: PdfSheet) => {
    // Ficha COM formulário não é esta: a de Oblivio não tem nenhum, e um PDF que tenha é outra coisa.
    if (sheet.fields.length > 0) return 0
    const rotulos = new Set(
      sheet.texts
        .map((item) => item.text.trim())
        .filter((texto) => texto.endsWith(':'))
        .map((texto) => texto.slice(0, -1).trim())
    )
    const achados = IMPRESSAO_DIGITAL.filter((nome) => rotulos.has(nome)).length
    if (achados >= 8) return 0.9
    if (achados >= 5) return 0.5
    return 0
  },

  extract: (sheet) => {
    const base = extrairGenerico(sheet, 'oblivio', 'Oblivio', 0.9)

    /**
     * Agrupar é quase tudo que este leitor acrescenta, e não é enfeite: sem grupo, a conferência
     * mostra vinte e sete linhas na mesma lista, e os dez atributos ficam misturados com as partes
     * do corpo e com as habilidades. Com grupo, a pessoa reconhece a própria ficha.
     */
    const fields = base.fields.map((campo) => {
      if (IDENTIFICACAO.includes(campo.label)) return { ...campo, group: 'Identificação' }
      if (APARENCIA.includes(campo.label)) return { ...campo, group: 'Aparência' }
      if (ATRIBUTOS.includes(campo.label)) return { ...campo, group: 'Atributos' }
      if (ASPECTOS.includes(campo.label)) return { ...campo, group: 'Aspectos' }
      if (CORPO.includes(campo.label)) return { ...campo, group: 'Corpo' }
      if (campo.value.length > TAMANHO_DE_HABILIDADE) return { ...campo, group: 'Habilidades' }
      return campo
    })

    /**
     * O equipamento CARREGADO entra como grupo "Equipamento" e o GUARDADO como "Inventário" —
     * `blockForGroup` manda os dois pro bloco de inventário da ficha (é texto de item, não número
     * em caixa, e é lá que se lê), mas na conferência cada um aparece no seu grupo: o que está no
     * corpo e o que está na mochila são coisas diferentes.
     */
    const carregados = equipamentoCarregado(sheet)
    const guardados = equipamentoGuardado(sheet)
    const camposDeEquipamento = [
      ...carregados.map((item) => ({ label: item.regiao, value: item.texto, group: 'Equipamento' })),
      ...guardados.map((item) => ({ label: item.regiao, value: item.texto, group: 'Inventário' }))
    ]

    /**
     * E vira PRESET quando o item diz o próprio dano. Aqui isso é seguro, ao contrário do texto
     * solto da ficha (ver `presetsDoTexto` no genérico): dentro do inventário um "Dano: 1D4" é a
     * arma da pessoa, não uma regra impressa na página. O carregado é nomeado pelo texto do item
     * (o rótulo dele é a região do corpo); o guardado já tem o nome curto no rótulo.
     */
    const presetsDeArma = [
      ...presetsDeItens(carregados, nomeCurtoDoItem),
      ...presetsDeItens(guardados, (item) => item.regiao)
    ]

    return {
      ...base,
      system: 'Oblivio',
      fields: [...fields, ...camposDeEquipamento],
      // O golpe com Teste/Dano no texto vira preset em TODA ficha agora — ver `presetsDeProsa` no `readSheet`.
      presets: [...(base.presets ?? []), ...presetsDeArma],
      rawText: espacoLivre(sheet) || base.rawText
    }
  }
}
