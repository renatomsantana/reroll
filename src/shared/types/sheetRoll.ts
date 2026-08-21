import type { DiceExpression } from './dice'
import { MAX_SIMULTANEOUS_DICE } from '../diceRegistry'
import { parseDiceExpression } from '../dice/parseDiceExpression'

/**
 * COMO SE ROLA um campo da ficha.
 *
 * A ficha importada era um formulário INERTE: mostrava "Agilidade 3" e "Percepção +5" e não fazia
 * nada com isso. Só que ninguém consulta a ficha por consultar — consulta pra rolar, e o app é um
 * rolador de dados. Com isto, o número que está na ficha vira a rolagem que aquele número significa
 * NAQUELE sistema, com um clique.
 *
 * O que se guarda é o TIPO da rolagem, nunca a expressão pronta. A diferença importa: o valor do
 * campo é editável — sobe de nível, ganha bônus, muda no meio da sessão —, e uma expressão gravada
 * na importação envelheceria calada, rolando o +3 de ontem depois de o jogador escrever 5 na ficha.
 * Guardando o tipo, a expressão é montada NO CLIQUE, a partir do que está escrito ali agora.
 *
 * Quem diz o tipo é o leitor do sistema (ver `sheets/readers/`), porque isto é exatamente o que só
 * quem conhece o sistema sabe: em D&D um atributo 16 vira 1d20+3, e em Ordem Paranormal um atributo
 * 3 vira "role 3d20 e fique com o maior". O mesmo "3" escrito na ficha, duas rolagens diferentes.
 */
export type SheetRollKind =
  /**
   * O valor é um BÔNUS, e o teste é um d20 — "+5" vira 1d20+5. É a forma mais comum em ficha de RPG:
   * perícia, salvaguarda e bônus de ataque de D&D e de todo sistema d20 se escrevem assim, porque o
   * dado está implícito no sistema e só o número muda de personagem pra personagem.
   */
  | 'd20'
  /**
   * O valor é um VALOR DE ATRIBUTO de D&D (3 a 30), e o que entra na rolagem é o modificador dele:
   * `(valor - 10) / 2` arredondado pra baixo. Força 16 rola 1d20+3.
   *
   * É um tipo à parte, e não o `d20` com a conta já feita na importação, porque a ficha mostra o
   * VALOR — é isso que o jogador lê e edita quando o personagem sobe de nível. Se o campo guardasse
   * o modificador, a ficha mostraria "Força +3" onde o papel dele diz 16, e ninguém reconheceria a
   * própria ficha.
   */
  | 'd20-valor'
  /**
   * O valor é QUANTOS DADOS se rola, ficando com o melhor — a regra de teste de Ordem Paranormal:
   * atributo 3 quer dizer "role 3d20 e use o maior".
   *
   * O ZERO é o caso especial do sistema, e é por isso que este tipo não é um `keep` genérico:
   * atributo 0 rola DOIS dados e fica com o PIOR. Sem tratá-lo aqui, um agente com atributo zero
   * ou não rolaria nada (0 dados) ou rolaria com vantagem justamente onde a regra pune.
   */
  | 'pool-d20'

/**
 * A rolagem de um campo da ficha, ou `null` se aquele valor não dá rolagem nenhuma.
 *
 * `null` não é falha: é o caso comum. Campo de nome, de classe, de deslocamento e de CA existem aos
 * montes numa ficha e não se rolam — e a tela usa este `null` pra decidir onde NÃO desenhar o botão
 * de dado. Um botão que rola "Agente de Saúde" seria pior que botão nenhum.
 *
 * Sem `kind`, ainda há uma última tentativa: o valor pode ser notação de dado escrita na própria
 * ficha ("2d6+2" na coluna de dano). Isso vale pra QUALQUER sistema, inclusive os que ninguém
 * cadastrou aqui, e é o que faz o botão de rolar aparecer numa ficha genérica importada de um
 * sistema que este app nunca viu.
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
 * O NÚMERO que está escrito no campo, ou `null`.
 *
 * Aceita o sinal ("+5", "-1") porque é assim que ficha de RPG escreve bônus, e aceita o lixo em
 * volta ("+5 (treinado)", "16 (+3)") porque ficha preenchida à mão tem de tudo. O que ele NÃO faz é
 * pescar um número do meio de uma frase: a busca é ancorada no COMEÇO do valor, senão "Deslocamento
 * 9m/6q" viraria uma rolagem de 1d20+9.
 *
 * O intervalo é o que cabe numa ficha: nada de RPG tem atributo 400, e um número desses quase sempre
 * é outra coisa que caiu no campo (um ano, um peso, uma quantia de dinheiro).
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
 * A regra de teste de Ordem Paranormal, com o zero incluído: N dados e fica com o melhor; zero rola
 * dois e fica com o PIOR.
 *
 * O teto é o mesmo da rolagem de verdade (`MAX_SIMULTANEOUS_DICE`) porque estes dados caem na
 * bandeja 3D: um campo com "40" digitado por engano viraria quarenta dados numa cena que rola quinze
 * — truncados na hora de rolar, com o total sem relação nenhuma com o rótulo. Acima do teto é erro
 * de digitação, não personagem, e nesse caso não rolar é mais honesto que rolar outra coisa.
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
 * O tipo de rolagem lido de um arquivo, ou `undefined`.
 *
 * O `notes.json` é editável à mão e sobrevive a versões do app, então um `roll` gravado pode ser
 * qualquer coisa — inclusive um tipo que existiu numa versão futura e foi removido. Um tipo
 * desconhecido vira "sem tipo", que faz o campo cair no palpite por notação de dado: perde-se o
 * botão certo, nunca a ficha.
 */
export function normalizarTipoDeRolagem(bruto: unknown): SheetRollKind | undefined {
  return typeof bruto === 'string' && (TIPOS as readonly string[]).includes(bruto)
    ? (bruto as SheetRollKind)
    : undefined
}
