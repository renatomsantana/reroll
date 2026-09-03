/**
 * O ACASO da cena 3D vem do gerador CRIPTOGRÁFICO, e não de `Math.random`.
 *
 * Pedido dele (03/09/2026): "deixar a rolagem de dados o mais aleatória possível". O modo rápido
 * já sorteava assim (`rollDie` em `diceEngine.ts`, com rejeição de viés). Na cena 3D o resultado
 * é a física: o dado cai onde as condições iniciais o levam — posição, altura, orientação, força,
 * torque —, e ERA `Math.random` quem escolhia essas condições. O xorshift do V8 é bom o bastante
 * pra não enviesar uma face, mas é PREVISÍVEL: quem conhecer o estado interno prevê a sequência,
 * e "o mais aleatório possível" não convive com isso. `crypto.getRandomValues` sai da fonte de
 * entropia do sistema, e a física caótica da bandeja amplifica qualquer diferença nas condições
 * iniciais — é a combinação que torna cada arremesso irrepetível.
 *
 * `randomUnit` monta um número em [0, 1) com 53 bits (dois inteiros de 32 bits), a mesma resolução
 * que um `double` tem: com 32 bits só, a orientação inicial ficaria numa grade de 4 bilhões de
 * pontos, que ainda é enorme, mas não há motivo pra jogar precisão fora.
 */
const PALAVRAS = new Uint32Array(2)

export function randomUnit(): number {
  crypto.getRandomValues(PALAVRAS)
  // 26 bits de cima + 27 bits de baixo = 53 bits, o tamanho da mantissa do double.
  const alto = PALAVRAS[0] >>> 6
  const baixo = PALAVRAS[1] >>> 5
  return (alto * 134217728 + baixo) / 9007199254740992
}

export function randomInRange([min, max]: readonly [number, number]): number {
  return min + randomUnit() * (max - min)
}

/**
 * Quaternion uniformemente distribuído em SO(3) (método de Shoemake). Sortear
 * três ângulos de Euler independentes NÃO dá uma orientação inicial
 * uniforme — teria mais probabilidade em certas regiões da esfera de
 * orientações. Isso importa pra não introduzir viés nas condições iniciais
 * do lançamento.
 */
export function randomQuaternion(): [x: number, y: number, z: number, w: number] {
  const u1 = randomUnit()
  const u2 = randomUnit()
  const u3 = randomUnit()
  const sqrt1MinusU1 = Math.sqrt(1 - u1)
  const sqrtU1 = Math.sqrt(u1)

  return [
    sqrt1MinusU1 * Math.sin(2 * Math.PI * u2),
    sqrt1MinusU1 * Math.cos(2 * Math.PI * u2),
    sqrtU1 * Math.sin(2 * Math.PI * u3),
    sqrtU1 * Math.cos(2 * Math.PI * u3)
  ]
}
