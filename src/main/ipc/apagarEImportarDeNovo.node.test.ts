import { existsSync, promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { abrirPdfDeBytes } from '@renderer/sheets/testes/abrirPdfNoNode'
import { pdfDeUmaPagina, widget } from '@renderer/sheets/testes/pdfDeMentira'

/**
 * APAGAR E SUBIR DE NOVO — pedido do usuário, ao pé da letra: "apaga e upload de novo".
 *
 * O ciclo que uma mesa de verdade faz: importa a ficha, o personagem não ficou como queria (ou a
 * campanha acabou), APAGA o personagem, e importa o MESMO PDF outra vez. O que se exige:
 *
 * 1. a segunda importação é COMPLETA — os mesmos campos, as mesmas seções, os mesmos presets da
 *    primeira. Nada do apagado interfere: a deduplicação de preset por nome, por exemplo, é por
 *    PASTA de personagem, e um personagem novo tem pasta nova;
 * 2. nada do personagem apagado VAZA pro novo — o diário que a pessoa escreveu no primeiro não
 *    aparece no segundo;
 * 3. apagar da lista NÃO apaga a pasta no disco (decisão do app: índice se recupera, dado não) —
 *    e isso não pode contaminar o ciclo.
 *
 * O `sheetApply.test.ts` cobre o outro caminho ("reimportar ATUALIZA"); este cobre o de recomeçar.
 * E vai pelo PDF de verdade — bytes → pdf.js → leitor → montarFicha → canal de IPC —, não por um
 * payload montado à mão, porque o pedido é sobre o fluxo inteiro.
 */

const userData = join(tmpdir(), `reroll-apaga-importa-${process.pid}-${Date.now()}`)
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

function linha(texto: string, y: number, x = 100): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/** Uma ficha fabricada com nome, três atributos e uma arma com dado — o suficiente pro ciclo. */
function fichaFabricada(): Uint8Array {
  const campos: [string, string][] = [
    ['Nome', 'Genoveva'],
    ['Classe', 'Caçadora'],
    ['Força', '14'],
    ['Destreza', '16'],
    ['Vigor', '12'],
    ['Besta pesada', '1d10+2']
  ]
  return pdfDeUmaPagina({
    widgets: campos.map(([nome, valor], i) => {
      const y = 740 - i * 26
      return widget(nome, valor, `[180 ${y} 340 ${y + 18}]`)
    }),
    linhas: campos.map(([nome], i) => linha(nome.toUpperCase(), 743 - i * 26))
  })
}

/** O fluxo inteiro do app: bytes → leitor → conferência → gravação. */
async function importar(): Promise<{ id: string; name: string }> {
  const lido = readSheet(await abrirPdfDeBytes('ficha-genoveva.pdf', fichaFabricada()))
  const aplicar = handlers.get(IpcChannels.sheetsApply)!
  return (await aplicar(null, {
    characterName: lido.characterName,
    system: lido.system,
    notes: montarFicha(lido.fields, lido.rawText),
    presets: lido.presets.map((p) => ({ name: p.name, expression: p.expression }))
  } as never)) as { id: string; name: string }
}

/** Apaga da LISTA, como o app apaga (`ProfilesContext.remove`): a pasta fica, o índice esquece. */
async function apagar(id: string): Promise<void> {
  const estado = await profiles.get()
  const restantes = estado.profiles.filter((p) => p.id !== id)
  await profiles.save({ profiles: restantes, activeId: restantes[0].id })
}

describe.sequential('apagar o personagem e importar o mesmo PDF de novo', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    await profiles.init()
    registerSheetHandlers(profiles, notes, presets)
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('a segunda importação é tão completa quanto a primeira, sem herdar nada da apagada', async () => {
    // PRIMEIRA importação.
    const primeiro = await importar()
    expect(primeiro.name).toBe('Genoveva')

    const fichaAntes = await notes.get()
    const camposAntes = fichaAntes.sections.flatMap((s) => s.fields.map((c) => `${c.label}=${c.value}`))
    const presetsAntes = (await presets.getAll()).map((p) => p.name)
    expect(camposAntes.length).toBeGreaterThanOrEqual(4)
    expect(presetsAntes).toContain('BESTA PESADA')

    // A pessoa USA o personagem: escreve um dia de diário nele.
    const comUso = await notes.get()
    await notes.save({
      ...comUso,
      pages: [{ id: 'dia-1', title: 'Sessão 1', text: 'Genoveva perdeu a besta no rio.', createdAt: 0 }]
    })

    // APAGA — a lista esquece, e a pasta vai pro backup (spec §9.1; ver `backupsDeDados.ts`).
    await apagar(primeiro.id)
    expect((await profiles.get()).profiles.some((p) => p.id === primeiro.id)).toBe(false)
    expect(existsSync(join(userData, 'profiles', primeiro.id))).toBe(false)
    const apagados = await fs.readdir(join(userData, 'backups', 'personagens-apagados'))
    expect(apagados.some((pasta) => pasta.startsWith(`${primeiro.id}-`))).toBe(true)

    // IMPORTA DE NOVO o mesmo PDF.
    const segundo = await importar()
    expect(segundo.name).toBe('Genoveva')
    // É um personagem NOVO, não o fantasma do antigo.
    expect(segundo.id).not.toBe(primeiro.id)
    expect((await profiles.get()).activeId).toBe(segundo.id)

    // Tão completa quanto a primeira: os mesmos campos e os mesmos presets.
    const fichaDepois = await notes.get()
    const camposDepois = fichaDepois.sections.flatMap((s) => s.fields.map((c) => `${c.label}=${c.value}`))
    expect(camposDepois).toEqual(camposAntes)
    expect((await presets.getAll()).map((p) => p.name)).toEqual(presetsAntes)

    // E NADA do apagado vazou: o diário escrito no primeiro não existe no segundo. (A lista de
    // sessões pode vir com uma página vazia de fábrica — o que não pode é vir com o TEXTO dele.)
    expect(fichaDepois.pages.map((p) => p.text).join('')).not.toContain('perdeu a besta')
  }, 60_000)

  it('apagar e importar mais uma vez continua funcionando — o ciclo aguenta repetição', async () => {
    const atual = (await profiles.get()).activeId
    await apagar(atual)
    const terceiro = await importar()
    expect(terceiro.name).toBe('Genoveva')
    const ficha = await notes.get()
    expect(ficha.sections.length).toBeGreaterThan(0)
    expect((await presets.getAll()).map((p) => p.name)).toContain('BESTA PESADA')
  }, 60_000)
})
