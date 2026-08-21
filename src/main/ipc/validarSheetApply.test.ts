import { describe, expect, it, vi } from 'vitest'

/**
 * A CONFERÊNCIA DO PAYLOAD da importação de ficha, que é a porta de entrada do único canal que grava
 * três coisas em sequência: perfil, ficha e presets.
 *
 * O que está sendo protegido não é "dado inválido" em abstrato — é o estado pela metade. Sem esta
 * conferência, um payload torto estourava no MEIO da gravação, depois de o perfil já existir e já
 * estar aberto: o usuário terminava com um personagem vazio que ele não pediu, no lugar da ficha que
 * ele importou. Os testes abaixo dividem-se exatamente nas duas réguas que o validador usa —
 * estrutura estoura, tamanho é corrigido.
 */

vi.mock('electron', () => ({
  app: { getPath: () => '' },
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
}))

const { validarSheetApplyPayload, LIMITES_DA_FICHA } = await import('./registerSheetHandlers')

/** Um payload mínimo e correto, pra cada teste torcer só o pedaço que lhe interessa. */
function fichaBoa(): Record<string, unknown> {
  return {
    characterName: 'Matias',
    system: 'Ordem Paranormal',
    notes: {
      blocks: { inventory: 'Faca de mato' },
      sections: [{ title: 'Atributos', fields: [{ label: 'Agilidade', value: '1' }] }]
    },
    presets: []
  }
}

describe('estrutura quebrada estoura antes de gravar', () => {
  it('recusa payload que não é objeto', () => {
    expect(() => validarSheetApplyPayload(null)).toThrow()
    expect(() => validarSheetApplyPayload('ficha')).toThrow()
  })

  it('recusa payload sem anotações', () => {
    const { notes: _, ...semNotes } = fichaBoa()
    expect(() => validarSheetApplyPayload(semNotes)).toThrow(/anotações/)
  })

  it('recusa seções e presets que não são listas', () => {
    const comSecaoTorta = fichaBoa()
    ;(comSecaoTorta.notes as Record<string, unknown>).sections = 'Atributos'
    expect(() => validarSheetApplyPayload(comSecaoTorta)).toThrow(/seções/)

    const comPresetTorto = { ...fichaBoa(), presets: { name: 'Faca' } }
    expect(() => validarSheetApplyPayload(comPresetTorto)).toThrow(/presets/)
  })

  it('aceita a ficha boa inteira, sem mexer no que estava certo', () => {
    const limpo = validarSheetApplyPayload(fichaBoa())
    expect(limpo.characterName).toBe('Matias')
    expect(limpo.system).toBe('Ordem Paranormal')
    expect(limpo.notes.blocks.inventory).toBe('Faca de mato')
    expect(limpo.notes.sections).toEqual([
      { title: 'Atributos', fields: [{ label: 'Agilidade', value: '1', roll: undefined }] }
    ])
  })
})

describe('tamanho e campo torto são corrigidos, e a ficha segue', () => {
  it('corta texto acima do limite em vez de recusar a importação', () => {
    const gigante = fichaBoa()
    gigante.characterName = 'a'.repeat(LIMITES_DA_FICHA.nome + 500)
    ;(gigante.notes as Record<string, unknown>).blocks = {
      backstory: 'b'.repeat(LIMITES_DA_FICHA.bloco + 1000)
    }

    const limpo = validarSheetApplyPayload(gigante)
    expect(limpo.characterName).toHaveLength(LIMITES_DA_FICHA.nome)
    expect(limpo.notes.blocks.backstory).toHaveLength(LIMITES_DA_FICHA.bloco)
  })

  it('corta o excesso de seções e de campos', () => {
    const muitas = fichaBoa()
    ;(muitas.notes as Record<string, unknown>).sections = Array.from(
      { length: LIMITES_DA_FICHA.secoes + 50 },
      (_, i) => ({
        title: `Seção ${i}`,
        fields: Array.from({ length: LIMITES_DA_FICHA.camposPorSecao + 10 }, () => ({
          label: 'x',
          value: '1'
        }))
      })
    )

    const limpo = validarSheetApplyPayload(muitas)
    expect(limpo.notes.sections).toHaveLength(LIMITES_DA_FICHA.secoes)
    expect(limpo.notes.sections[0].fields).toHaveLength(LIMITES_DA_FICHA.camposPorSecao)
  })

  it('ignora bloco de chave desconhecida — só os cinco da ficha atravessam', () => {
    const intruso = fichaBoa()
    const blocos: Record<string, unknown> = { inventory: 'Faca', qualquerCoisa: 'nada' }
    /**
     * `__proto__` entra por `defineProperty` de propósito: escrito num literal ele viraria o
     * PROTÓTIPO do objeto e sumiria de `Object.keys`, então o teste passaria sem provar nada. Assim
     * ele é uma chave de verdade — e o que o validador faz é percorrer a lista de blocos conhecidos
     * em vez de copiar o que veio, que é o que mantém qualquer nome de fora do lado de fora.
     */
    Object.defineProperty(blocos, '__proto__', { value: 'nada', enumerable: true })
    ;(intruso.notes as Record<string, unknown>).blocks = blocos

    const limpo = validarSheetApplyPayload(intruso)
    expect(limpo.notes.blocks).toEqual({ inventory: 'Faca' })
    expect(Object.getPrototypeOf(limpo.notes.blocks)).toBe(Object.prototype)
  })

  it('descarta seção sem título, que na tela viraria caixa sem cabeçalho', () => {
    const semTitulo = fichaBoa()
    ;(semTitulo.notes as Record<string, unknown>).sections = [
      { title: '   ', fields: [{ label: 'a', value: '1' }] },
      { title: 'Atributos', fields: [{ label: 'Agilidade', value: '1' }] }
    ]

    const limpo = validarSheetApplyPayload(semTitulo)
    expect(limpo.notes.sections.map((s) => s.title)).toEqual(['Atributos'])
  })

  it('campo com valor de outro tipo vira vazio em vez de derrubar a importação', () => {
    const torto = fichaBoa()
    ;(torto.notes as Record<string, unknown>).sections = [
      { title: 'Atributos', fields: [{ label: 'Agilidade', value: 3 }, null, { label: 7, value: 'x' }] }
    ]

    const limpo = validarSheetApplyPayload(torto)
    expect(limpo.notes.sections[0].fields).toEqual([
      { label: 'Agilidade', value: '', roll: undefined },
      { label: '', value: 'x', roll: undefined }
    ])
  })

  it('tipo de rolagem desconhecido vira ausente, e o resto do campo fica', () => {
    const rolagemEstranha = fichaBoa()
    ;(rolagemEstranha.notes as Record<string, unknown>).sections = [
      { title: 'Atributos', fields: [{ label: 'Agilidade', value: '1', roll: 'inventado' }] }
    ]

    const limpo = validarSheetApplyPayload(rolagemEstranha)
    expect(limpo.notes.sections[0].fields[0]).toEqual({
      label: 'Agilidade',
      value: '1',
      roll: undefined
    })
  })

  it('targetProfileId que não é texto some, e o import cai no caminho de criar novo', () => {
    const idTorto = { ...fichaBoa(), targetProfileId: 42 }
    expect(validarSheetApplyPayload(idTorto).targetProfileId).toBeUndefined()
  })
})
