import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MAXIMO_DE_PAGINAS_GUARDADAS, TAMANHO_MAXIMO_DE_UMA_PAGINA, paginasValidas } from '@shared/types/paginasDaFicha'

/**
 * As páginas do PDF na pasta do personagem (ver `paginasDaFicha.ts`), com disco de verdade: gravar
 * substitui, ler devolve na ordem, trocar de personagem troca a pasta, e o que não é imagem cai.
 */
const userData = join(tmpdir(), `reroll-teste-paginas-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: () => undefined },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
}))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { PaginasRepository } = await import('./PaginasRepository')

const profiles = new ProfilesRepository()
const paginas = new PaginasRepository(profiles)

// Um JPEG de mentira: o repositório não decodifica imagem, só guarda os bytes.
const JPEG = `data:image/jpeg;base64,${Buffer.from('JPEG-DA-PAGINA-1').toString('base64')}`
const PNG = `data:image/png;base64,${Buffer.from('PNG-DA-PAGINA-2').toString('base64')}`

describe('as páginas do PDF na pasta do personagem', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    await profiles.init()
  })
  afterAll(() => fs.rm(userData, { recursive: true, force: true }))

  it('grava na pasta do personagem ativo, numeradas, e lê de volta na ordem', async () => {
    expect(await paginas.ler()).toEqual([])
    expect(await paginas.gravar([JPEG, PNG])).toBe(2)
    const pasta = profiles.activeDirectory()
    expect((await fs.readdir(pasta)).filter((n) => n.startsWith('pagina-')).sort()).toEqual(['pagina-01.jpg', 'pagina-02.png'])
    expect(await paginas.ler()).toEqual([JPEG, PNG])
  })

  it('gravar de novo SUBSTITUI: reimportar não acumula página', async () => {
    expect(await paginas.gravar([PNG])).toBe(1)
    const pasta = profiles.activeDirectory()
    expect((await fs.readdir(pasta)).filter((n) => n.startsWith('pagina-'))).toEqual(['pagina-01.png'])
    expect(await paginas.ler()).toEqual([PNG])
    expect(await paginas.gravar([])).toBe(0)
    expect(await paginas.ler()).toEqual([])
  })

  it('outro personagem, outra pasta', async () => {
    await paginas.gravar([JPEG])
    const estado = await profiles.get()
    await profiles.save({
      profiles: [...estado.profiles, { id: 'outro', name: 'Outro', system: '', photo: null, createdAt: 2 }],
      activeId: 'outro'
    })
    expect(await paginas.ler()).toEqual([])
    await profiles.save({ ...(await profiles.get()), activeId: estado.activeId })
    expect(await paginas.ler()).toEqual([JPEG])
  })

  it('o que não é imagem embutida, ou passa do teto, cai fora', () => {
    const grande = `data:image/jpeg;base64,${'A'.repeat(TAMANHO_MAXIMO_DE_UMA_PAGINA)}`
    expect(paginasValidas([JPEG, 'https://fora.com/p.jpg', 42, 'data:text/html;base64,PGI+', grande, PNG])).toEqual([JPEG, PNG])
    expect(paginasValidas(Array.from({ length: MAXIMO_DE_PAGINAS_GUARDADAS + 3 }, () => JPEG))).toHaveLength(MAXIMO_DE_PAGINAS_GUARDADAS)
    expect(paginasValidas('não é lista')).toEqual([])
  })
})
