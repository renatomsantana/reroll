/**
 * Geometria compartilhada de "polígono regular visto de cima" — usada tanto pela bandeja
 * hexagonal (`TRAY_CONFIG`) quanto pela parede circular da torre (`TOWER_CONFIG`, que já
 * aproximava um círculo com muitos segmentos antes disso existir como arquivo próprio). Um só
 * lugar define a convenção de ângulo (normal do segmento `i` em `i·2π/N + π/N`) pra parede
 * física (`createRingWall`), mesh visual (`THREE.CylinderGeometry` com o mesmo N de segmentos,
 * que usa essa mesma convenção por padrão) e teste de "está dentro" (`isInsideRegularPolygon`)
 * nunca discordarem entre si sobre onde a borda de verdade fica.
 */

/** Ângulo (radianos) da normal externa do segmento `i` de um polígono de `segments` lados. */
export function regularPolygonSegmentAngle(i: number, segments: number): number {
  return (i * 2 * Math.PI) / segments + Math.PI / segments
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
  margin = 0
): boolean {
  for (let i = 0; i < segments; i++) {
    const angle = regularPolygonSegmentAngle(i, segments)
    const projected = x * Math.cos(angle) + z * Math.sin(angle)
    if (projected > apothem + margin) return false
  }
  return true
}
