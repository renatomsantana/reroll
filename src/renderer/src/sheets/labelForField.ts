import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'

/**
 * O RÓTULO IMPRESSO mais próximo de um campo de formulário.
 *
 * Esta é a peça que faz o importador servir pra ficha que eu nunca vi — o pedido do usuário de que
 * "outros usuários irão colocar suas próprias fichas". O motivo é que o NOME do campo, que seria o
 * caminho óbvio, quase nunca presta: a ficha de Ordem Paranormal tem 458 campos e boa parte deles se
 * chama `19`, `1_2`, `undefined` ou `Categoria 7`, porque quem monta a ficha no Acrobat/InDesign
 * deixa o nome automático. Já o rótulo IMPRESSO ao lado é feito pra humano ler, e é justamente o
 * que dá sentido ao valor.
 *
 * Foi conferido nas duas fichas de referência antes de virar código: no PDF de Ordem Paranormal,
 * `Personagem`→"PERSONAGEM", `AGI`→"AGILIDADE", `Atq1.0.0.0.1`→"TESTE", `Atq1.0.0.0.2`→"DANO".
 *
 * A regra de vizinhança é "à ESQUERDA ou ACIMA", que é onde rótulo de formulário mora em qualquer
 * ficha impressa — em cima da caixa ou na frente dela. Sem essa restrição, o texto mais próximo de
 * um campo é com frequência o rótulo do campo SEGUINTE.
 */

/**
 * Nada mais longe que isto vira rótulo, em pontos de PDF.
 *
 * O número saiu de MEDIR a ficha de Ordem Paranormal antes de escrever isto: os rótulos corretos
 * caem entre 11 ("Equip." pro campo de defesa de equipamento) e 53 ("Critico/Alcance/Especial" pra
 * quarta coluna de ataque). O rodapé de direitos autorais, que é texto e não rótulo, aparecia a 56
 * e 70 de dois campos de ataque — ele já sai pelo filtro de comprimento (`ehRotulo`), mas o teto
 * daqui é a segunda defesa. 70 dá folga sobre os 53 medidos sem abraçar meia página.
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
 * A distância de um texto impresso a um campo pelas regras de vizinhança — ou `null` quando o
 * texto não pode rotular o campo: outra página, não é rótulo, está à direita E abaixo, ou longe
 * demais. É a ÚNICA régua: `labelForField` e `rotulosExclusivos` mediam cada um do seu jeito, em
 * cópia, e a correção da caixa alta (abaixo) teria que ser feita duas vezes — e foi feita numa só,
 * na primeira tentativa, e o leitor genérico continuou sem ver o rótulo.
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
   * A distância até a BORDA da caixa, e não até o centro dela.
   *
   * Pra um campo de uma linha dá no mesmo. Pra um campo ALTO — a caixa de história do personagem,
   * 140pt de altura — não: o rótulo impresso fica no canto de cima, a 4pt da borda e a 80pt do
   * centro, e o teto de 70 o deixava de fora por causa da altura da própria caixa. Medido na
   * quinta leva de PDFs de teste ("HISTÓRIA" sobre uma caixa de 560 a 700): o campo saía com o
   * nome cru "Historia" tendo o rótulo impresso colado nele.
   */
  const px = Math.min(Math.max(lx, x0), x1)
  const py = Math.min(Math.max(ly, y0), y1)
  const distancia = Math.hypot(lx - px, ly - py)
  return distancia > MAX_DISTANCE ? null : distancia
}

/**
 * O que NÃO pode virar rótulo.
 *
 * O rodapé de direitos autorais da ficha de Ordem Paranormal ("É permitido reproduzir esta página
 * para uso pessoal...") foi eleito rótulo de dois campos de ataque na primeira sondagem, só por
 * estar fisicamente perto deles. Texto longo não é rótulo de campo em ficha nenhuma; rótulo é curto
 * por definição, porque tem que caber ao lado da caixa.
 */
function ehRotulo(texto: PdfText): boolean {
  const limpo = texto.text.trim()
  if (!limpo) return false
  if (limpo.length > 28) return false
  /**
   * UMA letra solta também não é rótulo. HONESTIDADE SOBRE ESTA GUARDA: o caso que a motivou (o
   * título "espaçado" desenhado letra a letra, oitava leva) não a exercita — medido com o dump, o
   * pdf.js remonta os comandos da mesma linha num fragmento só ("F O R Ç A"), que rotula direito.
   * Ela fica pelo caso que o extrator NÃO remonta (letra em linha própria, texto vertical): ali a
   * letra mais próxima viraria o rótulo do campo, com cara de dado lido. O menor rótulo de verdade
   * nas fichas reais tem duas letras ("CA", "PV"); o custo é uma comparação.
   */
  if (limpo.length < 2) return false
  // Linha só de pontuação/traços (as guias pontilhadas das fichas) não diz nada.
  if (!/[\p{L}]/u.test(limpo)) return false
  return true
}

/**
 * Rótulo apresentável a partir do NOME do campo, pra quando não houver texto impresso por perto.
 *
 * Devolve `null` pro nome que não significa nada — `19`, `1_2`, `undefined` —, porque um campo
 * rotulado "1_2" na tela de conferência é pior que campo nenhum: ocupa linha, não informa, e faz o
 * usuário desconfiar do resto da leitura.
 */
export function labelFromFieldName(name: string): string | null {
  const limpo = name.trim()
  if (!limpo) return null
  if (limpo === 'undefined') return null
  // Só dígitos, ou dígitos com sufixo de repetição do exportador (`1_2`, `17_3`).
  if (/^\d+(_\d+)?$/.test(limpo)) return null
  /**
   * Nomes de grade do exportador (`Atq1.0.0.2.1`, `Pericias.4.3`, `Bns1.14`): a posição na grade não
   * é rótulo. O `\d*` depois das letras não é detalhe — sem ele, `Bns1.14` escapava do filtro (o
   * dígito colado em `Bns` quebrava o casamento) e a ficha de Ordem Paranormal importava as 28
   * células da grade de bônus de perícia como se fossem campos, todas valendo "0" e rotuladas
   * "Bns1.2", "Bns1.3"… Isso só apareceu ao dar exclusividade aos rótulos impressos
   * (`rotulosExclusivos`): antes essas células roubavam um rótulo impresso do vizinho e sumiam na
   * deduplicação, ou seja, o lixo estava escondido atrás de outro defeito.
   */
  if (/^[A-Za-zÀ-ú]+\d*(\.\d+)+$/.test(limpo)) return null
  /**
   * Nomes AUTOMÁTICOS de exportador de formulário: o TIPO do controle mais um sufixo aleatório.
   *
   * A ficha oficial de Pathfinder 2e (Paizo) nomeia os 517 campos assim — `text_15gujr`,
   * `checkbox_5xofc` — e um campo preenchido SEM rótulo impresso por perto entrava na conferência
   * rotulado "text_4r5t" (sexta leva de PDFs de teste). Isso não informa nada e ainda tira a
   * confiança do resto da leitura. O separador é obrigatório no padrão de propósito: "Texto" e
   * "Datas" são nomes legítimos que alguém dá a um campo; `text_...` é máquina falando.
   */
  if (/^(text|textarea|checkbox|check|radio|radiobutton|combo|combobox|dropdown|list|listbox|button|signature|date|image|untitled)[_-][a-z0-9]+$/i.test(limpo)) {
    return null
  }
  /**
   * Underscore vira espaço: `Propositos_Pessoais` é como o AUTOR da ficha nomeia campo (visto na
   * ficha real de Assimilação), e o underscore é sintaxe de editor, não escrita de gente. Só a
   * troca — sem inventar caixa nem acento, que são do autor.
   */
  return limpo.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Os rótulos impressos distribuídos entre os campos SEM REPETIR: cada texto rotula um campo só.
 *
 * `labelForField` responde "qual o texto mais próximo deste campo?", uma pergunta por campo e sem
 * memória do que já foi usado. Numa ficha bem diagramada isso basta, porque cada caixa tem o rótulo
 * dela ao lado. Numa ficha QUALQUER, não: campo sem rótulo próprio rouba o do vizinho, e o resultado
 * é pior que não ler nada, porque um valor errado vem com cara de valor certo.
 *
 * MEDIDO numa ficha de formulário sem leitor dedicado (`sistemaDesconhecido.node.test.ts`): "NOME DO
 * PERSONAGEM" saía como rótulo de três campos diferentes — o nome, o nome do JOGADOR e o primeiro
 * atributo; o título da segunda coluna rotulava a defesa, o PV máximo e o bônus de ataque de uma
 * arma; e as duas armas viravam dois presets com o mesmo nome, "ARMAS E CONJURAÇÕES",
 * indistinguíveis na lista.
 *
 * A distribuição é gulosa pelo par mais próximo: monta todos os pares (campo, texto) que passam nas
 * regras de `labelForField`, ordena por distância e vai fechando — o texto fica com o campo mais
 * perto dele, e quem perder cai no próprio NOME do campo (`labelFromFieldName`), que é feio mas é
 * verdade. Guloso, e não uma atribuição ótima de verdade, porque o par mais próximo é quase sempre o
 * certo e o custo de errar aqui é um rótulo feio, não um valor trocado.
 *
 * `labelForField` continua existindo e continua sem exclusividade de propósito: o leitor de Ordem
 * Paranormal a usa pra DESEMPATAR campos de mesmo nome ("qual destes três `Atq1` tem 'DANO' ao
 * lado?"), que é outra pergunta.
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
