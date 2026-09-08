import type { DiceExpression } from './dice'
import { MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { parseDiceExpression } from '../dice/parseDiceExpression'

/**
 * COMO SE ROLA um campo da ficha. A ficha importada era um formulário INERTE: mostrava "Agilidade 3"
 * e não fazia nada com isso, num app que é um rolador de dados.
 *
 * O que se guarda é o TIPO da rolagem, nunca a expressão pronta: o valor do campo é editável, e uma
 * expressão gravada na importação envelheceria calada, rolando o +3 de ontem. Quem diz o tipo é o
 * leitor do sistema, porque só ele sabe que 16 vira 1d20+3 em D&D e 3 vira "role 3d20 e fique com o
 * maior" em Ordem Paranormal.
 */
export type SheetRollKind =
  /**
   * O valor é um BÔNUS, e o teste é um d20 — "+5" vira 1d20+5. É a forma mais comum em ficha de RPG:
   * perícia, salvaguarda e bônus de ataque de todo sistema d20 se escrevem assim.
   */
  | 'd20'
  /**
   * O valor é um VALOR DE ATRIBUTO de D&D (3 a 30), e o que rola é o modificador dele:
   * `(valor - 10) / 2` pra baixo. É tipo à parte, e não `d20` com a conta feita na importação, porque
   * a ficha mostra o VALOR: guardando o modificador, ela diria "Força +3" onde o papel dele diz 16.
   */
  | 'd20-valor'
  /**
   * O valor é QUANTOS DADOS se rola, ficando com o melhor: o teste de Ordem Paranormal. O ZERO é o
   * caso especial do sistema, e é por isso que isto não é um `keep` genérico — atributo 0 rola DOIS
   * dados e fica com o PIOR, ou seja, justamente onde a regra pune.
   */
  | 'pool-d20'

/**
 * A rolagem de um campo da ficha, ou `null` se aquele valor não dá rolagem nenhuma. `null` é o caso
 * comum: nome, classe, deslocamento e CA não se rolam, e a tela usa este `null` pra decidir onde NÃO
 * desenhar o botão.
 *
 * Sem `kind` ainda há uma última tentativa: o valor pode ser notação de dado escrita na própria ficha
 * ("2d6+2" na coluna de dano), e é o que faz o botão aparecer numa ficha genérica.
 */
export function rolagemDoCampo(valor: string, kind?: SheetRollKind): DiceExpression | null {
  const limpo = valor.trim()
  if (!limpo) return null

  switch (kind) {
    case 'd20':
      return d20ComBonus(numeroDoCampo(limpo))
    case 'd20-valor': {
      const pontos = numeroDoCampo(limpo)
      if (pontos === null) return null
      return d20ComBonus(Math.floor((pontos - 10) / 2))
    }
    case 'pool-d20':
      return poolDeD20(numeroDoCampo(limpo))
    default:
      // Sem tipo: só resta o que estiver escrito. Ver o comentário acima.
      return parseDiceExpression(limpo)?.expression ?? null
  }
}

/**
 * O NÚMERO que está escrito no campo, ou `null`. Aceita o sinal ("+5") e o lixo em volta ("16 (+3)"),
 * mas NÃO pesca número do meio de uma frase: a busca é ancorada no COMEÇO, senão "Deslocamento
 * 9m/6q" viraria 1d20+9. O intervalo é o que cabe numa ficha — atributo 400 é outra coisa que caiu
 * no campo, um ano, um peso, uma quantia.
 */
function numeroDoCampo(valor: string): number | null {
  const match = /^([+-]?)\s*(\d{1,3})(?!\d)/.exec(valor)
  if (!match) return null
  const numero = Number(match[2]) * (match[1] === '-' ? -1 : 1)
  return Number.isFinite(numero) ? numero : null
}

function d20ComBonus(bonus: number | null): DiceExpression | null {
  if (bonus === null) return null
  return {
    groups: [{ sides: 20, count: 1 }],
    modifiers: bonus === 0 ? [] : [{ type: 'flat', value: bonus }]
  }
}

/**
 * A regra de teste de Ordem Paranormal, com o zero incluído. O teto é o mesmo da rolagem de verdade
 * porque estes dados caem na bandeja 3D: um "40" digitado por engano viraria quarenta dados numa cena
 * que rola quinze.
 */
function poolDeD20(quantidade: number | null): DiceExpression | null {
  if (quantidade === null || quantidade < 0) return null
  if (quantidade > MAX_SIMULTANEOUS_DICE) return null
  if (quantidade === 0) {
    return { groups: [{ sides: 20, count: 2 }], modifiers: [], keep: { mode: 'lowest', count: 1 } }
  }
  if (quantidade === 1) return { groups: [{ sides: 20, count: 1 }], modifiers: [] }
  return {
    groups: [{ sides: 20, count: quantidade }],
    modifiers: [],
    keep: { mode: 'highest', count: 1 }
  }
}

/** Os tipos que existem — usado por quem lê arquivo de disco pra descartar valor inventado. */
const TIPOS: readonly SheetRollKind[] = ['d20', 'd20-valor', 'pool-d20']

/**
 * O tipo de rolagem lido de um arquivo, ou `undefined`. Tipo desconhecido (arquivo editado à mão, ou
 * escrito por uma versão futura) vira "sem tipo", e o campo cai no palpite por notação de dado:
 * perde-se o botão certo, nunca a ficha.
 */
export function normalizarTipoDeRolagem(bruto: unknown): SheetRollKind | undefined {
  return typeof bruto === 'string' && (TIPOS as readonly string[]).includes(bruto)
    ? (bruto as SheetRollKind)
    : undefined
}
