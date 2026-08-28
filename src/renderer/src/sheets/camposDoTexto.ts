import type { PdfSheet, PdfText, SheetImportField } from '@shared/types/sheetImport'

/**
 * Campos de uma ficha SEM FORMULÁRIO, tirados do texto impresso.
 *
 * É o que faz uma ficha exportada do Google Docs (a de Oblivio é uma) render algo além de palpites
 * de rolagem. Sem isto, esse tipo de PDF importava zero campos — o app dizia "não tem formulário" e
 * parava aí, o que é honesto mas inútil.
 *
 * As duas formas foram tiradas de comparar a ficha de Oblivio EM BRANCO com a PREENCHIDA do mesmo
 * documento: o que existe só na segunda é, por definição, o que o jogador escreveu. Elas são:
 *
 * 1. RÓTULO E VALOR NO MESMO FRAGMENTO — "Nome: Rodrigo Barreto", "Papel: Quem Age". Acontece
 *    quando se digita dentro do documento, que é como se preenche uma ficha assim;
 * 2. VALOR NA MESMA LINHA, À DIREITA DO RÓTULO — "Carne:" e, alguns pontos adiante, "2/10".
 *    Acontece nos campos diagramados em tabela.
 *
 * A regra de vizinhança da forma 2 é MESMA LINHA, e isso importa: o texto mais próximo de "2/10" em
 * distância pura é "Representa a", que é o começo da explicação na linha DE CIMA. O rótulo certo
 * ("Carne:") está a 45 pontos à direita mas com a mesma altura. Medido nos dois arquivos antes de
 * virar código.
 */

/** Rótulo e valor juntos: "Nome: Rodrigo Barreto". O rótulo é curto; o valor, não pode ser um parágrafo. */
const ROTULO_E_VALOR = /^([^:]{2,28}):\s*(\S.{0,119})$/

/**
 * Valor que, na verdade, é pedaço de FRASE.
 *
 * A ficha de Oblivio traz as regras impressas junto, e elas são escritas do mesmo jeito que um campo
 * preenchido: "Limite de Estresse: 6. / Dano: 1D4 PE. / Alcance: 1." Rótulo curto, dois-pontos,
 * número logo em seguida — indistinguível de "Carne: 2/10" por posição, tamanho ou presença de
 * dígito. Foi assim que "Limite de Estresse = 6. /" e "Dano = 1D4 PE. /" apareceram na importação
 * do arquivo real, no meio dos atributos de verdade.
 *
 * O que separa os dois é a PONTUAÇÃO DE FRASE: valor de ficha não termina em ponto e não tem ponto
 * seguido de espaço. "2/10", "0/5" e "1.5" passam; "+1.", "1." e "1D4 PE. /" não.
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
 * A mesma leitura, dizendo também QUAIS fragmentos ela consumiu. É o que o genérico precisa pra
 * guardar o resto como texto da ficha (regra do usuário: "qualquer anotação de player no pdf
 * precisamos trazer") — sem isto, numa ficha de texto sem formulário tudo que não era "Rótulo:
 * valor" era jogado fora, e o Espaço Livre de Oblívio mostrou que ali mora anotação de jogador.
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
   * Forma 2: valor solto à direita de um rótulo terminado em ":".
   *
   * Só valores CURTOS e com dígito. Sem essas duas condições, qualquer palavra solta de uma frase
   * quebrada em vários fragmentos (e o extrator quebra muito) vira "valor" do rótulo mais próximo —
   * a ficha de Oblivio tem parágrafos inteiros picados em pedaços de uma palavra.
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
 * Entrelinha máxima de um mesmo parágrafo, em múltiplos da altura da fonte.
 *
 * Medido na ficha de Oblivio, que separa bem os dois casos: as linhas de dentro de um parágrafo
 * ficam a 1,4 alturas umas das outras, e dois itens DIFERENTES da lista ficam a 2,25. 1,8 passa no
 * meio.
 */
const ENTRELINHA = 1.8

/**
 * Quanto a linha seguinte pode começar mais à ESQUERDA e ainda ser o mesmo parágrafo.
 *
 * Existe por causa da indentação pendente, que a ficha de Oblivio usa: "Estocada: Você realiza a
 * Ação de Cena…" começa em x=152, e as três linhas que completam a frase começam em x=72, 80 pontos
 * à esquerda. Exigir a mesma margem cortava a habilidade no meio — era exatamente o "(se
 * movimentando" truncado que aparecia na importação.
 *
 * Pra direita quase não há folga (12 pontos), porque parágrafo novo é que costuma ser indentado.
 */
const RECUO_MAXIMO = 120
const AVANCO_MAXIMO = 12

/**
 * As linhas que COMPLETAM o valor de um campo — a continuação do parágrafo.
 *
 * O extrator devolve uma linha por fragmento, então "Descrição: 1,87m, cabelos loiros descoloridos,
 * curto dos lados e" era tudo o que entrava na ficha: o resto da descrição, mais quatro linhas, ia
 * pro lixo. Metade de uma frase é pior que nada, porque parece completa.
 *
 * A parada é por três motivos, e cada um evita um jeito diferente de engolir a ficha inteira: buraco
 * vertical (acabou o parágrafo), margem muito diferente (é outra coluna ou outro bloco) e a linha
 * ser ela mesma um "Rótulo: valor" (é o campo seguinte, não a continuação deste).
 */
function linhasSeguintes(emOrdem: PdfText[], inicio: number): PdfText[] {
  const linhas: PdfText[] = []
  let anterior = emOrdem[inicio]

  for (let i = inicio + 1; i < emOrdem.length; i++) {
    const proximo = emOrdem[i]
    if (proximo.page !== anterior.page) break
    /**
     * Sem altura de fonte declarada não há régua de entrelinha, e a resposta certa é não juntar —
     * um piso inventado colaria linhas que não têm nada a ver umas com as outras. Ver o mesmo
     * raciocínio em `alturaUtil`, em `anotacoesSobreImagem.ts`.
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
 * O que pode ser rótulo. Precisa ter letra (número solto não rotula nada) e não pode ser um pedaço
 * de frase — a ficha de Oblivio traz as REGRAS impressas, e regra tem dois-pontos o tempo todo
 * ("Voracidade: Primeira vez na cena dobre sua Dor"). O corte por palavras é o que separa um rótulo
 * de campo do começo de um parágrafo.
 */
export function ehRotuloPlausivel(texto: string): boolean {
  const limpo = texto.trim()
  if (limpo.length < 2 || limpo.length > 28) return false
  /**
   * Tem que COMEÇAR com letra, e não só conter uma.
   *
   * A ficha de Oblivio escreve a conta ao lado do campo — "Limite de Estresse (5 + Carne): 0/7" —, e
   * o fragmento "(5 + Carne)" virava rótulo, produzindo a linha "(5 + Carne) = 0/7". Fórmula não é
   * nome de campo, e nome de campo de ficha nenhuma começa por parêntese ou sinal.
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
