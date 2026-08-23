/**
 * Para onde vai cada GRUPO de uma ficha importada.
 *
 * A primeira versão do importador jogava tudo numa lista só de seções, e o usuário disse o que isso
 * virava na tela: "as importações de fichas fica uma bagunça, não dá para entender". O pedido foi
 * direto — "backstory pra backstory, inventário pra inventário, atributos pra atributos".
 *
 * Então os grupos que TÊM um bloco correspondente na ficha caem nele, e só o que sobra vira seção.
 * Numa ficha de Ordem Paranormal isso deixa Atributos no bloco de atributos e mantém Identificação e
 * Recursos como seções — que é o desenho da ficha de verdade.
 *
 * O casamento é por EXPRESSÃO e não por igualdade porque o nome do grupo vem do leitor de cada
 * sistema, e sistema nenhum é obrigado a chamar as coisas do mesmo jeito.
 */
export type SheetBlockKey = 'attributes' | 'abilities' | 'inventory' | 'appearance' | 'backstory'

/**
 * Os mesmos blocos como LISTA, pra quem precisa percorrer todos — hoje a conferência do payload de
 * importação (`validarSheetApplyPayload`), que só deixa passar chave conhecida.
 *
 * O objeto intermediário existe pra lista não poder envelhecer sozinha: `Record<SheetBlockKey, true>`
 * obriga o TypeScript a exigir uma entrada por membro da união, então um bloco novo acrescentado ali
 * em cima QUEBRA A COMPILAÇÃO aqui até ser listado. Um array escrito à mão aceitaria a falta em
 * silêncio, e o sintoma seria o bloco novo chegando vazio na ficha de quem importa.
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
   * ATRIBUTOS não estão aqui de propósito, e já estiveram.
   *
   * Mandá-los pro bloco de texto transformava "Agilidade 1, Força 3" numa lista escrita — que é o
   * contrário de como uma ficha de RPG mostra atributo: caixa, rótulo pequeno, NÚMERO GRANDE. Como
   * seção eles continuam campo a campo, e a ficha os desenha como quadro de valores (ver
   * `secaoDeValores` em `SheetTab.tsx`).
   *
   * PERÍCIAS saíram daqui pelo mesmo motivo, depois que passaram a ser importadas de verdade: em
   * Ordem Paranormal "Luta 10" é número em caixa, igual a atributo, e virava "Luta: 10, Pontaria: 5"
   * escrito em linha corrida. HABILIDADE fica: ali se escreve frase, não número.
   *
   * Se o valor for texto longo — que é o que acontece quando uma ficha genérica tem um campo
   * "Perícias" com a lista escrita dentro —, a seção volta sozinha ao formato de lista, porque
   * `secaoDeValores` decide pelo TAMANHO do valor e não pelo nome do grupo.
   */
  /**
   * `feature` e `trait` estão aqui por causa do leitor de D&D 5e em inglês, que chama esse grupo de
   * "Features" — é a palavra que a ficha oficial usa, e sem ela o bloco de características viraria
   * uma seção de formulário com um parágrafo espremido dentro de uma caixa de uma linha.
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
 * atributos embaixo dela (ver `cobertosPorSecao` em `SheetTab.tsx`).
 *
 * Existe separada de `SHEET_BLOCK_MATCHERS` de propósito: atributo NÃO vira bloco de texto (ver o
 * comentário grande lá em cima — número em caixa é como ficha de RPG mostra atributo). O que se
 * decide aqui é só se o bloco livre sobra ou não.
 *
 * A LISTA DE PALAVRAS é o conserto de um defeito medido com quinze fichas de quinze sistemas
 * (`scripts/quinzePerfis.mjs`): a regra reconhecia só "atributo", então Cthulhu e 3D&T
 * ("Características"), Cyberpunk e Kids on Bikes ("Estatísticas") mostravam o quadro de valores
 * certo E um "Atributos" vazio logo abaixo — cinco dos quinze. É exatamente a tela com dois lugares
 * pedindo a mesma coisa que a regra existia pra evitar; ela só não conhecia as outras palavras.
 *
 * `characteristic` e `stat` entram pelas fichas em inglês. Não entram sinônimos frouxos como
 * "traços" ou "features": em D&D esses são as CARACTERÍSTICAS DE CLASSE, que vão pro bloco de
 * habilidades (ver o matcher de `abilities`) — esconder o quadro de atributos por causa deles seria
 * trocar um defeito por outro.
 */
const SECAO_DE_ATRIBUTOS =
  /atributo|attribute|caracter[íi]stica|characteristic|estat[íi]stica|\bstats?\b/i

export function secaoCobreAtributos(titulo: string): boolean {
  return SECAO_DE_ATRIBUTOS.test(titulo.trim())
}
