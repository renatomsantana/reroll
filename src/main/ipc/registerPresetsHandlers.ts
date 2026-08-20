import { promises as fs } from 'fs'
import { dialog, ipcMain } from 'electron'
import type { Preset, PresetInput } from '@shared/types/preset'
import { IpcChannels } from '@shared/ipcChannels'
import { DEFAULT_DICE_SIDES, MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'
import { PresetsRepository } from '../storage/PresetsRepository'

/**
 * `presets.json` é documentado no README como editável à mão (backup/transferência manual
 * entre computadores) — uma entrada corrompida ou mal editada nele não é um cenário
 * "impossível de acontecer" a ignorar. Sem validar aqui, um `sides`/`count` inválido só
 * quebra bem mais tarde, na hora de montar a cena 3D (`DICE_REGISTRY[sides]` indefinido),
 * silenciosamente — travando a rolagem em vez de recusar o dado ruim de cara.
 */
export function isValidPresetInput(value: unknown): value is PresetInput {
  if (typeof value !== 'object' || value === null) return false
  const preset = value as Record<string, unknown>

  if (typeof preset.name !== 'string' || preset.name.trim() === '') return false
  if (preset.icon !== undefined && typeof preset.icon !== 'string') return false

  const expression = preset.expression as Record<string, unknown> | undefined
  if (typeof expression !== 'object' || expression === null) return false
  if (!Array.isArray(expression.groups) || !Array.isArray(expression.modifiers)) return false
  if (expression.groups.length === 0) return false

  /**
   * `sides` tem que ser um dos SETE tipos que o app rola, e não só um inteiro positivo.
   *
   * A cena 3D faz `DICE_REGISTRY[sides]` sem guarda (`DiceCanvasMulti.tsx`) — com um `d30` ali o
   * `entry` vem `undefined` e a montagem inteira estoura, ou seja, o preset não falha sozinho: leva
   * a bandeja junto. Três caminhos gravam preset e todos passam por aqui: o editor, a IMPORTAÇÃO DE
   * PRESETS POR ARQUIVO (um `.json` que a pessoa escolheu, que pode vir de qualquer lugar) e agora a
   * importação de ficha. `> 0` protegia só do zero e do negativo.
   */
  const groupsValid = expression.groups.every(
    (g) =>
      typeof g === 'object' &&
      g !== null &&
      Number.isInteger((g as Record<string, unknown>).sides) &&
      DEFAULT_DICE_SIDES.includes((g as Record<string, unknown>).sides as number) &&
      Number.isInteger((g as Record<string, unknown>).count) &&
      ((g as Record<string, unknown>).count as number) > 0
  )
  const totalDiceCount = (expression.groups as Record<string, unknown>[]).reduce(
    (sum, g) => sum + (typeof g.count === 'number' ? g.count : 0),
    0
  )
  const modifiersValid = expression.modifiers.every(
    (m) =>
      typeof m === 'object' &&
      m !== null &&
      (m as Record<string, unknown>).type === 'flat' &&
      Number.isInteger((m as Record<string, unknown>).value)
  )

  return (
    groupsValid && modifiersValid && keepValido(expression.keep) && totalDiceCount <= MAX_SIMULTANEOUS_DICE
  )
}

/**
 * A regra de manter ("role 3d20 e use o maior"), quando houver uma.
 *
 * AUSENTE é válido, e é o caso de todo preset gravado antes de a regra existir — um `presets.json`
 * antigo não pode virar inválido de um dia pro outro. O que não passa é `keep` presente e torto:
 * `count` zero ou negativo não deixaria dado nenhum no total, e um `mode` desconhecido faria a conta
 * cair em silêncio no comportamento de "manter tudo", que é o oposto do que o arquivo pede.
 */
function keepValido(keep: unknown): boolean {
  if (keep === undefined || keep === null) return true
  if (typeof keep !== 'object') return false
  const regra = keep as Record<string, unknown>
  if (regra.mode !== 'highest' && regra.mode !== 'lowest') return false
  return Number.isInteger(regra.count) && (regra.count as number) > 0
}

export function registerPresetsHandlers(repository: PresetsRepository): void {
  ipcMain.handle(IpcChannels.presetsGetAll, () => repository.getAll())

  ipcMain.handle(IpcChannels.presetsCreate, (_event, input: PresetInput) => {
    if (!isValidPresetInput(input)) throw new Error('Preset inválido.')
    return repository.create(input)
  })

  ipcMain.handle(IpcChannels.presetsUpdate, (_event, id: string, input: PresetInput) => {
    if (!isValidPresetInput(input)) throw new Error('Preset inválido.')
    return repository.update(id, input)
  })

  ipcMain.handle(IpcChannels.presetsDelete, (_event, id: string) => repository.delete(id))

  ipcMain.handle(IpcChannels.presetsExport, async () => {
    const presets = await repository.getAll()
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar presets',
      defaultPath: 'presets-reroll.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null

    await fs.writeFile(filePath, JSON.stringify(presets, null, 2), 'utf-8')
    return filePath
  })

  ipcMain.handle(IpcChannels.presetsImport, async (): Promise<Preset[] | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Importar presets',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return null

    const raw = await fs.readFile(filePaths[0], 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Arquivo inválido: esperado uma lista de presets.')
    }

    const validInputs = parsed.filter(isValidPresetInput)
    if (validInputs.length === 0) {
      throw new Error('Nenhum preset válido encontrado no arquivo.')
    }

    return repository.importMany(validInputs)
  })
}
