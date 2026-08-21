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
  const [x0, y0, x1, y1] = field.rect
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2

  let melhor: { distancia: number; texto: string } | null = null
  for (const texto of sheet.texts) {
    if (texto.page !== field.page) continue
    if (!ehRotulo(texto)) continue

    const dx = cx - (texto.x + texto.width / 2)
    const dy = cy - (texto.y + texto.height / 2)
    // À esquerda (dx > 0) ou acima (dy < 0), com uma folga de 5pt pra tolerar rótulo levemente
    // desalinhado — ficha diagramada à mão nunca alinha no ponto.
    if (dx <= -5 && dy >= 5) continue

    const distancia = Math.hypot(dx, dy)
    if (distancia > MAX_DISTANCE) continue
    if (!melhor || distancia < melhor.distancia) melhor = { distancia, texto: texto.text }
  }

  return melhor ? melhor.texto : null
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
  return limpo
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
    const [x0, y0, x1, y1] = field.rect
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2

    sheet.texts.forEach((texto, iTexto) => {
      if (texto.page !== field.page) return
      if (!ehRotulo(texto)) return
      const dx = cx - (texto.x + texto.width / 2)
      const dy = cy - (texto.y + texto.height / 2)
      if (dx <= -5 && dy >= 5) return
      const distancia = Math.hypot(dx, dy)
      if (distancia > MAX_DISTANCE) return
      pares.push({ campo: iCampo, texto: iTexto, distancia })
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
