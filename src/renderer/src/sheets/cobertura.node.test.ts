import { describe, it } from 'vitest'
import { readSheet } from './readers/index'
import { valorDeFicha } from './readers/generic'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'

/**
 * COBERTURA DA IMPORTAÇÃO: o que a ficha tem preenchido × o que a leitura entrega.
 *
 * Regra do usuário: "qualquer anotação de player no pdf precisamos trazer". Esta ferramenta lista,
 * ficha por ficha, cada valor preenchido (campo de formulário) ou fragmento de texto (ficha sem
 * formulário) que NÃO aparece em lugar nenhum do resultado — nem em campo, nem no texto da ficha,
 * nem na fonte de um preset. É o que se olha antes de dizer que um sistema "raspa igual o Oblívio".
 *
 *     FICHAS="Fichas RPG/ficha Go.pdf|Fichas RPG/ficha vincenzo.pdf" npx vitest run cobertura --reporter=verbose
 *
 * Só relata; não julga. Ficha sem formulário traz o modelo impresso junto, e o que sobra ali pode
 * ser regra e não anotação — quem decide é quem lê a lista.
 */
const ARQUIVOS = (process.env.FICHAS ?? '').split('|').filter(Boolean)

describe.skipIf(ARQUIVOS.length === 0)('cobertura', () => {
  for (const arquivo of ARQUIVOS) {
    it(arquivo, async () => {
      const sheet = await abrirPdfNoNode(arquivo)
      const lido = readSheet(sheet)
      const entregue = [
        ...lido.fields.map((c) => `${c.label} ${c.value}`),
        lido.rawText ?? '',
        ...lido.presets.map((p) => `${p.name} ${p.source}`)
      ]
        .join('\n')
        .replace(/:/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()

      const perdidos: string[] = []
      if (sheet.fields.length > 0) {
        for (const campo of sheet.fields) {
          const valor = valorDeFicha(campo.value, campo.type)
          if (valor === null || valor === 'sim') continue
          if (!entregue.includes(valor.replace(/:/g, '').replace(/\s+/g, ' ').toLowerCase())) perdidos.push(`[campo ${campo.name}] ${valor}`)
        }
      } else {
        for (const texto of sheet.texts) {
          const valor = texto.text.trim().replace(/\s+/g, ' ')
          if (valor.length < 3) continue
          if (!entregue.includes(valor.replace(/:/g, '').toLowerCase())) perdidos.push(`[p${texto.page}] ${valor}`)
        }
      }

      console.log(`\n===== ${arquivo} (leitor ${lido.readerId}): ${lido.fields.length} campos, ${lido.presets.length} presets, texto ${lido.rawText?.length ?? 0} chars`)
      console.log(`PERDIDOS: ${perdidos.length}`)
      for (const p of perdidos) console.log(`  ${p.slice(0, 160)}`)
    }, 60_000)
  }
})
