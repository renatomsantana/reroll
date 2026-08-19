import type { Preset, PresetInput } from '@shared/types/preset'
import type { NotesData } from '@shared/types/notes'
import type { UpdateStatus } from '@shared/types/update'
import type { ProfilesState } from '@shared/types/profile'

export interface RolladorApi {
  presets: {
    getAll: () => Promise<Preset[]>
    create: (input: PresetInput) => Promise<Preset>
    update: (id: string, input: PresetInput) => Promise<Preset>
    delete: (id: string) => Promise<void>
    exportToFile: () => Promise<string | null>
    importFromFile: () => Promise<Preset[] | null>
  }
  /** Perfis de personagem (ver `shared/types/profile.ts`) — lista, qual está aberto e a foto. */
  profiles: {
    get: () => Promise<ProfilesState>
    save: (state: ProfilesState) => Promise<ProfilesState>
    pickPhoto: () => Promise<string | null>
  }
  notes: {
    get: () => Promise<NotesData>
    save: (notes: NotesData) => Promise<NotesData>
  }
  windowControls: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    setCompact: (compact: boolean) => Promise<void>
    setAppIcon: (iconId: string) => Promise<void>
  }
  scene: {
    pickBackgroundImage: () => Promise<string | null>
  }
  update: {
    getVersion: () => Promise<string>
    getStatus: () => Promise<UpdateStatus>
    check: () => Promise<void>
    download: () => Promise<void>
    installNow: () => Promise<void>
    /** Retorna a função que cancela a assinatura — ver `preload/index.ts`. */
    onStatus: (callback: (status: UpdateStatus) => void) => () => void
  }
}

declare global {
  interface Window {
    api: RolladorApi
  }
}
