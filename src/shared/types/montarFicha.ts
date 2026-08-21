import type { SheetImportField } from './sheetImport'
import type { SheetRollKind } from './sheetRoll'
import { blockForGroup, type SheetBlockKey } from './sheetBlocks'

/**
 * O que a ficha importada VIRA na ficha do personagem.
 *
 * É a tradução do pedido do usuário — "backstory pra backstory, inventário pra inventário, atributos
 * pra atributos" — e antes ela morava dentro de um `useMemo` da tela de conferência, onde não tinha
 * como ser testada. É o passo com mais chance de estragar a importação em silêncio: um campo que cai
 * no bloco errado não dá erro nenhum, só aparece na aba errada e o usuário descobre depois.
 */

export interface FichaMontada {
  blocks: Partial<Record<SheetBlockKey, string>>
  sections: { title: string; fields: CampoMontado[] }[]
}

export interface CampoMontado {
  label: string
  value: string
  /**
   * Como se rola este campo, vindo do leitor (ver `sheetRoll.ts`). Atravessa daqui até o disco sem
   * ninguém reinterpretar: o que sabe o que é um atributo de Ordem Paranormal é o leitor, e refazer
   * esse palpite mais adiante — pelo nome da seção, pelo formato do valor — seria criar uma segunda
   * régua pra mesma pergunta.
   */
  roll?: SheetRollKind
}

/**
 * Título da seção pro campo que veio SEM grupo — o leitor não soube onde ele mora.
 *
 * Era "Ficha", e o usuário apontou: dentro da aba FICHA, uma seção chamada "FICHA" não informa nada.
 * "Outros" pelo menos diz a verdade — é o que sobrou depois de tudo que tinha lugar certo.
 */
const SEM_GRUPO = 'Outros'

export function montarFicha(campos: SheetImportField[], textoSolto?: string): FichaMontada {
  const porBloco = new Map<SheetBlockKey, string[]>()
  const porTitulo = new Map<string, CampoMontado[]>()

  for (const campo of campos) {
    const grupo = campo.group?.trim() ?? ''
    const bloco = blockForGroup(grupo)
    if (bloco) {
      // No bloco, cada campo vira uma linha "Rótulo: valor" — é texto livre, não tem outra forma.
      const linhas = porBloco.get(bloco) ?? []
      linhas.push(`${campo.label}: ${campo.value}`)
      porBloco.set(bloco, linhas)
      continue
    }
    // "Ficha" é honesto e não inventa um sistema que ninguém reconheceu.
    const titulo = grupo || SEM_GRUPO
    const lista = porTitulo.get(titulo) ?? []
    lista.push({ label: campo.label, value: campo.value, roll: campo.roll })
    porTitulo.set(titulo, lista)
  }

  const blocks: Partial<Record<SheetBlockKey, string>> = {}
  for (const [chave, linhas] of porBloco) blocks[chave] = linhas.join('\n')

  /**
   * O texto SEM RÓTULO vai pro bloco de HISTÓRIA — o único da ficha que é texto livre de verdade.
   * Os outros têm assunto ("Inventário", "Aparência") e este não tem: ele existe porque a ficha era
   * uma imagem e não deu pra saber o assunto de nada. Entra DEPOIS do que já estiver lá, pra nunca
   * cobrir conteúdo que veio rotulado.
   */
  if (textoSolto) {
    blocks.backstory = [blocks.backstory, textoSolto].filter(Boolean).join('\n\n')
  }

  return {
    blocks,
    sections: [...porTitulo].map(([title, fields]) => ({ title, fields }))
  }
}
