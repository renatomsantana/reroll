import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { fibonacciSpherePoints, jitterPointsOnSphere } from '../geometry/fibonacciSphere'
import { buildConvexHullFaceTopology } from '../geometry/buildConvexHullFaceTopology'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * D100 "de verdade" — um único dado esférico com 100 facetas planas
 * (Zocchihedro), como o objeto físico real (ver `assets/dice/d100.png`),
 * em vez do truque tradicional de dois d10 (dezena + unidade) que o app
 * usava antes.
 *
 * 52 pontos bem distribuídos numa esfera (espiral de Fibonacci) geram,
 * pelo casco convexo, EXATAMENTE 100 faces triangulares — consequência da
 * fórmula de Euler pra poliedros convexos simpliciais: F = 2V - 4, então
 * V=52 → F=100.
 *
 * A espiral "crua" (mesmo a variante deslocada, ver `fibonacciSpherePoints`)
 * ainda deixa alguns vértices quase coplanares entre si, o que produz
 * facetas com normais quase idênticas às da vizinha — impossível de
 * distinguir de forma confiável (`readTopFace` marcaria a rolagem como
 * ambígua quase sempre). `jitterPointsOnSphere` quebra essa quase-simetria.
 * A seed/magnitude abaixo vieram de uma busca (script descartável, não
 * versionado) testando várias combinações de N/magnitude/seed e medindo a
 * menor distância angular entre quaisquer duas normais de face resultantes
 * — a maior separação mínima encontrada foi com N=52, magnitude=0.08,
 * seed=108 (gap mínimo ≈ 0,0021 em produto escalar). `AMBIGUOUS_MARGIN`
 * abaixo fica com folga confortável abaixo disso.
 */
const VERTEX_COUNT = 52
const JITTER_MAGNITUDE = 0.08
const JITTER_SEED = 108
/** Bem menor que a margem global (0.08) — ver explicação acima sobre a separação mínima entre normais. */
const AMBIGUOUS_MARGIN = 0.0015

const RAW_VERTICES: Vector3Tuple[] = jitterPointsOnSphere(
  fibonacciSpherePoints(VERTEX_COUNT),
  JITTER_MAGNITUDE,
  JITTER_SEED
)
export const D100_VERTICES = normalizeToCircumradius(RAW_VERTICES, 1)

const FACE_TOPOLOGY = buildConvexHullFaceTopology(D100_VERTICES)

if (FACE_TOPOLOGY.length !== 100) {
  throw new Error(
    `Casco convexo do d100 esférico gerou ${FACE_TOPOLOGY.length} faces, esperava exatamente 100 — ajuste VERTEX_COUNT/seed`
  )
}

/**
 * Não existe um pareamento antípoda "limpo" nesse casco convexo (ao
 * contrário dos poliedros regulares) — a ordem de saída do QuickHull é
 * determinística (mesmos pontos de entrada sempre produzem a mesma ordem),
 * mas arbitrária geometricamente. Os valores 1-100 são atribuídos nessa
 * ordem só pra existir UM mapeamento explícito e fixo — o que importa pra
 * correção é que ele nunca muda depois de definido, não a ordem em si.
 */
const FACE_INPUTS: PolyhedronFaceInput[] = FACE_TOPOLOGY.map((vertexIndices, i) => ({
  vertexIndices,
  value: i + 1
}))

export const D100_FACE_INPUTS = FACE_INPUTS

export const D100_DEFINITION: DiceDefinition = {
  type: 100,
  resultMode: 'topFace',
  // Reduzida de 0.75 pra 0.52 (mesma proporção ×0.7 aplicada a todos os dados) — ver `d6.ts`.
  scale: 0.52,
  boundingRadius: 1,
  physics: {
    mass: 1,
    /** Bem mais baixa que o padrão (0.35): sem isso, uma esfera quase perfeita quica sem nunca perder energia. */
    restitution: 0.15,
    /** Bem mais alto que o padrão (0.6): sem atrito forte, uma esfera rola indefinidamente em vez de assentar. */
    friction: 1,
    /** Mais alto que o padrão (0.15): ajuda a esfera a parar de deslizar em vez de rolar pela bandeja inteira. */
    linearDamping: 0.5,
    /** Mais alto que o padrão (0.2): sem isso, o momento angular de uma esfera quase perfeita demora demais pra dissipar. */
    angularDamping: 0.6
  },
  ambiguousMarginOverride: AMBIGUOUS_MARGIN,
  faces: computePolyhedronFaces(D100_VERTICES, FACE_INPUTS)
}
