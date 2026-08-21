import { existsSync, promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { abrirPdfNoNode } from '@renderer/sheets/testes/abrirPdfNoNode'

/**
 * A importação de ficha DE PONTA A PONTA: do arquivo PDF ao que fica gravado no disco.
 *
 * Os outros testes cobrem cada pedaço — o leitor, a montagem da ficha, o handler que grava —, e cada
 * um deles passa com o pedaço do lado quebrado. Este atravessa tudo com o arquivo de verdade: abre o
 * PDF, escolhe o leitor, monta a ficha como a tela de conferência monta, chama o mesmo handler de
 * IPC que o app chama e depois LÊ DE VOLTA o que foi gravado.
 *
 * É o teste que responde à pergunta que o usuário fez de outro jeito ("preciso que tudo se mantenha
 * salvo"): o que ele vê na conferência é o que fica no personagem?
 */

const userData = join(tmpdir(), `reroll-import-real-${process.pid}-${Date.now()}`)
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

const PASTA = join(process.cwd(), 'Fichas RPG')
const ORDEM = join(PASTA, 'Ordem Paranormal - Ficha de Personagem Editável Matais.pdf')
const KIDS = join(PASTA, 'Ficha Kids on Bikes - Preenchida.pdf')

/** Mesma extração de `extractPdfSheet.ts`; ver a explicação em `fichasReais.node.test.ts`. */

/** O caminho inteiro, como o app faz: ler → interpretar → montar → gravar. */
async function importar(caminho: string) {
  const lido = readSheet(await abrirPdfNoNode(caminho))
  const aplicar = handlers.get(IpcChannels.sheetsApply)!
  const criado = (await aplicar(null, {
    characterName: lido.characterName,
    system: lido.system,
    notes: montarFicha(lido.fields, lido.rawText),
    presets: lido.presets.map((p) => ({ name: p.name, expression: p.expression }))
  } as never)) as { id: string; name: string }
  return { lido, criado }
}

describe.skipIf(!existsSync(ORDEM) || !existsSync(KIDS))('importar ficha de verdade, do PDF ao disco', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    await profiles.init()
    registerSheetHandlers(profiles, notes, presets)
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('Ordem Paranormal: atributos em seção, presets gravados, nome do agente', async () => {
    const { criado } = await importar(ORDEM)
    expect(criado.name).toBe('Matias')

    const ficha = await notes.get()
    expect(ficha.characterName).toBe('Matias')

    // Atributos como SEÇÃO, campo a campo — é o que a ficha desenha em caixa.
    const atributos = ficha.sections.find((s) => s.title === 'Atributos')
    expect(atributos?.fields.map((c) => `${c.label}=${c.value}`)).toEqual([
      'Agilidade=1',
      'Força=3',
      'Intelecto=2',
      'Presença=4',
      'Vigor=2'
    ])
    expect(ficha.sections.find((s) => s.title === 'Recursos')?.fields.length).toBeGreaterThan(0)

    // Os dois presets do ataque: teste e dano, que foi o que o usuário autorizou criar.
    expect((await presets.getAll()).map((p) => p.name)).toEqual([
      'Ataque com Faca (teste)',
      'Ataque com Faca (dano)'
    ])

    /**
     * A REGRA DO MAIOR tem que sobreviver ao disco.
     *
     * É o pedaço mais fácil de perder sem ninguém notar: o preset é gravado por um caminho
     * (`sheets:apply`) e validado por outro (`isValidPresetInput`), e se qualquer um dos dois copiar
     * só `groups` e `modifiers`, o preset volta somando — com o rótulo certo e o total errado.
     */
    const gravados = await presets.getAll()
    expect(gravados.find((p) => p.name.endsWith('(teste)'))!.expression.keep).toEqual({
      mode: 'highest',
      count: 1
    })
    expect(gravados.find((p) => p.name.endsWith('(dano)'))!.expression.keep).toBeUndefined()

    // Nada de nome de campo cru vazando pra ficha gravada.
    const rotulos = ficha.sections.flatMap((s) => s.fields.map((c) => c.label))
    expect(rotulos.some((r) => /^Pericias\.|^Atq|^DEZ$/.test(r))).toBe(false)
  }, 60_000)

  it('Kids on Bikes: o texto sem rótulo fica gravado inteiro na história', async () => {
    const { criado } = await importar(KIDS)
    expect(criado.name).toBe('rodrigo barreto')

    const ficha = await notes.get()
    // Tudo o que a pessoa escreveu na arte tem que estar em algum lugar da ficha gravada.
    for (const escrito of ['11', 'Novo Aluno Misterioso', 'supersticioso', 'd20', '1 - Dinamite']) {
      expect(ficha.backstory).toContain(escrito)
    }
    /**
     * As vantagens que ela mesma nomeou vão pro bloco de HABILIDADES, com o parágrafo inteiro — e não
     * pra uma seção chamada "Ficha", que era o que aparecia na tela e não dizia nada.
     */
    expect(ficha.abilities).toContain('Heróico: Você não precisa da permissão do Mestre')
    expect(ficha.abilities).toContain('ignorar Medos')
    expect(ficha.sections.some((s) => s.title === 'Ficha')).toBe(false)

    /**
     * E o texto solto vem DIVIDIDO por região da página: o que estava numa coluna continua junto, em
     * vez de intercalado com a coluna do lado. Os seis dados dos atributos ficam em bloco.
     */
    const regioes = ficha.backstory.split('\n\n')
    expect(regioes.length).toBeGreaterThan(1)
    expect(regioes.some((r) => r.includes('d20') && r.includes('d4'))).toBe(true)
    expect(regioes.some((r) => r.includes('rodrigo barreto') && r.includes('supersticioso'))).toBe(true)
  }, 60_000)

  it('voltar pro primeiro personagem devolve a ficha dele intacta', async () => {
    /**
     * O pedido literal do usuário: "quando troquei de Matais para Rodrigo todas as informações
     * sumiram". Aqui os dois personagens foram criados por importação de verdade, um depois do
     * outro, e o teste volta pro primeiro pra conferir que nada foi por cima.
     */
    const estado = await profiles.get()
    const matias = estado.profiles.find((p) => p.name === 'Matias')
    expect(matias).toBeDefined()

    await profiles.save({ ...estado, activeId: matias!.id })
    const ficha = await notes.get()
    expect(ficha.characterName).toBe('Matias')
    expect(ficha.sections.find((s) => s.title === 'Atributos')?.fields).toHaveLength(5)
    expect((await presets.getAll()).map((p) => p.name)).toEqual([
      'Ataque com Faca (teste)',
      'Ataque com Faca (dano)'
    ])
    // E a história do Kids on Bikes não vazou pra cá.
    expect(ficha.backstory).not.toContain('Novo Aluno Misterioso')
  }, 60_000)
})
