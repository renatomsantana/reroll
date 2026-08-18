import type { RollResult } from '@shared/types/dice'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Card } from '../common/Card'
import { TumblingDie, type DieHighlight } from './TumblingDie'
import './RollResultView.css'

interface RollResultViewProps {
  result: RollResult | null
}

export function RollResultView({ result }: RollResultViewProps) {
  const t = useTranslation()

  if (!result) {
    return (
      <Card className="roll-result roll-result-empty">
        <p>{t.roller.resultEmpty}</p>
      </Card>
    )
  }

  return (
    <Card className="roll-result">
      <div className="roll-result-label">
        {result.label}
        {result.advantageMode && (
          <>
            {' '}
            {result.advantageMode === 'advantage'
              ? t.roller.advantageSuffix
              : t.roller.disadvantageSuffix}
          </>
        )}
      </div>
      <div className="roll-result-table">
        {result.groups.map((group, groupIndex) => {
          const isPair = group.rolls.length === 2 && group.rolls[0] !== group.rolls[1]
          return (
            <div key={groupIndex} className="roll-result-group">
              <span className="roll-result-group-tag">d{group.sides}</span>
              {group.rolls.map((value, i) => {
                let highlight: DieHighlight = null
                if (isPair) {
                  const isHigher = value === Math.max(...group.rolls)
                  highlight = isHigher ? 'high' : 'low'
                }
                return (
                  <TumblingDie
                    key={`${result.id}-${groupIndex}-${i}`}
                    sides={group.sides}
                    value={value}
                    highlight={highlight}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="roll-result-total">
        {t.roller.total}: <strong>{result.total}</strong>
      </div>
    </Card>
  )
}
