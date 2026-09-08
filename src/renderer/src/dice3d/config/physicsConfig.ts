/**
 * Todo parâmetro ajustável da física fica aqui; nada de número mágico espalhado por
 * scene/physics/hooks. Cada grupo diz o efeito prático no dado.
 */

import type { DiceDefinition } from '@shared/types/dice3d'
import { MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'

export { MAX_SIMULTANEOUS_DICE }

export const WORLD_CONFIG = {
  /** m/s². Mais forte que os 9.81 reais: o arremesso tem que parecer mão de gente, não queda. */
  gravity: -13,
  /** Passos fixos de física por segundo. Mais alto = colisão rápida mais estável, mais CPU. */
  physicsStepsPerSecond: 60,
  /** `World.numSolverIterations` (padrão do Rapier é 4). Mais alto = contato mais rígido, mais CPU. */
  solverIterations: 4,
  /** Teto de passos num frame só, pra um frame lento não virar espiral da morte. */
  maxStepsPerFrame: 5,
  /**
   * Teto de velocidade linear (m/s), aplicado a todo dado todo frame (`clampVelocity.ts`).
   * Rolagem legítima fica bem abaixo; o teto existe pro caso raro de dois corpos nascerem
   * sobrepostos e o solver separar com um impulso violento.
   */
  maxLinearSpeed: 14
}

export const DICE_DEFAULT_PHYSICS = {
  mass: 1,
  /**
   * Quicância (0 = não quica, 1 = quique sem perda). Baixa de propósito: com vários dados
   * convergindo pro centro ao mesmo tempo, um atingido por outro ainda quicava por cima da parede.
   */
  restitution: 0.24,
  /** Atrito com a superfície e com os outros dados. Mais alto = para de girar mais cedo. */
  friction: 0.6,
  /**
   * Resistência do ar/mesa; é o que faz o dado assentar. Baixar pra 0.12 (com o angular em 0.12 e
   * o torque em [5, 9]) foi tentado e revertido: `diceEscape.test.ts` falhou 2 de 3 execuções
   * (dado sem assentar = "Rolando..." pra sempre) e o percurso após o pouso melhorou 0.02.
   */
  linearDamping: 0.24,
  /** Quanto tempo o dado segue girando depois do impacto. Ver a nota de `linearDamping`. */
  angularDamping: 0.3
} as const

export const SETTLE_CONFIG = {
  /** Abaixo disso (m/s) a velocidade linear conta como parada. */
  linearVelocitySleepThreshold: 0.02,
  /** Abaixo disso (rad/s) a velocidade angular conta como parada. */
  angularVelocitySleepThreshold: 0.02,
  /** Tempo (ms) abaixo dos limiares, sem interrupção, pra valer como parado. Filtra a pausa no meio do quique. */
  stableDurationMs: 400,
  /** Espera máxima (ms) antes de considerar a rolagem travada e perturbar/re-rolar. */
  maxSettleTimeMs: 8000,
  /**
   * Margem mínima de produto escalar entre a face mais alinhada e a segunda. Abaixo disso não há
   * face dominante: o dado está equilibrado numa aresta ou vértice.
   */
  ambiguousFaceDotMargin: 0.08
}

/**
 * A margem global, ou a do próprio dado: o d100 esférico tem facetas pequenas e vizinhas demais
 * (`d100Sphere.ts`), e com a margem global toda rolagem dele sairia ambígua.
 */
export function resolveAmbiguousMargin(definition: DiceDefinition): number {
  return definition.ambiguousMarginOverride ?? SETTLE_CONFIG.ambiguousFaceDotMargin
}

export const TRAY_CONFIG = {
  /** Apótema do polígono da bandeja (centro até o meio da parede): define as paredes invisíveis. */
  apothem: 6.5,
  /**
   * Raio circunscrito: centro até a quina. O número é `6.5 / cos(30°)` com precisão cheia de
   * propósito, pra o hexágono manter apótema exatamente 6.5, o de antes de a forma virar escolha
   * (com 7.5 redondo o apótema caía pra 6.495, numa parede calibrada dado a dado).
   *
   * É ele, e não o apótema, que define a pegada da bandeja na mesa: mantendo ESTE número, todas
   * as formas ocupam o mesmo espaço e câmera, chão, estojo e assento da torre continuam valendo.
   */
  circumradius: 7.505553499465134,
  /**
   * Lados do polígono (6 = hexágono), na parede física e no mesh, pra collider e visual serem a
   * mesma geometria. É só o PADRÃO: a forma é preferência do personagem e quem monta a cena passa
   * a escolhida.
   */
  wallSegments: 6,
  /**
   * Altura VISUAL da parede: rasa, como a bandeja de couro dobrável da referência
   * (`ideias/base hexagonal.png`). A contenção de verdade é do collider abaixo.
   */
  wallHeight: 1.8,
  /**
   * Altura só do COLLIDER. Bem maior que a visual porque o dado atravessa o LUGAR da parede
   * enquanto está entrando (`collisionGroups.ts`): ela não precisa mais ser baixa pro arremesso
   * pular por cima, só alta o bastante pra conter qualquer quique de quem já está dentro.
   */
  wallColliderHeight: 20,
  /** Espessura de parede e chão, a mesma no mesh e no collider. */
  wallThickness: 0.2,
  floorThickness: 0.2
}

export const SPAWN_CONFIG = {
  /**
   * Altura de onde os dados saem, bem acima da bandeja: alguém em pé jogando de cima pra dentro.
   * Hoje é só escolha visual (o dado atravessa o lugar da parede pra entrar, ver
   * `collisionGroups.ts`); antes a altura decidia se ele conseguia pular a parede.
   */
  launchHeightRange: [6, 8] as const,
  /** Distância ALÉM da parede onde o ponto de lançamento cai: o dado nasce fora mesmo. */
  launchOutsideDistance: 2,
  /**
   * Variação somada a `launchOutsideDistance`, pra dois dados com ângulo de lançamento parecido
   * não nascerem sobrepostos: o solver desfaz sobreposição profunda com um impulso capaz de
   * arremessar um deles a dezenas de unidades (já visto).
   */
  launchRadiusJitter: 0.8,
  /**
   * Variação angular do ponto de lançamento em torno do ângulo do próprio slot de destino, como
   * uma mão que alcança perto de onde vai soltar. Estreita de propósito: os slots já ficam bem
   * separados (`computeSpawnSlots.ts`), e abrir mais só aproximaria ângulos sorteados.
   */
  launchAngleSpreadRad: Math.PI / 5,
  /** Variação em torno da direção reta pro slot, pra nem todo lançamento sair idêntico. */
  throwAngleSpreadRad: 0.5,
  /**
   * Tempo-alvo (s) do voo horizontal até o slot: o impulso sai de `distância / tempo`, não de um
   * valor fixo, porque a distância varia com o sorteio do ponto de lançamento.
   * `min/maxHorizontalSpeed` blindam os extremos geométricos. A faixa é curta e as velocidades
   * altas de propósito, junto com a gravidade mais forte: arremesso com força, não só queda.
   */
  flightDurationRange: [0.55, 0.85] as const,
  minHorizontalSpeed: 3.2,
  maxHorizontalSpeed: 5.5,
  /**
   * Impulso vertical somado ao horizontal, pequeno de propósito: é só o empurrãozinho de quem
   * joga. A sensação de "vindo de cima" já vem da altura de lançamento.
   */
  verticalImpulseRange: [0.3, 0.6] as const,
  /** Torque do lançamento. Subir pra [5, 9] foi revertido: ver a medição em `linearDamping`. */
  torqueStrengthRange: [3, 6] as const,
  /**
   * Meia-extensão em que os slots de pouso são espalhados (`computeSpawnSlots`), sempre menor que
   * o apótema pra nenhum slot nascer colado na parede.
   */
  slotSafeHalfExtent: 4.25
}

/**
 * Torre de dados (o outro modo de lançamento, ver `launchMode` em `SettingsContext.tsx`): o dado
 * nasce no topo e cai por dentro batendo numa série de PRATELEIRAS inclinadas, cada uma presa
 * numa parede e girada em relação à anterior, até sair pela porta da base. É o mecanismo de uma
 * dice tower de verdade (chocalho de prateleiras, não rampa em espiral). Geometria em
 * `buildTowerBaffles.ts`.
 */

/** Plataforma de pouso na saída do portão (`createTowerScene.ts` e `createTowerColliders.ts` lêem daqui). */
export const EXIT_PLATFORM_CONFIG = {
  /** Raio do disco. Pequeno: é um degrau saindo da calha, não uma segunda bandeja. */
  radius: 1.5,
  /** Altura do degrau acima do chão da praça: rasa, pra não virar uma queda extra. */
  height: 0.15
}

export const TOWER_CONFIG = {
  /**
   * Gravidade só da torre. Mais fraca que a da bandeja porque aqui o dado cai em queda livre
   * entre prateleiras (não escorrega apoiado), e a mesma gravidade daria impactos violentos
   * demais a cada baffle. O alvo é quique visível sem escapar por cima de uma prateleira.
   */
  gravity: -12,
  /**
   * Raio da parede cilíndrica (física e visual), que também dá o diâmetro interno das
   * prateleiras. O dado só precisa CABER com folga pra não prender entre borda e parede.
   */
  shellApothem: 2.2,
  /** Segmentos do polígono da parede: 24 já é indistinguível de círculo na escala de um dado. */
  shellSegments: 24,
  /**
   * Quantas prateleiras o mecanismo tem. Alternando lado e ângulo, cada uma cobre ~75% do
   * diâmetro, então o dado não tem como pular nenhuma: 5 prateleiras = pelo menos 5 quiques.
   */
  baffleCount: 5,
  /**
   * Inclinação de cada prateleira, menos a última. Suave porque o dado chega em QUEDA e é
   * redirecionado por impacto, como um para-choque de pinball; não precisa vencer o atrito de um
   * tobogã contínuo. Conferido em `towerContainment.test.ts`.
   */
  baffleSlopeDeg: 15,
  /**
   * Inclinação só da última, sempre mais suave: é o freio antes da saída. Sem ela o dado sairia
   * com toda a velocidade acumulada e saltaria pra fora da área de pouso.
   */
  finalBaffleSlopeDeg: 8,
  /**
   * Giro entre duas prateleiras seguidas, além da troca de parede, alternando o sentido. Sem
   * isso elas ficariam sempre nos mesmos dois lados opostos, e uma forma específica (d4 contra
   * d20) poderia achar um caminho preferido: é questão de equidade do resultado, não de estética.
   */
  baffleRotationalOffsetDeg: 50,
  /** Fração do diâmetro que cada prateleira cobre; o resto é o vão por onde o dado cai pra próxima. */
  baffleSpanFraction: 0.75,
  /** Largura da prateleira como fração do diâmetro, um pouco menor pra não furar a parede curva nas pontas. */
  baffleWidthFraction: 0.55,
  /** Espessura da prateleira: só o suficiente pra um collider/mesh sólido. */
  baffleThickness: 0.2,
  /**
   * Arredondamento da borda do COLLIDER (`ColliderDesc.roundCuboid`). Sem ele, d20 e d100 (quase
   * esféricos) prendiam de vez na quina reta da prateleira: 0 de 20 no teste headless. Precisa
   * ser menor que metade de `baffleThickness`, senão o núcleo do `roundCuboid` fica negativo.
   */
  baffleEdgeRadius: 0.08,
  /** Espaço livre acima da primeira prateleira: é a queda que dá energia pro dado tombar de verdade. */
  topClearance: 1.7,
  /**
   * Distância vertical entre os pontos de fixação de duas prateleiras. Valor escolhido direto, e
   * não derivado de `comprimento · sen(inclinação)`: com a inclinação suave de hoje, a conta dava
   * queda menor que a folga exigida (1.5 × a maior altura de dado). Assim o dado sempre cai um
   * trecho livre entre uma prateleira e a outra, sem depender de as duas se tocarem.
   */
  baffleVerticalSpacing: 1.3,
  /** Espaço livre abaixo da última prateleira antes de o dado contar como fora da torre. */
  bottomClearance: 0.6,
  /**
   * Altura que conta como "saiu da torre": devolve a colisão ao grupo normal
   * (`exitTowerIfDescended` em `collisionGroups.ts`).
   *
   * Com 0.3 havia bug real: um d6 assentado no CHÃO tem o centro em y≈0.35, acima do limiar. Ele
   * descia todas as prateleiras, pousava, e nunca "saía" — ficava marcado como travado pra
   * sempre, levando empurrão atrás de empurrão. Em 0.5 o cruzamento acontece com o dado ainda
   * caindo, acima da altura de repouso de qualquer dado do app.
   */
  exitY: 0.5,
  /** Margem acima da última prateleira que a parede alta cobre. */
  shellTopMargin: 1.0,
  /** Margem do topo até onde começa a parede baixa, a que tem o portão. */
  shellBottomMargin: 0.8,
  /**
   * Largura (arco) e altura do portão recortado na casca (`buildTowerShellGeometry.ts`), sempre na
   * direção em que o dado sai da última prateleira (`computeTowerExitAngle`). Precisa ser bem
   * mais largo que o vão de saída do mecanismo (≈1.1), nunca igual: daí a folga de 2.2.
   */
  gateArcWidth: 2.2,
  gateHeight: 1.3,
  /**
   * Apótema da praça hexagonal da base. Tem que conter a plataforma de pouso inteira mesmo no
   * pior caso (saída apontando pro meio de um lado, onde a borda está só a um apótema de
   * distância): a borda mais distante da plataforma fica a ≈5.2 do centro.
   */
  baseFloorRadius: 5.5,
  /**
   * Quantos dados descem a torre ao mesmo tempo. Medido: mais de um dividindo o espaço apertado
   * derrubava a confiabilidade de ~95% pra ~20-50%. O resto da fila espera (`DiceCanvasMulti.tsx`).
   */
  maxConcurrentInTower: 1,
  /**
   * Tempo sem ganhar altura antes de contar como travado. Era 1200: medido que o d100 precisa de
   * muitos ciclos de empurrão pra vencer cada prateleira (`applyTowerStuckNudge.ts`), e detectar
   * a trava mais cedo encurta o tempo total, já que o número de ciclos é o mesmo.
   */
  stuckTimeoutMs: 500,
  /** Progresso mínimo em Y pra não contar como parado: filtra ruído numérico. */
  progressEpsilon: 0.05,
  /** Predição do soft-CCD do Rapier dentro da torre: evita tunelar nas prateleiras finas. */
  softCcdPrediction: 0.4
}

export const NUDGE_CONFIG = {
  /**
   * Perturbação pro dado que assentou equilibrado numa aresta ou travou sem assentar. Pequena o
   * bastante pra não virar empurrão visível, grande o bastante pra desfazer o equilíbrio.
   */
  impulseStrength: 0.5,
  torqueStrength: 0.8
}
