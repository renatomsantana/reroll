import { MAXIMO_DE_RECURSOS, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO, TETO_DO_VALOR_DE_RECURSO, prenderAtual } from './recursoVital'
import type { SheetImportField } from './sheetImport'

/**
 * As BARRAS que uma ficha importada propõe (spec §3.4: "imported values pre-fill the bars").
 *
 * Os leitores de sistema devolvem os recursos como CAMPOS — "PV atual: 19", "PV máximo: 45" —
 * porque é assim que a ficha os mostra, e a aba Ficha os desenha assim mesmo. Mas a barra da tela de
 * rolagem precisa do PAR, com número dos dois lados. Este é o passo que junta as duas metades, e é
 * função pura de propósito: roda na tela de conferência, onde a pessoa vê e desmarca o que não quer,
 * e é testável sem PDF nenhum.
 *
 * Três formas de par são reconhecidas, porque são as três que as fichas reais trazem:
 *
 * 1. dois campos com o mesmo nome-base e sufixo "atual"/"máximo" (Ordem, Pathfinder, D&D em
 *    português) — ou prefixo "Current"/"Max" (D&D em inglês);
 * 2. um campo só com valor "12/40" (Oblivio, e a Carga de Ordem);
 * 3. só uma das metades preenchida: o máximo sem o atual é a ficha recém-feita (o Matias só tem os
 *    máximos), e vira barra CHEIA, marcada como `atualEmBranco` pra conferência dizer. O atual sem o
 *    máximo vira barra cheia naquele valor.
 *
 * Par com as DUAS metades vazias não vira barra: é o esqueleto de lacunas (ver `sempre` nos
 * leitores), e uma barra 0/0 na tela de rolagem seria ruído. A pessoa acrescenta à mão quando
 * souber o número.
 */
export interface RecursoExtraido {
  nome: string
  atual: number
  maximo: number
  /** O PDF trazia o máximo mas não o atual — a barra começa cheia, e a conferência avisa. */
  atualEmBranco: boolean
}

/** "PV atual", "Sanidade atual", "PE atuais" → base "PV"/"Sanidade"/"PE". */
const SUFIXO_ATUAL = /^(.+?)\s+atua(?:l|is)$/i
/** "PV máximo", "Sanidade máxima", "PE máx." */
const SUFIXO_MAXIMO = /^(.+?)\s+m[áa]x(?:im[oa]s?|\.)?$/i
/** "Current HP", "Max HP", "Maximum Hit Points". */
const PREFIXO_ATUAL = /^current\s+(.+)$/i
const PREFIXO_MAXIMO = /^max(?:imum)?\s+(.+)$/i
/** "HP Current", "HP Max". */
const SUFIXO_ATUAL_EN = /^(.+?)\s+current$/i
const SUFIXO_MAXIMO_EN = /^(.+?)\s+max(?:imum)?$/i
/** "12/40", "12 / 40". */
const PAR_NO_VALOR = /^\s*(\d{1,7})\s*\/\s*(\d{1,7})\s*$/

/** O inteiro no começo do valor ("19", " 19 ", "19 (5 temp)"), ou `null` se não há número ali. */
function numeroDoValor(valor: string): number | null {
  const achado = /^\s*(\d{1,7})(?!\d)/.exec(valor)
  if (!achado) return null
  return Math.min(Number(achado[1]), TETO_DO_VALOR_DE_RECURSO)
}

function metade(label: string): { base: string; lado: 'atual' | 'maximo' } | null {
  const limpo = label.trim()
  for (const [regex, lado] of [
    [SUFIXO_ATUAL, 'atual'],
    [SUFIXO_MAXIMO, 'maximo'],
    [PREFIXO_ATUAL, 'atual'],
    [PREFIXO_MAXIMO, 'maximo'],
    [SUFIXO_ATUAL_EN, 'atual'],
    [SUFIXO_MAXIMO_EN, 'maximo']
  ] as const) {
    const achado = regex.exec(limpo)
    if (achado && achado[1].trim()) return { base: achado[1].trim(), lado }
  }
  return null
}

export function extrairRecursos(campos: SheetImportField[]): RecursoExtraido[] {
  /** Por base em minúsculas, na ordem em que a ficha os mostra. */
  const pares = new Map<string, { nome: string; atual: number | null; maximo: number | null }>()
  const chave = (base: string): string => base.toLowerCase()

  for (const campo of campos) {
    const parNoValor = PAR_NO_VALOR.exec(campo.value)
    if (parNoValor) {
      const nome = campo.label.trim()
      if (!nome) continue
      const maximo = Math.min(Number(parNoValor[2]), TETO_DO_VALOR_DE_RECURSO)
      pares.set(chave(nome), { nome, atual: Math.min(Number(parNoValor[1]), TETO_DO_VALOR_DE_RECURSO), maximo })
      continue
    }

    const lado = metade(campo.label)
    if (!lado) continue
    const existente = pares.get(chave(lado.base)) ?? { nome: lado.base, atual: null, maximo: null }
    const numero = numeroDoValor(campo.value)
    // A PRIMEIRA leitura de cada metade vale: um leitor que repita o campo (o genérico por baixo
    // do dedicado) não sobrescreve o que o dedicado já disse.
    if (lado.lado === 'atual' && existente.atual === null) existente.atual = numero
    if (lado.lado === 'maximo' && existente.maximo === null) existente.maximo = numero
    pares.set(chave(lado.base), existente)
  }

  const recursos: RecursoExtraido[] = []
  for (const par of pares.values()) {
    if (recursos.length >= MAXIMO_DE_RECURSOS) break
    if (par.atual === null && par.maximo === null) continue
    const maximo = par.maximo ?? par.atual ?? 0
    const atualEmBranco = par.atual === null
    recursos.push({
      nome: par.nome.slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO),
      maximo,
      atual: prenderAtual(par.atual ?? maximo, maximo),
      atualEmBranco
    })
  }
  return recursos
}
