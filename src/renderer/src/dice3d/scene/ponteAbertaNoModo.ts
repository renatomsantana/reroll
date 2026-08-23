import type { LaunchMode } from '@renderer/settings/SettingsContext'

/**
 * A ponte levadiça está ABAIXADA (passagem aberta) na cena? Regra de UM lugar só, porque duas
 * coisas dependem dela: o estado com que a cena NASCE e a animação de abrir/fechar.
 *
 * Levantar a ponte é um clique, e o clique só é aceito na TORRE DE ENFEITE (`bridgeUnderPointer` em
 * `DiceCanvasMulti`) — no modo `tower` uma ponte levantada ficaria no caminho da rolagem. Só que a
 * guarda do clique não bastava: o estado mora no React (`bridgeOpen` em `DiceRoller3D`) e SOBREVIVE
 * à remontagem da cena, então quem fechasse a ponte no enfeite e trocasse pro modo torre levava a
 * ponte fechada junto — sem clique nenhum pra reabrir, porque no modo torre o clique é ignorado.
 *
 * O que acontecia então, MEDIDO (ver o teste de geometria em `ponteLevadica.test.ts`): a folha
 * levantada fica em pé no plano da dobradiça, que é exatamente a boca; o dado nasce a 0.18 pra
 * dentro desse plano (`tossDieFromMouth`) e tem raio entre 0.43 (d12) e 0.56 (d20). Ou seja, TODO
 * tipo de dado nasce atravessado na folha e sai voando por dentro dela — a ponte é decorativa e não
 * tem collider, então o dado não bate, ele passa como fantasma pela madeira.
 *
 * Por isso a regra é do MODO, não do clique: fora do enfeite a ponte fica sempre abaixada, e o
 * estado do usuário é preservado pra quando ele voltar pro enfeite.
 */
export function ponteAbertaNoModo(launchMode: LaunchMode, bridgeOpen: boolean): boolean {
  return launchMode === 'towerDecor' ? bridgeOpen : true
}
