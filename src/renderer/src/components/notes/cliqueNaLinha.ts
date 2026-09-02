/**
 * CLICAR NUMA LINHA VAZIA DO CADERNO leva o cursor pra ela.
 *
 * Pedido dele (02/09/2026): "deixar possível que clique em qualquer linha no anotações para começar
 * a digitar, que não seja apenas no Enter". O caderno desenha as linhas pautadas até o fim da área
 * (ver `.notes-textarea`), mas o texto só existe até onde foi digitado: clicar numa pauta abaixo da
 * última linha escrita punha o cursor no FIM do texto, e pra escrever naquela pauta a pessoa tinha
 * que apertar Enter até chegar lá. Num caderno de papel se escreve onde se aponta a caneta.
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
 * não falta. A medida certa é o `scrollHeight` do campo com a altura zerada (o truque de todo
 * campo que cresce com o texto): o navegador diz quanto o conteúdo ocupa, e daí sai o número de
 * pautas. A altura volta na mesma passada, antes de qualquer pintura.
 */
export function linhasOcupadasNaTextarea(campo: HTMLTextAreaElement, alturaDaLinha: number): number {
  if (!(alturaDaLinha > 0)) return 1
  const alturaAntes = campo.style.height
  campo.style.height = '0px'
  const estilo = getComputedStyle(campo)
  const preenchimento = (parseFloat(estilo.paddingTop) || 0) + (parseFloat(estilo.paddingBottom) || 0)
  const conteudo = campo.scrollHeight - preenchimento
  campo.style.height = alturaAntes
  return Math.max(1, Math.round(conteudo / alturaDaLinha))
}
