import { promises as fs } from 'fs'
import { ipcMain } from 'electron'
import type { Preset, PresetInput } from '@shared/types/preset'
import { IpcChannels } from '@shared/ipcChannels'
import {
  DEFAULT_DICE_SIDES,
  MAX_EXPLOSOES_POR_DADO,
  MAX_SIMULTANEOUS_DICE,
  MAXIMO_DE_PRESETS_POR_PERSONAGEM,
  TAMANHO_MAXIMO_DO_ICONE_DO_PRESET,
  TAMANHO_MAXIMO_DO_NOME_DO_PRESET
} from '@shared/diceRegistry'
import { PresetsRepository } from '../storage/PresetsRepository'
import { escolherArquivo, escolherOndeSalvar } from './dialogos'

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
  // Teto de tamanho nos dois textos: é por aqui que passam os três caminhos que gravam preset, e um
  // nome de dez megabytes num `presets.json` editado à mão é lido inteiro em toda abertura.
  if (preset.name.length > TAMANHO_MAXIMO_DO_NOME_DO_PRESET) return false
  if (preset.icon !== undefined && typeof preset.icon !== 'string') return false
  if (typeof preset.icon === 'string' && preset.icon.length > TAMANHO_MAXIMO_DO_ICONE_DO_PRESET) return false

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
    groupsValid &&
    modifiersValid &&
    keepValido(expression.keep) &&
    explodeValido(expression.explode) &&
    totalDiceCount <= MAX_SIMULTANEOUS_DICE
  )
}

/**
 * A regra explosiva ("tirou o máximo, rola de novo"), quando houver uma.
 *
 * AUSENTE é válido, e é o caso de todo preset gravado antes de a regra existir. O que não passa é
 * `explode` presente e torto — e o campo que importa é o TETO: um `maxChain` gigante vindo de um
 * `presets.json` editado à mão é um dado que cai centenas de vezes na bandeja antes de a rolagem
 * terminar, e a pessoa não tem como interromper. O teto do teto é o mesmo que o app usa
 * (`MAX_EXPLOSOES_POR_DADO`), porque um preset não tem por que poder mais do que a interface.
 */
function explodeValido(explode: unknown): boolean {
  if (explode === undefined || explode === null) return true
  if (typeof explode !== 'object') return false
  const regra = explode as Record<string, unknown>
  return (
    Number.isInteger(regra.maxChain) &&
    (regra.maxChain as number) > 0 &&
    (regra.maxChain as number) <= MAX_EXPLOSOES_POR_DADO
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
    // Pela porta de `dialogos.ts`, que é quem lembra a pasta — ver o cabeçalho de lá.
    const filePath = await escolherOndeSalvar({
      proposito: 'presets',
      titulo: 'Exportar presets',
      nomeSugerido: 'presets-reroll.json',
      filtros: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!filePath) return null

    await fs.writeFile(filePath, JSON.stringify(presets, null, 2), 'utf-8')
    return filePath
  })

  ipcMain.handle(IpcChannels.presetsImport, async (): Promise<Preset[] | null> => {
    const caminho = await escolherArquivo({
      proposito: 'presets',
      titulo: 'Importar presets',
      filtros: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!caminho) return null

    return repository.importMany(await lerPresetsDoArquivo(caminho))
  })
}

/**
 * O maior `.json` de presets que o app abre, e quantos presets ele aceita de uma vez.
 *
 * Achado da revisão de segurança do 1.0.12: o PDF de ficha tem teto (`TAMANHO_MAXIMO_DA_FICHA`), a
 * imagem tem teto (`TAMANHO_MAXIMO_DA_IMAGEM`), e a importação de presets lia o arquivo escolhido
 * inteiro pra memória e fazia `JSON.parse` nele, fosse do tamanho que fosse. Um arquivo errado
 * escolhido no diálogo — um vídeo renomeado, um dump de banco — travaria o app tentando analisá-lo.
 *
 * Dois megabytes cabem uns dez mil presets; o teto de quinhentos por importação é o mesmo da
 * importação de ficha (`LIMITES_DA_FICHA.presets`). Acima disso a resposta é RECUSAR com o número
 * na mensagem, e não importar os primeiros quinhentos calado — importação pela metade sem aviso é
 * o tipo de coisa que a pessoa só descobre no meio da sessão.
 */
export const TAMANHO_MAXIMO_DO_ARQUIVO_DE_PRESETS = 2 * 1024 * 1024
/**
 * O mesmo teto do personagem, e não um teto próprio da importação — ver
 * `MAXIMO_DE_PRESETS_POR_PERSONAGEM`: assim tudo o que o app exporta ele importa de volta.
 */
export const MAXIMO_DE_PRESETS_POR_IMPORTACAO = MAXIMO_DE_PRESETS_POR_PERSONAGEM

/** A leitura sem o diálogo, separada pra ser testada com arquivos de verdade. */
export async function lerPresetsDoArquivo(caminho: string): Promise<PresetInput[]> {
  // ANTES de ler: o ponto do limite é não trazer os bytes pra memória.
  const info = await fs.stat(caminho)
  if (!info.isFile()) throw new Error('O caminho escolhido não é um arquivo.')
  if (info.size > TAMANHO_MAXIMO_DO_ARQUIVO_DE_PRESETS) {
    const mb = Math.round(TAMANHO_MAXIMO_DO_ARQUIVO_DE_PRESETS / (1024 * 1024))
    throw new Error(`Arquivo grande demais para ser um arquivo de presets (o limite é ${mb} MB).`)
  }

  const raw = await fs.readFile(caminho, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('Arquivo inválido: esperado uma lista de presets.')
  }
  if (parsed.length > MAXIMO_DE_PRESETS_POR_IMPORTACAO) {
    throw new Error(
      `O arquivo tem ${parsed.length} presets; um personagem guarda no máximo ${MAXIMO_DE_PRESETS_POR_IMPORTACAO}.`
    )
  }

  const validInputs = parsed.filter(isValidPresetInput)
  if (validInputs.length === 0) {
    throw new Error('Nenhum preset válido encontrado no arquivo.')
  }
  return validInputs
}
