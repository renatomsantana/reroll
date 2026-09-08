import * as THREE from 'three'

export type DiceMaterialFinish = 'matte' | 'metallic' | 'plastic' | 'glass'

export interface CreateDiceMaterialOptions {
  map: THREE.Texture
  finish?: DiceMaterialFinish
}

/**
 * Ponto único de "como cada acabamento se parece": os três construtores visuais só chamam isto, e nunca
 * criam material na mão. `color` fica sempre neutro, porque a cor de verdade já está desenhada na
 * textura (ver `createNumberTexture.ts`) e `material.color` só multiplicaria por cima.
 *
 * `MeshPhysicalMaterial` (superset do `MeshStandardMaterial`) e não o padrão porque plástico e vidro
 * precisam de propriedades que só existem nela, `clearcoat` e `transmission`.
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
      // `transmission` (refração de verdade) foi tentado primeiro, e depende de uma passada de
      // renderização extra que este `WebGLRenderer` não faz: testado ao vivo, o resultado saía
      // praticamente idêntico ao fosco. Transparência simples funciona em qualquer configuração e já dá
      // a leitura de vidro — menos correta fisicamente, mas visível.
      /**
       * OPACIDADE 0.8 e ambiente 1.0, e não 0.55/1.6, porque o vidro estava apagando os números.
       *
       * Medido na varredura de fechamento do alfa (45 paletas × 4 acabamentos × 7 dados, render de
       * verdade, comparando cada dado com ele mesmo sem número pra isolar a tinta): com 0.55/1.6 a força
       * da tinta no vidro ficava em 0,18 de mediana, contra 0,52 do fosco, e 237 das 315 combinações
       * caíam abaixo de 0,20 — ou seja, o defeito era do MATERIAL, não de uma cor. Com 0.8/1.0 a mediana
       * sobe pra 0,36 e sobram 26.
       *
       * A escolha entre 0.75, 0.80 e 0.85 foi olhando o render lado a lado: 0.85 já lê como plástico
       * fosco, e 0.80 é o ponto em que ainda dá pra ver a translucidez com o número legível.
       */
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map,
        metalness: 0,
        roughness: 0.05,
        transparent: true,
        opacity: 0.8,
        envMapIntensity: 1.0
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
