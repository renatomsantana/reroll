import { describe, it } from 'vitest'
import { readSheet } from './readers/index'
import { montarFicha } from '@shared/types/montarFicha'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'

/**
 * FERRAMENTA, não teste: despeja o que o importador leu de um PDF, campo por campo.
 *
 * Não afirma nada e pula sozinho quando não recebe arquivo — quem manda é a variável `FICHAS`, com
 * os caminhos separados por `|`:
 *
 *     FICHAS="Fichas RPG/a.pdf|Fichas RPG/b.pdf" npx vitest run src/renderer/src/sheets/dump.node.test.ts --reporter=verbose
 *
 * Existe porque toda melhoria no scraping começou do mesmo jeito: olhar a lista inteira do que saiu
 * de uma ficha de verdade e achar a linha que não deveria estar ali. As afirmações moram em
 * `fichasReais.node.test.ts`; aqui é só o olho.
 */

/**
 * Abre pelo MESMO caminho da produção (`abrirPdfNoNode` → `sheetFromPdfDocument`).
 *
 * Esta função já foi uma cópia da varredura, e a cópia mentia: ela exigia `fieldValue` string e
 * assim descartava todo campo de LISTA do PDF — na ficha de Ordem Paranormal isso são a Classe, a
 * Origem e o NEX, que sumiam do dump enquanto apareciam no app. Uma ferramenta de conferência que
 * mostra menos que o app é pior que não ter ferramenta.
 */
const ARQUIVOS = (process.env.FICHAS ?? '').split('|').filter(Boolean)

describe.skipIf(ARQUIVOS.length === 0)('dump', () => {
  for (const arquivo of ARQUIVOS) {
    it(arquivo, async () => {
      const sheet = await abrirPdfNoNode(arquivo)
      const lido = readSheet(sheet)
      console.log(`\n===== ${arquivo}`)
      console.log(`leitor=${lido.readerId} sistema=${JSON.stringify(lido.system)} nome=${JSON.stringify(lido.characterName)}`)
      for (const a of lido.warnings) console.log(`  AVISO: ${a}`)
      console.log(`campos (${lido.fields.length}):`)
      for (const c of lido.fields)
        console.log(`  [${c.group ?? '-'}] ${c.label} = ${JSON.stringify(c.value)}  (campo ${c.fieldName ?? '-'}${c.roll ? `, rola ${c.roll}` : ''})`)
      if (lido.rawText) for (const l of lido.rawText.split('\n')) console.log(`    | ${l}`)
      const ficha = montarFicha(lido.fields, lido.rawText)
      console.log('--- COMO FICA NA ABA FICHA ---')
      for (const [bloco, texto] of Object.entries(ficha.blocks)) {
        console.log(`  BLOCO ${bloco}:`)
        for (const l of String(texto).split('\n')) console.log(`      ${l}`)
      }
      for (const secao of ficha.sections) {
        console.log(`  SEÇÃO "${secao.title}" (${secao.fields.length} campos):`)
        for (const c of secao.fields) console.log(`      ${c.label} = ${JSON.stringify(c.value)}`)
      }
      console.log(`presets (${lido.presets.length}):`)
      for (const p of lido.presets) console.log(`  ${p.kind ?? '-'} ${p.name} <= ${JSON.stringify(p.source)}`)
    }, 60_000)
  }
})
