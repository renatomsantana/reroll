export type SimboloAssimilacao = 'sucesso' | 'pressao' | 'adaptacao'
export type DadoAssimilacao = 6 | 10 | 12
export interface FaceAssimilacao { sides: DadoAssimilacao; value: number }
export type TotaisAssimilacao = Record<SimboloAssimilacao, number>

// Distribuição conferida no Livro Básico (anatomia dos dados, p. 35) e na
// referência técnica https://dice.erpg.app/pt-br/docs/core/assimilation/.
// A face 4 é só Pressão: a imagem antiga da pasta acrescentava uma Adaptação.
export const FACES_D12: readonly (readonly SimboloAssimilacao[])[] = [
  [], [], ['pressao'], ['pressao'], ['pressao', 'adaptacao'],
  ['sucesso'], ['sucesso', 'sucesso'], ['sucesso', 'adaptacao'],
  ['sucesso', 'adaptacao', 'pressao'], ['sucesso', 'sucesso', 'pressao'],
  ['sucesso', 'adaptacao', 'adaptacao', 'pressao'], ['pressao', 'pressao']
]
export const FACES_D6 = FACES_D12.slice(0, 6)
export const FACES_D10 = FACES_D12.slice(0, 10)
export const TIPOS_ASSIMILACAO = [6, 10, 12] as const

export function dadoAssimilacao(sides: number): sides is DadoAssimilacao {
  return sides === 6 || sides === 10 || sides === 12
}
export function simbolosDaFace(value: number, sides: DadoAssimilacao = 12): readonly SimboloAssimilacao[] {
  if (!dadoAssimilacao(sides) || !Number.isInteger(value) || value < 1 || value > sides) throw new Error(`Face de d${sides} inválida`)
  return FACES_D12[value - 1]
}
export function contarSimbolos(values: readonly (number | FaceAssimilacao)[]): TotaisAssimilacao {
  const total = { sucesso: 0, pressao: 0, adaptacao: 0 }
  for (const face of values) {
    const symbols = typeof face === 'number' ? simbolosDaFace(face) : simbolosDaFace(face.value, face.sides)
    for (const symbol of symbols) total[symbol]++
  }
  return total
}
export function quantidadeSimbolo(n: number, symbol: SimboloAssimilacao): string {
  const words = { sucesso: ['sucesso', 'sucessos'], adaptacao: ['adaptação', 'adaptações'], pressao: ['pressão', 'pressões'] }
  return `${n} ${words[symbol][n === 1 ? 0 : 1]}`
}
export function resumoAssimilacao(values: readonly (number | FaceAssimilacao)[]): string {
  const total = contarSimbolos(values)
  return `${quantidadeSimbolo(total.sucesso, 'sucesso')} · ${quantidadeSimbolo(total.adaptacao, 'adaptacao')} · ${quantidadeSimbolo(total.pressao, 'pressao')}`
}
export function resultadoSimples(total: TotaisAssimilacao): TotaisAssimilacao {
  const evitadas = Math.min(total.adaptacao, total.pressao)
  return { sucesso: total.sucesso, adaptacao: total.adaptacao - evitadas, pressao: total.pressao - evitadas }
}
export function selecionarDados(faces: readonly FaceAssimilacao[], indices: readonly number[], limite: number): FaceAssimilacao[] {
  if (!Number.isInteger(limite) || limite < 1 || indices.length > limite || new Set(indices).size !== indices.length) throw new Error('Seleção de dados inválida')
  return indices.map(index => {
    if (!Number.isInteger(index) || index < 0 || index >= faces.length) throw new Error('Dado desconhecido')
    const face = faces[index]
    simbolosDaFace(face.value, face.sides)
    return face
  })
}
