/**
 * Para onde vai cada GRUPO de uma ficha importada. A primeira versão jogava tudo numa lista só de
 * seções, e ele disse o que isso virava na tela: "as importações de fichas fica uma bagunça, não dá
 * para entender". Os grupos que TÊM bloco caem nele, e só o que sobra vira seção.
 *
 * O casamento é por EXPRESSÃO e não por igualdade porque o nome do grupo vem do leitor de cada
 * sistema, e sistema nenhum é obrigado a chamar as coisas do mesmo jeito.
 */
export type SheetBlockKey = 'attributes' | 'abilities' | 'inventory' | 'appearance' | 'backstory'

/**
 * Os mesmos blocos como LISTA. O objeto intermediário existe pra lista não envelhecer sozinha:
 * `Record<SheetBlockKey, true>` obriga uma entrada por membro da união, então um bloco novo lá em
 * cima QUEBRA A COMPILAÇÃO aqui até ser listado. Um array à mão aceitaria a falta em silêncio, e o
 * sintoma seria o bloco novo chegando vazio na ficha.
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
   * "Agilidade 1, Força 3" numa lista escrita, o contrário de como uma ficha mostra atributo (caixa,
   * rótulo pequeno, NÚMERO GRANDE). Como seção eles ficam campo a campo, e a ficha os desenha como
   * quadro de valores (ver `secaoDeValores`). PERÍCIAS saíram pelo mesmo motivo; HABILIDADE fica,
   * porque ali se escreve frase.
   *
   * `feature` e `trait` estão na lista por causa do leitor de D&D 5e em inglês, que chama esse grupo
   * de "Features": é a palavra da ficha oficial.
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
 * atributos embaixo dela. Fica separada de `SHEET_BLOCK_MATCHERS` porque atributo não vira bloco de
 * texto (ver acima): o que se decide aqui é só se o bloco livre sobra.
 *
 * A LISTA DE PALAVRAS conserta um defeito medido com quinze fichas de quinze sistemas
 * (`scripts/quinzePerfis.mjs`): a regra reconhecia só "atributo", e Cthulhu, 3D&T, Cyberpunk e Kids
 * on Bikes mostravam o quadro certo E um "Atributos" vazio abaixo — cinco dos quinze. Não entram
 * sinônimos frouxos como "traços" ou "features": em D&D esses são as características de CLASSE.
 */
const SECAO_DE_ATRIBUTOS =
  /atributo|attribute|caracter[íi]stica|characteristic|estat[íi]stica|\bstats?\b/i

export function secaoCobreAtributos(titulo: string): boolean {
  return SECAO_DE_ATRIBUTOS.test(titulo.trim())
}
