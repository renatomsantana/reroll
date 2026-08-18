import type { RollResult } from '@shared/types/dice'
import { colorForDice } from '@shared/diceRegistry'
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
  const allRolls = result.groups.flatMap((g) => g.rolls.map((value) => ({ sides: g.sides, value })))

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
                className="history-entry-roll-value"
                style={{ background: color.bg, color: color.text }}
                title={`d${roll.sides}`}
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
