import { join } from 'path'
import { DEFAULT_NOTES, normalizeNotes, type NotesData } from '@shared/types/notes'
import { JsonFileStore } from './JsonFileStore'
import type { ProfilesRepository } from './ProfilesRepository'

/**
 * As anotações são POR PERSONAGEM (ver `shared/types/profile.ts`): o arquivo mora dentro da pasta do
 * perfil aberto, não solto em `userData`. Trocar de perfil não move nada — muda a pasta consultada.
 */
export class NotesRepository {
  /**
   * Um `JsonFileStore` POR PERFIL, criado sob demanda e guardado — o caminho do arquivo depende de
   * qual personagem está aberto (ver `ProfilesRepository.activeDirectory`), e trocar de perfil não
   * pode reaproveitar o store do anterior. O cache existe porque o `JsonFileStore` guarda a fila de
   * gravações dele: recriá-lo a cada chamada jogaria fora essa fila, que é justamente o que impede
   * duas gravações concorrentes de se atropelarem.
   */
  private readonly stores = new Map<string, JsonFileStore<NotesData>>()

  private store(): JsonFileStore<NotesData> {
    const directory = this.profiles.activeDirectory()
    const existing = this.stores.get(directory)
    if (existing) return existing
    const created = new JsonFileStore<NotesData>(join(directory, 'notes.json'), DEFAULT_NOTES)
    this.stores.set(directory, created)
    return created
  }

  constructor(private readonly profiles: ProfilesRepository) {}

  /**
   * Passa pelo `normalizeNotes` na LEITURA, não na gravação: é aqui que o arquivo do formato antigo
   * (um bloco `notes` só) vira o diário de páginas. Migrar na leitura significa que o arquivo no
   * disco só muda quando a pessoa escrever algo — abrir a aba e sair não reescreve nada.
   */
  async get(): Promise<NotesData> {
    return normalizeNotes(await this.store().read())
  }

  async save(notes: NotesData): Promise<NotesData> {
    await this.store().write(notes)
    return notes
  }
}
