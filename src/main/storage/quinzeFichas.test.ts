import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { TETO_DE_PERSONAGENS_NO_DISCO } from '@shared/types/profile'
// @ts-expect-error — o gerador é JS puro de propósito: ele também roda pela linha de comando, fora
// do app, pra escrever os quinze personagens num `userData`.
import { QUINZE_PERFIS, notesDoPerfil } from '../../../scripts/quinzePerfis.mjs'
// @ts-expect-error — mesma razão do de cima: a segunda leva também roda pela linha de comando.
import { SEGUNDA_LEVA } from '../../../scripts/segundaLeva.mjs'
// @ts-expect-error — a terceira leva, a pesada: muito texto, muitos campos, muitas sessões.
import { TERCEIRA_LEVA } from '../../../scripts/terceiraLeva.mjs'
// @ts-expect-error — a quarta leva: ficha completa, com foto nos três formatos aceitos.
import { QUARTA_LEVA } from '../../../scripts/quartaLeva.mjs'

/**
 * QUINZE PERSONAGENS COM QUINZE FICHAS DIFERENTES — o teto do app (`TETO_DE_PERSONAGENS_NO_DISCO`) com dado de
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
    expect(segunda).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)

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

/**
 * A TERCEIRA LEVA — VOLUME, e principalmente SESSÕES.
 *
 * O pedido do usuário foi direto: "coloca sessões, troca perfis para ver se as sessões se mantêm".
 * O diário é o que mais dói perder, porque é escrito durante o jogo e não existe em lugar nenhum
 * além dali — e é também o que mais cresce: quinze personagens com cinco sessões cada são setenta e
 * três páginas de texto num `notes.json` por personagem.
 *
 * A troca de personagem é simulada como o app faz: gravar `activeId` e ler de novo. O que se cobra
 * é que a página escrita na sessão 3 do décimo personagem continue lá depois de passar por todos os
 * outros e voltar.
 */
describe('a terceira leva: volume e sessões que sobrevivem à troca de perfil', () => {
  const TERCEIRA = TERCEIRA_LEVA as PerfilDeTeste[]

  it('tem volume de verdade: campos, sessões e texto', () => {
    expect(TERCEIRA).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)
    const fichas = TERCEIRA.map(fichaDe)
    const campos = fichas.reduce(
      (soma: number, ficha: { sections: { fields: unknown[] }[] }) =>
        soma + ficha.sections.reduce((s: number, secao) => s + secao.fields.length, 0),
      0
    )
    const sessoes = fichas.reduce((soma: number, ficha: { pages: unknown[] }) => soma + ficha.pages.length, 0)
    const texto = fichas.reduce(
      (soma: number, ficha: { backstory: string; inventory: string; pages: { text: string }[] }) =>
        soma + ficha.backstory.length + ficha.inventory.length + ficha.pages.reduce((t, p) => t + p.text.length, 0),
      0
    )

    expect(campos).toBeGreaterThan(400)
    expect(sessoes).toBeGreaterThan(60)
    expect(texto).toBeGreaterThan(20_000)
  })

  it('as sessões de cada um continuam lá depois de passar por todos os outros', async () => {
    const app = await abrirOApp()
    const lista = TERCEIRA.map((perfil, i) => ({
      id: perfil.id,
      name: perfil.name,
      system: perfil.system,
      photo: null,
      createdAt: 500 + i
    }))

    for (const perfil of TERCEIRA) {
      await app.profiles.save({ profiles: lista, activeId: perfil.id })
      await app.notes.save(fichaDe(perfil))
    }

    // A volta inteira, personagem por personagem, na ordem inversa — e depois um segundo passe.
    for (const ordem of [[...TERCEIRA].reverse(), TERCEIRA]) {
      for (const perfil of ordem) {
        await app.profiles.save({ profiles: lista, activeId: perfil.id })
        const ficha = await app.notes.get()
        const esperada = fichaDe(perfil)

        expect(ficha.pages, `sessões de ${perfil.name}`).toEqual(esperada.pages)
        // O texto longo também: bloco truncado é a outra forma de perder sessão.
        expect(ficha.backstory).toBe(esperada.backstory)
        expect(ficha.inventory).toBe(esperada.inventory)
      }
    }
  })

  it('escrever numa sessão de um personagem não mexe na do outro', async () => {
    const app = await abrirOApp()
    const [primeiro, segundo] = TERCEIRA
    const estado = await app.profiles.get()

    await app.profiles.save({ profiles: estado.profiles, activeId: primeiro.id })
    const antes = await app.notes.get()
    await app.notes.save({
      ...antes,
      pages: [...antes.pages, { id: 'nova', createdAt: 1, title: 'Sessão nova', text: 'Escrita durante o jogo.' }]
    })

    await app.profiles.save({ profiles: estado.profiles, activeId: segundo.id })
    const doSegundo = await app.notes.get()
    expect(doSegundo.pages).toEqual(fichaDe(segundo).pages)
    expect(JSON.stringify(doSegundo)).not.toContain('Escrita durante o jogo')

    await app.profiles.save({ profiles: estado.profiles, activeId: primeiro.id })
    const doPrimeiro = await app.notes.get()
    expect(doPrimeiro.pages).toHaveLength(fichaDe(primeiro).pages.length + 1)
    expect(doPrimeiro.pages.at(-1)?.title).toBe('Sessão nova')
  })
})

/**
 * A QUARTA LEVA — ficha COMPLETA e FOTO em todos (ver `scripts/quartaLeva.mjs`).
 *
 * O que ela testa que as outras não podiam: a foto atravessando a fronteira que a revisão de
 * segurança acabou de cercar. `normalizeProfiles` só aceita imagem embutida (PNG/JPEG/WebP) — as
 * quinze vêm nos três formatos de propósito, e a ida e volta pelo repositório tem que devolver cada
 * uma inteira. Foto que some no caminho é o personagem aparecendo como "sem foto" depois de a
 * pessoa ter escolhido uma.
 */
describe('a quarta leva: ficha completa, com foto', () => {
  const QUARTA = QUARTA_LEVA as (PerfilDeTeste & { photo: string })[]

  it('tem quinze, todos com foto, nos três formatos', () => {
    expect(QUARTA).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)
    const formatos = new Set(QUARTA.map((p) => p.photo.slice(11, 15)))
    expect(QUARTA.every((p) => p.photo.startsWith('data:image/'))).toBe(true)
    expect([...formatos].sort()).toEqual(['jpeg', 'png;', 'webp'])
  })

  it('nenhum campo de ficha fica vazio — é a leva do personagem em dia', () => {
    const vazios = QUARTA.flatMap((perfil) =>
      fichaDe(perfil).sections.flatMap((secao: { fields: { label: string; value: string }[] }) =>
        secao.fields.filter((campo) => campo.value === '').map((campo) => `${perfil.name}: ${campo.label}`)
      )
    )
    expect(vazios).toEqual([])
  })

  it('a foto vai e volta inteira pelo repositório de perfis, nos três formatos', async () => {
    const app = await abrirOApp()
    const lista = QUARTA.map((perfil, i) => ({
      id: perfil.id,
      name: perfil.name,
      system: perfil.system,
      photo: perfil.photo,
      createdAt: 900 + i
    }))
    await app.profiles.save({ profiles: lista, activeId: QUARTA[0].id })

    const depois = await abrirOApp()
    const estado = await depois.profiles.get()
    for (const perfil of QUARTA) {
      const gravado = estado.profiles.find((p) => p.id === perfil.id)
      expect(gravado?.photo, `foto de ${perfil.name}`).toBe(perfil.photo)
    }
  })
})

describe(`${TETO_DE_PERSONAGENS_NO_DISCO} personagens, cada um com a ficha dele`, () => {
  it('o material de teste tem o tamanho do teto, e nenhuma ficha repetida', () => {
    expect(PERFIS).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)
    // Sistemas podem repetir (duas fichas de Ordem Paranormal é caso real); NOME e ID, não.
    expect(new Set(PERFIS.map((p) => p.id)).size).toBe(TETO_DE_PERSONAGENS_NO_DISCO)
    expect(new Set(PERFIS.map((p) => p.name)).size).toBe(TETO_DE_PERSONAGENS_NO_DISCO)
    // E o conteúdo das fichas é distinto de verdade, não quinze cópias com o nome trocado.
    const fichas = PERFIS.map((p) => JSON.stringify(fichaDe(p).sections))
    expect(new Set(fichas).size).toBe(TETO_DE_PERSONAGENS_NO_DISCO)
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
    expect(estado.profiles).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)

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
