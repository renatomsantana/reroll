/**
 * O BOTÃO EXPLODE aparece pra este sistema de RPG? Pedido dele: "explode acho que podemos remover?
 * apenas aparecer quando uma ficha/perfil de D&D for escolhida". O interruptor manual da barra some
 * fora de D&D e volta sozinho quando o personagem ativo é de lá.
 *
 * O que isto NÃO esconde, de propósito: preset com regra explosiva gravada continua explodindo em
 * qualquer sistema (regra gravada rola como está escrita, e o botão só espelha a rolagem em curso); a
 * gramática continua lendo `!`; e a caixa "Dados explosivos" do editor continua lá, porque o editor é
 * onde se DESCREVE uma rolagem, de qualquer sistema.
 *
 * O `system` do perfil é texto LIVRE, então a conferência é por conteúdo e não por igualdade: "D&D",
 * "D & D", "dnd", "Dungeons & Dragons", em qualquer caixa. Kids on Bikes entrou quando ganhou leitor
 * dedicado: ali a explosão não é opção, é a regra central. Outro sistema entra no dia em que for
 * pedido, acrescentando ao padrão com o teste junto.
 */
const SISTEMAS_COM_BOTAO = /d\s*&\s*d|dnd|dungeons|kids\s*on\s*bikes/i

export function botaoDeExplodeVisivel(system: string): boolean {
  return SISTEMAS_COM_BOTAO.test(system)
}
