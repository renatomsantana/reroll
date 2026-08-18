import type { DiceExpression } from './dice'

export interface Preset {
  id: string
  name: string
  icon?: string
  expression: DiceExpression
  createdAt: number
  updatedAt: number
}

export type PresetInput = Pick<Preset, 'name' | 'icon' | 'expression'>
