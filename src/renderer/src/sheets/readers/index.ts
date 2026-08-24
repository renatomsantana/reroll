import type { PdfSheet, SheetImport } from '@shared/types/sheetImport'
import type { Language } from '@shared/types/idioma'
import { genericReader } from './generic'
import { ordemParanormalReader } from './ordemParanormal'
import { oblivioReader } from './oblivio'
import { dnd5eReader } from './dnd5e'
import { pathfinder2eReader } from './pathfinder2e'
import type { SheetReader } from './types'

/**
 * O REGISTRO de leitores de ficha.
 *
 * PRA ACRESCENTAR UM SISTEMA DE RPG: escreva um arquivo ao lado deste exportando um `SheetReader`
 * (copie `ordemParanormal.ts`, que é o exemplo completo), acrescente-o à lista abaixo, e escreva um
 * teste com uma `PdfSheet` montada à mão. Nada mais no app precisa ser tocado — nem a tela, nem o
 * IPC, nem o armazenamento. Essa é a razão de o importador ter esta forma: o usuário avisou que
 * "outros usuários irão colocar suas próprias fichas de RPG".
 *
 * A ordem da lista não importa: quem decide é o `detect` de cada um, comparando confiança.
 */
export const SHEET_READERS: SheetReader[] = [
  ordemParanormalReader,
  oblivioReader,
  dnd5eReader,
  pathfinder2eReader,
  genericReader
]

/**
 * Escolhe o leitor e lê a ficha.
 *
 * O genérico está sempre no fim e devolve 0.1 fixo, então SEMPRE há um vencedor — não existe o caso
 * "nenhum leitor serviu", que na tela viraria uma janela vazia sem explicação. O pior resultado
 * possível é uma importação genérica com aviso dizendo o que não deu pra ler.
 */
export function readSheet(sheet: PdfSheet, idioma: Language = 'pt-BR'): SheetImport {
  let escolhido = SHEET_READERS[0]
  let melhor = -1
  for (const leitor of SHEET_READERS) {
    const confianca = leitor.detect(sheet)
    if (confianca > melhor) {
      melhor = confianca
      escolhido = leitor
    }
  }
  return escolhido.extract(sheet, idioma)
}

export type { SheetReader }
