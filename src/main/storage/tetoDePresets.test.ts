import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAXIMO_DE_PRESETS_POR_PERSONAGEM } from '@shared/diceRegistry'

/**
 * O TETO DE PRESETS POR PERSONAGEM, cobrado no repositório — onde os três caminhos que gravam
 * preset (editor, importação de arquivo, importação de ficha) se encontram.
 *
 * A revisão de código pegou o teto anterior no lugar errado: só a importação de arquivo era
 * limitada, a 500 por vez, e isso quebrava o ciclo do próprio app — exportar um personagem com 600
 * presets e não conseguir importar o próprio backup —, enquanto o botão de criar continuava sem
 * limite nenhum. Aqui a regra é uma, e é sobre CRESCER: o que já veio do disco acima do teto
 * continua legível e apagável; o que não passa é ganhar mais um.
 */

const userData = join(tmpdir(), `reroll-teste-teto-presets-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { PresetsRepository } = await import('./PresetsRepository')

function preset(nome: string) {
  return { name: nome, expression: { groups: [{ sides: 20, count: 1 }], modifiers: [] } }
}

async function abrir() {
  const profiles = new ProfilesRepository()
  await profiles.init()
  return new PresetsRepository(profiles)
}

describe('teto de presets no repositório', () => {
  beforeEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
    await fs.mkdir(userData, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('importa até o teto de uma vez, e recusa o que passaria dele', async () => {
    const presets = await abrir()
    const lote = Array.from({ length: MAXIMO_DE_PRESETS_POR_PERSONAGEM }, (_, i) => preset(`p${i}`))
    await presets.importMany(lote)
    expect(await presets.getAll()).toHaveLength(MAXIMO_DE_PRESETS_POR_PERSONAGEM)

    await expect(presets.create(preset('mais um'))).rejects.toThrow(/Limite/)
    await expect(presets.importMany([preset('a'), preset('b')])).rejects.toThrow(/Limite/)
    // Nada foi gravado pela metade.
    expect(await presets.getAll()).toHaveLength(MAXIMO_DE_PRESETS_POR_PERSONAGEM)
  })

  it('o que já está acima do teto continua legível e apagável — a regra é sobre crescer', async () => {
    const presets = await abrir()
    // Um `presets.json` restaurado de backup, ou escrito por uma versão em que o teto era outro.
    const acima = Array.from({ length: MAXIMO_DE_PRESETS_POR_PERSONAGEM + 5 }, (_, i) => ({
      id: `id${i}`,
      ...preset(`p${i}`),
      createdAt: 1,
      updatedAt: 1
    }))
    await fs.mkdir(join(userData, 'profiles', 'default'), { recursive: true })
    await fs.writeFile(join(userData, 'profiles', 'default', 'presets.json'), JSON.stringify(acima), 'utf-8')

    expect(await presets.getAll()).toHaveLength(MAXIMO_DE_PRESETS_POR_PERSONAGEM + 5)
    await presets.delete('id0')
    expect(await presets.getAll()).toHaveLength(MAXIMO_DE_PRESETS_POR_PERSONAGEM + 4)
    // Editar um que já existe não é crescer.
    await expect(presets.update('id1', preset('renomeado'))).resolves.toMatchObject({ name: 'renomeado' })
  })
})
