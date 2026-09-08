import { ipcMain, nativeImage, screen, type BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { isValidAppIconId } from '@shared/appIcons'
import { resolveAppIconPath } from '../appIconPaths'
import { COMPACT_SIZE, FULL_SIZE, TETO_DA_ALTURA_EXTRA_COMPACTA } from '@shared/windowSizes'
import type { SettingsRepository } from '../storage/SettingsRepository'

const RESIZE_ANIMATION_DURATION_MS = 280
const RESIZE_ANIMATION_STEPS = 18

/**
 * Anima o redimensionamento em vez de pular pro tamanho final: a janela do splash já nascia pequena e
 * ia pro tamanho cheio corretamente, mas num salto de um quadro pro outro, e "expande" implica um
 * crescimento visível. `setInterval` chamando `setBounds` é a única forma de animar uma janela nativa
 * do Electron, que não tem API de transição. Mantém o centro fixo, como o `window.center()` fazia de
 * uma vez, e devolve uma Promise que só resolve no fim — pra quem chamou trocar pro conteúdo cheio
 * DEPOIS de a janela estar no tamanho final, sem o app espremido aparecendo por um instante.
 */
function animateResize(window: BrowserWindow, targetWidth: number, targetHeight: number): Promise<void> {
  return new Promise((resolve) => {
    const start = window.getBounds()
    const workArea = screen.getDisplayMatching(start).workArea
    const targetX = Math.round(workArea.x + (workArea.width - targetWidth) / 2)
    const targetY = Math.round(workArea.y + (workArea.height - targetHeight) / 2)

    let step = 0
    const stepMs = RESIZE_ANIMATION_DURATION_MS / RESIZE_ANIMATION_STEPS
    const interval = setInterval(() => {
      step++
      const t = Math.min(1, step / RESIZE_ANIMATION_STEPS)
      const eased = 1 - Math.pow(1 - t, 3)
      window.setBounds({
        x: Math.round(start.x + (targetX - start.x) * eased),
        y: Math.round(start.y + (targetY - start.y) * eased),
        width: Math.round(start.width + (targetWidth - start.width) * eased),
        height: Math.round(start.height + (targetHeight - start.height) * eased)
      })
      if (t >= 1) {
        clearInterval(interval)
        resolve()
      }
    }, stepMs)
  })
}

/**
 * A janela chega por FUNÇÃO, e não pronta: estes handlers são registrados uma vez só, na abertura do
 * app, porque `ipcMain.handle` derruba o processo se o mesmo canal for registrado duas vezes.
 * Perguntando pela janela na hora da chamada, eles continuam valendo se ela for recriada — e devolvem
 * sem fazer nada, em vez de estourar com "Object has been destroyed", se ela já tiver morrido.
 */
export function alturaExtraValida(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  return Math.min(Math.max(0, Math.trunc(valor)), TETO_DA_ALTURA_EXTRA_COMPACTA)
}

/**
 * `FULL_SIZE` apertado pra dentro da área útil do monitor onde a janela está. Sem isto o tamanho cheio
 * era aplicado às cegas, e 1300×800 é MAIOR que a área útil de notebook comum (1366×768 tem ~728 de
 * altura; 1920×1080 com escala 150% tem 1280×672), então a janela saía com título e borda pra fora da
 * tela — "o full screen buga dependendo do tamanho do monitor", reportado por tester. O mínimo aperta
 * junto, senão `setMinimumSize` esticaria a janela de volta pra fora logo depois da animação.
 */
export function tamanhoCheioQueCabe(workArea: { width: number; height: number }): {
  width: number
  height: number
  minWidth: number
  minHeight: number
} {
  return {
    width: Math.min(FULL_SIZE.width, workArea.width),
    height: Math.min(FULL_SIZE.height, workArea.height),
    minWidth: Math.min(FULL_SIZE.minWidth, workArea.width),
    minHeight: Math.min(FULL_SIZE.minHeight, workArea.height)
  }
}

export function registerWindowHandlers(
  obterJanela: () => BrowserWindow | null,
  settingsRepository: SettingsRepository
): void {
  ipcMain.handle(IpcChannels.windowMinimize, () => obterJanela()?.minimize())

  ipcMain.handle(IpcChannels.windowMaximize, () => {
    const window = obterJanela()
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.handle(IpcChannels.windowClose, () => obterJanela()?.close())

  ipcMain.handle(IpcChannels.windowSetCompact, async (_event, compact: boolean, alturaExtra: unknown = 0) => {
    const window = obterJanela()
    if (!window) return
    /**
     * A altura EXTRA do modo compacto, pedida pelo renderer: uma faixa por barra de recurso. A janelinha
     * foi medida sem barra nenhuma, e cada barra que entra empurraria o dado pra fora se a janela não
     * crescesse junto. Vem de fora, então é conferida: inteiro, e presa ao teto — mais que isso já não é
     * "janelinha de canto".
     */
    const extra = alturaExtraValida(alturaExtra)
    const target = compact
      ? { ...COMPACT_SIZE, height: COMPACT_SIZE.height + extra, minHeight: COMPACT_SIZE.minHeight + extra }
      : tamanhoCheioQueCabe(screen.getDisplayMatching(window.getBounds()).workArea)
    window.setResizable(true)
    // Mínimo baixo ENQUANTO anima — o mínimo final (`target.minWidth/minHeight`) costuma ser
    // maior que o tamanho de partida (ex.: vindo do splash, 360×320), e `setMinimumSize`
    // aplicado antes da animação faria o Electron corrigir o tamanho atual pro mínimo na hora,
    // pulando o próprio efeito de "crescer aos poucos" que a animação existe pra dar.
    window.setMinimumSize(1, 1)
    await animateResize(window, target.width, target.height)
    window.setMinimumSize(target.minWidth, target.minHeight)

    /**
     * SEMPRE VISÍVEL enquanto compacto, e isso decide se o modo serve pra alguma coisa: a janelinha
     * existe pra ficar num canto do monitor durante a partida, e uma janela comum some atrás do
     * navegador ou do VTT no primeiro clique fora. Sai junto ao voltar pro tamanho cheio. Sem opção
     * própria nas Preferências de propósito: é consequência do modo compacto, não uma segunda escolha.
     */
    window.setAlwaysOnTop(compact)
  })

  ipcMain.handle(IpcChannels.windowSetAppIcon, async (_event, iconId: string) => {
    // `iconId` vem do renderer — valida contra a lista fixa antes de montar um caminho de
    // arquivo com ele, pra nunca resolver pra fora de `build/icons/`.
    if (!isValidAppIconId(iconId)) return
    obterJanela()?.setIcon(nativeImage.createFromPath(resolveAppIconPath(iconId)))
    /**
     * Isto cobre o título da janela e o Alt+Tab. A BARRA DE TAREFAS continua com o ícone do instalador
     * enquanto o app declarar um AppUserModelID: o Windows tira o ícone do botão da barra do ATALHO, não
     * da janela.
     *
     * Existia um `applyIconToShortcuts` aqui que reescrevia o ícone dos `.lnk` pra cobrir esse caso, e
     * foi REMOVIDO: ele chamava `powershell.exe -EncodedCommand <base64>`, uma das assinaturas
     * comportamentais mais clássicas de malware num executável sem assinatura digital. Na máquina de um
     * tester o antivírus matava o app em looping, e outro só conseguiu usar desativando a proteção.
     */
    await settingsRepository.setAppIconId(iconId)
  })
}
