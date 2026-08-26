import { TAMANHO_MAXIMO_DA_FOTO } from './profile'

/**
 * A APARÊNCIA DO PERSONAGEM — as preferências que são dele, e não de quem usa o app (ver o
 * cabeçalho de `profile.ts`): cores e acabamento dos dados, cores da bandeja e da torre, imagem de
 * fundo, modo de lançamento e forma da bandeja.
 *
 * A lista mora AQUI, em `shared`, e não só no `SettingsContext` do renderer, porque ela passou a
 * atravessar processos: o pacote de personagem (`pacoteDePersonagem.ts`) leva a aparência junto da
 * ficha e dos presets, e é o processo principal que grava e lê o arquivo. Uma cópia da lista em
 * cada lado é o que faz uma chave nova entrar num e não no outro.
 */
export const CHAVES_DA_APARENCIA = [
  'diceBodyColor',
  'diceNumberColor',
  'diceMaterial',
  'diceColorOverrides',
  'wallColor',
  'backgroundColor',
  'floorColor',
  'towerStoneColor',
  'towerRoofColor',
  'towerFlagColor',
  'towerDoorColor',
  'backgroundImage',
  'launchMode',
  'trayShape'
] as const

export type ChaveDaAparencia = (typeof CHAVES_DA_APARENCIA)[number]

/**
 * O que atravessa o arquivo. Os valores ficam `unknown` de propósito: quem conhece a lista de
 * acabamentos e formas válidos é o renderer (`sanearPreferencias`), e é ele quem grava isto no
 * `localStorage` do personagem novo. Aqui a régua é de FORMA e de TAMANHO — o suficiente pra um
 * arquivo de fora não trazer um objeto de 100 MB nem um script no lugar de uma cor.
 */
export type AparenciaDoPersonagem = Partial<Record<ChaveDaAparencia, unknown>>

/** Uma cor CSS ou um id de acabamento — nada disso passa de umas dezenas de caracteres. */
const TAMANHO_MAXIMO_DE_VALOR_CURTO = 64
const IMAGEM_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,/

function textoCurto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length <= TAMANHO_MAXIMO_DE_VALOR_CURTO ? valor : undefined
}

/**
 * Deixa só o que é aparência, com cada valor na forma que o app grava. O que não passa é
 * DESCARTADO campo a campo — a cor do dado torta não derruba a imagem de fundo —, e um objeto
 * sem nada aproveitável vira `null` (o personagem nasce com a aparência que o app estava usando,
 * que é o que acontece com qualquer personagem novo).
 */
export function sanearAparencia(bruto: unknown): AparenciaDoPersonagem | null {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null
  const entrada = bruto as Record<string, unknown>
  const limpa: AparenciaDoPersonagem = {}

  for (const chave of CHAVES_DA_APARENCIA) {
    if (!(chave in entrada)) continue
    const valor = entrada[chave]
    if (chave === 'backgroundImage') {
      if (valor === null) limpa.backgroundImage = null
      else if (typeof valor === 'string' && valor.length <= TAMANHO_MAXIMO_DA_FOTO && IMAGEM_EMBUTIDA.test(valor)) {
        limpa.backgroundImage = valor
      }
      continue
    }
    if (chave === 'diceColorOverrides') {
      const overrides = sanearOverrides(valor)
      if (overrides) limpa.diceColorOverrides = overrides
      continue
    }
    const texto = textoCurto(valor)
    if (texto !== undefined) limpa[chave] = texto
  }

  return Object.keys(limpa).length > 0 ? limpa : null
}

/** `{ 20: { bodyColor, numberColor } }` — chave numérica, duas cores curtas; o resto cai fora. */
function sanearOverrides(valor: unknown): Record<number, { bodyColor: string; numberColor: string }> | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return null
  const limpo: Record<number, { bodyColor: string; numberColor: string }> = {}
  for (const [lados, cores] of Object.entries(valor as Record<string, unknown>)) {
    const n = Number(lados)
    if (!Number.isInteger(n) || n <= 0 || typeof cores !== 'object' || cores === null) continue
    const bodyColor = textoCurto((cores as Record<string, unknown>).bodyColor)
    const numberColor = textoCurto((cores as Record<string, unknown>).numberColor)
    if (bodyColor === undefined || numberColor === undefined) continue
    limpo[n] = { bodyColor, numberColor }
  }
  return limpo
}
