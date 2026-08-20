/**
 * Geometria compartilhada de "polígono regular visto de cima" — usada tanto pela bandeja
 * hexagonal (`TRAY_CONFIG`) quanto pela parede circular da torre (`TOWER_CONFIG`, que já
 * aproximava um círculo com muitos segmentos antes disso existir como arquivo próprio). Um só
 * lugar define a convenção de ângulo (normal do segmento `i` em `i·2π/N + π/N`) pra parede
 * física (`createRingWall`), mesh visual (`THREE.CylinderGeometry` com o mesmo N de segmentos,
 * que usa essa mesma convenção por padrão) e teste de "está dentro" (`isInsideRegularPolygon`)
 * nunca discordarem entre si sobre onde a borda de verdade fica.
 */

/**
 * Ângulo (radianos) da normal externa do segmento `i` de um polígono de `segments` lados.
 *
 * `rotation` gira o polígono inteiro. Existe porque a bandeja mudou de forma: um triângulo com a
 * convenção crua fica com uma PONTA virada pra câmera, o que o usuário viu como "o triângulo ficou
 * mt bugado". Girado, ele apoia uma face de frente e a ponta vai pro fundo, onde está o estojo.
 * Zero pro hexágono, que já nasce assim (ver `trayRotation`).
 */
export function regularPolygonSegmentAngle(i: number, segments: number, rotation = 0): number {
  return (i * 2 * Math.PI) / segments + Math.PI / segments + rotation
}

/** Raio até os VÉRTICES (p.ex. o raio a passar pro `THREE.CylinderGeometry`) a partir do apótema (raio até o meio de cada lado). */
export function regularPolygonCircumradius(apothem: number, segments: number): number {
  return apothem / Math.cos(Math.PI / segments)
}

/**
 * True se `(x, z)` está dentro (ou até `margin` além) do polígono regular de `segments` lados
 * e apótema `apothem`, centrado na origem, com a MESMA convenção de ângulo de
 * `regularPolygonSegmentAngle`/`createRingWall`. Teste de semiplanos: dentro de um polígono
 * convexo ⟺ a projeção do ponto em toda normal de aresta não passa do apótema.
 */
export function isInsideRegularPolygon(
  x: number,
  z: number,
  apothem: number,
  segments: number,
  margin = 0,
  rotation = 0
): boolean {
  for (let i = 0; i < segments; i++) {
    const angle = regularPolygonSegmentAngle(i, segments, rotation)
    const projected = x * Math.cos(angle) + z * Math.sin(angle)
    if (projected > apothem + margin) return false
  }
  return true
}

/**
 * Distância do centro até a BORDA do polígono na direção `angle` — o que "raio" significa numa
 * forma que não é círculo. Mesma convenção de ângulo do resto do arquivo.
 *
 * Existe porque o ponto de largada do arremesso (`tossDie`) precisa cair logo FORA da parede, e
 * "logo fora" não é um número só: num triângulo a borda está a 3.75 na direção de uma face e a
 * 7.5 na direção de uma ponta. Usar o apótema pros dois lados era o que fazia o dado nascer longe
 * demais numa direção e dentro da bandeja na outra.
 *
 * A conta é o apótema dividido pelo cosseno do quanto `angle` se afasta da normal de face mais
 * próxima — numa face esse afastamento é zero e o raio é o apótema; numa ponta ele é π/N e o raio
 * é o circunraio, que é exatamente `regularPolygonCircumradius`.
 */
export function regularPolygonRadiusAt(
  angle: number,
  apothem: number,
  segments: number,
  rotation = 0
): number {
  const step = (2 * Math.PI) / segments
  const relative = angle - Math.PI / segments - rotation
  // Resto sempre em [0, step), mesmo com ângulo negativo — daí o `%` duplo.
  const offset = ((relative % step) + step) % step - step / 2
  return apothem / Math.cos(offset)
}
