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
})
