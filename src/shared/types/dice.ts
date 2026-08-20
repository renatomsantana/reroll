export interface DiceGroup {
  sides: number
  count: number
}

export interface Modifier {
  type: 'flat'
  value: number
}

/**
 * "Fique com os N melhores (ou piores) dados desta rolagem."
 *
 * É a regra de Ordem Paranormal — teste com Agilidade 3 é "role 3d20 e use o MAIOR", não a soma — e
 * de vários outros sistemas. Sem ela, o preset importado de uma ficha real dava um total que parecia
 * certo e não era. Ver `manterDados.ts`, onde a conta mora.
 *
 * É OPCIONAL, e a ausência dela quer dizer "some tudo", que é o comportamento de sempre: nenhum
 * preset gravado antes disto muda de resultado.
 */
export interface KeepRule {
  mode: 'highest' | 'lowest'
  /** Quantos dados ficam. Maior ou igual ao total de dados equivale a não ter regra. */
  count: number
}

export interface DiceExpression {
  groups: DiceGroup[]
  modifiers: Modifier[]
  keep?: KeepRule
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
  /**
   * A regra de manter que valeu nesta rolagem, quando houve uma.
   *
   * Vai junto do resultado porque `groups` traz TODOS os dados que caíram — inclusive os
   * descartados, que estão lá na bandeja pra pessoa ver — e sem isto a tela não teria como dizer
   * quais deles entraram no total.
   */
  keep?: KeepRule
}
