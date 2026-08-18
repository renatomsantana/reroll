import type RAPIER from '@dimforge/rapier3d-compat'
import { TOWER_CONFIG } from '../config/physicsConfig'

export type DescentProgressState = 'descending' | 'stuck'

export interface DescentProgressResult {
  state: DescentProgressState
  /**
   * Quantas vezes SEGUIDAS (sem progresso SUBSTANCIAL no meio, ver `SUBSTANTIAL_PROGRESS_THRESHOLD`
   * abaixo) o dado já foi considerado "travado" desde o último progresso de verdade — 0 enquanto
   * ainda descendo normalmente. Usado por `applyTowerStuckNudge.ts` pra ESCALAR a força da
   * correção (ver comentário grande lá pro histórico completo).
   */
  stuckAttempts: number
}

export interface DescentProgressTracker {
  /** Chamar uma vez por frame com o delta em ms; devolve o estado atualizado + o contador de escalonamento. */
  update: (body: RAPIER.RigidBody, deltaMs: number) => DescentProgressResult
  /** Chamar ao relançar o dado na torre (queda NOVA) — zera tudo, inclusive o escalonamento. */
  reset: (startY: number) => void
  /**
   * Chamar depois de um empurrão de recuperação (NÃO uma queda nova) — reinicia só a janela de
   * detecção "travado vs descendo" (`lastY`/tempo parado), preservando `stuckAttempts` e a
   * referência de progresso substancial. BUG REAL que motivou separar isto de `reset`: usar o
   * mesmo `reset` completo depois de CADA empurrão zerava o contador de escalonamento
   * imediatamente após incrementá-lo — a escalada nunca acontecia de verdade, todo empurrão
   * seguinte voltava a começar do nível 1.
   */
  softResetAfterNudge: (currentY: number) => void
}

/**
 * Distância (unidades de mundo) de progresso VERTICAL considerada "de verdade" pra fins de
 * ESCALONAMENTO do empurrão de recuperação — bem maior que `TOWER_CONFIG.progressEpsilon` (que só
 * filtra ruído numérico pra decidir "descendo" vs "travado" a cada frame).
 *
 * BUG REAL medido nesta sessão: usar o MESMO limiar fino (0.05) pra resetar o contador de
 * escalonamento fazia um dado genuinamente preso (D100) nunca escalar pro empurrão forte — um
 * quique/oscilação de poucos milímetros no meio de vários ciclos de empurrão fraco já contava
 * como "progresso", resetando o contador de volta pra 0 antes de acumular tentativas suficientes
 * pra escalar. 0.3 (bem mais que qualquer oscilação residual de um empurrão fraco, bem menos que
 * `TOWER_CONFIG.baffleVerticalSpacing`) só reseta o contador quando o dado realmente avançou uma
 * fração significativa do caminho entre prateleiras.
 */
const SUBSTANTIAL_PROGRESS_THRESHOLD = 0.3

/**
 * Equivalente de `createSettleTracker.ts` pra dentro da torre — mas olhando pra PROGRESSO (altura
 * diminuindo), não pra velocidade baixa: um dado pode ficar quicando entre duas prateleiras sem
 * nunca ficar "devagar o bastante" (o sinal que `SettleTracker` usa), então velocidade baixa não
 * é o sinal certo de trava aqui. Um quique legítimo (sobe um pouco antes de continuar caindo) não
 * dispara falso positivo na checagem "travado vs descendo": só conta como "sem progresso" enquanto
 * a altura atual não bate um novo mínimo, então um quique que ainda desce no fim das contas nunca
 * acumula tempo de trava.
 */
export function createDescentProgressTracker(): DescentProgressTracker {
  let lastY = Infinity
  let stuckForMs = 0
  let escalationReferenceY = Infinity
  let stuckAttempts = 0

  return {
    update(body, deltaMs) {
      const y = body.translation().y
      if (y < lastY - TOWER_CONFIG.progressEpsilon) {
        lastY = y
        stuckForMs = 0
        if (y <= escalationReferenceY - SUBSTANTIAL_PROGRESS_THRESHOLD) {
          escalationReferenceY = y
          stuckAttempts = 0
        }
        return { state: 'descending', stuckAttempts }
      }

      stuckForMs += deltaMs
      if (stuckForMs >= TOWER_CONFIG.stuckTimeoutMs) {
        stuckAttempts += 1
        return { state: 'stuck', stuckAttempts }
      }
      return { state: 'descending', stuckAttempts }
    },
    reset(startY) {
      lastY = startY
      stuckForMs = 0
      escalationReferenceY = startY
      stuckAttempts = 0
    },
    softResetAfterNudge(currentY) {
      lastY = currentY
      stuckForMs = 0
    }
  }
}
