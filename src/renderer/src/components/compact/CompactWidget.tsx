import { favoritosOrdenados, type Preset } from '@shared/types/preset'
import type { RollResult } from '@shared/types/dice'
import { expressionLabel } from '@renderer/domain/dice/diceEngine'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { mantidosPorGrupo } from '@shared/dice/manterDados'
import { rollBreakdown } from '@shared/dice/rollBreakdown'
import type { RecursoVital } from '@shared/types/recursoVital'
import { TumblingDie } from '../roller/TumblingDie'
import { BarrasDeRecurso } from '../recursos/BarrasDeRecurso'
import { BotaoCopiar, rotulosDoChat } from '../common/BotaoCopiar'
import { MarcaDeCritico } from '../common/MarcaDeCritico'
import { linhaParaChat } from '@shared/dice/linhaParaChat'
import { useSettings } from '@renderer/settings/SettingsContext'
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
  /**
   * As barras de PV/PE/Sanidade, na versão fina (spec §3.4: "compact mode shows the bars too").
   * Tomar dano é a interação mais frequente da sessão e não pode exigir sair da janelinha. A janela
   * cresce uma faixa por barra — ver `alturaExtraCompacta`.
   */
  recursos: RecursoVital[]
  onChangeRecursos: (recursos: RecursoVital[]) => void
}

/** "13+5 + 4" — os dados de cada grupo somados ao modificador, pra conferir o total de relance. */

export function CompactWidget({ presets, result, onRoll, recursos, onChangeRecursos }: CompactWidgetProps) {
  const t = useTranslation()
  const { copyMarkdown } = useSettings()
  /**
   * Os FAVORITOS (spec §3.9) são a fileira do modo compacto — o golpe principal, a percepção, o
   * dano —, na ordem que a pessoa escolheu. Sem nenhum favorito, a fileira mostra todos os
   * presets, como sempre mostrou: uma janelinha vazia porque ninguém marcou estrela seria pior.
   */
  const favoritos = favoritosOrdenados(presets)
  const fileira = favoritos.length > 0 ? favoritos : presets

  /**
   * Todos os dados da jogada, achatados em uma lista. Um preset pode ser 1d20+5 (um dado só) ou
   * 8d6 (oito), e os dois casos precisam caber no mesmo painel.
   */
  const marcasDeManter = result?.keep ? mantidosPorGrupo(result.groups, result.keep) : null
  const dados =
    result?.groups.flatMap((g, gi) =>
      g.rolls.map((valor, i) => ({
        sides: g.sides,
        valor,
        // `null` sem regra de manter: aí não há descarte e nada deve aparecer destacado.
        conta: marcasDeManter ? marcasDeManter[gi][i] : null
      }))
    ) ?? []

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
                    /* Mesma marcação do modo normal: destaque diz QUEM CONTA, não quem é maior. */
                    highlight={d.conta === null ? null : d.conta ? 'high' : 'low'}
                    highlightLabelOverride={
                      d.conta === null ? undefined : d.conta ? t.roller.keptDie : t.roller.discardedDie
                    }
                  />
                ))}
                {excedente > 0 && <span className="compact-stage-excedente">+{excedente}</span>}
              </div>
            )}
            <div className="compact-stage-total">
              <span className="compact-stage-total-label">{t.roller.total}</span>
              <strong className="compact-stage-total-value">{result.total}</strong>
              <MarcaDeCritico result={result} className="compact-stage-marca" />
            </div>
            <span className="compact-stage-detail">
              {result.sourceName ?? result.label} · {rollBreakdown(result)}
            </span>
            {/* O copiar pro chat (spec §3.5) no canto de cima, longe do total e do nome. */}
            <BotaoCopiar pequeno className="compact-stage-copiar" texto={() => linhaParaChat(result, copyMarkdown, rotulosDoChat(t))} />
          </>
        ) : (
          <span className="compact-stage-empty">{t.compact.resultEmpty}</span>
        )}
      </div>

      <BarrasDeRecurso recursos={recursos} onChange={onChangeRecursos} />

      {presets.length === 0 ? (
        <p className="compact-widget-empty">{t.compact.empty}</p>
      ) : (
        <div className="compact-widget-presets">
          {fileira.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="compact-preset"
              onClick={() => onRoll(preset)}
              /* O nome é cortado com reticências num botão estreito; o `title` devolve o nome
                 inteiro e a expressão sem gastar altura, que é o que falta aqui. Preset de
                 fórmula mostra a fórmula — ela É a descrição da rolagem. */
              title={`${preset.name}: ${preset.formula ?? (preset.expression ? expressionLabel(preset.expression) : '')}`}
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
