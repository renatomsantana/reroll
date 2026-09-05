/**
 * CORES do personagem: a de cada barra e a de cada condição.
 *
 * Pedido dele (02/09/2026): "para cada atributo atribuir cor também; a pessoa decide a cor
 * também". Antes a barra tinha UMA cor de estado (verde, oliva, bordô) e a condição ligada era
 * sempre bordô. Agora cada uma tem a sua, com um padrão que sai do NOME (PV é vermelho escuro em
 * toda mesa, PE azul, Sanidade roxo) e que a pessoa troca quando quiser.
 *
 * A paleta é a de 16 cores do Windows: são as que o tema clássico já tinha, e por isso não destoam
 * do cinza em volta (ver `global.css`). Nada de degradê, nada de pastel.
 */
export const PALETA_DO_98 = [
  '#800000', // bordô
  '#000080', // marinho
  '#008000', // verde
  '#800080', // roxo
  '#808000', // oliva
  '#008080', // petróleo
  '#ff0000', // vermelho
  '#0000ff', // azul
  '#ff00ff', // magenta
  '#808080' // cinza
] as const

/** O formato exato que o `<input type="color">` produz: só assim uma cor entra gravada. */
const COR_HEX = /^#[0-9a-f]{6}$/i

export function ehCorHex(valor: unknown): valor is string {
  return typeof valor === 'string' && COR_HEX.test(valor)
}

/**
 * Uma cor da paleta ESTÁVEL pra um nome: o mesmo nome dá sempre a mesma cor, em qualquer
 * personagem e em qualquer ordem da lista. Por índice na lista seria mais simples, mas remover a
 * segunda barra mudaria a cor da terceira, e a pessoa acharia que o app trocou a cor sozinho.
 */
export function corPelaSoma(nome: string): string {
  let soma = 0
  for (const letra of nome.trim().toLowerCase()) soma = (soma + letra.codePointAt(0)!) % 65_536
  return PALETA_DO_98[soma % PALETA_DO_98.length]
}

/**
 * A cor PADRÃO de uma barra pelo que ela mede — a convenção que toda mesa já usa: vida vermelha,
 * energia/mana azul, sanidade roxa, fôlego verde, sorte dourada. O que não tem convenção sai da
 * paleta pelo nome, sempre a mesma.
 */
export function corPadraoDoRecurso(nome: string): string {
  const limpo = nome.trim().toLowerCase()
  if (/^(pv|hp|vida|sa[úu]de|health|hit points?|pontos de vida)$/.test(limpo)) return '#800000'
  if (/^(pe|pm|mp|mana|magia|esfor[çc]o|magic points?|pontos de (esfor[çc]o|magia))$/.test(limpo)) return '#000080'
  if (/^(san|sanidade|sanity|pontos de sanidade)$/.test(limpo)) return '#800080'
  if (/^(stamina|f[ôo]lego|vigor|energia)$/.test(limpo)) return '#008000'
  if (/^(sorte|luck)$/.test(limpo)) return '#808000'
  if (/^(determina[çc][ãa]o|assimila[çc][ãa]o)$/.test(limpo)) return '#008080'
  return corPelaSoma(limpo)
}

/** A cor padrão de uma condição: pelo nome, sempre a mesma. "Machucado" é bordô em toda ficha. */
export function corPadraoDaCondicao(nome: string): string {
  const limpo = nome.trim().toLowerCase()
  if (/machucad|ferid|wounded|injured|sangrand|bleeding/.test(limpo)) return '#800000'
  if (/enlouquec|insan|louc|mad/.test(limpo)) return '#800080'
  if (/ca[íi]d|prone|derrubad/.test(limpo)) return '#808000'
  if (/envenenad|poison|doente|sick/.test(limpo)) return '#008000'
  if (/inconscient|unconscious|desmaiad|morrend|dying/.test(limpo)) return '#808080'
  return corPelaSoma(limpo)
}

/**
 * A ESCALA DO ESTRESSE: a cor de uma barra que SOBE, pelo quanto já subiu. Pedido dele
 * (02/09/2026), sobre o dano por região de Oblívio ("Torso 0/5"): "1 amarelo, 2 alaranjando, 3
 * alaranjado, 4 laranja avermelhado, 5 vermelhasso, com vários níveis de cor". O grau vai de 0
 * (o primeiro ponto, amarelo puro) a 1 (o último, vermelho puro), e o que muda é só o VERDE do
 * `#ff____00`: é o caminho mais curto entre os dois na roda de cores, e dá quantos degraus a barra
 * tiver. Uma cor CHAPADA por nível, e não um degradê dentro da barra: continua Windows 98.
 */
export function corDaEscalaDeEstresse(grau: number): string {
  const preso = Number.isFinite(grau) ? Math.min(1, Math.max(0, grau)) : 0
  const verde = Math.round(255 * (1 - preso))
  return `#ff${verde.toString(16).padStart(2, '0')}00`
}

/**
 * Preto ou branco por cima desta cor, pelo brilho percebido (a fórmula da WCAG, sem a
 * linearização: pra escolher entre dois extremos a aproximação basta). É o que deixa o nome da
 * condição legível tanto em oliva quanto em marinho.
 */
export function textoSobre(cor: string): '#000000' | '#ffffff' {
  if (!ehCorHex(cor)) return '#000000'
  const r = parseInt(cor.slice(1, 3), 16)
  const g = parseInt(cor.slice(3, 5), 16)
  const b = parseInt(cor.slice(5, 7), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000000' : '#ffffff'
}
