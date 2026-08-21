import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { escolherImagemComoDataUrl } from './escolherImagem'

/**
 * Escolhe uma imagem pra usar como fundo da cena 3D (bandeja/torre).
 *
 * O trabalho todo — diálogo, formato, limite de tamanho, base64 — mora em `escolherImagem.ts`, junto
 * com o da foto do personagem: são a mesma operação, e enquanto estavam duplicadas as duas podiam
 * divergir sem ninguém notar. O data URL inteiro é persistido no `SettingsContext` do renderer
 * (mesmo padrão de toda cor/preferência visual já salva em `localStorage`) — não precisa copiar o
 * arquivo pra `userData` nem guardar caminho nenhum.
 */
export function registerSceneBackgroundHandlers(): void {
  ipcMain.handle(IpcChannels.scenePickBackgroundImage, () =>
    escolherImagemComoDataUrl('Escolher imagem de fundo')
  )
}
