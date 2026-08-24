import { describe, expect, it } from 'vitest'
import { montarFicha } from './montarFicha'
import { MAXIMO_DE_CAMPOS_POR_SECAO, type SheetImportField } from './sheetImport'

/**
 * A tradução do que foi LIDO da ficha pro que fica GRAVADO no personagem.
 *
 * É o pedido do usuário em uma função — "backstory pra backstory, inventário pra inventário,
 * atributos pra atributos" — e o passo que mais estraga a importação em silêncio: campo no bloco
 * errado não dá erro, só aparece na aba errada, e quem descobre é o usuário, depois.
 *
 * Morava dentro de um `useMemo` da tela de conferência, onde não tinha como ser testada.
 */

function campo(label: string, value: string, group?: string): SheetImportField {
  return group ? { label, value, group } : { label, value }
}

describe('montarFicha', () => {
  it('manda cada grupo pro lugar que o usuário pediu', () => {
    const ficha = montarFicha([
      campo('Inventário', 'Faca de mato', 'Inventário'),
      campo('Motivação', 'Se redimir', 'História'),
      campo('Voracidade', 'Dobre sua Dor', 'Habilidades'),
      campo('Agilidade', '1', 'Atributos'),
      campo('PV máximo', '45', 'Recursos')
    ])

    expect(ficha.blocks.inventory).toBe('Inventário: Faca de mato')
    expect(ficha.blocks.backstory).toBe('Motivação: Se redimir')
    expect(ficha.blocks.abilities).toBe('Voracidade: Dobre sua Dor')

    /**
     * Atributo e Recurso NÃO viram texto: viram seção, pra ficha desenhar em caixa com o número
     * grande. Em texto corrido, "Agilidade: 1" deixa de parecer ficha de RPG — ver `sheetBlocks.ts`.
     */
    expect(ficha.blocks.attributes).toBeUndefined()
    expect(ficha.sections).toEqual([
      { title: 'Atributos', fields: [{ label: 'Agilidade', value: '1' }] },
      { title: 'Recursos', fields: [{ label: 'PV máximo', value: '45' }] }
    ])
  })

  it('junta num bloco só os vários campos do mesmo grupo, uma linha cada', () => {
    const ficha = montarFicha([
      campo('Heróico', 'Ignora Medos', 'Habilidades'),
      campo('Durão', 'Reduz a perda', 'Habilidades')
    ])
    expect(ficha.blocks.abilities).toBe('Heróico: Ignora Medos\nDurão: Reduz a perda')
  })

  it('campo sem grupo cai em "Outros" — e não numa seção chamada "Ficha"', () => {
    /**
     * O nome era "Ficha", e o usuário apontou o óbvio: dentro da aba FICHA, uma seção chamada
     * "FICHA" não informa nada. "Outros" diz a verdade — é o que sobrou depois de tudo que tinha
     * lugar certo.
     */
    const ficha = montarFicha([campo('Idade', '11'), campo('Bicicleta', 'preta')])
    expect(ficha.sections).toEqual([
      {
        title: 'Outros',
        fields: [
          { label: 'Idade', value: '11' },
          { label: 'Bicicleta', value: 'preta' }
        ]
      }
    ])
    expect(ficha.blocks).toEqual({})
  })

  it('o texto sem rótulo entra na HISTÓRIA, depois do que já estava lá', () => {
    /**
     * O caso da ficha que é arte com anotação por cima: não há rótulo pra nada, e o texto precisa
     * ser preservado inteiro. Se ele entrasse ANTES, ou por cima, a importação apagaria em silêncio
     * o conteúdo que veio rotulado — que é o que o usuário mais reclamou de perder.
     */
    const ficha = montarFicha([campo('Motivação', 'Se redimir', 'História')], 'rodrigo barreto\n11\nd20')
    expect(ficha.blocks.backstory).toBe('Motivação: Se redimir\n\nrodrigo barreto\n11\nd20')
  })

  it('sem nada rotulado, o texto solto é a história inteira', () => {
    expect(montarFicha([], 'd20\nd12').blocks.backstory).toBe('d20\nd12')
  })

  it('não inventa bloco de história quando não há texto solto', () => {
    expect(montarFicha([campo('Idade', '11')], undefined).blocks.backstory).toBeUndefined()
    expect(montarFicha([campo('Idade', '11')], '').blocks.backstory).toBeUndefined()
  })

  it('grupo escrito com espaço em volta continua sendo o mesmo grupo', () => {
    // O nome do grupo vem do leitor de cada sistema, e sistema nenhum promete não ter espaço sobrando.
    const ficha = montarFicha([campo('Faca', 'no cinto', '  Inventário  ')])
    expect(ficha.blocks.inventory).toBe('Faca: no cinto')
    expect(ficha.sections).toEqual([])
  })

  it('ficha vazia não vira ficha com seção vazia', () => {
    expect(montarFicha([])).toEqual({ blocks: {}, sections: [] })
  })

  it('o TIPO DE ROLAGEM atravessa junto do campo, sem ninguém reinterpretar', () => {
    /**
     * É o que põe o botão de dado ao lado do número na ficha (ver `sheetRoll.ts`), e quem sabe qual
     * é a regra do sistema é o LEITOR. Se este passo perdesse o `roll`, a ficha importada chegaria
     * à tela como formulário inerte e o defeito seria mudo: nenhum erro, só um botão que nunca
     * aparece.
     */
    const ficha = montarFicha([
      { label: 'Agilidade', value: '3', group: 'Atributos', roll: 'pool-d20' },
      { label: 'Defesa', value: '11', group: 'Recursos' }
    ])
    const atributos = ficha.sections.find((s) => s.title === 'Atributos')
    expect(atributos?.fields[0]).toEqual({ label: 'Agilidade', value: '3', roll: 'pool-d20' })
    // E campo que não rola continua sem tipo — um dado ao lado da Defesa rolaria o que não existe.
    expect(ficha.sections.find((s) => s.title === 'Recursos')?.fields[0].roll).toBeUndefined()
  })
})

/**
 * O teto de campos por seção, dito em vez de calado — achado da quinta leva de PDFs de teste (um
 * PDF de 5.001 campos passava pela conferência inteiro e chegava ao disco com 2.000).
 */
describe('teto de campos por seção', () => {
  it('corta no teto e diz quantos ficaram de fora', () => {
    const muitos = Array.from({ length: MAXIMO_DE_CAMPOS_POR_SECAO + 3 }, (_, i) => campo(`c${i}`, String(i), 'Tudo'))
    const ficha = montarFicha(muitos)
    expect(ficha.sections[0].fields).toHaveLength(MAXIMO_DE_CAMPOS_POR_SECAO)
    expect(ficha.sections[0].fields[0].label).toBe('c0')
    expect(ficha.cortados).toBe(3)
  })

  it('o corte é por seção, e a conta soma as seções', () => {
    const a = Array.from({ length: MAXIMO_DE_CAMPOS_POR_SECAO + 1 }, (_, i) => campo(`a${i}`, '1', 'A'))
    const b = Array.from({ length: MAXIMO_DE_CAMPOS_POR_SECAO + 2 }, (_, i) => campo(`b${i}`, '1', 'B'))
    expect(montarFicha([...a, ...b]).cortados).toBe(3)
  })

  it('dentro do teto não existe "cortados" — o objeto continua o de sempre', () => {
    expect(montarFicha([campo('a', '1', 'G')])).not.toHaveProperty('cortados')
  })
})
