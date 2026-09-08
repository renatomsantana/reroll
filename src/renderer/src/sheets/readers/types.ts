import type { PdfSheet, SheetImport } from '@shared/types/sheetImport'
import type { Language } from '@shared/types/idioma'

/**
 * Um LEITOR DE FICHA: sabe reconhecer um sistema de RPG num PDF e tirar dele um personagem.
 *
 * É o ponto de extensão do importador inteiro, e existe por pedido explícito dele: "outros usuários
 * irão colocar suas próprias fichas de RPG e precisamos estar prontos pra isso". Acrescentar um
 * sistema é escrever UM arquivo com estas duas funções e citá-lo em `index.ts`.
 *
 * Duas decisões sustentam isso: `extract` é função PURA de `PdfSheet` pra `SheetImport` — não abre
 * arquivo, não toca em disco, não depende do Electron, e é obrigatório que dê pra testar com um objeto
 * escrito à mão, porque as fichas de referência estão no `.gitignore`; e sempre há o leitor GENÉRICO
 * por baixo, que não conhece sistema nenhum e ainda assim entrega nome, campos e presets, que é a
 * diferença entre "não suportamos essa ficha" e "importamos o que deu".
 */
export interface SheetReader {
  /** Estável e sem espaços — vai gravado junto do que foi importado. */
  id: string
  /** Como o sistema se chama pra quem lê a tela. */
  label: string
  /**
   * O quanto este leitor reconhece esta ficha, de 0 a 1. Quem devolver o maior número é escolhido.
   *
   * É número e não booleano porque duas fichas do mesmo sistema podem ser versões diferentes, e um
   * leitor que reconhece "meia ficha" ainda é melhor que o genérico. Por convenção: 0 = não é minha;
   * 0.5 = tem cara de ser; 0.9+ = achei as marcas que só esta ficha tem.
   */
  detect: (sheet: PdfSheet) => number
  /**
   * O `idioma` é o da INTERFACE, e serve pros rótulos que o leitor INVENTA. Só importa pra sistema
   * publicado em outra língua que não a de quem joga — na prática, D&D 5e: a ficha oficial é inglesa e
   * os nomes de campo dela são o que o leitor reconhece, então o rótulo que vai pra tela é escolha
   * nossa. Sem isto, ou o brasileiro via "Deception" ou o americano via "Enganação".
   *
   * Leitor de sistema BRASILEIRO ignora este parâmetro de propósito: os rótulos saem do que está
   * impresso na ficha, e traduzir "Agilidade" faria a tela deixar de bater com o papel.
   */
  extract: (sheet: PdfSheet, idioma: Language) => SheetImport
}
