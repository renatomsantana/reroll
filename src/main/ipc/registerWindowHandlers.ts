import { ipcMain, nativeImage, screen, type BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { isValidAppIconId } from '@shared/appIcons'
import { resolveAppIconPath } from '../appIconPaths'
import { COMPACT_SIZE, FULL_SIZE, TETO_DA_ALTURA_EXTRA_COMPACTA } from '@shared/windowSizes'
import type { SettingsRepository } from '../storage/SettingsRepository'

const RESIZE_ANIMATION_DURATION_MS = 280
const RESIZE_ANIMATION_STEPS = 18

/**
 * Anima o redimensionamento em vez de pular direto pro tamanho final — pedido do usuário (a
 * janela do splash já nascia pequena e ia pro tamanho cheio corretamente, mas o salto era
 * instantâneo de um frame pro outro; "expande" implica um crescimento visível, não um corte
 * seco). `setInterval` chamando `setBounds` repetidamente é a única forma de animar uma janela
 * nativa do Electron — não existe API de transição/animação embutida. Mantém o centro fixo
 * (interpola em direção ao retângulo final já centralizado na tela), igual o antigo
 * `window.center()` fazia de uma vez só. Retorna uma Promise que só resolve quando a animação
 * termina, pra quem chamou (`App.tsx`, ver `onFinish` do splash) só trocar pro conteúdo cheio
 * DEPOIS da janela já estar no tamanho final — evita o app cheio "espremido" aparecendo por um
 * instante dentro da janela ainda pequena.
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
 * A janela chega por FUNÇÃO, e não pronta.
 *
 * Estes handlers são registrados uma vez só, na abertura do app (ver `index.ts`), porque
 * `ipcMain.handle` derruba o processo se o mesmo canal for registrado duas vezes. Perguntando pela
 * janela na hora da chamada, eles continuam valendo se a janela for recriada — e devolvem sem fazer
 * nada, em vez de estourar com "Object has been destroyed", se ela já tiver morrido (é o caso do
 * clique que chega enquanto o app fecha).
 */
export function alturaExtraValida(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  return Math.min(Math.max(0, Math.trunc(valor)), TETO_DA_ALTURA_EXTRA_COMPACTA)
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
     * A altura EXTRA do modo compacto, pedida pelo renderer: uma faixa por barra de recurso (spec
     * §3.4 — "compact mode shows the bars too"). A janelinha foi medida sem barra nenhuma, e cada
     * barra que entra empurraria o dado pra fora se a janela não crescesse junto.
     *
     * Vem de fora, então é conferida: inteiro, e preso a `TETO_DA_ALTURA_EXTRA_COMPACTA` — mais que
     * isso já não é "janelinha de canto".
     */
    const extra = alturaExtraValida(alturaExtra)
    const target = compact
      ? { ...COMPACT_SIZE, height: COMPACT_SIZE.height + extra, minHeight: COMPACT_SIZE.minHeight + extra }
      : FULL_SIZE
    window.setResizable(true)
    // Mínimo baixo ENQUANTO anima — o mínimo final (`target.minWidth/minHeight`) costuma ser
    // maior que o tamanho de partida (ex.: vindo do splash, 360×320), e `setMinimumSize`
    // aplicado antes da animação faria o Electron corrigir o tamanho atual pro mínimo na hora,
    // pulando o próprio efeito de "crescer aos poucos" que a animação existe pra dar.
    window.setMinimumSize(1, 1)
    await animateResize(window, target.width, target.height)
    window.setMinimumSize(target.minWidth, target.minHeight)

    /**
     * SEMPRE VISÍVEL enquanto compacto, e isso é o que decide se o modo serve pra alguma coisa: a
     * janelinha existe pra ficar num canto do monitor durante a partida, e uma janela comum some
     * atrás do navegador ou do VTT no primeiro clique fora. Sai junto ao voltar pro tamanho cheio,
     * onde ficar por cima de tudo seria só estorvo.
     *
     * Sem opção própria nas Preferências de propósito: é consequência do modo compacto, não uma
     * segunda escolha pra manter em dia.
     */
    window.setAlwaysOnTop(compact)
  })

  ipcMain.handle(IpcChannels.windowSetAppIcon, async (_event, iconId: string) => {
    // `iconId` vem do renderer — valida contra a lista fixa antes de montar um caminho de
    // arquivo com ele, pra nunca resolver pra fora de `build/icons/`.
    if (!isValidAppIconId(iconId)) return
    obterJanela()?.setIcon(nativeImage.createFromPath(resolveAppIconPath(iconId)))
    /**
     * Isto cobre o título da janela e o Alt+Tab. A BARRA DE TAREFAS continua com o ícone do
     * instalador enquanto o app declarar um AppUserModelID — o Windows tira o ícone do botão da
     * barra do ATALHO, não da janela.
     *
     * Existia um `applyIconToShortcuts` aqui que reescrevia o ícone dos `.lnk` pra cobrir esse
     * caso. Foi REMOVIDO: ele chamava `powershell.exe -EncodedCommand <base64>`, e um executável
     * sem assinatura digital disparando PowerShell com comando em base64 é uma das assinaturas
     * comportamentais mais clássicas de malware. Na máquina de um tester o antivírus matava o app
     * em looping (abria e fechava sem parar) e o outro tester só conseguiu usar desativando a
     * proteção. Ícone bonito na barra não vale um app que não abre.
     */
    await settingsRepository.setAppIconId(iconId)
  })
}
