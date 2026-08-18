import { promises as fs } from 'fs'
import { extname } from 'path'
import { dialog, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
}

/**
 * Escolhe uma imagem (diálogo nativo) pra usar como fundo da cena 3D (bandeja/torre) e devolve
 * como data URL base64 — em vez de devolver só o caminho do arquivo, que exigiria carregar via
 * `file://` no renderer e brigar com o `Content-Security-Policy` (`img-src`), já que o arquivo
 * escolhido pode estar em QUALQUER pasta do sistema, não só dentro do próprio app. O data URL
 * inteiro é persistido no `SettingsContext` do renderer (mesmo padrão de toda cor/preferência
 * visual já salva em `localStorage`) — não precisa copiar o arquivo pra `userData` nem guardar
 * caminho nenhum.
 */
export function registerSceneBackgroundHandlers(): void {
  ipcMain.handle(IpcChannels.scenePickBackgroundImage, async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Escolher imagem de fundo',
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
