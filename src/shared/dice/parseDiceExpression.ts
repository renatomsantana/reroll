import type { DiceExpression } from '../types/dice'
import { DEFAULT_DICE_SIDES, MAX_SIMULTANEOUS_DICE } from '../diceRegistry'

/**
 * Lê uma expressão de dado escrita à mão e devolve a rolagem correspondente — "1d20+5", "2d6 + 3",
 * "d8-1", "3D10".
 *
 * É o coração do importador de fichas: é isto que transforma o que está escrito na coluna DANO de
 * uma ficha em algo que o app sabe rolar. E é o que faz o importador servir pra ficha que eu nunca
 * vi, que é o pedido do usuário ("outros usuários irão colocar suas próprias fichas"): qualquer
 * sistema de RPG escreve dado da mesma forma, então uma ficha desconhecida ainda entrega presets se
 * tiver notação de dado em algum lugar.
 *
 * O que ele ACEITA, e por quê:
 *
 * - `d` maiúsculo ou minúsculo, com ou sem quantidade (`d20` é 1d20, que é como quase toda ficha
 *   escreve);
 * - espaço em volta dos sinais, porque ficha preenchida à mão tem de tudo;
 * - vários grupos e vários modificadores somados ("1d8+1d6+2"), que é como se escreve dano com
 *   bônus elemental;
 * - subtração, virando modificador negativo.
 *
 * O que ele RECUSA, de propósito:
 *
 * - tipo de dado que o app não tem (`1d3`, `1d30`): o app rola sete tipos, e prometer um oitavo na
 *   tela de conferência seria mentira. Vira aviso, não preset;
 * - quantidade zero ou absurda: ficha com "0d6" ou "999d6" é erro de digitação ou texto que só
 *   PARECE dado, e 999 dados na bandeja é uma cena travada;
 * - texto sem nenhum dado ("Espada longa"), que devolve `null` — sem isso, cada rótulo da ficha
 *   viraria um preset vazio.
 */

/**
 * Teto de dados: o MESMO da rolagem (`MAX_SIMULTANEOUS_DICE`), e não um número novo. Um preset
 * importado que passasse disso seria aceito aqui e truncado calado na hora de rolar.
 */
const MAX_COUNT = MAX_SIMULTANEOUS_DICE

export interface ParsedDiceExpression {
  expression: DiceExpression
  /** Trecho exato que foi reconhecido, pra tela poder mostrar de onde veio. */
  matched: string
}

/**
 * `(\d*)[dD](\d+)` pega os grupos de dado e `([+-]\s*\d+)` os modificadores soltos. A varredura é
 * feita sobre a string inteira em vez de exigir que ela seja SÓ a expressão: numa ficha a célula
 * costuma ser "Pistola 1d12+2 (curto)", e recusar por causa do resto seria recusar a ficha toda.
 *
 * O `(?!\s*[dD]\s*\d)` no fim do ramo do modificador é o que impede o erro que o teste pegou: em
 * "9d6+9d6" o ramo do modificador casava "+9" ANTES de o ramo do dado ver que aquele 9 era a
 * quantidade do grupo seguinte. Saíam 10d6+9 no lugar de 18d6 — errado, e errado de um jeito
 * plausível. Dano com bônus elemental ("1d8+1d6") é escrito assim em quase todo sistema, então
 * este caso não é exceção: é rotina.
 */
const TOKEN = /(\d*)\s*[dD]\s*(\d+)|([+-])\s*(\d+)(?!\s*[dD]\s*\d)/g

export function parseDiceExpression(input: string): ParsedDiceExpression | null {
  if (!input) return null

  const groups: { sides: number; count: number }[] = []
  let modifier = 0
  let inicioMatch = -1
  let fimMatch = -1
  let temDado = false

  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(input)) !== null) {
    const [inteiro, quantidade, lados, sinal, valor] = match

    if (lados !== undefined) {
      const sides = Number(lados)
      const count = quantidade === '' || quantidade === undefined ? 1 : Number(quantidade)
      // Tipo que o app não rola, ou quantidade impossível: para a leitura aqui. Não é "ignora e
      // continua" porque o resto da linha provavelmente pertence a essa mesma expressão, e aproveitar
      // metade dela produziria um preset silenciosamente errado.
      if (!DEFAULT_DICE_SIDES.includes(sides)) return null
      if (count < 1) return null

      const existente = groups.find((g) => g.sides === sides)
      if (existente) existente.count += count
      else groups.push({ sides, count })
      if (groups.reduce((soma, g) => soma + g.count, 0) > MAX_COUNT) return null
      temDado = true
    } else if (temDado) {
      /**
       * Modificador só conta DEPOIS de um dado. Antes, quase sempre é outra coisa: numeração de
       * linha, alcance, "+2" de uma coluna vizinha que o extrator juntou na mesma string.
       */
      modifier += sinal === '-' ? -Number(valor) : Number(valor)
    } else {
      continue
    }

    if (inicioMatch === -1) inicioMatch = match.index
    fimMatch = match.index + inteiro.length
  }

  if (!temDado) return null

  return {
    expression: {
      groups,
      modifiers: modifier === 0 ? [] : [{ type: 'flat', value: modifier }]
    },
    matched: input.slice(inicioMatch, fimMatch).trim()
  }
}

/**
 * Bônus solto ("+7", "5", "-1") virando um teste de d20 — o caso da coluna TESTE de uma ficha, que
 * quase nunca traz "1d20+7" escrito por extenso: traz só o número, porque o d20 está implícito no
 * sistema.
 *
 * Fica SEPARADO de `parseDiceExpression` de propósito. Aqui existe um palpite embutido (o de que o
 * teste é um d20), e palpite embutido tem que ser escolha de quem chama: um leitor de sistema que
 * usa d100 ou 2d6 para testes não pode ser servido por esta função sem que ela minta.
 */
export function parseTestBonus(input: string, sides = 20): DiceExpression | null {
  const limpo = input.trim()
  if (!limpo) return null
  // Só número, com sinal opcional. Qualquer outra coisa (palavra, dado escrito, dois números) sai
  // por aqui — quem tem notação de dado deve passar por `parseDiceExpression`, que lê de verdade.
  const match = /^([+-]?)\s*(\d{1,2})$/.exec(limpo)
  if (!match) return null
  const valor = Number(match[2]) * (match[1] === '-' ? -1 : 1)
  return {
    groups: [{ sides, count: 1 }],
    modifiers: valor === 0 ? [] : [{ type: 'flat', value: valor }]
  }
}
