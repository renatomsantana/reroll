import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { abrirPdfNoNode } from '@renderer/sheets/testes/abrirPdfNoNode'

/**
 * FERRAMENTA, não teste: sobe fichas em PDF pro REROLL INSTALADO desta máquina — o `userData` de
 * verdade, em `%APPDATA%/reroll` —, pelo MESMO caminho do app (leitor → montarFicha → canal
 * `sheets:apply`, com validação e tudo). Existe pro pedido "upa as fichas novas no Reroll para eu
 * ver": o resultado aparece no seletor de personagens na próxima abertura.
 *
 * Pula sozinho sem a variável — nenhum `npm test` encosta nos dados de ninguém por acidente:
 *
 *     FECHE O REROLL ANTES. Depois:
 *     SUBIR_FICHAS=1 npx vitest run subirFichasNoApp
 *
 * Personagem com o MESMO NOME já existente é pulado (não duplica quem já está lá), e nada aqui
 * apaga coisa alguma — só acrescenta, respeitando o teto de 15 do app.
 */

const LIGADA = process.env.SUBIR_FICHAS === '1'
const userData = join(process.env.APPDATA ?? '', 'reroll')

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

const PASTA = join(process.cwd(), 'Fichas RPG')

/** As fichas a subir — as três novas. Acrescente aqui pra subir outras. */
const FICHAS = ['ficha vincenzo.pdf', 'ficha Go.pdf'].concat(
  readdirSync(PASTA).filter((n) => n.startsWith('Assimila') && n.endsWith('.pdf'))
)

describe.skipIf(!LIGADA || !existsSync(userData))('subir fichas no Reroll instalado', () => {
  it('importa cada PDF como personagem, pulando quem já existe', async () => {
    const profiles = new ProfilesRepository()
    const notes = new NotesRepository(profiles)
    const presets = new PresetsRepository(profiles)
    await profiles.init()
    registerSheetHandlers(profiles, notes, presets)
    const aplicar = handlers.get(IpcChannels.sheetsApply)!

    for (const arquivo of FICHAS) {
      const caminho = join(PASTA, arquivo)
      if (!existsSync(caminho)) {
        console.log(`PULADA (arquivo não existe): ${arquivo}`)
        continue
      }
      const lido = readSheet(await abrirPdfNoNode(caminho))
      const nome = (lido.characterName || arquivo.replace(/\.pdf$/i, '')).trim()

      const existentes = (await profiles.get()).profiles
      if (existentes.some((p) => p.name.trim().toLowerCase() === nome.toLowerCase())) {
        console.log(`PULADA (já existe): ${nome}`)
        continue
      }

      const criado = (await aplicar(null, {
        characterName: nome,
        system: lido.system,
        notes: montarFicha(lido.fields, lido.rawText),
        presets: lido.presets.map((p) => ({ name: p.name, expression: p.expression }))
      } as never)) as { id: string; name: string }
      console.log(`SUBIU: ${criado.name} (${lido.system || 'sistema desconhecido'}) — ${lido.fields.length} campos, ${lido.presets.length} presets`)
      expect(criado.name).toBe(nome)
    }

    const estado = await profiles.get()
    console.log(`Personagens no app agora: ${estado.profiles.length}`)
  }, 300_000)
})
