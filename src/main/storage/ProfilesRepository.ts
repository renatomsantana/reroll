import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_PROFILE_ID,
  normalizeProfiles,
  type ProfilesState
} from '@shared/types/profile'
import { JsonFileStore } from './JsonFileStore'

/**
 * Lista de perfis de personagem + qual está aberto (ver `shared/types/profile.ts`).
 *
 * Além de guardar a lista, é ela que diz ONDE ficam os dados de cada personagem: cada perfil tem uma
 * pasta própria dentro de `userData/profiles/<id>/`, e é dali que `NotesRepository` e
 * `PresetsRepository` leem e escrevem. Trocar de perfil não move arquivo nenhum — muda o diretório
 * que os dois consultam.
 */
export class ProfilesRepository {
  private readonly store: JsonFileStore<ProfilesState>
  private readonly userData: string
  /**
   * Estado em memória. Existe porque `NotesRepository`/`PresetsRepository` precisam do id do perfil
   * ativo a CADA leitura e gravação — ir ao disco em toda tecla digitada nas anotações seria uma
   * leitura de arquivo por caractere.
   */
  private state: ProfilesState | null = null

  constructor() {
    this.userData = app.getPath('userData')
    this.store = new JsonFileStore<ProfilesState>(join(this.userData, 'profiles.json'), {
      profiles: [],
      activeId: DEFAULT_PROFILE_ID
    })
  }

  /** Carrega do disco (uma vez), migra o formato antigo e deixa pronto pra uso síncrono. */
  async init(): Promise<ProfilesState> {
    this.state = normalizeProfiles(await this.store.read())
    await this.migrateLegacyFiles()
    return this.state
  }

  async get(): Promise<ProfilesState> {
    return this.state ?? (await this.init())
  }

  async save(next: ProfilesState): Promise<ProfilesState> {
    this.state = normalizeProfiles(next)
    await this.store.write(this.state)
    return this.state
  }

  /** Pasta do perfil aberto. Criada sob demanda — perfil recém-criado ainda não tem nada gravado. */
  activeDirectory(): string {
    const activeId = this.state?.activeId ?? DEFAULT_PROFILE_ID
    return join(this.userData, 'profiles', activeId)
  }

  /**
   * Quem já usava o app tem `notes.json` e `presets.json` soltos em `userData` — o formato de antes
   * dos perfis. Eles viram o conteúdo do perfil padrão em vez de sumir: ninguém perde a ficha nem os
   * presets por causa de uma mudança de tela.
   *
   * MOVE, não copia, e só quando o destino ainda não existe. Copiar deixaria duas cópias divergindo
   * a partir da primeira edição; sobrescrever um destino existente apagaria dados de um perfil já em
   * uso, no caso de o arquivo antigo reaparecer (backup restaurado, por exemplo).
   */
  private async migrateLegacyFiles(): Promise<void> {
    const destino = join(this.userData, 'profiles', DEFAULT_PROFILE_ID)
    for (const arquivo of ['notes.json', 'presets.json']) {
      const antigo = join(this.userData, arquivo)
      const novo = join(destino, arquivo)
      try {
        await fs.access(antigo)
      } catch {
        continue
      }
      try {
        await fs.access(novo)
        continue
      } catch {
        // destino livre: pode mover
      }
      await fs.mkdir(destino, { recursive: true })
      await fs.rename(antigo, novo)
    }
  }
}
