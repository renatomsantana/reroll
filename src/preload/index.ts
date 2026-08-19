import { contextBridge, ipcRenderer } from 'electron'
import type { Preset, PresetInput } from '@shared/types/preset'
import type { NotesData } from '@shared/types/notes'
import type { UpdateStatus } from '@shared/types/update'
import { IpcChannels } from '@shared/ipcChannels'
import type { ProfilesState } from '@shared/types/profile'

const api = {
  presets: {
    getAll: (): Promise<Preset[]> => ipcRenderer.invoke(IpcChannels.presetsGetAll),
    create: (input: PresetInput): Promise<Preset> =>
      ipcRenderer.invoke(IpcChannels.presetsCreate, input),
    update: (id: string, input: PresetInput): Promise<Preset> =>
      ipcRenderer.invoke(IpcChannels.presetsUpdate, id, input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IpcChannels.presetsDelete, id),
    exportToFile: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.presetsExport),
    importFromFile: (): Promise<Preset[] | null> => ipcRenderer.invoke(IpcChannels.presetsImport)
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
    setCompact: (compact: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.windowSetCompact, compact),
    setAppIcon: (iconId: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.windowSetAppIcon, iconId)
  },
  scene: {
    pickBackgroundImage: (): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannels.scenePickBackgroundImage)
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
