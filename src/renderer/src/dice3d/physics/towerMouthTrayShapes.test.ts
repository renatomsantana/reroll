import { describe, expect, it } from 'vitest'
import { isInsideRegularPolygon } from './regularPolygon'
import { computeTowerBesideLayout } from '../geometry/towerBesideTrayLayout'
import { TRAY_CONFIG } from '../config/physicsConfig'
import { TRAY_SHAPES, TRAY_SHAPE_SIDES, trayApothem, trayRotation, type TrayShape } from '../geometry/trayShape'

/**
 * ONDE A TORRE FICA em cada FORMA de bandeja — a conferência que não precisa de física nenhuma.
 *
 * As rolagens de verdade pela boca, em todas as formas e com todos os tipos de dado, moram em
 * `matrizDeRolagens.test.ts` (20 dados por caso). Aqui fica o que dá pra provar sem simular, e que
 * apontaria o defeito no primeiro segundo em vez de depois de vinte mil passos: torre assentada
 * numa quina, boca abaixo da parede, ou virada pro lado errado.
 *
 * O buraco de cobertura que este arquivo fechou: `towerMouthSpawn.test.ts` cobre os sete tipos de
 * dado, mas SEMPRE no hexágono. Trocar a bandeja MOVE A TORRE — `computeTowerBesideLayout` assenta
 * a torre no meio de uma FACE (`nearestFaceAngle`), e tanto o ângulo quanto a distância saem do
 * apótema da forma, que vai de 3.75 no triângulo a 7.5 no círculo. Muda o ponto de onde o dado sai,
 * muda a direção do lançamento e muda a distância até o alvo.
 */
describe('a boca da torre em cada formato de bandeja', () => {
  it.each(TRAY_SHAPES)('%s — fica fora da bandeja, acima da parede e virada pro centro', (forma: TrayShape) => {
    const sides = TRAY_SHAPE_SIDES[forma]
    const layout = computeTowerBesideLayout({}, sides)
    const distanciaDoCentro = Math.hypot(layout.mouth.x, layout.mouth.z)

    expect(layout.apothem).toBeCloseTo(trayApothem(sides), 6)
    // Fora da parede (senão a torre estaria dentro da área de jogo)...
    expect(distanciaDoCentro).toBeGreaterThan(trayApothem(sides) + TRAY_CONFIG.wallThickness)
    // ...e acima do topo dela (senão o dado sai batendo na parede por fora).
    expect(layout.mouth.y).toBeGreaterThan(TRAY_CONFIG.wallHeight)

    const paraOCentro = Math.hypot(layout.mouth.x + layout.mouthDirection.x, layout.mouth.z + layout.mouthDirection.z)
    expect(paraOCentro).toBeLessThan(distanciaDoCentro)

    /**
     * A torre encosta no MEIO DE UMA FACE, nunca numa quina — é a diferença entre a boca olhar pra
     * dentro da bandeja e olhar pro vão entre duas paredes. Conferido no ponto onde a direção da
     * torre cruza o círculo inscrito: numa face ele cai EM CIMA da parede (dentro pela margem de
     * 0.01, fora por −0.01). Numa quina, aquele ponto estaria bem para dentro do polígono, e as
     * duas checagens diriam "dentro".
     */
    const naParede = { x: layout.outward.x * trayApothem(sides), z: layout.outward.z * trayApothem(sides) }
    expect(isInsideRegularPolygon(naParede.x, naParede.z, trayApothem(sides), sides, 0.01, trayRotation(sides))).toBe(
      true
    )
    expect(isInsideRegularPolygon(naParede.x, naParede.z, trayApothem(sides), sides, -0.01, trayRotation(sides))).toBe(
      false
    )
  })
})
