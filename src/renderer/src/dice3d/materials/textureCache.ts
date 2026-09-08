import * as THREE from 'three'

/**
 * Cache de texturas de número, com chave = valor + cor + fonte: duas instâncias do mesmo tipo e cor
 * (15d6, ou a prateleira mostrando um tipo que também está rolando) reaproveitam a MESMA
 * `CanvasTexture` em vez de desenhar tudo de novo — até 100 faces só pro d100.
 *
 * PERSISTENTE no módulo, e de propósito: `DiceCanvasMulti` remonta a cena inteira quando `groups` muda,
 * ou seja a cada dado adicionado, e isso foi medido como a maior fonte de trava visível nesse fluxo
 * ("dados adicionados muito lagados"). Persistir entre remontagens faz a montagem seguinte reaproveitar
 * as ~160 faces já desenhadas. Só fica desatualizado quando cor ou acabamento mudam, e aí
 * `clearDiceTextureCache` é chamado, então ele nunca cresce com cores abandonadas.
 *
 * Compartilhar a mesma textura entre vários materiais é seguro pro descarte: `texture.dispose()` não
 * apaga o canvas já desenhado, só libera o recurso da GPU, forçando um re-upload automático no próximo
 * uso — custo pequeno, nunca uma textura preta. Por isso `disposeMesh`/`disposeScene` podem chamar
 * dispose numa textura cacheada sem contagem de referências aqui.
 */
export type DiceTextureCache = Map<string, THREE.CanvasTexture>

const globalCache: DiceTextureCache = new Map()

/** O cache compartilhado por todo o app — ver comentário grande acima sobre por que é persistente entre remontagens da cena. */
export function getGlobalDiceTextureCache(): DiceTextureCache {
  return globalCache
}

/** Descarta e esvazia o cache global — chamar quando cor/acabamento/parede/fundo/chão realmente mudam (ver `DiceCanvasMulti.tsx`), pra não acumular texturas de cores abandonadas pra sempre. */
export function clearDiceTextureCache(): void {
  for (const texture of globalCache.values()) texture.dispose()
  globalCache.clear()
}

/** Busca `key` no cache (se houver um); cria via `factory` e guarda só se ainda não existir. Sem cache (`undefined`), sempre cria novo. */
export function getCachedTexture(
  cache: DiceTextureCache | undefined,
  key: string,
  factory: () => THREE.CanvasTexture
): THREE.CanvasTexture {
  if (!cache) return factory()
  const existing = cache.get(key)
  if (existing) return existing
  const created = factory()
  cache.set(key, created)
  return created
}
