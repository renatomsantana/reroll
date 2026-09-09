import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * DE QUE CANAL esta cópia veio, que é o que decide se o app pode se atualizar sozinho.
 *
 * O teste existe porque a resposta errada é SILENCIOSA nos dois sentidos, e nenhum dos dois
 * aparece aqui na máquina de desenvolvimento:
 *
 * - dizer "não é da Steam" numa cópia que é: o `electron-updater` baixa um instalador NSIS e o roda
 *   por cima de uma pasta que a Steam controla pelo hash de cada arquivo. Na próxima verificação de
 *   integridade ela desfaz tudo, e quem comprou fica num vaivém sem explicação;
 * - dizer "é da Steam" numa cópia que não é: o app instalado pelos amigos nunca mais encontra
 *   versão nova, e ninguém reclama de uma atualização que não aparece.
 *
 * O arquivo é posto pelo `electron-builder.steam.yml` (`extraFiles`), ao lado do executável.
 */

/** Uma pasta que faz as vezes da instalação, com ou sem o `canal.txt` dentro. */
function instalacaoFalsa(canal?: string): string {
  const pasta = mkdtempSync(join(tmpdir(), 'reroll-canal-'))
  if (canal !== undefined) writeFileSync(join(pasta, 'canal.txt'), canal, 'utf8')
  return pasta
}

/**
 * O módulo é recarregado a cada caso de propósito: `ehBuildDaSteam` LÊ O DISCO UMA VEZ e guarda a
 * resposta, então um segundo caso no mesmo módulo estaria medindo o cache do primeiro.
 */
async function ehDaSteamNa(pasta: string): Promise<boolean> {
  vi.resetModules()
  vi.doMock('electron', () => ({
    app: { getPath: () => join(pasta, 'Reroll.exe'), getVersion: () => '1.1.4', isPackaged: true },
    ipcMain: { handle: vi.fn() },
    BrowserWindow: { getAllWindows: () => [] }
  }))
  const { ehBuildDaSteam } = await import('./updater')
  return ehBuildDaSteam()
}

afterEach(() => {
  vi.doUnmock('electron')
})

describe('o canal da cópia', () => {
  it('com `canal.txt` dizendo steam ao lado do executável, é da Steam', async () => {
    await expect(ehDaSteamNa(instalacaoFalsa('steam'))).resolves.toBe(true)
  })

  it('sem arquivo nenhum — instalador, portátil, `npm run dev` — não é', async () => {
    await expect(ehDaSteamNa(instalacaoFalsa())).resolves.toBe(false)
  })

  it('quebra de linha e maiúscula não mudam a resposta: o arquivo é escrito à mão um dia', async () => {
    await expect(ehDaSteamNa(instalacaoFalsa('Steam\r\n'))).resolves.toBe(true)
    await expect(ehDaSteamNa(instalacaoFalsa('  STEAM  '))).resolves.toBe(true)
  })

  it('outro canal escrito ali não vira Steam por engano', async () => {
    await expect(ehDaSteamNa(instalacaoFalsa('itch'))).resolves.toBe(false)
    await expect(ehDaSteamNa(instalacaoFalsa(''))).resolves.toBe(false)
  })
})
