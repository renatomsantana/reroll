/**
 * PERFIL DE PERSONAGEM — pedido do usuário: "um espaço para poder selecionar o profile do
 * personagem, tipo nome e qual sistema de rpg, e aí precisa colocar uma foto também... os dados são
 * customizados para o de Rodrigo, as cores, e já ficam tudo salvo, as anotações, os presets, tudo
 * dele... mas quando eu voltar pro profile do Rodrigo, volta como era antes".
 *
 * Ou seja: o perfil não é só um rótulo, é um COMPARTIMENTO. Cada um carrega as próprias anotações,
 * os próprios presets e a própria aparência (cores de dado, de bandeja, de torre, imagem de fundo).
 * Trocar de personagem troca tudo isso de uma vez, e voltar traz tudo de volta exatamente como
 * estava.
 *
 * O que NÃO é por perfil: idioma, tema, fonte, som, ícone do app — preferências de quem usa o
 * programa, não do personagem. Alguém que joga de Rodrigo e de Marina não quer o app em inglês
 * quando muda de ficha. A divisão está em `PROFILE_LOOK_KEYS`, em `SettingsContext.tsx`.
 */
export interface Profile {
  id: string
  /** Nome do personagem. Vazio = a interface mostra "Personagem N" pela posição, como as sessões. */
  name: string
  /** Sistema de RPG — texto livre de propósito: "Ordem Paranormal", "Kids on Bikes", "Oblivio". */
  system: string
  /**
   * Foto, como data URL base64 (mesma escolha da imagem de fundo da cena, ver
   * `registerSceneBackgroundHandlers.ts`): guardar o CAMINHO do arquivo quebraria assim que a
   * pessoa movesse ou apagasse a imagem original, e carregar por `file://` briga com o
   * `Content-Security-Policy` do renderer.
   */
  photo: string | null
  createdAt: number
}

export interface ProfilesState {
  profiles: Profile[]
  /** Perfil aberto. É ele que decide de qual pasta saem anotações e presets. */
  activeId: string
}

/**
 * Id do perfil criado na primeira abertura — FIXO, e não sorteado, porque é para ele que migram as
 * anotações e os presets de quem já usava o app antes de existirem perfis (ver
 * `ProfilesRepository.migrateLegacyFiles`). Com um id sorteado, uma migração interrompida no meio
 * criaria um segundo perfil na próxima abertura e deixaria os arquivos antigos órfãos.
 */
export const DEFAULT_PROFILE_ID = 'default'

export function createProfile(name = '', system = ''): Profile {
  return { id: crypto.randomUUID(), name, system, photo: null, createdAt: Date.now() }
}

/**
 * Deixa qualquer conteúdo lido do disco no formato atual: garante ao menos um perfil e um `activeId`
 * que aponta pra um perfil que existe de verdade (arquivo editado à mão, ou perfil apagado numa
 * versão e reaberto em outra).
 */
export function normalizeProfiles(raw: unknown): ProfilesState {
  const data = raw as Partial<ProfilesState> | null
  const profiles = Array.isArray(data?.profiles)
    ? data.profiles.filter((p): p is Profile => typeof p?.id === 'string')
    : []

  if (profiles.length === 0) {
    profiles.push({
      id: DEFAULT_PROFILE_ID,
      name: '',
      system: '',
      photo: null,
      createdAt: Date.now()
    })
  }

  const activeId = profiles.some((p) => p.id === data?.activeId)
    ? (data?.activeId as string)
    : profiles[0].id

  return { profiles, activeId }
}
