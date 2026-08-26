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
const { PaginasRepository } = await import('../storage/PaginasRepository')
const { registerPacoteHandlers, lerPacoteDoArquivo } = await import('./registerPacoteHandlers')
const { IpcChannels } = await import('@shared/ipcChannels')
const { MAX_PROFILES } = await import('@shared/types/profile')
const { TAMANHO_MAXIMO_DO_PACOTE } = await import('@shared/pacote/pacoteDePersonagem')

const profiles = new ProfilesRepository()
const notes = new NotesRepository(profiles)
const presets = new PresetsRepository(profiles)
const paginas = new PaginasRepository(profiles)
/** Uma "página" de mentira: o repositório guarda bytes, não decodifica imagem. */
const PAGINA = `data:image/jpeg;base64,${Buffer.from('JPEG-DA-PAGINA').toString('base64')}`

const FOTO = 'data:image/png;base64,iVBORw0KGgo='
const arquivo = join(userData, 'Matias Oliveira - Reroll.html')

describe('o personagem inteiro num arquivo', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    const inicial = await profiles.init()
    registerPacoteHandlers(profiles, notes, presets, paginas)

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
    await paginas.gravar([PAGINA])
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
    // A página do PDF vai junto, e o HTML mostra a ficha original pro mestre.
    expect(pacote.paginas).toEqual([PAGINA])
    expect(html).toContain('Ficha original (PDF)')
    // O nome sugerido no diálogo é o do personagem.
    expect(dialogoDeSalvar.mock.calls[0][0].defaultPath).toMatch(/Matias Oliveira - Reroll\.html$/)
  })

  it('guarda um exemplo pra olhar no navegador (ESCREVER_PACOTE=1)', async () => {
    // Mesmo esquema de `ESCREVER_PDFS`: o arquivo só nasce quando se pede, e vai pra pasta de testes.
    if (process.env.ESCREVER_PACOTE !== '1') return
    const pasta = join(process.cwd(), 'Fichas RPG', 'testes')
    await fs.mkdir(pasta, { recursive: true })
    await fs.copyFile(arquivo, join(pasta, 'Matias Oliveira - Reroll.html'))
  })

  it('desistir do diálogo não grava nada', async () => {
    dialogoDeSalvar.mockResolvedValueOnce({ canceled: true, filePath: undefined })
    expect(await handlers.get(IpcChannels.pacoteExportar)!(null, { idioma: 'pt-BR' } as never)).toBeNull()
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    expect(await handlers.get(IpcChannels.pacoteImportar)!(null)).toBeNull()
  })

  it('o mesmo nome ATUALIZA o personagem que já existe — a lista não cresce', async () => {
    /**
     * Pedido do usuário: "não precisa criar outro, quero que sempre esteja no limite de 3
     * personagens". Antes de importar, o Matias daqui é mexido (ficha editada, preset a mais) pra
     * provar que o ARQUIVO é a palavra final.
     */
    const antes = await profiles.get()
    await notes.save({ ...(await notes.get()), inventory: 'editado depois de exportar', pages: [] })
    await presets.create({ name: 'Preset que não está no arquivo', formula: '1d4' })

    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [arquivo] })
    const importar = handlers.get(IpcChannels.pacoteImportar)!
    const resultado = (await importar(null)) as {
      perfil: { id: string; name: string; photo: string | null }
      aparencia: unknown
      substituiu: boolean
    }

    expect(resultado.substituiu).toBe(true)
    expect(resultado.perfil.id).toBe(antes.activeId)
    expect(resultado.perfil.name).toBe('Matias Oliveira')
    expect(resultado.perfil.photo).toBe(FOTO)
    expect(resultado.aparencia).toEqual({ diceBodyColor: '#ff0000', trayShape: 'circle' })

    const depois = await profiles.get()
    expect(depois.profiles).toHaveLength(antes.profiles.length)
    expect(depois.activeId).toBe(antes.activeId)

    const ficha = await notes.get()
    expect(ficha.characterName).toBe('Matias Oliveira')
    expect(ficha.inventory).toBe('Faca de mato')
    expect(ficha.sections.map((s) => [s.title, s.fields.map((f) => `${f.label}=${f.value}:${f.roll}`)])).toEqual([
      ['Atributos', ['Agilidade=3:d20']]
    ])
    expect(ficha.recursos.map((r) => `${r.nome} ${r.atual}/${r.maximo}`)).toEqual(['PV 12/40'])
    expect(ficha.pages.map((p) => [p.title, p.text, p.createdAt])).toEqual([['Taverna', 'Primeira missão', 1_700_000_000_000]])

    // Os presets são os DO ARQUIVO — o que foi criado depois de exportar sai, e nada duplica.
    const lista = await presets.getAll()
    expect(lista.map((p) => [p.name, p.favorito])).toEqual([['Faca', undefined], ['Ritual', 0]])
    expect(new Set(lista.map((p) => p.id)).size).toBe(2)
    expect(await paginas.ler()).toEqual([PAGINA])
  })

  /** O mesmo pacote com OUTRO nome — o JSON puro também é aceito, então basta reescrever o campo. */
  async function pacoteRenomeado(nome: string): Promise<string> {
    const pacote = await lerPacoteDoArquivo(arquivo)
    const caminho = join(userData, `${nome}.json`)
    await fs.writeFile(caminho, JSON.stringify({ ...pacote, personagem: { ...pacote.personagem, name: nome } }), 'utf-8')
    return caminho
  }

  it('nome que não existe CRIA um personagem novo, aberto', async () => {
    const antes = await profiles.get()
    const importar = handlers.get(IpcChannels.pacoteImportar)!
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [await pacoteRenomeado('Kieran Vance')] })
    const resultado = (await importar(null)) as { perfil: { id: string; name: string }; substituiu: boolean }

    expect(resultado.substituiu).toBe(false)
    expect(resultado.perfil.name).toBe('Kieran Vance')
    const depois = await profiles.get()
    expect(depois.profiles).toHaveLength(antes.profiles.length + 1)
    expect(depois.activeId).toBe(resultado.perfil.id)
    // A pasta é OUTRA, e a ficha está lá inteira.
    expect((await notes.get()).characterName).toBe('Kieran Vance')
    expect((await presets.getAll()).map((p) => p.name)).toEqual(['Faca', 'Ritual'])
  })

  it('no teto: nome novo é recusado sem tocar em nada; nome que existe ainda atualiza', async () => {
    const importar = handlers.get(IpcChannels.pacoteImportar)!
    // Enche até o teto, com nomes diferentes.
    let n = 0
    while ((await profiles.get()).profiles.length < MAX_PROFILES) {
      dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [await pacoteRenomeado(`Extra ${n++}`)] })
      await importar(null)
    }
    const cheio = await profiles.get()

    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [await pacoteRenomeado('Mais um')] })
    await expect(importar(null)).rejects.toThrow(new RegExp(`Limite de ${MAX_PROFILES} personagens`))
    expect(await profiles.get()).toEqual(cheio)

    // Caixa e espaços não separam: "  kieran VANCE " é o Kieran.
    dialogoDeAbrir.mockResolvedValueOnce({ canceled: false, filePaths: [await pacoteRenomeado('  kieran VANCE ')] })
    const resultado = (await importar(null)) as { perfil: { name: string }; substituiu: boolean }
    expect(resultado.substituiu).toBe(true)
    expect(resultado.perfil.name).toBe('kieran VANCE')
    expect((await profiles.get()).profiles).toHaveLength(MAX_PROFILES)
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
