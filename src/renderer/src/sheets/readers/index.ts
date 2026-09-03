import type { PdfSheet, SheetImport } from '@shared/types/sheetImport'
import type { Language } from '@shared/types/idioma'
import { genericReader, presetsSemRepetidos } from './generic'
import { presetsDeProsa } from './presetsDeProsa'
import { ordemParanormalReader } from './ordemParanormal'
import { oblivioReader } from './oblivio'
import { dnd5eReader } from './dnd5e'
import { pathfinder2eReader } from './pathfinder2e'
import { assimilacaoReader } from './assimilacao'
import { tormenta20Reader } from './tormenta20'
import { breuReader } from './breu'
import { tenebraReader } from './tenebra'
import { infaernumReader } from './infaernum'
import { shadowdarkReader } from './shadowdark'
import { kidsOnBikesReader } from './kidsOnBikes'
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
  assimilacaoReader,
  tormenta20Reader,
  breuReader,
  tenebraReader,
  infaernumReader,
  shadowdarkReader,
  kidsOnBikesReader,
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
  const lido = escolhido.extract(sheet, idioma)
  /**
   * O que vale pra TODA ficha, depois do leitor: golpe escrito em prosa ("Corte Cruel: Teste de
   * Combate com 2D6+1") vira preset com o nome do golpe — ver `presetsDeProsa`. Roda aqui, e não em
   * cada leitor, porque cada um compõe os presets do seu jeito (D&D e Pathfinder nem aproveitam os
   * do genérico) e o pedido do usuário foi "esse jeito do Oblívio, pra TODAS as fichas".
   */
  const prosa = presetsDeProsa(lido.fields, lido.presets)
  const doLeitor = lido.presets.filter((preset) => !prosa.substituidos.has(preset))
  return { ...lido, presets: presetsSemRepetidos([...doLeitor, ...prosa.presets]) }
}

export type { SheetReader }
