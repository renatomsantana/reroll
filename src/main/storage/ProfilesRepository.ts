import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_PROFILE_ID,
  TETO_DE_PERSONAGENS_NO_DISCO,
  normalizeProfiles,
  type ProfilesState
} from '@shared/types/profile'
import { JsonFileStore } from './JsonFileStore'
import { guardarPersonagemApagado } from './backupsDeDados'

/**
 * Lista de perfis e qual está aberto (ver `shared/types/profile.ts`). Além da lista, é ela que diz
 * ONDE ficam os dados de cada personagem: cada perfil tem uma pasta em `userData/profiles/<id>/`, e é
 * dali que `NotesRepository` e `PresetsRepository` leem. Trocar de perfil não move arquivo nenhum.
 */
export class ProfilesRepository {
  private readonly store: JsonFileStore<ProfilesState>
  private readonly userData: string
  /**
   * Estado em memória: `NotesRepository`/`PresetsRepository` precisam do id do perfil ativo a CADA
   * leitura e gravação, e ir ao disco em toda tecla seria um arquivo lido por caractere.
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
     * Se a normalização precisou TROCAR ALGUM ID, o conserto vai pro disco agora: sem gravar de
     * volta, o id novo vale só pra esta execução, e na abertura seguinte sorteia-se outro — o
     * personagem estrearia numa pasta vazia toda vez. Conserto instável é pior que o defeito, que ao
     * menos era estável. Só grava quando de fato mudou.
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

  /**
   * Grava a lista, recusando a gravação que a faria CRESCER além do teto. A regra é sobre CRESCER e
   * não sobre o tamanho: uma lista que já veio do disco com vinte personagens (backup restaurado,
   * versão com outro teto) continua editável e apagável, enquanto um teto por tamanho travaria o app
   * de quem tem mais, com a única saída sendo editar JSON à mão.
   *
   * A trava vive AQUI, e não só no botão, porque `profiles:save` grava o estado inteiro de uma vez.
   * Medido no app rodando: a interface parava em quinze e o canal aceitava o décimo sexto.
   */
  async save(next: ProfilesState): Promise<ProfilesState> {
    const limpo = normalizeProfiles(next)
    const atual = this.state?.profiles.length ?? 0
    /**
     * O teto do DISCO (quinze). Hoje o de criação é o mesmo número, mas seguem separados: este é a
     * rede de segurança do arquivo, o outro é cobrado onde personagem NASCE.
     */
    if (limpo.profiles.length > TETO_DE_PERSONAGENS_NO_DISCO && limpo.profiles.length > atual) {
      throw new Error(
        `Limite de ${TETO_DE_PERSONAGENS_NO_DISCO} personagens atingido: apague um antes de criar outro.`
      )
    }
    const idsDeAntes = this.state?.profiles.map((p) => p.id) ?? []
    this.state = limpo
    await this.store.write(this.state)

    /**
     * Personagem que SAIU da lista: a pasta dele vai pra `backups/personagens-apagados/` (spec §9.1),
     * onde antes ficava órfã em `profiles/`. DEPOIS de gravar a lista e sem derrubar a gravação: uma
     * pasta que não deu pra mover continua onde estava, sem prejuízo.
     */
    const idsDeAgora = new Set(limpo.profiles.map((p) => p.id))
    for (const id of idsDeAntes) {
      if (idsDeAgora.has(id)) continue
      try {
        await guardarPersonagemApagado(this.userData, sanearIdDePasta(id))
      } catch (causa) {
        console.error(`Não deu pra guardar a pasta do personagem apagado ${id}:`, causa)
      }
    }
    return this.state
  }

  /**
   * Pasta do perfil aberto, criada sob demanda porque perfil recém-criado ainda não gravou nada.
   *
   * O id é SANEADO antes de virar nome de pasta: ele chega do renderer e também é lido de
   * `profiles.json`, que qualquer coisa na máquina pode editar, e um id como `..\..\Startup` sairia de
   * `userData`. A lista branca serve porque o id de verdade é um UUID; o que não passa vira `_`, então
   * o perfil ainda abre.
   */
  activeDirectory(): string {
    const activeId = this.state?.activeId ?? DEFAULT_PROFILE_ID
    return join(this.userData, 'profiles', sanearIdDePasta(activeId))
  }

  /**
   * Quem já usava o app tem `notes.json` e `presets.json` soltos em `userData`, o formato de antes dos
   * perfis: eles viram o conteúdo do perfil padrão. MOVE, não copia, e só com o destino livre — copiar
   * deixaria duas cópias divergindo, e sobrescrever apagaria dados de um perfil em uso.
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

/**
 * Deixa só o que pode virar nome de pasta com segurança. Fora da classe porque é regra pura e
 * testável sozinha: ver `profileIsolation.test.ts`.
 */
export function sanearIdDePasta(id: string): string {
  const limpo = id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)
  /**
   * Só o VAZIO precisa de rede: `.` e `..` não sobrevivem à lista branca, porque o ponto não está
   * nela. Uma guarda contra `^\.+$` escrita aqui era inalcançável, e o teste provou.
   */
  return limpo || '_'
}
