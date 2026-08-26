import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * EXPORTAR e IMPORTAR o personagem inteiro, com disco de verdade: os repositórios gravam num
 * diretório temporário, os diálogos nativos são substituídos por caminhos fixos, e o teste captura
 * os handlers registrados no `ipcMain` — o mesmo desenho de `sheetApply.test.ts`.
 *
 * O roteiro é o do usuário: exportar aqui, "levar pra outro PC" (importar de volta) e conferir que
 * NADA se perdeu — ficha, diário, barras, presets com a estrela, foto, aparência.
 */
const userData = join(tmpdir(), `reroll-teste-pacote-${process.pid}-${Date.now()}`)
const handlers = new Map<string, (evento: unknown, ...args: never[]) => Promise<unknown>>()
const dialogoDeSalvar = vi.fn()
const dialogoDeAbrir = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => userData, getVersion: () => '1.1.0-teste' },
  ipcMain: {
    handle: (canal: string, fn: (evento: unknown, ...args: never[]) => Promise<unknown>) => {
      handlers.set(canal, fn)
    }
  },
  dialog: { showOpenDialog: dialogoDeAbrir, showSaveDialog: dialogoDeSalvar }
}))

const { ProfilesRepository } = await import('../storage/ProfilesRepository')
const { NotesRepository } = await import('../storage/NotesRepository')
const { PresetsRepository } = await import('../storage/PresetsRepository')
const { registerPacoteHandlers, lerPacoteDoArquivo } = await import('./registerPacoteHandlers')
const { IpcChannels } = await import('@shared/ipcChannels')
const { MAX_PROFILES } = await import('@shared/types/profile')
const { TAMANHO_MAXIMO_DO_PACOTE } = await import('@shared/pacote/pacoteDePersonagem')

const profiles = new ProfilesRepository()
const notes = new NotesRepository(profiles)
const presets = new PresetsRepository(profiles)

const FOTO = 'data:image/png;base64,iVBORw0KGgo='
const arquivo = join(userData, 'Matias Oliveira - Reroll.html')

describe('o personagem inteiro num arquivo', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    const inicial = await profiles.init()
    registerPacoteHandlers(profiles, notes, presets)

    // O personagem que vai viajar: nome, sistema, foto, ficha com seção/barra/diário, dois presets.
    await profiles.save({
      profiles: [{ ...inicial.profiles[0], name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: FOTO }],
      activeId: inicial.profiles[0].id
    })
    const ficha = await notes.get()
    await notes.save({
      ...ficha,
      characterName: 'Matias Oliveira',
      inventory: 'Faca de mato',
      sections: [{ id: 's1', title: 'Atributos', fields: [{ id: 'c1', label: 'Agilidade', value: '3', roll: 'd20' }] }],
      recursos: [{ id: 'r1', nome: 'PV', atual: 12, maximo: 40 }],
      pages: [{ id: 'd1', title: 'Taverna', text: 'Primeira missão', createdAt: 1_700_000_000_000 }]
    })
    await presets.create({ name: 'Faca', expression: { groups: [{ sides: 20, count: 2 }], modifiers: [] } })
    const ritual = await presets.create({ name: 'Ritual', formula: '3d6 + 2' })
    await presets.setFavorito(ritual.id, true)
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('exporta o personagem aberto num HTML com a aparência que o renderer mandou', async () => {
    dialogoDeSalvar.mockResolvedValueOnce({ canceled: false, filePath: arquivo })
    const exportar = handlers.get(IpcChannels.pacoteExportar)!
    const caminho = await exportar(null, { aparencia: { diceBodyColor: '#ff0000', trayShape: 'circle', idioma: 'lixo' }, idioma: 'pt-BR' } as never)
    expect(caminho).toBe(arquivo)

    const html = await fs.readFile(arquivo, 'utf-8')
    expect(html).toContain('<h1>Matias Oliveira</h1>')
    expect(html).toContain('Exportado do Reroll 1.1.0-teste')
    expect(html).toContain('<script id="reroll-personagem" type="application/json">')

    const pacote = await lerPacoteDoArquivo(arquivo)
    expect(pacote.personagem).toEqual({ name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: FOTO })
    expect(pacote.presets.map((p) => [p.name, p.favorito])).toEqual([['Faca', undefined], ['Ritual', 0]])
    expect(pacote.aparencia).toEqual({ diceBodyColor: '#ff0000', trayShape: 'circle' })
    // O nome sugerido no diálogo é o do personagem.
    expect(dialogoDeSalvar.mock.calls[0][0].defaultPath).toMatch(/Matias Oliveira - Reroll\.html$/)
  })

  it('desistir do diálogo não grava nada', async () => {
    dialogoDeSalvar.mockResolvedValueOnce({ canceled: true, filePath: undefined })
    expect(await handlers.get(IpcChannels.pacoteExportar)!(null, { idioma: 'pt-BR' } as never)).toBeNull()
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await handlers.get(IpcChannels.pacoteImportar)!(null)).toBeNull()
  })

  it('importa como personagem NOVO, aberto, com tudo o que tinha', async () => {
    const antes = await profiles.get()
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [arquivo] })
    const importar = handlers.get(IpcChannels.pacoteImportar)!
    const resultado = (await importar(null)) as { perfil: { id: string; name: string; photo: string | null }; aparencia: unknown }

    expect(resultado.perfil.name).toBe('Matias Oliveira')
    expect(resultado.perfil.photo).toBe(FOTO)
    expect(resultado.perfil.id).not.toBe(antes.activeId)
    expect(resultado.aparencia).toEqual({ diceBodyColor: '#ff0000', trayShape: 'circle' })

    const depois = await profiles.get()
    expect(depois.profiles).toHaveLength(antes.profiles.length + 1)
    expect(depois.activeId).toBe(resultado.perfil.id)

    // A pasta é OUTRA (o ativo mudou), e a ficha está lá inteira.
    const ficha = await notes.get()
    expect(ficha.characterName).toBe('Matias Oliveira')
    expect(ficha.inventory).toBe('Faca de mato')
    expect(ficha.sections.map((s) => [s.title, s.fields.map((f) => `${f.label}=${f.value}:${f.roll}`)])).toEqual([
      ['Atributos', ['Agilidade=3:d20']]
    ])
    expect(ficha.recursos.map((r) => `${r.nome} ${r.atual}/${r.maximo}`)).toEqual(['PV 12/40'])
    expect(ficha.pages.map((p) => [p.title, p.text, p.createdAt])).toEqual([['Taverna', 'Primeira missão', 1_700_000_000_000]])

    const lista = await presets.getAll()
    expect(lista.map((p) => [p.name, p.favorito])).toEqual([['Faca', undefined], ['Ritual', 0]])
    // Ids novos: o pacote não carrega id nenhum, então dois imports não colidem.
    expect(new Set(lista.map((p) => p.id)).size).toBe(2)
  })

  it('recusa no teto de personagens, sem tocar em nada', async () => {
    const importar = handlers.get(IpcChannels.pacoteImportar)!
    // Enche até o teto.
    while ((await profiles.get()).profiles.length < MAX_PROFILES) {
      dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [arquivo] })
      await importar(null)
    }
    const cheio = await profiles.get()
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [arquivo] })
    await expect(importar(null)).rejects.toThrow(new RegExp(`Limite de ${MAX_PROFILES} personagens`))
    expect(await profiles.get()).toEqual(cheio)
  })

  it('recusa o que não é pacote, e o que é grande demais, ANTES de ler', async () => {
    const qualquer = join(userData, 'qualquer.html')
    await fs.writeFile(qualquer, '<html><body>uma página qualquer</body></html>', 'utf-8')
    await expect(lerPacoteDoArquivo(qualquer)).rejects.toThrow(/não é um personagem exportado/)

    const gordo = join(userData, 'gordo.html')
    await fs.writeFile(gordo, '')
    await fs.truncate(gordo, TAMANHO_MAXIMO_DO_PACOTE + 1)
    await expect(lerPacoteDoArquivo(gordo)).rejects.toThrow(/grande demais/)

    await expect(lerPacoteDoArquivo(userData)).rejects.toThrow(/não é um arquivo/)
  })
})
