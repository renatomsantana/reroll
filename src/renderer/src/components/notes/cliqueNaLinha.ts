/**
 * CLICAR NUMA LINHA VAZIA DO CADERNO leva o cursor pra ela.
 *
 * Pedido dele (02/09/2026): "deixar possível que clique em qualquer linha no anotações para começar
 * a digitar, que não seja apenas no Enter"; e de novo em 04/09, pra ficha também: "clicar com o
 * mouse onde quiser digitar, não precisar apenas com Enter". O caderno desenha as linhas pautadas
 * até o fim da área (ver `.notes-textarea`), e as caixas da ficha têm altura mínima, mas o texto só
 * existe até onde foi digitado: clicar abaixo da última linha escrita põe o cursor no FIM do texto
 * (na última linha, onde o mouse apontou na horizontal), e pra escrever naquela pauta a pessoa
 * tinha que apertar Enter até chegar lá. Num caderno de papel se escreve onde se aponta a caneta.
 *
 * A conta é pura de propósito, pra ser testada sem tela: dado onde o clique caiu (em pixels a
 * partir do topo do texto, já somado o quanto o caderno rolou), a altura de cada pauta e quantas
 * linhas VISUAIS o texto ocupa, devolve quantas quebras de linha faltam pra chegar à pauta clicada.
 * Zero quer dizer "o clique caiu em cima de texto que existe": aí o navegador já pôs o cursor no
 * lugar certo e ninguém mexe.
 */
export function quebrasAteALinhaClicada(yDoClique: number, alturaDaLinha: number, linhasOcupadas: number): number {
  if (!(alturaDaLinha > 0) || yDoClique < 0) return 0
  const pautaClicada = Math.floor(yDoClique / alturaDaLinha)
  const ocupadas = Math.max(1, linhasOcupadas)
  return pautaClicada >= ocupadas ? pautaClicada - ocupadas + 1 : 0
}

/**
 * Quantas linhas VISUAIS o texto ocupa numa `textarea`, contando as quebras por largura.
 *
 * `split('\n')` não basta: uma linha comprida quebra em duas pautas na tela, e contar só as
 * quebras digitadas faria o clique na segunda pauta dessa linha "acrescentar" uma quebra que
 * não falta. A medida certa é o `scrollHeight` do campo ENCOLHIDO (o truque de todo campo que
 * cresce com o texto): o navegador diz quanto o conteúdo ocupa, e daí sai o número de pautas.
 *
 * Encolher é mais que `height: 0`, e foi isso que a primeira versão errou (medido no harness
 * `testarNoApp.mjs`, fase `caderno`: o clique na sexta pauta não acrescentava nada). O caderno das
 * anotações é `flex: 1` numa coluna, e o flex estica o campo de volta por cima da altura zerada; as
 * caixas da ficha têm `min-height`, que vence a altura também. Nos dois casos o `scrollHeight`
 * devolvia a área VISÍVEL, e o texto "ocupava" o caderno inteiro. Zera-se altura, mínimo e flex
 * juntos, e tudo volta na mesma passada, antes de qualquer pintura. A altura de antes é guardada e
 * devolvida porque pode ser da pessoa (a caixa da ficha tem `resize: vertical`).
 */
export function linhasOcupadasNaTextarea(campo: HTMLTextAreaElement, alturaDaLinha: number): number {
  if (!(alturaDaLinha > 0)) return 1
  const { height, minHeight, flex } = campo.style
  campo.style.height = '0px'
  campo.style.minHeight = '0px'
  campo.style.flex = '0 0 0px'
  const estilo = getComputedStyle(campo)
  const preenchimento = (parseFloat(estilo.paddingTop) || 0) + (parseFloat(estilo.paddingBottom) || 0)
  const conteudo = campo.scrollHeight - preenchimento
  campo.style.height = height
  campo.style.minHeight = minHeight
  campo.style.flex = flex
  return Math.max(1, Math.round(conteudo / alturaDaLinha))
}

/**
 * Quantas quebras faltam pra chegar à pauta onde o mouse clicou (`clientY` do evento), medindo o
 * campo como ele está na tela: a pauta é o `line-height` computado, e o topo do texto é a borda
 * mais o preenchimento de cima (o caderno das anotações não tem, as caixas da ficha têm 6px).
 */
export function quebrasParaOClique(campo: HTMLTextAreaElement, clientY: number): number {
  const estilo = getComputedStyle(campo)
  const alturaDaLinha = parseFloat(estilo.lineHeight) || 0
  const topo = campo.getBoundingClientRect().top + campo.clientTop + (parseFloat(estilo.paddingTop) || 0)
  const y = clientY - topo + campo.scrollTop
  return quebrasAteALinhaClicada(y, alturaDaLinha, linhasOcupadasNaTextarea(campo, alturaDaLinha))
}
