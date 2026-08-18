import { join } from 'path'
import { app } from 'electron'
import { DEFAULT_APP_ICON_ID, isValidAppIconId } from '@shared/appIcons'
import { JsonFileStore } from './JsonFileStore'

export interface MainSettings {
  /** Id do ícone escolhido pelo usuário (ver `build/icons/<id>.png`) — precisa existir no main
   * process (diferente da maioria das configs, que ficam só no `localStorage` do renderer)
   * porque o ícone da janela/barra de tarefas é definido já na criação do `BrowserWindow`,
   * antes do renderer sequer existir. */
  appIconId: string
}

const DEFAULT_MAIN_SETTINGS: MainSettings = {
  appIconId: DEFAULT_APP_ICON_ID
}

export class SettingsRepository {
  private readonly store: JsonFileStore<MainSettings>

  constructor() {
    const filePath = join(app.getPath('userData'), 'settings.json')
    this.store = new JsonFileStore<MainSettings>(filePath, DEFAULT_MAIN_SETTINGS)
  }

  /**
   * Valida `appIconId` contra a lista atual antes de devolver — protege contra um valor
   * persistido de uma versão anterior (ex.: o ícone branco 'rbranco', removido a pedido do
   * usuário) que não existe mais em `build/icons/`. Sem isso, `resolveAppIconPath` montaria um
   * caminho pra um arquivo apagado e `nativeImage.createFromPath` falharia silenciosamente
   * (ícone da janela em branco, sem erro nenhum) — melhor cair pro padrão de propósito.
   */
  async get(): Promise<MainSettings> {
    const settings = await this.store.read()
    if (!isValidAppIconId(settings.appIconId)) {
      return { ...settings, appIconId: DEFAULT_MAIN_SETTINGS.appIconId }
    }
    return settings
  }

  async setAppIconId(appIconId: string): Promise<void> {
    const current = await this.get()
    await this.store.write({ ...current, appIconId })
  }
}
