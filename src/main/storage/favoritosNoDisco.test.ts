import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it, vi } from 'vitest'

const userData = join(tmpdir(), `reroll-teste-favoritos-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { PresetsRepository } = await import('./PresetsRepository')
const { MAXIMO_DE_FAVORITOS } = await import('@shared/types/preset')

async function abrirApp() {
  const profiles = new ProfilesRepository()
  await profiles.init()
  return new PresetsRepository(profiles)
}

const entrada = (name: string) => ({ name, expression: { groups: [{ count: 1, sides: 20 }], modifiers: [] } })

afterAll(async () => {
  await fs.rm(userData, { recursive: true, force: true })
})

/**
 * A estrela no DISCO (spec §3.9): marcar põe no fim da fileira, desmarcar e apagar reindexam, mover
 * troca com o vizinho, e o teto de seis é cobrado. Reaberto o app, a fileira volta igual.
 */
describe('favoritos no presets.json', () => {
  it('marca no fim da fileira, reindexa ao desmarcar e ao apagar, e mantém tudo ao reabrir', async () => {
    const presets = await abrirApp()
    const a = await presets.create(entrada('Espada'))
    const b = await presets.create(entrada('Arco'))
    const c = await presets.create(entrada('Bola de fogo'))

    await presets.setFavorito(b.id, true)
    await presets.setFavorito(c.id, true)
    let lista = await presets.setFavorito(a.id, true)
    const ordem = (l: { id: string; favorito?: number }[]) => l.filter((p) => p.favorito !== undefined).sort((x, y) => x.favorito! - y.favorito!).map((p) => p.id)
    expect(ordem(lista)).toEqual([b.id, c.id, a.id])

    lista = await presets.setFavorito(c.id, false)
    expect(ordem(lista)).toEqual([b.id, a.id])
    expect(lista.find((p) => p.id === a.id)?.favorito).toBe(1)

    await presets.delete(b.id)
    const reaberto = await abrirApp()
    lista = await reaberto.getAll()
    expect(ordem(lista)).toEqual([a.id])
    expect(lista.find((p) => p.id === a.id)?.favorito).toBe(0)
  })

  it('mover troca com o vizinho e para na ponta', async () => {
    const presets = await abrirApp()
    const todos = await presets.getAll()
    for (const p of todos) await presets.delete(p.id)
    const a = await presets.create(entrada('A'))
    const b = await presets.create(entrada('B'))
    await presets.setFavorito(a.id, true)
    await presets.setFavorito(b.id, true)

    let lista = await presets.moverFavorito(b.id, -1)
    expect(lista.find((p) => p.id === b.id)?.favorito).toBe(0)
    expect(lista.find((p) => p.id === a.id)?.favorito).toBe(1)

    lista = await presets.moverFavorito(b.id, -1)
    expect(lista.find((p) => p.id === b.id)?.favorito).toBe(0)
  })

  it('cobra o teto de favoritos, e marcar de novo quem já é favorito não conta', async () => {
    const presets = await abrirApp()
    const todos = await presets.getAll()
    for (const p of todos) await presets.delete(p.id)
    const criados = []
    for (let i = 0; i < MAXIMO_DE_FAVORITOS + 1; i++) criados.push(await presets.create(entrada(`P${i}`)))
    for (let i = 0; i < MAXIMO_DE_FAVORITOS; i++) await presets.setFavorito(criados[i].id, true)

    await expect(presets.setFavorito(criados[MAXIMO_DE_FAVORITOS].id, true)).rejects.toThrow(/favoritos/)
    await expect(presets.setFavorito(criados[0].id, true)).resolves.toBeTruthy()
  })

  it('a leitura saneia uma estrela escrita à mão', async () => {
    const presets = await abrirApp()
    const todos = await presets.getAll()
    for (const p of todos) await presets.delete(p.id)
    const a = await presets.create(entrada('A'))
    const arquivo = join(userData, 'profiles', 'default', 'presets.json')
    const bruto = JSON.parse(await fs.readFile(arquivo, 'utf-8'))
    bruto[0].favorito = 'sim'
    await fs.writeFile(arquivo, JSON.stringify(bruto))
    const lidos = await (await abrirApp()).getAll()
    expect(lidos.find((p) => p.id === a.id)).not.toHaveProperty('favorito')
  })
})
