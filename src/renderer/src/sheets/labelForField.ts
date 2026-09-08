import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'

/**
 * O RÓTULO IMPRESSO mais próximo de um campo de formulário — a peça que faz o importador servir pra
 * ficha que ninguém previu. O NOME do campo quase nunca presta: a ficha de Ordem Paranormal tem 458
 * campos e boa parte se chama `19`, `1_2` ou `undefined`, porque o Acrobat deixa o nome automático.
 *
 * A regra de vizinhança é "à ESQUERDA ou ACIMA", que é onde rótulo de formulário mora; sem ela, o
 * texto mais próximo de um campo é com frequência o rótulo do campo SEGUINTE. Conferido nas duas
 * fichas de referência: `Personagem`→"PERSONAGEM", `AGI`→"AGILIDADE", `Atq1.0.0.0.2`→"DANO".
 */

/**
 * Nada mais longe que isto vira rótulo, em pontos de PDF. MEDIDO na ficha de Ordem Paranormal: os
 * rótulos corretos caem entre 11 e 53, e o rodapé de direitos autorais aparecia a 56 e 70 de dois
 * campos de ataque. É a segunda defesa — o rodapé já sai pelo filtro de comprimento (`ehRotulo`).
 */
const MAX_DISTANCE = 70

export function labelForField(sheet: PdfSheet, field: PdfField): string | null {
  let melhor: { distancia: number; texto: string } | null = null
  for (const texto of sheet.texts) {
    const distancia = distanciaDoRotulo(field, texto)
    if (distancia === null) continue
    if (!melhor || distancia < melhor.distancia) melhor = { distancia, texto: texto.text }
  }
  return melhor ? melhor.texto : null
}

/**
 * A distância de um texto impresso a um campo pelas regras de vizinhança, ou `null` quando o texto
 * não pode rotular o campo. É a ÚNICA régua: `labelForField` e `rotulosExclusivos` mediam cada um do
 * seu jeito, em cópia, e uma correção feita numa só deixou o leitor genérico sem ver o rótulo.
 */
export function distanciaDoRotulo(field: PdfField, texto: PdfText): number | null {
  if (texto.page !== field.page) return null
  if (!ehRotulo(texto)) return null

  const [x0, y0, x1, y1] = field.rect
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const lx = texto.x + texto.width / 2
  const ly = texto.y + texto.height / 2
  const dx = cx - lx
  const dy = cy - ly
  // À esquerda (dx > 0) ou acima (dy < 0), com uma folga de 5pt pra tolerar rótulo levemente
  // desalinhado — ficha diagramada à mão nunca alinha no ponto.
  if (dx <= -5 && dy >= 5) return null

  /**
   * A distância até a BORDA da caixa, e não até o centro. Pra um campo de uma linha dá no mesmo; pra
   * um campo ALTO — a caixa de história, 140pt — o rótulo fica no canto de cima, a 4pt da borda e a
   * 80pt do centro, e o teto de 70 o deixava de fora por causa da altura da própria caixa.
   */
  const px = Math.min(Math.max(lx, x0), x1)
  const py = Math.min(Math.max(ly, y0), y1)
  let distancia = Math.hypot(lx - px, ly - py)
  /**
   * Rótulo na MESMA LINHA, à esquerda, vale METADE da distância: é a diagramação canônica de
   * formulário ("NOME ____"), e na proximidade pura ela perdia pro TÍTULO da página. Medido:
   * "FICHA DE INSCRIÇÃO" ficava a 34pt do primeiro campo e roubava o rótulo dele, o "NOME" órfão
   * descia pro campo de baixo, e o CPF saía proposto como nome de personagem.
   */
  const mesmaLinha = ly >= y0 - 2 && ly <= y1 + 2 && lx < x0
  if (mesmaLinha) distancia = (x0 - lx) / 2
  return distancia > MAX_DISTANCE ? null : distancia
}

/**
 * O que NÃO pode virar rótulo. Rótulo é curto por definição, porque tem que caber ao lado da caixa: o
 * rodapé de direitos autorais de Ordem Paranormal foi eleito rótulo de dois campos de ataque na
 * primeira sondagem, só por estar perto deles.
 */
function ehRotulo(texto: PdfText): boolean {
  const limpo = texto.text.trim()
  if (!limpo) return false
  if (limpo.length > 28) return false
  /**
   * O TÍTULO da página nunca rotula campo: "FICHA DE INSCRIÇÃO" pairando 34pt acima do primeiro campo
   * vencia o "NOME" impresso na mesma linha, e o rótulo órfão descia em cascata. Os rótulos legítimos
   * ("PERSONAGEM", "CHARACTER NAME") não contêm "ficha" nem "sheet".
   */
  if (/\b(ficha|sheet)\b/i.test(limpo)) return false
  /**
   * UMA letra solta também não é rótulo. O caso que a motivou (título espaçado, letra a letra) não a
   * exercita — o pdf.js remonta os comandos da mesma linha num fragmento só ("F O R Ç A"). Ela fica
   * pelo caso que o extrator NÃO remonta (letra em linha própria, texto vertical). O menor rótulo
   * real nas fichas tem duas letras ("CA", "PV").
   */
  if (limpo.length < 2) return false
  // Linha só de pontuação/traços (as guias pontilhadas das fichas) não diz nada.
  if (!/[\p{L}]/u.test(limpo)) return false
  return true
}

/**
 * O nome do campo com os escapes de nome de PDF DECODIFICADOS: `Pontos de Vida m#C3#A1ximos` é
 * "Pontos de Vida máximos". Medido na editável de Tormenta20 (a do Milo), onde "máximos" e "crítico"
 * chegavam assim e viravam rótulo ilegível. Escape torto passa cru: melhor o nome cru que perder o
 * campo.
 */
export function nomeDeCampoDecodificado(name: string): string {
  if (!/#[0-9A-Fa-f]{2}/.test(name)) return name
  try {
    return decodeURIComponent(name.replace(/%/g, '%25').replace(/#([0-9A-Fa-f]{2})/g, '%$1'))
  } catch {
    return name
  }
}

/**
 * Rótulo apresentável a partir do NOME do campo, pra quando não houver texto impresso por perto.
 * Devolve `null` pro nome que não significa nada (`19`, `1_2`, `undefined`): um campo rotulado "1_2"
 * na tela é pior que campo nenhum — ocupa linha, não informa, e faz desconfiar do resto da leitura.
 */
export function labelFromFieldName(name: string): string | null {
  const limpo = nomeDeCampoDecodificado(name).trim()
  if (!limpo) return null
  if (limpo === 'undefined') return null
  // Só dígitos, ou dígitos com sufixo de repetição do exportador (`1_2`, `17_3`).
  if (/^\d+(_\d+)?$/.test(limpo)) return null
  /**
   * Nomes de grade do exportador (`Atq1.0.0.2.1`, `Pericias.4.3`): posição na grade não é rótulo. O
   * `\d*` depois das letras não é detalhe — sem ele `Bns1.14` escapava e a ficha de Ordem importava as
   * 28 células da grade de bônus como campos, todas valendo "0". O lixo só apareceu ao dar
   * exclusividade aos rótulos: antes essas células roubavam o rótulo do vizinho e sumiam na dedupe.
   */
  if (/^[A-Za-zÀ-ú]+\d*(\.\d+)+$/.test(limpo)) return null
  /**
   * Nomes AUTOMÁTICOS de exportador: o TIPO do controle mais um sufixo aleatório. A ficha oficial de
   * Pathfinder 2e nomeia os 517 campos assim (`text_15gujr`, `checkbox_5xofc`), e um campo preenchido
   * sem rótulo por perto entrava rotulado "text_4r5t". O separador é obrigatório de propósito:
   * "Texto" e "Datas" são nomes que alguém dá a um campo, `text_...` é máquina falando.
   */
  if (/^(text|textarea|checkbox|check|radio|radiobutton|combo|combobox|dropdown|list|listbox|button|signature|date|image|untitled)[_-][a-z0-9]+$/i.test(limpo)) {
    return null
  }
  /**
   * Underscore vira espaço: `Propositos_Pessoais` é como o AUTOR da ficha nomeia campo (visto na de
   * Assimilação). Só a troca — sem inventar caixa nem acento, que são do autor.
   */
  return limpo.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Os rótulos impressos distribuídos entre os campos SEM REPETIR: cada texto rotula um campo só.
 *
 * `labelForField` responde "qual o texto mais próximo deste campo?", sem memória do que já foi usado.
 * Numa ficha bem diagramada basta; numa ficha QUALQUER, não — campo sem rótulo próprio rouba o do
 * vizinho, e valor errado vem com cara de certo. Medido: "NOME DO PERSONAGEM" saía como rótulo de
 * três campos, e as duas armas viravam dois presets de mesmo nome.
 *
 * A distribuição é GULOSA pelo par mais próximo — monta os pares válidos, ordena por distância e vai
 * fechando; quem perder cai no próprio nome do campo. Guloso, e não ótimo, porque o par mais próximo
 * é quase sempre o certo e o custo de errar é um rótulo feio, não um valor trocado.
 *
 * `labelForField` continua sem exclusividade: o leitor de Ordem a usa pra DESEMPATAR campos de mesmo
 * nome, que é outra pergunta.
 */
export function rotulosExclusivos(sheet: PdfSheet): Map<PdfField, string> {
  interface Par {
    campo: number
    texto: number
    distancia: number
  }
  const pares: Par[] = []

  sheet.fields.forEach((field, iCampo) => {
    sheet.texts.forEach((texto, iTexto) => {
      const distancia = distanciaDoRotulo(field, texto)
      if (distancia !== null) pares.push({ campo: iCampo, texto: iTexto, distancia })
    })
  })

  // Desempate pelos índices, e não só pela distância: dois campos exatamente à mesma distância do
  // mesmo texto existem (colunas simétricas), e sem isto qual deles ganha dependeria da ordenação
  // interna do motor — ou seja, a mesma ficha leria diferente em máquinas diferentes.
  pares.sort((a, b) => a.distancia - b.distancia || a.campo - b.campo || a.texto - b.texto)

  const rotulos = new Map<PdfField, string>()
  const camposUsados = new Set<number>()
  const textosUsados = new Set<number>()
  for (const par of pares) {
    if (camposUsados.has(par.campo) || textosUsados.has(par.texto)) continue
    camposUsados.add(par.campo)
    textosUsados.add(par.texto)
    rotulos.set(sheet.fields[par.campo], sheet.texts[par.texto].text)
  }
  return rotulos
}
