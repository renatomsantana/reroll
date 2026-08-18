import RAPIER from '@dimforge/rapier3d-compat'

let readyPromise: Promise<typeof RAPIER> | null = null

/**
 * O Rapier compat carrega WASM internamente e exige `init()` antes de usar
 * qualquer classe (`World`, `RigidBodyDesc`, ...). É assíncrono e só pode
 * rodar uma vez por processo — chamar de novo não quebra, mas reinicializar
 * o WASM à toa é desperdício. Guardamos a promise resolvida uma única vez.
 */
export function ensureRapierReady(): Promise<typeof RAPIER> {
  if (!readyPromise) {
    readyPromise = RAPIER.init().then(() => RAPIER)
  }
  return readyPromise
}

export { RAPIER }
