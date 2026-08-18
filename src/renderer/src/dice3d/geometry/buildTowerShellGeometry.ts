import * as THREE from 'three'

export interface TowerShellGeometryOptions {
  /** Raio da casca cilíndrica. */
  radius: number
  /** Altura total da casca (Y de 0, chão, até `height`). */
  height: number
  /** Ângulo (radianos, convenção `(cos(theta)·R, y, sin(theta)·R)`) do centro do portão. */
  gateAngleRad: number
  /** Largura do portão em unidades de mundo (arco na base da casca, não radianos). */
  gateArcWidth: number
  /** Altura do portão (a partir de Y=0). */
  gateHeight: number
  /** Segmentos radiais — controla o quão "poligonal" vs. suave a casca fica. */
  radialSegments: number
}

/** Diferença angular entre `a` e `b`, normalizada pra `[-π, π]` — evita bug de "costura" perto de 0/2π. */
function angleDelta(a: number, b: number): number {
  const raw = a - b
  return ((raw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

/**
 * Casca da torre com um recorte retangular de verdade (o "portão") — construída à mão, grade de
 * vértices (colunas = segmentos angulares, linhas = chão/topo-do-portão/topo-da-casca), mesmo
 * padrão já usado por `buildSweptRibbon.ts` pra rampa. Tentativa anterior usava
 * `THREE.ShapeGeometry` com um furo (`Shape.holes`) — a "desenrolar num retângulo plano com furo,
 * dobrar num cilindro" é elegante no papel, mas `ShapeGeometry` só subdivide CURVAS
 * (`curveSegments`), não segmentos retos (`lineTo`), então o retorno tinha só uns poucos vértices
 * ao longo do contorno — ao dobrar isso num cilindro, virava um punhado de facetas grandes e
 * tortas em vez de um cilindro liso (confirmado visualmente, não só suspeitado — a textura de
 * tijolo saía visivelmente enrolada/espiralada). Construir a grade manualmente com a densidade de
 * `radialSegments` de propósito, igual a um `CylinderGeometry` de verdade teria, e simplesmente
 * OMITIR os quads que caem dentro da janela do portão — sem geometria de furo nenhuma envolvida,
 * só menos triângulos naquela região.
 *
 * Só a faixa de baixo (chão até `gateHeight`) tem quads faltando na região do portão; a faixa de
 * cima (`gateHeight` até `height`) é um cilindro completo normal.
 */
export function buildTowerShellGeometry(options: TowerShellGeometryOptions): THREE.BufferGeometry {
  const { radius, height, gateAngleRad, gateArcWidth, gateHeight, radialSegments } = options
  const gateHalfAngle = gateArcWidth / 2 / radius
  const rows = [0, gateHeight, height]

  const positions: number[] = []
  const uvs: number[] = []
  for (const y of rows) {
    for (let c = 0; c <= radialSegments; c++) {
      const angle = (c / radialSegments) * Math.PI * 2
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      uvs.push(c / radialSegments, y / height)
    }
  }

  const columnsPerRow = radialSegments + 1
  const indices: number[] = []
  for (let band = 0; band < rows.length - 1; band++) {
    const rowA = band * columnsPerRow
    const rowB = (band + 1) * columnsPerRow
    const isGateBand = band === 0

    for (let c = 0; c < radialSegments; c++) {
      if (isGateBand) {
        const segMidAngle = ((c + 0.5) / radialSegments) * Math.PI * 2
        if (Math.abs(angleDelta(segMidAngle, gateAngleRad)) < gateHalfAngle) continue
      }

      const a = rowA + c
      const b = rowA + c + 1
      const d = rowB + c
      const e = rowB + c + 1
      indices.push(a, d, b, b, d, e)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}
