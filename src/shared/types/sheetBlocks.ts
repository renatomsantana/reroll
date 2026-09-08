/**
 * Para onde vai cada GRUPO de uma ficha importada.
 *
 * A primeira versão jogava tudo numa lista só de seções, e ele disse o que isso virava na tela: "as
 * importações de fichas fica uma bagunça, não dá para entender". O pedido foi direto — "backstory pra
 * backstory, inventário pra inventário, atributos pra atributos".
 *
 * Então os grupos que TÊM bloco correspondente caem nele, e só o que sobra vira seção. O casamento é
 * por EXPRESSÃO e não por igualdade porque o nome do grupo vem do leitor de cada sistema, e sistema
 * nenhum é obrigado a chamar as coisas do mesmo jeito.
 */
export type SheetBlockKey = 'attributes' | 'abilities' | 'inventory' | 'appearance' | 'backstory'

/**
 * Os mesmos blocos como LISTA, pra quem precisa percorrer todos — hoje a conferência do payload de
 * importação. O objeto intermediário existe pra lista não poder envelhecer sozinha:
 * `Record<SheetBlockKey, true>` obriga o TypeScript a exigir uma entrada por membro da união, então um
 * bloco novo acrescentado acima QUEBRA A COMPILAÇÃO aqui até ser listado. Um array escrito à mão
 * aceitaria a falta em silêncio, e o sintoma seria o bloco novo chegando vazio na ficha.
 */
const TODOS_OS_BLOCOS: Record<SheetBlockKey, true> = {
  attributes: true,
  abilities: true,
  inventory: true,
  appearance: true,
  backstory: true
}

export const SHEET_BLOCK_KEYS = Object.keys(TODOS_OS_BLOCOS) as SheetBlockKey[]

export const SHEET_BLOCK_MATCHERS: { key: SheetBlockKey; test: RegExp }[] = [
  /**
   * ATRIBUTOS não estão aqui de propósito, e já estiveram: mandá-los pro bloco de texto transformava
   * "Agilidade 1, Força 3" numa lista escrita, que é o contrário de como uma ficha de RPG mostra
   * atributo (caixa, rótulo pequeno, NÚMERO GRANDE). Como seção eles continuam campo a campo, e a ficha
   * os desenha como quadro de valores (ver `secaoDeValores`).
   *
   * PERÍCIAS saíram daqui pelo mesmo motivo: em Ordem Paranormal "Luta 10" é número em caixa, e virava
   * "Luta: 10, Pontaria: 5" em linha corrida. HABILIDADE fica, porque ali se escreve frase. Se o valor
   * for texto longo, a seção volta sozinha ao formato de lista, porque `secaoDeValores` decide pelo
   * TAMANHO do valor e não pelo nome do grupo.
   *
   * `feature` e `trait` estão na lista por causa do leitor de D&D 5e em inglês, que chama esse grupo de
   * "Features": é a palavra da ficha oficial, e sem ela o bloco de características viraria uma seção de
   * formulário com um parágrafo espremido numa caixa de uma linha.
   */
  { key: 'abilities', test: /habilidade|ability|abilit|feature|trait/i },
  { key: 'inventory', test: /invent[áa]rio|inventory|equipamento|equipment|item/i },
  { key: 'appearance', test: /apar[êe]ncia|appearance|descri[çc][ãa]o|description/i },
  { key: 'backstory', test: /hist[óo]ria|backstory|motiva|origem|background/i }
]

/** Bloco da ficha pra um nome de grupo, ou `null` se ele não tem um — aí vira seção. */
export function blockForGroup(group: string): SheetBlockKey | null {
  const limpo = group.trim()
  if (!limpo) return null
  return SHEET_BLOCK_MATCHERS.find((entrada) => entrada.test.test(limpo))?.key ?? null
}

/**
 * Esta seção JÁ É o quadro de atributos do personagem? Se for, a ficha não desenha o bloco livre de
 * atributos embaixo dela. Existe separada de `SHEET_BLOCK_MATCHERS` de propósito: atributo não vira
 * bloco de texto (ver o comentário acima), e o que se decide aqui é só se o bloco livre sobra.
 *
 * A LISTA DE PALAVRAS é o conserto de um defeito medido com quinze fichas de quinze sistemas
 * (`scripts/quinzePerfis.mjs`): a regra reconhecia só "atributo", então Cthulhu e 3D&T
 * ("Características"), Cyberpunk e Kids on Bikes ("Estatísticas") mostravam o quadro de valores certo
 * E um "Atributos" vazio logo abaixo — cinco dos quinze.
 *
 * `characteristic` e `stat` entram pelas fichas em inglês, e não entram sinônimos frouxos como
 * "traços" ou "features": em D&D esses são as CARACTERÍSTICAS DE CLASSE, que vão pro bloco de
 * habilidades, e esconder o quadro de atributos por causa deles seria trocar um defeito por outro.
 */
const SECAO_DE_ATRIBUTOS =
  /atributo|attribute|caracter[íi]stica|characteristic|estat[íi]stica|\bstats?\b/i

export function secaoCobreAtributos(titulo: string): boolean {
  return SECAO_DE_ATRIBUTOS.test(titulo.trim())
}
