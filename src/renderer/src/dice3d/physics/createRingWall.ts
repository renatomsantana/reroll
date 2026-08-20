import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { regularPolygonSegmentAngle } from './regularPolygon'

export interface RingWallOptions {
  /** Apótema (raio até o meio de cada face) do polígono. */
  radius: number
  segments: number
  /** Gira o polígono inteiro (ver `regularPolygonSegmentAngle`). A bandeja usa; a torre, não. */
  rotation?: number
  bottomY: number
  topY: number
  groups: number
  /**
   * Deixa uma lacuna angular (sem collider) centrada em `angleRad` — usada pelo "portão" da
   * torre (ver `createTowerColliders.ts`), pra um dado só conseguir sair da torre atravessando a
   * mesma abertura que a casca visual (`buildTowerShellGeometry.ts`) tem, em vez de vazar em
   * qualquer direção pelo vão que ficava aberto embaixo da parede antiga. Ausente = parede
   * fechada o tempo todo (comportamento original, ainda usado pela bandeja/pela parede alta da
   * torre).
   */
  gate?: { angleRad: number; halfWidthRad: number }
}

/** Diferença angular entre `a` e `b`, normalizada pra `[-π, π]` — evita bug de "costura" perto de 0/2π. */
function angleDelta(a: number, b: number): number {
  const raw = a - b
  return (((raw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

/**
 * Aproxima (ou, com poucos segmentos, forma exatamente) uma parede poligonal com N cuboides
 * fixos — mesma técnica usada tanto pela parede circular da torre (`shellSegments=24`, lê como
 * círculo) quanto pela parede hexagonal da bandeja (`wallSegments=6`, um hexágono de verdade,
 * não uma aproximação). Rotação de cada segmento calculada com `THREE.Quaternion` em vez de
 * fórmula de trigonometria na mão, pra não arriscar um erro de sinal/eixo sutil.
 */
export function createRingWall(world: RAPIER.World, options: RingWallOptions): void {
  const { radius, segments, bottomY, topY, groups, gate } = options
  const height = topY - bottomY
  if (height <= 0) return
  const halfHeight = height / 2
  const centerY = bottomY + halfHeight
  const halfThickness = 0.15
  const tangentialHalfWidth = radius * Math.tan(Math.PI / segments) + halfThickness

  const localZ = new THREE.Vector3(0, 0, 1)
  const rotation = new THREE.Quaternion()

  for (let i = 0; i < segments; i++) {
    const angle = regularPolygonSegmentAngle(i, segments, options.rotation ?? 0)
    if (gate && Math.abs(angleDelta(angle, gate.angleRad)) < gate.halfWidthRad) continue
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const radialDir = new THREE.Vector3(x, 0, z).normalize()
    rotation.setFromUnitVectors(localZ, radialDir)

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(tangentialHalfWidth, halfHeight, halfThickness)
        .setTranslation(x, centerY, z)
        .setRotation(new RAPIER.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
        .setCollisionGroups(groups),
      body
    )
  }
}
