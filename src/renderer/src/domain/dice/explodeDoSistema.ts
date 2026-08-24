/**
 * O BOTÃO EXPLODE aparece pra este sistema de RPG?
 *
 * Pedido do usuário: "explode acho que podemos remover? apenas aparecer quando uma ficha/perfil de
 * D&D for escolhida". O interruptor manual da barra some fora de D&D — menos botão na frente de
 * quem nunca vai usá-lo — e volta sozinho quando o personagem ativo é de D&D.
 *
 * O que isto NÃO esconde, de propósito:
 * - preset com regra explosiva gravada continua explodindo em QUALQUER sistema — regra gravada
 *   rola como está escrita, e o botão da barra só espelha a rolagem em curso;
 * - a gramática continua lendo `!` em qualquer preset de fórmula;
 * - a caixa "Dados explosivos" do editor de preset continua lá — o editor é onde se DESCREVE uma
 *   rolagem, de qualquer sistema.
 *
 * O `system` do perfil é texto LIVRE ("D&D 5e" vem do leitor de ficha; o resto é digitado), então a
 * conferência é por conteúdo, não por igualdade: "D&D", "D & D", "dnd", "Dungeons & Dragons" — em
 * qualquer caixa. Outro sistema que use explosão como regra central (Kids on Bikes, Savage Worlds)
 * entra aqui no dia em que for pedido: é acrescentar ao padrão, com o teste junto.
 */
const SISTEMAS_COM_BOTAO = /d\s*&\s*d|dnd|dungeons/i

export function botaoDeExplodeVisivel(system: string): boolean {
  return SISTEMAS_COM_BOTAO.test(system)
}
