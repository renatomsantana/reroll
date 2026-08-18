import { randomUUID } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import type { Preset, PresetInput } from '@shared/types/preset'
import { JsonFileStore } from './JsonFileStore'

export class PresetsRepository {
  private readonly store: JsonFileStore<Preset[]>

  constructor() {
    const filePath = join(app.getPath('userData'), 'presets.json')
    this.store = new JsonFileStore<Preset[]>(filePath, [])
  }

  async getAll(): Promise<Preset[]> {
    return this.store.read()
  }

  async create(input: PresetInput): Promise<Preset> {
    const presets = await this.store.read()
    const now = Date.now()
    const preset: Preset = {
      id: randomUUID(),
      name: input.name,
      icon: input.icon,
      expression: input.expression,
      createdAt: now,
      updatedAt: now
    }
    await this.store.write([...presets, preset])
    return preset
  }

  async update(id: string, input: PresetInput): Promise<Preset> {
    const presets = await this.store.read()
    const index = presets.findIndex((p) => p.id === id)
    if (index === -1) {
      throw new Error(`Preset não encontrado: ${id}`)
    }

    const updated: Preset = {
      ...presets[index],
      name: input.name,
      icon: input.icon,
      expression: input.expression,
      updatedAt: Date.now()
    }

    const next = [...presets]
    next[index] = updated
    await this.store.write(next)
    return updated
  }

  async delete(id: string): Promise<void> {
    const presets = await this.store.read()
    await this.store.write(presets.filter((p) => p.id !== id))
  }

  /** Adiciona vários presets de uma vez (importação), sempre com id/timestamps novos. */
  async importMany(inputs: PresetInput[]): Promise<Preset[]> {
    const presets = await this.store.read()
    const now = Date.now()
    const imported: Preset[] = inputs.map((input) => ({
      id: randomUUID(),
      name: input.name,
      icon: input.icon,
      expression: input.expression,
      createdAt: now,
      updatedAt: now
    }))
    const next = [...presets, ...imported]
    await this.store.write(next)
    return next
  }
}
