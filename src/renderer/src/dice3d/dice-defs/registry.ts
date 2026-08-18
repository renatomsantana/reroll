import type * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DiceDefinition, PhysicalDiceSides } from '@shared/types/dice3d'
import { D4_DEFINITION, D4_VERTICES } from './d4'
import { buildD4Visual } from './buildD4Visual'
import { D6_DEFINITION } from './d6'
import { createD6Body } from './buildD6Body'
import { buildD6Visual } from './buildD6Visual'
import { D8_DEFINITION, D8_FACE_INPUTS, D8_VERTICES } from './d8'
import { D10_DEFINITION, D10_FACE_INPUTS, D10_VERTICES } from './d10'
import { D12_DEFINITION, D12_FACE_INPUTS, D12_VERTICES } from './d12'
import { D20_DEFINITION, D20_FACE_INPUTS, D20_VERTICES } from './d20'
import { D100_DEFINITION, D100_FACE_INPUTS, D100_VERTICES } from './d100Sphere'
import { buildPolyhedronVisual } from '../geometry/buildPolyhedronVisual'
import { createPolyhedronBody } from '../physics/createPolyhedronBody'
import type { DiceMaterialFinish } from '../materials/createDiceMaterial'
import type { DiceTextureCache } from '../materials/textureCache'

/** Formato comum aceito por `buildD4Visual`/`buildD6Visual`/`buildPolyhedronVisual` — cor do corpo (hex numérico) e cor do número (string CSS). */
export interface DiceVisualOptions {
  bodyColor?: number
  numberColor?: string
  /** Acabamento (Preferências ⚙️: fosco/metálico/plástico/vidro) — ver `createDiceMaterial.ts`. */
  material?: DiceMaterialFinish
  /** Ver `textureCache.ts` — opcional, reduz regeração de textura entre dados idênticos da mesma leva de construção (ex.: vários dados do mesmo tipo numa rolagem). */
  textureCache?: DiceTextureCache
}

export interface DiceTypeEntry {
  definition: DiceDefinition
  buildVisual: (options?: DiceVisualOptions) => THREE.Mesh
  createBody: (world: RAPIER.World) => RAPIER.RigidBody
}

/**
 * Ponto único de acesso a "tudo que existe sobre um tipo de dado": a
 * definição física/de resultado, como desenhar e como criar o corpo rígido.
 * Preparado pra crescer (Fase 17 do plano menciona dados customizados no
 * futuro) sem precisar mexer em quem já consome o registro.
 */
export const DICE_REGISTRY: Record<PhysicalDiceSides, DiceTypeEntry> = {
  4: {
    definition: D4_DEFINITION,
    buildVisual: (options) => buildD4Visual(options),
    createBody: (world) => createPolyhedronBody(world, D4_VERTICES, D4_DEFINITION)
  },
  6: {
    definition: D6_DEFINITION,
    buildVisual: (options) => buildD6Visual(options),
    createBody: (world) => createD6Body(world)
  },
  8: {
    definition: D8_DEFINITION,
    buildVisual: (options) =>
      buildPolyhedronVisual(D8_VERTICES, D8_FACE_INPUTS, { ...options, scale: D8_DEFINITION.scale }),
    createBody: (world) => createPolyhedronBody(world, D8_VERTICES, D8_DEFINITION)
  },
  10: {
    definition: D10_DEFINITION,
    buildVisual: (options) =>
      buildPolyhedronVisual(D10_VERTICES, D10_FACE_INPUTS, { ...options, scale: D10_DEFINITION.scale }),
    createBody: (world) => createPolyhedronBody(world, D10_VERTICES, D10_DEFINITION)
  },
  12: {
    definition: D12_DEFINITION,
    buildVisual: (options) =>
      buildPolyhedronVisual(D12_VERTICES, D12_FACE_INPUTS, { ...options, scale: D12_DEFINITION.scale }),
    createBody: (world) => createPolyhedronBody(world, D12_VERTICES, D12_DEFINITION)
  },
  20: {
    definition: D20_DEFINITION,
    buildVisual: (options) =>
      buildPolyhedronVisual(D20_VERTICES, D20_FACE_INPUTS, { ...options, scale: D20_DEFINITION.scale }),
    createBody: (world) => createPolyhedronBody(world, D20_VERTICES, D20_DEFINITION)
  },
  100: {
    definition: D100_DEFINITION,
    buildVisual: (options) =>
      buildPolyhedronVisual(D100_VERTICES, D100_FACE_INPUTS, {
        ...options,
        scale: D100_DEFINITION.scale
      }),
    createBody: (world) => createPolyhedronBody(world, D100_VERTICES, D100_DEFINITION)
  }
}

export const AVAILABLE_DICE_TYPES: PhysicalDiceSides[] = [4, 6, 8, 10, 12, 20, 100]
