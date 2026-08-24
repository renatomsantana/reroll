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

  /**
   * A GRAVAÇÃO confere o que chega — o canal `notes:save` não conferia nada.
   *
   * Achado da revisão de segurança do 1.0.12: dos canais que gravam em disco, este era o único que
   * escrevia o objeto exatamente como veio do renderer, sem normalizar nem limitar. A importação de
   * ficha tem `LIMITES_DA_FICHA`; os presets passam por `isValidPresetInput`; os perfis, por
   * `normalizeProfiles`. As anotações — que gravam A CADA TECLA — não passavam por nada.
   *
   * O renderer é código nosso e roda em sandbox, então isto não é desconfiança dele: é que um
   * defeito de interface (um laço que acrescenta páginas, um estado que cresce sem parar) viraria um
   * `notes.json` de centenas de megabytes lido inteiro em toda abertura do app, e ninguém saberia por
   * quê. O teto vira uma recusa clara, que a aba de anotações já sabe mostrar (`saveError`), e o que
   * está no disco continua intacto — recusar é sempre melhor que gravar pela metade.
   */
  async save(notes: NotesData): Promise<NotesData> {
    const limpo = normalizeNotes(notes)
    const tamanho = Buffer.byteLength(JSON.stringify(limpo), 'utf-8')
    if (tamanho > TETO_DAS_ANOTACOES_EM_BYTES) {
      const mb = Math.round(TETO_DAS_ANOTACOES_EM_BYTES / (1024 * 1024))
      throw new Error(`As anotações passaram do limite de ${mb} MB e não foram gravadas.`)
    }
    await this.store().write(limpo)
    return limpo
  }
}

/**
 * Quanto um `notes.json` pode ter. Dezesseis megabytes de TEXTO são uns cinco mil parágrafos de
 * diário — a terceira leva de personagens de teste, a mais pesada, ocupa 8 KB por ficha. É um teto
 * de "isto não é uma ficha", não de uso normal.
 */
export const TETO_DAS_ANOTACOES_EM_BYTES = 16 * 1024 * 1024
