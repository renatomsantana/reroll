import * as THREE from 'three'

export type DiceMaterialFinish = 'matte' | 'metallic' | 'plastic' | 'glass'

export interface CreateDiceMaterialOptions {
  map: THREE.Texture
  finish?: DiceMaterialFinish
}

/**
 * Ponto único de "como cada acabamento se parece" — os 3 construtores visuais
 * (`buildD6Visual`/`buildD4Visual`/`buildPolyhedronVisual`) só chamam isto, nunca criam
 * `MeshStandardMaterial`/`MeshPhysicalMaterial` na mão. `color` fica sempre neutro
 * (`0xffffff`) — a cor de verdade já está desenhada na textura `map` (ver comentário grande
 * em `createNumberTexture.ts`), `material.color` aqui só multiplicaria por cima.
 *
 * `MeshPhysicalMaterial` (superset de `MeshStandardMaterial`, aceita os mesmos
 * `color`/`map`/`roughness`/`metalness` de sempre) em vez de `MeshStandardMaterial` porque
 * plástico/vidro precisam de propriedades que só existem nela (`clearcoat`, `transmission`).
 */
export function createDiceMaterial({ map, finish = 'matte' }: CreateDiceMaterialOptions): THREE.MeshPhysicalMaterial {
  switch (finish) {
    case 'metallic':
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        metalness: 0.9,
        roughness: 0.28
      })
    case 'plastic':
      // Acrílico/plástico polido: nada de metalness, mas uma camada de verniz (clearcoat) por
      // cima é o que dá aquele brilho "plástico injetado" — sem isso fica idêntico ao fosco.
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        metalness: 0,
        roughness: 0.3,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15
      })
    case 'glass':
      // `transmission` (refração "de verdade") foi tentado primeiro, mas depende de uma
      // passada de renderização extra que este `WebGLRenderer` simples não faz — testado ao
      // vivo (captura de tela real do canvas) e o resultado saía praticamente idêntico ao
      // fosco, sem nenhuma transparência visível. Transparência simples (`opacity` +
      // `transparent: true`) é suportada por qualquer configuração de renderer, sem
      // depender de nenhuma passada extra, e já dá a leitura de "vidro" que se espera —
      // menos fisicamente correto, mas realmente visível. `envMapIntensity` mais alto
      // compensa o brilho perdido por não ter mais o clearcoat do plástico.
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 1.6
      })
    case 'matte':
    default:
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        metalness: 0,
        roughness: 0.4
      })
  }
}
