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
 * VIDA CHEIA é VERDE, e daí a barra cai pro amarelo e pro vermelho (pedido dele, 08/09/2026: "full
 * life fique VERDE aí cai pra AMARELO aí VERMELHO"). É a escala que todo jogo usa, e é a que se lê
 * de relance no meio de um combate.
 *
 * Isto é o PADRÃO, e não uma imposição: a cor que a pessoa escolher no editor continua sendo a de
 * vida cheia daquela barra (ver `corDoRecurso`). O que saiu foi o padrão POR NOME — PV bordô, PE
 * marinho, Sanidade roxo —, que era invenção nossa e deixava toda barra cheia com cara de perigo.
 */
export const VERDE_DE_VIDA_CHEIA = '#008000'

/**
 * MANA CHEIA é AZUL — o marinho da paleta de 16 (pedido dele, 08/09/2026: "PM é azul e vai ficando
 * mais clarinho quando diminui"). Vale pro que se gasta pra conjurar em qualquer sistema: PM de
 * Tormenta, PE de Ordem, MP, e os espaços de magia por círculo de D&D (ver `recursoDeMana`).
 *
 * Mana não avermelha: ficar sem PM não é ficar perto da morte, e pintar de vermelho uma barra de
 * magia daria o mesmo susto que a de vida. O que ela faz é DESBOTAR — ver `clarearPeloGasto`.
 */
export const AZUL_DE_MANA_CHEIA = '#000080'

/**
 * O quanto uma barra de mana chega a clarear: a luminosidade do último ponto. 0,75 sobre o marinho
 * dá `#8080ff`, que ainda se lê como azul e ainda aparece por cima do trilho branco — com 0,9 o
 * último ponto sumia no fundo (medido com `olharHud.mjs`).
 */
const LUZ_DO_ULTIMO_PONTO = 0.75

function paraHsl(cor: string): { h: number; s: number; l: number } {
  const r = parseInt(cor.slice(1, 3), 16) / 255
  const g = parseInt(cor.slice(3, 5), 16) / 255
  const b = parseInt(cor.slice(5, 7), 16) / 255
  const maior = Math.max(r, g, b)
  const menor = Math.min(r, g, b)
  const l = (maior + menor) / 2
  const distancia = maior - menor
  if (distancia === 0) return { h: 0, s: 0, l }
  const s = distancia / (1 - Math.abs(2 * l - 1))
  const h =
    maior === r ? ((g - b) / distancia + (g < b ? 6 : 0)) : maior === g ? (b - r) / distancia + 2 : (r - g) / distancia + 4
  return { h: h * 60, s, l }
}

function deHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const faixa = Math.floor(((h % 360) + 360) % 360 / 60)
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ][faixa]
  const byte = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

/**
 * A ESCALA DA MANA: a MESMA cor, só mais clara quanto mais gasta. O grau vai de 0 (cheia, a cor de
 * repouso) a 1 (o último ponto, `LUZ_DO_ULTIMO_PONTO`).
 *
 * Clareia pelo HSL — sobe a LUMINOSIDADE e guarda o matiz e a saturação —, e não misturando com
 * branco: misturar tira a saturação junto e o marinho vira um cinza-azulado que não parece mais
 * mana. Assim funciona pra qualquer cor que a pessoa escolha no editor, não só pro azul.
 *
 * Uma cor CHAPADA por nível, como a escala do estresse: continua Windows 98.
 */
export function clarearPeloGasto(cor: string, grau: number): string {
  const base = ehCorHex(cor) ? cor : AZUL_DE_MANA_CHEIA
  const preso = Number.isFinite(grau) ? Math.min(1, Math.max(0, grau)) : 0
  const { h, s, l } = paraHsl(base)
  // Cor já clara (a pessoa escolheu um pastel) não escurece pra "clarear": fica onde está.
  const alvo = Math.max(l, LUZ_DO_ULTIMO_PONTO)
  return deHsl(h, s, l + (alvo - l) * preso)
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
