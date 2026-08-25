import { randomUUID } from 'crypto'
import { join } from 'path'
import {
  MAXIMO_DE_FAVORITOS,
  favoritoSaneado,
  favoritosOrdenados,
  reindexarFavoritos,
  type Preset,
  type PresetInput
} from '@shared/types/preset'
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

  /**
   * A leitura SANEIA o `favorito`: `presets.json` é editável à mão, e uma estrela escrita como
   * texto ou negativa não pode virar posição na fileira do modo compacto. O resto do preset já
   * passa pelo `isValidPresetInput` na entrada.
   */
  async getAll(): Promise<Preset[]> {
    const lidos = await this.store().read()
    return lidos.map((preset) => {
      const favorito = favoritoSaneado(preset.favorito)
      if (favorito === preset.favorito) return preset
      const { favorito: _fora, ...semFavorito } = preset
      return favorito === undefined ? semFavorito : { ...semFavorito, favorito }
    })
  }

  /**
   * A ESTRELA (spec §3.9): marca ou desmarca. Marcar põe no FIM da fileira; desmarcar tira e
   * reindexa os outros. Cobra o teto de favoritos — a fileira do modo compacto tem seis lugares.
   */
  async setFavorito(id: string, favorito: boolean): Promise<Preset[]> {
    const presets = await this.getAll()
    const alvo = presets.find((p) => p.id === id)
    if (!alvo) throw new Error(`Preset não encontrado: ${id}`)
    const favoritos = favoritosOrdenados(presets)
    if (favorito && alvo.favorito === undefined && favoritos.length >= MAXIMO_DE_FAVORITOS) {
      throw new Error(`Limite de ${MAXIMO_DE_FAVORITOS} favoritos — tire a estrela de um antes de marcar outro.`)
    }
    const proximos: Preset[] = presets.map((p) => {
      if (p.id !== id) return p
      if (!favorito) {
        const { favorito: _fora, ...semFavorito } = p
        return semFavorito
      }
      return { ...p, favorito: p.favorito ?? favoritos.length }
    })
    const reindexados = reindexarFavoritos(proximos)
    await this.store().write(reindexados)
    return reindexados
  }

  /** Troca de lugar com o vizinho na fileira de favoritos (−1 sobe, +1 desce). Na ponta, não faz nada. */
  async moverFavorito(id: string, direcao: -1 | 1): Promise<Preset[]> {
    const presets = await this.getAll()
    const favoritos = favoritosOrdenados(presets)
    const indice = favoritos.findIndex((p) => p.id === id)
    if (indice === -1) throw new Error(`Preset não é favorito: ${id}`)
    const vizinho = favoritos[indice + direcao]
    if (!vizinho) return presets
    const atual = favoritos[indice]
    const trocados = presets.map((p) => {
      if (p.id === atual.id) return { ...p, favorito: vizinho.favorito }
      if (p.id === vizinho.id) return { ...p, favorito: atual.favorito }
      return p
    })
    const reindexados = reindexarFavoritos(trocados)
    await this.store().write(reindexados)
    return reindexados
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
    // Apagar um favorito reindexa os outros — a fileira não fica com buraco.
    await this.store().write(reindexarFavoritos(presets.filter((p) => p.id !== id)))
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
