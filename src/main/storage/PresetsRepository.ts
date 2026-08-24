import { randomUUID } from 'crypto'
import { join } from 'path'
import type { Preset, PresetInput } from '@shared/types/preset'
import { MAXIMO_DE_PRESETS_POR_PERSONAGEM } from '@shared/diceRegistry'
import { JsonFileStore } from './JsonFileStore'
import type { ProfilesRepository } from './ProfilesRepository'

/**
 * Os presets são POR PERSONAGEM (ver `shared/types/profile.ts`) — "os presets, tudo dele". O arquivo
 * mora dentro da pasta do perfil aberto, não solto em `userData`.
 */
export class PresetsRepository {
  /**
   * Um `JsonFileStore` POR PERFIL, criado sob demanda e guardado — o caminho do arquivo depende de
   * qual personagem está aberto (ver `ProfilesRepository.activeDirectory`), e trocar de perfil não
   * pode reaproveitar o store do anterior. O cache existe porque o `JsonFileStore` guarda a fila de
   * gravações dele: recriá-lo a cada chamada jogaria fora essa fila, que é justamente o que impede
   * duas gravações concorrentes de se atropelarem.
   */
  private readonly stores = new Map<string, JsonFileStore<Preset[]>>()

  private store(): JsonFileStore<Preset[]> {
    const directory = this.profiles.activeDirectory()
    const existing = this.stores.get(directory)
    if (existing) return existing
    const created = new JsonFileStore<Preset[]>(join(directory, 'presets.json'), [])
    this.stores.set(directory, created)
    return created
  }

  constructor(private readonly profiles: ProfilesRepository) {}

  async getAll(): Promise<Preset[]> {
    return this.store().read()
  }

  async create(input: PresetInput): Promise<Preset> {
    const presets = await this.store().read()
    conferirTeto(presets.length + 1)
    const now = Date.now()
    const preset: Preset = {
      id: randomUUID(),
      name: input.name,
      icon: input.icon,
      expression: input.expression,
      formula: input.formula,
      createdAt: now,
      updatedAt: now
    }
    await this.store().write([...presets, preset])
    return preset
  }

  async update(id: string, input: PresetInput): Promise<Preset> {
    const presets = await this.store().read()
    const index = presets.findIndex((p) => p.id === id)
    if (index === -1) {
      throw new Error(`Preset não encontrado: ${id}`)
    }

    const updated: Preset = {
      ...presets[index],
      name: input.name,
      icon: input.icon,
      // Os DOIS, sempre — o preset guarda um só (ver `preset.ts`), e editar um preset de fórmula
      // pra virar um de botões precisa APAGAR a fórmula antiga; o spread acima a deixaria viva.
      expression: input.expression,
      formula: input.formula,
      updatedAt: Date.now()
    }

    const next = [...presets]
    next[index] = updated
    await this.store().write(next)
    return updated
  }

  async delete(id: string): Promise<void> {
    const presets = await this.store().read()
    await this.store().write(presets.filter((p) => p.id !== id))
  }

  /** Adiciona vários presets de uma vez (importação), sempre com id/timestamps novos. */
  async importMany(inputs: PresetInput[]): Promise<Preset[]> {
    const presets = await this.store().read()
    conferirTeto(presets.length + inputs.length)
    const now = Date.now()
    const imported: Preset[] = inputs.map((input) => ({
      id: randomUUID(),
      name: input.name,
      icon: input.icon,
      expression: input.expression,
      formula: input.formula,
      createdAt: now,
      updatedAt: now
    }))
    const next = [...presets, ...imported]
    await this.store().write(next)
    return next
  }
}

/**
 * O teto de presets do personagem, cobrado onde os três caminhos de gravação se encontram — ver
 * `MAXIMO_DE_PRESETS_POR_PERSONAGEM`. A regra é sobre CRESCER: um arquivo que já veio do disco com
 * mais do que o teto continua legível, editável e apagável; o que não passa é ganhar mais um.
 */
function conferirTeto(totalDepois: number): void {
  if (totalDepois > MAXIMO_DE_PRESETS_POR_PERSONAGEM) {
    throw new Error(
      `Limite de ${MAXIMO_DE_PRESETS_POR_PERSONAGEM} presets por personagem atingido — apague alguns antes de criar ou importar outros.`
    )
  }
}
