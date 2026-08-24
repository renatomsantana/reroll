import type { DiceExpression } from './dice'

/**
 * Um preset guarda a rolagem de UM de dois jeitos, nunca dos dois:
 *
 * - `expression`: a forma que a bandeja sempre soube rolar (grupos + modificador + manter +
 *   explosão). É o caso de todo preset antigo e de tudo o que os botões do editor montam.
 * - `formula`: o texto da gramática (`shared/dice/formula.ts`), na forma canônica, pro que a
 *   `DiceExpression` não tem como dizer — reroll, contagem de sucessos, alvo, multiplicação,
 *   manter por grupo. Rola por etapas na cena (ver `rolagemPorEtapas.ts`).
 *
 * Um só dos dois, porque dois retratos da mesma rolagem podem discordar — e aí o preset rolaria
 * diferente do que está escrito, que é exatamente o defeito que este app não aceita.
 */
export interface Preset {
  id: string
  name: string
  icon?: string
  expression?: DiceExpression
  formula?: string
  createdAt: number
  updatedAt: number
}

export type PresetInput = Pick<Preset, 'name' | 'icon' | 'expression' | 'formula'>
