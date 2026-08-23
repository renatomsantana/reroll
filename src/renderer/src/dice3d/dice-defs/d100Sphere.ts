import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import { antipodalDirections } from '../geometry/antipodalDirections'
import { buildDualFromNormals } from '../geometry/dualPolyhedron'
import { computePolyhedronFaces, normalizeToCircumradius, type PolyhedronFaceInput } from '../geometry/polyhedronMath'

/**
 * D100 "de verdade" — um único dado esférico com 100 faces planas (Zocchihedro), como o objeto
 * físico real (ver `assets/dice/d100.png`), em vez do truque tradicional de dois d10 (dezena +
 * unidade) que o app usava antes.
 *
 * ELE É CONSTRUÍDO PELAS NORMAIS, e são duas decisões, não uma:
 *
 * 1. as 100 direções são as NORMAIS DAS FACES, e o sólido é a interseção dos semi-espaços delas
 *    (ver `dualPolyhedron.ts`). Cada face vira a célula de Voronoi da sua direção — áreas parecidas,
 *    e o pé da perpendicular do centro caindo sempre DENTRO da própria face, ou seja, toda face
 *    apoia;
 * 2. as direções vêm em 50 PARES ANTIPODAIS (ver `antipodalDirections.ts`): faces opostas
 *    paralelas, como em qualquer dado de verdade. É esta que fecha a honestidade, e é a que não era
 *    óbvia — ver o comentário de lá: sem simetria, o mapa "face de apoio → face lida" não é uma
 *    bijeção, e sobram faces que não saem nunca por mais iguais que sejam as áreas. Medido com
 *    Fibonacci sobre a esfera inteira, áreas ótimas e sem simetria: 92 das 100 faces alcançáveis.
 *
 * A VERSÃO ANTERIOR fazia o contrário: 52 pontos de Fibonacci com jitter viravam os VÉRTICES, e as
 * 100 faces triangulares saíam de brinde do casco convexo (F = 2V − 4). O jitter existia por um
 * motivo real — sem ele, vértices quase coplanares produziam facetas com normais quase idênticas, e
 * `readTopFace` marcava quase toda rolagem como ambígua. Só que ele resolvia a leitura estragando o
 * dado, e o preço apareceu na medição (3000 rolagens de física real, agosto/2026):
 *
 * - TREZE das cem faces nunca saíram uma única vez. Facetas irregulares num corpo quase esférico
 *   têm bacias de equilíbrio desiguais, e algumas ficam vazias: o dado tomba pra vizinha antes de
 *   parar. Não eram raras — eram inalcançáveis;
 * - a face mais comum saía 4,13% das vezes, quatro vezes o 1% esperado;
 * - qui-quadrado 2887 contra 148,2 de corte.
 *
 * É o mesmo motivo pelo qual um Zocchihedro de verdade é conhecido por não ser honesto. Aqui não
 * precisa ser: `distribuicaoNaBandejaCheia.test.ts` mede, e `d100.test.ts` fecha a geometria.
 *
 * A leitura também ficou folgada: o par de normais mais próximo está a 17,8° (produto escalar
 * 0,9522), contra os 0,0021 de gap que o jitter conseguia. Ver `AMBIGUOUS_MARGIN` pra por que ela
 * ainda precisa de um valor próprio.
 */
const FACE_COUNT = 100

/**
 * Margem de ambiguidade PRÓPRIA — a global (0,08) não serve, e a conta mostra por quê.
 *
 * `readTopFace` chama de ambígua a leitura em que a melhor face e a vice ficam a menos de uma
 * margem de produto escalar uma da outra. Num d20, faces vizinhas estão a mais de 40° e a diferença
 * é enorme; aqui o par de normais mais próximo está a 17,8°, então um dado APOIADO E PARADO na sua
 * face já nasce com diferença de apenas 1 − cos(17,8°) = 0,048.
 *
 * Com a margem global de 0,08, TODA leitura vira ambígua: medido, 200 mil de 200 mil orientações, e
 * na física real 255 mil cutucadas seguidas sem um único dado assentar — o dado nunca parava. Este
 * 0,02 fica em 42% do menor caso de repouso apoiado (0,048), ou seja, sobra folga pros dois lados:
 * dado deitado nunca é chamado de ambíguo, e dado de fato equilibrado numa aresta (diferença perto
 * de zero, as duas faces igualmente pra cima) continua sendo pego e cutucado.
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
 * A NUMERAÇÃO segue as duas convenções de um dado de verdade, agora que dá:
 *
 * - FACES OPOSTAS SOMAM 101 (como 7 no d6 e 21 no d20). Só é possível porque as direções vêm em
 *   pares antipodais, e a segunda metade da lista é exatamente a antípoda da primeira: a face
 *   `i + 50` recebe `101 − valor(i)`;
 * - NÚMEROS CONSECUTIVOS LONGE UNS DOS OUTROS. As direções saem em ordem de espiral, então numerar
 *   1, 2, 3... na ordem em que elas vêm poria os consecutivos lado a lado, subindo o dado em
 *   caracol — o que nenhum dado de verdade faz, e o que denuncia na hora que a coisa foi gerada por
 *   fórmula. O passo 17 é primo com 50, então percorre os cinquenta valores da metade norte sem
 *   repetir nenhum e joga cada consecutivo pro outro lado do dado.
 *
 * Isto é aparência e tradição, não honestidade: pra a rolagem ser justa o que importa é a geometria
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
