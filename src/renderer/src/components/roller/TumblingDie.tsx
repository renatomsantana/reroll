import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DICE_IMAGES } from '@renderer/assets/dice'
import { colorForDice } from '@shared/diceRegistry'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { DieFace } from './DieFace'
import './TumblingDie.css'

export type DieHighlight = 'high' | 'low' | null

interface TumblingDieProps {
  sides: number
  value: number
  highlight?: DieHighlight
  /**
   * Texto do destaque, quando "maior/menor" não descreve o que ele quer dizer.
   *
   * É o caso da regra de manter: com "role 2d20 e use o MENOR", o dado destacado é o de menor valor,
   * e chamá-lo de "Maior" — que é o texto padrão do destaque azul — diria o oposto da verdade. O
   * destaque ali significa "este conta pro total", não "este é o maior".
   */
  highlightLabelOverride?: string
  /**
   * Onde fica a plaqueta do valor.
   *
   * - `corner` (padrão): encostada no canto inferior direito, como sempre foi.
   * - `center`: EM CIMA da face central do dado. Existe porque as ilustrações já trazem um número
   *   impresso na face do meio (o `d20.png` diz "20"), e num dado grande esse número compete com o
   *   valor sorteado. A plaqueta central cobre o impresso em vez de disputar com ele.
   */
  valuePlacement?: 'corner' | 'center'
  className?: string
  /**
   * `image` (padrão): a ilustração de `assets/dice/` mais a plaqueta com o valor — o desenho de
   * sempre, usado onde o dado aparece pequeno.
   * `face`: a face DESENHADA (`DieFace`), nas cores dos dados do estojo, com o valor dentro dela.
   * É o do modo compacto, onde o dado aparece grande e o clipart preto destoava do resto do app.
   */
  art?: 'image' | 'face'
}

const FLICKER_TICKS = 6
const FLICKER_INTERVAL_MS = 55
const SETTLE_DELAY_MS = 650

/**
 * Dado que "cai na mesa": entra de cima com rotação e posição aleatórias
 * (via CSS custom properties, sorteadas uma vez por instância), quica
 * algumas vezes com amplitude decrescente e assenta. O número real só
 * aparece quando o "quique" termina — antes disso ele chacoalha valores
 * aleatórios. O pai força remount (key por rolagem) pra isso tocar de novo
 * mesmo repetindo o mesmo número.
 */
export function TumblingDie({
  sides,
  value,
  highlight = null,
  highlightLabelOverride,
  valuePlacement = 'corner',
  className = '',
  art = 'image'
}: TumblingDieProps) {
  const t = useTranslation()
  const color = colorForDice(sides)
  const [displayValue, setDisplayValue] = useState(value)
  const [settled, setSettled] = useState(false)

  const throwVars = useMemo<CSSProperties>(
    () =>
      ({
        '--start-x': `${Math.round((Math.random() - 0.5) * 70)}px`,
        '--start-rot': `${Math.round((Math.random() - 0.5) * 720)}deg`,
        '--end-rot': `${Math.round((Math.random() - 0.5) * 26)}deg`
      }) as CSSProperties,
    []
  )

  useEffect(() => {
    let ticks = 0
    const flicker = setInterval(() => {
      ticks += 1
      if (ticks >= FLICKER_TICKS) {
        clearInterval(flicker)
        setDisplayValue(value)
        return
      }
      setDisplayValue(1 + Math.floor(Math.random() * sides))
    }, FLICKER_INTERVAL_MS)

    const settleTimeout = setTimeout(() => setSettled(true), SETTLE_DELAY_MS)

    return () => {
      clearInterval(flicker)
      clearTimeout(settleTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const image = DICE_IMAGES[sides]
  const highlightLabel =
    highlightLabelOverride ??
    (highlight === 'high' ? t.roller.higherDie : highlight === 'low' ? t.roller.lowerDie : null)

  return (
    <div
      /*
       * `tumbling-die-d<lados>` existe pra a folha de estilo saber ONDE fica a face principal de
       * cada arte. Não dá pra usar um só ponto: o "6" está na face esquerda do cubo, o "8" no topo
       * do losango, o "20" no meio do hexágono — e as ilustrações ainda têm proporções diferentes
       * entre si. Ver o bloco de `--value-x`/`--value-y` em `CompactWidget.css`.
       */
      className={`tumbling-die tumbling-die-d${sides} tumbling-die-value-${valuePlacement} ${
        settled ? 'tumbling-die-settled' : ''
      } ${highlight ? `tumbling-die-${highlight}` : ''} ${className}`}
      style={throwVars}
      title={highlightLabel ?? undefined}
      aria-label={highlightLabel ?? undefined}
    >
      {/* Marcador não-dependente de cor (script.md: "não comunicar estado só por cor") —
          o contorno azul/vermelho reforça visualmente, mas quem não distingue cor ainda
          vê ▲/▼ e o título/aria-label. */}
      {highlight && <span className="tumbling-die-badge" aria-hidden="true">{highlight === 'high' ? '▲' : '▼'}</span>}
      {art === 'face' ? (
        // A face desenhada já traz o número dentro dela — sem imagem e sem plaqueta por cima.
        <DieFace sides={sides} value={displayValue} />
      ) : (
        <>
          {image && <img className="tumbling-die-img" src={image} alt="" draggable={false} />}
          <span className="tumbling-die-value" style={{ background: color.bg, color: color.text }}>
            {displayValue}
          </span>
        </>
      )}
    </div>
  )
}
