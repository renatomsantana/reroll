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

/**
 * "Tirou o máximo? Rola de novo e soma."
 *
 * A mecânica explosiva, pedida pela spec porque cada sistema de RPG usa a sua: Savage Worlds explode
 * todo dado de traço, Shadowrun explode o 6, Feng Shui explode nas duas pontas. O que TODOS têm em
 * comum é a face máxima concedendo outro lançamento — é essa a forma implementada, e as variações
 * cabem aqui dentro no dia em que forem pedidas, sem mexer em quem chama.
 *
 * O dado explodido continua sendo UM DADO pra regra de manter: um d20 que tirou 20 e depois 7 vale
 * 27, e não "um 20 e um 7". A diferença aparece em "role 3d20 e use o maior", onde a leitura errada
 * faria a cauda de uma explosão competir com os outros dados como se fosse um dado próprio.
 */
export interface ExplodeRule {
  /**
   * Teto de explosões encadeadas POR DADO. Existe porque a cadeia é, em teoria, infinita: um d4 tem
   * 25% de chance de explodir de novo a cada vez, e "em teoria infinito" num laço de verdade é um
   * app travado. Também protege da expressão maliciosa vinda de um preset importado.
   */
  maxChain: number
}

export interface DiceExpression {
  groups: DiceGroup[]
  modifiers: Modifier[]
  keep?: KeepRule
  explode?: ExplodeRule
}

export interface DiceGroupResult {
  sides: number
  /**
   * UM VALOR POR DADO. Sem explosão é a face que caiu; com explosão é a SOMA da cadeia daquele dado
   * (ver `ExplodeRule`).
   *
   * Manter "um por dado" é o que faz a regra de manter, o subtotal e toda a tela continuarem certos
   * sem saber que explosão existe — a alternativa, jogar as faces extras aqui como se fossem dados
   * novos, quebraria as três de uma vez.
   */
  rolls: number[]
  subtotal: number
  /**
   * As faces de cada dado, quando ALGUM explodiu — `chains[i]` são as faces do dado `i`, na ordem.
   *
   * Só existe quando houve explosão de fato, e é só pra tela poder mostrar "20 + 7" em vez de um 27
   * que ninguém sabe de onde veio. Ausente é o caso normal, e aí `rolls` já conta a história toda.
   */
  chains?: number[][]
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
  /** A regra de explosão que valeu nesta rolagem, quando houve uma — ver `ExplodeRule`. */
  explode?: ExplodeRule
  /**
   * A regra de manter que valeu nesta rolagem, quando houve uma.
   *
   * Vai junto do resultado porque `groups` traz TODOS os dados que caíram — inclusive os
   * descartados, que estão lá na bandeja pra pessoa ver — e sem isto a tela não teria como dizer
   * quais deles entraram no total.
   */
  keep?: KeepRule
}
