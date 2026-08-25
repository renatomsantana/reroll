import { clipboard, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'

/**
 * COPIAR PRA ÁREA DE TRANSFERÊNCIA (spec §3.5: a linha da rolagem pro Discord/WhatsApp).
 *
 * Passa pelo processo principal porque o preload roda em SANDBOX (ver `webPreferences` em
 * `index.ts`), e o sandbox só deixa o preload ver `contextBridge`, `ipcRenderer`, `nativeImage` e
 * `webFrame` — o módulo `clipboard` não está entre eles. O `navigator.clipboard` do renderer seria
 * a alternativa, mas ele depende de permissão que `travarSessao` nega por padrão e de a janela ter
 * foco; o canal é o caminho que funciona sempre, e é o "Electron clipboard API" que a spec cita.
 *
 * Só ESCREVE, e só texto. Não existe canal de leitura de propósito: o app não tem por que saber o
 * que a pessoa copiou em outro programa.
 */

/**
 * Teto do que se copia. A linha da rolagem tem uns 60 caracteres; uma rolagem de 100 dados
 * explosivos com fórmula chega a poucas centenas. Acima disso não é linha de chat — e o teto é o
 * que impede um renderer com defeito de encher a área de transferência com megabytes.
 */
export const TAMANHO_MAXIMO_DA_COPIA = 4_000

/** O texto que vai pra área de transferência, ou `null` se o pedido não é texto. */
export function textoParaCopiar(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null
  return bruto.slice(0, TAMANHO_MAXIMO_DA_COPIA)
}

export function registerClipboardHandlers(): void {
  ipcMain.handle(IpcChannels.clipboardWriteText, (_event, bruto: unknown) => {
    const texto = textoParaCopiar(bruto)
    if (texto === null) return false
    clipboard.writeText(texto)
    return true
  })
}
