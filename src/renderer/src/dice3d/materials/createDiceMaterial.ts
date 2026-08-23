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
      /**
       * OPACIDADE 0.8 e ambiente 1.0, e não 0.55/1.6 — o vidro estava apagando os números.
       *
       * Medido na varredura de fechamento do Alfa (45 paletas × 4 acabamentos × 7 dados, render de
       * verdade, comparando cada dado com ele mesmo pintado sem número pra isolar a tinta): com
       * 0.55/1.6 o vidro deixava a força da tinta em 0,18 de mediana, contra 0,52 do fosco e 0,50 do
       * plástico — e 237 das 315 combinações caíam abaixo de 0,20, ou seja, o defeito era do
       * MATERIAL, não de nenhuma cor em particular. Com 0.8/1.0 a mediana sobe pra 0,36 e sobram 26.
       *
       * A escolha entre 0.75, 0.80 e 0.85 foi olhando o render lado a lado: 0.85 já lê como plástico
       * fosco, e 0.80 é o ponto em que ainda dá pra ver a translucidez e o número volta a ser preto
       * no branco. Quem quiser vidro de verdade (refração) precisa da passada extra de
       * `transmission`, que este renderer não faz — ver o parágrafo abaixo.
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
