export interface DiceGroup {
  sides: number
  count: number
}

export interface Modifier {
  type: 'flat'
  value: number
}

export interface DiceExpression {
  groups: DiceGroup[]
  modifiers: Modifier[]
}

export interface DiceGroupResult {
  sides: number
  rolls: number[]
  subtotal: number
}

export type AdvantageMode = 'advantage' | 'disadvantage'

export interface RollResult {
  id: string
  label: string
  /**
   * Nome do PRESET que disparou a rolagem ("Bola de fogo"), quando ela veio de um. Ausente numa
   * rolagem montada à mão nos botões de tipo/quantidade, que não tem nome nenhum.
   *
   * Existe pro histórico: `label` é a expressão ("2d20 + 2d6"), e o usuário pediu pra ver "o nome
   * do golpe" ali. Sem isto, duas magias diferentes com os mesmos dados ficam indistinguíveis na
   * lista.
   */
  sourceName?: string
  groups: DiceGroupResult[]
  modifierTotal: number
  total: number
  timestamp: number
  advantageMode?: AdvantageMode
}
