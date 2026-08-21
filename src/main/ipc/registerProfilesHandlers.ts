import { ipcMain } from 'electron'
import type { ProfilesState } from '@shared/types/profile'
import { IpcChannels } from '@shared/ipcChannels'
import type { ProfilesRepository } from '../storage/ProfilesRepository'
import { escolherImagemComoDataUrl } from './escolherImagem'

/**
 * Perfis de personagem: ler, gravar e escolher a foto.
 *
 * A gravação é do ESTADO INTEIRO (lista + qual está aberto), não uma operação por ação
 * (criar/renomear/apagar/trocar). São todas edições de uma lista pequena que a tela já tem em mãos,
 * e um handler por verbo só multiplicaria caminhos de erro — o `PresetsRepository`, que tem
 * create/update/delete próprios, é outro caso: lá a lista é do usuário e cresce sem limite.
 *
 * Quem confere o que chega em `profilesSave` é o `normalizeProfiles` do repositório, e ele é a
 * conferência de verdade: id que não serve como nome de pasta é o caminho pelo qual o app escreveria
 * fora de `userData` (ver o comentário de `ProfilesRepository.activeDirectory`).
 */
export function registerProfilesHandlers(repository: ProfilesRepository): void {
  ipcMain.handle(IpcChannels.profilesGet, () => repository.get())
  ipcMain.handle(IpcChannels.profilesSave, (_event, state: ProfilesState) => repository.save(state))

  /**
   * Foto do personagem, como data URL — mesmo caminho (e mesmo código) da imagem de fundo da cena,
   * ver `escolherImagem.ts`.
   */
  ipcMain.handle(IpcChannels.profilesPickPhoto, () =>
    escolherImagemComoDataUrl('Escolher foto do personagem')
  )
}
