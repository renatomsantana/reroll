/**
 * Despeja os NOMES DE CAMPO crus de um PDF — a primeira coisa a fazer pra escrever um leitor de
 * ficha novo (ver `src/renderer/src/sheets/readers/index.ts`).
 *
 *     node scripts/dump-campos.mjs "Fichas RPG/ficha.pdf"          # só os preenchidos
 *     node scripts/dump-campos.mjs "Fichas RPG/ficha.pdf" "nex|classe"   # filtra por expressão
 *
 * É o par cru de `dump.node.test.ts`: aquele mostra o que o IMPORTADOR entendeu, este mostra o que
 * o ARQUIVO tem. Quando os dois discordam, a diferença é o leitor.
 *
 * Repare que campo de lista (`Ch`) guarda o valor dentro de um ARRAY — foi assim que a Classe e a
 * Origem da ficha de Ordem Paranormal sumiram de uma versão anterior desta ferramenta enquanto
 * apareciam no app.
 */
import { readFileSync } from 'fs'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(process.argv[2])),
  useSystemFonts: true
}).promise

const filtro = process.argv[3] ? new RegExp(process.argv[3], 'i') : null
for (let n = 1; n <= doc.numPages; n++) {
  for (const anotacao of await (await doc.getPage(n)).getAnnotations()) {
    if (anotacao.subtype !== 'Widget' || typeof anotacao.fieldName !== 'string') continue
    const valor = anotacao.fieldValue
    const linha = `p${n} ${anotacao.fieldName} [${anotacao.fieldType}] = ${JSON.stringify(valor)}`
    // Sem filtro, só o que está preenchido: uma ficha oficial tem centenas de campos vazios.
    if (filtro ? filtro.test(linha) : valor && valor !== 'Off') console.log(linha)
  }
}
