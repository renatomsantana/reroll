import { join } from 'path'
import { app } from 'electron'
import { DEFAULT_NOTES, normalizeNotes, type NotesData } from '@shared/types/notes'
import { JsonFileStore } from './JsonFileStore'

export class NotesRepository {
  private readonly store: JsonFileStore<NotesData>

  constructor() {
    const filePath = join(app.getPath('userData'), 'notes.json')
    this.store = new JsonFileStore<NotesData>(filePath, DEFAULT_NOTES)
  }

  /**
   * Passa pelo `normalizeNotes` na LEITURA, não na gravação: é aqui que o arquivo do formato antigo
   * (um bloco `notes` só) vira o diário de páginas. Migrar na leitura significa que o arquivo no
   * disco só muda quando a pessoa escrever algo — abrir a aba e sair não reescreve nada.
   */
  async get(): Promise<NotesData> {
    return normalizeNotes(await this.store.read())
  }

  async save(notes: NotesData): Promise<NotesData> {
    await this.store.write(notes)
    return notes
  }
}
