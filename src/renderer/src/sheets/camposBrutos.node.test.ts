import { describe, it } from 'vitest'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'

/**
 * OS CAMPOS CRUS DO PDF, antes de qualquer leitor: nome, tipo, página, retângulo e valor. É o que se
 * olha pra escrever o leitor dedicado de uma ficha ("cada um com seu jeito específico dependendo do
 * PDF"): o nome do campo é o que o leitor procura, e o retângulo diz em que linha/coluna ele está.
 *
 *     FICHAS="Fichas RPG/ficha Go.pdf" FILTRO="^spells" npx vitest run camposBrutos --reporter=verbose
 *
 * `FILTRO` é uma expressão regular (sem distinguir maiúsculas) sobre o nome do campo; sem ela saem
 * todos. `SO_PREENCHIDOS=1` esconde os vazios. Ficha sem formulário lista os fragmentos de texto.
 */
const ARQUIVOS = (process.env.FICHAS ?? '').split('|').filter(Boolean)
const FILTRO = process.env.FILTRO ? new RegExp(process.env.FILTRO, 'i') : null
const SO_PREENCHIDOS = process.env.SO_PREENCHIDOS === '1'

describe.skipIf(ARQUIVOS.length === 0)('campos brutos', () => {
  for (const arquivo of ARQUIVOS) {
    it(arquivo, async () => {
      const sheet = await abrirPdfNoNode(arquivo)
      console.log(`\n===== ${arquivo}: ${sheet.fields.length} campos, ${sheet.texts.length} textos, ${sheet.pageCount} páginas`)
      if (sheet.fields.length > 0) {
        const campos = sheet.fields
          .filter((c) => !FILTRO || FILTRO.test(c.name))
          .filter((c) => !SO_PREENCHIDOS || (c.value && c.value.trim() && c.value !== 'Off'))
          .sort((a, b) => a.page - b.page || b.rect[1] - a.rect[1] || a.rect[0] - b.rect[0])
        for (const c of campos) {
          const r = c.rect.map((n) => Math.round(n)).join(',')
          console.log(`  p${c.page} [${r}] ${c.type ?? '?'} ${JSON.stringify(c.name)} = ${JSON.stringify(c.value ?? '')}`)
        }
      }
      if (sheet.fields.length === 0 || process.env.TEXTOS === '1') {
        for (const t of sheet.texts) {
          if (FILTRO && !FILTRO.test(t.text)) continue
          console.log(`  p${t.page} (${Math.round(t.x)},${Math.round(t.y)}) ${JSON.stringify(t.text)}`)
        }
      }
    }, 60_000)
  }
})
