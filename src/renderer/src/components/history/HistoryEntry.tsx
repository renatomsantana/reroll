import type { RollResult } from '@shared/types/dice'
import { colorForDice } from '@shared/diceRegistry'
import { mantidosPorGrupo } from '@shared/dice/manterDados'
import { useSettings } from '@renderer/settings/SettingsContext'
import './HistoryEntry.css'

function formatTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function HistoryEntry({ result }: { result: RollResult }) {
  const { language } = useSettings()
  /**
   * Cada dado da jogada, com a marca de ter CONTADO ou não.
   *
   * Sem a marca, uma rolagem com regra de manter fica se contradizendo na própria linha: "[4, 17, 9]
   * = 17". Quem lê soma os três, dá 30, e passa a desconfiar do histórico inteiro.
   */
  const marcas = result.keep ? mantidosPorGrupo(result.groups, result.keep) : null
  const allRolls = result.groups.flatMap((g, gi) =>
    g.rolls.map((value, i) => ({ sides: g.sides, value, conta: marcas ? marcas[gi][i] : true }))
  )

  return (
    <div className="history-entry">
      <span className="history-entry-time">{formatTime(result.timestamp, language)}</span>
      {/*
        NOME DO GOLPE quando a rolagem veio de um preset, com a expressão logo depois em cinza —
        pedido do usuário ("hora, nome do golpe, dados q jogou"). Numa rolagem manual não existe
        nome, e aí a expressão assume o lugar dele, em negrito, como era antes.
      */}
      {result.sourceName ? (
        <>
          <span className="history-entry-label">{result.sourceName}</span>
          <span className="history-entry-expression">{result.label}</span>
        </>
      ) : (
        <span className="history-entry-label">{result.label}</span>
      )}
      <span className="history-entry-rolls">
        [
        {allRolls.map((roll, i) => {
          const color = colorForDice(roll.sides)
          return (
            <span key={i}>
              {i > 0 && ', '}
              <span
                className={`history-entry-roll-value ${roll.conta ? '' : 'history-entry-roll-descartado'}`}
                style={{ background: color.bg, color: color.text }}
                title={roll.conta ? `d${roll.sides}` : `d${roll.sides} — não conta pro total`}
              >
                {roll.value}
              </span>
            </span>
          )
        })}
        ]
      </span>
      <span className="history-entry-total">= {result.total}</span>
    </div>
  )
}
