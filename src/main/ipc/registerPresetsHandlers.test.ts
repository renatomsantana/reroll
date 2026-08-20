import { describe, expect, it, vi } from 'vitest'
import { MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

const { isValidPresetInput } = await import('./registerPresetsHandlers')

function validPreset() {
  return {
    name: 'Ataque',
    expression: { groups: [{ sides: 20, count: 1 }], modifiers: [{ type: 'flat', value: 5 }] }
  }
}

describe('isValidPresetInput', () => {
  it('aceita um preset válido mínimo', () => {
    expect(isValidPresetInput(validPreset())).toBe(true)
  })

  it('aceita um preset sem modificadores nem ícone', () => {
    expect(
      isValidPresetInput({
        name: 'Dano',
        expression: { groups: [{ sides: 6, count: 4 }], modifiers: [] }
      })
    ).toBe(true)
  })

  it('rejeita nome vazio ou só espaços', () => {
    const preset = validPreset()
    expect(isValidPresetInput({ ...preset, name: '' })).toBe(false)
    expect(isValidPresetInput({ ...preset, name: '   ' })).toBe(false)
  })

  it('rejeita grupos sem nenhum item', () => {
    const preset = validPreset()
    expect(isValidPresetInput({ ...preset, expression: { groups: [], modifiers: [] } })).toBe(
      false
    )
  })

  it('rejeita sides zero, negativo ou fracionário — evitaria travar a cena 3D depois', () => {
    for (const sides of [0, -6, 6.5]) {
      const preset = validPreset()
      preset.expression.groups = [{ sides, count: 1 }]
      expect(isValidPresetInput(preset)).toBe(false)
    }
  })

  it('rejeita tipo de dado que o app não rola — d3, d30, d1000', () => {
    /**
     * Não é preciosismo de formato: a cena 3D faz `DICE_REGISTRY[sides]` sem guarda
     * (`DiceCanvasMulti.tsx`), então um `d30` aqui não falha sozinho — estoura a montagem da bandeja
     * inteira na hora de rolar, longe de onde o preset entrou. E entram por três portas: o editor, a
     * importação de presets por ARQUIVO e a importação de ficha.
     */
    for (const sides of [3, 30, 1000, 2, 7]) {
      const preset = validPreset()
      preset.expression.groups = [{ sides, count: 1 }]
      expect(isValidPresetInput(preset), `d${sides} deveria ser recusado`).toBe(false)
    }
  })

  it('aceita os sete tipos que o app rola', () => {
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      const preset = validPreset()
      preset.expression.groups = [{ sides, count: 1 }]
      expect(isValidPresetInput(preset), `d${sides} deveria ser aceito`).toBe(true)
    }
  })

  it('rejeita count zero, negativo ou fracionário', () => {
    for (const count of [0, -1, 2.5]) {
      const preset = validPreset()
      preset.expression.groups = [{ sides: 6, count }]
      expect(isValidPresetInput(preset)).toBe(false)
    }
  })

  it('rejeita modificador com valor fracionário', () => {
    const preset = validPreset()
    preset.expression.modifiers = [{ type: 'flat', value: 1.5 }]
    expect(isValidPresetInput(preset)).toBe(false)
  })

  it('rejeita total de dados acima do limite de dados simultâneos, mesmo somando vários grupos', () => {
    const preset = validPreset()
    preset.expression.groups = [
      { sides: 6, count: MAX_SIMULTANEOUS_DICE },
      { sides: 8, count: 10 }
    ]
    expect(isValidPresetInput(preset)).toBe(false)
  })

  it('aceita total de dados exatamente no limite', () => {
    const preset = validPreset()
    preset.expression.groups = [{ sides: 6, count: MAX_SIMULTANEOUS_DICE }]
    expect(isValidPresetInput(preset)).toBe(true)
  })

  it('rejeita formatos completamente malformados', () => {
    expect(isValidPresetInput(null)).toBe(false)
    expect(isValidPresetInput('preset')).toBe(false)
    expect(isValidPresetInput({})).toBe(false)
    expect(isValidPresetInput({ name: 'x', expression: null })).toBe(false)
    expect(isValidPresetInput({ name: 'x', expression: { groups: 'nope', modifiers: [] } })).toBe(
      false
    )
  })

  describe('a regra de MANTER ("role 3d20 e use o maior")', () => {
    function comKeep(keep: unknown) {
      return {
        name: 'Teste',
        expression: { groups: [{ sides: 20, count: 3 }], modifiers: [], keep }
      }
    }

    it('aceita a regra bem formada, nos dois modos', () => {
      expect(isValidPresetInput(comKeep({ mode: 'highest', count: 1 }))).toBe(true)
      expect(isValidPresetInput(comKeep({ mode: 'lowest', count: 2 }))).toBe(true)
    })

    it('AUSENTE continua válido — presets gravados antes da regra existir', () => {
      /**
       * O `presets.json` é documentado como editável à mão, e existem arquivos gravados antes desta
       * regra existir. Um deles virar inválido de um dia pro outro apagaria os presets de alguém.
       */
      expect(isValidPresetInput(validPreset())).toBe(true)
      expect(isValidPresetInput(comKeep(undefined))).toBe(true)
      expect(isValidPresetInput(comKeep(null))).toBe(true)
    })

    it('recusa a regra torta em vez de deixar a conta cair calada em "somar tudo"', () => {
      expect(isValidPresetInput(comKeep({ mode: 'maior', count: 1 }))).toBe(false)
      expect(isValidPresetInput(comKeep({ mode: 'highest', count: 0 }))).toBe(false)
      expect(isValidPresetInput(comKeep({ mode: 'highest', count: -2 }))).toBe(false)
      expect(isValidPresetInput(comKeep({ mode: 'highest', count: 1.5 }))).toBe(false)
      expect(isValidPresetInput(comKeep({ count: 1 }))).toBe(false)
      expect(isValidPresetInput(comKeep('maior'))).toBe(false)
    })
  })
})
