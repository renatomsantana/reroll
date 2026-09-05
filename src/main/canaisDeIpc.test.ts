import { describe, expect, it, vi, type Mock } from 'vitest'

/**
 * O EMBRULHO de `ipcMain.handle` (ver `travarCanaisDeIpc`): registrado uma vez, todo canal passa a
 * conferir o remetente antes de rodar. O teste é sobre o mecanismo: o handler de verdade só é
 * chamado pelo quadro principal da página do app, e um remetente estranho recebe erro sem que nada
 * tenha sido executado.
 */
vi.mock('electron', () => ({
  app: { isPackaged: true, on: vi.fn() },
  ipcMain: { handle: vi.fn() },
  Menu: { setApplicationMenu: vi.fn() },
  session: { defaultSession: {} },
  shell: { openExternal: vi.fn() }
}))

const { ipcMain } = await import('electron')
const { travarCanaisDeIpc } = await import('./seguranca')

describe('o embrulho dos canais de IPC', () => {
  it('atende o quadro principal da página do app e recusa o resto, sem rodar o handler', () => {
    const registrarOriginal = ipcMain.handle as unknown as Mock
    travarCanaisDeIpc()

    const ouvinte = vi.fn(() => 42)
    ipcMain.handle('canal:teste', ouvinte)
    expect(registrarOriginal).toHaveBeenCalledTimes(1)
    const [canal, embrulhado] = registrarOriginal.mock.calls[0] as [string, (evento: unknown, ...args: unknown[]) => unknown]
    expect(canal).toBe('canal:teste')

    const principal = { url: 'file:///D:/Reroll/resources/app.asar/out/renderer/index.html' }
    expect(embrulhado({ senderFrame: principal, sender: { mainFrame: principal } }, 1, 2)).toBe(42)
    expect(ouvinte).toHaveBeenCalledWith(expect.anything(), 1, 2)

    const estranho = { url: 'https://site-de-alguem.net/' }
    expect(() => embrulhado({ senderFrame: estranho, sender: { mainFrame: estranho } }, 1)).toThrow(/recusado/)
    expect(() => embrulhado({ senderFrame: null, sender: { mainFrame: principal } }, 1)).toThrow(/recusado/)
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })
})
