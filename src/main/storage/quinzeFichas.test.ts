import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { MAX_PROFILES } from '@shared/types/profile'
// @ts-expect-error — o gerador é JS puro de propósito: ele também roda pela linha de comando, fora
// do app, pra escrever os quinze personagens num `userData`.
import { QUINZE_PERFIS, notesDoPerfil } from '../../../scripts/quinzePerfis.mjs'
// @ts-expect-error — mesma razão do de cima: a segunda leva também roda pela linha de comando.
import { SEGUNDA_LEVA } from '../../../scripts/segundaLeva.mjs'

/**
 * QUINZE PERSONAGENS COM QUINZE FICHAS DIFERENTES — o teto do app (`MAX_PROFILES`) com dado de
 * verdade dentro.
 *
 * `profileIsolation.test.ts` já provou que dois personagens não se misturam. Este vai ao TETO e com
 * fichas DIFERENTES entre si, que é onde as duas coisas que podem dar errado aparecem:
 *
 * 1. VAZAMENTO de conteúdo — a ficha do 12º aparecendo no 3º. Com dois personagens iguais um
 *    vazamento passa despercebido; com quinze fichas de quinze sistemas, cada campo trocado grita;
 * 2. PERDA no teto — o décimo quinto gravado por cima do primeiro, ou o `profiles.json` truncado.
 *
 * O material é o mesmo que `scripts/quinzePerfis.mjs` escreve em disco, então o que este teste
 * exercita é exatamente o que a pessoa recebe se instalar os saves.
 *
 * O passo final joga fora TODAS as instâncias e cria repositórios novos sobre os mesmos arquivos —
 * é o que acontece quando o app fecha e abre no dia seguinte, e é lá que a perda de dado aparece.
 */

const userData = join(tmpdir(), `reroll-quinze-fichas-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { NotesRepository } = await import('./NotesRepository')
const { PresetsRepository } = await import('./PresetsRepository')

interface PerfilDeTeste {
  id: string
  name: string
  system: string
  presets?: { name: string; icon?: string; expression: unknown }[]
}

const PERFIS = QUINZE_PERFIS as PerfilDeTeste[]

function fichaDe(perfil: PerfilDeTeste): ReturnType<typeof notesDoPerfil> {
  return notesDoPerfil(perfil)
}

/** Um trio de repositórios novos sobre os MESMOS arquivos — o app reaberto. */
async function abrirOApp() {
  const profiles = new ProfilesRepository()
  await profiles.init()
  return { profiles, notes: new NotesRepository(profiles), presets: new PresetsRepository(profiles) }
}

afterAll(async () => {
  await fs.rm(userData, { recursive: true, force: true })
})

/**
 * A SEGUNDA LEVA — os quinze com LACUNAS (ver `scripts/segundaLeva.mjs`).
 *
 * O que este bloco vigia é o que a primeira leva não podia: campo VAZIO sobrevivendo à ida e volta
 * do disco. Um sanitizador que "limpa" o que está em branco apagaria justamente o espaço que a
 * pessoa deixou pra preencher no meio da sessão — e o sintoma seria a lacuna sumindo sozinha entre
 * uma abertura do app e outra, que é o tipo de defeito que ninguém consegue reproduzir.
 */
describe('a segunda leva, com lacunas', () => {
  it('tem quinze, com nomes e ids que não colidem com os da primeira', () => {
    const segunda = SEGUNDA_LEVA as PerfilDeTeste[]
    expect(segunda).toHaveLength(MAX_PROFILES)

    const idsDaPrimeira = new Set(PERFIS.map((p) => p.id))
    expect(segunda.filter((p) => idsDaPrimeira.has(p.id))).toEqual([])
  })

  it('as lacunas existem — e não é uma ou outra', () => {
    const campos = (SEGUNDA_LEVA as PerfilDeTeste[]).flatMap((perfil) =>
      fichaDe(perfil).sections.flatMap((secao: { fields: { value: string }[] }) => secao.fields)
    )
    const vazios = campos.filter((campo) => campo.value === '')
    expect(campos.length).toBeGreaterThan(150)
    expect(vazios.length).toBeGreaterThan(20)
  })

  it('campo vazio volta do disco vazio, e não some', async () => {
    const app = await abrirOApp()
    const segunda = SEGUNDA_LEVA as PerfilDeTeste[]
    const lista = segunda.map((perfil, i) => ({
      id: perfil.id,
      name: perfil.name,
      system: perfil.system,
      photo: null,
      createdAt: 100 + i
    }))

    for (const perfil of segunda) {
      await app.profiles.save({ profiles: lista, activeId: perfil.id })
      await app.notes.save(fichaDe(perfil))
    }

    const depois = await abrirOApp()
    for (const perfil of segunda) {
      await depois.profiles.save({ profiles: lista, activeId: perfil.id })
      const ficha = await depois.notes.get()
      expect(ficha.sections, `lacunas do ${perfil.name}`).toEqual(fichaDe(perfil).sections)
    }
  })
})

describe(`${MAX_PROFILES} personagens, cada um com a ficha dele`, () => {
  it('o material de teste tem o tamanho do teto, e nenhuma ficha repetida', () => {
    expect(PERFIS).toHaveLength(MAX_PROFILES)
    // Sistemas podem repetir (duas fichas de Ordem Paranormal é caso real); NOME e ID, não.
    expect(new Set(PERFIS.map((p) => p.id)).size).toBe(MAX_PROFILES)
    expect(new Set(PERFIS.map((p) => p.name)).size).toBe(MAX_PROFILES)
    // E o conteúdo das fichas é distinto de verdade, não quinze cópias com o nome trocado.
    const fichas = PERFIS.map((p) => JSON.stringify(fichaDe(p).sections))
    expect(new Set(fichas).size).toBe(MAX_PROFILES)
  })

  it('grava os quinze e cada um volta com a ficha e os presets DELE, depois de fechar o app', async () => {
    const app1 = await abrirOApp()
    const lista = PERFIS.map((perfil, i) => ({
      id: perfil.id,
      name: perfil.name,
      system: perfil.system,
      photo: null,
      createdAt: i + 1
    }))

    for (const perfil of PERFIS) {
      await app1.profiles.save({ profiles: lista, activeId: perfil.id })
      await app1.notes.save(fichaDe(perfil))
      for (const preset of perfil.presets ?? []) {
        await app1.presets.create(preset as Parameters<typeof app1.presets.create>[0])
      }
    }

    // O app fecha aqui: instâncias novas, mesmos arquivos.
    const app2 = await abrirOApp()
    const estado = await app2.profiles.get()
    expect(estado.profiles).toHaveLength(MAX_PROFILES)

    for (const perfil of PERFIS) {
      await app2.profiles.save({ profiles: estado.profiles, activeId: perfil.id })
      const ficha = await app2.notes.get()
      const esperada = fichaDe(perfil)

      expect(ficha.characterName, `ficha do ${perfil.name}`).toBe(esperada.characterName)
      expect(ficha.sections, `seções do ${perfil.name}`).toEqual(esperada.sections)
      expect(ficha.inventory).toBe(esperada.inventory)
      expect(ficha.backstory).toBe(esperada.backstory)
      expect(ficha.pages).toEqual(esperada.pages)

      const presets = await app2.presets.getAll()
      expect(presets.map((p) => p.name)).toEqual((perfil.presets ?? []).map((p) => p.name))
    }
  })

  it('nenhuma ficha carrega pedaço da ficha de outro personagem', async () => {
    const app = await abrirOApp()
    const estado = await app.profiles.get()

    /**
     * A checagem que pega vazamento sem depender de saber COMO ele aconteceu: todo texto que só
     * existe na ficha de um personagem não pode aparecer na de nenhum outro. "Arasaka" é do
     * netrunner; "Khalmyr" é do anão. Um `store` compartilhado por engano entre perfis põe os dois
     * na mesma ficha, e é assim que se vê.
     */
    const marcas = PERFIS.map((perfil) => ({
      perfil,
      marca: fichaDe(perfil).characterName || perfil.name
    }))

    for (const { perfil } of marcas) {
      await app.profiles.save({ profiles: estado.profiles, activeId: perfil.id })
      const texto = JSON.stringify(await app.notes.get())
      for (const outro of marcas) {
        if (outro.perfil.id === perfil.id) continue
        expect(texto, `a ficha de ${perfil.name} contém "${outro.marca}"`).not.toContain(outro.marca)
      }
    }
  })

  it('cada personagem tem pasta própria em disco, e nenhuma some no caminho', async () => {
    const pastas = await fs.readdir(join(userData, 'profiles'))
    for (const perfil of PERFIS) {
      expect(pastas, `pasta de ${perfil.name}`).toContain(perfil.id)
      const arquivo = join(userData, 'profiles', perfil.id, 'notes.json')
      const gravado = JSON.parse(await fs.readFile(arquivo, 'utf-8'))
      expect(gravado.characterName).toBe(fichaDe(perfil).characterName)
    }
  })
})
