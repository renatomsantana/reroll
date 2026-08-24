import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { CORPUS, type FichaDeTeste } from './testes/corpusDePdfs'
import { QUINTA_LEVA } from './testes/quintaLevaDePdfs'

/**
 * O CORPUS DE QUINZE FICHAS FABRICADAS, passando pelo importador de verdade.
 *
 * As fichas reais (`Fichas RPG/`) moram fora do repositório — quem clona não as tem, e os testes
 * delas pulam sozinhos. Este arquivo é o contrário: os quinze PDFs são construídos byte a byte na
 * hora (ver `testes/corpusDePdfs.ts`), então rodam em qualquer máquina e cobrem o que as três
 * fichas reais não cobrem — modelo em branco, digitalização sem texto, rótulo repetido doze vezes,
 * campo com um romance dentro, instrução de modelo, caixa desmarcada, doze páginas.
 *
 * O caminho é o de produção inteiro: bytes → `pdfjs` → `sheetFromPdfDocument` → `readSheet`. Só o
 * arquivo é de mentira.
 *
 * PRA VER NA TELA: `ESCREVER_PDFS=1 npx vitest run corpusDePdfs` escreve os quinze em
 * `Fichas RPG/testes/` (pasta já ignorada pelo git), pra arrastar pro app e conferir com o olho.
 */

const ESCREVER = process.env.ESCREVER_PDFS === '1'
const DESTINO = join(process.cwd(), 'Fichas RPG', 'testes')

beforeAll(() => {
  if (ESCREVER) mkdirSync(DESTINO, { recursive: true })
})

const LEVAS: [string, FichaDeTeste[]][] = [
  ['corpus de fichas fabricadas', CORPUS],
  ['quinta leva — o que o beta acrescentou e o adversarial do spec', QUINTA_LEVA]
]

describe.each(LEVAS)('%s', (_leva, fichas) => {
  it.each(fichas.map((ficha) => [ficha.arquivo, ficha] as const))('%s', async (_nome, ficha) => {
    const bytes = ficha.bytes()
    if (ESCREVER) writeFileSync(join(DESTINO, ficha.arquivo), bytes)
    const onde = `${ficha.arquivo} — ${ficha.proposito}`

    let pdf
    try {
      pdf = await abrirPdfDeBytes(ficha.arquivo, bytes)
    } catch (causa) {
      // Recusa limpa: uma rejeição com mensagem, que a tela sabe transformar em frase.
      if (!ficha.espera.podeNaoAbrir) throw causa
      expect(causa, `${onde}: a recusa precisa ser um Error`).toBeInstanceOf(Error)
      return
    }
    const lido = readSheet(pdf)

    expect(lido.readerId, `${onde}: leitor`).toBe(ficha.espera.leitor)

    if (ficha.espera.nome !== undefined) {
      expect(lido.characterName, `${onde}: nome`).toBe(ficha.espera.nome)
    }
    if (ficha.espera.minimoDeCampos !== undefined) {
      expect(lido.fields.length, `${onde}: campos`).toBeGreaterThanOrEqual(ficha.espera.minimoDeCampos)
    }
    if (ficha.espera.maximoDeCampos !== undefined) {
      expect(lido.fields.length, `${onde}: campos demais`).toBeLessThanOrEqual(ficha.espera.maximoDeCampos)
    }
    if (ficha.espera.minimoDePresets !== undefined) {
      expect(lido.presets?.length ?? 0, `${onde}: presets`).toBeGreaterThanOrEqual(ficha.espera.minimoDePresets)
    }
    for (const aviso of ficha.espera.avisos ?? []) {
      expect(lido.warnings, `${onde}: aviso`).toContain(aviso)
    }
    for (const esperado of ficha.espera.campos ?? []) {
      // Com o grupo dado, é ele que desempata: "Força" existe em Atributos E em Salvaguardas.
      const achado = lido.fields.find(
        (c) => c.label === esperado.label && (esperado.group === undefined || c.group === esperado.group)
      )
      expect(achado, `${onde}: faltou o campo "${esperado.label}"`).toBeDefined()
      if (!achado) continue
      if (esperado.value !== undefined) expect(achado.value, `${onde}: valor de "${esperado.label}"`).toBe(esperado.value)
      if (esperado.valueMatches) expect(achado.value, `${onde}: valor de "${esperado.label}"`).toMatch(esperado.valueMatches)
      if (esperado.group !== undefined) expect(achado.group, `${onde}: grupo de "${esperado.label}"`).toBe(esperado.group)
    }
    if (ficha.espera.semRotulo) {
      const vazados = lido.fields.filter((c) => ficha.espera.semRotulo!.test(c.label)).map((c) => c.label)
      expect(vazados, `${onde}: rótulo cru vazou`).toEqual([])
    }
    for (const proibido of ficha.espera.proibidos ?? []) {
      const achados = lido.fields.filter((c) => proibido.test(c.label) || proibido.test(String(c.value)))
      expect(achados, `${onde}: entrou o que estava fora do teto`).toEqual([])
      expect(lido.characterName, `${onde}: nome fora do teto`).not.toMatch(proibido)
    }

    /**
     * Vale pra TODOS: nada do que entra na ficha pode ser lixo estrutural do PDF. Um rótulo com
     * nome de campo cru ("Atq1.0.0.0.1"), um valor "Off" de caixa desmarcada ou uma linha sem
     * rótulo são os três jeitos de a importação parecer que funcionou e não ter funcionado.
     */
    for (const campo of lido.fields) {
      expect(campo.label.trim(), `${onde}: rótulo vazio`).not.toBe('')
      expect(campo.label, `${onde}: rótulo cru`).not.toMatch(/^\w+\.\d+/)
      expect(String(campo.value).toLowerCase(), `${onde}: valor de caixa desmarcada`).not.toBe('off')
      /**
       * O valor gigante ENTRA inteiro aqui, e é decisão do projeto: "é o que a pessoa escreveu"
       * (ver `robustez.test.ts`). Quem corta é a gravação, com `LIMITES_DA_FICHA.valor` = 2000 —
       * então o que este teste cobra é o que o leitor tem que garantir: que ele não trave e não
       * devolva algo absurdo a ponto de não caber em memória.
       */
      expect(String(campo.value).length, `${onde}: valor absurdo`).toBeLessThan(200_000)
    }
  })
})
