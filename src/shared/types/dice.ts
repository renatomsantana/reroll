export interface DiceGroup {
  sides: number
  count: number
}

export interface Modifier {
  type: 'flat'
  value: number
}

/**
 * "Fique com os N melhores (ou piores) dados desta rolagem": teste com Agilidade 3 em Ordem
 * Paranormal é "role 3d20 e use o MAIOR", não a soma. Sem ela, o preset importado de uma ficha real
 * dava um total que parecia certo e não era; a conta mora em `manterDados.ts`.
 */
export interface KeepRule {
  mode: 'highest' | 'lowest'
  /** Quantos dados ficam. Maior ou igual ao total de dados equivale a não ter regra. */
  count: number
}

/**
 * "Tirou o máximo? Rola de novo e soma." Cada sistema tem a sua variação, e o que todas têm em comum
 * é a face máxima concedendo outro lançamento.
 *
 * O dado explodido continua sendo UM DADO pra regra de manter: um d20 que tirou 20 e depois 7 vale
 * 27, e não "um 20 e um 7" — a leitura errada faria a cauda competir com os outros dados.
 */
export interface ExplodeRule {
  /**
   * Teto de explosões encadeadas POR DADO: a cadeia é, em teoria, infinita (um d4 tem 25% de chance
   * de explodir de novo a cada vez), e num laço de verdade isso é um app travado.
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
   * UM VALOR POR DADO: sem explosão é a face que caiu, com explosão é a SOMA da cadeia daquele dado.
   * É o que faz a regra de manter, o subtotal e a tela continuarem certos sem saber que explosão
   * existe — jogar as faces extras aqui como dados novos quebraria as três de uma vez.
   */
  rolls: number[]
  subtotal: number
  /**
   * As faces de cada dado, quando ALGUM explodiu — `chains[i]` são as faces do dado `i`, na ordem.
   * Só pra tela mostrar "20 + 7" em vez de um 27 que ninguém sabe de onde veio.
   */
  chains?: number[][]
}

export type AdvantageMode = 'advantage' | 'disadvantage'

export interface RollResult {
  id: string
  label: string
  /**
   * Nome do PRESET que disparou a rolagem ("Bola de fogo"); ausente numa rolagem montada à mão.
   * Existe pro histórico: `label` é a expressão, e duas magias com os mesmos dados ficariam iguais.
   */
  sourceName?: string
  groups: DiceGroupResult[]
  modifierTotal: number
  total: number
  timestamp: number
  advantageMode?: AdvantageMode
  /**
   * A TENTATIVA QUE PERDEU numa rolagem com vantagem ou desvantagem, na forma de `groups`: a mesa
   * quer ver o 4 que ficou de fora do 18, senão "vantagem" é só uma palavra.
   */
  descartados?: DiceGroupResult[]
  /**
   * CRÍTICO / FALHA (spec §3.7), pelo dado natural que contou, segundo a regra do personagem (ver
   * `shared/dice/critico.ts`). Só existem quando VERDADEIROS, e são gravados no resultado pra o
   * histórico não ter que refazer o julgamento com uma regra que pode ter mudado desde a rolagem.
   */
  critico?: boolean
  falha?: boolean
  /** A regra de explosão que valeu nesta rolagem, quando houve uma — ver `ExplodeRule`. */
  explode?: ExplodeRule
  /**
   * A regra de manter que valeu nesta rolagem. Vai junto do resultado porque `groups` traz TODOS os
   * dados que caíram, inclusive os descartados que estão na bandeja: sem isto a tela não teria como
   * dizer quais entraram no total.
   */
  keep?: KeepRule
  /**
   * A FÓRMULA que rolou, na forma canônica, quando veio de um preset de fórmula (ver
   * `rolagemPorEtapas.ts`). A presença dela diz às telas que este resultado NÃO é a soma simples de
   * `groups` + `modifierTotal`, e que as marcas prontas abaixo são a leitura certa.
   */
  formulaTexto?: string
  /**
   * A rolagem inteira contra o alvo da fórmula (`>= 15` no fim): sucesso ou fracasso. Ausente
   * quando a fórmula não tem alvo — aí não há julgamento nenhum a mostrar.
   */
  sucesso?: boolean
  /**
   * Quais dados CONTAM pro total, dado a dado, na forma de `groups`. Nas fórmulas o manter é POR
   * TERMO (e `#` conta em vez de somar), então a tela não tem como refazer a conta a partir de
   * `keep`, que é da rolagem inteira. Só existe quando algum dado ficou de fora.
   */
  mantidos?: boolean[][]
  /**
   * A face DESCARTADA por reroll (`r<2`) de cada dado, `null` onde não houve. Sem isto, a segunda
   * queda aparece sozinha e a primeira some: com a marca, a tela diz "rerolou: caiu 1, ficou 4".
   */
  rerolados?: (number | null)[][]
}
