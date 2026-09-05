import { describe, expect, it } from 'vitest'
import type { PdfSheet, PdfText } from '@shared/types/sheetImport'
import { MAX_EXPLOSOES_POR_DADO } from '@shared/diceRegistry'
import { readSheet } from './index'
import { kidsOnBikesReader } from './kidsOnBikes'

/**
 * A ficha REAL do Rodrigo Barreto ("Ficha Kids on Bikes - Preenchida.pdf"), fragmento a fragmento:
 * as posições abaixo foram lidas do arquivo (`out/testar-no-app/textosXY.mjs`, 03/09/2026). É arte
 * com anotação por cima, sem campo e sem rótulo impresso, então é a POSIÇÃO que este teste prova.
 */
function t(page: number, x: number, y: number, text: string, width = text.length * 6, height = 12): PdfText {
  return { text, page, x, y, width, height }
}

const RODRIGO: PdfText[] = [
  t(1, 81, 739, 'rodrigo barreto', 126, 17),
  t(1, 292, 739, '11', 11, 17),
  t(1, 136, 714, 'Novo Aluno Misterioso', 177, 17),
  t(1, 463, 709, '+1', 11, 12),
  t(1, 533, 706, '+1', 11, 12),
  t(1, 415, 689, 'd20', 51, 26),
  t(1, 490, 689, 'd12', 42, 26),
  t(1, 126, 678, 'Voltar pra casa'),
  t(1, 108, 649, 'Escuro'),
  t(1, 128, 620, 'supersticioso'),
  t(1, 496, 619, 'd6', 33, 26),
  t(1, 420, 616, 'd10', 42, 26),
  t(1, 128, 564, 'Cuidar da irmã'),
  t(1, 460, 557, '+1', 11, 12),
  t(1, 115, 544, 'Desenha bem', 85, 9),
  t(1, 493, 544, 'd8', 34, 26),
  t(1, 423, 543, 'd4', 34, 26),
  t(1, 115, 511, 'preta intensa : Você ganha +1 em testes de Luta.', 213, 9),
  t(1, 490, 477, '3', 17, 26),
  t(1, 198, 291, 'X', 13, 21),
  t(1, 32, 275, 'X', 13, 21),
  t(1, 32, 250, 'X', 13, 21),
  t(1, 198, 250, 'X', 13, 21),
  t(1, 198, 179, 'X', 13, 21),
  t(2, 45, 613, '1 - Dinamite', 117, 21),
  t(2, 101, 284, 'Heróico: Você não precisa da'),
  t(2, 302, 284, 'Pegs Apoio nas rodas Você pode'),
  t(2, 101, 267, 'permissão do Mestre para'),
  t(2, 302, 267, 'levar um passageiro em pé. Ele'),
  t(2, 101, 251, 'gastar Fichas de Adversidade'),
  t(2, 302, 250, 'também recebe os benefícios da'),
  t(2, 101, 234, 'para ignorar Medos.'),
  t(2, 302, 233, 'cor da sua bicicleta.'),
  t(2, 101, 207, 'Durão: Se você perder uma'),
  t(2, 101, 191, 'rolagem de combate, adicione +3'),
  t(2, 306, 181, 'bike preta intensa:', 123, 14),
  t(2, 432, 181, 'Você', 32, 14),
  t(2, 101, 174, 'ao número negativo. Você ainda'),
  t(2, 306, 163, 'ganha +1 em testes de Luta.', 183, 14),
  t(2, 101, 158, 'perderá a rolagem, mas poderá'),
  t(2, 101, 141, 'reduzir sua perda para -1')
]

const sheet: PdfSheet = { fileName: 'Ficha Kids on Bikes - Preenchida.pdf', pageCount: 2, fields: [], texts: RODRIGO }
const lido = readSheet(sheet)

describe('Kids on Bikes — a ficha do Rodrigo, arte com anotação por cima', () => {
  it('é reconhecida pelos dados de atributo no lugar deles, e o nome é o da caixa de nome', () => {
    expect(kidsOnBikesReader.detect(sheet)).toBeGreaterThanOrEqual(0.9)
    expect(lido.readerId).toBe('kids-on-bikes')
    expect(lido.system).toBe('Kids on Bikes')
    expect(lido.characterName).toBe('rodrigo barreto')
    expect(lido.warnings).not.toContain('sem-nome-nem-rolagem')
  })

  it('os seis atributos saem com o dado e o bônus, e viram presets que EXPLODEM', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Luta', value: 'd20+1', group: 'Atributos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Fuga', value: 'd12+1' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Mente', value: 'd10' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Músculo', value: 'd6' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Charme', value: 'd4+1' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Garra', value: 'd8' }))
    const luta = lido.presets.find((p) => p.name === 'Luta')
    expect(luta?.kind).toBe('test')
    expect(luta?.expression).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 1 }],
      explode: { maxChain: MAX_EXPLOSOES_POR_DADO }
    })
    expect(lido.presets.find((p) => p.name === 'Garra')?.expression.modifiers).toEqual([])
  })

  it('identificação, personalidade, bicicleta e fichas de adversidade no lugar certo', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Idade', value: '11', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Arquétipo', value: 'Novo Aluno Misterioso' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Motivação', value: 'Voltar pra casa', group: 'Personalidade' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Medos', value: 'Escuro' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Fraquezas', value: 'supersticioso' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Obrigações', value: 'Cuidar da irmã' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Talentos', value: 'Desenha bem', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Bicicleta', value: 'preta intensa : Você ganha +1 em testes de Luta.', group: 'Inventário' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Fichas de adversidade', value: '3', group: 'Recursos' }))
  })

  it('as Forças marcadas com X viram a lista, na ordem da ficha', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Forças', value: 'Durão, Heróico, Protetor, Recuperação rápida, Tranquilão', group: 'Forças' }))
  })

  it('página 2: relacionamentos, e o livro de notas lido coluna a coluna', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Relacionamento 1', value: '1 - Dinamite', group: 'Relacionamentos' }))
    // O parágrafo da esquerda inteiro, sem a coluna da direita no meio.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Heróico', value: 'Você não precisa da permissão do Mestre para gastar Fichas de Adversidade para ignorar Medos.', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Durão', value: 'Se você perder uma rolagem de combate, adicione +3 ao número negativo. Você ainda perderá a rolagem, mas poderá reduzir sua perda para -1' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'bike preta intensa', value: 'Você ganha +1 em testes de Luta.' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Pensamentos e notas', value: 'Pegs Apoio nas rodas Você pode levar um passageiro em pé. Ele também recebe os benefícios da cor da sua bicicleta.', group: 'História' }))
    // Nada vai pro texto sem rótulo: o mapa cobre a ficha inteira.
    expect(lido.rawText ?? '').toBe('')
  })

  it('o modelo em branco (só um X impresso) não é reivindicado', () => {
    const branco: PdfSheet = { fileName: 'Ficha Kids on Bikes.pdf', pageCount: 2, fields: [], texts: [t(1, 198, 250, 'X', 13, 21)] }
    expect(kidsOnBikesReader.detect(branco)).toBe(0)
  })
})
