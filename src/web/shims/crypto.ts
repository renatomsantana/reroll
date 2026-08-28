/**
 * O pedaço de `crypto` que o código do processo principal usa: só o `randomUUID` dos ids de
 * personagem, preset e campo de ficha. O navegador já tem o dele (`crypto.randomUUID`, disponível
 * em contexto seguro — https ou localhost, que é onde a versão web roda).
 */
export function randomUUID(): string {
  return globalThis.crypto.randomUUID()
}

export default { randomUUID }
