import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'
import { readSheet } from './readers/index'
import { camposDoTexto } from './camposDoTexto'
import { paragrafosDaFicha } from './anotacoesSobreImagem'

/**
 * O importador contra ARQUIVO ESTRANHO.
 *
 * Os outros testes usam fichas plausíveis — as três de referência e fixtures no formato delas. Este
 * usa o contrário: PDF vazio, texto de cem mil caracteres, coordenadas negativas, campo com nome
 * repetido mil vezes, rótulo que é só pontuação. Nada disso é hipótese distante: o pedido do usuário
 * é que "outros usuários irão colocar suas próprias fichas", e ficha de terceiro é exatamente onde
 * aparece o PDF exportado por uma ferramenta que ninguém aqui viu.
 *
 * O contrato que se testa aqui é modesto de propósito, e por isso vale: NUNCA lançar, nunca devolver
 * campo sem rótulo ou sem valor, e nunca travar. Um importador que estoura numa exceção derruba a
 * janela de conferência inteira e leva junto a ficha que estava boa.
 */

function ficha(fields: PdfField[] = [], texts: PdfText[] = [], pageCount = 1): PdfSheet {
  return { fileName: 'estranha.pdf', pageCount, fields, texts }
}

function campo(name: string, value: string, rect: [number, number, number, number] = [0, 0, 10, 10]): PdfField {
  return { name, type: 'text', value, page: 1, rect }
}

function texto(text: string, x = 0, y = 0, width = 10, height = 10): PdfText {
  return { text, page: 1, x, y, width, height }
}

/** Todo campo importado precisa ter rótulo E valor: linha vazia na conferência é ruído puro. */
function conferirCampos(sheet: PdfSheet): void {
  const lido = readSheet(sheet)
  for (const campo of lido.fields) {
    expect(campo.label.trim()).not.toBe('')
    expect(campo.value.trim()).not.toBe('')
  }
  for (const preset of lido.presets) {
    expect(preset.name.trim()).not.toBe('')
    expect(preset.expression.groups.length).toBeGreaterThan(0)
  }
}

describe('PDF vazio ou quase', () => {
  it('ficha sem nada não lança e ainda escolhe um leitor', () => {
    const lido = readSheet(ficha())
    expect(lido.readerId).toBe('generico')
    expect(lido.fields).toEqual([])
    expect(lido.presets).toEqual([])
    // Sempre há um aviso: silêncio depois de "importar" nada parece defeito do app.
    expect(lido.warnings.length).toBeGreaterThan(0)
  })

  it('zero páginas não divide por zero na conta de densidade', () => {
    // `pageCount` vem do PDF e nada garante que seja maior que zero num arquivo corrompido.
    expect(() => readSheet(ficha([], [texto('a'), texto('b'), texto('c')], 0))).not.toThrow()
  })

  it('texto só de espaço e de pontuação não vira campo', () => {
    const sheet = ficha([], [texto('   '), texto(':'), texto('::::'), texto('— — —'), texto('...')])
    conferirCampos(sheet)
    expect(readSheet(sheet).fields).toEqual([])
  })
})

describe('valores absurdos', () => {
  it('texto gigante não trava nem entra inteiro na ficha', () => {
    const enorme = 'palavra '.repeat(12_000)
    const sheet = ficha([campo('Historia', enorme, [100, 700, 200, 712])], [texto('HISTÓRIA', 60, 702, 50)])
    const inicio = Date.now()
    const lido = readSheet(sheet)
    expect(Date.now() - inicio).toBeLessThan(2000)
    // Entra, porque é o que a pessoa escreveu — mas o rótulo continua o impresso, não o texto todo.
    expect(lido.fields[0]?.label).toBe('HISTÓRIA')
  })

  it('mil campos com o mesmo nome não viram mil linhas iguais', () => {
    /**
     * Aconteceu de verdade em escala menor: a ficha de Ordem Paranormal em branco repete `PRE` dez
     * vezes com o mesmo valor, e a primeira leitura devolvia dez linhas idênticas. Em mil, a tela de
     * conferência deixa de ser conferível.
     */
    const campos = Array.from({ length: 1000 }, () => campo('PRE', '0', [400, 500, 440, 512]))
    const lido = readSheet(ficha(campos, [texto('PRE', 360, 502, 20)]))
    expect(lido.fields.length).toBeLessThanOrEqual(1)
  })

  it('coordenadas negativas, zeradas e NaN não quebram a busca de rótulo', () => {
    const sheet = ficha(
      [
        campo('a', '1', [-500, -500, -490, -488]),
        campo('b', '2', [0, 0, 0, 0]),
        campo('c', '3', [NaN, NaN, NaN, NaN])
      ],
      [texto('ALFA', -560, -498), texto('BETA', 0, 0), texto('GAMA', NaN, NaN)]
    )
    expect(() => readSheet(sheet)).not.toThrow()
    conferirCampos(sheet)
  })

  it('altura de fonte zerada não faz a remontagem de parágrafo colar a página inteira', () => {
    /**
     * A remontagem mede entrelinha em múltiplos da altura da fonte. Com altura 0, todo limite vira 0
     * ou infinito, dependendo da conta — e o resultado seria uma única "linha" com a página toda.
     */
    const texts = Array.from({ length: 30 }, (_, i) => texto(`linha ${i}`, 50, 700 - i * 17, 40, 0))
    const paragrafos = paragrafosDaFicha(ficha([], texts, 2))
    expect(paragrafos.length).toBeGreaterThan(1)
    expect(paragrafos.every((p) => p.length < 400)).toBe(true)
  })
})

describe('texto que parece rótulo e não é', () => {
  it('não deixa um parágrafo virar valor de campo por causa de dois-pontos no meio', () => {
    // Regra de RPG usa dois-pontos o tempo todo; o corte por número de palavras é o que segura isso.
    const campos = camposDoTexto(
      ficha([], [texto('Depois de tudo isso o Mestre decide o seguinte: role de novo', 50, 500, 300, 12)])
    )
    expect(campos).toEqual([])
  })

  it('rótulo que começa com símbolo não vira campo', () => {
    // "(5 + Carne): 0/7" é a FÓRMULA impressa ao lado do campo, não o nome dele.
    expect(camposDoTexto(ficha([], [texto('(5 + Carne): 0/7', 50, 500, 80, 12)]))).toEqual([])
  })

  it('continuação de parágrafo para no campo seguinte, e não engole a ficha', () => {
    /**
     * O risco de estender o valor pras linhas de baixo: um parágrafo grudar no próximo rótulo e
     * levar meia ficha junto. As três linhas abaixo têm a mesma margem e a mesma entrelinha — o que
     * separa é a terceira ser ela mesma um "Rótulo: valor".
     */
    const campos = camposDoTexto(
      ficha([], [
        texto('Descrição: alto e magro,', 50, 500, 120, 12),
        texto('de cabelo escuro.', 50, 483, 100, 12),
        texto('Motivação: vingança', 50, 466, 110, 12)
      ])
    )
    expect(campos).toEqual([
      { label: 'Descrição', value: 'alto e magro, de cabelo escuro.' },
      { label: 'Motivação', value: 'vingança' }
    ])
  })
})

describe('caracteres fora do comum', () => {
  it('emoji, acento e alfabeto não latino atravessam sem virar lixo', () => {
    const sheet = ficha(
      [
        campo('n', 'Ríebeck 🎲', [100, 700, 200, 712]),
        campo('o', 'Ωμέγα', [100, 600, 200, 612])
      ],
      [texto('PERSONAGEM', 60, 702, 50), texto('ORIGEM', 60, 602, 40)]
    )
    const lido = readSheet(sheet)
    expect(lido.fields.map((c) => c.value)).toEqual(['Ríebeck 🎲', 'Ωμέγα'])
    expect(lido.characterName).toBe('Ríebeck 🎲')
  })

  it('notação de dado escrita com maiúscula, espaço e sinal ainda é lida', () => {
    const sheet = ficha(
      [campo('g', '2 D 6 + 3', [100, 500, 200, 512])],
      [texto('GOLPE', 60, 502, 40)]
    )
    const lido = readSheet(sheet)
    expect(lido.presets[0]?.expression.groups).toEqual([{ sides: 6, count: 2 }])
  })
})
