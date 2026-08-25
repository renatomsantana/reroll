import type { RollResult } from '../types/dice'
import { mantidosPorGrupo } from './manterDados'

/**
 * CRÍTICO E FALHA (spec §3.7): o 20 natural e o 1 natural viram EVENTOS — efeito na cena, som,
 * marca no resultado e no histórico.
 *
 * A regra é POR PERSONAGEM, e não do app, porque cada sistema decide de um jeito: D&D e Ordem
 * olham o d20 e o máximo é o crítico; Call of Cthulhu olha o d100 e é o CONTRÁRIO — 01 é o
 * crítico, 100 é a falha (rola-se ABAIXO da perícia). Kids on Bikes não tem crítico nenhum. Uma
 * regra só pra todos daria festa no 20 de um sistema que nem usa d20.
 *
 * O que decide é o dado NATURAL — a face que caiu —, nunca o total com modificador: 19+1 não é
 * crítico em sistema nenhum. E só o dado que CONTA: em vantagem é o mantido; em "3d20 usa o
 * maior" é o maior; num dado explosivo é a PRIMEIRA face da cadeia (o 20 que explodiu, não o 27
 * somado).
 */
export interface RegraDeCritico {
  /** Qual dado o sistema olha pra julgar o teste: 20 em D&D/Ordem, 100 em Cthulhu. */
  lados: number
  /**
   * `alto`: a face MÁXIMA é crítico e o 1 é falha (d20 de D&D). `baixo`: o 1 é crítico e a face
   * máxima é falha (d100 de Cthulhu, rola-se abaixo). `nenhum`: o sistema não tem crítico.
   */
  modo: 'alto' | 'baixo' | 'nenhum'
}

export const REGRA_DE_CRITICO_PADRAO: RegraDeCritico = { lados: 20, modo: 'alto' }

/** Os dados que fazem sentido como "dado de teste" — os mesmos que a bandeja rola. */
export const LADOS_DE_CRITICO = [4, 6, 8, 10, 12, 20, 100] as const

export function normalizarRegraDeCritico(raw: unknown): RegraDeCritico {
  if (!raw || typeof raw !== 'object') return { ...REGRA_DE_CRITICO_PADRAO }
  const entrada = raw as Partial<RegraDeCritico>
  const modo = entrada.modo === 'baixo' || entrada.modo === 'nenhum' ? entrada.modo : 'alto'
  const lados = (LADOS_DE_CRITICO as readonly number[]).includes(entrada.lados as number)
    ? (entrada.lados as number)
    : REGRA_DE_CRITICO_PADRAO.lados
  return { lados, modo }
}

/**
 * A regra que uma ficha IMPORTADA recebe, pelo nome do sistema. Só o que se sabe com certeza:
 * Cthulhu é d100 rola-abaixo; o resto do que o app conhece (D&D, Ordem, Pathfinder) é o d20 de
 * sempre, que já é o padrão. Sistema desconhecido fica no padrão — e a pessoa troca na Ficha.
 */
export function regraDeCriticoDoSistema(system: string): RegraDeCritico {
  if (/cthulhu|coc\b/i.test(system)) return { lados: 100, modo: 'baixo' }
  return { ...REGRA_DE_CRITICO_PADRAO }
}

/**
 * A regra como UM texto ("20:alto", "100:baixo", "nenhum") — o valor de um `<select>` — e de
 * volta. Fica aqui, e não na tela, pra "nenhum" não perder os lados: quem desliga e religa o
 * crítico volta pro d20 padrão, não pra um dado inválido.
 */
export function codigoDaRegra(regra: RegraDeCritico): string {
  return regra.modo === 'nenhum' ? 'nenhum' : `${regra.lados}:${regra.modo}`
}

export function regraDoCodigo(codigo: string): RegraDeCritico {
  if (codigo === 'nenhum') return { lados: REGRA_DE_CRITICO_PADRAO.lados, modo: 'nenhum' }
  const [lados, modo] = codigo.split(':')
  return normalizarRegraDeCritico({ lados: Number(lados), modo })
}

export interface MarcasDeCritico {
  critico: boolean
  falha: boolean
}

/**
 * Houve crítico ou falha nesta rolagem? Olha só os dados do tipo da regra, só os que CONTAM, e só a
 * face natural. Com vários dados (`2d20` sem manter) qualquer um deles basta — e os dois podem
 * acontecer na mesma rolagem, que aí mostra as duas marcas.
 */
export function marcasDeCritico(result: RollResult, regra: RegraDeCritico): MarcasDeCritico {
  const nada = { critico: false, falha: false }
  if (regra.modo === 'nenhum') return nada
  const marcas = result.mantidos ?? (result.keep ? mantidosPorGrupo(result.groups, result.keep) : null)
  let critico = false
  let falha = false
  result.groups.forEach((grupo, gi) => {
    if (grupo.sides !== regra.lados) return
    grupo.rolls.forEach((valor, i) => {
      if (marcas && !marcas[gi][i]) return
      const natural = grupo.chains?.[i]?.[0] ?? valor
      const maximo = natural === regra.lados
      const um = natural === 1
      if (regra.modo === 'alto') {
        critico ||= maximo
        falha ||= um
      } else {
        critico ||= um
        falha ||= maximo
      }
    })
  })
  return { critico, falha }
}

/** O resultado com as marcas gravadas — só quando há alguma, pra rolagem comum não ganhar campo. */
export function comMarcasDeCritico(result: RollResult, regra: RegraDeCritico): RollResult {
  const { critico, falha } = marcasDeCritico(result, regra)
  if (!critico && !falha) return result
  return { ...result, ...(critico ? { critico: true } : {}), ...(falha ? { falha: true } : {}) }
}
