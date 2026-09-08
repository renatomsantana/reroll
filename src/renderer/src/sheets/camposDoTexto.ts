import type { PdfSheet, PdfText, SheetImportField } from '@shared/types/sheetImport'

/**
 * Campos de uma ficha SEM FORMULÁRIO, tirados do texto impresso — sem isto, um PDF exportado do
 * Google Docs (a ficha de Oblivio é um) importava zero campos. As duas formas saíram de comparar a
 * ficha EM BRANCO com a PREENCHIDA do mesmo documento:
 *
 * 1. rótulo e valor NO MESMO FRAGMENTO ("Nome: Rodrigo Barreto"), de quem digita dentro do documento;
 * 2. valor na MESMA LINHA, à direita do rótulo ("Carne:" e, adiante, "2/10"), de campo em tabela.
 *
 * A vizinhança da forma 2 é MESMA LINHA e não distância pura: o texto mais próximo de "2/10" é
 * "Representa a", começo da explicação na linha DE CIMA, enquanto o rótulo certo está 45 pontos à
 * direita e na mesma altura.
 */

/** Rótulo e valor juntos: "Nome: Rodrigo Barreto". O rótulo é curto; o valor, não pode ser um parágrafo. */
const ROTULO_E_VALOR = /^([^:]{2,28}):\s*(\S.{0,119})$/

/**
 * Valor que, na verdade, é pedaço de FRASE. A ficha de Oblivio traz as regras impressas junto, e elas
 * são escritas como campo preenchido: "Limite de Estresse: 6. / Dano: 1D4 PE." O que separa os dois é
 * a PONTUAÇÃO DE FRASE — "2/10", "0/5" e "1.5" passam; "+1.", "1." e "1D4 PE. /" não.
 */
const PEDACO_DE_FRASE = /\.\s*$|\.\s/

/** Distância horizontal máxima entre um rótulo e o valor dele, na mesma linha. */
const ALCANCE_NA_LINHA = 95
/** Tolerância de altura pra considerar "mesma linha" — a mesma linha de base varia uns décimos. */
const MESMA_LINHA = 4

export function camposDoTexto(sheet: PdfSheet): SheetImportField[] {
  return lerCamposDoTexto(sheet).campos
}

/**
 * A mesma leitura, dizendo também QUAIS fragmentos ela consumiu: é o que o genérico precisa pra
 * guardar o resto como texto da ficha ("qualquer anotação de player no pdf precisamos trazer"). Sem
 * isto, tudo que não era "Rótulo: valor" ia pro lixo, e o Espaço Livre de Oblívio é anotação.
 */
export function lerCamposDoTexto(sheet: PdfSheet): { campos: SheetImportField[]; usados: Set<PdfText> } {
  const campos: SheetImportField[] = []
  const usados = new Set<PdfText>()

  // Forma 1 primeiro: quando rótulo e valor estão no mesmo fragmento, não há o que procurar em volta.
  const emOrdem = [...sheet.texts].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
  for (let i = 0; i < emOrdem.length; i++) {
    const item = emOrdem[i]
    const match = ROTULO_E_VALOR.exec(item.text.trim())
    if (!match) continue
    const label = match[1].trim()
    const value = match[2].trim()
    if (!ehRotuloPlausivel(label) || !value) continue

    const continuacao = linhasSeguintes(emOrdem, i)
    for (const linha of continuacao) usados.add(linha)
    campos.push({ label, value: [value, ...continuacao.map((l) => l.text.trim())].join(' ') })
    usados.add(item)
  }

  /**
   * Forma 2: valor solto à direita de um rótulo terminado em ":". Só valores CURTOS e com dígito —
   * sem as duas condições, qualquer palavra de uma frase picada pelo extrator vira "valor" do rótulo
   * mais próximo, e a ficha de Oblivio tem parágrafos inteiros em pedaços de uma palavra.
   */
  const rotulos = sheet.texts.filter((item) => item.text.trim().endsWith(':') && ehRotuloPlausivel(item.text.trim().slice(0, -1)))
  for (const item of sheet.texts) {
    if (usados.has(item)) continue
    const valor = item.text.trim()
    if (valor.length > 20 || !/\d/.test(valor) || valor.includes(':')) continue
    if (PEDACO_DE_FRASE.test(valor)) continue

    let melhor: { distancia: number; label: string } | null = null
    for (const rotulo of rotulos) {
      if (rotulo.page !== item.page) continue
      const dy = Math.abs(item.y - rotulo.y)
      if (dy > MESMA_LINHA) continue
      const dx = item.x - (rotulo.x + rotulo.width)
      if (dx < -2 || dx > ALCANCE_NA_LINHA) continue
      if (!melhor || dx < melhor.distancia) melhor = { distancia: dx, label: rotulo.text.trim().slice(0, -1) }
    }
    if (melhor) {
      campos.push({ label: melhor.label, value: valor })
      usados.add(item)
    }
  }

  return { campos: semRepetidos(campos), usados }
}

/**
 * Entrelinha máxima de um mesmo parágrafo, em múltiplos da altura da fonte. Medido na ficha de
 * Oblivio: dentro de um parágrafo as linhas ficam a 1,4 umas das outras, e dois itens diferentes da
 * lista ficam a 2,25.
 */
const ENTRELINHA = 1.8

/**
 * Quanto a linha seguinte pode começar mais à ESQUERDA e ainda ser o mesmo parágrafo. É a indentação
 * pendente da ficha de Oblivio: "Estocada: Você realiza a Ação de Cena…" começa em x=152 e as três
 * linhas que completam a frase começam em x=72. Exigir a mesma margem truncava a habilidade no meio.
 * Pra direita quase não há folga, porque parágrafo NOVO é que costuma ser indentado.
 */
const RECUO_MAXIMO = 120
const AVANCO_MAXIMO = 12

/**
 * As linhas que COMPLETAM o valor de um campo. O extrator devolve uma linha por fragmento, então
 * "Descrição: 1,87m, cabelos loiros descoloridos, curto dos lados e" era tudo o que entrava, com o
 * resto no lixo — e metade de uma frase é pior que nada, porque parece completa.
 *
 * Para por três motivos, cada um evitando um jeito de engolir a ficha inteira: buraco vertical
 * (acabou o parágrafo), margem muito diferente (é outra coluna) e a linha ser o campo seguinte.
 */
function linhasSeguintes(emOrdem: PdfText[], inicio: number): PdfText[] {
  const linhas: PdfText[] = []
  let anterior = emOrdem[inicio]

  for (let i = inicio + 1; i < emOrdem.length; i++) {
    const proximo = emOrdem[i]
    if (proximo.page !== anterior.page) break
    /**
     * Sem altura de fonte declarada não há régua de entrelinha, e a resposta é não juntar: um piso
     * inventado colaria linhas sem nada a ver. Mesmo raciocínio de `alturaUtil`.
     */
    if (anterior.height <= 0) break
    const queda = anterior.y - proximo.y
    if (queda <= 0 || queda > anterior.height * ENTRELINHA) break
    if (proximo.x > anterior.x + AVANCO_MAXIMO || proximo.x < anterior.x - RECUO_MAXIMO) break

    const texto = proximo.text.trim()
    if (!texto) break
    const outroCampo = ROTULO_E_VALOR.exec(texto)
    if (outroCampo && ehRotuloPlausivel(outroCampo[1].trim())) break

    linhas.push(proximo)
    anterior = proximo
  }

  return linhas
}

/**
 * O que pode ser rótulo: tem letra (número solto não rotula nada) e não é pedaço de frase. A ficha de
 * Oblivio traz as REGRAS impressas, e regra tem dois-pontos o tempo todo ("Voracidade: Primeira vez
 * na cena dobre sua Dor") — o corte por palavras é o que separa rótulo de começo de parágrafo.
 */
export function ehRotuloPlausivel(texto: string): boolean {
  const limpo = texto.trim()
  if (limpo.length < 2 || limpo.length > 28) return false
  /**
   * Tem que COMEÇAR com letra, e não só conter uma: a ficha de Oblivio escreve a conta ao lado do
   * campo ("Limite de Estresse (5 + Carne): 0/7"), e o fragmento "(5 + Carne)" virava rótulo.
   */
  if (!/^[\p{L}]/u.test(limpo)) return false
  if (limpo.split(/\s+/).length > 4) return false
  return true
}

function semRepetidos(campos: SheetImportField[]): SheetImportField[] {
  const vistos = new Set<string>()
  return campos.filter((campo) => {
    const chave = `${campo.label}|${campo.value}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}
