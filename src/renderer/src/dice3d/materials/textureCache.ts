import * as THREE from 'three'

/**
 * Cache de texturas de número — chave = valor+cor+fonte, então duas instâncias de dado com o
 * mesmo tipo/cor (ex.: 15d6, ou a prateleira decorativa mostrando o mesmo tipo/cor de um dado
 * que também está rolando) reaproveitam a MESMA `CanvasTexture` em vez de desenhar tudo de novo
 * num canvas (até 100 faces só pro d100).
 *
 * PERSISTENTE no módulo (`globalCache` abaixo, não recriado por chamador) — de propósito, não só
 * "válido durante uma leva": `DiceCanvasMulti.tsx` REMONTA a cena inteira (física + renderer +
 * todos os meshes, incluindo a prateleira com 1 dado de cada tipo = até 160 faces) toda vez que
 * `groups` muda, ou seja, a cada dado adicionado/removido — medido como a maior fonte de trava
 * visível nesse fluxo ("dados adicionados muito lagados"), bem mais frequente que trocar de cor.
 * Persistir entre remontagens faz a montagem seguinte reaproveitar texturas já desenhadas em vez
 * de desenhar as mesmas ~160 faces de novo só porque a cena inteira nasceu de novo.
 *
 * Só fica desatualizado quando cor/acabamento/material realmente mudam — `clearDiceTextureCache`
 * é chamado nesse momento (ver o efeito de troca de cor em `DiceCanvasMulti.tsx`), então o cache
 * nunca cresce sem limite com cores antigas abandonadas.
 *
 * Compartilhar a MESMA `CanvasTexture` entre vários materiais é seguro pro descarte:
 * `texture.dispose()` não apaga `texture.image` (o canvas já desenhado) — só libera o recurso do
 * lado da GPU, forçando um re-upload automático na próxima vez que a textura for usada (custo
 * pequeno, nunca uma textura quebrada/preta). Por isso é seguro deixar o código de descarte já
 * existente (`disposeMesh`/`disposeScene`) chamar dispose numa textura cacheada sem nenhuma
 * lógica extra de contagem de referências aqui.
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
