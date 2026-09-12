import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import type { DiceGroup, DiceGroupResult, ExplodeRule, KeepRule, RollResult } from '@shared/types/dice'
import { totalMantido, valoresDosGrupos } from '@shared/dice/manterDados'
import {
  modificadorDoTexto,
  textoDeModificadorAceito,
  textoDoModificadorAjustado
} from '@shared/dice/modificador'
import { rolarFormula, rollExpression, rollWithMode } from '@renderer/domain/dice/diceEngine'
import type { Formula } from '@shared/dice/formula'
import {
  avancarRolagem,
  gruposDaFormula,
  resultadoParaRollResult,
  type FaceColhida
} from '@shared/dice/rolagemPorEtapas'
import { webglDisponivel } from '@renderer/dice3d/utils/webglDisponivel'
import { DEFAULT_DICE_SIDES, MAX_EXPLOSOES_POR_DADO, colorForDice } from '@shared/diceRegistry'
import { expressionLabel, type RollMode } from '@renderer/domain/dice/diceEngine'
import { MAX_SIMULTANEOUS_DICE } from '@renderer/dice3d/config/physicsConfig'
import {
  DiceCanvasMulti,
  type DiceCanvasMultiHandle,
  type MultiRollResult
} from '@renderer/dice3d/scene/DiceCanvasMulti'
import { AVAILABLE_DICE_TYPES } from '@renderer/dice3d/dice-defs/registry'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import type { DisplayMode, LaunchMode } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { playRollSound } from '@renderer/audio/rollSound'
import { teclaVeioDeDigitacao } from '@renderer/utils/isTyping'
import { TRAY_SHAPE_SIDES } from '@renderer/dice3d/geometry/trayShape'
import { Button } from '../common/Button'
import { BotaoCopiar, rotulosDoChat } from '../common/BotaoCopiar'
import { MarcaDeCritico } from '../common/MarcaDeCritico'
import { linhaParaChat } from '@shared/dice/linhaParaChat'
import { REGRA_DE_CRITICO_PADRAO, comMarcasDeCritico, type RegraDeCritico } from '@shared/dice/critico'
import { tocarCritico, tocarFalha } from '@renderer/audio/efeitosDeCritico'
import { CameraModeSwitch } from './CameraModeSwitch'
import './DiceRoller3D.css'
import { IconeReroll } from '@renderer/components/common/IconeReroll'

/** `buildD*Visual`/`buildPolyhedronVisual` esperam a cor do corpo como hex numérico (ex.: 0xf2ead6), não string CSS. */
function hexStringToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

export interface DiceRoller3DHandle {
  /**
   * Carrega uma combinação de dados (ex.: vinda de um preset) e já rola assim que montar.
   *
   * `sourceName` é o nome do preset, e serve só pro histórico (ver `sourceName` em `RollResult`):
   * ele viaja daqui até o resultado que sai segundos depois, quando os dados assentam.
   */
  rollGroups: (
    groups: DiceGroup[],
    modifier: number,
    sourceName?: string,
    /** "Role 3 e use o maior" — ver `KeepRule`. Ausente quer dizer somar tudo, como sempre foi. */
    keep?: KeepRule,
    /** "Tirou o máximo, rola de novo" — ver `ExplodeRule`. Ausente quer dizer que não explode. */
    explode?: ExplodeRule
  ) => void
  /**
   * Rola um preset de FÓRMULA — a gramática inteira, em ondas na cena (ver `rolagemPorEtapas.ts`):
   * cada pedido da avaliação vira um arremesso, do jeito que a explosão já encena. `sourceName` é
   * o nome do preset, pro histórico, como no `rollGroups`.
   */
  rollFormula: (formula: Formula, sourceName?: string) => void
}

interface DiceRoller3DProps {
  onRoll: (result: RollResult) => void
  /** Avisa o pai sempre que `isRolling` muda — usado pra desabilitar ações de preset (editar/excluir/rolar OUTRO) enquanto qualquer rolagem está em andamento, mesmo padrão já usado pros próprios botões de tipo/quantidade de dado aqui dentro. */
  onRollingChange?: (isRolling: boolean) => void
  /**
   * Atalhos de teclado ligados. Falso quando a aba de rolagem não é a que está na tela — ela fica
   * MONTADA e escondida (ver `App.tsx`), então sem isto o Espaço rolaria os dados de dentro das
   * Anotações.
   */
  shortcutsEnabled?: boolean
  /**
   * Abre o histórico de rolagens direto daqui ("um botão de histórico... pra pessoa não ter que ir
   * nas configs", e depois "pequeno, do lado do resultado ali na soma"). O modal é do `App`; a
   * bandeja só ganha o atalho, desenhado na linha do resultado.
   */
  onOpenHistory?: () => void
  /**
   * O botão Explode aparece? Quem decide é o `App`, pelo SISTEMA do personagem ativo (ver
   * `explodeDoSistema.ts`); ausente é visível. Esconder também DESLIGA o interruptor (efeito
   * abaixo): explode ligado atrás de um botão invisível rolaria diferente do que a tela mostra.
   * Preset com regra explosiva continua explodindo em qualquer sistema.
   */
  explodeVisivel?: boolean
  /**
   * A regra de CRÍTICO do personagem ativo (spec §3.7; ver `critico.ts`): que dado, em que
   * direção. Vem do `App` porque é do `notes.json` do personagem; ausente é o d20 de sempre.
   */
  regraDeCritico?: RegraDeCritico
  /**
   * O HUD do personagem (spec §3.6), desenhado POR CIMA do canvas, dentro do contêiner da cena —
   * é o pai dele que define os quatro cantos. Vem de fora como o crachá: quem sabe de personagem é
   * o `App`; a cena só reserva o lugar.
   */
  overlay?: ReactNode
}

const DEFAULT_GROUPS: DiceGroup[] = [{ sides: 20, count: 1 }]

/**
 * Em vantagem/desvantagem cada tentativa lança o grupo inteiro de novo (igual ao roller
 * antigo), então o total de dados na cena dobra — o limite de contagem manual precisa
 * cair pela metade do limite geral da cena pra nunca estourar `MAX_SIMULTANEOUS_DICE`.
 */
const ADVANTAGE_MAX_COUNT = Math.floor(MAX_SIMULTANEOUS_DICE / 2)

/**
 * Atraso (ms) entre clicar em "Rolar" e o som tocar, pra soar junto do impacto dos dados na bandeja
 * em vez do instante do clique.
 *
 * É menor pela torre porque são dois tempos de voo: de lá o dado nasce na boca, logo acima da borda,
 * e cai direto no hexágono; no arremesso de cima ele nasce entre 6 e 8 de altura e cruza a bandeja
 * antes de bater. O da torre saiu por ouvido, em duas rodadas (800ms ainda soou tarde), e fica um
 * pouco ANTES do primeiro impacto de propósito — o ruído de uma torre começa antes de o dado tocar a
 * bandeja. Abaixo de ~540ms o som antecede qualquer coisa na tela.
 */
const ROLL_SOUND_DELAY_MS = 1200
const TOWER_ROLL_SOUND_DELAY_MS = 400

function rollSoundDelay(launchMode: LaunchMode): number {
  return launchMode === 'tower' ? TOWER_ROLL_SOUND_DELAY_MS : ROLL_SOUND_DELAY_MS
}

/** Agrupa uma lista achatada de resultados individuais de volta por tipo de dado, na ordem em que cada tipo apareceu primeiro. */
function groupRollsBySides(rolls: { sides: number; value: number }[]): DiceGroupResult[] {
  const order: number[] = []
  const bySides = new Map<number, number[]>()
  for (const roll of rolls) {
    if (!bySides.has(roll.sides)) {
      bySides.set(roll.sides, [])
      order.push(roll.sides)
    }
    bySides.get(roll.sides)?.push(roll.value)
  }
  return order.map((sides) => {
    const values = bySides.get(sides) ?? []
    return { sides, rolls: values, subtotal: values.reduce((sum, v) => sum + v, 0) }
  })
}

/**
 * Um dado da rolagem e as faces que ele já mostrou; sem explosão a lista tem um elemento só.
 *
 * A cena 3D não sabe explodir: ela lança um punhado de dados e diz onde cada um parou. A explosão é
 * ENCENADA por cima disso, em ondas — assentou, algum tirou o máximo? então os que tiraram voltam
 * pra bandeja e caem de novo. O preço é este acumulador, que amarra a segunda queda de um dado à
 * primeira.
 */
export interface DadoEmCadeia {
  sides: number
  faces: number[]
}

/** O dado ainda está explodindo? Última face no máximo E cadeia dentro do teto. */
export function aindaExplode(dado: DadoEmCadeia, regra: ExplodeRule | undefined): boolean {
  if (!regra || regra.maxChain <= 0) return false
  return dado.faces[dado.faces.length - 1] === dado.sides && dado.faces.length <= regra.maxChain
}

/** Os grupos da próxima onda: um por tipo de dado que ainda está explodindo. */
export function gruposDaProximaOnda(cadeias: DadoEmCadeia[], regra: ExplodeRule | undefined): DiceGroup[] {
  const porTipo = new Map<number, number>()
  for (const dado of cadeias) {
    if (!aindaExplode(dado, regra)) continue
    porTipo.set(dado.sides, (porTipo.get(dado.sides) ?? 0) + 1)
  }
  return [...porTipo].map(([sides, count]) => ({ sides, count }))
}

/**
 * Encaixa o resultado de uma onda nas cadeias que a pediram. O casamento é POR TIPO DE DADO, e não
 * por posição: a cena monta os dados agrupados por tipo e não promete devolver na mesma ordem em que
 * estavam. Casar por posição funcionaria hoje e quebraria calado no dia em que a ordem mudasse, com
 * um d6 herdando a segunda queda de um d20.
 */
export function encaixarOnda(cadeias: DadoEmCadeia[], onda: { sides: number; value: number }[], regra: ExplodeRule | undefined): void {
  /**
   * UMA QUEDA POR DADO NESTA ONDA. Sem este conjunto há um defeito que o teste pegou e que não daria
   * erro nenhum em produção: um dado que recebe a face máxima de novo continua elegível, então o
   * segundo dado da mesma onda encontrava o primeiro e empilhava tudo nele — com 3d6 explodindo dois,
   * um ficava com a cadeia inteira e o outro com nada.
   */
  const jaRecebeu = new Set<DadoEmCadeia>()
  for (const queda of onda) {
    const destino = cadeias.find(
      (dado) => dado.sides === queda.sides && !jaRecebeu.has(dado) && aindaExplode(dado, regra)
    )
    // Sem destino é um dado a mais do que se pediu — não deveria acontecer, e engolir é melhor do
    // que somar a face num dado que já tinha parado.
    if (!destino) continue
    destino.faces.push(queda.value)
    jaRecebeu.add(destino)
  }
}

/** As cadeias viram o formato de resultado que o histórico e a regra de manter já entendem. */
export function cadeiasParaGrupos(cadeias: DadoEmCadeia[]): DiceGroupResult[] {
  const ordem: number[] = []
  const porTipo = new Map<number, DadoEmCadeia[]>()
  for (const dado of cadeias) {
    if (!porTipo.has(dado.sides)) {
      porTipo.set(dado.sides, [])
      ordem.push(dado.sides)
    }
    porTipo.get(dado.sides)?.push(dado)
  }
  return ordem.map((sides) => {
    const dados = porTipo.get(sides) ?? []
    // Um valor por DADO: a soma da cadeia dele. Ver `DiceGroupResult.rolls`.
    const rolls = dados.map((dado) => dado.faces.reduce((soma, face) => soma + face, 0))
    const explodiu = dados.some((dado) => dado.faces.length > 1)
    return {
      sides,
      rolls,
      subtotal: rolls.reduce((soma, valor) => soma + valor, 0),
      ...(explodiu ? { chains: dados.map((dado) => dado.faces) } : {})
    }
  })
}

/** Quantos dados a rolagem tem, somando todos os grupos. */
export function totalDeDados(grupos: DiceGroup[]): number {
  return grupos.reduce((soma, g) => soma + g.count, 0)
}

/**
 * ACRESCENTAR um dado de `sides`, respeitando o teto; devolve a MESMA lista quando não cabe.
 *
 * Pura e exportada por causa de um defeito medido no app rodando: o teto era conferido antes do
 * `setGroups`, lendo a lista do render anterior. Cliques rápidos no "+" são agrupados pelo React num
 * lote só, todos enxergam o mesmo valor velho, e a rolagem chegou a 31 dados num app cujo limite é
 * 20 (medido com trinta cliques seguidos). Conferindo aqui dentro, quem manda é a lista que o React
 * entrega, sempre a mais recente, mesmo no meio de um lote.
 */
export function comDadoAcrescentado(grupos: DiceGroup[], sides: number, teto: number): DiceGroup[] {
  if (totalDeDados(grupos) >= teto) return grupos
  if (grupos.some((g) => g.sides === sides)) {
    return grupos.map((g) => (g.sides === sides ? { ...g, count: g.count + 1 } : g))
  }
  return [...grupos, { sides, count: 1 }]
}

/**
 * AJUSTAR a contagem de um grupo. Zero REMOVE o grupo, inclusive quando é o último.
 *
 * O último grupo era intocável, e ele pediu o contrário: "vamos deixar a opção de remover todos os
 * dados, mas aí o botão de Rolar não funciona. Que seja fácil retirar e trocar de dados". A trava
 * resolvia o problema errado — ficar sem dados é o caminho normal pra trocar 3d6 por 1d20. Quem
 * impede a rolagem vazia é o botão de Rolar, que desliga sozinho (ver `semDados`). O teto é
 * conferido aqui dentro pelo mesmo motivo de `comDadoAcrescentado`.
 */
export function comContagemAjustada(
  grupos: DiceGroup[],
  indice: number,
  delta: number,
  teto: number
): DiceGroup[] {
  const grupo = grupos[indice]
  if (!grupo) return grupos
  if (delta > 0 && totalDeDados(grupos) >= teto) return grupos

  const proxima = grupo.count + delta
  if (proxima <= 0) {
    return grupos.filter((_, i) => i !== indice)
  }
  return grupos.map((g, i) => (i === indice ? { ...g, count: proxima } : g))
}

/**
 * O roller 3D de verdade, no lugar da rolagem instantânea por RNG no modo completo. Ele sempre produz
 * um `RollResult` no mesmo formato de antes, então Histórico e Presets continuam funcionando: só
 * muda COMO o número é gerado.
 *
 * O d100 é só mais um tipo de dado aqui (100 faces, ver `d100Sphere.ts`), sem caso especial de dois
 * d10, então ganha contador e vantagem de graça. O modo compacto continua com o roller instantâneo:
 * uma cena 3D precisa de espaço pra fazer sentido.
 */
export const DiceRoller3D = forwardRef<DiceRoller3DHandle, DiceRoller3DProps>(function DiceRoller3D(
  { onRoll, onRollingChange, shortcutsEnabled = true, onOpenHistory, explodeVisivel, regraDeCritico = REGRA_DE_CRITICO_PADRAO, overlay },
  ref
) {
  const t = useTranslation()
  const {
    diceBodyColor,
    diceNumberColor,
    diceMaterial,
    resinFlower1,
    resinFlower2,
    diceColorOverrides,
    wallColor,
    backgroundColor,
    floorColor,
    backgroundImage,
    towerStoneColor,
    towerRoofColor,
    towerFlagColor,
    towerDoorColor,
    launchMode,
    trayShape,
    cameraMode,
    debugMode,
    soundEnabled,
    resultPopupEnabled,
    displayMode,
    copyMarkdown,
    critVisualEnabled,
    critSoundEnabled
  } = useSettings()
  const multiRef = useRef<DiceCanvasMultiHandle>(null)
  /**
   * O CLARÃO de crítico/falha sobre a cena (spec §3.7) — um segundo, sem bloquear nada, some no
   * fim da animação CSS como o popup do total. `key` reinicia a animação num crítico seguido do
   * outro.
   */
  const [efeitoDeCritico, setEfeitoDeCritico] = useState<{ key: string; tipo: 'critico' | 'falha' } | null>(null)
  /** Timer do delay do som de rolagem (ver `ROLL_SOUND_DELAY_MS`) — guardado só pra poder cancelar no unmount, evitando tocar som depois que o componente já saiu de tela (troca de aba durante o delay). */
  const rollSoundTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
    }
  }, [])

  /**
   * Cor do corpo/número resolvida POR TIPO de dado — mescla o override individual
   * (`diceColorOverrides`, editado na aba Estilo) com a cor global, sempre com uma entrada pra
   * cada tipo disponível. Passada pra `DiceCanvasMulti` já pronta, sem lógica de fallback
   * espalhada lá dentro (ver prop `diceColors`).
   */
  const resolvedDiceColors = useMemo(() => {
    const result: Record<number, { bodyColor: number; numberColor: string }> = {}
    for (const sides of AVAILABLE_DICE_TYPES) {
      const override = diceColorOverrides[sides]
      result[sides] = {
        bodyColor: hexStringToNumber(override?.bodyColor ?? diceBodyColor),
        numberColor: override?.numberColor ?? diceNumberColor
      }
    }
    return result
  }, [diceColorOverrides, diceBodyColor, diceNumberColor])

  const [groups, setGroups] = useState<DiceGroup[]>(DEFAULT_GROUPS)
  /**
   * Incrementado a cada rolagem de preset. Na torre ele continua no `key` de `DiceCanvasMulti` (ela
   * tem fila e parqueamento próprios); na BANDEJA saiu do `key` a pedido dele, porque remontar a cena
   * a cada preset reconstruía física, texturas e dados e jogava a CÂMERA de volta pro padrão.
   *
   * Na bandeja ele virou o gatilho do efeito que dispara a rolagem, e tem que ser um CONTADOR, e não
   * a referência de `groups`: clicando o mesmo preset duas vezes, `setGroups` recebe uma referência
   * igual, o React descarta a atualização e a interface trava em "Rolando...".
   */
  const [presetRollSeq, setPresetRollSeq] = useState(0)
  /**
   * Rolagem de preset pendente na BANDEJA. Não dá pra chamar `roll()` direto no handler: o
   * `setGroups` desta mesma função ainda não passou pelo React, então `roll()` arremessaria o
   * conjunto ANTIGO. O efeito abaixo dispara depois que o resync do filho rodou — efeitos de filho
   * rodam antes dos do pai, e é essa ordem que garante os dados certos na cena.
   */
  const pendingPresetRollRef = useRef(false)
  /**
   * O modificador vive como TEXTO, e o número é derivado — ver `textoDeModificadorAceito`.
   *
   * Guardar o número e converter a cada tecla é o que impedia digitar negativo: o campo não tem como
   * representar "o usuário digitou o sinal e ainda não digitou o algarismo".
   */
  const [textoDoModificador, setTextoDoModificador] = useState('0')
  const modifier = modificadorDoTexto(textoDoModificador)
  /**
   * Estojo de dados atrás da bandeja aberto ou fechado. A única forma de mexer nisso é clicando no
   * próprio estojo dentro da cena (`onCaseClick` abaixo): existia um botão na barra e ele pediu pra
   * tirar, porque um botão a mais só competia com o "Rolar".
   *
   * Estado do componente e não das Preferências (é brincadeira da cena, não configuração), e fora do
   * `key` de `DiceCanvasMulti`: abrir e fechar anima na cena existente, sem remontar nada.
   */
  const [caseOpen, setCaseOpen] = useState(true)
  /**
   * Ponte levadiça da torre abaixada/levantada, pelas mesmas razões do estojo logo acima: só se
   * mexe clicando nela dentro da cena, mora no componente e não nas Preferências, e fica fora do
   * `key` de `DiceCanvasMulti`.
   *
   * Nasce ABAIXADA porque é assim que a ponte sempre existiu — quem quiser fechar, fecha.
   */
  const [bridgeOpen, setBridgeOpen] = useState(true)
  const [mode, setMode] = useState<RollMode>('normal')
  const [lastResult, setLastResult] = useState<RollResult | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [rollError, setRollError] = useState(false)
  /** Nome do preset da rolagem em curso — ver `rollGroups` e `finalizeResult`. */
  const sourceNameRef = useRef<string | undefined>(undefined)
  /** Regra de manter do preset em curso — ver `rollGroups` e `handleMultiResult`. */
  const keepRef = useRef<KeepRule | undefined>(undefined)
  /**
   * DADOS EXPLOSIVOS: liga e desliga por rolagem, do lado do botão de vantagem. Fica no componente e
   * não nas Preferências porque é escolha DA ROLAGEM, não do app — cada sistema de RPG usa a sua, e
   * quem joga dois na mesma semana troca o tempo todo.
   */
  const [explode, setExplode] = useState(false)
  /** A regra da rolagem EM CURSO — mesma razão do `keepRef`: ela é lida quando os dados assentam. */
  const explodeRef = useRef<ExplodeRule | undefined>(undefined)

  /**
   * Botão escondido é interruptor DESLIGADO. Trocar pra um personagem que não é de D&D com o
   * explode ligado deixaria a regra viva atrás de um botão que não existe — a rolagem manual
   * explodindo sem nada na tela dizendo isso.
   */
  useEffect(() => {
    if (explodeVisivel === false) setExplode(false)
  }, [explodeVisivel])
  /**
   * A onda de explosão que está na cena agora, ou `null` na queda normal. Ela substitui os grupos que
   * vão pra bandeja sem tocar em `groups`, e essa separação é o ponto: `groups` é a ESCOLHA da
   * pessoa, mostrada nos contadores da barra, e mexer nele mudaria a seleção dela no meio da rolagem.
   */
  const [ondaDeExplosao, setOndaDeExplosao] = useState<DiceGroup[] | null>(null)
  /** O que cada dado desta rolagem já mostrou, entre uma onda e outra. Ver `DadoEmCadeia`. */
  const cadeiasRef = useRef<DadoEmCadeia[]>([])
  /**
   * A rolagem de FÓRMULA em curso: a fórmula e o diário de faces já colhidas (`rolagemPorEtapas.ts`).
   * Num ref pelas mesmas razões do `keepRef` — quem a lê é o `handleMultiResult`, segundos depois. O
   * `null` fora dela é o que devolve o assentamento ao caminho de sempre.
   */
  const sessaoDeFormulaRef = useRef<{ formula: Formula; faces: FaceColhida[] } | null>(null)

  /** Começa uma rolagem do zero: nenhuma onda pendente, nenhuma cadeia herdada da anterior. */
  function limparCadeias(): void {
    cadeiasRef.current = []
    setOndaDeExplosao(null)
  }

  /**
   * A máquina desenha a bandeja? Perguntado UMA vez, no primeiro render. Quando não desenha, o app
   * cai no modo rápido sem perguntar e diz por quê na tela: antes disso, um notebook com driver de
   * vídeo velho abria o app, tentava montar a cena, falhava, e a pessoa ficava com um programa de
   * rolar dados no qual não dava pra rolar dado.
   */
  const [temWebgl] = useState(webglDisponivel)
  /** O modo QUE ESTÁ VALENDO: a escolha da pessoa, ou o rápido à força quando não há 3D possível. */
  const modoEfetivo: DisplayMode = temWebgl ? displayMode : 'quick'
  const semFisica = modoEfetivo === 'quick'

  /**
   * A rolagem SEM FÍSICA: o mesmo cálculo da bandeja, resolvido na hora. É o `rollExpression` de
   * sempre, o mesmo que o modo compacto já usava. O que muda no modo rápido é só de onde vem o
   * número — de `crypto.getRandomValues` em vez das faces que os dados mostraram. Vantagem, manter e
   * explosão continuam valendo, porque quem sabe fazer as três é o motor.
   */
  function rolarSemFisica(
    gruposDaVez: DiceGroup[],
    modificador: number,
    keep: KeepRule | undefined,
    regraExplosiva: ExplodeRule | undefined,
    modoDaVez: RollMode
  ): void {
    const expression = {
      groups: gruposDaVez,
      modifiers: modificador !== 0 ? [{ type: 'flat' as const, value: modificador }] : [],
      keep,
      explode: regraExplosiva
    }
    const resultado =
      modoDaVez === 'normal' || gruposDaVez.length !== 1
        ? rollExpression(expression)
        : {
            ...rollWithMode(gruposDaVez[0].count, gruposDaVez[0].sides, modoDaVez, modificador),
            explode: regraExplosiva
          }

    if (soundEnabled) playRollSound(gruposDaVez.reduce((soma, g) => soma + g.count, 0))
    finalizeResult(resultado)
  }
  /** Popup do total sobre a bandeja/torre ao assentar os dados — some sozinho no fim da animação CSS (`onAnimationEnd`), não precisa de timer em JS. `key` força reinício da animação mesmo se o total se repetir entre uma rolagem e outra. */
  const [resultPopup, setResultPopup] = useState<{ key: string; total: number } | null>(null)

  // Avisa o pai sempre que `isRolling` muda, pra ele desabilitar as ações de preset enquanto uma
  // rolagem está em andamento. Num efeito separado, e não em cada `setIsRolling` espalhado pelo
  // arquivo, pra ter um lugar só responsável por essa notificação.
  useEffect(() => {
    onRollingChange?.(isRolling)
  }, [isRolling, onRollingChange])
  /**
   * Clicar num preset É a própria ação de rolar, sem um segundo clique em "Rolar": esta flag avisa o
   * próximo mount de `DiceCanvasMulti` que o arremesso automático dele já conta como rolagem de
   * verdade. Autozera logo depois pra não vazar pro mount seguinte de uma troca manual de tipo, cor
   * ou modo, que não deve rolar nada.
   */
  const [autoRollArm, setAutoRollArm] = useState(false)

  useEffect(() => {
    if (autoRollArm) setAutoRollArm(false)
  }, [autoRollArm])

  useImperativeHandle(ref, () => ({
    rollGroups: (newGroups, newModifier, sourceName, keep, explodeDoPreset) => {
      /**
       * A BANDEJA aceita preset a qualquer momento, inclusive por cima de uma rolagem em andamento
       * ("que aconteça a qualquer momento"). Havia um `if (isRolling) return` aqui, por causa do
       * remount: trocar de preset no meio da rolagem destruía a cena, a rolagem em curso nunca
       * reportava resultado e a interface travava em "Rolando..." pra sempre. Sem remount, arremessar
       * por cima é só arremessar de novo. A TORRE continua recusando: lá a rolagem é uma FILA, e
       * cortá-la no meio deixa dados presos no estado de espera.
       */
      if (isRolling && launchMode === 'tower') return
      /**
       * Guardado num ref, e não em estado: o resultado só existe quando os dados assentam, segundos
       * depois, e no meio disso o componente re-renderiza várias vezes. Num estado, o `finalizeResult`
       * leria o valor do render em que a rolagem COMEÇOU.
       */
      sourceNameRef.current = sourceName
      /**
       * Mesma razão do `sourceNameRef`: a regra de manter é do preset que começou ESTA rolagem, e
       * quem a lê é o `handleMultiResult`, segundos depois, quando os dados assentam.
       */
      keepRef.current = keep
      /**
       * A regra explosiva do PRESET manda, e o botão da barra acompanha.
       *
       * Sem espelhar no botão, o preset explosivo faria dados explodirem com o interruptor da barra
       * visivelmente desligado — a tela discordando do que acabou de acontecer na bandeja.
       */
      explodeRef.current = explodeDoPreset
      setExplode(Boolean(explodeDoPreset))
      // Rolagem nova, cadeias novas: o que sobrou de uma explosão anterior não pode entrar nesta.
      limparCadeias()
      // Uma sessão de fórmula pendurada capturaria o assentamento desta rolagem — morre aqui.
      sessaoDeFormulaRef.current = null
      // Presets não carregam modo de vantagem/desvantagem — sempre volta a 'normal'
      // pra não herdar um modo deixado ligado de uma rolagem manual anterior.
      setMode('normal')
      setTextoDoModificador(String(newModifier))
      setGroups(newGroups.length > 0 ? newGroups : DEFAULT_GROUPS)
      setLastResult(null)
      setRollError(false)
      setResultPopup(null)
      setIsRolling(true)
      setPresetRollSeq((n) => n + 1)

      /**
       * No modo rápido o preset resolve AQUI e a função acaba: não há cena pra sincronizar nem
       * arremesso pra esperar. Os `setGroups`/`setModifier` acima continuam valendo pra barra
       * mostrar de que dados veio a rolagem.
       */
      if (semFisica) {
        setIsRolling(false)
        rolarSemFisica(
          newGroups.length > 0 ? newGroups : DEFAULT_GROUPS,
          newModifier,
          keep,
          explodeDoPreset,
          'normal'
        )
        return
      }

      // Só marca; quem arremessa é o efeito abaixo, depois que os dados novos já entraram na cena
      // (ver `pendingPresetRollRef`). Vale pros dois modos desde que a torre parou de remontar.
      pendingPresetRollRef.current = true
      // Som com atraso (ver `ROLL_SOUND_DELAY_MS`) — não em `finalizeResult`, que só roda
      // quando os dados assentam segundos depois.
      if (soundEnabled) {
        if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
        const diceCount = newGroups.reduce((sum, g) => sum + g.count, 0)
        rollSoundTimeoutRef.current = window.setTimeout(() => playRollSound(diceCount), rollSoundDelay(launchMode))
      }
    },
    rollFormula: (formula, sourceName) => {
      // A mesma regra do `rollGroups`: a torre é uma fila, e cortá-la no meio prende dados.
      if (isRolling && launchMode === 'tower') return
      sourceNameRef.current = sourceName
      // Fórmula não usa as regras da rolagem de sempre: manter e contar vêm por marca, prontas
      // (ver `resultadoParaRollResult`), e a explosão é da própria gramática (`!` no termo).
      keepRef.current = undefined
      explodeRef.current = undefined
      setExplode(false)
      limparCadeias()
      sessaoDeFormulaRef.current = null
      setMode('normal')
      setTextoDoModificador('0')
      // A barra mostra DO QUE a rolagem é feita; as ondas dizem o que está caindo agora.
      setGroups(gruposDaFormula(formula))
      setLastResult(null)
      setRollError(false)
      setResultPopup(null)

      // Sem física a gramática resolve inteira no clique, com o mesmo RNG do modo rápido.
      if (semFisica) {
        const resultado = rolarFormula(formula)
        if (!resultado) {
          setRollError(true)
          return
        }
        if (soundEnabled) playRollSound(resultado.groups.reduce((soma, g) => soma + g.rolls.length, 0))
        finalizeResult(resultado)
        return
      }

      // O primeiro pedido da avaliação é a primeira onda. Fórmula sem dado não chega aqui (a
      // validação recusa), então qualquer coisa que não seja um pedido é defeito — erro visível.
      const passo = avancarRolagem(formula, [])
      if (passo.tipo !== 'precisa') {
        setRollError(true)
        return
      }
      sessaoDeFormulaRef.current = { formula, faces: [] }
      setOndaDeExplosao([{ sides: passo.pedido.lados, count: passo.pedido.quantidade }])
      setIsRolling(true)
      setPresetRollSeq((n) => n + 1)
      pendingPresetRollRef.current = true
      if (soundEnabled) {
        if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
        rollSoundTimeoutRef.current = window.setTimeout(
          () => playRollSound(passo.pedido.quantidade),
          rollSoundDelay(launchMode)
        )
      }
    }
  }))

  /**
   * Dispara a rolagem de preset DEPOIS que os dados novos já estão na cena, nos dois modos. Efeitos
   * de componente-filho rodam antes dos do pai, então quando este executa o resync de
   * `DiceCanvasMulti` já trocou os dados — que é por que a chamada não pode ficar dentro de
   * `rollGroups`, onde o `setGroups` ainda nem passou pelo React. O gatilho é `presetRollSeq`, e não
   * `groups`, pelo motivo no comentário daquele contador.
   */
  useEffect(() => {
    if (!pendingPresetRollRef.current) return
    pendingPresetRollRef.current = false
    multiRef.current?.roll()
  }, [presetRollSeq])

  const isSingleGroup = groups.length === 1
  const singleCount = isSingleGroup ? groups[0].count : 1
  /**
   * O que está NA BANDEJA: durante uma onda de explosão, só os dados que voltaram pra cair de novo;
   * fora dela, a escolha da pessoa, dobrada em vantagem/desvantagem (a cena lança o grupo duas vezes,
   * ver `handleMultiResult`).
   */
  const canvasGroups = ondaDeExplosao ?? (mode === 'normal' ? groups : [...groups, ...groups])

  /**
   * Clicar num tipo de dado ADICIONA um dado desse tipo, em vez de trocar a seleção: é assim que se
   * monta 1d6 + 1d20 pela interface manual, sem passar por um preset. Este é o teto efetivo pra
   * adicionar, com a mesma regra de volta ao modo normal que o `addDie` usa, e decide tanto se o
   * clique funciona quanto se o botão aparece apagado.
   */
  function capForAddingSides(sides: number): number {
    const distinctSidesAfter = new Set([...groups.map((g) => g.sides), sides]).size
    const nextMode: RollMode = distinctSidesAfter > 1 ? 'normal' : mode
    return nextMode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT
  }

  const currentDiceTotal = groups.reduce((sum, g) => sum + g.count, 0)
  /**
   * Rolagem VAZIA: dá pra tirar todos os dados (ver `comContagemAjustada`), e nesse estado o botão de
   * Rolar desliga em vez de rolar coisa nenhuma. O ref existe porque o atalho de teclado é instalado
   * uma vez e enxerga o render em que nasceu — sem ele, tirar o último dado e apertar Espaço ainda
   * rolaria a lista velha.
   */
  const semDados = currentDiceTotal === 0
  const semDadosRef = useRef(semDados)
  semDadosRef.current = semDados

  function addDie(sides: number) {
    if (isRolling) return
    const distinctSidesAfter = new Set([...groups.map((g) => g.sides), sides]).size
    // Vantagem/desvantagem só faz sentido pra um tipo de dado só — assim que a rolagem passa
    // a ter mais de um tipo, volta pro modo normal automaticamente (mesma regra já usada ao
    // carregar um preset).
    const nextMode: RollMode = distinctSidesAfter > 1 ? 'normal' : mode
    const cap = capForAddingSides(sides)
    if (currentDiceTotal >= cap) return
    if (nextMode !== mode) setMode(nextMode)
    // O teto é conferido DE NOVO lá dentro, sobre a lista que o React entrega — ver
    // `comDadoAcrescentado`. A conferência acima serve pra não mexer no modo à toa.
    setGroups((prev) => comDadoAcrescentado(prev, sides, cap))
    setLastResult(null)
  }

  /** Ajusta a contagem de UM grupo específico — remove o grupo se chegar a zero (exceto o último, que nunca fica vazio). */
  function adjustGroupCount(index: number, delta: number) {
    if (isRolling) return
    const cap = mode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT
    setGroups((prev) => comContagemAjustada(prev, index, delta, cap))
    setLastResult(null)
  }

  function removeGroup(index: number) {
    if (isRolling) return
    setGroups((prev) => prev.filter((_, i) => i !== index))
    setLastResult(null)
  }

  function selectMode(newMode: RollMode) {
    setMode(newMode)
    if (newMode !== 'normal' && isSingleGroup && singleCount > ADVANTAGE_MAX_COUNT) {
      setGroups([{ sides: groups[0].sides, count: ADVANTAGE_MAX_COUNT }])
    }
    /**
     * Vantagem e explosão não andam juntas, e o desligamento é automático dos dois lados. Não é
     * limitação técnica escondida: são duas regras que dizem coisas diferentes sobre a MESMA rolagem
     * — vantagem é "role tudo duas vezes e fique com a melhor tentativa", explosão é "este dado
     * continua caindo". Juntas, a pergunta "a tentativa descartada também explode?" não tem resposta
     * que os sistemas concordem, e inventar uma seria o app decidir uma regra de RPG por conta
     * própria. Desligar sozinho é o que ele já faz quando a rolagem passa a ter mais de um tipo.
     */
    if (newMode !== 'normal') setExplode(false)
    setLastResult(null)
  }

  function alternarExplosao(): void {
    setExplode((ligado) => {
      const proximo = !ligado
      if (proximo) setMode('normal')
      return proximo
    })
    setLastResult(null)
  }

  function finalizeResult(bruto: RollResult) {
    /**
     * As marcas de CRÍTICO/FALHA entram AQUI, no funil por onde toda rolagem terminada passa
     * (bandeja, torre, modo rápido, fórmula), pela regra do personagem. É o único lugar em que
     * a face natural ainda é a verdade fresca — depois, quem lê é o histórico e o chat.
     */
    const result = comMarcasDeCritico(bruto, regraDeCritico)
    setLastResult(result)
    setIsRolling(false)
    if (resultPopupEnabled) setResultPopup({ key: result.id, total: result.total })
    if (result.critico || result.falha) {
      // Crítico manda no empate (2d20 com um 20 e um 1): a festa vence o luto.
      const tipo = result.critico ? 'critico' : 'falha'
      if (critVisualEnabled) setEfeitoDeCritico({ key: result.id, tipo })
      if (soundEnabled && critSoundEnabled) (tipo === 'critico' ? tocarCritico : tocarFalha)()
    }
    onRoll({ ...result, sourceName: sourceNameRef.current })
    // Zerado assim que é consumido: a PRÓXIMA rolagem pode ser manual (botão "Rolar"), e sem isto
    // ela herdaria o nome do último preset clicado e apareceria no histórico como se fosse ele.
    sourceNameRef.current = undefined
  }

  function handleSceneError() {
    setIsRolling(false)
    setRollError(true)
  }

  function handleMultiResult(result: MultiRollResult | null) {
    if (result === null) {
      setIsRolling(true)
      return
    }
    /**
     * ROLAGEM DE FÓRMULA: o assentamento alimenta o diário, e a avaliação diz o que vem — outra onda
     * ou o resultado pronto. Vem antes do caminho de sempre porque a sessão é dona da rolagem
     * inteira: as cadeias de explosão da cena não valem aqui, a da fórmula é da gramática.
     */
    const sessao = sessaoDeFormulaRef.current
    if (sessao) {
      // A face entra como caiu; se o tipo não for o pedido, a própria avaliação acusa (falha).
      for (const queda of result.rolls) sessao.faces.push({ lados: queda.sides, face: queda.value })
      const passo = avancarRolagem(sessao.formula, sessao.faces)
      if (passo.tipo === 'precisa') {
        // Mesmo caminho da onda de explosão: troca os dados da cena e arremessa depois do resync.
        setOndaDeExplosao([{ sides: passo.pedido.lados, count: passo.pedido.quantidade }])
        pendingPresetRollRef.current = true
        setPresetRollSeq((n) => n + 1)
        if (soundEnabled) {
          if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
          rollSoundTimeoutRef.current = window.setTimeout(
            () => playRollSound(passo.pedido.quantidade),
            rollSoundDelay(launchMode)
          )
        }
        return
      }
      sessaoDeFormulaRef.current = null
      limparCadeias()
      if (passo.tipo === 'falha') {
        // Diário fora de ordem é defeito do guia, nunca da pessoa — erro visível, não outro número.
        console.error(`A rolagem de fórmula falhou: ${passo.mensagem}`)
        setIsRolling(false)
        setRollError(true)
        return
      }
      finalizeResult(resultadoParaRollResult(sessao.formula, passo.resultado))
      return
    }
    const keep = keepRef.current
    const regraExplosiva = explodeRef.current
    const expression = {
      groups,
      modifiers: modifier !== 0 ? [{ type: 'flat' as const, value: modifier }] : [],
      keep,
      explode: regraExplosiva
    }

    if (mode === 'normal') {
      /**
       * A EXPLOSÃO ACONTECE AQUI, entre uma queda e a próxima. Na primeira, cada dado da bandeja
       * começa uma cadeia; nas seguintes, o que caiu se encaixa nas cadeias que pediram outra chance
       * (ver `encaixarOnda`). Enquanto sobrar dado no máximo a rolagem não termina: os dados voltam
       * pra bandeja e caem de novo, que é o gesto que a mecânica descreve.
       */
      if (cadeiasRef.current.length === 0) {
        cadeiasRef.current = result.rolls.map((queda) => ({ sides: queda.sides, faces: [queda.value] }))
      } else {
        encaixarOnda(cadeiasRef.current, result.rolls, regraExplosiva)
      }

      const proximaOnda = gruposDaProximaOnda(cadeiasRef.current, regraExplosiva)
      if (proximaOnda.length > 0) {
        /**
         * Mesmo caminho da rolagem de preset: troca os dados da cena e só arremessa depois que o
         * resync do filho rodou (ver `pendingPresetRollRef`); chamar `roll()` aqui arremessaria os
         * dados da onda anterior. `isRolling` fica ligado o tempo todo — pra quem está olhando isto é
         * UMA rolagem, e apagar o "Rolando..." entre as ondas piscaria a interface a cada explosão.
         */
        setOndaDeExplosao(proximaOnda)
        pendingPresetRollRef.current = true
        setPresetRollSeq((n) => n + 1)
        if (soundEnabled) {
          if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
          const quantos = proximaOnda.reduce((soma, g) => soma + g.count, 0)
          rollSoundTimeoutRef.current = window.setTimeout(() => playRollSound(quantos), rollSoundDelay(launchMode))
        }
        return
      }

      const porSides = cadeiasParaGrupos(cadeiasRef.current)
      limparCadeias()
      /**
       * O total sai dos dados MANTIDOS quando o preset tem essa regra ("role 3d20 e use o maior", de
       * Ordem Paranormal); sem regra, soma tudo. O `result.total` da cena não serve porque já vem
       * somado, e a conta precisa ver dado por dado. `porSides` continua com TODOS os dados: eles
       * estão na bandeja, à vista.
       */
      finalizeResult({
        id: crypto.randomUUID(),
        label: expressionLabel(expression),
        groups: porSides,
        modifierTotal: modifier,
        total: totalMantido(valoresDosGrupos(porSides), keep) + modifier,
        timestamp: Date.now(),
        keep,
        explode: regraExplosiva
      })
      return
    }

    // Vantagem/desvantagem: a cena rolou o grupo inteiro duas vezes (ver `canvasGroups`),
    // a primeira metade da lista achatada é a tentativa A e a segunda é a tentativa B.
    const half = result.rolls.length / 2
    const attemptA = result.rolls.slice(0, half)
    const attemptB = result.rolls.slice(half)
    const totalA = attemptA.reduce((sum, r) => sum + r.value, 0)
    const totalB = attemptB.reduce((sum, r) => sum + r.value, 0)
    const keepA = mode === 'advantage' ? totalA >= totalB : totalA <= totalB
    const kept = keepA ? attemptA : attemptB
    const keptTotal = keepA ? totalA : totalB

    finalizeResult({
      id: crypto.randomUUID(),
      label: expressionLabel(expression),
      groups: groupRollsBySides(kept),
      modifierTotal: modifier,
      total: keptTotal + modifier,
      timestamp: Date.now(),
      advantageMode: mode,
      // A tentativa perdida vai junto — ver `descartados` em `RollResult`.
      descartados: groupRollsBySides(keepA ? attemptB : attemptA)
    })
  }

  function handleRollClick() {
    if (isRolling || semDadosRef.current) return
    // Rolagem MANUAL não tem nome de golpe. Limpa aqui também (e não só no `finalizeResult`) pro
    // caso de clicar "Rolar" antes de uma rolagem de preset chegar a assentar.
    sourceNameRef.current = undefined
    keepRef.current = undefined
    // A regra da rolagem em curso é a do interruptor NESTE instante; ver `explodeRef`.
    explodeRef.current = explode ? { maxChain: MAX_EXPLOSOES_POR_DADO } : undefined
    limparCadeias()
    // Rolagem manual por cima de uma de fórmula: a sessão velha não pode capturar o assentamento.
    sessaoDeFormulaRef.current = null
    setRollError(false)
    setResultPopup(null)

    // Sem bandeja não há espera: o resultado sai no mesmo clique, e `isRolling` nunca chega a ligar.
    if (semFisica) {
      rolarSemFisica(groups, modifier, undefined, explodeRef.current, mode)
      return
    }

    setIsRolling(true)
    multiRef.current?.roll()
    // Som com atraso (ver `ROLL_SOUND_DELAY_MS`), não no assentamento final (`finalizeResult`).
    if (soundEnabled) {
      if (rollSoundTimeoutRef.current !== null) window.clearTimeout(rollSoundTimeoutRef.current)
      const diceCount = canvasGroups.reduce((sum, g) => sum + g.count, 0)
      rollSoundTimeoutRef.current = window.setTimeout(() => playRollSound(diceCount), rollSoundDelay(launchMode))
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      /**
       * Duas guardas que faltavam, e que juntas explicam o relato "não consigo digitar em nada":
       *
       * 1. `shortcutsEnabled`: a aba de rolagem fica montada e escondida ao trocar de aba, então este
       *    ouvinte continuava na janela inteira e rolava os dados de dentro das Anotações;
       * 2. foco em campo de texto: Espaço e Enter são digitação lá dentro, e o `preventDefault`
       *    abaixo os engolia — a pessoa apertava espaço e não saía nada.
       */
      if (!shortcutsEnabled) return
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return
      if (e.repeat || isRolling || document.querySelector('.modal-overlay')) return
      // Foco atual E alvo original: o Enter que confirma a condição/valor no HUD desmonta o
      // campo antes de o evento chegar aqui, e só o `activeElement` deixava a rolagem disparar
      // — ver `teclaVeioDeDigitacao`.
      if (teclaVeioDeDigitacao(e)) return
      const active = document.activeElement
      if (active instanceof HTMLButtonElement && e.code === 'Space') return
      e.preventDefault()
      handleRollClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // `handleRollClick` é recriado a cada render (ele lê grupos, modo, modificador e explosão do
    // render atual), e listá-lo aqui reinstalaria o ouvinte de teclado a cada clique num contador. Ele
    // é instalado uma vez e chama a versão do render em que nasceu, o que basta porque as duas coisas
    // que decidem se ele AGE (`isRolling` e `shortcutsEnabled`) estão na lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRolling, shortcutsEnabled])

  return (
    <div className="dice-roller-3d">
      <div className="dice-roller-3d-controls">
        {/*
          Duas caixas de grupo em vez de três linhas soltas de botão: "Tipo de dado" é o que ENTRA
          na rolagem, "Rolagem" é como ela sai (quantidade, modo, modificador) — com o "Rolar"
          isolado na ponta direita, do tamanho da caixa inteira, pra nunca se confundir com os
          botões de ajuste ao lado.
        */}
        <fieldset className="dice-roller-3d-group dice-roller-3d-group-dice">
          <legend>{t.roller.typeLabel}</legend>
          <div className="dice-roller-3d-types">
            {DEFAULT_DICE_SIDES.map((sides) => {
              const atCap = currentDiceTotal >= capForAddingSides(sides)
              return (
                <Button
                  key={sides}
                  selected={groups.some((g) => g.sides === sides)}
                  onClick={() => addDie(sides)}
                  disabled={isRolling || atCap}
                  title={
                    atCap
                      ? t.roller.maxDiceReachedHint.replace('{max}', String(MAX_SIMULTANEOUS_DICE))
                      : t.roller.addDieHint
                  }
                >
                  d{sides}
                </Button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="dice-roller-3d-group dice-roller-3d-group-roll">
          <legend>{t.roller.rollGroupTitle}</legend>
          <div className="dice-roller-3d-roll-body">
            <div className="dice-roller-3d-roll-options">
              <div className="dice-roller-3d-groups">
                {/*
                  Bandeja vazia diz o que fazer. Sem esta linha sobra uma faixa em branco onde
                  antes havia um chip, e "sumiu tudo" lê como defeito em vez de estado.
                */}
                {semDados && <span className="dice-roller-3d-sem-dados">{t.roller.noDiceHint}</span>}
                {groups.map((group, index) => (
                  <div key={`${group.sides}-${index}`} className="dice-roller-3d-group-chip">
                    <span>
                      {group.count}×d{group.sides}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => adjustGroupCount(index, -1)}
                      disabled={isRolling}
                      aria-label="-"
                    >
                      -
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => adjustGroupCount(index, 1)}
                      disabled={isRolling || currentDiceTotal >= (mode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT)}
                      aria-label="+"
                      title={
                        currentDiceTotal >= (mode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT)
                          ? t.roller.maxDiceReachedHint.replace('{max}', String(MAX_SIMULTANEOUS_DICE))
                          : undefined
                      }
                    >
                      +
                    </Button>
                    {/*
                      O ✕ aparece SEMPRE, inclusive no único grupo da lista. Ele sumia quando
                      sobrava um só, e era justamente aí que ele fazia mais falta: pra trocar de
                      dado era preciso decrementar até 1 e só então clicar noutro tipo. Tirar tudo é
                      um estado legítimo agora — quem impede a rolagem vazia é o botão de Rolar.
                    */}
                    <Button
                      variant="ghost"
                      onClick={() => removeGroup(index)}
                      disabled={isRolling}
                      aria-label="✕"
                      title={t.roller.removeDieGroup}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              <div className="dice-roller-3d-row">
                {isSingleGroup && (
                  <div className="dice-roller-3d-mode">
                    {(['normal', 'advantage', 'disadvantage'] as const).map((m) => (
                      <Button
                        key={m}
                        selected={mode === m}
                        onClick={() => selectMode(m)}
                        disabled={isRolling}
                      >
                        {t.roller.mode[m]}
                      </Button>
                    ))}
                  </div>
                )}

                {/*
                  Fora do `isSingleGroup`: explodir vale pra qualquer rolagem, inclusive misturando
                  tipos (2d6 + 1d20 com os dois explodindo é o normal em vários sistemas). É o que o
                  separa da vantagem, que só faz sentido com um tipo só.

                  E só com perfil de D&D (`explodeVisivel`) — ver o comentário da prop.
                */}
                {(explodeVisivel ?? true) && (
                  <div className="dice-roller-3d-mode">
                    <Button
                      selected={explode}
                      onClick={alternarExplosao}
                      disabled={isRolling}
                      title={t.roller.explodeHint}
                    >
                      <IconeReroll tamanho={14} className="dice-roller-3d-icone" />
                      {t.roller.explode}
                    </Button>
                  </div>
                )}

                {/*
                  `div` e não `label`: o rótulo roubaria o clique dos botões pro campo de dentro
                  dele, e aí apertar "−" só focaria o texto. Mesmo motivo do seletor de fonte nas
                  Preferências.
                */}
                <div className="dice-roller-3d-modifier">
                  <span>{t.roller.modifier}</span>
                  {/*
                    MENOS e MAIS no lugar das setinhas do `type="number"`, a pedido do usuário. As
                    setas do navegador são minúsculas, empilhadas e não dizem o que fazem; e o campo
                    continua digitável, que é a outra metade do pedido.
                  */}
                  <div className="dice-roller-3d-modifier-campo">
                    <Button
                      variant="ghost"
                      className="dice-roller-3d-modifier-btn"
                      aria-label={t.roller.modifierMinus}
                      title={t.roller.modifierMinus}
                      disabled={isRolling}
                      onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, -1))}
                    >
                      −
                    </Button>
                    <input
                      /**
                       * `text`, e não `number`. O campo numérico do navegador não deixa guardar um
                       * estado intermediário — o traço sozinho, ou o campo vazio —, e era isso que
                       * impedia digitar modificador negativo.
                       */
                      type="text"
                      inputMode="numeric"
                      value={textoDoModificador}
                      onChange={(e) => {
                        const bruto = e.target.value.trim()
                        if (textoDeModificadorAceito(bruto)) setTextoDoModificador(bruto)
                      }}
                      /**
                       * Ao sair do campo, o texto é normalizado pelo número que ele vale: quem
                       * deixou só um "-" ou o campo vazio vê "0" no lugar, em vez de um campo que
                       * mostra uma coisa e vale outra.
                       */
                      onBlur={() => setTextoDoModificador(String(modifier))}
                      aria-label={t.roller.modifier}
                    />
                    <Button
                      variant="ghost"
                      className="dice-roller-3d-modifier-btn"
                      aria-label={t.roller.modifierPlus}
                      title={t.roller.modifierPlus}
                      disabled={isRolling}
                      onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/*
              O crachá do personagem (foto e nome) morou aqui, encostado no ROLAR, até 02/09/2026 —
              pedido dele: "tirar o nome e foto de perfil do lado do rolar e deixar apenas no HUD".
              Quem diz de quem são os dados agora é só o HUD sobre a cena.
            */}
            <Button
              variant="primary"
              className="dice-roller-3d-roll-btn"
              onClick={handleRollClick}
              disabled={isRolling || semDados}
              title={semDados ? t.roller.noDiceHint : undefined}
            >
              {t.roller.rollButton}
            </Button>
          </div>
        </fieldset>
      </div>

      {semFisica ? (
        /*
          MODO RÁPIDO: no lugar da bandeja, o número. Sem `DiceCanvasMulti` montado — não é só
          escondê-lo com CSS: a cena custa um `WebGLRenderer`, um mundo de física e as texturas
          todas, e mantê-la viva atrás de um `display: none` gastaria exatamente o que este modo
          existe pra não gastar.
        */
        <div className="dice-roller-3d-quick">
          {!temWebgl && <p className="dice-roller-3d-quick-aviso">{t.roller.quickForced}</p>}
          <span className="dice-roller-3d-quick-label">{t.roller.total}</span>
          <span className="dice-roller-3d-quick-total">{lastResult ? lastResult.total : <>&nbsp;</>}</span>
          {lastResult && <span className="dice-roller-3d-quick-expr">{lastResult.label}</span>}
          {/* O HUD (nome, barras, lápis) também aqui: sem isto o modo rápido ficava sem ele. */}
          {overlay}
        </div>
      ) : (
      <div className="dice-roller-3d-canvas">
        <DiceCanvasMulti
          // `groups`/`canvasGroups` não entram no `key` no modo bandeja: trocar tipo ou quantidade
          // resincroniza os dados no lugar (ver o efeito de resync em `DiceCanvasMulti.tsx`).
          /**
           * Só o modo de debug, o de lançamento e a FORMA remontam a cena. A forma entra porque
           * parede física, chão e plataforma são construídos na montagem: trocar de hexágono pra
           * círculo sem remontar deixaria o collider antigo contendo dados dentro de outro desenho.
           *
           * A torre remontava por completo a cada dado e a cada preset, de quando ela era o mecanismo
           * antigo, com cena própria. Hoje os dois modos usam a mesma bandeja e o mesmo mundo físico,
           * e o custo era alto: remontar refaz a cena (20ms), a torre com as texturas (20ms) e um
           * `WebGLRenderer` novo (15ms), e o primeiro quadro recompila os shaders, num pico de 290ms.
           * É o "fica meio lagado quando bota mais dados" que ele reportou.
           */
          key={`${debugMode}-${launchMode}-${trayShape}`}
          ref={multiRef}
          groups={canvasGroups as { sides: PhysicalDiceSides; count: number }[]}
          onResult={handleMultiResult}
          onError={handleSceneError}
          autoRoll={autoRollArm}
          diceColors={resolvedDiceColors}
          material={diceMaterial}
          flor1={resinFlower1}
          flor2={resinFlower2}
          wallColor={hexStringToNumber(wallColor)}
          backgroundColor={hexStringToNumber(backgroundColor)}
          floorColor={hexStringToNumber(floorColor)}
          towerColors={{
            stone: hexStringToNumber(towerStoneColor),
            roof: hexStringToNumber(towerRoofColor),
            flag: hexStringToNumber(towerFlagColor),
            door: hexStringToNumber(towerDoorColor)
          }}
          backgroundImage={backgroundImage}
          launchMode={launchMode}
          traySides={TRAY_SHAPE_SIDES[trayShape]}
          debugMode={debugMode}
          caseOpen={caseOpen}
          onCaseClick={() => setCaseOpen((open) => !open)}
          bridgeOpen={bridgeOpen}
          onBridgeClick={() => setBridgeOpen((aberta) => !aberta)}
          // Fora do `key` acima de propósito: trocar o modo de câmera não remonta a cena.
          cameraMode={cameraMode}
        />
        {/* Sobreposto à cena, não numa aba: é um controle que se mexe olhando a cena. */}
        <CameraModeSwitch />
        {overlay}
        {resultPopup && (
          <div
            key={resultPopup.key}
            className="dice-result-popup"
            /*
              Só o ACENTO (borda e brilho) sai das cores da pessoa. O texto do painel é branco fixo
              — ver o comentário de `.dice-result-popup-label`: quando ele seguia a cor do dado,
              bastava um dado escuro pra a palavra "TOTAL" sumir no painel preto.
            */
            style={{ '--popup-accent': wallColor } as CSSProperties}
            onAnimationEnd={() => setResultPopup(null)}
          >
            <span className="dice-result-popup-label">{t.roller.total}</span>
            <span className="dice-result-popup-value">{resultPopup.total}</span>
          </div>
        )}
        {/*
          O clarão de crítico/falha (spec §3.7): painel no centro da cena com oito faíscas quadradas
          voando (crítico) ou o painel escuro tremendo (falha). Um segundo, `pointer-events: none`
          — nunca segura o número nem a próxima rolagem.
        */}
        {efeitoDeCritico && (
          <div
            key={efeitoDeCritico.key}
            className={`dice-crit ${efeitoDeCritico.tipo === 'critico' ? 'dice-crit-critico' : 'dice-crit-falha'}`}
            aria-hidden="true"
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setEfeitoDeCritico(null)
            }}
          >
            {efeitoDeCritico.tipo === 'critico' &&
              Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="dice-crit-faisca" style={{ '--angulo': `${i * 45}deg` } as CSSProperties} />
              ))}
            <span className="dice-crit-texto">
              {efeitoDeCritico.tipo === 'critico' ? `⭐ ${t.roller.critical}` : `💀 ${t.roller.fumble}`}
            </span>
          </div>
        )}
      </div>
      )}

      <div className="dice-roller-3d-result">
        {rollError && <span className="dice-roller-3d-error">{t.roller.rollError}</span>}
        {!rollError && !lastResult && !isRolling && <span>{t.roller.resultEmpty}</span>}
        {!rollError && isRolling && <span>{t.roller.rolling}</span>}
        {!rollError && !isRolling && lastResult && (
          <span>
            {t.roller.results}:{' '}
            {lastResult.groups.flatMap((g) => g.rolls.map((value) => ({ sides: g.sides, value }))).map((roll, i) => {
              const color = colorForDice(roll.sides)
              return (
                <span key={i}>
                  {i > 0 && ' + '}
                  <span
                    className="dice-roll-value"
                    style={{ background: color.bg, color: color.text }}
                    title={`d${roll.sides}`}
                  >
                    {roll.value}
                  </span>
                </span>
              )
            })}
            {modifier !== 0 && (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`)} |{' '}
            {t.roller.total}: <strong>{lastResult.total}</strong>
            <MarcaDeCritico result={lastResult} className="dice-roller-3d-marca" />
            {lastResult.advantageMode && (
              <>
                {' '}
                {lastResult.advantageMode === 'advantage'
                  ? t.roller.advantageSuffix
                  : t.roller.disadvantageSuffix}
              </>
            )}
            {/* A linha pro chat da mesa (spec §3.5) — ver `linhaParaChat.ts`. */}
            <BotaoCopiar texto={() => linhaParaChat(lastResult, copyMarkdown, rotulosDoChat(t))} />
          </span>
        )}
        {/*
          O atalho pro histórico, pequeno e na ponta da linha da soma — o pedido mudou de lugar: ele
          nasceu ao lado do ROLAR e o usuário pediu "pequeno, do lado do resultado ali na soma".
          Fora dos condicionais de propósito: o histórico existe mesmo antes da primeira rolagem.
        */}
        {onOpenHistory && (
          <Button className="dice-roller-3d-history-btn" onClick={onOpenHistory}>
            {t.roller.historyButton}
          </Button>
        )}
      </div>
    </div>
  )
})
