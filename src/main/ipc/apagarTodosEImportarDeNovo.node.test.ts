import { existsSync, readdirSync, promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { abrirPdfNoNode } from '@renderer/sheets/testes/abrirPdfNoNode'

/**
 * O CICLO COMPLETO com as fichas DE VERDADE — pedido do usuário: "apaga todos e testa novamente
 * com as novas fichas".
 *
 * Importa TODAS as fichas preenchidas da pasta (as sete, dos cinco sistemas), confere o que cada
 * uma virou, APAGA TODOS os personagens, e importa tudo de novo. O que se cobra da segunda rodada:
 *
 * 1. cada ficha sai IDÊNTICA à primeira — mesmos campos (rótulo = valor, campo a campo), mesmos
 *    blocos, mesmos presets. Se a segunda difere da primeira, alguma coisa do estado apagado
 *    interferiu, e é exatamente isso que não pode;
 * 2. nada VAZA dos apagados: o diário escrito na primeira rodada não aparece em ninguém da
 *    segunda;
 * 3. as pastas dos apagados FICAM no disco (decisão do app: índice se recupera, dado não).
 *
 * Como todo teste de ficha real, pula sozinho quando os arquivos não existem — eles moram fora do
 * repositório.
 */

const userData = join(tmpdir(), `reroll-apaga-todos-${process.pid}-${Date.now()}`)
const handlers = new Map<string, (evento: unknown, ...args: never[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: {
    handle: (canal: string, fn: (evento: unknown, ...args: never[]) => Promise<unknown>) => {
      handlers.set(canal, fn)
    }
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
}))

// O teto de criação liberado até o do disco: as sete fichas de referência não cabem nos três do
// beta, e o que se testa aqui é o ciclo apagar/reimportar, não o teto (ver `sheetApply.test.ts`).
vi.mock('@shared/types/profile', async (original) => {
  const real = await original<typeof import('@shared/types/profile')>()
  return { ...real, MAX_PROFILES: real.TETO_DE_PERSONAGENS_NO_DISCO }
})

const { ProfilesRepository } = await import('../storage/ProfilesRepository')
const { NotesRepository } = await import('../storage/NotesRepository')
const { PresetsRepository } = await import('../storage/PresetsRepository')
const { registerSheetHandlers } = await import('./registerSheetHandlers')
const { IpcChannels } = await import('@shared/ipcChannels')
const { readSheet } = await import('@renderer/sheets/readers/index')
const { montarFicha } = await import('@shared/types/montarFicha')

const profiles = new ProfilesRepository()
const notes = new NotesRepository(profiles)
const presets = new PresetsRepository(profiles)

const PASTA = join(process.cwd(), 'Fichas RPG')

/** As fichas PREENCHIDAS da pasta, com o que cada uma tem que render — a assinatura de cada sistema. */
const FICHAS: { arquivo: string; nome: string; marca?: { label: string; value?: string }; preset?: string }[] = [
  {
    arquivo: 'Ordem Paranormal - Ficha de Personagem Editável Matais.pdf',
    nome: 'Matias',
    marca: { label: 'Agilidade', value: '1' },
    preset: 'Ataque com Faca (dano)'
  },
  {
    arquivo: 'ficha vincenzo.pdf',
    nome: 'Vincenzo Moretti',
    marca: { label: 'Classe', value: 'Especialista' },
    preset: 'martello (dano)'
  },
  {
    arquivo: 'ficha Go.pdf',
    nome: 'Go',
    marca: { label: 'Destreza', value: '16' }
  },
  {
    arquivo: (existsSync(PASTA) ? readdirSync(PASTA).find((n) => n.startsWith('Assimila') && n.endsWith('.pdf')) : undefined) ?? 'assimilacao-ausente.pdf',
    nome: 'Kieran Saad',
    marca: { label: 'Saúde', value: '18' }
  },
  {
    arquivo: 'Ficha Oblívio - Preenchida.pdf',
    nome: '',
    marca: { label: 'Carne' }
  },
  {
    arquivo: 'Ficha Kids on Bikes - Preenchida.pdf',
    nome: 'rodrigo barreto'
  },
  {
    arquivo: 'ficha Rilver - pf2e.pdf',
    nome: '',
    marca: { label: 'Fortitude' }
  }
]

const TODAS_EXISTEM = FICHAS.every((f) => existsSync(join(PASTA, f.arquivo)))

/** O retrato de um personagem importado: o que compararemos entre a primeira e a segunda rodada. */
interface Retrato {
  id: string
  nome: string
  campos: string[]
  blocos: Record<string, string>
  presets: string[]
}

async function importar(arquivo: string): Promise<Retrato> {
  const lido = readSheet(await abrirPdfNoNode(join(PASTA, arquivo)))
  const aplicar = handlers.get(IpcChannels.sheetsApply)!
  const criado = (await aplicar(null, {
    characterName: lido.characterName || arquivo.replace(/\.pdf$/i, ''),
    system: lido.system,
    notes: montarFicha(lido.fields, lido.rawText),
    presets: lido.presets.map((p) => ({ name: p.name, expression: p.expression }))
  } as never)) as { id: string; name: string }

  const ficha = await notes.get()
  return {
    id: criado.id,
    nome: criado.name,
    campos: ficha.sections.flatMap((s) => s.fields.map((c) => `${s.title}|${c.label}=${c.value}`)),
    blocos: {
      attributes: ficha.attributes,
      abilities: ficha.abilities,
      inventory: ficha.inventory,
      appearance: ficha.appearance,
      backstory: ficha.backstory
    },
    presets: (await presets.getAll()).map((p) => p.name)
  }
}

/** Apaga TODOS: a lista vira um personagem em branco novo, como quem limpou o app. As pastas ficam. */
async function apagarTodos(): Promise<void> {
  await profiles.save({
    profiles: [{ id: `limpo-${Math.random().toString(36).slice(2, 10)}`, name: '', system: '', photo: null, createdAt: 1 }],
    activeId: 'qualquer'
  })
}

describe.skipIf(!TODAS_EXISTEM).sequential('apaga todos e importa as fichas reais de novo', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    await profiles.init()
    registerSheetHandlers(profiles, notes, presets)
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('as sete importam, todo mundo some, e a segunda rodada sai idêntica à primeira', async () => {
    // PRIMEIRA RODADA: as sete fichas, cada uma conferida pela assinatura do sistema dela.
    const primeira = new Map<string, Retrato>()
    for (const ficha of FICHAS) {
      const retrato = await importar(ficha.arquivo)
      primeira.set(ficha.arquivo, retrato)
      if (ficha.nome) expect(retrato.nome, ficha.arquivo).toBe(ficha.nome)
      expect(retrato.nome.trim(), ficha.arquivo).not.toBe('')
      if (ficha.marca) {
        const achado = retrato.campos.find((c) => c.includes(`|${ficha.marca!.label}=`))
        expect(achado, `${ficha.arquivo}: faltou ${ficha.marca.label}`).toBeDefined()
        if (ficha.marca.value) expect(achado, ficha.arquivo).toContain(`=${ficha.marca.value}`)
      }
      if (ficha.preset) expect(retrato.presets, ficha.arquivo).toContain(ficha.preset)
    }
    expect((await profiles.get()).profiles.length).toBe(1 + FICHAS.length)

    // A pessoa USA o último personagem: um dia de diário, que não pode reaparecer depois.
    const comUso = await notes.get()
    await notes.save({
      ...comUso,
      pages: [{ id: 'dia-1', title: 'Sessão 1', text: 'MARCA-DO-DIARIO-DA-PRIMEIRA-RODADA', createdAt: 0 }]
    })

    // APAGA TODOS. As pastas de quem TEVE algo gravado ficam no disco; o índice esquece.
    // (O personagem de fábrica intocado nunca ganhou pasta — pasta nasce na primeira gravação.)
    const idsImportados = [...primeira.values()].map((retrato) => retrato.id)
    await apagarTodos()
    expect((await profiles.get()).profiles.length).toBe(1)
    for (const id of idsImportados) {
      expect(existsSync(join(userData, 'profiles', id)), `pasta de ${id} devia ficar`).toBe(true)
    }

    // SEGUNDA RODADA: tudo de novo, e cada ficha idêntica à primeira leitura.
    for (const ficha of FICHAS) {
      const antes = primeira.get(ficha.arquivo)!
      const depois = await importar(ficha.arquivo)
      expect(depois.id, `${ficha.arquivo}: personagem novo, não o fantasma`).not.toBe(antes.id)
      expect(depois.nome, ficha.arquivo).toBe(antes.nome)
      expect(depois.campos, `${ficha.arquivo}: campos da segunda rodada`).toEqual(antes.campos)
      expect(depois.blocos, `${ficha.arquivo}: blocos da segunda rodada`).toEqual(antes.blocos)
      expect(depois.presets, `${ficha.arquivo}: presets da segunda rodada`).toEqual(antes.presets)
      // Nada do apagado vazou pra cá.
      const fichaNova = await notes.get()
      expect(fichaNova.pages.map((p) => p.text).join(''), ficha.arquivo).not.toContain('MARCA-DO-DIARIO')
    }
    expect((await profiles.get()).profiles.length).toBe(1 + FICHAS.length)
  }, 300_000)
})
