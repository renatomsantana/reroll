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

/**
 * QUANTOS PERSONAGENS cabem. Quinze.
 *
 * A spec pede "pelo menos 10, e trate 10 como o mínimo garantido, não como limite". Quinze é a
 * escolha do usuário em cima disso, e ela tem um porquê que não é técnico: cada personagem carrega
 * a ficha, o diário, os presets e a aparência DELE, e é isso que a importação de PDF vai preencher.
 * Quinze cobre folgado quem joga em três ou quatro mesas ao mesmo tempo, que é o caso real.
 *
 * O teto vale na CRIAÇÃO, e não na leitura. `normalizeProfiles` NUNCA corta a lista, mesmo que ela
 * venha do disco com mais que isto: um arquivo restaurado de backup, ou escrito por uma versão em
 * que o teto era outro, não pode perder personagem por causa de um número que mudou. O que o app
 * faz é parar de deixar criar mais — o que sobra continua lá, editável e apagável.
 *
 * Quem cobra o teto: `ProfilesContext.create` (o botão "Novo personagem") e o canal de importação de
 * ficha. Os dois, porque são os dois jeitos de nascer um personagem.
 */
export const MAX_PROFILES = 15

export function createProfile(name = '', system = ''): Profile {
  return { id: crypto.randomUUID(), name, system, photo: null, createdAt: Date.now() }
}

/**
 * Um id serve como NOME DE PASTA?
 *
 * A pergunta importa porque `ProfilesRepository.activeDirectory()` monta o caminho dos dados do
 * personagem com `join(userData, 'profiles', id)` — o id não é só uma chave, é um pedaço de caminho
 * de arquivo. Um id vazio faz as anotações caírem na pasta `profiles/` inteira, em cima do que
 * estiver lá; um id com `..` ou com barra sai da pasta do app e vai escrever onde não devia.
 *
 * Nada disso acontece com id gerado pelo app (`crypto.randomUUID`). Acontece com arquivo editado à
 * mão, restaurado de backup pela metade ou gravado por uma versão futura com outro formato — e o
 * estrago é silencioso, que é o que o torna caro.
 */
function idServeComoPasta(id: string): boolean {
  if (!id.trim()) return false
  if (id === '.' || id === '..') return false
  // Separadores dos dois sistemas e os dois-pontos do Windows (`C:`) — qualquer um deles faz o
  // `join` produzir um caminho que não é mais "uma pasta dentro de profiles".
  return !/[\\/:]/.test(id)
}

/**
 * Deixa qualquer conteúdo lido do disco no formato atual: garante ao menos um perfil, campos com os
 * tipos certos, um id ÚNICO e utilizável como pasta em cada perfil, e um `activeId` que aponta pra
 * um perfil que existe de verdade (arquivo editado à mão, ou perfil apagado numa versão e reaberto
 * em outra).
 *
 * A distinção entre SEM id e COM id ruim é de propósito, e não detalhe:
 *
 * - entrada SEM `id` nenhum é descartada. Não é um personagem que perdeu a chave, é um fragmento —
 *   gravação interrompida no meio, ou objeto de outro formato. Mantê-la encheria a lista de
 *   personagens fantasmas que ninguém criou.
 * - entrada COM `id` que não serve (repetido, vazio, com `..` ou com barra) é MANTIDA, com id novo.
 *   Aqui há um personagem de verdade: o nome e o sistema estão ali, legíveis. Descartar apagaria
 *   alguém da lista por causa de um defeito de arquivo. Com id novo ele continua aparecendo,
 *   apontando pra uma pasta própria e vazia — no pior caso perdem-se as anotações dele, não ele.
 *
 * Repetido é o caso perigoso de verdade: dois personagens com o mesmo id leem e escrevem NA MESMA
 * PASTA (ver `ProfilesRepository.activeDirectory`). Um sobrescreve as anotações do outro a cada
 * tecla, e da tela isso lê como "troquei de personagem e as informações sumiram".
 */
/**
 * A FOTO só entra se for uma imagem embutida, e de tamanho que o app aceitaria escolher.
 *
 * O campo é gravado como data URL e vai direto pra um `<img src>`. A CSP (`img-src 'self' data:`)
 * já impede qualquer outro esquema de carregar, então isto não é o que segura um `javascript:` — é o
 * que segura o TAMANHO. O seletor de foto recusa arquivo acima de 12 MB (ver
 * `TAMANHO_MAXIMO_DA_IMAGEM`), mas o canal `profiles:save` e o `profiles.json` no disco não
 * passavam por limite nenhum: uma foto de 60 MB em base64 seria lida inteira em toda abertura do
 * app. 17 MB de texto é 12 MB de imagem em base64, com folga pro cabeçalho.
 *
 * Formato fora da lista ou grande demais vira `null` — o personagem fica sem foto, e não some.
 */
/**
 * Só o PREFIXO é conferido, de propósito. A primeira versão varria o base64 inteiro com um `+$`
 * ancorado, e `normalizeProfiles` roda no renderer e no main a cada gravação da lista — inclusive a
 * cada tecla no nome do personagem. Quinze fotos de 10 MB eram 150 MB de string varridos por
 * tecla. O que importa pra segurança é o esquema e o tipo; o conteúdo, quem julga é o decodificador
 * de imagem do Chromium, que não executa nada.
 */
const FOTO_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,/
export const TAMANHO_MAXIMO_DA_FOTO = 17 * 1024 * 1024

/** Nome e sistema são rótulos de tela; 200 caracteres é o mesmo teto da importação de ficha. */
export const TAMANHO_MAXIMO_DO_NOME = 200

function fotoValida(foto: unknown): string | null {
  if (typeof foto !== 'string') return null
  if (foto.length > TAMANHO_MAXIMO_DA_FOTO) return null
  return FOTO_EMBUTIDA.test(foto) ? foto : null
}

function rotulo(valor: unknown): string {
  return typeof valor === 'string' ? valor.slice(0, TAMANHO_MAXIMO_DO_NOME) : ''
}

export function normalizeProfiles(raw: unknown): ProfilesState {
  const data = raw as Partial<ProfilesState> | null
  const brutos = Array.isArray(data?.profiles) ? data.profiles : []

  const usados = new Set<string>()
  const profiles: Profile[] = []
  for (const bruto of brutos) {
    const entrada = bruto as Partial<Profile> | null
    if (!entrada || typeof entrada !== 'object') continue
    // SEM id: fragmento, não personagem — ver o comentário acima.
    if (typeof entrada.id !== 'string') continue
    const idOriginal = entrada.id
    const id = idServeComoPasta(idOriginal) && !usados.has(idOriginal) ? idOriginal : crypto.randomUUID()
    usados.add(id)
    profiles.push({
      id,
      // Tipo errado é o mesmo que ausente: o nome vai pra tela e pro `trim()` de quem grava a ficha,
      // e um número ali estoura longe daqui, com uma pilha que não aponta pro arquivo.
      name: rotulo(entrada.name),
      system: rotulo(entrada.system),
      photo: fotoValida(entrada.photo),
      createdAt: typeof entrada.createdAt === 'number' && Number.isFinite(entrada.createdAt) ? entrada.createdAt : 0
    })
  }

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
