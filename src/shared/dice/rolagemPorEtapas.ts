import type { DiceGroup, DiceGroupResult, RollResult } from '../types/dice'
import { DEFAULT_DICE_SIDES, MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import {
  avaliarFormula,
  compara,
  escreverFormula,
  type Condicao,
  type ContextoDeAvaliacao,
  type Formula,
  type NoDaFormula,
  type ResultadoDaFormula,
  type TermoAvaliado,
  type TermoDeDado
} from './formula'

/**
 * A BANDEJA FALANDO A GRAMÁTICA — a rolagem por etapas que faz um preset de fórmula rolar de
 * verdade, com dados de verdade caindo na cena.
 *
 * O problema que este módulo resolve: `avaliarFormula` é síncrona e pede faces a uma
 * `FonteDeDados` na hora em que precisa delas; a bandeja 3D é o contrário — ela leva segundos
 * entre o arremesso e o assentamento, e só então diz o que caiu. Ligar as duas por um callback
 * assíncrono espalharia `await` pela gramática inteira, que é um módulo puro e deve continuar puro.
 *
 * A ligação aqui é por REPLAY: a avaliação roda do zero a cada onda, consumindo um DIÁRIO de faces
 * já colhidas, na ordem em que as chamadas acontecem — que é determinística, porque a árvore é a
 * mesma e a fonte devolve sempre o que o diário manda. Quando o diário acaba no meio de uma
 * chamada, a avaliação para ali e devolve O PEDIDO ("preciso de N dados de X lados"); quem guia a
 * bandeja arremessa exatamente isso, anota as faces que caíram no fim do diário e roda tudo de
 * novo. O prefixo já anotado dá o mesmo resultado de antes — replay —, e a avaliação anda um
 * pedido por vez até terminar.
 *
 * Cada pedido é UMA onda na cena, o mesmo gesto que a explosão já encena ("assentou, algum tirou o
 * máximo? volta pra bandeja e cai de novo"): `2d6r<2` cai como 2d6, e o dado que pede reroll volta
 * sozinho pra segunda queda. Uma fórmula de dois termos (`2d20kl1 + 1d4`) cai em duas levas — os
 * d20 primeiro, o d4 depois —, que é como uma pessoa rolaria na mesa: ataque, depois dano.
 *
 * A ordem das chamadas que o diário reproduz é a de `avaliarFormula`, termo COMPLETO por termo:
 * os dados iniciais do termo, os rerolls dele (um por dado), os elos de explosão dele (um por
 * chamada) — e só então o termo seguinte. É por isso que não existe "pré-busca" dos termos todos
 * numa onda só: as faces do termo 1 decidem quantas chamadas ainda acontecem antes do termo 2, e
 * um diário pré-preenchido entregaria a face errada à chamada errada, em silêncio.
 */

/** Uma face já colhida na cena, com o tipo do dado que a produziu — uma entrada do diário. */
export interface FaceColhida {
  lados: number
  face: number
}

/** "Preciso de `quantidade` dados de `lados` lados" — a próxima onda que a cena deve jogar. */
export interface PedidoDeDados {
  lados: number
  quantidade: number
}

export type PassoDaRolagem =
  | { tipo: 'precisa'; pedido: PedidoDeDados }
  | { tipo: 'pronta'; resultado: Extract<ResultadoDaFormula, { ok: true }> }
  | { tipo: 'falha'; mensagem: string }

/** O diário acabou no meio de uma chamada: falta jogar isto. */
class PrecisaDeDados extends Error {
  constructor(readonly pedido: PedidoDeDados) {
    super(`Faltam ${pedido.quantidade}d${pedido.lados}.`)
  }
}

/**
 * Roda a avaliação sobre o diário e diz onde ela chegou: o próximo pedido, o resultado pronto, ou
 * uma falha (face de tipo errado no diário — um defeito de quem guia, não da pessoa).
 */
export function avancarRolagem(
  formula: Formula,
  faces: readonly FaceColhida[],
  contexto?: Pick<ContextoDeAvaliacao, 'referencia' | 'tetoDeExplosoes'>
): PassoDaRolagem {
  let cursor = 0
  const dados = (lados: number, quantidade: number): number[] => {
    const colhidas: number[] = []
    for (let i = 0; i < quantidade; i += 1) {
      const entrada = faces[cursor]
      if (!entrada) throw new PrecisaDeDados({ lados, quantidade: quantidade - i })
      if (entrada.lados !== lados) {
        // Diário fora de ordem é bug do guia (ver o comentário do módulo) — nunca da fórmula.
        throw new Error(`O diário tem um d${entrada.lados} onde a avaliação pediu um d${lados}.`)
      }
      colhidas.push(entrada.face)
      cursor += 1
    }
    return colhidas
  }

  try {
    const resultado = avaliarFormula(formula, { ...contexto, dados })
    if (!resultado.ok) return { tipo: 'falha', mensagem: resultado.mensagem }
    return { tipo: 'pronta', resultado }
  } catch (causa) {
    if (causa instanceof PrecisaDeDados) return { tipo: 'precisa', pedido: causa.pedido }
    if (causa instanceof Error) return { tipo: 'falha', mensagem: causa.message }
    throw causa
  }
}

/** Os termos de dado da fórmula, NA ORDEM em que a avaliação os visita (esquerda antes de direita). */
export function termosDaFormula(formula: Formula): TermoDeDado[] {
  const termos: TermoDeDado[] = []
  colher(formula.expressao, termos)
  return termos
}

function colher(no: NoDaFormula, termos: TermoDeDado[]): void {
  switch (no.tipo) {
    case 'dado':
      termos.push(no)
      return
    case 'negativo':
      colher(no.de, termos)
      return
    case 'operacao':
      colher(no.esquerda, termos)
      colher(no.direita, termos)
      return
    case 'numero':
    case 'referencia':
      return
  }
}

/** Os dados da fórmula agrupados por tipo — o que a barra mostra como "do que é feita esta rolagem". */
export function gruposDaFormula(formula: Formula): DiceGroup[] {
  const grupos: DiceGroup[] = []
  for (const termo of termosDaFormula(formula)) {
    const existente = grupos.find((g) => g.sides === termo.lados)
    if (existente) existente.count += termo.quantidade
    else grupos.push({ sides: termo.lados, count: termo.quantidade })
  }
  return grupos
}

const TIPOS_DA_BANDEJA = DEFAULT_DICE_SIDES.map((lados) => `d${lados}`).join(', ')

/**
 * A fórmula cabe na bandeja? `null` quando cabe; senão o motivo, escrito pra pessoa.
 *
 * É a régua ÚNICA dos três lugares que aceitam preset de fórmula — o editor, a validação do main
 * process (criação, edição e importação de arquivo) — pra nunca existir um preset gravado que a
 * bandeja não sabe jogar. O que ela confere é o que a rolagem por ondas exige de verdade:
 *
 * - pelo menos um dado (fórmula só de números não é preset);
 * - só tipos que existem como dado físico;
 * - cada TERMO dentro do teto de dados simultâneos, porque cada termo é uma onda — termos somados
 *   podem passar do teto (caem em levas), mas um termo só não tem como ser dividido;
 * - nenhuma referência à ficha: o preset ainda não lê a ficha na hora de rolar (a recusa de sempre,
 *   com a mesma mensagem).
 */
export function conferirFormulaPraBandeja(formula: Formula): string | null {
  const referencia = acharReferencia(formula.expressao)
  if (referencia) {
    return `@${referencia.join('.')} precisa de um valor da ficha, e o preset ainda não lê a ficha na hora de rolar.`
  }
  const termos = termosDaFormula(formula)
  if (termos.length === 0) return 'Um preset precisa de pelo menos um dado.'
  for (const termo of termos) {
    if (!DEFAULT_DICE_SIDES.includes(termo.lados)) {
      return `A bandeja não tem d${termo.lados} — tem ${TIPOS_DA_BANDEJA}.`
    }
    if (termo.quantidade > MAX_SIMULTANEOUS_DICE) {
      return `São ${termo.quantidade}d${termo.lados} de uma vez, e a bandeja rola no máximo ${MAX_SIMULTANEOUS_DICE} juntos.`
    }
  }
  return null
}

function acharReferencia(no: NoDaFormula): string[] | null {
  switch (no.tipo) {
    case 'referencia':
      return no.caminho
    case 'negativo':
      return acharReferencia(no.de)
    case 'operacao':
      return acharReferencia(no.esquerda) ?? acharReferencia(no.direita)
    case 'numero':
    case 'dado':
      return null
  }
}

/**
 * O resultado avaliado no formato que o histórico e as telas já entendem.
 *
 * Cada TERMO vira um grupo — e não "um grupo por tipo de dado", como na rolagem de sempre — porque
 * numa fórmula dois termos do mesmo tipo podem ter regras diferentes (`2d6#>=5 + 1d6`), e fundi-los
 * misturaria dados que contam de jeitos diferentes.
 *
 * O que a `DiceExpression` dizia por regras (`keep`, `explode`) aqui vem POR MARCA, dado a dado
 * (`mantidos`, `rerolados`), porque as regras da gramática são por termo e as telas não têm como
 * refazer essa conta — a marca pronta é a única garantia de que o que aparece como "conta" é o que
 * entrou no total. Num termo de contagem (`#`), "conta" quer dizer "satisfez a condição": é isso
 * que o total soma.
 */
export function resultadoParaRollResult(
  formula: Formula,
  resultado: Extract<ResultadoDaFormula, { ok: true }>,
  sourceName?: string
): RollResult {
  const termosDaArvore = termosDaFormula(formula)
  const texto = escreverFormula(formula)

  const groups: DiceGroupResult[] = resultado.termos.map((termo) => {
    const rolls = termo.dados.map((dado) => dado.valor)
    const explodiu = termo.dados.some((dado) => dado.faces.length > 1)
    return {
      sides: termo.lados,
      rolls,
      subtotal: rolls.reduce((soma, valor) => soma + valor, 0),
      ...(explodiu ? { chains: termo.dados.map((dado) => dado.faces) } : {})
    }
  })

  const mantidos = resultado.termos.map((termo, i) =>
    termo.dados.map((dado) => contaProTotal(dado.mantido, dado.valor, termosDaArvore[i]?.contar))
  )
  const rerolados = resultado.termos.map((termo) => termo.dados.map((dado) => dado.rerolado ?? null))
  const houveMarca = mantidos.some((grupo) => grupo.some((marca) => !marca))
  const houveReroll = rerolados.some((grupo) => grupo.some((face) => face !== null))

  return {
    id: crypto.randomUUID(),
    label: texto,
    ...(sourceName !== undefined ? { sourceName } : {}),
    groups,
    modifierTotal: 0,
    total: resultado.total,
    timestamp: Date.now(),
    formulaTexto: texto,
    ...(resultado.sucesso !== undefined ? { sucesso: resultado.sucesso } : {}),
    ...(houveMarca ? { mantidos } : {}),
    ...(houveReroll ? { rerolados } : {})
  }
}

function contaProTotal(mantido: boolean, valor: number, contar: Condicao | undefined): boolean {
  if (!mantido) return false
  if (!contar) return true
  return compara(valor, contar.comparador, contar.alvo)
}

/** Só pra deixar o tipo à mão de quem guia a cena. */
export type { TermoAvaliado }
