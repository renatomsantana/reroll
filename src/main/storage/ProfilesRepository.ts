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
 * Lista de perfis de personagem + qual está aberto (ver `shared/types/profile.ts`).
 *
 * Além de guardar a lista, é ela que diz ONDE ficam os dados de cada personagem: cada perfil tem uma
 * pasta própria dentro de `userData/profiles/<id>/`, e é dali que `NotesRepository` e
 * `PresetsRepository` leem e escrevem. Trocar de perfil não move arquivo nenhum: muda o diretório
 * que os dois consultam.
 */
export class ProfilesRepository {
  private readonly store: JsonFileStore<ProfilesState>
  private readonly userData: string
  /**
   * Estado em memória. Existe porque `NotesRepository`/`PresetsRepository` precisam do id do perfil
   * ativo a CADA leitura e gravação: ir ao disco em toda tecla digitada nas anotações seria uma
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
     * arquivo ainda traz o id defeituoso e sorteia-se OUTRO id: ou seja, o personagem estreia numa
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

  /**
   * Grava a lista. Recusa a gravação que faria a lista CRESCER além do teto (`MAX_PROFILES`).
   *
   * A regra é sobre CRESCER, e não sobre o tamanho, e a diferença é o que a torna segura: uma lista
   * que já veio do disco com vinte personagens: backup restaurado, arquivo de uma versão em que o
   * teto era outro: continua editável, apagável e gravável. O que não passa é sair de quinze pra
   * dezesseis. Um teto que olhasse só o tamanho travaria o app de quem tem mais, e a única saída
   * seria editar JSON na mão.
   *
   * A trava vive AQUI, e não só no botão da tela, porque o canal `profiles:save` grava o estado
   * inteiro de uma vez: qualquer caminho do renderer que monte uma lista maior chega direto no
   * disco. Medido no app rodando: a interface parava em quinze e o canal aceitava o décimo sexto
   * sem reclamar.
   */
  async save(next: ProfilesState): Promise<ProfilesState> {
    const limpo = normalizeProfiles(next)
    const atual = this.state?.profiles.length ?? 0
    /**
     * O teto do DISCO (`TETO_DE_PERSONAGENS_NO_DISCO`, quinze), e não o de criação (`MAX_PROFILES`,
     * três neste beta): quem testou o beta.2 pode ter mais de três, e a lista dele precisa continuar
     * gravável: renomear, trocar de ativo, apagar. O três é cobrado onde personagem NASCE
     * (`ProfilesContext.create` e o canal de importação).
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
     * Personagem que SAIU da lista: a pasta dele vai pra `backups/personagens-apagados/` (spec
     * §9.1; ver `backupsDeDados.ts`). Antes ela ficava órfã em `profiles/`, onde ninguém acha.
     * DEPOIS de gravar a lista, e sem derrubar a gravação: a lista nova já está no disco, e uma
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
   * Pasta do perfil aberto. Criada sob demanda: perfil recém-criado ainda não tem nada gravado.
   *
   * O id é SANEADO antes de virar nome de pasta, e isso é defesa, não capricho: ele chega do
   * renderer (`profiles.save`) e também é lido de `profiles.json`, um arquivo que qualquer coisa
   * rodando na máquina pode editar. Um id como `..\..\Startup` sairia de `userData` e faria o app
   * escrever a ficha do personagem numa pasta arbitrária do sistema: o app viraria a ferramenta de
   * escrita de quem plantou o id.
   *
   * A lista branca é a forma certa aqui porque o id de verdade é um UUID: letras, números, hífen e
   * underline cobrem 100% do que o app gera, e qualquer outra coisa é, por definição, alguém
   * tentando outra coisa. O que não passa vira `_`, então o perfil ainda abre: o app não quebra na
   * mão de quem não fez nada.
   */
  activeDirectory(): string {
    const activeId = this.state?.activeId ?? DEFAULT_PROFILE_ID
    return join(this.userData, 'profiles', sanearIdDePasta(activeId))
  }

  /**
   * Quem já usava o app tem `notes.json` e `presets.json` soltos em `userData`: o formato de antes
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

/**
 * Deixa só o que pode virar nome de pasta com segurança. Fora da classe porque é regra pura e
 * testável sozinha: ver `profileIsolation.test.ts`.
 */
export function sanearIdDePasta(id: string): string {
  const limpo = id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)
  /**
   * Só o VAZIO precisa de rede: `.` e `..` não sobrevivem à lista branca (o ponto não está nela, e
   * vira `_` como qualquer outro caractere de fora). Eu tinha escrito uma guarda contra `^\.+$`
   * aqui, e o teste provou que ela era inalcançável.
   */
  return limpo || '_'
}
