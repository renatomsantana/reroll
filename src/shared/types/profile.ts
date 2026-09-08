/**
 * PERFIL DE PERSONAGEM, pedido dele: "um espaço para poder selecionar o profile do personagem, tipo
 * nome e qual sistema de rpg, e aí precisa colocar uma foto também... os dados são customizados para
 * o de Rodrigo, as cores, e já ficam tudo salvo, as anotações, os presets, tudo dele... mas quando eu
 * voltar pro profile do Rodrigo, volta como era antes".
 *
 * Ou seja, o perfil não é um rótulo, é um COMPARTIMENTO: cada um carrega as próprias anotações,
 * presets e aparência. O que NÃO é por perfil são as preferências de quem usa o programa — idioma,
 * tema, fonte, som, ícone —, porque quem joga de Rodrigo e de Marina não quer o app em inglês quando
 * muda de ficha. A divisão está em `PROFILE_LOOK_KEYS`.
 */
import { PERSONAGENS_LIBERADOS } from '../liberacoes'

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
 * O que o `profiles.json` ACEITA gravar — o teto de segurança do disco (`ProfilesRepository.save`),
 * separado do teto de criação logo abaixo. Quinze é o número do alfa: um arquivo de quem já tinha
 * quinze personagens continua sendo gravado (renomear, trocar de ativo, apagar), e um `profiles.json`
 * absurdo (centenas) continua recusado.
 */
export const TETO_DE_PERSONAGENS_NO_DISCO = 15

/**
 * QUANTOS PERSONAGENS a pessoa pode CRIAR, pela regra do dono: "EU o DONO posso ter quantos
 * personagens quiser, OS OUTROS usuários apenas 3, eles são bloqueados e recebem um aviso: máximo de
 * personagens atingido = 3".
 *
 * Quem escolhe o lado é `PERSONAGENS_LIBERADOS`, a mesma chave de liberação do HUD: ligada na `main`,
 * o teto é o do disco; desligada no branch `lancamento`, o teto é TRÊS, duro.
 *
 * O teto vale na CRIAÇÃO, e não na leitura: `normalizeProfiles` nunca corta a lista, mesmo que ela
 * venha do disco com mais que isto — um arquivo restaurado de backup não pode perder personagem por
 * causa de um número que mudou. Quem cobra o teto é o botão "Novo personagem" e o canal de
 * importação de ficha, que são os dois jeitos de nascer um personagem.
 */
export const MAX_PROFILES = PERSONAGENS_LIBERADOS ? TETO_DE_PERSONAGENS_NO_DISCO : 3

export function createProfile(name = '', system = ''): Profile {
  return { id: crypto.randomUUID(), name, system, photo: null, createdAt: Date.now() }
}

/**
 * Um id serve como NOME DE PASTA? A pergunta importa porque `ProfilesRepository.activeDirectory()`
 * monta o caminho dos dados com `join(userData, 'profiles', id)`: o id não é só uma chave, é um pedaço
 * de caminho de arquivo. Um id vazio faz as anotações caírem na pasta `profiles/` inteira, em cima do
 * que estiver lá; um id com `..` ou com barra sai da pasta do app.
 *
 * Nada disso acontece com id gerado pelo app. Acontece com arquivo editado à mão, restaurado de
 * backup pela metade ou gravado por versão futura — e o estrago é silencioso, que é o que o torna caro.
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
 * tipos certos, um id único e utilizável como pasta em cada um, e um `activeId` que aponta pra um
 * perfil que existe de verdade.
 *
 * A distinção entre SEM id e COM id ruim é de propósito, e não detalhe:
 *
 * - entrada SEM `id` nenhum é descartada. Não é um personagem que perdeu a chave, é um fragmento —
 *   gravação interrompida no meio, ou objeto de outro formato —, e mantê-la encheria a lista de
 *   personagens fantasmas;
 * - entrada COM `id` que não serve (repetido, vazio, com `..` ou barra) é MANTIDA, com id novo. Aqui
 *   há um personagem de verdade, com nome e sistema legíveis: descartar apagaria alguém da lista por
 *   causa de um defeito de arquivo. No pior caso perdem-se as anotações dele, não ele.
 *
 * Repetido é o caso perigoso: dois personagens com o mesmo id leem e escrevem NA MESMA PASTA, um
 * sobrescrevendo as anotações do outro a cada tecla — e da tela isso lê como "troquei de personagem e
 * as informações sumiram".
 */
/**
 * A FOTO só entra se for imagem embutida, e de tamanho que o app aceitaria escolher. O campo é
 * gravado como data URL e vai direto pra um `<img src>`, e a CSP já impede qualquer outro esquema de
 * carregar: isto aqui é o que segura o TAMANHO. O seletor recusa arquivo acima de 12 MB, mas o canal
 * `profiles:save` e o `profiles.json` no disco não passavam por limite nenhum, e uma foto de 60 MB em
 * base64 seria lida inteira em toda abertura do app.
 *
 * Só o PREFIXO é conferido, de propósito: a primeira versão varria o base64 inteiro, e
 * `normalizeProfiles` roda no renderer e no main a cada gravação da lista, inclusive a cada tecla no
 * nome do personagem — quinze fotos de 10 MB eram 150 MB de string varridos por tecla. O que importa
 * pra segurança é o esquema e o tipo; o conteúdo, quem julga é o decodificador de imagem do Chromium.
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
