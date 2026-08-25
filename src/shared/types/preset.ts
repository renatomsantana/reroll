import type { DiceExpression } from './dice'

/**
 * Um preset guarda a rolagem de UM de dois jeitos, nunca dos dois:
 *
 * - `expression`: a forma que a bandeja sempre soube rolar (grupos + modificador + manter +
 *   explosão). É o caso de todo preset antigo e de tudo o que os botões do editor montam.
 * - `formula`: o texto da gramática (`shared/dice/formula.ts`), na forma canônica, pro que a
 *   `DiceExpression` não tem como dizer — reroll, contagem de sucessos, alvo, multiplicação,
 *   manter por grupo. Rola por etapas na cena (ver `rolagemPorEtapas.ts`).
 *
 * Um só dos dois, porque dois retratos da mesma rolagem podem discordar — e aí o preset rolaria
 * diferente do que está escrito, que é exatamente o defeito que este app não aceita.
 */
export interface Preset {
  id: string
  name: string
  icon?: string
  expression?: DiceExpression
  formula?: string
  createdAt: number
  updatedAt: number
  /**
   * FAVORITO (spec §3.9): a POSIÇÃO entre os favoritos do personagem (0 é o primeiro). Ausente =
   * não é favorito. É posição, e não `true`, porque a ordem é escolha da pessoa (▲▼ no cartão) e
   * é a ordem em que os botões aparecem no modo compacto — o golpe principal primeiro.
   *
   * Fora do `PresetInput` de propósito: favoritar é um gesto próprio (a estrela), com canal
   * próprio, e não um campo do editor. Exportar/importar presets não leva a estrela junto — ela é
   * de quem usa, não do preset.
   */
  favorito?: number
}

export type PresetInput = Pick<Preset, 'name' | 'icon' | 'expression' | 'formula'>

/**
 * Quantos favoritos cabem. Seis — o que a spec pede ("max ~6"), e o que cabe na faixa de presets
 * do modo compacto sem rolagem: três colunas por duas fileiras.
 */
export const MAXIMO_DE_FAVORITOS = 6

/** `favorito` como vem do disco: inteiro não negativo, ou nada. Texto, fração e negativo somem. */
export function favoritoSaneado(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 ? valor : undefined
}

/** Só os favoritos, na ordem deles. */
export function favoritosOrdenados<T extends Pick<Preset, 'favorito'>>(presets: T[]): T[] {
  return presets.filter((p) => p.favorito !== undefined).sort((a, b) => a.favorito! - b.favorito!)
}

/** Os favoritos no topo (na ordem deles), e o resto como estava — a lista da tela cheia. */
export function comFavoritosNoTopo<T extends Pick<Preset, 'favorito'>>(presets: T[]): T[] {
  return [...favoritosOrdenados(presets), ...presets.filter((p) => p.favorito === undefined)]
}

/**
 * Os favoritos REINDEXADOS 0..n−1, na ordem atual — o que o repositório grava depois de qualquer
 * mudança, pra apagar ou desmarcar um não deixar buraco (0, 2, 3) que a próxima marcação teria
 * que adivinhar.
 */
export function reindexarFavoritos<T extends Pick<Preset, 'favorito'>>(presets: T[]): T[] {
  const ordem = new Map(favoritosOrdenados(presets).map((p, i) => [p, i]))
  return presets.map((p) => {
    const posicao = ordem.get(p)
    if (posicao === undefined) {
      if (p.favorito === undefined) return p
      const { favorito: _fora, ...semFavorito } = p
      return semFavorito as T
    }
    return { ...p, favorito: posicao }
  })
}
