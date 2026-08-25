import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesData } from '@shared/types/notes'

/**
 * O CANAL DE ANOTAÇÕES CONFERE O QUE GRAVA — achado da revisão de segurança do 1.0.12.
 *
 * `notes:save` era o único canal que escrevia no disco exatamente o que o renderer mandava: sem
 * normalizar e sem teto. Os outros três (presets, perfis, ficha importada) têm cada um a sua
 * conferência. Este arquivo cobra as duas coisas que faltavam, gravando de verdade num `userData`
 * temporário:
 *
 * 1. o que passa do teto é RECUSADO, e o arquivo que estava lá continua intacto — recusar é sempre
 *    melhor que gravar pela metade;
 * 2. o que chega torto é normalizado antes de ir pro disco, e não depois, na leitura.
 */

const userData = join(tmpdir(), `reroll-teste-teto-notas-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { NotesRepository, TETO_DAS_ANOTACOES_EM_BYTES } = await import('./NotesRepository')

async function abrir() {
  const profiles = new ProfilesRepository()
  await profiles.init()
  return new NotesRepository(profiles)
}

function ficha(texto: string): NotesData {
  return {
    characterName: 'Teste',
    attributes: '',
    abilities: '',
    sections: [],
    recursos: [],
    critico: { lados: 20, modo: 'alto' },
    inventory: '',
    appearance: '',
    backstory: '',
    pages: [{ id: 'p1', createdAt: 1, title: 'Sessão', text: texto }],
    currentPage: 0,
    font: '',
    bold: false,
    italic: false,
    underline: false,
    color: ''
  }
}

describe('teto das anotações no repositório', () => {
  beforeEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
    await fs.mkdir(userData, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('grava uma ficha de tamanho normal — e a pesada, também', async () => {
    const notes = await abrir()
    // Um diário de verdade, gordo: 200 KB de texto. Bem abaixo do teto, bem acima do uso comum.
    const gravada = await notes.save(ficha('x'.repeat(200_000)))
    expect(gravada.pages[0].text).toHaveLength(200_000)
    expect((await notes.get()).pages[0].text).toHaveLength(200_000)
  })

  it('RECUSA o que passa do teto, e o que estava no disco continua lá', async () => {
    const notes = await abrir()
    await notes.save(ficha('a ficha de antes'))

    const absurda = ficha('x'.repeat(TETO_DAS_ANOTACOES_EM_BYTES + 1))
    await expect(notes.save(absurda)).rejects.toThrow(/limite/)

    expect((await notes.get()).pages[0].text).toBe('a ficha de antes')
  })

  it('normaliza ANTES de gravar: o que chega torto não chega ao disco torto', async () => {
    const notes = await abrir()
    // `pages` que não é lista e `currentPage` fora do intervalo — o formato de um arquivo editado à
    // mão, agora chegando pelo canal. O disco recebe o formato atual, não o defeito.
    const torta = { ...ficha('ok'), pages: 'não sou lista', currentPage: 99 } as unknown as NotesData
    const gravada = await notes.save(torta)

    expect(Array.isArray(gravada.pages)).toBe(true)
    expect(gravada.pages).toHaveLength(1)
    expect(gravada.currentPage).toBe(0)

    const noDisco = JSON.parse(await fs.readFile(join(userData, 'profiles', 'default', 'notes.json'), 'utf-8'))
    expect(Array.isArray(noDisco.pages)).toBe(true)
    expect(noDisco.currentPage).toBe(0)
  })
})
