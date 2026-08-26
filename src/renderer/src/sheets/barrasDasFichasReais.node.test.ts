import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'
import { readSheet } from './readers'

/**
 * AS BARRAS que cada ficha REAL propõe (spec §3.4), do PDF até `extrairRecursos` — o mesmo caminho
 * da tela de conferência. Existe porque o harness no app (`scripts/testarNoApp.mjs`) mostrou o
 * Oblívio propondo doze barras de ATRIBUTO ("Carne 0/10") e o D&D do Go não propondo nenhuma; a
 * suíte de unidade tinha os pares certos e não tinha as fichas.
 *
 * Pula sem a pasta `Fichas RPG/` (material das editoras, fora do repositório).
 */
const PASTA = join(process.cwd(), 'Fichas RPG')

async function barrasDe(nome: string) {
  const sheet = await abrirPdfNoNode(join(PASTA, nome))
  const lido = readSheet(sheet, 'pt-BR')
  return extrairRecursos(lido.fields).map((r) => `${r.nome} ${r.atual}/${r.maximo}${r.atualEmBranco ? '*' : ''}`)
}

describe.skipIf(!existsSync(PASTA))('as barras das fichas reais', () => {
  it('Ordem (Matias): PV, PE e Sanidade, cheias porque só o máximo está preenchido', async () => {
    expect(await barrasDe('Ordem Paranormal - Ficha de Personagem Editável Matais.pdf')).toEqual(['PV 45/45*', 'PE 12/12*', 'Sanidade 15/15*'])
  })

  it('Ordem da comunidade (Vincenzo): os três pares e a Carga', async () => {
    expect(await barrasDe('ficha vincenzo.pdf')).toEqual(['PV 51/65', 'PE 59/78', 'Sanidade 56/56', 'Carga 18/30'])
  })

  it('D&D 5e (Go): nenhuma barra — o Go deixou PV máximo e atual em branco na ficha', async () => {
    // Não é defeito do extrator: o par existe como lacuna ("PV máximo" = ""), e lacuna vazia dos
    // dois lados não vira barra (ver `extrairRecursos.ts`). A pessoa cria a barra pelo lápis do HUD.
    expect(await barrasDe('ficha Go.pdf')).toEqual([])
  })

  it('Pathfinder (Rilver): o PV', async () => {
    expect(await barrasDe('ficha Rilver - pf2e.pdf')).toEqual(['PV 21/21*'])
  })

  it('Oblívio preenchida: as partes do corpo, e NENHUM atributo ("Carne 2/10" é escala, não reserva)', async () => {
    const barras = await barrasDe('Ficha Oblívio - Preenchida.pdf')
    expect(barras.find((b) => b.startsWith('Carne'))).toBeUndefined()
    expect(barras.find((b) => b.startsWith('Força'))).toBeUndefined()
    expect(barras.length).toBeGreaterThan(0)
  })

  it('Assimilação (Kieran): os três recursos por extenso viram barras cheias no valor', async () => {
    const nome = ['Assimilação - Ficha Kieran.pdf', 'Assimilacao - Ficha Kieran.pdf'].find((n) => existsSync(join(PASTA, n)))
    if (!nome) return
    expect(await barrasDe(nome)).toEqual(['Saúde 18/18', 'Determinação 8/8', 'Assimilação 2/2'])
  })

  it('Oblívio em branco: nenhuma barra — "0/0" não se clica', async () => {
    expect(await barrasDe('Ficha Oblivio - Colorida.pdf')).toEqual([])
  })
})
