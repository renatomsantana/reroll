/**
 * PERFIL DE PERSONAGEM: não é um rótulo, é um COMPARTIMENTO — cada um carrega as próprias anotações,
 * presets e aparência ("quando eu voltar pro profile do Rodrigo, volta como era antes").
 *
 * O que NÃO é por perfil são as preferências de quem usa o programa (idioma, tema, fonte, som,
 * ícone): quem joga de Rodrigo e de Marina não quer o app em inglês ao trocar de ficha. A divisão
 * está em `PROFILE_LOOK_KEYS`.
 */
import { PERSONAGENS_LIBERADOS } from '../liberacoes'

export interface Profile {
  id: string
  /** Nome do personagem. Vazio = a interface mostra "Personagem N" pela posição, como as sessões. */
  name: string
  /** Sistema de RPG — texto livre de propósito: "Ordem Paranormal", "Kids on Bikes", "Oblivio". */
  system: string
  /**
   * Foto, como data URL base64 (mesma escolha da imagem de fundo da cena): guardar o CAMINHO
   * quebraria assim que a pessoa movesse a imagem, e `file://` briga com a CSP do renderer.
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
 * Id do perfil criado na primeira abertura — FIXO, e não sorteado, porque é pra ele que migram as
 * anotações de quem já usava o app antes de existirem perfis. Com id sorteado, uma migração
 * interrompida criaria um segundo perfil na abertura seguinte e deixaria os arquivos antigos órfãos.
 */
export const DEFAULT_PROFILE_ID = 'default'

/**
 * O que o `profiles.json` ACEITA gravar — o teto do disco (`ProfilesRepository.save`), separado do
 * teto de criação logo abaixo: quem já tinha quinze personagens continua podendo renomear, trocar de
 * ativo e apagar, e um arquivo absurdo (centenas) continua recusado.
 */
export const TETO_DE_PERSONAGENS_NO_DISCO = 15

/**
 * QUANTOS PERSONAGENS a pessoa pode CRIAR: "EU o DONO posso ter quantos personagens quiser, OS
 * OUTROS usuários apenas 3". Quem escolhe o lado é `PERSONAGENS_LIBERADOS`, a mesma chave de
 * liberação do HUD: ligada na `main`, desligada no branch `lancamento`.
 *
 * Vale na CRIAÇÃO e não na leitura — `normalizeProfiles` nunca corta a lista, porque um arquivo
 * restaurado de backup não pode perder personagem por causa de um número que mudou.
 */
export const MAX_PROFILES = PERSONAGENS_LIBERADOS ? TETO_DE_PERSONAGENS_NO_DISCO : 3

export function createProfile(name = '', system = ''): Profile {
  return { id: crypto.randomUUID(), name, system, photo: null, createdAt: Date.now() }
}

/**
 * Um id serve como NOME DE PASTA? `ProfilesRepository.activeDirectory()` monta o caminho com
 * `join(userData, 'profiles', id)`, então o id é um pedaço de caminho: um id vazio joga as anotações
 * na pasta `profiles/` inteira, e um com `..` ou barra sai da pasta do app. Não acontece com id
 * gerado aqui; acontece com arquivo editado à mão ou restaurado pela metade.
 */
function idServeComoPasta(id: string): boolean {
  if (!id.trim()) return false
  if (id === '.' || id === '..') return false
  // Separadores dos dois sistemas e os dois-pontos do Windows (`C:`) — qualquer um deles faz o
  // `join` produzir um caminho que não é mais "uma pasta dentro de profiles".
  return !/[\\/:]/.test(id)
}

/**
 * A FOTO só entra se for imagem embutida e de tamanho que o app aceitaria escolher. O seletor recusa
 * acima de 12 MB, mas o canal `profiles:save` e o `profiles.json` não passavam por limite nenhum, e
 * uma foto de 60 MB em base64 seria lida inteira a cada abertura.
 *
 * Só o PREFIXO é conferido: a primeira versão varria o base64 inteiro, e `normalizeProfiles` roda a
 * cada gravação da lista, inclusive a cada tecla no nome — quinze fotos de 10 MB eram 150 MB de
 * string por tecla. O conteúdo, quem julga é o decodificador de imagem do Chromium.
 */
const FOTO_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,/
export const TAMANHO_MAXIMO_DA_FOTO = 17 * 1024 * 1024

/** Nome e sistema são rótulos de tela; 200 caracteres é o mesmo teto da importação de ficha. */
export const TAMANHO_MAXIMO_DO_NOME = 200

/** A foto como o app grava (ver acima), exportada porque o pacote de personagem usa a MESMA régua. */
export function fotoDePerfilValida(foto: unknown): string | null {
  if (typeof foto !== 'string') return null
  if (foto.length > TAMANHO_MAXIMO_DA_FOTO) return null
  return FOTO_EMBUTIDA.test(foto) ? foto : null
}

function rotulo(valor: unknown): string {
  return typeof valor === 'string' ? valor.slice(0, TAMANHO_MAXIMO_DO_NOME) : ''
}

/**
 * Deixa a lista lida do disco no formato atual: ao menos um perfil, campos com os tipos certos, um id
 * único e utilizável como pasta em cada um, e um `activeId` que aponta pra alguém que existe.
 *
 * A distinção entre SEM id e COM id ruim é de propósito: entrada sem `id` nenhum é fragmento
 * (gravação interrompida, objeto de outro formato) e sai; entrada com `id` que não serve (repetido,
 * vazio, com `..` ou barra) FICA, com id novo, porque ali há um personagem de verdade e no pior caso
 * perdem-se as anotações dele, não ele. Repetido é o caso perigoso: dois personagens com o mesmo id
 * escrevem NA MESMA PASTA, e da tela isso lê como "troquei de personagem e as informações sumiram".
 */
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
      photo: fotoDePerfilValida(entrada.photo),
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
