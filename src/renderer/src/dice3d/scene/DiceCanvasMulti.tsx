import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { createCamera } from './createCamera'
import { CAMERA_CONFIG, TOWER_CAMERA_CONFIG } from '../config/sceneConfig'
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
import { createTowerScene, type TowerSceneHandle } from './createTowerScene'
import { createRiebeckPlush } from './createRiebeckPlush'
import { TOWER_TOP_Y } from '../geometry/buildTowerBaffles'
import type { DiceMaterialFinish } from '../materials/createDiceMaterial'
import type { CameraMode } from '@renderer/settings/SettingsContext'
import {
  applyCameraKeys,
  type CameraFrame,
  type CameraLimits,
  type CameraSpeeds
} from './applyCameraKeys'
import { setupDiceEnvironment } from './createDiceEnvironment'
import { disposeScene, disposeMesh } from './disposeScene'
import { ensureRapierReady } from '../physics/rapierContext'
import { createPhysicsWorld } from '../physics/createPhysicsWorld'
import { createBoundaryColliders } from '../physics/createBoundaryColliders'
import { createTowerColliders } from '../physics/createTowerColliders'
import { createPhysicsStepper } from '../physics/createPhysicsStepper'
import { syncMeshToBody } from '../physics/syncMeshToBody'
import { createSettleTracker, type SettleTracker } from '../physics/createSettleTracker'
import { createDescentProgressTracker, type DescentProgressTracker } from '../physics/createDescentProgressTracker'
import { applyNudge } from '../physics/applyNudge'
import { applyTowerStuckNudge } from '../physics/applyTowerStuckNudge'
import { tossDie } from '../physics/tossDie'
import { dropDieIntoTower } from '../physics/dropDieIntoTower'
import { randomQuaternion } from '../utils/random'
import { regularPolygonCircumradius } from '../physics/regularPolygon'
import {
  restoreWallCollisionIfInside,
  exitTowerIfDescended,
  parkedCollisionGroups,
  diceEnteringCollisionGroups
} from '../physics/collisionGroups'
import { clampLinearVelocity } from '../physics/clampVelocity'
import { computeSpawnSlots } from '../physics/computeSpawnSlots'
import { readTopFace } from '../faceReading/readTopFace'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  TOWER_CONFIG,
  TRAY_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'
import { getGlobalDiceTextureCache, clearDiceTextureCache } from '../materials/textureCache'
import { createDiceDebugVisuals, type DiceDebugVisuals } from '../debug/createDiceDebugVisuals'
import { createDiceDebugHud, type DiceDebugHud, type DieDebugSnapshot } from '../debug/DiceDebugHud'
import './DiceCanvas.css'

/** Ver comentário grande no efeito de troca de cor mais abaixo. */
const COLOR_UPDATE_DEBOUNCE_MS = 120

/**
 * RECENTRALIZAÇÃO AUTOMÁTICA DA CÂMERA — REMOVIDA (ficava aqui uma animação que movia
 * `controls.target` pra cima de onde os dados assentavam).
 *
 * Motivo, medido ao vivo com capturas antes/depois da mesma rolagem: mover o alvo da órbita não
 * é "só olhar pra outro ponto". O enquadramento da cena inteira desabava — a bandeja aparecia
 * rasa, quase de perfil, às vezes escondida atrás da própria parede — e o desvio se mantinha
 * pelas rolagens seguintes. Testado isolando a variável: limitando o deslocamento a 1 unidade
 * o quadro AINDA desabava; só com deslocamento ZERO (alvo sempre no enquadramento padrão) o
 * quadro antes e depois da rolagem fica idêntico, rolagem após rolagem.
 *
 * A intenção original (ver os dados que pousaram longe do centro) continua atendida pela órbita
 * MANUAL, que nunca deixou de funcionar: arrastar na cena gira/aproxima como sempre, e agora
 * nada mexe na câmera pelas costas do usuário.
 */

/**
 * Escala da mini pelúcia do Riebeck na cena (ver `createRiebeckPlush`, modelada com ~1.5 de
 * altura) — do tamanho de um dado, não de um móvel. 0.45 → 0.36 → 0.27 em dois pedidos seguidos de
 * "faz ele menor", somando com as idas pra ponta da mesa: junto, as duas coisas deixam ela quase
 * metade do tamanho na tela do que era.
 *
 * O tamanho também entra na conta de ficar ESCONDIDA atrás da tampa do estojo (ver a posição
 * abaixo): em 0.30 a pontinha do capacete ainda passava por cima da tampa.
 */
const PLUSH_SCALE = 0.27

/**
 * Quanto a pelúcia desce ABAIXO da superfície da mesa, além do assentamento que o próprio modelo
 * já faz (`SIT_DEPTH` em `createRiebeckPlush.ts`).
 *
 * ZERO: o assentamento do próprio modelo basta. Este número chegou a 0.5 enquanto o usuário pedia
 * "desce mais" e nada acontecia — mas a causa era a respiração sobrescrevendo `position.y` (ver o
 * comentário grande no laço de animação), não falta de afundamento. Corrigido aquilo, qualquer
 * valor aqui enterraria o boneco de verdade.
 *
 * Fica como constante mesmo em zero por ser o lugar certo pra esse ajuste, caso um dia se queira:
 * é gosto de quem olha a cena, separado da geometria do modelo.
 */
const PLUSH_SINK = 0

/**
 * A cena não tem unidade declarada, então "2cm" precisa de uma âncora — e a melhor é o próprio
 * dado: um d20 aqui tem 0.56 de lado (`DICE_REGISTRY[20].definition.scale`) e um d20 de verdade tem
 * uns 2cm de face a face. Logo 2cm ≈ 0.56 unidade, e 1 unidade ≈ 3.6cm.
 *
 * Ancorar no dado e não na bandeja é de propósito: o dado é o objeto desta cena cujo tamanho real
 * todo mundo conhece.
 */
const CENTIMETER = 0.56 / 2

/** Alinhada com o CENTRO do estojo, que é simétrico em x (medido: de -4.86 a 4.86). */
const PLUSH_X = 0

/**
 * Z da pelúcia pra ela ficar EXATAMENTE atrás do estojo, com 1cm de folga entre as duas — pedido do
 * usuário (foram 2cm na primeira tentativa, "diminui para 1cm"). Os números vêm de medir os dois
 * objetos montados, não de tentativa:
 *
 * - o estojo vai de z = -10.69 a z = -9.33 (fundo dele em `zEstojo - 0.685`);
 * - a pelúcia é simétrica em z e, na escala da cena (`PLUSH_SCALE`), tem 0.48 de profundidade,
 *   ou seja 0.24 do centro até a barriga.
 *
 * Então: fundo do estojo − 1cm − meia pelúcia. Fica escondida da câmera padrão (ela tem 0.53 de
 * altura contra 1.22 do estojo), que é a intenção desde que ela virou easter egg — só aparece pra
 * quem gira a câmera pra trás.
 */
const PLUSH_GAP_CM = 1
const CASE_HALF_DEPTH = 0.685
const PLUSH_HALF_DEPTH = 0.892 * PLUSH_SCALE

function plushZBehindCase(caseZ: number): number {
  return caseZ - CASE_HALF_DEPTH - PLUSH_GAP_CM * CENTIMETER - PLUSH_HALF_DEPTH
}

/**
 * Ficou DESLIGADA um tempo a pedido do usuário — o modelo não estava bom o bastante ("achei
 * feio"). Religada depois da terceira versão do boneco, que foi refeita comparando com as FOTOS
 * do produto em `riebeck/` em vez de de memória (as duas primeiras tinham traje marrom e capacete
 * oliva com visor; a pelúcia real é corpo pêssego com cúpula amarela de quatro olhos bordados).
 * Se ainda assim não agradar, virar isto pra `false` tira a pelúcia da mesa sem mexer em mais nada.
 */
const SHOW_PLUSH = true

export type LaunchMode = 'tray' | 'tower'

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
   * Chamado se a cena falhar ao inicializar (Rapier ou criação de algum dado). Sem isso o
   * app ficava travado em "Rolando..." pra sempre com só um `console.error` invisível pro
   * usuário — script.md exige que falhas críticas sejam visíveis, nunca silenciosas.
   */
  onError?: (error: unknown) => void
  /**
   * Se `true`, o arremesso automático do primeiro mount já conta como uma rolagem de
   * verdade (relata resultado ao assentar) — usado pelo clique num preset, que É a própria
   * ação de rolar, sem um segundo clique em "Rolar" depois. Se ausente/`false` (troca de
   * tipo/quantidade/modo/cor/debug), o arremesso do mount é só visual (ver `armedRef`
   * abaixo). Lido só uma vez, no mount — mesma convenção de `groups`/`bodyColor`.
   */
  autoRoll?: boolean
  /**
   * Cor do corpo/número resolvida POR TIPO de dado (chave = lados) — já mescla a cor global
   * com qualquer override individual (ver `SettingsContext.diceColorOverrides`), sempre com
   * uma entrada pra cada tipo em `AVAILABLE_DICE_TYPES`; quem monta isso é `DiceRoller3D.tsx`.
   * Usado tanto pelos dados de verdade quanto pela prateleira decorativa.
   */
  diceColors: Record<number, { bodyColor: number; numberColor: string }>
  /** Acabamento (Preferências ⚙️: fosco/metálico/plástico/vidro). Mesma convenção de `diceColors` — atualizado em cima do mesh existente, não força remount. */
  material?: DiceMaterialFinish
  /** Cor da parede da bandeja (hex numérico). Mesma convenção de `bodyColor` — atualizado em cima da cena existente, não força remount. */
  wallColor?: number
  /** Cor de fundo da cena (hex numérico). Mesma convenção de `bodyColor`. */
  backgroundColor?: number
  /** Cor do chão da bandeja (hex numérico). Mesma convenção de `wallColor`. */
  floorColor?: number
  /** Imagem de fundo da cena (data URL) — `null`/ausente usa `backgroundColor` sólida. Mesma convenção de no-remount de `wallColor`. */
  backgroundImage?: string | null
  /**
   * Modo de lançamento: bandeja aberta (arremesso de fora, padrão) ou torre de castelo (prateleiras
   * inclinadas alternadas, física real, ver `TOWER_CONFIG`). Estrutural — muda a cena/física
   * inteira, então precisa estar no `key` do componente pai (`DiceRoller3D.tsx`), igual `debugMode`.
   */
  launchMode?: LaunchMode
  /** Modo debug (Seção 25 do script.md): colisores, normais de face, confiança, velocidade e FPS sobrepostos à cena. */
  debugMode?: boolean
  /**
   * Estojo de dados atrás da bandeja aberto (`true`, padrão) ou fechado — controlado pelo botão
   * na barra do roller. Anima em cima da cena existente, NUNCA remonta nada (não entra no `key`
   * de `DiceRoller3D.tsx`): abrir e fechar a caixinha não pode custar uma cena 3D nova.
   */
  caseOpen?: boolean
  /**
   * Chamado quando o usuário CLICA no estojo dentro da cena 3D — pedido do usuário, que quer
   * abrir/fechar clicando na caixinha em si, não só no botão. Quem decide o que fazer é o pai
   * (que é dono do estado `caseOpen`); aqui só se detecta o clique.
   */
  onCaseClick?: () => void
  /**
   * Como o WASD dirige a câmera (ver `CameraMode` em `SettingsContext.tsx`). NÃO entra no `key` de
   * remount: trocar de modo não pode custar uma cena 3D nova.
   */
  cameraMode?: CameraMode
}

interface DieInstance {
  sides: PhysicalDiceSides
  body: RAPIER.RigidBody
  mesh: THREE.Mesh
  tracker: SettleTracker
  /** Só usado no modo torre — dado ainda dentro da torre, caindo entre prateleiras. */
  descentTracker?: DescentProgressTracker
  /**
   * `queued`: modo torre, esperando a vez (mesh invisível, sem colisão — ver `parkDie`).
   * `descending`: modo torre, caindo entre as prateleiras.
   * `rolling`: assentando na bandeja/base — mesmo estado dos dois modos a partir daqui.
   * `done`: assentado com resultado lido.
   */
  phase: 'queued' | 'descending' | 'rolling' | 'done'
  lastValue: number | null
  spawnSlot: { x: number; z: number }
  /** Quanto tempo simulado (ms) o dado já passou na fase "entrando" (sem colidir com a parede) sem cruzar pra dentro — ver `ENTRY_FORCE_PUSH_TIMEOUT_MS` em `collisionGroups.ts`. Zerado a cada novo arremesso. */
  enteringElapsedMs: number
  debug?: { visuals: DiceDebugVisuals; updateRow: (snapshot: DieDebugSnapshot) => void }
}

/**
 * Posições (x, z) de uma "prateleira" decorativa com um dado de cada tipo disponível, numa
 * fileira reta do lado de FORA do hexágono — pedido do usuário pra poder ver a cor/acabamento
 * escolhido em cada tipo de dado sem precisar rolar. Fica no lado oposto à câmera (ver
 * `CAMERA_CONFIG.position`, Z positivo olhando pra origem), pra aparecer ao fundo da cena sem
 * tampar a bandeja em si.
 */
const SHELF_SPACING = 1.4

/**
 * Altura de um dado parado no estojo, JÁ em coordenadas de mundo.
 *
 * Existe como função por causa de um BUG REAL: as medidas do estojo (`CASE_DICE_Y` e companhia)
 * são todas relativas à BASE DELE, mas os dados da prateleira são adicionados direto na cena, e
 * não dentro do grupo do estojo. Quando a bandeja virou uma caixa elevada e o estojo desceu pra
 * mesa (`TABLE_DROP`), os dados ficaram na altura antiga e apareceram FLUTUANDO acima do estojo.
 * Com a conta num lugar só, os dois pontos que posicionam prateleira (montagem e remontagem por
 * troca de cor) não têm como divergir de novo.
 */
function shelfDieY(dieScale: number): number {
  return CASE_DICE_Y + dieScale / 2 + TABLE_SURFACE_Y
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
 * Altura das paredes. 0.34 → 0.42: com 0.34 os dados (até 0.7 de altura) ficavam mais pra fora
 * que pra dentro, empoleirados em cima das divisórias como num pente, em vez de encaixados em
 * compartimentos — foi a primeira coisa que o usuário apontou como "desencaixado".
 */
const CASE_WALL_HEIGHT = 0.42
const CASE_WALL_THICKNESS = 0.11
/** Espessura do forro (chão e faces internas) — fino de propósito, é revestimento, não estrutura. */
const CASE_LINING_THICKNESS = 0.045
/**
 * FERRO envelhecido das ferragens (dobradiças e fecho). Fixo: é detalhe metálico, não acompanha a
 * cor da bandeja.
 *
 * Era latão dourado (0xc9a227) até o usuário pedir o estojo "mais rústico e antique". Trocar a cor
 * sozinha não resolveria: latão claro com `metalness` alto é justamente a leitura de ferragem
 * NOVA, polida. Um estojo antigo tem ferro forjado — escuro, quase fosco, que aparece por
 * CONTRASTE com a madeira em vez de por brilho. Daí o `metalness` e o `roughness` do material
 * andarem junto com a cor.
 */
const CASE_METAL_COLOR = 0x39332c
/**
 * O estojo tem CORPO: pezinhos + fundo maciço + paredes, tudo apoiado em cima da mesa.
 *
 * Antes daqui existia um pedestal de 3 unidades enterrado no chão, criado só pra tapar o disco
 * do chão cruzando a base. Da câmera, o que sobrava disso era exatamente o que o usuário
 * descreveu: "parece apenas paredes colocadas" — quatro paredes finas nascendo do nada, sem
 * nenhum volume embaixo. Agora o fundo tem espessura visível e o conjunto se apoia em quatro
 * pezinhos, que é o que faz um objeto ler como caixa POUSADA numa mesa (e ainda ganha sombra
 * própria por baixo, reforçando o apoio).
 */
const CASE_FOOT_HEIGHT = 0.08
const CASE_FLOOR_THICKNESS = 0.14
/** Altura (y) do topo do fundo maciço — onde o forro é assentado. */
const CASE_INTERIOR_Y = CASE_FOOT_HEIGHT + CASE_FLOOR_THICKNESS
/**
 * Altura (y) onde os dados da prateleira se apoiam: em cima do FORRO, que por sua vez é assentado
 * em cima do fundo maciço.
 *
 * BUG REAL relatado pelo usuário ("embaixo dos dados do estojo tá dando um bug visual quando a
 * câmera mexe"): o forro do chão era afundado DENTRO do fundo maciço, com a face de cima dos dois
 * exatamente na mesma altura. Duas faces coplanares apontando pro MESMO lado (as duas pra cima,
 * as duas visíveis de onde a câmera está) disputam o mesmo valor de profundidade, e quem ganha
 * muda conforme a câmera se move — o piso inteiro do estojo piscava entre madeira e feltro. Com o
 * forro POR CIMA do fundo, as faces que se encostam são a de baixo do forro e a de cima do fundo:
 * apontam pra lados opostos, então uma delas é sempre descartada e não existe empate.
 */
const CASE_DICE_Y = CASE_INTERIOR_Y + CASE_LINING_THICKNESS

/**
 * Tampa do estojo — pedido do usuário: "o estojo não está fechado, quero uma animação abrindo
 * e mostrando os dados". A tampa é uma caixa rasa virada pra baixo (tampo + saia nas quatro
 * laterais), com a dobradiça na aresta de TRÁS do topo das paredes (o lado oposto à câmera
 * padrão, ver `computeShelfPositions`): fechada, ela encaixa POR FORA das paredes como tampa de
 * caixa de verdade; ao abrir, gira pra trás e pra cima, sem nunca passar na frente dos dados.
 *
 * `CASE_LID_SKIRT` + `CASE_WALL_HEIGHT` (0.5 + 0.42) precisa passar da altura do dado mais alto
 * em pé (0.7, o d6) pra tampa fechada cobrir tudo. A divisão entre parede e saia foi ajustada
 * pra caixa fechada ficar baixa e elegante, em vez do bloco alto da primeira versão — que o
 * usuário viu como uma placa solta pairando atrás do estojo.
 */
const CASE_LID_SKIRT = 0.5
const CASE_LID_THICKNESS = 0.08
/** ~104° — passa da vertical o bastante pra tampa "descansar" aberta pra trás, como uma caixa de verdade, em vez de ficar equilibrada em pé. */
const CASE_LID_OPEN_ANGLE = Math.PI * 0.58
/** Espera antes de começar a abrir (ms) — a cena aparece com o estojo fechado por um instante, senão a animação já começa antes do usuário olhar pra ela. */
const CASE_LID_OPEN_DELAY_MS = 650
const CASE_LID_OPEN_DURATION_MS = 1100

export interface ShelfCaseHandle {
  group: THREE.Group
  /** Grupo-dobradiça da tampa: girar `rotation.x` (negativo = abrindo) é o que anima a abertura. */
  lidPivot: THREE.Group
  /**
   * Troca as cores NO LUGAR, sem reconstruir nada. Só três materiais dependem das cores
   * escolhidas (casca, forro e forro da tampa) e em todos a cor é literalmente `material.color` —
   * geometria, texturas de madeira e ferragens são idênticas antes e depois.
   *
   * Antes disso, tanto a cena principal quanto a prévia da bandeja jogavam o estojo inteiro fora e
   * chamavam `createShelfCaseMesh` de novo a cada troca de cor: ~30 `BoxGeometry`, materiais novos
   * e as texturas de madeira redesenhadas do zero. Era o que travava ao soltar o seletor de cor na
   * aba Estilo.
   */
  updateColors: (floorColorHex: number, wallColorHex: number) => void
}

/**
 * Progresso 0→1 da abertura, com um leve "passar do ponto" no fim (a tampa sobe, ultrapassa
 * um pouco o ângulo final e volta) — é o que faz a abertura ler como uma tampa com peso sendo
 * jogada pra trás, não uma interpolação linear de software.
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
 * Progresso da tampa (0 fechada, 1 aberta) no instante `elapsedMs` do relógio da cena.
 *
 * Fechando NÃO usa o `easeOutBack` da abertura: o "passar do ponto" que dá peso à tampa
 * abrindo, na direção contrária, enfiaria a tampa pra dentro da caixa antes de voltar —
 * atravessando os dados na cara do usuário.
 */
function lidProgressAt(animation: LidAnimation, elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, (elapsedMs - animation.startMs) / CASE_LID_OPEN_DURATION_MS))
  const opening = animation.to > animation.from
  const eased = opening ? easeOutBack(t) : easeOutCubic(t)
  return animation.from + (animation.to - animation.from) * eased
}

/**
 * Estojo/caixinha de display ao redor da prateleira (ver `computeShelfPositions`) — pedido do
 * usuário pra parecer uma caixa de verdade onde os dados ficam guardados (com uma divisória por
 * compartimento), não só uma placa exposta com os dados em fileira por cima. Só visual, sem
 * collider físico, nunca interage com nada — mesma convenção da placa que substitui. Reaproveita
 * `wallColor`/`floorColor` já customizáveis na aba Estilo (parede do estojo = cor de parede,
 * base = cor de chão), então não precisa de nenhuma cor nova pra configurar.
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
   * Duas famílias de material, e é esse CONTRASTE que faz a caixa ler como estojo de dados:
   * casca em "madeira/couro" na cor de parede (escura na configuração padrão) e forro macio na
   * cor do chão da bandeja (o feltro claro). A primeira versão usava a mesma cor de parede em
   * tudo — casca, divisórias e tampa — e por isso virava um bloco cinza sem leitura nenhuma.
   */
  /**
   * A casca leva o MESMO veio de madeira da parede da bandeja e da borda da mesa
   * (`createWoodTexture.ts` + `woodTint`), em vez da cor chapada de antes. Foi a troca que mais
   * pesou no "mais rústico" que o usuário pediu: sem os ornamentos de latão, uma caixa de cor
   * lisa vira um bloco de cor sem material nenhum — é a madeira que sustenta a leitura sozinha
   * agora. E usar a mesma textura da bandeja amarra o estojo ao resto da cena, em vez de parecer
   * um objeto de outro jogo pousado na mesa.
   *
   * Repetição baixa (3): a UV de uma `BoxGeometry` vai de 0 a 1 em CADA face, então o mesmo
   * número vale pra parede comprida da frente e pro pezinho de 0.28. Com repetição alta, as peças
   * pequenas viram um borrão listrado.
   */
  /**
   * Repetição bem mais alta que a da bandeja (3 → 7): tábua estreita lê como madeira RÚSTICA, de
   * ripa; tábua larga lê como painel industrial. É o segundo eixo, além da cor, que separa o
   * estojo do tabuleiro sem precisar de uma textura nova.
   */
  const shellWood = createWoodTextures(7, 1)
  const shellMaterial = new THREE.MeshStandardMaterial({
    /**
     * Madeira BEM mais escura que a da bandeja (0.72 → 0.42), a pedido do usuário: "mais escura e
     * rústica, não igual à do tabuleiro". A versão anterior já escurecia, mas de leve, e com a
     * bandeja agora sendo uma caixa de MDF clara logo à frente o estojo voltava a se confundir com
     * ela. O escurecimento é aplicado DEPOIS do `woodTint`, então a cor escolhida na aba Estilo
     * continua mandando no tom — o estojo é sempre a peça velha e escura da mesma família.
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
   * Pezinhos + fundo maciço: o VOLUME que faltava embaixo (ver `CASE_FOOT_HEIGHT`). O fundo é
   * uma peça só, do tamanho externo cheio, e as paredes nascem em cima dele — então de qualquer
   * ângulo o estojo tem uma "casca" contínua, sem parede começando no ar.
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

  // Forro: piso + faces internas do fundo e das laterais. A face interna da parede da FRENTE
  // não entra — a câmera padrão olha de cima e de frente, então essa é a única que nunca
  // aparece; forrar ela seria desenho que ninguém vê.
  // Forro do chão POR CIMA do fundo maciço, nunca afundado nele — ver `CASE_DICE_Y`.
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
   * Dobradiça na aresta de TRÁS do topo das paredes (z mais negativo = lado oposto à câmera
   * padrão, ver `CAMERA_CONFIG`): girando `rotation.x` pro negativo, a aresta da frente sobe e
   * vai pra trás — a tampa nunca cruza a linha de visão entre a câmera e os dados enquanto
   * abre. As peças da tampa são posicionadas RELATIVAS a essa dobradiça.
   *
   * A tampa tem exatamente a MESMA planta da caixa (mesma largura e profundidade externas). Na
   * primeira versão ela era maior que a caixa e a dobradiça ficava acima das paredes, então
   * aberta ela parecia uma placa solta pairando atrás do estojo — foi o "desencaixado" que o
   * usuário apontou.
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
   * Forro por DENTRO da tampa: com a tampa aberta é justamente essa face que fica virada pra
   * câmera. Sem ela, o que se vê é o fundo cru da casca.
   *
   * Um tom mais escuro que o forro do fundo (0.82×): o interior de uma tampa aberta fica virado
   * pra longe da luz principal, e com a MESMA cor dos dois lados o painel virava uma chapa
   * amarela chapada, sem profundidade.
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

  /**
   * O forro da tampa é liso: o emblema em losango de latão que ficava aqui saiu junto com o resto
   * dos ornamentos dourados, a pedido do usuário. Era o ornamento mais visível de todos (com a
   * tampa aberta, este painel é a maior superfície virada pra câmera), e é justamente por isso
   * que ele era o mais "dourado" da caixa inteira.
   */

  // Ferragens: duas dobradiças de ferro na aresta traseira e um fecho na frente. São as ÚNICAS
  // peças de metal que sobraram — e ficam porque são funcionais: são elas que dizem "isto abre",
  // mesmo com a tampa parada. Sem elas a tampa vira uma placa de madeira solta em cima da caixa.
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
   * SEM ORNAMENTOS. Aqui existiam cantoneiras de latão nas quatro quinas (corpo e rodapé),
   * rebites ao longo da frente, plaquinhas ladeando o fecho e um friso correndo a borda superior
   * das paredes — todos removidos a pedido do usuário ("tira os detalhes dourados do estojo,
   * deixa mais rústico e antique").
   *
   * Junto com eles saiu o `ORNAMENT_SINK`, a folga que afundava cada peça chapada um tiquinho na
   * superfície onde estava pregada. Não era detalhe de código: sem ela a face de trás do ornamento
   * ficava EXATAMENTE no plano da parede, as duas disputavam o mesmo valor de profundidade e o
   * estojo "chiava" trocando de face conforme a câmera girava. Sumindo o ornamento some o empate —
   * mas fica o registro, porque qualquer peça chapada nova colada na casca vai precisar da
   * mesma folga.
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

/** Ativa um dado da torre: sai da fila, nasce no topo, começa a cair entre as prateleiras de verdade. */
function activateTowerDie(die: DieInstance): void {
  die.mesh.visible = true
  dropDieIntoTower(die.body, TOWER_TOP_Y, die.sides)
  die.phase = 'descending'
  die.descentTracker?.reset(TOWER_TOP_Y)
}

/** Poe um dado da torre "em espera" — invisível, sem colidir com nada (ver `parkedCollisionGroups`), até ser a vez dele. */
function parkTowerDie(die: DieInstance): void {
  die.phase = 'queued'
  die.mesh.visible = false
  if (die.body.numColliders() > 0) die.body.collider(0).setCollisionGroups(parkedCollisionGroups())
}

/**
 * Generaliza `DiceCanvas` pra N dados (potencialmente de tipos diferentes,
 * inclusive o d100 esférico — ver `dice-defs/d100Sphere.ts`) simultâneos,
 * cada um com seu próprio corpo físico,
 * colidindo entre si e com a bandeja, assentando de forma independente. O
 * resultado só é reportado quando TODOS já assentaram — junto com a lista
 * individual de cada um, não só o total (ver requisito de não esconder os
 * valores individuais atrás da soma).
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
      debugMode,
      caseOpen = true,
      onCaseClick,
      cameraMode = 'table'
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const diceRef = useRef<DieInstance[]>([])
    const sceneRef = useRef<THREE.Scene | null>(null)
    const trayRef = useRef<TraySceneHandle | null>(null)
    const towerRef = useRef<TowerSceneHandle | null>(null)
    /** Meshes decorativos da prateleira fora do hexágono (ver `computeShelfPositions`) — vazio no modo torre. */
    const shelfMeshesRef = useRef<THREE.Mesh[]>([])
    /** Estojo/caixinha de display sob a prateleira (ver `createShelfCaseMesh`) — pedido do usuário. `null` no modo torre. */
    const shelfCaseMeshRef = useRef<ShelfCaseHandle | null>(null)
    /** Mini pelúcia do Riebeck na mesa (ver `createRiebeckPlush`) — só pra animar a respiração no `tick`. `null` no modo torre. */
    const plushRef = useRef<THREE.Group | null>(null)
    /**
     * Quanto tempo (ms) a cena já está montada — só alimenta a animação de abertura da tampa do
     * estojo (ver `lidAngleForElapsed`). Fica num ref, e não numa variável local do efeito de
     * mount, porque o efeito de troca de cor RECRIA o estojo (tampa incluída) e precisa
     * recolocá-la no ângulo em que ela já estava, sem "fechar e abrir de novo" só porque o
     * usuário trocou uma cor.
     */
    const sceneElapsedMsRef = useRef(0)
    /** Estado atual da tampa: 0 = fechada, 1 = aberta (ver `lidProgressAt`). */
    const lidProgressRef = useRef(0)
    const lidAnimationRef = useRef<LidAnimation | null>(null)
    /**
     * Mundo físico e HUD de debug espelhados em ref — o efeito de montagem os cria como
     * variáveis locais (`world`/`hud`), mas o efeito de resincronização de dados (ver mais
     * abaixo, `groupsSignature`) roda numa segunda passada de efeito, sem acesso a essas
     * variáveis por closure. Só usados no modo bandeja (ver o próprio efeito de resync).
     */
    const worldRef = useRef<RAPIER.World | null>(null)
    const hudRef = useRef<DiceDebugHud | null>(null)

    const onResultRef = useRef(onResult)
    onResultRef.current = onResult

    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    const onCaseClickRef = useRef(onCaseClick)
    onCaseClickRef.current = onCaseClick

    /** Espelham as props mais recentes pro efeito de resync (abaixo) nunca usar valores desatualizados de cor/acabamento, mesmo que o próprio efeito só dispare por causa de `groups`. */
    const diceColorsRef = useRef(diceColors)
    diceColorsRef.current = diceColors
    const materialRef = useRef(material)
    materialRef.current = material
    /** Espelha `caseOpen` pro efeito de mount (que roda uma vez só) saber se deve agendar a animação de entrada da tampa. */
    const caseOpenRef = useRef(caseOpen)
    caseOpenRef.current = caseOpen
    /**
     * Espelhado num ref DE PROPÓSITO: o laço de animação e os handlers de tecla são criados uma vez
     * só, no mount. Se eles lessem a prop direto, ficariam presos ao valor do primeiro render e
     * trocar de modo não teria efeito nenhum — e pôr `cameraMode` nas dependências do efeito
     * remontaria a cena 3D inteira (recriando física, texturas e dados) só pra mudar como três
     * teclas são interpretadas.
     */
    const cameraModeRef = useRef(cameraMode)
    cameraModeRef.current = cameraMode

    /**
     * Os dados já nascem sendo arremessados (ver efeito abaixo) só por efeito visual — pra
     * não ficarem parados/flutuando quando a cena monta ou remonta (troca de tipo/cor/modo
     * debug força remount via `key`). Mas isso NÃO é uma rolagem pedida pelo usuário: sem
     * essa flag, o assentamento desse arremesso automático dispara `onResult` sozinho,
     * gravando uma entrada fantasma no histórico e tocando o som de rolagem toda vez que a
     * cena monta — inclusive na abertura do app ou ao só trocar uma cor nas Preferências.
     * Só fica `true` a partir da primeira chamada explícita de `roll()` — ou já nasce `true`
     * se `autoRoll` foi passado (rolagem via preset, ver comentário da prop acima).
     */
    const armedRef = useRef(autoRoll ?? false)

    useImperativeHandle(ref, () => ({
      roll: () => {
        armedRef.current = true
        if (launchMode === 'tower') {
          // Refila tudo: só os primeiros `maxConcurrentInTower` voltam a cair imediatamente,
          // o resto espera a vez de novo (mesmo fluxo do mount inicial, ver efeito abaixo).
          diceRef.current.forEach((die, i) => {
            die.lastValue = null
            if (i < TOWER_CONFIG.maxConcurrentInTower) {
              activateTowerDie(die)
            } else {
              parkTowerDie(die)
            }
          })
        } else {
          for (const die of diceRef.current) {
            tossDie(die.body, { target: die.spawnSlot })
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)

      const cameraConfig = launchMode === 'tower' ? TOWER_CAMERA_CONFIG : CAMERA_CONFIG

      let scene: THREE.Scene
      let camera: THREE.PerspectiveCamera
      if (launchMode === 'tower') {
        const tower = createTowerScene(wallColor, backgroundColor, floorColor, backgroundImage ?? null)
        scene = tower.scene
        towerRef.current = tower
        camera = createCamera(container.clientWidth / container.clientHeight, cameraConfig)
      } else {
        const tray = createTrayScene(wallColor, backgroundColor, floorColor, backgroundImage ?? null)
        scene = tray.scene
        trayRef.current = tray
        camera = createCamera(container.clientWidth / container.clientHeight, cameraConfig)
      }
      sceneRef.current = scene
      const environment = setupDiceEnvironment(scene, renderer)

      /**
       * Cache GLOBAL (não recriado a cada mount, ver `textureCache.ts`) — como este componente
       * remonta a cena inteira toda vez que `groups` muda (adicionar/remover um dado), usar o
       * cache persistente aqui é o que faz a montagem seguinte reaproveitar texturas já
       * desenhadas em vez de redesenhar a prateleira inteira (até 160 faces) e cada dado de
       * novo do zero.
       */
      const mountTextureCache = getGlobalDiceTextureCache()

      // Prateleira decorativa: um dado de cada tipo disponível, parado do lado de FORA do
      // hexágono, só pra visualizar a cor/acabamento escolhidos sem precisar rolar — nunca tem
      // corpo físico (não participa da simulação, não se move, não é clicável). Só faz sentido
      // com a bandeja aberta (a torre não tem essa "borda" externa da mesma forma).
      if (launchMode === 'tray') {
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
         * Mini pelúcia do Riebeck sentada na QUINA da bandeja (um vértice do hexágono, o da
         * frente-direita visto da câmera padrão), com as pernas pra dentro, olhando pro meio da
         * mesa — pedido do usuário, referências em `riebeck/`. Fica meio corpo pra fora da linha
         * da parede de propósito: assim ela lê como "sentada na beirada" sem ficar por cima da
         * área onde os dados de fato caem e assentam.
         *
         * Decorativa como a prateleira e o estojo: sem corpo físico, sem collider, descartada
         * junto com a cena por `disposeScene` (ver limpeza do efeito).
         */
        /**
         * Na MESA (o chão em volta, `createGroundPlane`), não na borda do tabuleiro, e hoje
         * EXATAMENTE ATRÁS DO ESTOJO, encostada nele com 1cm de folga — ver `plushZBehindCase`,
         * onde a conta está feita a partir das medidas dos dois objetos.
         *
         * Bem pequena (`PLUSH_SCALE`): é um bonequinho de astronauta na mesa, não um móvel —
         * pedido do usuário depois de ver a primeira versão, do tamanho de dois dados.
         *
         * O giro é calculado, não escolhido: `atan2` das próprias coordenadas, senão ela apareceria
         * de lado (foi assim que a primeira posição precisou de conserto).
         */
        if (SHOW_PLUSH) {
          const plush = createRiebeckPlush()
          plush.scale.setScalar(PLUSH_SCALE)
          /**
           * Sentada na MESA, que é mais baixa que o chão da bandeja (ver `TABLE_SURFACE_Y`).
           *
           * ESCONDIDA no enquadramento em que o app abre, e isso é o pedido, não acidente: "mais
           * atrás do estojo, não quero que dê pra ver ele da entrada principal". Ela é um easter
           * egg — quem gira a câmera pra trás encontra. Encostada no estojo isso fica garantido por
           * geometria e não por distância: ela tem 0.53 de altura contra 1.22 do estojo, então a
           * própria caixa a tampa inteira de frente, com a tampa aberta ou fechada.
           *
           * DUAS LIÇÕES das dez posições anteriores, que continuam valendo se um dia ela sair daqui:
           *
           * 1. O "está flutuando" que o usuário repetiu quatro vezes nunca foi altura, sombra nem
           *    cor das botas — era MARGEM DE GRAMADO. Perto da beirada do disco de grama (raio 16,
           *    `GROUND_RADIUS`), uma câmera baixa e afastada recorta a pelúcia contra o fundo preto,
           *    e aí ela lê como boiando. A saída é aproximar do centro, nunca mexer em altura.
           * 2. Eu não conseguia reproduzir o problema porque recarregava o app antes de capturar, e
           *    o reload RESETA a câmera pro enquadramento padrão — alto e de frente, o único ângulo
           *    em que ela sempre aparecia assentada. Conferir na câmera EM QUE ELE ESTÁ, não na
           *    inicial.
           */
          plush.position.set(PLUSH_X, TABLE_SURFACE_Y - PLUSH_SINK, plushZBehindCase(positions[0].z))
          /**
           * DE COSTAS pro hexágono, olhando pra fora da mesa — pedido do usuário ("vira ele de
           * costas pro hexágono"). Antes ela ficava virada pra bandeja ("com vista do dado"), o que
           * fazia sentido quando ela estava mais pra dentro; sentada na beirada, de costas, ela lê
           * como alguém olhando o horizonte em vez de assistindo à partida.
           *
           * O boneco é modelado olhando pro +Z, então `rotation.y = θ` aponta ele pra
           * `(sin θ, 0, cos θ)`. Com `atan2(x, z)` das PRÓPRIAS coordenadas, essa direção é o vetor
           * que sai do centro da mesa e passa por ele — ou seja, pra fora. A versão anterior usava
           * `atan2(-x, -z)`, o mesmo vetor invertido, que aponta pro centro.
           *
           * Calculado e não escolhido à mão porque ele não está num eixo: em (3.2, -15.4) qualquer
           * ângulo fixo o deixaria torto em relação à beirada.
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
          mesh.position.set(positions[i].x, shelfDieY(entry.definition.scale), positions[i].z)
          scene.add(mesh)
          return mesh
        })
      }

      /**
       * Câmera orbital/arrastável — o usuário pediu um jeito de "puxar a imagem" e ver a
       * bandeja/torre de outros ângulos (inclusive de cima), já que a câmera fixa original
       * podia deixar dados fora do enquadramento em rolagens com vários dados. Danping ligado
       * pra um arrasto suave; distância e ângulo polar limitados pra não deixar o usuário dar
       * zoom pra dentro da cena nem virar a câmera pra baixo do chão.
       */
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(cameraConfig.lookAt[0], cameraConfig.lookAt[1], cameraConfig.lookAt[2])
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      /**
       * ZOOM MUITO MAIS FUNDO: 6 → 1.8 na bandeja e 2.8 → 1.2 na torre, a pedido do usuário
       * ("aumenta a potência do zoom pra poder ver mais detalhes").
       *
       * O 6 antigo era mais ou menos o raio da própria bandeja (7.5): dava pra enquadrar a mesa,
       * nunca pra chegar perto de UMA peça. Um dado tem menos de 1 de lado e a pelúcia tem ~0.4 —
       * pra ler o número gravado numa face, ou os olhos bordados do Riebeck, a câmera precisa
       * passar da casa da unidade.
       *
       * 1.8 é seguro contra o plano de corte (`CAMERA_CONFIG.near` = 0.1): mesmo colada num dado, a
       * câmera fica bem longe de começar a fatiar geometria.
       */
      controls.minDistance = launchMode === 'tower' ? 1.2 : 1.8
      // 15.5 → 19: a base/praça ficou um pouco mais larga (`TOWER_CONFIG.baseFloorRadius`, ver
      // `TOWER_CAMERA_CONFIG`) — o teto de zoom-out antigo não deixava enquadrar a cena inteira.
      controls.maxDistance = launchMode === 'tower' ? 19 : 35
      /**
       * Era exatamente `Math.PI / 2` (horizontal perfeito) — no ângulo mais baixo permitido, a
       * câmera ficava praticamente na mesma altura (y≈0) do chão "infinito" ao redor da bandeja
       * (`createGroundPlane`), olhando quase de raspão pra ele: nesse ângulo degenerado, o disco
       * de chão bem próximo da câmera projeta como uma faixa larga e clara na tela (perspectiva
       * de uma superfície quase paralela ao olhar, bem perto) — o usuário reportou isso como
       * "ainda dá pra ver o chão" bem na direção do estojo (que fica alinhado com a câmera
       * padrão). Reduzir a folga em ~10° tira só esse extremo degenerado, sem restringir a
       * órbita livre pro resto do intervalo.
       */
      controls.maxPolarAngle = Math.PI / 2 - 0.17
      controls.update()

      /**
       * Clique NO ESTOJO dentro da cena 3D abre/fecha a tampa — pedido do usuário. Detalhes que
       * fazem funcionar sem atrapalhar a câmera:
       *
       * - só conta como clique se o ponteiro andou menos de `CLICK_DRAG_TOLERANCE_PX` entre
       *   apertar e soltar. Sem isso, terminar um arrasto de órbita em cima do estojo abriria a
       *   caixa sem ninguém pedir (o botão esquerdo é o mesmo que o `OrbitControls` usa);
       * - o raio testa o GRUPO inteiro do estojo (casca, forro, tampa, ferragens), então
       *   qualquer parte visível responde ao clique;
       * - passar o mouse por cima troca o cursor pra "mãozinha", que é o que avisa que aquilo
       *   ali é clicável — sem isso ninguém descobre o recurso.
       */
      const raycaster = new THREE.Raycaster()
      const pointerNdc = new THREE.Vector2()
      const pointerDownAt = { x: 0, y: 0 }
      const CLICK_DRAG_TOLERANCE_PX = 5

      function caseUnderPointer(event: PointerEvent): boolean {
        const shelfCase = shelfCaseMeshRef.current
        if (!shelfCase) return false
        const rect = renderer.domElement.getBoundingClientRect()
        pointerNdc.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        )
        raycaster.setFromCamera(pointerNdc, camera)
        return raycaster.intersectObject(shelfCase.group, true).length > 0
      }

      function handlePointerDown(event: PointerEvent) {
        pointerDownAt.x = event.clientX
        pointerDownAt.y = event.clientY
      }

      function handlePointerUp(event: PointerEvent) {
        if (event.button !== 0) return
        const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y)
        if (moved > CLICK_DRAG_TOLERANCE_PX) return
        if (caseUnderPointer(event)) onCaseClickRef.current?.()
      }

      function handlePointerMove(event: PointerEvent) {
        if (event.buttons !== 0) return
        renderer.domElement.style.cursor = caseUnderPointer(event) ? 'pointer' : ''
      }

      renderer.domElement.addEventListener('pointerdown', handlePointerDown)
      renderer.domElement.addEventListener('pointerup', handlePointerUp)
      renderer.domElement.addEventListener('pointermove', handlePointerMove)

      /**
       * Câmera no teclado (pedido do usuário): W/S aproxima e afasta, A/D gira em volta da
       * bandeja, Q/E sobe e desce. É a mesma órbita do mouse, só que dirigida por tecla — o
       * `OrbitControls` trabalha com a posição da câmera em coordenadas esféricas ao redor de
       * `target`, então mexer no vetor `posição - alvo` aqui e deixar o `update()` do próprio
       * controle terminar o trabalho mantém tudo (limites de zoom, de ângulo, damping)
       * funcionando igual, sem duas lógicas de câmera concorrendo.
       *
       * As teclas são lidas por `event.code` (posição física), não por `key`: em teclado ABNT2
       * ou AZERTY o W continua sendo a tecla de cima do bloco.
       */
      const pressedKeys = new Set<string>()
      const CAMERA_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'])
      const KEY_ORBIT_SPEED = 1.6
      const KEY_DOLLY_SPEED = 9
      const KEY_POLAR_SPEED = 1.1
      /** Velocidade de deslocamento nos modos que ANDAM (`table` e `free`), em unidades por segundo. */
      const KEY_PAN_SPEED = 9

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
       * Limite do passeio no modo mesa. Sem isto, segurar o W leva o alvo pra fora do gramado e a
       * cena inteira some do quadro, sem nenhuma pista de como voltar — o mesmo tipo de beco sem
       * saída que fez a recentralização automática ser removida lá atrás.
       *
       * É exatamente o raio do tampo (`GROUND_RADIUS`), não mais um 15 escrito à mão: "andar pela
       * mesa" tem que querer dizer a mesa INTEIRA — pedido do usuário, "ver tudo da mesa". O número
       * solto de antes parava uma unidade antes da beirada e, pior, não tinha como acompanhar se o
       * tampo mudasse de tamanho.
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
         * Piso da câmera um palmo ACIMA do tampo (`TABLE_SURFACE_Y`), não exatamente nele: parada
         * rente à superfície, ela olha o gramado de raspão e o tampo vira uma faixa clara ocupando
         * a tela — o mesmo enquadramento degenerado que fez `maxPolarAngle` precisar da folga de
         * 0.17 logo acima.
         */
        minCameraY: TABLE_SURFACE_Y + 0.5
      }
      const cameraSpeeds: CameraSpeeds = {
        orbit: KEY_ORBIT_SPEED,
        dolly: KEY_DOLLY_SPEED,
        polar: KEY_POLAR_SPEED,
        pan: KEY_PAN_SPEED
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
             * Persegue com suavização (12% por frame) em vez de saltar pro ponto: pular o alvo de
             * um lugar pro outro entre dois frames dá um tranco na cena inteira, que foi
             * exatamente o problema da recentralização automática removida antes. Aqui o usuário
             * PEDIU o comportamento e pode desligar trocando de modo, então ele existe — mas
             * suave, e só neste modo.
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
          cameraLimits,
          cameraSpeeds
        )
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('blur', handleWindowBlur)

      function resize() {
        if (!container) return
        const { clientWidth, clientHeight } = container
        renderer.setSize(clientWidth, clientHeight)
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

      /** Ativa o próximo dado da fila, se houver algum esperando. */
      function activateNextQueuedDie() {
        const next = diceRef.current.find((d) => d.phase === 'queued')
        if (next) activateTowerDie(next)
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

        if (die.phase === 'queued') return

        if (die.phase === 'descending') {
          exitTowerIfDescended(die.body, die.sides)
          if (die.body.translation().y <= TOWER_CONFIG.exitY) {
            die.phase = 'rolling'
            die.tracker.reset()
            activateNextQueuedDie()
          } else if (die.descentTracker) {
            const { state, stuckAttempts } = die.descentTracker.update(die.body, simulatedSeconds * 1000)
            if (state === 'stuck') {
              // `applyTowerStuckNudge` (não o `applyNudge` genérico da bandeja) — MEDIDO que
              // dados "redondos" (D20, D100) encontram um repouso estável por atrito na
              // inclinação rasa das prateleiras (15°) e o empurrão fraco da bandeja não os
              // desaloja. ESCALA com `stuckAttempts` (rastreado dentro do próprio
              // `descentTracker`, ver `createDescentProgressTracker.ts`) — um empurrão forte de
              // mais já na primeira pausa fazia dados que só quicaram normalmente entre
              // prateleiras "pularem" visivelmente pra baixo, em vez de escorregar como deveriam.
              applyTowerStuckNudge(die.body, stuckAttempts)
              die.descentTracker.softResetAfterNudge(die.body.translation().y)
            }
          }
          return
        }

        // Acumula quanto tempo simulado o dado já passou "entrando" (sem colidir com a
        // parede) sem cruzar pra dentro — alimenta o teto de `restoreWallCollisionIfInside`
        // (ver `ENTRY_FORCE_PUSH_TIMEOUT_MS`/comentário lá). Zera assim que ele sai dessa
        // fase. Sem efeito pra dados da torre (nunca entram em `DICE_ENTERING_GROUPS`).
        const isEntering =
          die.body.numColliders() > 0 && die.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
        if (isEntering) die.enteringElapsedMs += simulatedSeconds * 1000
        restoreWallCollisionIfInside(die.body, die.enteringElapsedMs)
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
      function tick() {
        const now = performance.now()
        const deltaSeconds = (now - lastFrameTime) / 1000
        lastFrameTime = now

        if (hud && deltaSeconds > 0) {
          // Suavizado (média móvel exponencial) — o FPS instantâneo cru pula demais
          // frame a frame pra ser legível num overlay de texto.
          fpsSmoothed = fpsSmoothed * 0.9 + (1 / deltaSeconds) * 0.1
          hud.updateFps(fpsSmoothed)
        }

        if (stepPhysics) {
          const simulatedSeconds = stepPhysics(deltaSeconds)
          for (const die of diceRef.current) updateDie(die, simulatedSeconds)
        }

        // Abertura da tampa do estojo (ver `createShelfCaseMesh`) — puramente visual, fora da
        // física: o estojo nunca teve collider e continua sem ter. `deltaSeconds` limitado pra
        // um frame longo (janela minimizada, aba trocada) não pular a animação inteira de uma vez.
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
         * Respiração da pelúcia: sobe/desce alguns milímetros e balança um tiquinho, bem devagar.
         * Sem isso ela lê como um enfeite de resina parado no cenário; com isso, como um bichinho
         * de pelúcia apoiado na mesa. Amplitude minúscula de propósito — não pode competir com os
         * dados pela atenção de quem está olhando a rolagem.
         *
         * BUG REAL, e o mais caro desta sessão inteira: esta linha ATRIBUÍA `position.y` em vez de
         * somar, ou seja, jogava fora a altura definida na montagem e prendia a pelúcia oscilando
         * em torno de y=0 — que é a altura do CHÃO DA BANDEJA. Depois que a mesa foi rebaixada
         * (`TABLE_SURFACE_Y`), isso deixou o boneco pairando 0.78 acima do gramado, para sempre.
         *
         * O usuário reportou "o plush está flutuando" seis vezes e chegou a descrever exatamente o
         * sintoma — "ele está na mesma altura que o dado no hexágono" —, e eu passei rodadas
         * mexendo em altura de mesa, sombra de contato, profundidade de assentamento, cor de bota e
         * posição: NADA daquilo podia funcionar, porque tudo era sobrescrito no frame seguinte. O
         * que finalmente apontou pra cá foi ele dizer "não está descendo" mesmo depois de um reload
         * que comprovadamente aplicava a posição nova.
         *
         * Por isso a altura de repouso é guardada uma vez (`userData.restY`) e a respiração passa a
         * ser um deslocamento em cima dela.
         */
        const plush = plushRef.current
        if (plush) {
          const breath = sceneElapsedMsRef.current / 1000
          const restY = plush.userData.restY as number
          plush.position.y = restY + Math.sin(breath * 1.6) * 0.015
          plush.rotation.z = Math.sin(breath * 0.8) * 0.02
        }

        // Nada mexe em `controls.target` sozinho aqui: a câmera só muda se o usuário arrastar
        // ou usar o teclado (ver o comentário sobre a recentralização removida, no topo do
        // arquivo, e `applyKeyboardCamera`).
        applyKeyboardCamera(Math.min(deltaSeconds, 0.1))
        controls.update()
        renderer.render(scene, camera)
        frameId = requestAnimationFrame(tick)
      }
      tick()

      ensureRapierReady()
        .then(() => {
          if (disposed) return
          world = createPhysicsWorld(launchMode === 'tower' ? TOWER_CONFIG.gravity : undefined)
          worldRef.current = world
          if (launchMode === 'tower') {
            createTowerColliders(world)
          } else {
            createBoundaryColliders(world)
          }

          const sidesList = flattenGroups(groups)
          const slots =
            launchMode === 'tray' ? computeSpawnSlots(sidesList.length, SPAWN_CONFIG.slotSafeHalfExtent) : []

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

            if (launchMode === 'tower') {
              const die: DieInstance = {
                sides,
                body,
                mesh,
                tracker: createSettleTracker(),
                descentTracker: createDescentProgressTracker(),
                phase: 'queued',
                lastValue: null,
                spawnSlot: { x: 0, z: 0 },
                enteringElapsedMs: 0,
                debug
              }
              // Só ativa a queda de verdade no mount se for uma rolagem de verdade (preset,
              // ver `autoRoll`) — troca de tipo/cor/modo/debug remonta a cena sem que o
              // usuário tenha pedido uma rolagem, então o dado só fica parqueado até o
              // próximo clique em "Rolar" (ver comentário grande de `armedRef` acima e
              // `roll()` no `useImperativeHandle`).
              if (autoRoll && i < TOWER_CONFIG.maxConcurrentInTower) activateTowerDie(die)
              else parkTowerDie(die)
              return die
            }

            const spawnSlot = slots[i]
            if (autoRoll) {
              tossDie(body, { target: spawnSlot })
            } else {
              // Sem arremesso cosmético de intro (pedido do usuário) — o dado só aparece já
              // parado no próprio slot, caindo uma distância mínima até assentar (nunca
              // "entrando" de fora, então nasce direto no grupo de colisão normal).
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
        // shelfMeshesRef/shelfCaseMeshRef não precisam de descarte explícito aqui — ainda
        // presos na cena, `disposeScene(scene)` logo abaixo já percorre e libera todo mesh
        // nela (inclusive dentro do grupo do estojo, ver `disposeScene` aceitando `Object3D`),
        // mesma convenção já usada pro mesh de cada `die` (nunca descartado à parte aqui, só
        // por `disposeScene`).
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
        towerRef.current = null
        world?.free()
        worldRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * Resincroniza SÓ os dados (sem remontar a cena/física/renderer inteiros) quando a
     * COMPOSIÇÃO da rolagem muda (adicionar/remover tipo, ajustar quantidade, alternar
     * vantagem/desvantagem) — `groups` NÃO está mais no `key` de `DiceRoller3D.tsx` por causa
     * disso. Rolagens de preset continuam remontando de verdade (ver `presetRollSeq` lá, que
     * SEGUE no `key`): elas precisam nascer já arremessadas (`autoRoll`), e o mount original já
     * resolve isso certinho — não vale a pena duplicar aquele fluxo aqui só pra um caso mais raro.
     *
     * Motivo de existir: medido ao vivo que CADA dado adicionado remontava a cena inteira —
     * novo `WebGLRenderer`/contexto WebGL (compilação de shader do zero, ~200ms sozinho),
     * mundo físico novo, prateleira decorativa inteira redesenhada. Reaproveitar o mundo/cena/
     * renderer já existentes (só trocar os corpos+meshes dos dados) elimina de longe a maior
     * fatia desse custo.
     *
     * Só bandeja aberta (`launchMode === 'tray'`): a torre tem fila/parqueamento próprio
     * (`activateTowerDie`/`parkTowerDie`) que já lida com contagem variável de um jeito bem
     * mais específico — a torre continua remontando por completo quando `groups` muda (ver o
     * `key` condicional em `DiceRoller3D.tsx`), sem essa otimização.
     */
    const isFirstGroupsSyncRef = useRef(true)
    const groupsSignature = JSON.stringify(groups)
    useEffect(() => {
      if (isFirstGroupsSyncRef.current) {
        isFirstGroupsSyncRef.current = false
        return
      }
      if (launchMode !== 'tray') return
      const world = worldRef.current
      const scene = sceneRef.current
      if (!world || !scene) return

      for (const die of diceRef.current) {
        die.debug?.visuals.dispose()
        scene.remove(die.mesh)
        disposeMesh(die.mesh)
        world.removeRigidBody(die.body)
      }

      const sidesList = flattenGroups(groups)
      const slots = computeSpawnSlots(sidesList.length, SPAWN_CONFIG.slotSafeHalfExtent)
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

      // Essa resincronização NÃO é uma rolagem pedida pelo usuário (só mudou a composição) —
      // sem isso, se `armedRef` já estivesse `true` de uma rolagem anterior (ele nunca volta a
      // `false` sozinho, ver comentário grande onde é declarado), os dados recém-colocados
      // assentando da queda mínima disparariam `onResult` sozinhos, um resultado fantasma que o
      // usuário nunca pediu. Antes disso nem era possível acontecer: TODA troca de composição
      // forçava remontagem, e um mount novo sempre nasce com `armedRef` fresco (`autoRoll` é
      // `false` nesse fluxo).
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

    const isFirstColorUpdate = useRef(true)
    useEffect(() => {
      // Roda de novo toda vez que cor/acabamento do dado ou cor de parede/fundo mudam — mas
      // NÃO na primeira execução (o mount acima já criou tudo com o valor certo; refazer
      // aqui de novo seria só
      // trabalho redundante logo após montar).
      if (isFirstColorUpdate.current) {
        isFirstColorUpdate.current = false
        return
      }

      /**
       * Antes, `bodyColor`/`numberColor` faziam parte do `key` do componente lá em
       * `DiceRoller3D.tsx` — CADA mudança de cor (inclusive cada evento `input` disparado ao
       * arrastar o seletor de cor nativo, dezenas de vezes por segundo) desmontava a cena
       * inteira (física, corpos rígidos, colliders) e montava tudo de novo do zero, incluindo
       * um arremesso novo — visivelmente lento e "os dados ficam se mexendo sozinhos" enquanto
       * você só queria mudar uma cor. Agora a cor NÃO está mais no `key` (ver
       * `DiceRoller3D.tsx`); só o MESH visual de cada dado é reconstruído aqui, com a física
       * (corpo, collider, posição, velocidade, resultado já lido) inteiramente intacta.
       *
       * Mesmo só reconstruindo o mesh, ainda dava pra sentir uma travadinha arrastando o
       * seletor rápido: reconstruir gera uma `CanvasTexture` nova POR FACE (até 100 no d100)
       * de cada dado na cena, e cada evento `input` do arraste chamava isso na hora, de
       * novo — trabalho síncrono na thread principal, dezenas de vezes por segundo. Um
       * debounce curto (só reconstrói de verdade `COLOR_UPDATE_DEBOUNCE_MS` depois do
       * último evento) deixa o arraste em si liso (não reconstrói nada enquanto ainda está
       * mudando) e aplica a cor final assim que para, sem perder responsividade percebida —
       * o próprio seletor de cor já dá feedback visual instantâneo por conta própria,
       * independente da cena 3D.
       */
      const timeoutId = window.setTimeout(() => {
        const scene = sceneRef.current
        if (!scene) return

        /**
         * Cor/acabamento/parede/fundo/chão mudaram de verdade (é por isso que este efeito
         * disparou) — o cache global fica desatualizado (guarda texturas das cores ANTIGAS),
         * então descarta tudo antes de reconstruir. Sem isso, cada cor experimentada na aba
         * Estilo ficaria acumulada pra sempre no cache (vazamento de textura/memória).
         */
        clearDiceTextureCache()
        const rebuildTextureCache = getGlobalDiceTextureCache()

        // Parede/fundo/chão são atualizados no lugar também — mesmo motivo da cor dos dados,
        // nunca força remount da cena física por causa de uma cor. A torre em si (pedra) não
        // muda de cor, só a bandeja circular da base, ver `TowerSceneHandle.updateColors`.
        const wall = wallColor ?? DEFAULT_WALL_COLOR
        const background = backgroundColor ?? DEFAULT_BACKGROUND_COLOR
        const floor = floorColor ?? DEFAULT_FLOOR_COLOR
        const image = backgroundImage ?? null
        trayRef.current?.updateColors(wall, background, floor, image)
        towerRef.current?.updateColors(wall, background, floor, image)

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
            newMesh.position.set(positions[i].x, shelfDieY(entry.definition.scale), positions[i].z)

            const oldMesh = shelfMeshesRef.current[i]
            scene.remove(oldMesh)
            disposeMesh(oldMesh)
            scene.add(newMesh)
            return newMesh
          })

          /**
           * O estojo só troca de COR (ver `updateColors` em `ShelfCaseHandle`). Antes ele era
           * jogado fora e reconstruído inteiro aqui, e junto disso vinham dois remendos que agora
           * não existem mais: reposicionar a tampa no ângulo em que já estava (senão ela "piscava"
           * fechada) e recolocar o grupo em `TABLE_SURFACE_Y` (senão o estojo voltava pro y=0 e os
           * dados da prateleira ficavam pendurados por baixo dele). Sem reconstrução, nada disso
           * pode acontecer — o objeto na cena é o mesmo, do jeito que estava.
           */
          shelfCaseMeshRef.current?.updateColors(floor, wall)
        }
      }, COLOR_UPDATE_DEBOUNCE_MS)

      return () => window.clearTimeout(timeoutId)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [diceColors, material, wallColor, backgroundColor, floorColor, backgroundImage])

    return <div ref={containerRef} className="dice-canvas-container" />
  }
)
