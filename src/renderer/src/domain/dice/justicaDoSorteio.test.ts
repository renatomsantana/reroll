import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DICE_SIDES } from '@shared/diceRegistry'
import { rollExpression, rollWithMode, singleGroupExpression } from './diceEngine'

/**
 * O SORTEIO É JUSTO? — a prova que a spec cobre em dois lugares (5.6 e o aceite da seção 6).
 *
 * Os outros testes do motor conferem intervalo, soma e rótulo. Nenhum deles reprovaria um gerador
 * enviesado: um dado que nunca tira 1 continua devolvendo valores no intervalo, somando certo e
 * rotulando certo. Este arquivo é o que separa "está dentro da faixa" de "cada face sai na mesma
 * proporção".
 *
 * SÃO DUAS PROVAS DIFERENTES, e é importante que sejam, porque nenhuma das duas basta sozinha:
 *
 * 1. A ESTRUTURAL. `rollDie` usa amostragem por rejeição: descarta os valores da ponta que não
 *    dividem o espaço de 32 bits em partes iguais. É essa rejeição que remove o viés de módulo, e é
 *    ela que os testes de "descarte" abaixo verificam DIRETAMENTE, contando quantas vezes o gerador
 *    foi consultado.
 *
 *    Ela precisa ser estrutural porque o viés em questão é ESTATISTICAMENTE INVISÍVEL: com um dado
 *    de 100 lados sobre 32 bits, a divisão ingênua favoreceria 95 das 100 faces em cerca de duas
 *    partes em cem milhões. Nenhuma amostra que caiba num teste — nenhuma amostra que caiba numa
 *    vida — distinguiria isso do acaso. Ou seja: um teste só de distribuição NÃO conseguiria provar
 *    o que este arquivo diz no título, e afirmar que consegue seria a pior espécie de teste, o que
 *    passa dando a impressão errada.
 *
 * 2. A DISTRIBUCIONAL. Qui-quadrado sobre uma amostra grande, que é o que pega defeito de VERDADE:
 *    face que nunca sai, face que sai o dobro, deslocamento de um no mapeamento, quantidade errada
 *    de dados no grupo. É o erro que se comete de fato ao mexer aqui.
 *
 * NENHUM DOS DOIS É INSTÁVEL, e isso é deliberado — teste de dado que falha sozinho de vez em
 * quando é teste que se aprende a ignorar. Ver a nota sobre a semente logo abaixo.
 */

/**
 * Um gerador de 32 bits DETERMINÍSTICO no lugar do `crypto.getRandomValues`.
 *
 * É o que torna o qui-quadrado abaixo reprodutível: mesma semente, mesma sequência, mesmo resultado
 * em toda execução. Um teste de distribuição sobre o gerador de verdade seria aleatório por
 * definição — falharia sozinho a cada tantas execuções, e o custo disso não é o teste vermelho, é
 * a pessoa que passa a ignorar o vermelho.
 *
 * O que se está medindo aqui é o MAPEAMENTO de 32 bits pra 1..N, não a qualidade do `crypto`. A
 * qualidade do `crypto` é responsabilidade do sistema operacional, e não é o que este arquivo
 * consegue (ou deveria tentar) provar.
 *
 * xorshift32, na formulação do Marsaglia. Semente diferente de zero, obrigatoriamente: o estado
 * todo-zero é ponto fixo desta família e devolveria zero pra sempre.
 */
function fonteDeterministica(semente: number): () => number {
  let estado = semente >>> 0
  if (estado === 0) estado = 0x9e3779b9
  return () => {
    estado ^= estado << 13
    estado >>>= 0
    estado ^= estado >>> 17
    estado ^= estado << 5
    estado >>>= 0
    return estado
  }
}

/** Troca o `crypto.getRandomValues` pelos valores que o teste mandar, na ordem. */
function usarFonte(proximo: () => number): void {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((buffer: Uint32Array) => {
    buffer[0] = proximo() >>> 0
    return buffer
  }) as typeof crypto.getRandomValues)
}

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Valores críticos do qui-quadrado a p = 0,001, por grau de liberdade (faces − 1).
 *
 * p = 0,001 e não 0,05: como a sequência é determinística, não existe risco de instabilidade, e o
 * limite frouxo só serve pra deixar passar defeito pequeno. Ficou em 0,001 porque uma semente
 * infeliz num mapeamento CERTO ainda pode dar um qui-quadrado alto — e a semente aqui é escolhida
 * uma vez e vale pra sempre, então o teste ou passa sempre ou falha sempre.
 */
const CRITICO_P0001: Record<number, number> = {
  3: 16.266,
  5: 20.515,
  7: 24.322,
  9: 27.877,
  11: 31.264,
  19: 43.82,
  99: 148.23
}

/** Soma de (observado − esperado)² / esperado sobre todas as faces. */
function quiQuadrado(contagens: number[], total: number): number {
  const esperado = total / contagens.length
  return contagens.reduce((soma, obs) => soma + (obs - esperado) ** 2 / esperado, 0)
}

describe('cada face sai na mesma proporção', () => {
  for (const lados of DEFAULT_DICE_SIDES) {
    it(`d${lados} passa no qui-quadrado`, () => {
      usarFonte(fonteDeterministica(0x5eed + lados))

      // 400 amostras por face: bastante pra o qui-quadrado ter poder, e rápido o suficiente
      // (o d100 é o pior caso, com 40 mil rolagens).
      const total = lados * 400
      const contagens = new Array<number>(lados).fill(0)
      for (let i = 0; i < total; i++) {
        const [valor] = rollExpression(singleGroupExpression(1, lados)).groups[0].rolls
        contagens[valor - 1]++
      }

      // Nenhuma face pode simplesmente não existir — é o defeito de "off by one" no mapeamento,
      // e ele some dentro de um qui-quadrado grande se as outras faces compensarem.
      expect(contagens.every((c) => c > 0)).toBe(true)
      expect(quiQuadrado(contagens, total)).toBeLessThan(CRITICO_P0001[lados - 1])
    })
  }

  it('rolar VÁRIOS dados de uma vez não muda a distribuição de cada um', () => {
    /**
     * `rollGroup` monta o grupo com `Array.from({ length: count })`. Um erro clássico aqui é a
     * função de fábrica receber o ÍNDICE como argumento e ele acabar entrando na conta — o dado 0
     * sairia diferente do dado 3. Rolar 5d20 e jogar todos na mesma contagem pega isso.
     */
    usarFonte(fonteDeterministica(0xd1ce))

    const contagens = new Array<number>(20).fill(0)
    let total = 0
    for (let i = 0; i < 1600; i++) {
      for (const valor of rollExpression(singleGroupExpression(5, 20)).groups[0].rolls) {
        contagens[valor - 1]++
        total++
      }
    }

    expect(total).toBe(8000)
    expect(quiQuadrado(contagens, total)).toBeLessThan(CRITICO_P0001[19])
  })
})

describe('a rejeição que remove o viés de módulo', () => {
  /**
   * O limite que `rollDie` calcula: `0xffffffff − (0xffffffff % lados)`. Tudo abaixo dele é aceito,
   * e a quantidade de valores aceitos é múltiplo exato do número de faces — que é a definição de
   * "sem viés". Tudo dele pra cima é descartado e o gerador é consultado de novo.
   */
  const limiteDe = (lados: number): number => 0xffffffff - (0xffffffff % lados)

  it('o espaço aceito divide as faces em partes exatamente iguais', () => {
    for (const lados of DEFAULT_DICE_SIDES) {
      expect(limiteDe(lados) % lados).toBe(0)
    }
  })

  it('valor na zona de descarte faz sortear DE NOVO em vez de virar face', () => {
    const lados = 100
    const limite = limiteDe(lados)
    // Primeiro um valor descartável, depois um bom. O resultado tem que vir do segundo.
    const valores = [limite, limite + 40, 0xffffffff, 199]
    let i = 0
    const espiao = vi.fn(() => valores[i++])
    usarFonte(espiao)

    const [valor] = rollExpression(singleGroupExpression(1, lados)).groups[0].rolls

    expect(espiao).toHaveBeenCalledTimes(4)
    expect(valor).toBe(100) // 199 % 100 + 1
  })

  it('valor logo ABAIXO do limite é aceito de primeira', () => {
    const lados = 100
    const espiao = vi.fn(() => limiteDe(lados) - 1)
    usarFonte(espiao)

    const [valor] = rollExpression(singleGroupExpression(1, lados)).groups[0].rolls

    expect(espiao).toHaveBeenCalledTimes(1)
    expect(valor).toBe(100)
  })

  it('as pontas do intervalo aparecem: zero vira 1 e o topo vira N', () => {
    for (const lados of DEFAULT_DICE_SIDES) {
      usarFonte(vi.fn(() => 0))
      expect(rollExpression(singleGroupExpression(1, lados)).groups[0].rolls[0]).toBe(1)

      usarFonte(vi.fn(() => lados - 1))
      expect(rollExpression(singleGroupExpression(1, lados)).groups[0].rolls[0]).toBe(lados)
    }
  })
})

describe('o gerador é o do sistema, não o Math.random', () => {
  it('cada dado consome exatamente um sorteio do crypto quando não há descarte', () => {
    /**
     * Não é sobre contagem — é sobre PROVENIÊNCIA. Se alguém trocar `crypto.getRandomValues` por
     * `Math.random()` num refatorar, todo o resto deste arquivo continua passando (o `Math.random`
     * é uniforme o bastante pro qui-quadrado) e só este teste percebe.
     */
    const espiao = vi.fn(() => 7)
    usarFonte(espiao)
    const aleatorio = vi.spyOn(Math, 'random')

    rollExpression(singleGroupExpression(3, 20))

    expect(espiao).toHaveBeenCalledTimes(3)
    expect(aleatorio).not.toHaveBeenCalled()
  })
})

describe('vantagem e desvantagem inclinam pro lado certo', () => {
  /**
   * Aqui a distribuição NÃO deve ser uniforme — é o ponto. O maior de dois d20 tem média 13,825 e o
   * menor tem 7,175 (as duas contas fechadas, não medidas). Um teste de uniformidade neste caminho
   * estaria medindo a coisa errada; o que se verifica é que a inclinação existe e é do tamanho certo.
   *
   * Sem isto, trocar `>=` por `<=` em `rollWithMode` — que é um erro de uma tecla — passaria
   * despercebido: vantagem e desvantagem continuariam devolvendo números plausíveis, só que
   * trocados.
   */
  const media = (valores: number[]): number => valores.reduce((a, b) => a + b, 0) / valores.length

  it('vantagem puxa pra cima, desvantagem pra baixo, e o normal fica no meio', () => {
    usarFonte(fonteDeterministica(0xa11a))

    const amostra = (modo: Parameters<typeof rollWithMode>[2]): number[] =>
      Array.from({ length: 8000 }, () => rollWithMode(1, 20, modo).total)

    const comVantagem = media(amostra('advantage'))
    const normal = media(amostra('normal'))
    const comDesvantagem = media(amostra('disadvantage'))

    // Margem de 0,3 em cima das médias teóricas: folgada o bastante pra semente nenhuma
    // derrubar, apertada o bastante pra pegar a troca de sinal (que erra por 6,65).
    expect(comVantagem).toBeGreaterThan(13.825 - 0.3)
    expect(comVantagem).toBeLessThan(13.825 + 0.3)
    expect(normal).toBeGreaterThan(10.5 - 0.3)
    expect(normal).toBeLessThan(10.5 + 0.3)
    expect(comDesvantagem).toBeGreaterThan(7.175 - 0.3)
    expect(comDesvantagem).toBeLessThan(7.175 + 0.3)
  })

  it('manter o MAIOR de 3d20 puxa mais que a vantagem, como a conta manda', () => {
    /**
     * A regra de Ordem Paranormal. O maior de três d20 tem média 15,4875 — acima dos 13,825 de dois
     * dados, que é o que se espera de mais uma chance.
     */
    usarFonte(fonteDeterministica(0x0dd0))

    const totais = Array.from(
      { length: 8000 },
      () =>
        rollExpression({
          groups: [{ sides: 20, count: 3 }],
          modifiers: [],
          keep: { mode: 'highest', count: 1 }
        }).total
    )

    expect(media(totais)).toBeGreaterThan(15.4875 - 0.3)
    expect(media(totais)).toBeLessThan(15.4875 + 0.3)
  })
})
