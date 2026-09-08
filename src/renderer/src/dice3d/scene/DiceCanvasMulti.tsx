import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DiceDefinition, PhysicalDiceSides } from '@shared/types/dice3d'
import { createCamera } from './createCamera'
import { CAMERA_CONFIG, TOWER_BESIDE_CAMERA_CONFIG } from '../config/sceneConfig'
import {
  createTrayScene,
  type TraySceneHandle,
  DEFAULT_WALL_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_FLOOR_COLOR,
  woodTint,
  TABLE_SURFACE_Y,
  GROUND_RADIUS
} from './createScene'
import { createWoodTextures } from './createWoodTexture'
import {
  createTowerBesideTray,
  DEFAULT_TOWER_COLORS,
  type TowerBesideTrayHandle,
  type TowerColors
} from './createTowerBesideTray'
import { traySafeHalfExtent } from '../geometry/trayShape'
import { createRiebeckPlush } from './createRiebeckPlush'
import { createTrojanHorse, TROJAN_HORSE_SIZE } from './createTrojanHorse'
import type { DiceMaterialFinish } from '../materials/createDiceMaterial'
import type { CameraMode } from '@renderer/settings/SettingsContext'
import {
  applyCameraKeys,
  type CameraFrame,
  type CameraLimits
} from './applyCameraKeys'
import { setupDiceEnvironment } from './createDiceEnvironment'
import { disposeScene, disposeMesh } from './disposeScene'
import { ensureRapierReady } from '../physics/rapierContext'
import { createPhysicsWorld } from '../physics/createPhysicsWorld'
import { createBoundaryColliders } from '../physics/createBoundaryColliders'
import { createPhysicsStepper } from '../physics/createPhysicsStepper'
import { syncMeshToBody } from '../physics/syncMeshToBody'
import { createSettleTracker, type SettleTracker } from '../physics/createSettleTracker'
import { applyNudge } from '../physics/applyNudge'
import { tossDie } from '../physics/tossDie'
import { tossDieFromMouth, MOUTH_RELEASE_INTERVAL_MS } from '../physics/tossDieFromMouth'
import { randomQuaternion } from '../utils/random'
import { regularPolygonCircumradius } from '../physics/regularPolygon'
import {
  restoreWallCollisionIfInside,
  parkedCollisionGroups,
  diceEnteringCollisionGroups
} from '../physics/collisionGroups'
import { clampLinearVelocity } from '../physics/clampVelocity'
import { computeSpawnSlots } from '../physics/computeSpawnSlots'
import { readTopFace } from '../faceReading/readTopFace'
import { orientacaoDeVitrine } from '../geometry/orientacaoDeVitrine'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  TRAY_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import { getGlobalDiceTextureCache, clearDiceTextureCache } from '../materials/textureCache'
import { createDiceDebugVisuals, type DiceDebugVisuals } from '../debug/createDiceDebugVisuals'
import { createDiceDebugHud, type DiceDebugHud, type DieDebugSnapshot } from '../debug/DiceDebugHud'
import { ponteAbertaNoModo } from './ponteAbertaNoModo'
import './DiceCanvas.css'

/** Ver comentário grande no efeito de troca de cor mais abaixo. */
const COLOR_UPDATE_DEBOUNCE_MS = 120

/**
 * Não existe recentralização automática da câmera aqui. Medido com capturas da mesma rolagem:
 * mover `controls.target` pra cima de onde os dados assentam desabava o enquadramento da cena
 * inteira, e o desvio se mantinha nas rolagens seguintes; só com deslocamento zero o quadro fica
 * idêntico antes e depois. A órbita manual atende o mesmo propósito, sem mexer na câmera pelas
 * costas de quem joga.
 */

/**
 * Escala da pelúcia do Riebeck (modelada com ~1.5 de altura): do tamanho de um dado, não de um
 * móvel. O tamanho também entra na conta de ela ficar escondida atrás da tampa do estojo — em 0.30
 * a pontinha do capacete ainda passava por cima.
 */
const PLUSH_SCALE = 0.27

/**
 * Quanto a pelúcia desce abaixo da mesa, além do assentamento que o próprio modelo faz
 * (`SIT_DEPTH`). Zero, porque o do modelo basta: chegou a 0.5 enquanto "desce mais" não fazia
 * efeito, mas a causa era a respiração sobrescrevendo `position.y` (ver o laço de animação), e
 * corrigido aquilo qualquer valor aqui enterraria o boneco. Fica como constante por ser o lugar
 * certo desse ajuste.
 */
const PLUSH_SINK = 0

/**
 * A cena não tem unidade declarada, então "2cm" precisa de âncora, e a melhor é o próprio dado: o
 * d20 daqui tem 0.56 de lado e um de verdade tem uns 2cm de face a face. Logo 1 unidade ≈ 3.6cm.
 */
const CENTIMETER = 0.56 / 2

/** Alinhada com o CENTRO do estojo, que é simétrico em x (medido: de -4.86 a 4.86). */
const PLUSH_X = 0

/**
 * Z da pelúcia pra ela ficar atrás do estojo com 1cm de folga. Medido nos dois objetos montados: o
 * estojo vai de z = -10.69 a -9.33 (fundo dele em `zEstojo - 0.685`) e a pelúcia tem 0.48 de
 * profundidade na escala da cena. Então: fundo do estojo − 1cm − meia pelúcia. Fica escondida da
 * câmera padrão (0.53 de altura contra 1.22 do estojo), que é a intenção desde que ela virou
 * easter egg.
 */
const PLUSH_GAP_CM = 1
const CASE_HALF_DEPTH = 0.685
const PLUSH_HALF_DEPTH = 0.892 * PLUSH_SCALE

function plushZBehindCase(caseZ: number): number {
  return caseZ - CASE_HALF_DEPTH - PLUSH_GAP_CM * CENTIMETER - PLUSH_HALF_DEPTH
}

/** Virar pra `false` tira a pelúcia da mesa sem mexer em mais nada. */
const SHOW_PLUSH = true

/** Virar pra `false` tira o cavalo de troia da mesa sem mexer em mais nada. */
const MOSTRA_CAVALO = true

/**
 * Escala do cavalo: não é escolhida, é o que faz ele caber escondido atrás do estojo, que tem 1.22
 * de altura. O desconto é folga — com 0.08 a orelha ainda aparecia por cima da tampa. Amarrar na
 * altura da caixa, em vez de um decimal solto, é o que impede isto de quebrar calado no dia em que
 * o estojo mudar de tamanho.
 */
const CAIXA_ALTURA = 1.22
const CAVALO_ESCALA = (CAIXA_ALTURA - 0.8) / TROJAN_HORSE_SIZE.altura

/**
 * Folga entre a pelúcia e o cavalo. 1cm é a mesma folga que ela usa com o estojo: é a distância de
 * "encostado" desta cena. Os dois moram atrás do estojo, que vai de -4.86 a 4.86 e tapa os dois de
 * frente.
 */
const CAVALO_FOLGA_PELUCIA_CM = 1

/**
 * Onde o cavalo assenta, medido da CAIXA REAL dele e não das constantes do modelo:
 * `TROJAN_HORSE_SIZE.largura` mede só a plataforma (1.76) e os cubos das rodas passam dela (2.18 de
 * verdade). Foi essa diferença que fez o bicho encostar no estojo mesmo com a conta "certa".
 */
function assentarCavaloAtrasDoEstojo(cavalo: THREE.Group, caseZ: number): void {
  cavalo.updateMatrixWorld(true)
  const caixa = new THREE.Box3().setFromObject(cavalo)
  // Medido ANTES de girar: o bicho é modelado com o comprimento em Z, e o giro de 90° troca os dois.
  const meioComprimento = (caixa.max.z - caixa.min.z) / 2

  cavalo.rotation.y = Math.PI / 2
  cavalo.position.set(
    // Ao lado da pelúcia, que fica no centro do estojo: meia pelúcia + meio cavalo + folga.
    0.3 + meioComprimento + CAVALO_FOLGA_PELUCIA_CM * CENTIMETER,
    TABLE_SURFACE_Y,
    // O mesmo Z da pelúcia. Assentar cada um pela própria profundidade alinhava a FRENTE dos dois e
    // deixava os centros desencontrados; a folga com o estojo continua garantida porque o cavalo é
    // o mais raso dos dois.
    plushZBehindCase(caseZ)
  )
}

// Reexportado (e importado) daqui porque metade do app pede o tipo a este módulo e a outra metade
// às Preferências. A definição, com a explicação dos três modos, mora em `SettingsContext.tsx`.
import type { LaunchMode } from '@renderer/settings/SettingsContext'
export type { LaunchMode }

export interface DiceGroupSpec {
  sides: PhysicalDiceSides
  count: number
}

export interface DiceCanvasMultiHandle {
  /** Relança todos os dados — cada um no seu "slot" na bandeja (modo bandeja) ou de volta pro topo da torre, em fila (modo torre). */
  roll: () => void
}

export interface DieResult {
  sides: PhysicalDiceSides
  value: number
}

export interface MultiRollResult {
  rolls: DieResult[]
  total: number
}

export interface DiceCanvasMultiProps {
  groups: DiceGroupSpec[]
  /** Chamado quando TODOS os dados já assentaram com face dominante. `null` = "rolando, sem resultado ainda". */
  onResult?: (result: MultiRollResult | null) => void
  /**
   * Chamado se a cena falhar ao inicializar (Rapier ou criação de algum dado). Sem isso o app
   * ficava travado em "Rolando..." pra sempre, com um `console.error` que ninguém vê.
   */
  onError?: (error: unknown) => void
  /**
   * O arremesso automático do mount conta como rolagem de verdade (relata resultado ao assentar):
   * é o clique num preset, que já É a ação de rolar. Sem isto (troca de tipo, quantidade, modo, cor
   * ou debug) o arremesso do mount é só visual, ver `armedRef`. Lido uma vez só, no mount.
   */
  autoRoll?: boolean
  /**
   * Cor do corpo e do número por TIPO de dado (chave = lados), já com os overrides individuais
   * mesclados; quem monta é `DiceRoller3D.tsx`. Vale pros dados de verdade e pra prateleira.
   */
  diceColors: Record<number, { bodyColor: number; numberColor: string }>
  /** Acabamento do dado (fosco, metálico, plástico, vidro). Aplicado no mesh existente, sem remount. */
  material?: DiceMaterialFinish
  /** Cor da parede da bandeja (hex numérico). Aplicada na cena existente, sem remount. */
  wallColor?: number
  /** Cor de fundo da cena (hex numérico). */
  backgroundColor?: number
  /** Cor do chão da bandeja (hex numérico). */
  floorColor?: number
  /** Cores da torre (pedra, telhado, flâmula, porta). Aplicadas na torre existente, sem remount. */
  towerColors?: TowerColors
  /** Imagem de fundo (data URL); sem ela vale `backgroundColor`. Também sem remount. */
  backgroundImage?: string | null
  /**
   * Bandeja aberta (padrão) ou torre de castelo. Estrutural: muda cena e física inteiras, então
   * precisa estar no `key` do componente pai (`DiceRoller3D.tsx`), como `debugMode`.
   */
  launchMode?: LaunchMode
  /** Lados da bandeja — forma escolhida pelo usuário (ver `trayShape.ts`). */
  traySides?: number
  /** Modo debug: colisores, normais de face, confiança, velocidade e FPS sobrepostos à cena. */
  debugMode?: boolean
  /**
   * Estojo atrás da bandeja aberto (padrão) ou fechado, pelo botão da barra do roller. Anima em
   * cima da cena existente e nunca remonta: abrir a caixinha não pode custar uma cena 3D nova.
   */
  caseOpen?: boolean
  /** Clique no estojo dentro da cena 3D; quem decide o que fazer é o pai, dono do `caseOpen`. */
  onCaseClick?: () => void
  /** Ponte levadiça da torre abaixada (padrão) ou levantada. Como o estojo: anima, nunca remonta. */
  bridgeOpen?: boolean
  /** Clique na ponte dentro da cena. Só vale na torre de enfeite, ver `bridgeUnderPointer`. */
  onBridgeClick?: () => void
  /** Como o WASD dirige a câmera. Não entra no `key`: trocar de modo não remonta a cena. */
  cameraMode?: CameraMode
}

interface DieInstance {
  sides: PhysicalDiceSides
  body: RAPIER.RigidBody
  mesh: THREE.Mesh
  tracker: SettleTracker
  /**
   * `queued`: modo torre, esperando a vez de sair pela boca (mesh invisível, sem colisão — ver
   *   `parkTowerDie`).
   * `rolling`: assentando na bandeja — mesmo estado nos dois modos a partir daqui.
   * `done`: assentado com resultado lido.
   */
  phase: 'queued' | 'rolling' | 'done'
  /**
   * Instante (na régua de `sceneElapsedMsRef`) em que este dado sai da boca da torre. Eles saem em
   * fila, um a cada `MOUTH_RELEASE_INTERVAL_MS`, porque nascem todos no mesmo ponto. `undefined` =
   * ainda não foi enfileirado.
   */
  releaseAtMs?: number
  lastValue: number | null
  spawnSlot: { x: number; z: number }
  /** Tempo simulado na fase "entrando" sem cruzar pra dentro (ver `ENTRY_FORCE_PUSH_TIMEOUT_MS` em `collisionGroups.ts`). Zerado a cada arremesso. */
  enteringElapsedMs: number
  debug?: { visuals: DiceDebugVisuals; updateRow: (snapshot: DieDebugSnapshot) => void }
}

/**
 * Espaçamento da prateleira decorativa: um dado de cada tipo em fileira reta fora do hexágono, pra
 * ver a cor e o acabamento escolhidos sem precisar rolar. Fica do lado oposto à câmera, ao fundo da
 * cena, sem tampar a bandeja.
 */
const SHELF_SPACING = 1.4

/**
 * Altura de um dado parado no estojo, já em coordenadas de mundo.
 *
 * É função por causa de um bug real: as medidas do estojo são relativas à BASE dele, mas os dados
 * da prateleira entram direto na cena. Quando a bandeja virou caixa elevada e o estojo desceu pra
 * mesa (`TABLE_DROP`), os dados ficaram na altura antiga, flutuando. Com a conta num lugar só, a
 * montagem e a remontagem por troca de cor não têm como divergir de novo.
 */
function shelfDieY(dieScale: number): number {
  return CASE_DICE_Y + dieScale / 2 + TABLE_SURFACE_Y
}

/**
 * Assenta um dado no compartimento dele: a posição na prateleira e o maior número virado pra cima e
 * de frente pra quem olha (d4 com 4, d20 com 20). Sem a orientação, cada tipo mostrava a face que a
 * malha calhasse de deixar em cima. É função pelo mesmo motivo do `shelfDieY` acima.
 */
function assentarDadoDaPrateleira(
  mesh: THREE.Mesh,
  definition: DiceDefinition,
  posicao: { x: number; z: number }
): void {
  mesh.position.set(posicao.x, shelfDieY(definition.scale), posicao.z)
  const giro = orientacaoDeVitrine(definition, mesh.geometry)
  mesh.quaternion.set(giro.x, giro.y, giro.z, giro.w)
}

export function computeShelfPositions(): { x: number; z: number }[] {
  const n = AVAILABLE_DICE_TYPES.length
  const startX = -((n - 1) * SHELF_SPACING) / 2
  const z = -(regularPolygonCircumradius(TRAY_CONFIG.apothem, TRAY_CONFIG.wallSegments) + 2.5)
  return AVAILABLE_DICE_TYPES.map((_, i) => ({ x: startX + i * SHELF_SPACING, z }))
}

/** Profundidade ÚTIL (interna) do estojo — folga confortável em volta do maior dado (0.7). */
const CASE_DEPTH = 1.05
/**
 * Altura das paredes. Com 0.34 os dados (até 0.7 de altura) ficavam mais pra fora que pra dentro,
 * empoleirados nas divisórias como num pente em vez de encaixados em compartimentos.
 */
const CASE_WALL_HEIGHT = 0.42
const CASE_WALL_THICKNESS = 0.11
/** Espessura do forro (chão e faces internas) — fino de propósito, é revestimento, não estrutura. */
const CASE_LINING_THICKNESS = 0.045
/**
 * Ferro envelhecido das ferragens, fixo: é detalhe metálico, não acompanha a cor da bandeja. Era
 * latão dourado, e trocar só a cor não resolveria — latão claro com `metalness` alto é justamente a
 * leitura de ferragem nova e polida. Por isso cor, `metalness` e `roughness` andam juntos.
 */
const CASE_METAL_COLOR = 0x39332c
/**
 * O estojo tem corpo: pezinhos, fundo maciço e paredes, tudo apoiado na mesa. Antes havia um
 * pedestal enterrado no chão, criado só pra tapar o disco do chão cruzando a base, e da câmera o
 * que sobrava eram quatro paredes finas nascendo do nada. Com fundo espesso e pezinhos, o conjunto
 * lê como caixa pousada, e ainda ganha sombra própria por baixo.
 */
const CASE_FOOT_HEIGHT = 0.08
const CASE_FLOOR_THICKNESS = 0.14
/** Altura (y) do topo do fundo maciço — onde o forro é assentado. */
const CASE_INTERIOR_Y = CASE_FOOT_HEIGHT + CASE_FLOOR_THICKNESS
/**
 * Altura onde os dados da prateleira se apoiam: em cima do FORRO, que por sua vez fica em cima do
 * fundo maciço.
 *
 * O forro era afundado dentro do fundo, com a face de cima dos dois na mesma altura. Duas faces
 * coplanares apontando pro mesmo lado disputam o mesmo valor de profundidade, e quem ganha muda
 * conforme a câmera se move: o piso do estojo piscava entre madeira e feltro. Com o forro por cima,
 * as faces que se encostam apontam pra lados opostos e não há empate.
 */
const CASE_DICE_Y = CASE_INTERIOR_Y + CASE_LINING_THICKNESS

/**
 * Tampa do estojo: uma caixa rasa virada pra baixo (tampo e saia nas quatro laterais), com a
 * dobradiça na aresta de trás do topo das paredes, o lado oposto à câmera padrão. Fechada, encaixa
 * POR FORA das paredes como tampa de caixa de verdade; abrindo, gira pra trás e pra cima, sem nunca
 * passar na frente dos dados.
 *
 * `CASE_LID_SKIRT` + `CASE_WALL_HEIGHT` precisa passar da altura do dado mais alto em pé (0.7) pra
 * tampa fechada cobrir tudo.
 */
const CASE_LID_SKIRT = 0.5
const CASE_LID_THICKNESS = 0.08
/** ~104°: passa da vertical o bastante pra tampa descansar aberta pra trás, em vez de ficar equilibrada em pé. */
const CASE_LID_OPEN_ANGLE = Math.PI * 0.58

/**
 * Teto de quadros por segundo da cena (ver o `tick`). 60 é o piso do que se lê como fluido num
 * objeto que gira rápido, e 30 é o piso do que se lê como movimento contínuo num objeto lento, que
 * é o caso do que continua animando com a cena parada: bandeira e pelúcia.
 */
const FPS_ATIVO = 60
const FPS_PARADO = 30

/** A cena aparece com o estojo fechado por um instante antes de ele abrir sozinho. */
const CASE_LID_OPEN_DELAY_MS = 650
const CASE_LID_OPEN_DURATION_MS = 1100

export interface ShelfCaseHandle {
  group: THREE.Group
  /** Grupo-dobradiça da tampa: girar `rotation.x` (negativo = abrindo) é o que anima a abertura. */
  lidPivot: THREE.Group
  /**
   * Troca as cores no lugar, sem reconstruir nada: só casca, forro e forro da tampa dependem das
   * cores escolhidas, e em todos ela é literalmente `material.color`. Antes disso, cada troca jogava
   * o estojo fora e refazia ~30 `BoxGeometry`, materiais e as texturas de madeira do zero — era o
   * que travava ao arrastar o seletor de cor na aba Estilo.
   */
  updateColors: (floorColorHex: number, wallColorHex: number) => void
}

/**
 * Progresso 0→1 com um leve passar do ponto no fim: é o que faz a abertura ler como uma tampa com
 * peso sendo jogada pra trás, e não como interpolação linear.
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Animação da tampa em curso: de `from` até `to` (0 = fechada, 1 = aberta), começando em `startMs` do relógio da cena. */
interface LidAnimation {
  from: number
  to: number
  startMs: number
}

/**
 * Progresso da tampa (0 fechada, 1 aberta) no instante `elapsedMs` do relógio da cena. Fechando não
 * usa o `easeOutBack` da abertura: na direção contrária, o passar do ponto enfiaria a tampa pra
 * dentro da caixa, atravessando os dados.
 */
function lidProgressAt(animation: LidAnimation, elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, (elapsedMs - animation.startMs) / CASE_LID_OPEN_DURATION_MS))
  const opening = animation.to > animation.from
  const eased = opening ? easeOutBack(t) : easeOutCubic(t)
  return animation.from + (animation.to - animation.from) * eased
}

/**
 * Estojo de display em volta da prateleira, com uma divisória por compartimento, pra parecer uma
 * caixa onde os dados ficam guardados e não uma placa com dados em fileira. Só visual, sem
 * collider. Reaproveita `wallColor`/`floorColor` da aba Estilo (parede do estojo = cor de parede,
 * base = cor de chão), então não precisa de cor nova nenhuma.
 */
export function createShelfCaseMesh(
  z: number,
  floorColorHex: number,
  wallColorHex: number
): ShelfCaseHandle {
  const group = new THREE.Group()
  const innerWidth = (AVAILABLE_DICE_TYPES.length - 1) * SHELF_SPACING + 1.1
  const outerWidth = innerWidth + CASE_WALL_THICKNESS * 2
  const outerDepth = CASE_DEPTH + CASE_WALL_THICKNESS * 2

  /**
   * Duas famílias de material, e é o contraste entre elas que faz a caixa ler como estojo: casca em
   * madeira na cor de parede e forro macio na cor do chão. A primeira versão usava a mesma cor em
   * tudo e virava um bloco cinza.
   *
   * A casca leva o mesmo veio da parede e da borda da mesa, o que amarra o estojo à cena. A repetição
   * é bem mais alta que a da bandeja (3 → 7): tábua estreita lê como madeira de ripa, tábua larga
   * como painel industrial.
   */
  const shellWood = createWoodTextures(7, 1)
  const shellMaterial = new THREE.MeshStandardMaterial({
    /**
     * Madeira bem mais escura que a da bandeja: com a bandeja sendo uma caixa clara logo à frente, o
     * estojo se confundia com ela. O escurecimento vem DEPOIS do `woodTint`, então a cor escolhida
     * na aba Estilo continua mandando no tom.
     */
    color: woodTint(wallColorHex).multiplyScalar(0.42),
    map: shellWood.map,
    normalMap: shellWood.normalMap,
    // Relevo mais fundo que o da bandeja: o veio precisa aparecer mesmo com a peça escura, senão
    // escurecer só transforma o estojo num vulto sem textura nenhuma.
    normalScale: new THREE.Vector2(1, 1),
    // Praticamente sem brilho de verniz — é o que separa "antigo" de "recém-comprado".
    roughness: 0.95,
    metalness: 0
  })
  const liningMaterial = new THREE.MeshStandardMaterial({
    color: floorColorHex,
    roughness: 0.98,
    metalness: 0
  })
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: CASE_METAL_COLOR,
    // Ferro forjado, não latão polido (ver `CASE_METAL_COLOR`): áspero e pouco metálico, pra ler
    // como peça velha e escura em vez de ferragem nova reluzente.
    roughness: 0.75,
    metalness: 0.25
  })

  function piece(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    parent: THREE.Object3D = group
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  /**
   * Pezinhos e fundo maciço: o volume que faltava embaixo. O fundo é uma peça só, do tamanho externo
   * cheio, e as paredes nascem em cima dele, sem nenhuma começando no ar.
   */
  const footInset = 0.18
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      piece(
        new THREE.BoxGeometry(0.28, CASE_FOOT_HEIGHT, 0.22),
        shellMaterial,
        [
          xSide * (outerWidth / 2 - footInset),
          CASE_FOOT_HEIGHT / 2,
          z + zSide * (outerDepth / 2 - footInset * 0.6)
        ]
      )
    }
  }
  piece(
    new THREE.BoxGeometry(outerWidth, CASE_FLOOR_THICKNESS, outerDepth),
    shellMaterial,
    [0, CASE_FOOT_HEIGHT + CASE_FLOOR_THICKNESS / 2, z]
  )

  // Paredes da casca, em cima do fundo.
  for (const zSide of [-1, 1]) {
    piece(
      new THREE.BoxGeometry(outerWidth, CASE_WALL_HEIGHT, CASE_WALL_THICKNESS),
      shellMaterial,
      [
        0,
        CASE_INTERIOR_Y + CASE_WALL_HEIGHT / 2,
        z + zSide * (CASE_DEPTH / 2 + CASE_WALL_THICKNESS / 2)
      ]
    )
  }
  for (const xSide of [-1, 1]) {
    piece(
      new THREE.BoxGeometry(CASE_WALL_THICKNESS, CASE_WALL_HEIGHT, CASE_DEPTH),
      shellMaterial,
      [
        xSide * (innerWidth / 2 + CASE_WALL_THICKNESS / 2),
        CASE_INTERIOR_Y + CASE_WALL_HEIGHT / 2,
        z
      ]
    )
  }

  // Forro: piso e faces internas do fundo e das laterais. A da FRENTE não entra, porque a câmera
  // olha de cima e de frente e é a única que nunca aparece. O piso vai POR CIMA do fundo maciço,
  // nunca afundado nele (ver `CASE_DICE_Y`).
  piece(
    new THREE.BoxGeometry(innerWidth, CASE_LINING_THICKNESS, CASE_DEPTH),
    liningMaterial,
    [0, CASE_INTERIOR_Y + CASE_LINING_THICKNESS / 2, z]
  )
  piece(
    new THREE.BoxGeometry(innerWidth, CASE_WALL_HEIGHT * 0.88, CASE_LINING_THICKNESS),
    liningMaterial,
    [
      0,
      CASE_DICE_Y + (CASE_WALL_HEIGHT * 0.88) / 2,
      z - CASE_DEPTH / 2 + CASE_LINING_THICKNESS / 2
    ]
  )
  for (const xSide of [-1, 1]) {
    piece(
      new THREE.BoxGeometry(CASE_LINING_THICKNESS, CASE_WALL_HEIGHT * 0.88, CASE_DEPTH),
      liningMaterial,
      [
        xSide * (innerWidth / 2 - CASE_LINING_THICKNESS / 2),
        CASE_DICE_Y + (CASE_WALL_HEIGHT * 0.88) / 2,
        z
      ]
    )
  }

  /**
   * Divisórias entre os compartimentos, também no forro (não na cor da casca): assim cada dado
   * fica num "berço" claro, que é como um estojo de dados de verdade se parece por dentro.
   * Baixas o bastante (60% da parede) pra não esconder o dado que estão separando.
   */
  const dividerHeight = CASE_WALL_HEIGHT * 0.6
  const n = AVAILABLE_DICE_TYPES.length
  const startX = -((n - 1) * SHELF_SPACING) / 2
  for (let i = 1; i < n; i++) {
    piece(
      new THREE.BoxGeometry(0.05, dividerHeight, CASE_DEPTH * 0.88),
      liningMaterial,
      [startX + (i - 0.5) * SHELF_SPACING, CASE_DICE_Y + dividerHeight / 2, z]
    )
  }

  /**
   * Dobradiça na aresta de trás do topo das paredes, o lado oposto à câmera padrão: girando
   * `rotation.x` pro negativo, a aresta da frente sobe e vai pra trás, e a tampa nunca cruza a linha
   * de visão entre a câmera e os dados. As peças da tampa são posicionadas relativas a ela.
   *
   * A tampa tem a mesma planta da caixa. Na primeira versão era maior, com a dobradiça acima das
   * paredes, e aberta parecia uma placa solta pairando atrás do estojo.
   */
  const lidPivot = new THREE.Group()
  lidPivot.position.set(0, CASE_INTERIOR_Y + CASE_WALL_HEIGHT, z - outerDepth / 2)
  group.add(lidPivot)

  piece(
    new THREE.BoxGeometry(outerWidth, CASE_LID_THICKNESS, outerDepth),
    shellMaterial,
    [0, CASE_LID_SKIRT + CASE_LID_THICKNESS / 2, outerDepth / 2],
    lidPivot
  )
  // Saia: desce por FORA das paredes (é o que faz a tampa "encaixar" na caixa em vez de pousar
  // em cima dela).
  for (const zSide of [0, 1]) {
    piece(
      new THREE.BoxGeometry(outerWidth, CASE_LID_SKIRT, CASE_WALL_THICKNESS * 0.6),
      shellMaterial,
      [0, CASE_LID_SKIRT / 2, zSide * outerDepth],
      lidPivot
    )
  }
  for (const xSide of [-1, 1]) {
    piece(
      new THREE.BoxGeometry(CASE_WALL_THICKNESS * 0.6, CASE_LID_SKIRT, outerDepth),
      shellMaterial,
      [xSide * (outerWidth / 2 - CASE_WALL_THICKNESS * 0.3), CASE_LID_SKIRT / 2, outerDepth / 2],
      lidPivot
    )
  }
  /**
   * Forro por dentro da tampa: com ela aberta é essa a face virada pra câmera, e sem forro se vê o
   * fundo cru da casca. Um tom mais escuro que o do fundo porque ela fica virada pra longe da luz
   * principal; com a mesma cor dos dois lados, o painel virava uma chapa amarela sem profundidade.
   */
  const lidLiningMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(floorColorHex).multiplyScalar(0.82),
    roughness: 0.98,
    metalness: 0
  })
  piece(
    new THREE.BoxGeometry(innerWidth * 0.985, CASE_LINING_THICKNESS, CASE_DEPTH * 0.94),
    lidLiningMaterial,
    [0, CASE_LID_SKIRT - CASE_LINING_THICKNESS / 2, outerDepth / 2],
    lidPivot
  )

  // Ferragens: duas dobradiças de ferro na aresta traseira e um fecho na frente. São as únicas peças
  // de metal que sobraram, e ficam porque são funcionais: são elas que dizem "isto abre".
  for (const xSide of [-1, 1]) {
    const hinge = piece(
      new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12),
      metalMaterial,
      [xSide * outerWidth * 0.3, CASE_INTERIOR_Y + CASE_WALL_HEIGHT, z - outerDepth / 2]
    )
    hinge.rotation.z = Math.PI / 2
  }
  piece(
    new THREE.BoxGeometry(0.22, 0.16, 0.05),
    metalMaterial,
    [0, CASE_INTERIOR_Y + CASE_WALL_HEIGHT * 0.62, z + outerDepth / 2 + 0.02]
  )

  /**
   * Sem ornamentos: as cantoneiras, os rebites, as plaquinhas e o friso de latão saíram a pedido do
   * usuário. Junto deles saiu o `ORNAMENT_SINK`, a folga que afundava cada peça chapada um tiquinho
   * na superfície onde estava pregada — sem ela as duas faces ficavam coplanares e o estojo chiava,
   * trocando de face conforme a câmera girava. Fica o registro: peça chapada nova colada na casca
   * vai precisar da mesma folga.
   */

  return {
    group,
    lidPivot,
    updateColors(newFloorColorHex, newWallColorHex) {
      // Os mesmos cálculos da construção acima, ponto a ponto — se um deles mudar lá, muda aqui.
      shellMaterial.color.copy(woodTint(newWallColorHex).multiplyScalar(0.42))
      liningMaterial.color.set(newFloorColorHex)
      lidLiningMaterial.color.set(newFloorColorHex).multiplyScalar(0.82)
    }
  }
}

/** Achata `groups` (ex.: [{sides:6,count:4}]) numa lista de N dados individuais, na ordem em que os slots são atribuídos. */
function flattenGroups(groups: DiceGroupSpec[]): PhysicalDiceSides[] {
  const flat: PhysicalDiceSides[] = []
  for (const group of groups) {
    for (let i = 0; i < group.count; i++) flat.push(group.sides)
  }
  return flat.slice(0, MAX_SIMULTANEOUS_DICE)
}


/**
 * Poe um dado "em espera" na fila da boca da torre — invisível e sem colidir com nada (ver
 * `parkedCollisionGroups`) até chegar a vez dele de sair (ver `releaseAtMs`).
 */
function parkTowerDie(die: DieInstance): void {
  die.phase = 'queued'
  die.mesh.visible = false
  if (die.body.numColliders() > 0) die.body.collider(0).setCollisionGroups(parkedCollisionGroups())
}

/**
 * N dados simultâneos, de tipos diferentes, cada um com seu corpo físico, colidindo entre si e com
 * a bandeja e assentando de forma independente. O resultado só é reportado quando TODOS assentaram,
 * e vem com a lista individual, não só o total.
 */
export const DiceCanvasMulti = forwardRef<DiceCanvasMultiHandle, DiceCanvasMultiProps>(
  function DiceCanvasMulti(
    {
      groups,
      onResult,
      onError,
      autoRoll,
      diceColors,
      material,
      wallColor,
      backgroundColor,
      floorColor,
      backgroundImage,
      launchMode = 'tray',
      traySides = TRAY_CONFIG.wallSegments,
      towerColors = DEFAULT_TOWER_COLORS,
      debugMode,
      caseOpen = true,
      onCaseClick,
      bridgeOpen = true,
      onBridgeClick,
      cameraMode = 'table'
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const diceRef = useRef<DieInstance[]>([])
    const sceneRef = useRef<THREE.Scene | null>(null)
    const trayRef = useRef<TraySceneHandle | null>(null)
    /**
     * `null` fora do modo torre, que é o que deixa a roda de cor tingir a torre sem recriá-la. É o
     * handle inteiro, e não uma cópia à mão dos métodos que a cena usa: a lista escrita à mão já
     * tinha ficado desatualizada assim que a torre ganhou a ponte levadiça.
     */
    const towerBesideRef = useRef<TowerBesideTrayHandle | null>(null)
    /** Meshes decorativos da prateleira fora do hexágono (ver `computeShelfPositions`). */
    const shelfMeshesRef = useRef<THREE.Mesh[]>([])
    /** Estojo/caixinha de display sob a prateleira (ver `createShelfCaseMesh`) — pedido do usuário. */
    const shelfCaseMeshRef = useRef<ShelfCaseHandle | null>(null)
    /** Mini pelúcia do Riebeck na mesa (ver `createRiebeckPlush`) — só pra animar a respiração no `tick`. */
    const plushRef = useRef<THREE.Group | null>(null)
    /**
     * Quanto tempo a cena já está montada; só alimenta a animação da tampa do estojo. Fica num ref
     * porque o efeito de troca de cor recria o estojo e precisa recolocar a tampa no ângulo em que
     * ela já estava, sem fechar e abrir de novo só porque alguém trocou uma cor.
     */
    const sceneElapsedMsRef = useRef(0)
    /** Estado atual da tampa: 0 = fechada, 1 = aberta (ver `lidProgressAt`). */
    const lidProgressRef = useRef(0)
    const lidAnimationRef = useRef<LidAnimation | null>(null)
    /**
     * Ponte levadiça: 1 = abaixada (padrão), 0 = levantada. Reaproveita a máquina de animação da
     * tampa (`LidAnimation`/`lidProgressAt`) porque é o mesmo problema — uma peça girando numa
     * dobradiça, com a mesma necessidade de inverter no meio do caminho em dois cliques seguidos.
     */
    const bridgeProgressRef = useRef(1)
    const bridgeAnimationRef = useRef<LidAnimation | null>(null)
    /**
     * Mundo físico e HUD de debug espelhados em ref: o efeito de montagem os cria como variáveis
     * locais, e o efeito de resync de dados roda numa segunda passada, sem elas por closure.
     */
    const worldRef = useRef<RAPIER.World | null>(null)
    const hudRef = useRef<DiceDebugHud | null>(null)

    const onResultRef = useRef(onResult)
    onResultRef.current = onResult

    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    const onCaseClickRef = useRef(onCaseClick)
    onCaseClickRef.current = onCaseClick

    const onBridgeClickRef = useRef(onBridgeClick)
    onBridgeClickRef.current = onBridgeClick

    /**
     * A ponte ABAIXADA no modo em uso, e não o `bridgeOpen` cru: fora da torre de enfeite ela fica
     * sempre abaixada, senão o dado sairia atravessando a folha levantada (`ponteAbertaNoModo`).
     */
    const ponteAbaixada = ponteAbertaNoModo(launchMode, bridgeOpen)
    /** Espelha o valor acima pro efeito de montagem, que roda uma vez só — ver o uso na criação da torre. */
    const bridgeOpenRef = useRef(ponteAbaixada)
    bridgeOpenRef.current = ponteAbaixada

    /**
     * "Algo que projeta sombra mudou" (ver `shadowMap.autoUpdate` na montagem). Com o mapa de sombras
     * deixando de se refazer sozinho, quem mexe na cena fora do laço precisa avisar: sem isto,
     * clicar em "+" põe um dado novo na bandeja e a sombra dele não existe até a rolagem seguinte.
     * Num ref, e não em estado, porque quem lê é o laço de animação, que roda fora do React.
     */
    const precisaDeSombraRef = useRef(true)

    /** Espelham as props mais novas pro efeito de resync nunca usar cor ou acabamento desatualizados. */
    const diceColorsRef = useRef(diceColors)
    diceColorsRef.current = diceColors
    const materialRef = useRef(material)
    materialRef.current = material
    // Espelhado em ref pelo mesmo motivo dos de cima: o efeito de montagem roda uma vez só e
    // congelaria a cor do primeiro render.
    const towerColorsRef = useRef(towerColors)
    towerColorsRef.current = towerColors
    /** Espelha `caseOpen` pro efeito de mount (que roda uma vez só) saber se deve agendar a animação de entrada da tampa. */
    const caseOpenRef = useRef(caseOpen)
    caseOpenRef.current = caseOpen
    /**
     * Em ref de propósito: o laço de animação e os handlers de tecla são criados uma vez só. Lendo a
     * prop direto ficariam presos ao primeiro render, e pôr `cameraMode` nas dependências do efeito
     * remontaria a cena 3D inteira só pra mudar como três teclas são interpretadas.
     */
    const cameraModeRef = useRef(cameraMode)
    cameraModeRef.current = cameraMode

    /**
     * Os dados já nascem sendo arremessados só por efeito visual, pra não ficarem parados no ar
     * quando a cena monta ou remonta. Isso não é uma rolagem pedida: sem esta flag, o assentamento
     * desse arremesso dispara `onResult` sozinho, gravando uma entrada fantasma no histórico e
     * tocando o som de rolagem toda vez que a cena monta, inclusive ao abrir o app ou trocar uma cor.
     * Só fica `true` no primeiro `roll()` explícito, ou já nasce assim com `autoRoll` (preset).
     */
    const armedRef = useRef(autoRoll ?? false)

    useImperativeHandle(ref, () => ({
      roll: () => {
        armedRef.current = true
        if (launchMode === 'tower') {
          // Refila tudo: cada dado volta pra fila e sai pela boca na sua vez, um a cada
          // `MOUTH_RELEASE_INTERVAL_MS` (nascem todos no mesmo ponto, o que os separa é o tempo).
          diceRef.current.forEach((die, i) => {
            die.lastValue = null
            parkTowerDie(die)
            die.releaseAtMs = sceneElapsedMsRef.current + i * MOUTH_RELEASE_INTERVAL_MS
          })
        } else {
          for (const die of diceRef.current) {
            tossDie(die.body, { target: die.spawnSlot, sides: traySides })
            die.tracker.reset()
            die.phase = 'rolling'
            die.lastValue = null
            die.enteringElapsedMs = 0
          }
        }
        onResultRef.current?.(null)
      }
    }))

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let disposed = false

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      /**
       * O mapa de sombras não se refaz sozinho a cada quadro. Com `autoUpdate` (o padrão do three), a
       * cena inteira é desenhada mais uma vez, do ponto de vista da luz, em TODO quadro, inclusive
       * com os dados parados há dez minutos; com sombra suave isso é boa fatia do custo do quadro.
       * Aqui ele passa a ser pedido: `needsUpdate` liga enquanto há dado se mexendo e mais uma vez
       * quando tudo assenta, que é o que grava a sombra final. Ver `precisaDeSombra` no laço.
       */
      renderer.shadowMap.autoUpdate = false
      renderer.shadowMap.needsUpdate = true
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)

      /**
       * A torre aparece em DOIS modos ('tower' e 'towerDecor'); o que muda entre eles é só de onde o
       * dado é lançado. Daí as duas perguntas separadas abaixo: `mostraTorre` decide cena e câmera,
       * `lancaPelaBoca` decide a física.
       */
      const mostraTorre = launchMode === 'tower' || launchMode === 'towerDecor'
      const lancaPelaBoca = launchMode === 'tower'
      /**
       * No modo torre a câmera recua (`TOWER_BESIDE_CAMERA_CONFIG`): a torre chega a 9.42 de altura
       * com telhado e flâmula, contra os 6.79 que a câmera padrão enquadra.
       */
      const cameraConfig = mostraTorre ? TOWER_BESIDE_CAMERA_CONFIG : CAMERA_CONFIG

      /**
       * Os dois modos usam a MESMA cena de bandeja. A torre deixou de ser um cenário alternativo e
       * virou uma peça encostada no hexágono, de cuja boca o dado sai rolando pra dentro
       * (`createTowerBesideTray` + `tossDieFromMouth`); estojo, prateleira, pelúcia, colisores e
       * gravidade valem igual nos dois.
       */
      const tray = createTrayScene(wallColor, backgroundColor, floorColor, backgroundImage ?? null, traySides)
      const scene = tray.scene
      trayRef.current = tray
      const camera = createCamera(container.clientWidth / container.clientHeight, cameraConfig)
      if (mostraTorre) {
        /**
         * A torre desenhada em CÓDIGO, no lugar do modelo `.glb` (decisão dele: "a torre antiga está
         * melhor"). O motivo técnico bate com o que ele viu: a malha do `.glb` veio do SolidWorks só
         * com POSITION e NORMAL, e sem UV não há onde a textura de tijolo se apoiar — virava cor
         * chapada, um material só, e as quatro cores da torre viravam uma. De brinde, esta é
         * síncrona: não existe janela em que uma rolagem aconteça sem a torre na tela.
         * `createTowerModel.ts` continua no projeto; trocar de volta é trocar a chamada aqui.
         */
        const tower = createTowerBesideTray(towerColorsRef.current, {}, traySides)
        scene.add(tower.group)
        towerBesideRef.current = tower
        /**
         * A ponte nasce abaixada, mas o estado de aberta ou fechada vive no React e sobrevive à
         * remontagem da cena. Sem esta linha, levantar a ponte e trocar a forma da bandeja devolvia
         * uma ponte abaixada na tela com o app achando que ela estava levantada, e só o segundo
         * clique funcionava. Sem animação aqui: a cena está nascendo, não há de onde animar.
         */
        bridgeProgressRef.current = bridgeOpenRef.current ? 1 : 0
        tower.ponte.definirAbertura(bridgeProgressRef.current)
      }
      sceneRef.current = scene
      const environment = setupDiceEnvironment(scene, renderer)

      /**
       * Cache GLOBAL de textura, não recriado a cada mount: como a cena remonta inteira quando
       * `groups` muda, é ele que faz a montagem seguinte reaproveitar as texturas em vez de
       * redesenhar a prateleira (até 160 faces) e cada dado do zero.
       */
      const mountTextureCache = getGlobalDiceTextureCache()

      // Prateleira decorativa: um dado de cada tipo parado do lado de fora do hexágono, só pra ver a
      // cor e o acabamento sem precisar rolar. Nunca tem corpo físico. Vale nos dois modos desde que
      // a torre passou a encostar na bandeja em vez de substituí-la. O bloco existe pra manter o
      // escopo de `positions`/`shelfCase`, que não precisam vazar pro resto do efeito.
      {
        const positions = computeShelfPositions()
        const shelfCase = createShelfCaseMesh(
          positions[0].z,
          floorColor ?? DEFAULT_FLOOR_COLOR,
          wallColor ?? DEFAULT_WALL_COLOR
        )
        // Apoiado na MESA, que fica abaixo do chão da bandeja desde que a bandeja virou uma caixa
        // elevada (ver `TABLE_DROP` em `createScene.ts`) — sem isso o estojo fica flutuando.
        shelfCase.group.position.y = TABLE_SURFACE_Y
        scene.add(shelfCase.group)
        shelfCaseMeshRef.current = shelfCase
        sceneElapsedMsRef.current = 0
        // A cena nasce com o estojo fechado e ele se abre sozinho depois de um instante — a
        // partir daí quem manda é o botão (prop `caseOpen`). Se a cena montar já com o estojo
        // fechado pelo botão, nenhuma animação de entrada é agendada.
        lidProgressRef.current = 0
        lidAnimationRef.current = caseOpenRef.current
          ? { from: 0, to: 1, startMs: CASE_LID_OPEN_DELAY_MS }
          : null

        /**
         * Enfeites da mesa, os dois decorativos: sem corpo físico, sem collider, fora do laço da
         * física, e descartados junto com a cena por `disposeScene`. Ficam atrás do estojo, que é o
         * esconderijo pedido ("não quero que dê pra ver ele da entrada principal"). O cavalo fica de
         * perfil pra câmera: de frente ele vira uma caixa com quatro pernas.
         */
        if (MOSTRA_CAVALO) {
          const cavalo = createTrojanHorse()
          cavalo.scale.setScalar(CAVALO_ESCALA)
          assentarCavaloAtrasDoEstojo(cavalo, positions[0].z)
          scene.add(cavalo)
        }

        if (SHOW_PLUSH) {
          const plush = createRiebeckPlush()
          plush.scale.setScalar(PLUSH_SCALE)
          /**
           * Sentada na mesa, que é mais baixa que o chão da bandeja, e escondida no enquadramento em
           * que o app abre: ela é easter egg. Encostada no estojo isso vale por geometria e não por
           * distância — 0.53 de altura contra 1.22 dele.
           *
           * Duas lições das dez posições anteriores: o "está flutuando" que ele repetiu quatro vezes
           * nunca foi altura, sombra nem cor de bota, era MARGEM DE GRAMADO (perto da beirada do
           * disco, uma câmera baixa recorta a pelúcia contra o fundo preto); e conferir na câmera EM
           * QUE ELE ESTÁ, porque recarregar o app reseta o enquadramento pro padrão.
           */
          plush.position.set(PLUSH_X, TABLE_SURFACE_Y - PLUSH_SINK, plushZBehindCase(positions[0].z))
          /**
           * De costas pro hexágono, olhando pra fora da mesa: sentada na beirada, ela lê como alguém
           * olhando o horizonte em vez de assistindo à partida. O boneco é modelado olhando pro +Z,
           * então `rotation.y = θ` aponta pra `(sin θ, 0, cos θ)`; com `atan2(x, z)` das próprias
           * coordenadas, essa direção é o vetor que sai do centro da mesa e passa por ele. Calculado
           * porque ele não está num eixo: qualquer ângulo fixo o deixaria torto com a beirada.
           */
          plush.rotation.y = Math.atan2(plush.position.x, plush.position.z)
          // Altura de repouso, guardada pra respiração oscilar EM CIMA dela em vez de substituí-la
          // (ver o comentário grande na respiração, no laço de animação).
          plush.userData.restY = plush.position.y
          scene.add(plush)
          plushRef.current = plush
        }

        shelfMeshesRef.current = AVAILABLE_DICE_TYPES.map((sides, i) => {
          const entry = DICE_REGISTRY[sides]
          const colors = diceColors[sides]
          const mesh = entry.buildVisual({
            bodyColor: colors?.bodyColor,
            numberColor: colors?.numberColor,
            material,
            textureCache: mountTextureCache
          })
          assentarDadoDaPrateleira(mesh, entry.definition, positions[i])
          scene.add(mesh)
          return mesh
        })
      }

      /**
       * Câmera orbital: arrastar gira e aproxima, já que a câmera fixa podia deixar dados fora do
       * quadro em rolagens com muitos dados. Damping ligado; distância e ângulo polar limitados pra
       * ninguém dar zoom pra dentro da cena nem virar a câmera pra baixo do chão.
       */
      const controls = new OrbitControls(camera, renderer.domElement)
      /** Última mexida na câmera; alimenta o teto de quadros, porque arrastar precisa da taxa cheia. */
      let ultimaInteracaoMs = performance.now()
      controls.addEventListener('change', () => {
        ultimaInteracaoMs = performance.now()
      })
      controls.target.set(cameraConfig.lookAt[0], cameraConfig.lookAt[1], cameraConfig.lookAt[2])
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      /**
       * Zoom fundo. O 6 antigo era mais ou menos o raio da bandeja: dava pra enquadrar a mesa, nunca
       * pra chegar perto de UMA peça. 1.8 é seguro contra o plano de corte (`near` = 0.1).
       *
       * Limites iguais nos dois modos, e isso é conserto de bug real: enquanto a torre tinha cena
       * própria, tinha limites próprios (1.2 e 19). Com a bandeja compartilhada o 19 ficou, e o
       * `OrbitControls` cortava a câmera de `TOWER_BESIDE_CAMERA_CONFIG` (que nasce a 23.08 do alvo)
       * já no primeiro `update()`, com o topo da torre cortado.
       */
      controls.minDistance = 1.8
      controls.maxDistance = 35
      /**
       * Era `Math.PI / 2` exato: nesse ângulo a câmera fica quase na altura do chão em volta e olha
       * pra ele de raspão, e o disco perto da câmera projeta como uma faixa larga e clara na tela
       * ("ainda dá pra ver o chão", na direção do estojo). A folga de ~10° tira só esse extremo.
       */
      controls.maxPolarAngle = Math.PI / 2 - 0.17
      controls.update()

      /**
       * Clique no estojo dentro da cena 3D abre e fecha a tampa. Três detalhes fazem funcionar sem
       * atrapalhar a câmera: só conta como clique se o ponteiro andou menos de
       * `CLICK_DRAG_TOLERANCE_PX` (senão terminar um arrasto de órbita em cima do estojo abriria a
       * caixa, já que o botão é o mesmo); o raio testa o GRUPO inteiro, então qualquer parte visível
       * responde; e o cursor vira mãozinha, que é o que avisa que aquilo é clicável.
       */
      const raycaster = new THREE.Raycaster()
      const pointerNdc = new THREE.Vector2()
      const pointerDownAt = { x: 0, y: 0 }
      const CLICK_DRAG_TOLERANCE_PX = 5

      function apontarRaio(event: PointerEvent): void {
        const rect = renderer.domElement.getBoundingClientRect()
        pointerNdc.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        )
        raycaster.setFromCamera(pointerNdc, camera)
      }

      function caseUnderPointer(event: PointerEvent): boolean {
        const shelfCase = shelfCaseMeshRef.current
        if (!shelfCase) return false
        apontarRaio(event)
        return raycaster.intersectObject(shelfCase.group, true).length > 0
      }

      /**
       * A ponte aceita clique só na torre de ENFEITE, e a condição é dele: no modo `tower` o dado sai
       * pela boca e passa por cima do tabuleiro, então uma ponte levantada seria uma parede no
       * caminho da rolagem. `launchMode` vem da closure de montagem, e isso é correto aqui: o modo
       * está no `key` de `DiceRoller3D`, então trocá-lo já remonta a cena com o valor novo.
       */
      function bridgeUnderPointer(event: PointerEvent): boolean {
        if (launchMode !== 'towerDecor') return false
        const ponte = towerBesideRef.current?.ponte
        if (!ponte) return false
        apontarRaio(event)
        return raycaster.intersectObject(ponte.folha, true).length > 0
      }

      function handlePointerDown(event: PointerEvent) {
        pointerDownAt.x = event.clientX
        pointerDownAt.y = event.clientY
      }

      function handlePointerUp(event: PointerEvent) {
        if (event.button !== 0) return
        const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y)
        if (moved > CLICK_DRAG_TOLERANCE_PX) return
        // O estojo primeiro: os dois nunca se sobrepõem na tela hoje, mas testar em ordem evita que
        // um clique conte duas vezes no dia em que a câmera achar um ângulo em que se cruzem.
        if (caseUnderPointer(event)) onCaseClickRef.current?.()
        else if (bridgeUnderPointer(event)) onBridgeClickRef.current?.()
      }

      function handlePointerMove(event: PointerEvent) {
        if (event.buttons !== 0) return
        const clicavel = caseUnderPointer(event) || bridgeUnderPointer(event)
        renderer.domElement.style.cursor = clicavel ? 'pointer' : ''
      }

      renderer.domElement.addEventListener('pointerdown', handlePointerDown)
      renderer.domElement.addEventListener('pointerup', handlePointerUp)
      renderer.domElement.addEventListener('pointermove', handlePointerMove)

      /**
       * Câmera no teclado: W/S aproxima e afasta, A/D gira em volta da bandeja, Q/E sobe e desce. É a
       * mesma órbita do mouse — mexer no vetor `posição - alvo` e deixar o `update()` do controle
       * terminar mantém limites e damping valendo, sem duas lógicas de câmera concorrendo. As teclas
       * são lidas por `event.code` (posição física), pra ABNT2 e AZERTY continuarem com o W em cima.
       */
      const pressedKeys = new Set<string>()
      const CAMERA_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'])

      /** Digitar num campo de texto não pode mexer na câmera (o modificador da rolagem, as anotações, o nome do preset...). */
      function isTypingInField(): boolean {
        const active = document.activeElement
        return (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          (active instanceof HTMLElement && active.isContentEditable)
        )
      }

      function handleKeyDown(event: KeyboardEvent) {
        if (!CAMERA_KEYS.has(event.code) || isTypingInField()) return
        if (event.ctrlKey || event.altKey || event.metaKey) return
        /**
         * Com a aba de rolagem escondida a cena continua montada, que é o que preserva os dados ao
         * trocar de aba. Sem esta linha, um W apertado fora de um campo giraria uma câmera que
         * ninguém está vendo, e a pessoa voltaria pra aba com o enquadramento mexido.
         */
        if (!container || container.clientWidth === 0) return
        pressedKeys.add(event.code)
      }

      function handleKeyUp(event: KeyboardEvent) {
        pressedKeys.delete(event.code)
      }

      /** Solta todas as teclas quando a janela perde o foco: senão uma tecla apertada na hora de trocar de janela fica "grudada" girando a câmera pra sempre. */
      function handleWindowBlur() {
        pressedKeys.clear()
      }

      /**
       * Limite do passeio no modo mesa: sem ele, segurar o W leva o alvo pra fora do gramado e a cena
       * some do quadro sem nenhuma pista de como voltar. É o raio do tampo (`GROUND_RADIUS`), e não
       * um número escrito à mão, porque "andar pela mesa" quer dizer a mesa inteira e o número solto
       * parava antes da beirada, sem acompanhar o tampo se ele mudasse.
       */
      const TABLE_PAN_LIMIT = GROUND_RADIUS

      /** Reaproveitados a cada frame — alocar dentro do laço de animação gera lixo pro GC 60×/s. */
      const diceFocus = new THREE.Vector3()
      const cameraFrame: CameraFrame = { position: camera.position, target: controls.target }
      const cameraLimits: CameraLimits = {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
        panRadius: TABLE_PAN_LIMIT,
        /**
         * Um palmo acima do tampo, não nele: parada rente à superfície a câmera olha o gramado de
         * raspão e o tampo vira uma faixa clara ocupando a tela, o mesmo extremo degenerado que o
         * `maxPolarAngle` acima evita.
         */
        minCameraY: TABLE_SURFACE_Y + 0.5
      }

      function applyKeyboardCamera(deltaSeconds: number) {
        const mode = cameraModeRef.current

        // O modo `dice` persegue os dados sozinho, mesmo sem ninguém tocar no teclado.
        if (mode === 'dice') {
          const settled = diceRef.current.filter((die) => die.mesh.visible)
          if (settled.length > 0) {
            diceFocus.set(0, 0, 0)
            for (const die of settled) diceFocus.add(die.mesh.position)
            diceFocus.divideScalar(settled.length)
            /**
             * Persegue com suavização em vez de saltar pro ponto: pular o alvo entre dois quadros dá
             * um tranco na cena inteira, que foi o problema da recentralização automática removida.
             * Aqui ele pediu o comportamento e pode desligar trocando de modo.
             */
            controls.target.lerp(diceFocus, 0.12)
          }
        }

        if (pressedKeys.size === 0) return
        applyCameraKeys(
          cameraFrame,
          mode,
          {
            horizontal: (pressedKeys.has('KeyD') ? 1 : 0) - (pressedKeys.has('KeyA') ? 1 : 0),
            forward: (pressedKeys.has('KeyW') ? 1 : 0) - (pressedKeys.has('KeyS') ? 1 : 0),
            polar: (pressedKeys.has('KeyE') ? 1 : 0) - (pressedKeys.has('KeyQ') ? 1 : 0)
          },
          deltaSeconds,
          cameraLimits
        )
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('blur', handleWindowBlur)

      function resize() {
        if (!container) return
        const { clientWidth, clientHeight } = container
        /**
         * Tamanho zero acontece de verdade: trocar de aba esconde a cena com `display: none` e o
         * container mede 0×0. Sem a guarda, `aspect` vira NaN e envenena a matriz de projeção, e o
         * quadro seguinte, já com a aba visível, sai em branco até o próximo redimensionamento.
         */
        if (clientWidth === 0 || clientHeight === 0) return
        /**
         * `false` no terceiro argumento: o three não escreve `width`/`height` inline no canvas. Com o
         * estilo inline o canvas ganhava altura própria em pixels, vencia o `height: 100%` do CSS e,
         * com o contêiner crescendo com o conteúdo, era o CANVAS que ditava a altura: o
         * `ResizeObserver` lia a altura nova, aumentava o canvas, e a cena crescia a cada quadro
         * (medido: 533px → 773px). Só a resolução muda aqui; o tamanho na tela é do layout.
         */
        renderer.setSize(clientWidth, clientHeight, false)
        camera.aspect = clientWidth / clientHeight
        camera.updateProjectionMatrix()
      }
      resize()
      const resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)

      let world: RAPIER.World | null = null
      let stepPhysics: ((deltaSeconds: number) => number) | null = null
      const hud: DiceDebugHud | null = debugMode ? createDiceDebugHud(container) : null
      hudRef.current = hud
      let fpsSmoothed = 60

      function maybeReportResult() {
        if (!armedRef.current) return
        const dice = diceRef.current
        if (dice.length === 0) return
        if (!dice.every((die) => die.phase === 'done' && die.lastValue !== null)) return

        const rolls: DieResult[] = dice.map((die) => ({ sides: die.sides, value: die.lastValue as number }))
        const total = rolls.reduce((sum, r) => sum + r.value, 0)
        onResultRef.current?.({ rolls, total })
      }


      function updateDieDebug(die: DieInstance) {
        if (!die.debug) return
        const definition = DICE_REGISTRY[die.sides].definition
        const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
        die.debug.visuals.updateReading(reading)
        die.debug.updateRow({
          sides: die.sides,
          phaseLabel: die.phase === 'done' ? 'assentado' : die.phase,
          reading,
          body: die.body
        })
      }

      function updateDie(die: DieInstance, simulatedSeconds: number) {
        clampLinearVelocity(die.body, WORLD_CONFIG.maxLinearSpeed)
        syncMeshToBody(die.mesh, die.body)
        updateDieDebug(die)

        /**
         * Na fila da boca da torre: parado e invisível até a vez dele, e aí SAI — visível, com
         * colisão de volta e já rolando pra dentro do hexágono. Daí em diante é um dado de bandeja
         * como outro qualquer; ele nunca passa por dentro da torre.
         */
        if (die.phase === 'queued') {
          if (die.releaseAtMs === undefined || sceneElapsedMsRef.current < die.releaseAtMs) return
          die.mesh.visible = true
          tossDieFromMouth(die.body, {
            target: die.spawnSlot,
            sides: traySides,
            // Raio circunscrito DESTE tipo, pra ele nascer apoiado no tabuleiro da ponte em vez de
            // enterrado nele até o meio (ver `MouthTossOptions.radius`).
            radius: DICE_REGISTRY[die.sides].definition.scale * DICE_REGISTRY[die.sides].definition.boundingRadius
          })
          die.tracker.reset()
          die.phase = 'rolling'
          die.enteringElapsedMs = 0
          die.releaseAtMs = undefined
          return
        }

        // Acumula o tempo simulado na fase "entrando" pro teto de `restoreWallCollisionIfInside`
        // (ver `ENTRY_FORCE_PUSH_TIMEOUT_MS`). Zera assim que o dado sai dessa fase; sem efeito pros
        // dados da torre, que nunca entram em `DICE_ENTERING_GROUPS`.
        const isEntering =
          die.body.numColliders() > 0 && die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
        if (isEntering) die.enteringElapsedMs += simulatedSeconds * 1000
        restoreWallCollisionIfInside(die.body, die.enteringElapsedMs, traySides, simulatedSeconds * 1000)
        if (
          die.body.numColliders() > 0 &&
          die.body.collider(0).collisionGroups() !== diceEnteringCollisionGroups()
        ) {
          die.enteringElapsedMs = 0
        }
        if (die.phase !== 'rolling') return

        const state = die.tracker.update(die.body, simulatedSeconds * 1000)
        if (state === 'settled') {
          const definition = DICE_REGISTRY[die.sides].definition
          const reading = readTopFace(definition, die.body.rotation(), resolveAmbiguousMargin(definition))
          if (reading.isAmbiguous) {
            applyNudge(die.body)
            die.tracker.reset()
          } else {
            die.phase = 'done'
            die.lastValue = reading.value
            maybeReportResult()
          }
        } else if (state === 'stuck') {
          applyNudge(die.body)
          die.tracker.reset()
        }
      }

      let frameId: number
      let lastFrameTime = performance.now()
      /** Último instante em que a cena foi DESENHADA (ver o teto de quadros abaixo). */
      let ultimoDesenhoMs = 0
      /**
       * A sombra precisa ser refeita neste quadro? Começa ligada e volta a ligar sempre que algo que
       * projeta sombra se mexe: enquanto há dado rolando, e uma última vez quando o último assenta.
       */
      let precisaDeSombra = true
      let estavaRolando = false
      /**
       * Quem está se mexendo agora, a pergunta que decide quanto este quadro custa: os `rolling`,
       * mais os `queued` que JÁ TÊM hora de sair. Não dá pra escrever `phase !== 'done'`, que era a
       * versão óbvia: no modo torre os dados nascem `queued` e ficam parqueados, fora da simulação,
       * até alguém rolar, e com aquele teste a torre nunca sairia do modo caro.
       */
      function temDadoSeMexendo(): boolean {
        return diceRef.current.some(
          (die) => die.phase === 'rolling' || (die.phase === 'queued' && die.releaseAtMs !== undefined)
        )
      }

      function tick() {
        const now = performance.now()
        const deltaSeconds = (now - lastFrameTime) / 1000
        lastFrameTime = now

        /**
         * A cena está na tela? `display: none` deixa `clientWidth` em zero, e é assim que a aba de
         * rolagem some sem ser desmontada. Isto era consultado só na hora de DESENHAR, e o resto do
         * quadro rodava igual: medido no app instalado, 5,4% de CPU na aba Ficha e 3,0% nas
         * Anotações, com a cena invisível e ninguém mexendo em nada. É o "pequeno lag em tudo" que
         * ele descreveu.
         */
        const visivel = !!container && container.clientWidth > 0 && container.clientHeight > 0
        const rolando = temDadoSeMexendo()

        /**
         * Física só enquanto há dado se mexendo, e aí sim mesmo com a aba escondida: quem rola e troca
         * de aba no meio quer voltar e achar o resultado pronto, não os dados congelados no ar. A
         * economia é a outra metade — com tudo parado, `world.step()` e o laço de `updateDie` (até
         * vinte dados) rodavam 165 vezes por segundo pra concluir que nada mudou.
         */
        if (rolando && stepPhysics) {
          const simulatedSeconds = stepPhysics(deltaSeconds)
          for (const die of diceRef.current) updateDie(die, simulatedSeconds)
        }

        /**
         * Escondida: acaba aqui. O que sobra do quadro é animação e desenho, e bandeira tremulando
         * atrás de um `display: none` é trabalho puro. O laço continua vivo porque precisa estar de
         * pé no quadro em que a aba voltar, e um `tick` que só compara duas coisas é de graça.
         */
        if (!visivel) {
          frameId = requestAnimationFrame(tick)
          return
        }

        /**
         * Teto de quadros. Antes disto a cena era desenhada a cada quadro do `requestAnimationFrame`,
         * que é a taxa do monitor: no dele, 164 renderizações por segundo de uma cena com sombra e
         * reflexo, com os dados parados. Isso mantém a GPU sob carga constante, e foi assim que ele
         * percebeu — um chiado que só existia na aba de rolagem.
         *
         * Três taxas: dado em movimento e mexida na câmera pedem a taxa cheia (senão o arrasto fica
         * travado na mão); cena parada vai a 30, de sobra pra bandeira e respiração.
         *
         * O teto governa TAMBÉM as animações: elas ficavam de fora e eram recalculadas 165 vezes por
         * segundo pra serem desenhadas 30. A física continua fora dele, de propósito — limitar o
         * desenho é economia, limitar a simulação mudaria o comportamento.
         */
        const mexendoNaCamera = now - ultimaInteracaoMs < 400
        const alvoFps = rolando || mexendoNaCamera ? FPS_ATIVO : FPS_PARADO
        if (now - ultimoDesenhoMs < 1000 / alvoFps - 1) {
          frameId = requestAnimationFrame(tick)
          return
        }

        if (hud && deltaSeconds > 0) {
          // Suavizado (média móvel exponencial) — o FPS instantâneo cru pula demais
          // frame a frame pra ser legível num overlay de texto.
          fpsSmoothed = fpsSmoothed * 0.9 + (1 / deltaSeconds) * 0.1
          hud.updateFps(fpsSmoothed)
        }

        // Abertura da tampa do estojo: puramente visual, fora da física. `deltaSeconds` limitado pra
        // um quadro longo (janela minimizada, aba trocada) não pular a animação inteira de uma vez.
        const shelfCase = shelfCaseMeshRef.current
        if (shelfCase) {
          sceneElapsedMsRef.current += Math.min(deltaSeconds, 0.1) * 1000
          const animation = lidAnimationRef.current
          if (animation) {
            lidProgressRef.current = lidProgressAt(animation, sceneElapsedMsRef.current)
            if (sceneElapsedMsRef.current - animation.startMs >= CASE_LID_OPEN_DURATION_MS) {
              lidProgressRef.current = animation.to
              lidAnimationRef.current = null
            }
          }
          shelfCase.lidPivot.rotation.x = -CASE_LID_OPEN_ANGLE * lidProgressRef.current
        }

        /**
         * Ponte levadiça, no mesmo lugar e pelo mesmo motivo da tampa. O `sceneElapsedMsRef` não é
         * adiantado aqui: quem faz isso é o bloco da tampa, uma vez por quadro. Adiantar de novo
         * faria as duas animações correrem em dobro nos quadros em que os dois existem.
         */
        const ponte = towerBesideRef.current?.ponte
        if (ponte) {
          const animacao = bridgeAnimationRef.current
          if (animacao) {
            bridgeProgressRef.current = lidProgressAt(animacao, sceneElapsedMsRef.current)
            if (sceneElapsedMsRef.current - animacao.startMs >= CASE_LID_OPEN_DURATION_MS) {
              bridgeProgressRef.current = animacao.to
              bridgeAnimationRef.current = null
            }
            ponte.definirAbertura(bridgeProgressRef.current)
          }
        }

        /**
         * Bandeira da torre tremulando, no mesmo relógio da respiração da pelúcia logo abaixo. Sem
         * `if` de modo: quando o lançamento é pela bandeja a torre nem existe e o `?.` cobre isso, e
         * ela balança nos dois modos com torre, inclusive no de enfeite — pano parado é o que faz
         * cenário parecer maquete.
         */
        towerBesideRef.current?.update(sceneElapsedMsRef.current / 1000)

        /**
         * Respiração da pelúcia: sobe e desce alguns milímetros e balança um tiquinho, bem devagar.
         * Amplitude minúscula de propósito, pra não competir com os dados pela atenção.
         *
         * A altura de repouso é guardada uma vez (`userData.restY`) e a respiração é um deslocamento
         * em cima dela. Esta linha já ATRIBUIU `position.y`, jogando fora a altura da montagem e
         * prendendo a pelúcia oscilando em torno de y=0, que é o chão da bandeja: depois que a mesa
         * foi rebaixada, o boneco pairava 0.78 acima do gramado. Foram seis reportes de "o plush está
         * flutuando", e nada podia funcionar, porque tudo era sobrescrito no quadro seguinte.
         */
        const plush = plushRef.current
        if (plush) {
          const breath = sceneElapsedMsRef.current / 1000
          const restY = plush.userData.restY as number
          plush.position.y = restY + Math.sin(breath * 1.6) * 0.015
          plush.rotation.z = Math.sin(breath * 0.8) * 0.02
        }

        // Nada mexe em `controls.target` sozinho aqui: a câmera só muda se o usuário arrastar ou usar
        // o teclado (ver a recentralização removida, no topo do arquivo, e `applyKeyboardCamera`).
        applyKeyboardCamera(Math.min(deltaSeconds, 0.1))
        controls.update()
        ultimoDesenhoMs = now
        /**
         * A sombra é refeita enquanto os dados se mexem e mais uma vez no quadro seguinte ao último
         * assentar, que é a que registra a sombra deles parados onde caíram.
         */
        if (rolando || estavaRolando) precisaDeSombra = true
        estavaRolando = rolando
        // A tampa do estojo abrindo/fechando move geometria por vários quadros seguidos.
        if (lidAnimationRef.current) precisaDeSombra = true
        // Mesma razão da tampa: a ponte projeta sombra, e o mapa não se refaz sozinho a cada quadro.
        if (bridgeAnimationRef.current) precisaDeSombra = true
        // E qualquer mexida na cena vinda de fora do laço (dado somado, forma trocada).
        if (precisaDeSombraRef.current) {
          precisaDeSombra = true
          precisaDeSombraRef.current = false
        }

        renderer.shadowMap.needsUpdate = precisaDeSombra
        precisaDeSombra = false

        renderer.render(scene, camera)
        frameId = requestAnimationFrame(tick)
      }
      tick()

      ensureRapierReady()
        .then(() => {
          if (disposed) return
          /**
           * Mundo igual nos dois modos: `TOWER_CONFIG.gravity` e `createTowerColliders` existiam pro
           * dado cair por dentro da torre, batendo nas prateleiras; hoje ele só sai pela boca e rola
           * na bandeja de sempre. O que muda entre os modos é só de onde o dado é lançado.
           */
          world = createPhysicsWorld()
          worldRef.current = world
          createBoundaryColliders(world, traySides)

          const sidesList = flattenGroups(groups)
          const slots = computeSpawnSlots(sidesList.length, traySafeHalfExtent(traySides, SPAWN_CONFIG.slotSafeHalfExtent))

          diceRef.current = sidesList.map((sides, i) => {
            const entry = DICE_REGISTRY[sides]
            const body = entry.createBody(world as RAPIER.World)
            const colors = diceColors[sides]
            const mesh = entry.buildVisual({
              bodyColor: colors?.bodyColor,
              numberColor: colors?.numberColor,
              material,
              textureCache: mountTextureCache
            })
            scene.add(mesh)

            const debug = hud
              ? { visuals: createDiceDebugVisuals(entry.definition, mesh), updateRow: hud.addDieRow() }
              : undefined

            if (lancaPelaBoca) {
              const die: DieInstance = {
                sides,
                body,
                mesh,
                tracker: createSettleTracker(),
                phase: 'queued',
                lastValue: null,
                spawnSlot: slots[i],
                enteringElapsedMs: 0,
                debug
              }
              parkTowerDie(die)
              // Só enfileira pra sair de verdade numa rolagem de verdade (`autoRoll`): troca de tipo,
              // cor ou modo remonta a cena sem ninguém ter pedido rolagem nenhuma.
              if (autoRoll) die.releaseAtMs = i * MOUTH_RELEASE_INTERVAL_MS
              return die
            }

            const spawnSlot = slots[i]
            if (autoRoll) {
              tossDie(body, { target: spawnSlot, sides: traySides })
            } else {
              // Sem arremesso de intro: o dado aparece já parado no próprio slot, caindo uma
              // distância mínima até assentar (nunca "entrando" de fora, então nasce no grupo normal).
              const [qx, qy, qz, qw] = randomQuaternion()
              body.setTranslation({ x: spawnSlot.x, y: 1.5, z: spawnSlot.z }, true)
              body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)
            }

            return {
              sides,
              body,
              mesh,
              tracker: createSettleTracker(),
              phase: 'rolling' as const,
              lastValue: null,
              spawnSlot,
              enteringElapsedMs: 0,
              debug
            }
          })

          stepPhysics = createPhysicsStepper(world)
        })
        .catch((error: unknown) => {
          console.error('Falha ao inicializar o Rapier (física 3D):', error)
          onErrorRef.current?.(error)
        })

      return () => {
        disposed = true
        cancelAnimationFrame(frameId)
        resizeObserver.disconnect()
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
        renderer.domElement.removeEventListener('pointerup', handlePointerUp)
        renderer.domElement.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
        window.removeEventListener('blur', handleWindowBlur)
        controls.dispose()
        for (const die of diceRef.current) die.debug?.visuals.dispose()
        // shelfMeshesRef/shelfCaseMeshRef não precisam de descarte à parte: ainda presos na cena, o
        // `disposeScene` logo abaixo percorre e libera todo mesh dela, inclusive dentro do grupo do
        // estojo. Mesma convenção do mesh de cada dado.
        shelfMeshesRef.current = []
        shelfCaseMeshRef.current = null
        hud?.dispose()
        hudRef.current = null
        environment.dispose()
        disposeScene(scene)
        renderer.dispose()
        container.removeChild(renderer.domElement)
        diceRef.current = []
        sceneRef.current = null
        trayRef.current = null
        towerBesideRef.current = null
        world?.free()
        worldRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * Resincroniza só os dados, sem remontar cena, física e renderer, quando a COMPOSIÇÃO da rolagem
     * muda (somar ou tirar tipo, ajustar quantidade, alternar vantagem). Por isso `groups` não está
     * mais no `key` de `DiceRoller3D.tsx`. Rolagem de preset continua remontando de verdade
     * (`presetRollSeq` segue no `key`): ela precisa nascer já arremessada (`autoRoll`), e o mount
     * original já resolve isso.
     *
     * Medido ao vivo: cada dado adicionado remontava a cena inteira — renderer e contexto WebGL
     * novos (~200ms só de compilação de shader), mundo físico novo, prateleira redesenhada. Vale nos
     * dois modos, já que hoje eles compartilham bandeja, mundo e colisores.
     *
     * O dado novo aparece PARADO no slot: no modo torre ele só passa pela boca quando alguém rola de
     * verdade, senão clicar em "+1 dado" viraria uma rolagem que ninguém pediu.
     */
    const isFirstGroupsSyncRef = useRef(true)
    const groupsSignature = JSON.stringify(groups)
    useEffect(() => {
      if (isFirstGroupsSyncRef.current) {
        isFirstGroupsSyncRef.current = false
        return
      }
      const world = worldRef.current
      const scene = sceneRef.current
      if (!world || !scene) return

      // Os dados na bandeja vão mudar: a sombra da vez anterior não vale mais.
      precisaDeSombraRef.current = true

      for (const die of diceRef.current) {
        die.debug?.visuals.dispose()
        scene.remove(die.mesh)
        disposeMesh(die.mesh)
        world.removeRigidBody(die.body)
      }

      const sidesList = flattenGroups(groups)
      const slots = computeSpawnSlots(sidesList.length, traySafeHalfExtent(traySides, SPAWN_CONFIG.slotSafeHalfExtent))
      const hud = hudRef.current
      const colors = diceColorsRef.current
      const currentMaterial = materialRef.current
      const textureCache = getGlobalDiceTextureCache()

      diceRef.current = sidesList.map((sides, i) => {
        const entry = DICE_REGISTRY[sides]
        const body = entry.createBody(world)
        const dieColors = colors[sides]
        const mesh = entry.buildVisual({
          bodyColor: dieColors?.bodyColor,
          numberColor: dieColors?.numberColor,
          material: currentMaterial,
          textureCache
        })
        scene.add(mesh)

        const debug = hud
          ? { visuals: createDiceDebugVisuals(entry.definition, mesh), updateRow: hud.addDieRow() }
          : undefined

        // Mesmo posicionamento "sem arremesso cosmético" já usado pelo mount original pra troca
        // manual de tipo/quantidade (ver comentário lá) — o dado só aparece já parado no slot.
        const spawnSlot = slots[i]
        const [qx, qy, qz, qw] = randomQuaternion()
        body.setTranslation({ x: spawnSlot.x, y: 1.5, z: spawnSlot.z }, true)
        body.setRotation({ x: qx, y: qy, z: qz, w: qw }, true)

        return {
          sides,
          body,
          mesh,
          tracker: createSettleTracker(),
          phase: 'rolling' as const,
          lastValue: null,
          spawnSlot,
          enteringElapsedMs: 0,
          debug
        }
      })

      // Resincronizar não é uma rolagem pedida, só mudou a composição. Sem isto, com `armedRef` já
      // `true` de uma rolagem anterior (ele nunca volta sozinho), os dados novos assentando da queda
      // mínima disparariam um `onResult` fantasma.
      armedRef.current = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupsSignature, launchMode])

    /**
     * Botão de abrir/fechar o estojo: agenda a animação a partir do estado ATUAL da tampa (não
     * de 0 ou 1), pra clicar no meio de uma abertura inverter o movimento de onde ele está, sem
     * salto. Não roda na primeira passada — o mount já agenda a animação de entrada.
     */
    const isFirstCaseToggle = useRef(true)
    useEffect(() => {
      if (isFirstCaseToggle.current) {
        isFirstCaseToggle.current = false
        return
      }
      const target = caseOpen ? 1 : 0
      if (lidProgressRef.current === target && !lidAnimationRef.current) return
      lidAnimationRef.current = {
        from: lidProgressRef.current,
        to: target,
        startMs: sceneElapsedMsRef.current
      }
    }, [caseOpen])

    /**
     * Abrir e fechar a ponte, com a coreografia da tampa: parte do estado ATUAL, pra clicar no meio
     * do movimento inverter sem salto. Não precisa da guarda de primeira passada que a tampa tem: a
     * ponte nasce abaixada e sem animação de entrada, então a primeira execução já cai no `return`.
     */
    useEffect(() => {
      const alvo = ponteAbaixada ? 1 : 0
      if (bridgeProgressRef.current === alvo && !bridgeAnimationRef.current) return
      bridgeAnimationRef.current = {
        from: bridgeProgressRef.current,
        to: alvo,
        startMs: sceneElapsedMsRef.current
      }
    }, [ponteAbaixada])

    const isFirstColorUpdate = useRef(true)
    useEffect(() => {
      // Roda quando cor ou acabamento mudam, mas não na primeira execução: o mount acima já criou
      // tudo com o valor certo.
      if (isFirstColorUpdate.current) {
        isFirstColorUpdate.current = false
        return
      }

      /**
       * A cor não está mais no `key` do componente (ver `DiceRoller3D.tsx`). Quando estava, cada
       * mudança — inclusive cada evento `input` do arraste no seletor nativo, dezenas por segundo —
       * desmontava cena, física e corpos e montava tudo de novo, com arremesso incluído: era o "os
       * dados ficam se mexendo sozinhos" enquanto você só queria mudar uma cor. Hoje só o mesh visual
       * é reconstruído, com a física intacta.
       *
       * O debounce é o resto: reconstruir gera uma `CanvasTexture` por face (até 100 no d100) de cada
       * dado, trabalho síncrono na thread principal a cada evento do arraste. Reconstruindo só depois
       * do último evento, o arraste fica liso e a cor final entra quando ele para — o próprio seletor
       * já dá o feedback instantâneo.
       */
      const timeoutId = window.setTimeout(() => {
        const scene = sceneRef.current
        if (!scene) return

        /**
         * As cores mudaram de verdade (é por isso que o efeito disparou), então o cache global guarda
         * texturas das antigas: descarta antes de reconstruir. Sem isso, cada cor experimentada na
         * aba Estilo ficaria acumulada pra sempre.
         */
        clearDiceTextureCache()
        const rebuildTextureCache = getGlobalDiceTextureCache()

        // Parede, fundo e chão também no lugar, nunca por remount. A cor da TORRE não está aqui: ela
        // tem efeito próprio, logo abaixo.
        const wall = wallColor ?? DEFAULT_WALL_COLOR
        const background = backgroundColor ?? DEFAULT_BACKGROUND_COLOR
        const floor = floorColor ?? DEFAULT_FLOOR_COLOR
        const image = backgroundImage ?? null
        trayRef.current?.updateColors(wall, background, floor, image)

        for (const die of diceRef.current) {
          const entry = DICE_REGISTRY[die.sides]
          const colors = diceColors[die.sides]
          const newMesh = entry.buildVisual({
            bodyColor: colors?.bodyColor,
            numberColor: colors?.numberColor,
            material,
            textureCache: rebuildTextureCache
          })
          syncMeshToBody(newMesh, die.body)
          newMesh.visible = die.mesh.visible

          scene.remove(die.mesh)
          disposeMesh(die.mesh)
          scene.add(newMesh)

          if (die.debug) {
            die.debug.visuals.dispose()
            die.debug.visuals = createDiceDebugVisuals(entry.definition, newMesh)
          }

          die.mesh = newMesh
        }

        // Prateleira decorativa (ver criação no efeito de mount acima) — reconstruída igual
        // aos dados de verdade, mesma cor/acabamento, mesmas posições fixas de sempre.
        if (shelfMeshesRef.current.length > 0) {
          const positions = computeShelfPositions()
          shelfMeshesRef.current = AVAILABLE_DICE_TYPES.map((sides, i) => {
            const entry = DICE_REGISTRY[sides]
            const colors = diceColors[sides]
            const newMesh = entry.buildVisual({
              bodyColor: colors?.bodyColor,
              numberColor: colors?.numberColor,
              material,
              textureCache: rebuildTextureCache
            })
            assentarDadoDaPrateleira(newMesh, entry.definition, positions[i])

            const oldMesh = shelfMeshesRef.current[i]
            scene.remove(oldMesh)
            disposeMesh(oldMesh)
            scene.add(newMesh)
            return newMesh
          })

          /**
           * O estojo só troca de COR (`updateColors`). Antes ele era jogado fora e reconstruído
           * inteiro aqui, e com isso vinham dois remendos: recolocar a tampa no ângulo em que já
           * estava (senão ela piscava fechada) e devolver o grupo pra `TABLE_SURFACE_Y` (senão os
           * dados da prateleira ficavam pendurados por baixo dele). Sem reconstrução, nada disso pode
           * acontecer.
           */
          shelfCaseMeshRef.current?.updateColors(floor, wall)
        }
      }, COLOR_UPDATE_DEBOUNCE_MS)

      return () => window.clearTimeout(timeoutId)
       
    }, [diceColors, material, wallColor, backgroundColor, floorColor, backgroundImage])

    /**
     * Cor da torre em efeito próprio. Ela morava no efeito acima, que não depende de `towerColors`,
     * então mudar só a pedra não repintava nada até alguma outra cor mudar junto. Separado, e não
     * somado às dependências de lá, porque aquele efeito limpa o cache de textura e reconstrói todos
     * os dados; a torre só precisa de uma escrita em `material.color`. As dependências são os quatro
     * campos, e não o objeto: ele é montado inline no `DiceRoller3D`, ou seja, referência nova a
     * cada render.
     */
    useEffect(() => {
      towerBesideRef.current?.updateColors(towerColorsRef.current)
    }, [towerColors.stone, towerColors.roof, towerColors.flag, towerColors.door])

    return <div ref={containerRef} className="dice-canvas-container" />
  }
)
