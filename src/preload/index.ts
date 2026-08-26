import { contextBridge, ipcRenderer } from 'electron'
import type { Preset, PresetInput } from '@shared/types/preset'
import type { NotesData } from '@shared/types/notes'
import type { UpdateStatus } from '@shared/types/update'
import { IpcChannels } from '@shared/ipcChannels'
import type { Profile, ProfilesState } from '@shared/types/profile'
import type { SheetApplyPayload } from '@shared/types/sheetImport'
import type { PdfEscolhido } from '@shared/types/sheetImport'
import type { AparenciaDoPersonagem } from '@shared/types/aparencia'
import type { Language } from '@shared/types/idioma'
import type { PacoteImportado } from '@shared/pacote/pacoteDePersonagem'

const api = {
  presets: {
    getAll: (): Promise<Preset[]> => ipcRenderer.invoke(IpcChannels.presetsGetAll),
    create: (input: PresetInput): Promise<Preset> =>
      ipcRenderer.invoke(IpcChannels.presetsCreate, input),
    update: (id: string, input: PresetInput): Promise<Preset> =>
      ipcRenderer.invoke(IpcChannels.presetsUpdate, id, input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IpcChannels.presetsDelete, id),
    exportToFile: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.presetsExport),
    importFromFile: (): Promise<Preset[] | null> => ipcRenderer.invoke(IpcChannels.presetsImport),
    /** A estrela (spec §3.9) — os dois devolvem a lista inteira, já reindexada. */
    setFavorite: (id: string, favorito: boolean): Promise<Preset[]> =>
      ipcRenderer.invoke(IpcChannels.presetsSetFavorito, id, favorito),
    moveFavorite: (id: string, direcao: -1 | 1): Promise<Preset[]> =>
      ipcRenderer.invoke(IpcChannels.presetsMoverFavorito, id, direcao)
  },
  profiles: {
    get: (): Promise<ProfilesState> => ipcRenderer.invoke(IpcChannels.profilesGet),
    save: (state: ProfilesState): Promise<ProfilesState> =>
      ipcRenderer.invoke(IpcChannels.profilesSave, state),
    pickPhoto: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.profilesPickPhoto)
  },
  notes: {
    get: (): Promise<NotesData> => ipcRenderer.invoke(IpcChannels.notesGet),
    save: (notes: NotesData): Promise<NotesData> => ipcRenderer.invoke(IpcChannels.notesSave, notes)
  },
  windowControls: {
    minimize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.windowMinimize),
    maximize: (): Promise<void> => ipcRenderer.invoke(IpcChannels.windowMaximize),
    close: (): Promise<void> => ipcRenderer.invoke(IpcChannels.windowClose),
    /** `alturaExtra`: pixels a mais na janelinha compacta — uma faixa por barra de recurso. */
    setCompact: (compact: boolean, alturaExtra = 0): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.windowSetCompact, compact, alturaExtra),
    setAppIcon: (iconId: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.windowSetAppIcon, iconId)
  },
  scene: {
    pickBackgroundImage: (): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.scenePickBackgroundImage)
  },
  clipboard: {
    /** Só escreve, só texto — ver `registerClipboardHandlers.ts`. `true` se copiou. */
    writeText: (texto: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.clipboardWriteText, texto)
  },
  sheets: {
    /** Bytes do PDF escolhido, ou o MOTIVO de não ter dado (ver `PdfEscolhido`). Quem interpreta é o renderer. */
    pickPdf: (): Promise<PdfEscolhido> => ipcRenderer.invoke(IpcChannels.sheetsPickPdf),
    apply: (payload: SheetApplyPayload): Promise<Profile> =>
      ipcRenderer.invoke(IpcChannels.sheetsApply, payload),
    /** As páginas do PDF do personagem ativo, como data URLs (ver `paginasDaFicha.ts`). */
    paginas: (): Promise<string[]> => ipcRenderer.invoke(IpcChannels.sheetsPaginas)
  },
  pacote: {
    /**
     * O personagem aberto, inteiro, num `.html` (ver `pacoteDePersonagem.ts`). A aparência vai
     * daqui porque mora no `localStorage`, que o principal não alcança. Devolve o caminho gravado,
     * ou `null` se a pessoa desistiu no diálogo.
     */
    exportar: (dados: { aparencia: AparenciaDoPersonagem; idioma: Language }): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.pacoteExportar, dados),
    /** Cria o personagem do arquivo escolhido e devolve ele + a aparência pra gravar. `null` = desistiu. */
    importar: (): Promise<PacoteImportado | null> => ipcRenderer.invoke(IpcChannels.pacoteImportar)
  },
  update: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannels.appGetVersion),
    getStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke(IpcChannels.updateGetStatus),
    check: (): Promise<void> => ipcRenderer.invoke(IpcChannels.updateCheck),
    /** Começa o download da versão encontrada — chamado só depois das duas confirmações. */
    download: (): Promise<void> => ipcRenderer.invoke(IpcChannels.updateDownload),
    installNow: (): Promise<void> => ipcRenderer.invoke(IpcChannels.updateInstallNow),
    /**
     * Devolve a função que CANCELA a assinatura. O painel de Preferências monta e desmonta a cada
     * abertura, e sem cancelar cada abertura deixaria um ouvinte pendurado no `ipcRenderer` — vaza
     * memória e, pior, o React avisa de atualização de estado em componente desmontado.
     */
    onStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: UpdateStatus): void => callback(status)
      ipcRenderer.on(IpcChannels.updateStatus, listener)
      return () => {
        ipcRenderer.removeListener(IpcChannels.updateStatus, listener)
      }
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
