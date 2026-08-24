import type { RollResult } from '@shared/types/dice'
import { mantidosPorGrupo } from '@shared/dice/manterDados'
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

  /**
   * A marca de "conta pro total": pronta no resultado quando a rolagem veio de uma FÓRMULA (regras
   * por termo, contagem — ver `mantidos` em `RollResult`), refeita de `keep` na rolagem de sempre,
   * `null` quando não há regra — aí a marcação de par continua como era.
   */
  const mantidos = result.mantidos ?? (result.keep ? mantidosPorGrupo(result.groups, result.keep) : null)

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
                /**
                 * Com regra de manter ("role 3d20 e use o maior"), a marcação diz QUAL dado entrou
                 * no total. Os descartados continuam na lista de propósito: eles caíram na bandeja e
                 * a pessoa está olhando pra eles — sumir com metade dos dados que estão na mesa
                 * seria a tela discordando do que se vê.
                 */
                if (mantidos) {
                  highlight = mantidos[groupIndex][i] ? 'high' : 'low'
                } else if (isPair) {
                  const isHigher = value === Math.max(...group.rolls)
                  highlight = isHigher ? 'high' : 'low'
                }
                return (
                  <TumblingDie
                    key={`${result.id}-${groupIndex}-${i}`}
                    sides={group.sides}
                    value={value}
                    highlight={highlight}
                    /*
                      Com regra de manter, o destaque quer dizer "este conta pro total" — e não "este
                      é o maior". A diferença aparece em "role 2d20 e use o MENOR": ali o destacado é
                      o de MENOR valor, e o texto padrão do destaque diria exatamente o contrário.
                    */
                    highlightLabelOverride={
                      mantidos
                        ? mantidos[groupIndex][i]
                          ? t.roller.keptDie
                          : t.roller.discardedDie
                        : undefined
                    }
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
      {/* O alvo da fórmula (">= 15") julga a rolagem inteira — o veredito sai embaixo do total. */}
      {result.sucesso !== undefined && (
        <div
          className={`roll-result-julgamento ${
            result.sucesso ? 'roll-result-sucesso' : 'roll-result-fracasso'
          }`}
        >
          {result.sucesso ? `✓ ${t.roller.success}` : `✗ ${t.roller.failure}`}
        </div>
      )}
    </Card>
  )
}
