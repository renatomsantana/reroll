import type { Preset, PresetInput } from '@shared/types/preset'
import type { NotesData } from '@shared/types/notes'
import type { UpdateStatus } from '@shared/types/update'
import type { Profile, ProfilesState } from '@shared/types/profile'
import type { PdfEscolhido, SheetApplyPayload } from '@shared/types/sheetImport'
import type { AparenciaDoPersonagem } from '@shared/types/aparencia'
import type { Language } from '@shared/types/idioma'
import type { PacoteImportado } from '@shared/pacote/pacoteDePersonagem'

export interface RolladorApi {
  presets: {
    getAll: () => Promise<Preset[]>
    create: (input: PresetInput) => Promise<Preset>
    update: (id: string, input: PresetInput) => Promise<Preset>
    delete: (id: string) => Promise<void>
    exportToFile: () => Promise<string | null>
    importFromFile: () => Promise<Preset[] | null>
    setFavorite: (id: string, favorito: boolean) => Promise<Preset[]>
    moveFavorite: (id: string, direcao: -1 | 1) => Promise<Preset[]>
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
    setCompact: (compact: boolean, alturaExtra?: number) => Promise<void>
    setAppIcon: (iconId: string) => Promise<void>
  }
  scene: {
    pickBackgroundImage: () => Promise<string | null>
  }
  clipboard: {
    writeText: (texto: string) => Promise<boolean>
  }
  sheets: {
    pickPdf: () => Promise<PdfEscolhido>
    /**
     * O tipo vem do PROCESSO PRINCIPAL, que é quem executa isto — e não redigitado aqui.
     *
     * Ele já era uma cópia à mão do `SheetApplyPayload`, e as duas versões divergiram: o campo
     * ficou sem o `roll` de cada campo (o que põe o botão de dado na ficha) e sem o personagem de
     * destino. Como este arquivo é só a declaração do que o preload expõe, a divergência não
     * quebrava a compilação — ela apagava informação na travessia, calada.
     */
    apply: (payload: SheetApplyPayload) => Promise<Profile>
  }
  /** O personagem inteiro num arquivo (ver `pacoteDePersonagem.ts`). */
  pacote: {
    exportar: (dados: { aparencia: AparenciaDoPersonagem; idioma: Language }) => Promise<string | null>
    importar: () => Promise<PacoteImportado | null>
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
