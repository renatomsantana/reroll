import type { RollResult } from '@shared/types/dice'
import { colorForDice } from '@shared/diceRegistry'
import { mantidosPorGrupo } from '@shared/dice/manterDados'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { linhaParaChat } from '@shared/dice/linhaParaChat'
import './HistoryEntry.css'
import { IconeReroll } from '@renderer/components/common/IconeReroll'
import { BotaoCopiar, rotulosDoChat } from '@renderer/components/common/BotaoCopiar'
import { MarcaDeCritico } from '@renderer/components/common/MarcaDeCritico'

function formatTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function HistoryEntry({ result }: { result: RollResult }) {
  const { language, copyMarkdown } = useSettings()
  const t = useTranslation()
  /**
   * Cada dado da jogada, com a marca de ter CONTADO ou não.
   *
   * Sem a marca, uma rolagem com regra de manter fica se contradizendo na própria linha: "[4, 17, 9]
   * = 17". Quem lê soma os três, dá 30, e passa a desconfiar do histórico inteiro.
   */
  /**
   * Resultado de FÓRMULA traz a marca PRONTA (`mantidos`): as regras da gramática são por termo, e
   * `#` conta em vez de somar — refazer a conta aqui a partir de `keep` daria a marca errada.
   */
  const marcas = result.mantidos ?? (result.keep ? mantidosPorGrupo(result.groups, result.keep) : null)
  const allRolls = result.groups.flatMap((g, gi) =>
    g.rolls.map((value, i) => ({
      sides: g.sides,
      value,
      conta: marcas ? marcas[gi][i] : true,
      /** A face descartada por reroll (`r<2`), quando houve — vai pro `title`, como a explosão. */
      rerolado: result.rerolados?.[gi]?.[i] ?? null,
      /**
       * As faces que compuseram este dado, quando ele EXPLODIU. Sem isto, um d6 aparece no histórico
       * valendo 14 — a pessoa olha o número, sabe que um d6 não faz 14, e desconfia do resto da
       * linha. Com a cadeia, "14" vira "14 (6 + 6 + 2)" e a conta se explica sozinha.
       */
      cadeia: (g.chains?.[i]?.length ?? 0) > 1 ? g.chains?.[i] : undefined
    }))
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
                title={
                  [
                    `d${roll.sides}`,
                    roll.rerolado !== null ? `rerolou: caiu ${roll.rerolado}` : null,
                    roll.cadeia ? `explodiu: ${roll.cadeia.join(' + ')}` : null,
                    roll.conta ? null : 'não conta pro total'
                  ]
                    .filter(Boolean)
                    .join(', ')
                }
              >
                {roll.value}
                {/* A marca de explosão fica GRUDADA no número, e não no fim da linha: é aquele
                    dado que explodiu, não a rolagem inteira. */}
                {roll.cadeia && <span className="history-entry-explodiu"><IconeReroll tamanho={12} /></span>}
              </span>
            </span>
          )
        })}
        ]
      </span>
      <span className="history-entry-total">
        = {result.total}
        {/* O julgamento do alvo (">= 15") vem colado no total — é ELE que foi julgado. */}
        {result.sucesso !== undefined && (
          <span
            className={result.sucesso ? 'history-entry-sucesso' : 'history-entry-fracasso'}
            title={result.sucesso ? 'sucesso' : 'fracasso'}
          >
            {' '}
            {result.sucesso ? '✓' : '✗'}
          </span>
        )}
        {/* ⭐/💀 (spec §3.7) — gravados na rolagem, é o que alimenta a contagem de críticos da sessão. */}
        <MarcaDeCritico result={result} />
      </span>
      {/* Cada entrada tem o seu "copiar pro chat" (spec §3.5) — a rolagem de dez minutos atrás também vai pra mesa. */}
      <BotaoCopiar pequeno texto={() => linhaParaChat(result, copyMarkdown, rotulosDoChat(t))} />
    </div>
  )
}
