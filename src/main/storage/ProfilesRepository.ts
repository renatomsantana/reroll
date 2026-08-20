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
    const bruto = await this.store.read()
    this.state = normalizeProfiles(bruto)

    /**
     * Se a normalização precisou TROCAR ALGUM ID, o conserto tem que ir pro disco agora.
     *
     * `normalizeProfiles` dá um id novo a perfil com id repetido ou impróprio (ver o comentário
     * dela). Sem gravar de volta, esse id novo vale só pra esta execução: na abertura seguinte o
     * arquivo ainda traz o id defeituoso e sorteia-se OUTRO id — ou seja, o personagem estreia numa
     * pasta vazia toda vez que o app abre, e tudo o que ele escreveu na sessão anterior fica órfão
     * numa pasta que ninguém mais procura. O conserto instável é pior que o defeito, porque o
     * defeito ao menos era estável.
     *
     * Só grava quando de fato mudou: abrir o app não pode reescrever `profiles.json` à toa.
     */
    if (this.idsForamRemendados(bruto)) await this.store.write(this.state)

    await this.migrateLegacyFiles()
    return this.state
  }

  /** Os ids que saíram da normalização são os mesmos que estavam no arquivo, na mesma ordem? */
  private idsForamRemendados(bruto: unknown): boolean {
    const lista = (bruto as Partial<ProfilesState> | null)?.profiles
    const originais = Array.isArray(lista) ? lista.map((p) => (p as { id?: unknown } | null)?.id) : []
    const atuais = this.state?.profiles.map((p) => p.id) ?? []
    if (originais.length !== atuais.length) return true
    return atuais.some((id, i) => id !== originais[i])
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
