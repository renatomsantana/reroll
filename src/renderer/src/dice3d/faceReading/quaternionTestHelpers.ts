import type { Vector3Tuple } from '@shared/types/dice3d'

/**
 * Helpers usados só pelos testes (`*.test.ts`). Constrói quaternions artificiais pra forçar uma face
 * específica apontando numa direção, sem depender de simulação física.
 *
 * O `quaternionFromTo` ERA implementado aqui e passou a viver em `orientacaoDeExibicao.ts`, que é
 * produção: o estojo precisa da mesma conta pra deixar cada dado mostrando o maior número. O nome
 * antigo continua exportado daqui porque é por ele que os testes de leitura de face chamam — o que
 * não pode existir é a conta escrita duas vezes, com uma sendo consertada e a outra não.
 */

export { giroDeMenorArco as quaternionFromTo } from './orientacaoDeExibicao'

function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function normalize(v: Vector3Tuple): Vector3Tuple {
  const len = Math.sqrt(dot(v, v))
  return [v[0] / len, v[1] / len, v[2] / len]
}
