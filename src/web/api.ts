/**
 * O `window.api` da versão web: a mesma interface que o preload expõe no Electron
 * (`RolladorApi`), implementada chamando os handlers REAIS do processo principal — registrados no
 * `ipcMain` de mentira do shim (ver `shims/electron.ts`). O renderer não sabe a diferença, e é
 * essa a promessa: a regra que vale no app instalado vale aqui, porque é o mesmo código rodando.
 *
 * O que NÃO passa pelos handlers do main é o que não existe na web:
 *
 * - `windowControls`: não há janela pra minimizar nem ícone de barra de tarefas — tudo vira nada,
 *   de propósito (os botões somem via `web.css`).
 * - `update`: não há o que atualizar — a página servida É sempre a versão atual. O estado fica em
 *   `idle`, que as Preferências já sabem mostrar como "nada a fazer".
 * - `clipboard`: o navegador tem o dele (`navigator.clipboard`).
 */
import { IpcChannels } from '@shared/ipcChannels'
import type { Preset, PresetInput } from '@shared/types/preset'
import type { NotesData } from '@shared/types/notes'
import type { Profile, ProfilesState } from '@shared/types/profile'
import type { PdfEscolhido, SheetApplyPayload } from '@shared/types/sheetImport'
import type { UpdateStatus } from '@shared/types/update'
import type { PacoteImportado } from '@shared/pacote/pacoteDePersonagem'
import type { RolladorApi } from '../renderer/src/types/window'
import { ProfilesRepository } from '../main/storage/ProfilesRepository'
import { NotesRepository } from '../main/storage/NotesRepository'
import { PresetsRepository } from '../main/storage/PresetsRepository'
import { PaginasRepository } from '../main/storage/PaginasRepository'
import { fazerBackupSeMudouDeVersao } from '../main/storage/backupsDeDados'
import { registerProfilesHandlers } from '../main/ipc/registerProfilesHandlers'
import { registerPresetsHandlers } from '../main/ipc/registerPresetsHandlers'
import { registerNotesHandlers } from '../main/ipc/registerNotesHandlers'
import { registerSceneBackgroundHandlers } from '../main/ipc/registerSceneBackgroundHandlers'
import { registerSheetHandlers } from '../main/ipc/registerSheetHandlers'
import { registerPacoteHandlers } from '../main/ipc/registerPacoteHandlers'
import { app, invocarCanal, plataformaDeArquivos } from './shims/electron'
import { promises as fsVirtual } from './shims/fs'

/**
 * "Salvar como" na web termina em download: o handler do main escreveu o arquivo em `/downloads/`
 * do fs virtual (ver o `showSaveDialog` do shim), e aqui ele vira um download de verdade com o
 * mesmo nome. O caminho volta como no desktop — é o que a tela mostra como destino.
 */
async function entregarDownload(caminho: string | null): Promise<string | null> {
  if (!caminho) return null
  const normalizado = caminho.replace(/\\/g, '/')
  if (!normalizado.startsWith('/downloads/')) return caminho
  const conteudo = (await fsVirtual.readFile(normalizado)) as Uint8Array
  plataformaDeArquivos().baixarArquivo(normalizado.slice('/downloads/'.length), conteudo)
  return caminho
}

export async function montarApiWeb(): Promise<RolladorApi> {
  /**
   * A mesma ordem de arranque do `main/index.ts`: backup de versão ANTES de qualquer leitura
   * (spec §8.1 — se esta versão ler errado, o arquivo de antes dela ainda existe), depois os
   * repositórios, depois os handlers.
   */
  await fazerBackupSeMudouDeVersao('/dados', app.getVersion())

  const profiles = new ProfilesRepository()
  await profiles.init()
  const notes = new NotesRepository(profiles)
  const presets = new PresetsRepository(profiles)
  const paginas = new PaginasRepository(profiles)

  registerProfilesHandlers(profiles)
  registerPresetsHandlers(presets)
  registerNotesHandlers(notes)
  registerSceneBackgroundHandlers()
  registerSheetHandlers(profiles, notes, presets, paginas)
  registerPacoteHandlers(profiles, notes, presets, paginas)

  return {
    presets: {
      getAll: () => invocarCanal<Preset[]>(IpcChannels.presetsGetAll),
      create: (input: PresetInput) => invocarCanal<Preset>(IpcChannels.presetsCreate, input),
      update: (id: string, input: PresetInput) => invocarCanal<Preset>(IpcChannels.presetsUpdate, id, input),
      delete: (id: string) => invocarCanal<void>(IpcChannels.presetsDelete, id),
      exportToFile: () => invocarCanal<string | null>(IpcChannels.presetsExport).then(entregarDownload),
      importFromFile: () => invocarCanal<Preset[] | null>(IpcChannels.presetsImport),
      setFavorite: (id: string, favorito: boolean) =>
        invocarCanal<Preset[]>(IpcChannels.presetsSetFavorito, id, favorito),
      moveFavorite: (id: string, direcao: -1 | 1) =>
        invocarCanal<Preset[]>(IpcChannels.presetsMoverFavorito, id, direcao)
    },
    profiles: {
      get: () => invocarCanal<ProfilesState>(IpcChannels.profilesGet),
      save: (state: ProfilesState) => invocarCanal<ProfilesState>(IpcChannels.profilesSave, state),
      pickPhoto: () => invocarCanal<string | null>(IpcChannels.profilesPickPhoto)
    },
    notes: {
      get: () => invocarCanal<NotesData>(IpcChannels.notesGet),
      save: (dados: NotesData) => invocarCanal<NotesData>(IpcChannels.notesSave, dados)
    },
    windowControls: {
      minimize: async () => {},
      maximize: async () => {},
      close: async () => {},
      // O modo compacto na web é só a interface (o renderer troca o layout sozinho); não há
      // janela pra redimensionar junto.
      setCompact: async () => {},
      setAppIcon: async () => {}
    },
    scene: {
      pickBackgroundImage: () => invocarCanal<string | null>(IpcChannels.scenePickBackgroundImage)
    },
    clipboard: {
      writeText: async (texto: string): Promise<boolean> => {
        try {
          await navigator.clipboard.writeText(texto)
          return true
        } catch {
          // Sem permissão (http sem ser localhost, iframe): devolver `false` deixa a tela avisar,
          // como no desktop quando a cópia falha.
          return false
        }
      }
    },
    sheets: {
      pickPdf: () => invocarCanal<PdfEscolhido>(IpcChannels.sheetsPickPdf),
      apply: (payload: SheetApplyPayload) => invocarCanal<Profile>(IpcChannels.sheetsApply, payload),
      paginas: () => invocarCanal<string[]>(IpcChannels.sheetsPaginas)
    },
    pacote: {
      exportar: (dados) => invocarCanal<string | null>(IpcChannels.pacoteExportar, dados).then(entregarDownload),
      importar: () => invocarCanal<PacoteImportado | null>(IpcChannels.pacoteImportar)
    },
    update: {
      getVersion: () => Promise.resolve(app.getVersion()),
      getStatus: () => Promise.resolve<UpdateStatus>({ state: 'idle' }),
      check: async () => {},
      download: async () => {},
      installNow: async () => {},
      onStatus: () => () => {}
    }
  }
}
