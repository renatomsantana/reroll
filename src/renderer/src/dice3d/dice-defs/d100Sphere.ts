import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { antipodalDirections } from '../geometry/antipodalDirections'
import { buildDualFromNormals } from '../geometry/dualPolyhedron'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * D100 "de verdade": um único dado esférico com 100 faces planas (Zocchihedro), como o objeto real
 * (ver `assets/dice/d100.png`), em vez do truque de dois d10 que o app usava antes.
 *
 * Ele é construído PELAS NORMAIS, e são duas decisões, não uma:
 *
 * 1. as 100 direções são as normais das faces, e o sólido é a interseção dos semi-espaços delas
 *    (`dualPolyhedron.ts`). Cada face vira a célula de Voronoi da sua direção: áreas parecidas, e o
 *    pé da perpendicular do centro caindo dentro da própria face, ou seja, toda face apoia;
 * 2. as direções vêm em 50 PARES ANTIPODAIS (`antipodalDirections.ts`): faces opostas paralelas,
 *    como em qualquer dado de verdade. É esta que fecha a honestidade, e é a que não era óbvia — sem
 *    simetria, o mapa "face de apoio → face lida" não é bijeção e sobram faces que não saem nunca
 *    por mais iguais que sejam as áreas. Medido com Fibonacci sobre a esfera inteira, áreas ótimas e
 *    sem simetria: 92 das 100 faces alcançáveis.
 *
 * A versão anterior fazia o contrário: 52 pontos de Fibonacci com jitter viravam os VÉRTICES e as
 * 100 faces triangulares saíam do casco convexo. O jitter existia por um motivo real (sem ele,
 * vértices quase coplanares davam normais quase idênticas e `readTopFace` marcava quase toda rolagem
 * como ambígua), mas resolvia a leitura estragando o dado: medido em 3000 rolagens de física real,
 * TREZE faces nunca saíram, a mais comum saía 4,13% das vezes (quatro vezes o 1% esperado) e o
 * qui-quadrado deu 2887 contra 148,2 de corte. É o mesmo motivo pelo qual um Zocchihedro de verdade é
 * conhecido por não ser honesto; aqui não precisa ser, e `distribuicaoNaBandejaCheia.test.ts` mede.
 *
 * A leitura também ficou folgada: o par de normais mais próximo está a 17,8° (produto escalar
 * 0,9522), contra os 0,0021 de gap que o jitter conseguia.
 */
const FACE_COUNT = 100

/**
 * Margem de ambiguidade PRÓPRIA: a global (0,08) não serve, e a conta mostra por quê. `readTopFace`
 * chama de ambígua a leitura em que a melhor face e a vice ficam a menos de uma margem de produto
 * escalar uma da outra; num d20 as vizinhas estão a mais de 40°, mas aqui o par mais próximo está a
 * 17,8°, então um dado APOIADO E PARADO na sua face já nasce com diferença de apenas
 * 1 − cos(17,8°) = 0,048.
 *
 * Com a margem global, TODA leitura vira ambígua: medido, 200 mil de 200 mil orientações, e na física
 * real 255 mil cutucadas seguidas sem um único dado assentar. Este 0,02 fica em 42% do menor caso de
 * repouso apoiado, então dado deitado nunca é chamado de ambíguo e dado de fato equilibrado numa
 * aresta continua sendo pego e cutucado.
 */
const AMBIGUOUS_MARGIN = 0.02

/** As 100 direções que as faces olham — não são vértices, são normais. Ver o comentário acima. */
export const D100_FACE_NORMALS: Vector3Tuple[] = antipodalDirections(FACE_COUNT / 2)

const DUAL = buildDualFromNormals(D100_FACE_NORMALS)

if (DUAL.faces.length !== FACE_COUNT) {
  throw new Error(`O dual das direções do d100 gerou ${DUAL.faces.length} faces, esperava ${FACE_COUNT}`)
}

export const D100_VERTICES = normalizeToCircumradius(DUAL.vertices, 1)

/**
 * A numeração segue as duas convenções de um dado de verdade, agora que dá:
 *
 * - faces opostas somam 101 (como 7 no d6 e 21 no d20). Só é possível porque as direções vêm em
 *   pares antipodais e a segunda metade da lista é a antípoda da primeira: a face `i + 50` recebe
 *   `101 − valor(i)`;
 * - números consecutivos longe uns dos outros. As direções saem em ordem de espiral, então numerar
 *   na ordem em que elas vêm poria os consecutivos lado a lado, subindo o dado em caracol — o que
 *   nenhum dado de verdade faz. O passo 17 é primo com 50, então percorre os cinquenta valores da
 *   metade norte sem repetir nenhum e joga cada consecutivo pro outro lado do dado.
 *
 * Isto é aparência e tradição, não honestidade: pra rolagem ser justa o que importa é a geometria
 * das faces, não qual número está escrito em cada uma.
 */
const PASSO_DA_NUMERACAO = 17

const FACE_INPUTS: PolyhedronFaceInput[] = DUAL.faces.map((vertexIndices, i) => {
  const metade = FACE_COUNT / 2
  const valorNorte = ((i % metade) * PASSO_DA_NUMERACAO) % metade + 1
  return { vertexIndices, value: i < metade ? valorNorte : FACE_COUNT + 1 - valorNorte }
})

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
