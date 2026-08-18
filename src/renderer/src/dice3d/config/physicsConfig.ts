/**
 * Todos os parâmetros ajustáveis da simulação física ficam aqui — nenhum valor mágico
 * espalhado por scene/physics/hooks. Cada grupo tem uma explicação do efeito prático
 * na sensação do dado, porque "ajustar até parecer bom" só funciona se o parâmetro
 * estiver num lugar só.
 */

import type { DiceDefinition } from '@shared/types/dice3d'
import { MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'

export { MAX_SIMULTANEOUS_DICE }

export const WORLD_CONFIG = {
  /**
   * m/s². Padrão Rapier/realista é ~9.81; valores maiores fazem o dado cair e assentar mais
   * rápido. Aumentada pra -13 a pedido do usuário ("mais gravidade, mais força, como se uma
   * pessoa estivesse jogando os dados") — mesmo espírito do aumento já aplicado só na torre
   * (`TOWER_CONFIG.gravity`), agora também na bandeja aberta. Reverificado com
   * `diceEscape.test.ts` (10 d6 simultâneos, o teto atual) antes de considerar seguro.
   */
  gravity: -13,
  /** Passos fixos de física por segundo. Mais alto = mais estável em colisões rápidas, mais custo de CPU. */
  physicsStepsPerSecond: 60,
  /** Iterações do solver de restrições por passo (`World.numSolverIterations`, padrão do Rapier é 4). Mais alto = contato mais rígido/realista, mais custo de CPU. */
  solverIterations: 4,
  /** Limite de passos de física executados num único frame de render, pra não travar o app numa "espiral da morte" se um frame demorar demais. */
  maxStepsPerFrame: 5,
  /**
   * Teto de velocidade linear (m/s) aplicado a todo dado, todo frame (ver `clampVelocity.ts`).
   * Qualquer arremesso/queda legítimo fica bem abaixo disso (impulso horizontal máximo ~4 +
   * queda livre de ~1s ainda dá bem menos que isso somado em módulo) — o teto existe só pra
   * conter o caso raro de dois corpos nascerem/colidirem quase sobrepostos e o solver
   * resolver com um impulso de separação muito maior que qualquer física de jogo normal.
   */
  maxLinearSpeed: 14
}

export const DICE_DEFAULT_PHYSICS = {
  mass: 1,
  /**
   * "Quicância" (0 = não quica, 1 = quique perfeito sem perda de energia). Times reais de
   * dados de mesa ficam bem abaixo de 1 — muito alto e o dado fica "pulando" sem nunca assentar.
   * Reduzido de 0.35: com vários dados convergindo de fora da bandeja pra dentro ao mesmo
   * tempo (ver `SPAWN_CONFIG`), a energia acumulada de colisões perto do centro é maior que
   * no design anterior (arremesso local, cada dado perto do próprio slot) — sem reduzir
   * quicância/amortecimento, um dado ocasionalmente ainda conseguia quicar de volta por cima
   * da parede depois de ser atingido por outro.
   */
  restitution: 0.24,
  /** Atrito entre o dado e a superfície/outros dados. Mais alto = para de girar mais rápido, menos deslize. */
  friction: 0.6,
  /**
   * Amortecimento da velocidade linear a cada passo — simula resistência do ar/mesa, ajuda o
   * dado a assentar. Aumentado de 0.15 junto com a redução de `restitution` acima, mesmo motivo.
   *
   * TENTADO E REVERTIDO (pedido "a rolagem não é natural"): baixar pra 0.12 (com angular 0.12)
   * e subir `SPAWN_CONFIG.torqueStrengthRange` pra [5, 9]. Medido com `diceEscape.test.ts` (o
   * teste de estresse de `MAX_SIMULTANEOUS_DICE` dados, 5 rolagens seguidas): baseline passou
   * 3/3 execuções, amortecimento menor falhou 2/3 e só o torque maior falhou 1/3 — dados
   * parando de assentar dentro do limite, ou seja, rolagem travada em "Rolando..." na prática.
   * E o ganho era pequeno mesmo assim: num sweep de 30 rolagens de 1 dado, a mediana do
   * percurso após o pouso ficou em 2.96 (contra 2.98 do baseline) e os tombos em 4 (contra 3).
   * Ou seja, o que faz a rolagem parecer pouco natural NÃO está aqui — não vale trocar
   * confiabilidade de assentamento por isso.
   */
  linearDamping: 0.24,
  /** Amortecimento da velocidade angular — controla quanto tempo o dado continua girando depois do impacto. Ver a nota de `linearDamping` sobre baixar os dois. */
  angularDamping: 0.3
} as const

export const SETTLE_CONFIG = {
  /** Abaixo disso (m/s) a velocidade linear é considerada "parada". */
  linearVelocitySleepThreshold: 0.02,
  /** Abaixo disso (rad/s) a velocidade angular é considerada "parada". */
  angularVelocitySleepThreshold: 0.02,
  /** Tempo (ms) que o dado precisa permanecer abaixo dos limiares acima, sem interrupção, para ser considerado parado de verdade. Evita ler o resultado durante uma pausa momentânea no meio de um quique. */
  stableDurationMs: 400,
  /** Tempo máximo (ms) de espera antes de considerar a rolagem travada e agir (perturbação/re-roll). */
  maxSettleTimeMs: 8000,
  /**
   * Margem mínima de produto escalar entre a face melhor alinhada e a segunda melhor.
   * Se a diferença for menor que isso, não há face claramente dominante (dado equilibrado
   * numa aresta/vértice) — ver estratégia de desempate na explicação da Fase 1.
   */
  ambiguousFaceDotMargin: 0.08
}

/**
 * Margem de ambiguidade a usar pra um dado específico: a maioria usa a margem
 * global acima, mas dados com muitas facetas pequenas e próximas (d100
 * esférico, ver `d100Sphere.ts`) precisam de uma margem bem menor — do
 * contrário, praticamente toda rolagem seria marcada como ambígua.
 */
export function resolveAmbiguousMargin(definition: DiceDefinition): number {
  return definition.ambiguousMarginOverride ?? SETTLE_CONFIG.ambiguousFaceDotMargin
}

export const TRAY_CONFIG = {
  /**
   * Apótema (distância do centro até o meio de cada parede) do hexágono da bandeja — define
   * as paredes invisíveis. Era um retângulo (`halfExtentX`/`halfExtentZ`, sempre iguais desde
   * que a bandeja virou quadrada) até virar hexágono de verdade a pedido do usuário; o valor
   * numérico (6.5) foi mantido igual ao último `halfExtentX/Z`, então nenhum outro raio/câmera
   * precisou ser reescalado por essa mudança de formato.
   */
  apothem: 6.5,
  /** Lados do polígono da bandeja — 6 = hexágono. Usado tanto pela parede física (`createRingWall`) quanto pelo mesh visual, pra garantir que collider e visual sejam exatamente a mesma geometria. */
  wallSegments: 6,
  /**
   * Altura VISUAL das paredes (o collider físico que de fato contém os dados é bem mais alto,
   * ver `wallColliderHeight` abaixo). Foi 3.5 → 4.5 → 5.5 (pedidos anteriores do usuário por
   * paredes mais altas/mais "confiança visual"). Reduzida de volta pra 1.8 a pedido do usuário,
   * com referência visual concreta (`ideias/base hexagonal.png`): uma bandeja de couro dobrável
   * de verdade, com parede rasa — bem mais baixa que um dado deitado de lado, só o suficiente
   * pra conter sem virar uma "caixa". O collider físico (`wallColliderHeight`) não muda —
   * contenção real continua garantida independente da altura visual.
   */
  wallHeight: 1.8,
  /**
   * Altura só do COLLIDER físico da parede — bem maior que `wallHeight` (a altura visual, só
   * usada pelo mesh em `createScene.ts`) de propósito. Dado que entra na bandeja atravessa o
   * LUGAR da parede sem colidir com ela enquanto ainda está "entrando" (ver
   * `collisionGroups.ts`), a altura física da parede não precisa mais ser baixa o bastante
   * pra um arremesso "pular por cima" — ela só existe agora pra CONTER, então pode (e deve)
   * ser bem mais alta que qualquer bounce residual depois de uma colisão entre dados já
   * dentro da bandeja consiga alcançar, sem nenhum efeito colateral visual (o collider é
   * invisível, só o mesh determina a altura que aparece na tela).
   */
  wallColliderHeight: 20,
  /** Espessura das paredes e do chão — mesmo valor usado no mesh visual e no collider físico. */
  wallThickness: 0.2,
  floorThickness: 0.2
}

export const SPAWN_CONFIG = {
  /**
   * Altura (unidades de mundo) de onde os dados são lançados — bem ACIMA da bandeja de
   * propósito, pra parecer alguém em pé jogando os dados de cima pra dentro da caçamba, não
   * só "nasce logo depois da parede". Uma versão anterior desta constante era baixa
   * (rente ao chão) porque a altura ainda determinava se o dado precisava "pular por cima"
   * fisicamente da parede pra entrar — isso não é mais verdade: o dado atravessa o LUGAR da
   * parede sem colidir com ela enquanto ainda está "entrando" (ver `collisionGroups.ts`), e
   * o collider físico da parede é bem mais alto que a altura visual justamente pra conter
   * qualquer energia de impacto extra sem deixar nada escapar (ver `wallColliderHeight` em
   * `TRAY_CONFIG`) — então agora a altura do lançamento é só uma escolha visual.
   */
  launchHeightRange: [6, 8] as const,
  /**
   * Distância (unidades de mundo) ALÉM da parede onde o ponto de lançamento fica, numa
   * direção aleatória em torno do slot de destino. O dado nasce de verdade do lado de fora,
   * não só perto da borda por dentro.
   */
  launchOutsideDistance: 2,
  /**
   * Variação aleatória (unidades de mundo) somada/subtraída de `launchOutsideDistance` —
   * cada dado nasce a uma distância um pouco diferente da parede, nunca exatamente na mesma
   * posição que outro. Sem isso, dois dados cujo ângulo de lançamento calha de ficar bem
   * parecido (ver `launchAngleSpreadRad`) podiam nascer colididos/sobrepostos entre si — o
   * solver de física resolve sobreposição profunda com um impulso de separação que pode ser
   * violento o bastante pra arremessar um dos dois a uma velocidade absurda (visto na
   * prática: um dado saindo voando a dezenas de unidades de distância, bem além de qualquer
   * arremesso normal).
   */
  launchRadiusJitter: 0.8,
  /**
   * Variação angular (radianos) do ponto de lançamento em torno do ângulo do PRÓPRIO slot
   * de destino (visto do centro da bandeja) — como uma mão que alcança perto de onde vai
   * soltar aquele dado específico, não de qualquer lugar aleatório da borda. Mantida
   * relativamente estreita (bem menos que 180°) de propósito: já que os slots de vários
   * dados simultâneos ficam espalhados numa grade (ver `computeSpawnSlots.ts`), cada um já
   * tem um ângulo bem diferente dos outros vistos do centro — uma variação ampla por cima
   * disso só aumentava a chance de dois ângulos sorteados calharem de ficar parecidos.
   */
  launchAngleSpreadRad: Math.PI / 5,
  /** Variação angular (radianos) em torno da direção "reta pro slot" — evita todo lançamento parecer geometricamente idêntico. */
  throwAngleSpreadRad: 0.5,
  /**
   * Tempo-alvo (segundos) pro arremesso cruzar horizontalmente até a posição do slot de
   * destino — usado pra CALCULAR o impulso horizontal a partir da distância real de cada
   * lançamento (`distância / tempo`), em vez de um impulso fixo, já que a distância varia
   * mais agora que o ponto de lançamento é sorteado ao redor do slot em vez de ficar sempre
   * a `throwDistance` fixa dele. `min/maxHorizontalSpeed` blindam os extremos geométricos.
   */
  /**
   * `flightDurationRange` encurtado (era [0.7, 1.0]) e `min/maxHorizontalSpeed` aumentados —
   * junto com `WORLD_CONFIG.gravity` mais forte, pedido explícito do usuário de um arremesso
   * mais rápido/pesado, "como se uma pessoa estivesse jogando os dados" (força de verdade, não
   * só uma queda mais rápida).
   */
  flightDurationRange: [0.55, 0.85] as const,
  minHorizontalSpeed: 3.2,
  maxHorizontalSpeed: 5.5,
  /**
   * Módulo do impulso VERTICAL (pra cima) somado ao horizontal — pequeno de propósito. A
   * altura de lançamento já é o que dá a sensação de "vindo de cima"; isso aqui é só o
   * empurrãozinho inicial de quem joga (não deixar o dado sair só "caindo" reto, mas também
   * sem competir com a queda livre e criar um arco alto e artificial).
   */
  verticalImpulseRange: [0.3, 0.6] as const,
  /**
   * Módulo do torque aleatório aplicado no momento do lançamento — aumentado junto com o resto
   * (arremesso com mais força tomba com mais violência). Subir pra [5, 9] foi tentado e
   * revertido: ver a nota de medição em `DICE_DEFAULT_PHYSICS.linearDamping`.
   */
  torqueStrengthRange: [3, 6] as const,
  /**
   * Meia-extensão (unidades de mundo) dentro da qual os "slots" de pouso de
   * cada dado são distribuídos (ver `computeSpawnSlots`) — sempre menor que
   * `TRAY_CONFIG.halfExtentX/Z` de propósito, pra nenhum slot cair colado
   * na parede. Escalado junto com o aumento da bandeja (mesma razão
   * halfExtent novo/antigo, 6.5/5.5), pra continuar espalhando os slots
   * proporcionalmente mais agora que a bandeja é maior.
   */
  slotSafeHalfExtent: 4.25
}

/**
 * Torre de dados (modo de lançamento alternativo — ver `launchMode` em `SettingsContext.tsx`):
 * o dado nasce no topo de uma torre de castelo e cai por dentro dela, batendo numa série de
 * PRATELEIRAS INCLINADAS, cada uma presa numa parede e girada em relação à anterior, até sair
 * pela porta na base — mecanismo real de "dice tower" físico (chocalho de prateleiras, não uma
 * rampa em espiral contínua). Geometria em `buildTowerBaffles.ts`.
 *
 * REESCRITA COMPLETA duas vezes nesta sessão: primeiro a partir de `tower.md.txt` (a torre ERA
 * uma rampa espiral única, removida — o spec pedia "multiple alternating ramps... alternate left
 * and right... generate random bouncing before exit", um mecanismo de prateleiras, não de
 * espiral); depois a partir de `dice_tower_parametric_prompt.md` (spec CAD bem mais detalhada,
 * trazida pelo usuário em seguida), que trocou o giro fixo de 180° entre prateleiras por um
 * deslocamento angular alternado (`baffleRotationalOffsetDeg`) e o espaçamento vertical DERIVADO
 * da inclinação por um valor INDEPENDENTE (ver comentários de cada campo abaixo) — autorizado
 * pelo usuário a refazer do zero as vezes que precisasse ("redo the tower and redo the physics").
 *
 * Cada prateleira é presa numa parede (ângulo calculado por `computeAttachAngle`, ver
 * `buildTowerBaffles.ts`) e desce até a borda aberta do lado oposto — um dado que cai nela é
 * redirecionado por impacto até essa borda e cai na PRÓXIMA prateleira, presa numa parede girada,
 * criando um caminho em zig-zag espiralado (não repetitivo) ao redor do eixo da torre.
 */
/**
 * "Mini área de aterrissagem" na saída do portão (ver `createExitLandingPlatform` em
 * `createTowerScene.ts` e o collider correspondente em `createTowerColliders.ts` — os dois
 * SEMPRE lêem daqui, nunca duplicam o número).
 */
export const EXIT_PLATFORM_CONFIG = {
  /**
   * Raio do disco (unidades de mundo). 1.5 → 1.8 → 2.0 → 1.5 nesta rodada: reduzido de novo —
   * o usuário pediu uma plataforma pequena/modesta ("mini"), não um disco grande; um raio menor
   * também evita que a plataforma pareça flutuar solta na praça (mais fácil de ler como um
   * degrau pequeno de verdade saindo da calha, não uma segunda bandeja).
   */
  radius: 1.5,
  /** Altura (degrau) da plataforma acima do chão da praça — rasa de propósito, "curta e visível" como o resto do pouso da torre, não uma queda extra. */
  height: 0.15
}

export const TOWER_CONFIG = {
  /**
   * Gravidade (m/s²) SÓ da torre — negativo, mesma convenção de `WORLD_CONFIG.gravity`. Bem mais
   * fraca que a versão antiga da rampa espiral (-40): aqui o dado fica em QUEDA LIVRE de verdade
   * entre prateleiras (não escorregando apoiado o tempo todo), então a mesma gravidade produziria
   * impactos bem mais violentos a cada baffle. Valor escolhido pra dar velocidade de impacto
   * moderada (~v=√(2·|g|·baffleVerticalSpacing), ver abaixo) — rápido/visível o bastante pra "gerar
   * quique aleatório" (pedido explícito do `tower.md.txt`), sem ficar tão violento que o dado
   * escape saltando por cima de uma prateleira.
   */
  gravity: -12,
  /**
   * Raio (apótema) da parede cilíndrica da torre (física E visual) — também define o diâmetro
   * interno onde as prateleiras (baffles) ficam. Escala menor que a rampa espiral antiga
   * (3.3): o mecanismo de prateleiras não precisa de um corredor largo o bastante pra um d6
   * tombando (~1.73 de diagonal) girar sem tocar guias — aqui o dado só precisa CABER dentro do
   * diâmetro com folga suficiente pra não ficar preso entre a borda de uma prateleira e a parede.
   */
  shellApothem: 2.2,
  /** Segmentos do polígono que aproxima o cilindro da parede externa (física) — 24 já é indistinguível de um círculo verdadeiro na escala de um dado. */
  shellSegments: 24,
  /**
   * Quantas prateleiras (baffles) o mecanismo tem — `ramp_count` no `dice_tower_parametric_prompt.md`
   * (spec CAD trazida pelo usuário, mais detalhada/precisa que o `tower.md.txt` anterior), valor
   * padrão 5 (faixa 4-6). Cada dado precisa bater em pelo menos `minBounceCount` delas antes de
   * sair (`min_bounce_count`, ver comentário lá) — com prateleiras alternando lado (e agora
   * também ângulo, ver `baffleRotationalOffsetDeg`) cobrindo ~75% do diâmetro cada, um dado que
   * nasce no centro não tem como "pular" nenhuma, então 5 prateleiras SEMPRE geram pelo menos 5
   * quiques reais no caminho até a saída.
   */
  baffleCount: 5,
  /**
   * Inclinação (graus) de cada prateleira, exceto a última (ver `finalBaffleSlopeDeg`) —
   * `ramp_slope_angle` no spec: 15° (faixa 12-18), BEM mais suave que a versão anterior desta
   * sessão (35°, calculada pra vencer o ângulo de atrito do dado numa rampa CONTÍNUA, onde o
   * dado precisa ESCORREGAR apoiado o tempo todo). Essa restrição não se aplica mais aqui: com
   * `baffleVerticalSpacing` agora INDEPENDENTE da inclinação (ver comentário lá, também vindo do
   * spec — antes era derivado geometricamente do próprio ângulo/comprimento da prateleira), o
   * dado sempre chega em cada prateleira em QUEDA (já com velocidade real, não do repouso) e é
   * redirecionado pro lado por um impacto/quique — mais parecido com um para-choque de pinball
   * do que com um tobogã contínuo. Verificado com `towerContainment.test.ts` depois da mudança.
   */
  baffleSlopeDeg: 15,
  /**
   * Inclinação (graus) SÓ da última prateleira — `final_ramp_angle` no spec: 8° (faixa 6-10),
   * sempre mais suave que `baffleSlopeDeg` de propósito ("act as a brake, soaking up excess
   * velocity right before the exit"). Sem isso, o dado sairia da torre ainda com toda a
   * velocidade acumulada nos quiques anteriores, arriscando saltar pra fora da área de
   * aterrissagem.
   */
  finalBaffleSlopeDeg: 8,
  /**
   * Deslocamento angular (graus) aplicado entre cada prateleira sucessiva, além de trocar de
   * parede — `ramp_rotational_offset` no spec: 50° (faixa 45-60), alternando sentido
   * (horário/anti-horário) a cada prateleira. SEM isso, as prateleiras ficariam sempre nos
   * mesmos dois lados opostos (0°/180°) — o spec é explícito sobre o motivo: um dado de forma
   * geométrica particular (ex.: D4 tetraédrico vs D20 icosaédrico) pode encontrar um "caminho
   * preferido" através de baffles sempre simétricos, um problema de EQUIDADE do resultado, não só
   * de estética. Alternar o deslocamento faz o dado percorrer um caminho em espiral irregular ao
   * redor do eixo da torre, nunca repetindo o mesmo padrão de quique.
   */
  baffleRotationalOffsetDeg: 50,
  /**
   * Fração do DIÂMETRO interno que cada prateleira cobre, medida da parede onde está presa até a
   * borda aberta do lado oposto — `ramp_length_fraction` no spec: 0.75 (faixa 0.70-0.80,
   * "extend about 70–80% across the diameter"), valor idêntico ao já usado. Sobra ~25% do
   * diâmetro como vão aberto pro dado cair pra prateleira de baixo.
   */
  baffleSpanFraction: 0.75,
  /**
   * Largura (perpendicular ao comprimento) de cada prateleira, como fração do DIÂMETRO interno —
   * cada prateleira é um retângulo simples (o spec pede um perfil levemente côncavo,
   * `ramp_profile`, não modelado aqui — um retângulo plano já mede confiável nos testes e evita
   * complexidade extra de geometria/collider côncavo por enquanto), mantida um pouco menor que o
   * diâmetro cheio pra não furar visualmente a parede curva nas pontas.
   */
  baffleWidthFraction: 0.55,
  /** Espessura (unidades de mundo) da prateleira — corresponde a `ramp_thickness` no spec (proporcionalmente pequena), só o suficiente pra um collider/mesh sólido, não estrutural. */
  baffleThickness: 0.2,
  /**
   * Raio de arredondamento (unidades de mundo) da borda do COLLIDER FÍSICO da prateleira
   * (`RAPIER.ColliderDesc.roundCuboid`, ver `createTowerColliders.ts`) — corresponde a
   * `fillet_dice_contact` no spec ("anywhere a die can strike or slide"). BUG REAL corrigido por
   * este parâmetro: sem arredondamento, D20/D100 (formas quase esféricas) ficavam permanentemente
   * presos na quina reta da borda de uma prateleira (0/20 no teste headless) — a quina de 90°
   * dava um encaixe mecanicamente estável que essas formas encontram e formas mais angulares
   * (D4-D12) não. Precisa ficar MENOR que a metade de `baffleThickness` (senão o "núcleo" do
   * `roundCuboid` fica com extensão negativa) — 0.08 deixa a maior parte da espessura arredondada
   * de propósito (quase uma seção transversal em cápsula), garantindo que TODA borda da
   * prateleira, não só as pontas, deslize suave.
   */
  baffleEdgeRadius: 0.08,
  /**
   * Espaço vertical livre ACIMA da primeira prateleira, onde o dado nasce/cai antes do primeiro
   * impacto — `entry_drop_height` no spec: "builds enough initial kinetic energy to force real
   * tumbling instead of a die just sliding down under low speed". Aumentado (era 1.0) porque o
   * spec pede uma queda inicial proporcionalmente maior (35mm num tubo de ~90mm de diâmetro,
   * ~0.39× o diâmetro) do que a versão anterior desta sessão tinha.
   */
  topClearance: 1.7,
  /**
   * Espaçamento vertical (unidades de mundo) entre o ponto de FIXAÇÃO de duas prateleiras
   * consecutivas — `ramp_vertical_spacing` no spec: "usable interior height / (ramp_count + 1)",
   * um valor INDEPENDENTE escolhido diretamente (não mais derivado de
   * `comprimento · sen(inclinação)` como na primeira versão desta sessão): com a inclinação bem
   * mais suave agora (15°), derivar a altura geometricamente dava uma queda vertical MENOR que a
   * exigida pela própria validação de clearance do spec ("vertical drop between successive ramps
   * >= 1.5 × maior altura de dado ativo"). Independente, dá margem real: o dado sai da borda de
   * uma prateleira e cai em queda livre curta antes de alcançar a próxima (o "salto" entre
   * baffles que o spec descreve), nunca dependendo de as duas prateleiras se tocarem exatamente.
   */
  baffleVerticalSpacing: 1.3,
  /** Espaço vertical livre ABAIXO da última prateleira antes do dado ser considerado "fora da torre" (`exitY`) — ver comentário de `exitY`. */
  bottomClearance: 0.6,
  /**
   * Altura (Y) considerada "já saiu da torre" — troca a colisão de volta pro grupo normal
   * (`exitTowerIfDescended` em `collisionGroups.ts`).
   *
   * BUG REAL medido nesta sessão com `exitY=0.3`: um d6 (metade da altura ≈0.35 depois do
   * `scale` reduzido em `dice-defs/`) assentado no CHÃO tem o CENTRO em y≈0.35 — ACIMA de 0.3!
   * O dado descia certinho por todas as prateleiras, pousava no chão de verdade... e nunca
   * cruzava `exitY`, porque seu centro em repouso já é maior que o limiar. Ficava sinalizado
   * "travado" pra sempre (`createDescentProgressTracker`), levando um empurrão aleatório atrás
   * do outro sem nunca sair da fase "descending" — confirmado ao vivo com um script de depuração
   * (posição/velocidade a cada passo): o dado chegava a y≈0.35-0.43 e ficava ali, estável, sendo
   * empurrado repetidamente sem nunca "sair" de verdade.
   *
   * Corrigido pra 0.5 — folga real ACIMA da altura de repouso de QUALQUER dado do app (todos
   * ficam bem abaixo de 0.35 depois do `scale` reduzido), então o cruzamento acontece ENQUANTO o
   * dado ainda está caindo (a poucos centímetros do chão), nunca depois de já ter assentado.
   */
  exitY: 0.5,
  /** Margem (unidades) acima da última prateleira que a parede alta da torre cobre. */
  shellTopMargin: 1.0,
  /** Margem (unidades) abaixo do topo da torre até o chão, antes da parede baixa (com o portão) começar. */
  shellBottomMargin: 0.8,
  /**
   * Largura (arco, unidades de mundo na base da casca) e altura do "portão" — abertura de VERDADE
   * recortada na casca da torre (`buildTowerShellGeometry.ts`), sempre na direção em que o dado
   * naturalmente sai da última prateleira (ver `computeTowerExitAngle` em `buildTowerBaffles.ts`
   * — com `baffleCount` par, a última prateleira empurra o dado pra -X; ímpar, pra +X). LIÇÃO
   * APRENDIDA na sessão anterior: a porta precisa ficar BEM mais larga que o vão de saída do
   * mecanismo interno (aqui, o vão de uma prateleira = `(1 - baffleSpanFraction) × diâmetro` ≈
   * 1.1), nunca só igual/menor — por isso 2.2, folga generosa (~1.1).
   */
  gateArcWidth: 2.2,
  gateHeight: 1.3,
  /**
   * Apótema da praça HEXAGONAL da base da torre (mesmo papel que `TRAY_CONFIG.apothem` tem pra
   * bandeja) — precisa conter a plataforma de pouso inteira com folga mesmo no pior caso (ângulo
   * de saída podendo apontar pro meio de um LADO do hexágono, onde a distância até a borda é só o
   * apótema em si, não o circunraio maior): borda mais distante da plataforma fica a
   * `shellApothem + 2×EXIT_PLATFORM_CONFIG.radius` ≈ 5.2 do centro da torre.
   */
  baseFloorRadius: 5.5,
  /**
   * Quantos dados podem estar simultaneamente dentro da torre (fase "caindo entre prateleiras")
   * ao mesmo tempo — mantido em 1 (mesma decisão já tomada e MEDIDA nesta sessão pro mecanismo
   * antigo: mais de um dado dividindo um espaço apertado derrubava a confiabilidade de ~95% pra
   * ~20-50%). O resto da fila espera a vez (ver fila em `DiceCanvasMulti.tsx`).
   */
  maxConcurrentInTower: 1,
  /**
   * Tempo (ms) sem progredir em altura antes de considerar um dado "travado" (equilibrado numa
   * borda de prateleira, por exemplo) — mais generoso que o da rampa espiral antiga (800ms)
   * porque aqui um quique legítimo entre duas prateleiras pode brevemente subir antes de
   * continuar caindo; um valor curto demais arriscaria classificar um quique normal como trava.
   */
  // 1200 → 500: reduzido — MEDIDO que D100 (quase esférico, atrito máximo) precisa de muitos
  // ciclos de empurrão pra atravessar cada prateleira (ver `applyTowerStuckNudge.ts`); detectar a
  // trava mais rápido encurta o tempo REAL total, mesmo número de ciclos precisando acontecer.
  stuckTimeoutMs: 500,
  /** Distância mínima (Y) de progresso pra não ser considerado "sem avançar" — filtra ruído numérico. */
  progressEpsilon: 0.05,
  /** Distância de predição do soft-CCD do Rapier, ativado enquanto o dado está dentro da torre — mitiga tunelamento nos impactos (mais rápidos que uma queda comum) contra as prateleiras finas. */
  softCcdPrediction: 0.4
}

export const NUDGE_CONFIG = {
  /**
   * Perturbação mínima aplicada quando o dado assenta equilibrado numa
   * aresta/vértice (resultado ambíguo) ou trava sem assentar dentro de
   * `maxSettleTimeMs`. Pequena o bastante pra não parecer um empurrão
   * visível, grande o bastante pra desfazer o equilíbrio instável.
   */
  impulseStrength: 0.5,
  torqueStrength: 0.8
}
