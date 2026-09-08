/**
 * Geometria compartilhada de "polígono regular visto de cima", usada pela bandeja e pela parede da
 * torre. Um só lugar define a convenção de ângulo (normal do segmento `i` em `i·2π/N + π/N`) pra parede
 * física, mesh visual e teste de "está dentro" nunca discordarem sobre onde a borda de verdade fica.
 */

/**
 * Ângulo da normal externa do segmento `i`. `rotation` gira o polígono inteiro, e existe porque a
 * bandeja mudou de forma: um triângulo com a convenção crua fica com uma PONTA virada pra câmera ("o
 * triângulo ficou mt bugado"). Zero pro hexágono, que já nasce assim.
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
 * Distância do centro até a BORDA na direção `angle` — o que "raio" significa numa forma que não é
 * círculo. Existe porque o ponto de largada do arremesso precisa cair logo FORA da parede, e "logo
 * fora" não é um número só: num triângulo a borda está a 3.75 na direção de uma face e a 7.5 na direção
 * de uma ponta, e usar o apótema pros dois lados fazia o dado nascer longe demais numa direção e dentro
 * da bandeja na outra.
 *
 * A conta é o apótema dividido pelo cosseno do quanto `angle` se afasta da normal de face mais próxima:
 * numa face isso é zero e o raio é o apótema; numa ponta é π/N e o raio é o circunraio.
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
