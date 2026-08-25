import { describe, expect, it, vi } from 'vitest'

const escrito: string[] = []
const handlers = new Map<string, (evento: unknown, ...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => '' },
  clipboard: { writeText: (texto: string) => escrito.push(texto) },
  ipcMain: { handle: (canal: string, fn: (evento: unknown, ...args: unknown[]) => unknown) => handlers.set(canal, fn) }
}))

const { registerClipboardHandlers, TAMANHO_MAXIMO_DA_COPIA, textoParaCopiar } = await import('./registerClipboardHandlers')
const { IpcChannels } = await import('@shared/ipcChannels')

/**
 * O canal de copiar (spec §3.5): só texto, com teto — a área de transferência é de quem usa o PC,
 * e um renderer com defeito não pode enchê-la com o que não é uma linha de rolagem.
 */
describe('clipboard:writeText', () => {
  it('copia a linha e responde true', () => {
    registerClipboardHandlers()
    const copiar = handlers.get(IpcChannels.clipboardWriteText)!
    expect(copiar(null, '🎲 Percepção: 1d20 + 5 → [12] +5 = **17**')).toBe(true)
    expect(escrito).toEqual(['🎲 Percepção: 1d20 + 5 → [12] +5 = **17**'])
  })

  it('o que não é texto não copia nada e responde false', () => {
    registerClipboardHandlers()
    const copiar = handlers.get(IpcChannels.clipboardWriteText)!
    const antes = escrito.length
    expect(copiar(null, 17)).toBe(false)
    expect(copiar(null, { texto: 'x' })).toBe(false)
    expect(escrito).toHaveLength(antes)
  })

  it('corta no teto', () => {
    expect(textoParaCopiar('a'.repeat(TAMANHO_MAXIMO_DA_COPIA + 100))).toHaveLength(TAMANHO_MAXIMO_DA_COPIA)
    expect(textoParaCopiar(undefined)).toBeNull()
  })
})
