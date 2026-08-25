import type { RollResult } from '@shared/types/dice'
import { useTranslation } from '@renderer/i18n/useTranslation'

/**
 * A MARCA de crítico (⭐) e de falha (💀) ao lado do total (spec §3.7) — na linha de resultado, no
 * histórico e no painel compacto, sempre a mesma. Lê as marcas gravadas na rolagem, não refaz o
 * julgamento: a regra do personagem pode ter mudado desde que ela caiu.
 */
export function MarcaDeCritico({ result, className }: { result: Pick<RollResult, 'critico' | 'falha'>; className?: string }) {
  const t = useTranslation()
  if (!result.critico && !result.falha) return null
  return (
    <span className={`marca-de-critico ${className ?? ''}`}>
      {result.critico && (
        <span role="img" aria-label={t.roller.critical} title={t.roller.critical}>
          ⭐
        </span>
      )}
      {result.falha && (
        <span role="img" aria-label={t.roller.fumble} title={t.roller.fumble}>
          💀
        </span>
      )}
    </span>
  )
}
