import type { DiceDefinition, Vector3Tuple } from '@shared/types/dice3d'
import type { Quaternion } from './readTopFace'

/**
 * A orientação que faz um dado MOSTRAR um valor — o caminho inverso do `readTopFace`, que descobre
 * o valor a partir da orientação.
 *
 * Serve pros dados parados do estojo, que não vêm da física: eles são posicionados na prateleira e
 * ficavam na orientação de repouso do modelo, ou seja, cada tipo mostrando a face que calhasse. O
 * pedido do usuário é que todos exibam o maior número — d4 com 4, d6 com 6, d20 com 20, d100 com
 * 100 —, que é como se arruma um estojo de verdade.
 *
 * Nada aqui importa Three.js, pelo mesmo motivo do `readTopFace` ao lado: assim o teste confere a
 * conta chamando o LEITOR de verdade do app, sem WebGL e sem abrir janela.
 */

const WORLD_UP: Vector3Tuple = [0, 1, 0]
const WORLD_DOWN: Vector3Tuple = [0, -1, 0]

function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalizar(q: Quaternion): Quaternion {
  const tamanho = Math.hypot(q.x, q.y, q.z, q.w)
  return { x: q.x / tamanho, y: q.y / tamanho, z: q.z / tamanho, w: q.w / tamanho }
}

/**
 * O giro de MENOR ARCO que leva `de` em `para` (os dois unitários).
 *
 * Menor arco e não um qualquer: sobra uma família inteira de rotações que alinham a face (todas as
 * que giram em torno da própria direção de destino depois de alinhar), e escolher uma à toa deixaria
 * cada dado do estojo torto num ângulo diferente. O giro mínimo mantém o resto da pose como o modelo
 * foi desenhado, então os sete continuam alinhados entre si.
 *
 * Mora aqui, e não no `quaternionTestHelpers` onde nasceu, porque deixou de ser coisa só de teste
 * quando o estojo passou a precisar dela. Aquele arquivo agora reexporta esta função: duas cópias da
 * mesma conta é a receita pra uma ser consertada e a outra não.
 */
export function giroDeMenorArco(de: Vector3Tuple, para: Vector3Tuple): Quaternion {
  const d = dot(de, para)

  /**
   * Vetores OPOSTOS não têm giro de menor arco: o eixo é indefinido (qualquer perpendicular serve) e
   * a fórmula geral abaixo produziria um quaternion nulo. Acontece de verdade aqui — é o caso do d4,
   * cuja face de valor 4 aponta pra cima no modelo e precisa terminar apontando pra baixo.
   *
   * A perpendicular sai do eixo do mundo MENOS alinhado com `de`, que é o que garante um produto
   * vetorial longe de zero (usar sempre o mesmo eixo daria vetor nulo quando `de` fosse ele).
   */
  if (d < -1 + 1e-9) {
    const menosAlinhado: Vector3Tuple =
      Math.abs(de[0]) <= Math.abs(de[1]) && Math.abs(de[0]) <= Math.abs(de[2])
        ? [1, 0, 0]
        : Math.abs(de[1]) <= Math.abs(de[2])
          ? [0, 1, 0]
          : [0, 0, 1]
    const eixo = cross(de, menosAlinhado)
    // Meia volta: parte vetorial no eixo, parte escalar zero.
    return normalizar({ x: eixo[0], y: eixo[1], z: eixo[2], w: 0 })
  }

  const eixo = cross(de, para)
  return normalizar({ x: eixo[0], y: eixo[1], z: eixo[2], w: 1 + d })
}

/**
 * A orientação em que `definition` mostra `valor`.
 *
 * Qual direção a face precisa apontar depende do `resultMode`, e é a mesma regra que o `readTopFace`
 * usa pra ler: num d6 o número lido é o da face voltada PRA CIMA, então a face do valor pedido vai
 * pra cima; num d4 o número é o do vértice de cima, guardado na face que fica ENCOSTADA NA MESA (ver
 * `FaceResultMode`), então a face do valor pedido vai pra baixo. Ignorar isso deixaria o d4 do
 * estojo mostrando 1 com a cara de quem mostra 4.
 *
 * Devolve a identidade se o valor não existir no dado — não é situação alcançável pelos dados do
 * registro, e um dado torto no estojo é melhor que uma exceção subindo do meio da montagem da cena.
 */
export function orientacaoParaMostrar(definition: DiceDefinition, valor: number): Quaternion {
  const face = definition.faces.find((f) => f.value === valor)
  if (!face) return { x: 0, y: 0, z: 0, w: 1 }

  const direcao = definition.resultMode === 'topFace' ? WORLD_UP : WORLD_DOWN
  return giroDeMenorArco(face.normal, direcao)
}

/**
 * Aplica `antes` e DEPOIS `depois` — a ordem que confunde, porque se lê ao contrário de como se
 * escreve. `compor(giroEmY, alinhamento)` significa "alinha a face, aí gira em torno do eixo
 * vertical", que é como o estojo é montado.
 */
export function compor(depois: Quaternion, antes: Quaternion): Quaternion {
  return {
    x: depois.w * antes.x + depois.x * antes.w + depois.y * antes.z - depois.z * antes.y,
    y: depois.w * antes.y - depois.x * antes.z + depois.y * antes.w + depois.z * antes.x,
    z: depois.w * antes.z + depois.x * antes.y - depois.y * antes.x + depois.z * antes.w,
    w: depois.w * antes.w - depois.x * antes.x - depois.y * antes.y - depois.z * antes.z
  }
}

export function rotacionarVetor(v: Vector3Tuple, q: Quaternion): Vector3Tuple {
  const [vx, vy, vz] = v
  const tx = 2 * (q.y * vz - q.z * vy)
  const ty = 2 * (q.z * vx - q.x * vz)
  const tz = 2 * (q.x * vy - q.y * vx)
  return [
    vx + q.w * tx + (q.y * tz - q.z * ty),
    vy + q.w * ty + (q.z * tx - q.x * tz),
    vz + q.w * tz + (q.x * ty - q.y * tx)
  ]
}

/**
 * O giro em torno do eixo VERTICAL que leva a direção `de` na direção `para`, olhando só pra
 * componente horizontal das duas.
 *
 * Girar só em torno do Y é o ponto: o alinhamento da face já foi feito, e qualquer outro eixo
 * desfaria ele. Sobra exatamente um grau de liberdade — pra que lado o dado está "virado" —, e é
 * esse que decide se o número aparece de frente pra quem olha ou de lado.
 *
 * Direção horizontal quase nula (uma face olhando pro teto) não tem "pra que lado": devolve giro
 * nenhum, em vez de amplificar ruído numérico até virar um dado torto.
 */
export function giroVerticalEntre(de: Vector3Tuple, para: Vector3Tuple): Quaternion {
  const ax = de[0]
  const az = de[2]
  const bx = para[0]
  const bz = para[2]
  const tamA = Math.hypot(ax, az)
  const tamB = Math.hypot(bx, bz)
  if (tamA < 1e-6 || tamB < 1e-6) return { x: 0, y: 0, z: 0, w: 1 }

  const a: [number, number] = [ax / tamA, az / tamA]
  const b: [number, number] = [bx / tamB, bz / tamB]
  // Componente Y do produto vetorial dos dois no plano horizontal, e o escalar entre eles.
  const angulo = Math.atan2(a[1] * b[0] - a[0] * b[1], a[0] * b[0] + a[1] * b[1])
  return { x: 0, y: Math.sin(angulo / 2), z: 0, w: Math.cos(angulo / 2) }
}

/** O maior número impresso no dado: 4 no d4, 6 no d6, 20 no d20, 100 no d100. */
export function maiorValor(definition: DiceDefinition): number {
  return definition.faces.reduce((maior, face) => Math.max(maior, face.value), -Infinity)
}

/** A orientação em que o dado mostra o maior número que tem — a do estojo. */
export function orientacaoDoMaiorValor(definition: DiceDefinition): Quaternion {
  return orientacaoParaMostrar(definition, maiorValor(definition))
}
