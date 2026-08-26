import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { app, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { MAX_PROFILES, type Profile } from '@shared/types/profile'
import type { Language } from '@shared/types/idioma'
import { sanearAparencia, type AparenciaDoPersonagem } from '@shared/types/aparencia'
import {
  TAMANHO_MAXIMO_DO_PACOTE,
  extrairPacoteDoTexto,
  lerPacote,
  montarPacote,
  nomeDoArquivoDoPacote,
  type PacoteDePersonagem,
  type PacoteImportado
} from '@shared/pacote/pacoteDePersonagem'
import { htmlDoPacote } from '@shared/pacote/htmlDoPacote'
import { isValidPresetInput } from './registerPresetsHandlers'
import { escolherArquivo, escolherOndeSalvar } from './dialogos'
import type { ProfilesRepository } from '../storage/ProfilesRepository'
import type { NotesRepository } from '../storage/NotesRepository'
import type { PresetsRepository } from '../storage/PresetsRepository'

/**
 * EXPORTAR e IMPORTAR o personagem inteiro — ver o cabeçalho de `pacoteDePersonagem.ts`.
 *
 * Os dois moram no processo principal pelo mesmo motivo da importação de ficha: é aqui que estão o
 * disco e os diálogos, e importar cria três coisas em ordem (perfil, ficha, presets) que precisam
 * acontecer atrás de um `await` só, sem a interface no meio (ver `registerSheetHandlers`).
 *
 * A APARÊNCIA é a exceção que atravessa nos dois sentidos: ela mora no `localStorage` do renderer,
 * que o principal não alcança. Na exportação o renderer manda a dele junto do pedido; na
 * importação o principal devolve a do arquivo, e o renderer grava antes de trocar de personagem.
 */

/** Só a estrutura: os dados vêm dos repositórios. Separado do handler pra ser testado com disco de verdade. */
export async function montarArquivoDoPacote(
  repos: { profiles: ProfilesRepository; notes: NotesRepository; presets: PresetsRepository },
  aparencia: AparenciaDoPersonagem | null,
  idioma: Language,
  versaoDoApp: string
): Promise<{ pacote: PacoteDePersonagem; html: string }> {
  const estado = await repos.profiles.get()
  const perfil = estado.profiles.find((p) => p.id === estado.activeId) ?? estado.profiles[0]
  const pacote = montarPacote({
    perfil,
    ficha: await repos.notes.get(),
    presets: await repos.presets.getAll(),
    aparencia,
    versaoDoApp,
    agora: new Date()
  })
  return { pacote, html: htmlDoPacote(pacote, idioma) }
}

/** A leitura sem o diálogo: teto ANTES de ler (o ponto do teto é não trazer os bytes pra memória), depois o pacote. */
export async function lerPacoteDoArquivo(caminho: string): Promise<PacoteDePersonagem> {
  const info = await fs.stat(caminho)
  if (!info.isFile()) throw new Error('O caminho escolhido não é um arquivo.')
  if (info.size > TAMANHO_MAXIMO_DO_PACOTE) {
    const mb = Math.round(TAMANHO_MAXIMO_DO_PACOTE / (1024 * 1024))
    throw new Error(`Arquivo grande demais para ser um personagem exportado (o limite é ${mb} MB).`)
  }
  const texto = await fs.readFile(caminho, 'utf-8')
  return lerPacote(extrairPacoteDoTexto(texto))
}

/**
 * Cria o personagem a partir do pacote. SEMPRE um personagem novo, mesmo que já exista um com o
 * mesmo nome: o arquivo pode ser uma versão mais velha do que está aqui, e sobrescrever calado o
 * que a pessoa tem seria o pior desfecho. Quem quiser trocar apaga o antigo depois.
 *
 * Tudo ou nada, como a importação de ficha: se a ficha ou os presets falharem depois de o perfil
 * ter sido gravado, a lista volta a ser a de antes e o erro sobe.
 */
export async function importarPacote(
  repos: { profiles: ProfilesRepository; notes: NotesRepository; presets: PresetsRepository },
  pacote: PacoteDePersonagem
): Promise<PacoteImportado> {
  const estado = await repos.profiles.get()
  if (estado.profiles.length >= MAX_PROFILES) {
    throw new Error(`Limite de ${MAX_PROFILES} personagens atingido — apague um antes de importar outro.`)
  }

  const perfil: Profile = {
    id: randomUUID(),
    name: pacote.personagem.name.trim(),
    system: pacote.personagem.system.trim(),
    photo: pacote.personagem.photo,
    createdAt: Date.now()
  }
  await repos.profiles.save({ profiles: [...estado.profiles, perfil], activeId: perfil.id })

  try {
    await repos.notes.save({ ...pacote.ficha, characterName: perfil.name || pacote.ficha.characterName })
    const validos = pacote.presets.filter((preset) => {
      const ok = isValidPresetInput(preset)
      if (!ok) console.warn('Preset do pacote recusado pela validação; importando o resto:', preset)
      return ok
    })
    if (validos.length > 0) await repos.presets.importarPacote(validos)
  } catch (causa) {
    await repos.profiles.save(estado)
    throw causa
  }

  return { perfil, aparencia: pacote.aparencia }
}

export function registerPacoteHandlers(
  profiles: ProfilesRepository,
  notes: NotesRepository,
  presets: PresetsRepository
): void {
  const repos = { profiles, notes, presets }

  ipcMain.handle(IpcChannels.pacoteExportar, async (_event, bruto: unknown): Promise<string | null> => {
    const pedido = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>
    const idioma: Language = pedido.idioma === 'en-US' ? 'en-US' : 'pt-BR'
    const { pacote, html } = await montarArquivoDoPacote(repos, sanearAparencia(pedido.aparencia), idioma, app.getVersion())

    // Pela porta de `dialogos.ts`, que é quem lembra a pasta — ver o cabeçalho de lá.
    const caminho = await escolherOndeSalvar({
      proposito: 'pacote',
      titulo: 'Exportar personagem',
      nomeSugerido: nomeDoArquivoDoPacote(pacote.personagem.name || pacote.ficha.characterName),
      filtros: [{ name: 'Personagem do Reroll', extensions: ['html'] }]
    })
    if (!caminho) return null

    await fs.writeFile(caminho, html, 'utf-8')
    return caminho
  })

  ipcMain.handle(IpcChannels.pacoteImportar, async (): Promise<PacoteImportado | null> => {
    const caminho = await escolherArquivo({
      proposito: 'pacote',
      titulo: 'Importar personagem exportado',
      filtros: [
        { name: 'Personagem do Reroll', extensions: ['html', 'json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    })
    if (!caminho) return null
    return importarPacote(repos, await lerPacoteDoArquivo(caminho))
  })
}
