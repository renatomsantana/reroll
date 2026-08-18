import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import type { FaceReading } from '../faceReading/readTopFace'

export interface DieDebugSnapshot {
  sides: PhysicalDiceSides
  phaseLabel: string
  reading: FaceReading
  body: RAPIER.RigidBody
}

export interface DiceDebugHud {
  /** Registra um dado novo no painel; devolve a função que atualiza a linha dele a cada frame. */
  addDieRow: () => (snapshot: DieDebugSnapshot) => void
  updateFps: (fps: number) => void
  dispose: () => void
}

function magnitude(v: { x: number; y: number; z: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/**
 * Painel HTML simples sobreposto ao canvas, fora da árvore React de propósito:
 * os números mudam a cada frame de física, e passar isso por estado do React
 * causaria uma re-renderização por frame só pra atualizar texto (ver
 * preocupação do projeto com rerenders dentro do loop de física, em
 * `physicsConfig.ts`/comentários de performance). `textContent` é uma escrita
 * de DOM direta e barata o bastante pra rodar a 60fps sem problema.
 */
export function createDiceDebugHud(container: HTMLElement): DiceDebugHud {
  const root = document.createElement('div')
  root.className = 'dice-debug-hud'
  container.appendChild(root)

  const fpsRow = document.createElement('div')
  fpsRow.className = 'dice-debug-fps'
  root.appendChild(fpsRow)

  return {
    addDieRow() {
      const row = document.createElement('div')
      row.className = 'dice-debug-row'
      root.appendChild(row)

      return ({ sides, phaseLabel, reading, body }) => {
        const linSpeed = magnitude(body.linvel())
        const angSpeed = magnitude(body.angvel())
        const pos = body.translation()
        row.textContent =
          `d${sides} — ${phaseLabel}\n` +
          `valor: ${reading.value} (face #${reading.faceId})\n` +
          `confiança: ${reading.bestDot.toFixed(3)} / ${reading.secondBestDot.toFixed(3)}` +
          `${reading.isAmbiguous ? ' ⚠ ambíguo' : ''}\n` +
          `vel: lin ${linSpeed.toFixed(2)} ang ${angSpeed.toFixed(2)}` +
          `${body.isSleeping() ? ' (dormindo)' : ''}\n` +
          `pos: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
      }
    },
    updateFps(fps) {
      fpsRow.textContent = `FPS: ${Math.round(fps)}`
    },
    dispose() {
      root.remove()
    }
  }
}
