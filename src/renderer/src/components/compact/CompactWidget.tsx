import type { Preset } from '@shared/types/preset'
import type { RollResult } from '@shared/types/dice'
import { expressionLabel } from '@renderer/domain/dice/diceEngine'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { TumblingDie } from '../roller/TumblingDie'
import './CompactWidget.css'

/**
 * O modo compacto: janelinha de canto de monitor, sempre por cima das outras (ver `windowSetCompact`
 * em `registerWindowHandlers.ts`, que liga o `setAlwaysOnTop` junto).
 *
 * O ARRANJO é o do rolador do Google ("jogar os dados"), levado como referência pelo usuário: um
 * dado grande girando no meio de um painel, o total grande no canto de baixo, e embaixo a fileira de
 * seletores. A diferença é o que está na fileira — no Google são os tipos de dado, aqui são os SEUS
 * presets, que é o ponto do app.
 *
 * O movimento é o `TumblingDie`, que já existia: o dado entra de cima girando, chacoalha valores
 * aleatórios e assenta no número real. O `key` por rolagem força o remount, senão repetir o mesmo
 * número não tocaria a animação de novo.
 *
 * Sem botão de "novo preset" de propósito: criar preset é o `PresetEditorModal`, que não cabe aqui —
 * um botão que abre um modal cortado é defeito, não recurso. Quem não tem preset lê o aviso do vazio.
 */
interface CompactWidgetProps {
  presets: Preset[]
  result: RollResult | null
  onRoll: (preset: Preset) => void
}

/** "13+5 + 4" — os dados de cada grupo somados ao modificador, pra conferir o total de relance. */
function rollBreakdown(result: RollResult): string {
  const groups = result.groups.map((g) => g.rolls.join('+')).join(' + ')
  if (result.modifierTotal === 0) return groups
  const sinal = result.modifierTotal > 0 ? '+' : '−'
  return `${groups} ${sinal} ${Math.abs(result.modifierTotal)}`
}

export function CompactWidget({ presets, result, onRoll }: CompactWidgetProps) {
  const t = useTranslation()

  /**
   * Todos os dados da jogada, achatados em uma lista. Um preset pode ser 1d20+5 (um dado só) ou
   * 8d6 (oito), e os dois casos precisam caber no mesmo painel.
   */
  const dados =
    result?.groups.flatMap((g) => g.rolls.map((valor) => ({ sides: g.sides, valor }))) ?? []

  /**
   * Um dado só é o caso do rolador do Google que serviu de referência: ilustração grande com o
   * valor na face. Com vários, o dado grande passa a MENTIR — mostraria um número enquanto o total
   * vem de outros sete —, então viram miniaturas, cada uma com o próprio valor no canto. É o mesmo
   * desenho que o modo normal usa na linha de resultado.
   */
  const dadoUnico = dados.length === 1 ? dados[0] : null

  /**
   * Teto de miniaturas visíveis. Oito d6 cabem; cem d6 (o app permite até 100 dados) transformariam
   * o painel numa sopa ilegível e ainda montariam cem animações de uma vez. Passando disso, mostra
   * as primeiras e diz quantas ficaram de fora — o Total continua sendo o número que importa.
   */
  const TETO_MINIATURAS = 12
  const miniaturas = dados.slice(0, TETO_MINIATURAS)
  const excedente = dados.length - miniaturas.length

  return (
    <div className="compact-widget">
      <div className="compact-stage">
        {result ? (
          <>
            {dadoUnico ? (
              /* O tamanho do dado vem do CSS (`--die-size`), não daqui: ele precisa ENCOLHER junto
                 com o painel quando a janela é reduzida até o mínimo, e isso a folha de estilo
                 resolve com unidades de contêiner. Ver `CompactWidget.css`. */
              <TumblingDie
                key={result.id}
                sides={dadoUnico.sides}
                value={dadoUnico.valor}
                art="face"
              />
            ) : (
              <div className="compact-stage-dados">
                {miniaturas.map((d, i) => (
                  <TumblingDie
                    key={`${result.id}-${i}`}
                    sides={d.sides}
                    value={d.valor}
                    art="face"
                    className="tumbling-die-mini"
                  />
                ))}
                {excedente > 0 && <span className="compact-stage-excedente">+{excedente}</span>}
              </div>
            )}
            <div className="compact-stage-total">
              <span className="compact-stage-total-label">{t.roller.total}</span>
              <strong className="compact-stage-total-value">{result.total}</strong>
            </div>
            <span className="compact-stage-detail">
              {result.sourceName ?? result.label} · {rollBreakdown(result)}
            </span>
          </>
        ) : (
          <span className="compact-stage-empty">{t.compact.resultEmpty}</span>
        )}
      </div>

      {presets.length === 0 ? (
        <p className="compact-widget-empty">{t.compact.empty}</p>
      ) : (
        <div className="compact-widget-presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="compact-preset"
              onClick={() => onRoll(preset)}
              /* O nome é cortado com reticências num botão estreito; o `title` devolve o nome
                 inteiro e a expressão sem gastar altura, que é o que falta aqui. */
              title={`${preset.name} — ${expressionLabel(preset.expression)}`}
            >
              {preset.icon && <span className="compact-preset-icon">{preset.icon}</span>}
              <span className="compact-preset-name">{preset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
