import { ipcMain } from 'electron'
import type { NotesData } from '@shared/types/notes'
import { IpcChannels } from '@shared/ipcChannels'
import { NotesRepository } from '../storage/NotesRepository'

export function registerNotesHandlers(repository: NotesRepository): void {
  ipcMain.handle(IpcChannels.notesGet, () => repository.get())
  ipcMain.handle(IpcChannels.notesSave, (_event, notes: NotesData) => repository.save(notes))
}
