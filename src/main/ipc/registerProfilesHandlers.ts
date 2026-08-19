import { promises as fs } from 'fs'
import { extname } from 'path'
import { dialog, ipcMain } from 'electron'
import type { ProfilesState } from '@shared/types/profile'
import { IpcChannels } from '@shared/ipcChannels'
import type { ProfilesRepository } from '../storage/ProfilesRepository'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/**
 * Perfis de personagem: ler, gravar e escolher a foto.
 *
 * A gravação é do ESTADO INTEIRO (lista + qual está aberto), não uma operação por ação
 * (criar/renomear/apagar/trocar). São todas edições de uma lista pequena que a tela já tem em mãos,
 * e um handler por verbo só multiplicaria caminhos de erro — o `PresetsRepository`, que tem
 * create/update/delete próprios, é outro caso: lá a lista é do usuário e cresce sem limite.
 */
export function registerProfilesHandlers(repository: ProfilesRepository): void {
  ipcMain.handle(IpcChannels.profilesGet, () => repository.get())
  ipcMain.handle(IpcChannels.profilesSave, (_event, state: ProfilesState) => repository.save(state))

  /**
   * Foto do personagem, como data URL — mesma escolha (e mesmo motivo) da imagem de fundo da cena,
   * ver `registerSceneBackgroundHandlers.ts`: guardar o caminho quebraria se a pessoa movesse o
   * arquivo, e carregar por `file://` esbarra no `Content-Security-Policy` do renderer.
   */
  ipcMain.handle(IpcChannels.profilesPickPhoto, async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Escolher foto do personagem',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    const mime = MIME_BY_EXTENSION[extname(filePath).toLowerCase()]
    if (!mime) throw new Error('Formato de imagem não suportado.')

    const buffer = await fs.readFile(filePath)
    return `data:${mime};base64,${buffer.toString('base64')}`
  })
}
