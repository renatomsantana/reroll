import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { DiceGroup, DiceGroupResult, ExplodeRule, KeepRule, RollResult } from '@shared/types/dice'
import { totalMantido, valoresDosGrupos } from '@shared/dice/manterDados'
import {
  modificadorDoTexto,
  textoDeModificadorAceito,
  textoDoModificadorAjustado
} from '@shared/dice/modificador'
import { rollExpression, rollWithMode } from '@renderer/domain/dice/diceEngine'
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
import { isTypingTarget } from '@renderer/utils/isTyping'
import { TRAY_SHAPE_SIDES } from '@renderer/dice3d/geometry/trayShape'
import { Button } from '../common/Button'
import { CameraModeSwitch } from './CameraModeSwitch'
import './DiceRoller3D.css'

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
}

const DEFAULT_GROUPS: DiceGroup[] = [{ sides: 20, count: 1 }]

/**
 * Em vantagem/desvantagem cada tentativa lança o grupo inteiro de novo (igual ao roller
 * antigo), então o total de dados na cena dobra — o limite de contagem manual precisa
 * cair pela metade do limite geral da cena pra nunca estourar `MAX_SIMULTANEOUS_DICE`.
 */
const ADVANTAGE_MAX_COUNT = Math.floor(MAX_SIMULTANEOUS_DICE / 2)

/**
 * Atraso (ms) entre clicar em "Rolar"/preset e o som de rolagem tocar — pedido do usuário, pra soar
 * junto do impacto dos dados na bandeja, em vez do instante do clique.
 *
 * É MENOR pela torre, a pedido: de lá o dado nasce na boca, a 0.35 acima da borda, e cai direto
 * dentro do hexágono; no arremesso de cima ele nasce entre 6 e 8 de altura e ainda cruza a bandeja
 * inteira antes de bater. São dois tempos de voo diferentes, e um atraso único deixava o som atrasado
 * num dos dois casos.
 *
 * O valor da torre foi por OUVIDO, em duas rodadas: 800ms ainda soou tarde e o usuário pediu 400.
 * Fica um pouco ANTES do primeiro impacto, e isso é escolha dele, não coincidência com a física: o
 * dado sai da boca sem impulso vertical e cai de 2.15 até ~0.27 sob gravidade 13, o que dá ~0.54s
 * até encostar. A 400ms o som começa com o primeiro dado ainda no ar — o que faz sentido, porque o
 * ruído de uma torre de dados começa ANTES de o dado tocar a bandeja, e porque atrás dele vêm os
 * outros da fila, um a cada 140ms.
 *
 * Se um dia parecer cedo demais, o piso natural é ~540ms (o impacto de verdade); abaixo disso o som
 * antecede qualquer coisa acontecendo na tela.
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
 * Um dado da rolagem e as faces que ele já mostrou. Sem explosão a lista tem um elemento só.
 *
 * A cena 3D não sabe explodir sozinha: ela lança um punhado de dados e diz onde cada um parou. A
 * explosão é ENCENADA por cima disso, em ondas — assentou, algum tirou o máximo? então os que
 * tiraram voltam pra bandeja e caem de novo. É o mesmo gesto de quem joga na mesa, e o preço é este
 * acumulador aqui, que amarra a segunda queda de um dado à primeira.
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
 * Encaixa o resultado de uma onda nas cadeias que a pediram.
 *
 * O casamento é POR TIPO DE DADO, e não por posição: a cena monta os dados agrupados por tipo e não
 * promete devolver na mesma ordem em que os dados estavam antes. Casar por posição funcionaria hoje
 * e quebraria calado no dia em que a ordem mudasse — e "quebrar calado" aqui é um d6 herdando a
 * segunda queda de um d20.
 */
export function encaixarOnda(cadeias: DadoEmCadeia[], onda: { sides: number; value: number }[], regra: ExplodeRule | undefined): void {
  /**
   * UMA QUEDA POR DADO NESTA ONDA — e este conjunto é o que garante isso.
   *
   * Sem ele há um defeito que o teste pegou e que não daria erro nenhum em produção: um dado que
   * recebe a face máxima de novo CONTINUA elegível, então o segundo dado da mesma onda encontrava o
   * primeiro de novo e empilhava tudo nele. Com 3d6 explodindo dois, um dado ficava com a cadeia
   * inteira e o outro com nada — total certo por acaso na maioria das vezes, e errado assim que a
   * regra de manter entrasse na conta.
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
 * ACRESCENTAR um dado de `sides`, respeitando o teto. Devolve a MESMA lista quando não cabe.
 *
 * Pura e exportada por causa de um defeito medido no app rodando: o teto era conferido ANTES do
 * `setGroups`, lendo a lista do render anterior. Cliques rápidos no "+" são agrupados pelo React
 * num lote só — todos enxergam o mesmo valor velho, a conta nunca alcança o teto, e a rolagem
 * chega a 31 dados num app cujo limite é 20. Medido exatamente assim: trinta cliques seguidos.
 *
 * Conferindo aqui dentro, quem manda é a lista que o React entrega (`prev`), que é sempre a mais
 * recente — inclusive no meio de um lote. E devolver `prev` sem tocar mantém a função pura, que é o
 * contrato de quem é passado pro `setState` (o React pode chamá-la mais de uma vez).
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
 * O último grupo era intocável — "a tela ficaria sem nada pra rolar" —, e o usuário pediu o
 * contrário: "vamos deixar a opção de remover todos os dados, mas aí o botão de Rolar não
 * funciona. Que seja fácil retirar e trocar de dados". A trava resolvia o problema errado: ficar
 * sem dados não é um estado inválido, é o caminho normal pra trocar 3d6 por 1d20 sem ter que
 * decrementar até 1 e só então poder mexer. Quem impede a rolagem vazia é o botão de Rolar, que
 * desliga sozinho — ver `semDados` no componente.
 *
 * Mesmo motivo de `comDadoAcrescentado` pro teto ser conferido aqui dentro.
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
 * O roller 3D "de verdade" (Fase 10) — substitui a rolagem instantânea por
 * RNG no modo completo do app. Sempre produz um `RollResult` no mesmo
 * formato que o sistema antigo já usava, então Histórico e Presets
 * continuam funcionando sem precisar mudar nada neles: só troca COMO o
 * resultado é gerado (física real em vez de `Math.random`), não o formato
 * dos dados guardados.
 *
 * O d100 é só mais um tipo de dado aqui (100 faces, ver `d100Sphere.ts`) —
 * não há mais um caso especial de "dois d10" com sua própria cena/UI; ele
 * passa pelo mesmo `DiceCanvasMulti` que qualquer outro dado, então ganha
 * contador de quantidade e vantagem/desvantagem de graça.
 *
 * O modo compacto da janela continua usando o roller antigo (2D, instantâneo)
 * — uma cena 3D precisa de espaço de verdade pra fazer sentido, e a janela
 * compacta (300×230) foi desenhada de propósito pra ser minúscula.
 */
export const DiceRoller3D = forwardRef<DiceRoller3DHandle, DiceRoller3DProps>(function DiceRoller3D(
  { onRoll, onRollingChange, shortcutsEnabled = true },
  ref
) {
  const t = useTranslation()
  const {
    diceBodyColor,
    diceNumberColor,
    diceMaterial,
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
    displayMode
  } = useSettings()
  const multiRef = useRef<DiceCanvasMultiHandle>(null)
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
   * Incrementado a CADA rolagem de preset, nos dois modos. Na torre ele continua entrando no `key`
   * de `DiceCanvasMulti` (a torre tem fila/parqueamento próprios e remonta de qualquer jeito
   * quando os grupos mudam); na BANDEJA ele saiu do `key` a pedido do usuário — remontar a cena a
   * cada preset reconstruía física, texturas e dados e, o que incomodava de verdade, jogava a
   * CÂMERA de volta pro enquadramento padrão.
   *
   * Na bandeja ele virou o GATILHO do efeito que dispara a rolagem. Tem que ser um contador, e não
   * a referência de `groups`: se o preset entrega o mesmo array de grupos de sempre (é o caso de
   * clicar o mesmo preset duas vezes), `setGroups` recebe uma referência igual, o React descarta a
   * atualização, nenhum efeito roda e a rolagem simplesmente não acontece — deixando a interface
   * travada em "Rolando..." pra sempre. Contador sempre muda.
   */
  const [presetRollSeq, setPresetRollSeq] = useState(0)
  /**
   * Rolagem de preset pendente na BANDEJA. Não dá pra chamar `roll()` direto no handler: o
   * `setGroups` desta mesma função ainda não passou pelo React, então `roll()` arremessaria o
   * conjunto de dados ANTIGO e a resincronização trocaria os dados no meio do arremesso. O efeito
   * abaixo dispara depois que o resync do filho já rodou — efeitos de componente-filho rodam antes
   * dos do pai, e é exatamente essa ordem que garante que os dados certos já estão na cena.
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
   * Estojo de dados atrás da bandeja aberto/fechado. A ÚNICA forma de mexer nisso é clicando no
   * próprio estojo dentro da cena 3D (`onCaseClick` abaixo) — existia um botão "Abrir/Fechar
   * estojo" nesta barra e o usuário pediu pra tirar: clicar na caixinha é a interação que ele
   * quer, e um botão a mais na barra do roller só competia com o "Rolar".
   *
   * Estado do componente e não das Preferências: é uma brincadeira da cena, não uma configuração
   * que valha a pena persistir. Fica FORA do `key` de `DiceCanvasMulti` de propósito —
   * abrir/fechar anima na cena existente, sem remontar nada.
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
   * DADOS EXPLOSIVOS: liga/desliga por rolagem, do lado do botão de vantagem/desvantagem.
   *
   * Fica no componente e não nas Preferências porque é escolha DA ROLAGEM, não do app — a spec pede
   * "configurável por rolagem" justamente porque cada sistema de RPG usa a sua, e quem joga dois
   * sistemas na mesma semana troca o tempo todo.
   */
  const [explode, setExplode] = useState(false)
  /** A regra da rolagem EM CURSO — mesma razão do `keepRef`: ela é lida quando os dados assentam. */
  const explodeRef = useRef<ExplodeRule | undefined>(undefined)
  /**
   * A onda de explosão que está na cena AGORA, ou `null` quando é a queda normal.
   *
   * Ela substitui os grupos que vão pra bandeja sem tocar em `groups` — e essa separação é o ponto:
   * `groups` é a ESCOLHA da pessoa, mostrada nos contadores da barra. Se a onda mexesse nele, a
   * seleção de dados dela mudaria sozinha no meio da rolagem.
   */
  const [ondaDeExplosao, setOndaDeExplosao] = useState<DiceGroup[] | null>(null)
  /** O que cada dado desta rolagem já mostrou, entre uma onda e outra. Ver `DadoEmCadeia`. */
  const cadeiasRef = useRef<DadoEmCadeia[]>([])

  /** Começa uma rolagem do zero: nenhuma onda pendente, nenhuma cadeia herdada da anterior. */
  function limparCadeias(): void {
    cadeiasRef.current = []
    setOndaDeExplosao(null)
  }

  /**
   * A máquina desenha a bandeja? Perguntado UMA vez, no primeiro render.
   *
   * Quando não desenha, o app cai no modo rápido SEM PERGUNTAR e diz por quê na tela. É a
   * degradação graciosa da spec (5.8): antes disto, um notebook com driver de vídeo velho abria o
   * app, tentava montar a cena, falhava, e a pessoa ficava com um programa de rolar dados no qual
   * não dava pra rolar dado.
   */
  const [temWebgl] = useState(webglDisponivel)
  /** O modo QUE ESTÁ VALENDO: a escolha da pessoa, ou o rápido à força quando não há 3D possível. */
  const modoEfetivo: DisplayMode = temWebgl ? displayMode : 'quick'
  const semFisica = modoEfetivo === 'quick'

  /**
   * A rolagem SEM FÍSICA — o mesmo cálculo da bandeja, resolvido na hora.
   *
   * É o `rollExpression` de sempre, que é também o que o modo compacto já usava (ver
   * `handleCompactPresetRoll` em `App.tsx`). O que muda no modo rápido é só de onde vem o número:
   * de `crypto.getRandomValues` em vez das faces que os dados mostraram na bandeja. Vantagem,
   * manter e explosão continuam valendo, porque quem sabe fazer as três é o motor.
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

  // Avisa o pai (`App.tsx`) sempre que `isRolling` muda — usado pra desabilitar as ações de
  // preset (editar/excluir/rolar outro) enquanto qualquer rolagem está em andamento. Um efeito
  // separado em vez de chamar `onRollingChange` em cada `setIsRolling(...)` espalhado pelo
  // arquivo, pra ter um único lugar responsável por essa notificação.
  useEffect(() => {
    onRollingChange?.(isRolling)
  }, [isRolling, onRollingChange])
  /**
   * Clicar num preset É a própria ação de rolar (não tem um segundo clique em "Rolar"
   * depois) — essa flag avisa o PRÓXIMO mount de `DiceCanvasMulti` (forçado pela troca de
   * `groups`/`key` logo abaixo) que o arremesso automático dele já conta como rolagem de
   * verdade. Se autozera logo depois (efeito abaixo) pra não "vazar" pro mount seguinte de
   * uma troca manual de tipo/cor/modo, que não deve auto-rolar.
   */
  const [autoRollArm, setAutoRollArm] = useState(false)

  useEffect(() => {
    if (autoRollArm) setAutoRollArm(false)
  }, [autoRollArm])

  useImperativeHandle(ref, () => ({
    rollGroups: (newGroups, newModifier, sourceName, keep, explodeDoPreset) => {
      /**
       * A BANDEJA aceita preset a qualquer momento, inclusive por cima de uma rolagem em
       * andamento — pedido do usuário ("que aconteça a qualquer momento"). Antes havia um
       * `if (isRolling) return` aqui, e ele existia por causa do remount: trocar de preset no meio
       * da rolagem destruía a cena, a rolagem em curso nunca reportava resultado e a UI travava em
       * "Rolando..." pra sempre. Sem remount, arremessar por cima é só arremessar de novo.
       *
       * A TORRE continua recusando: lá a rolagem é uma FILA (um dado de cada vez, com
       * parqueamento), e cortá-la no meio deixa dados presos no estado de espera.
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
    }
  }))

  /**
   * Dispara a rolagem de preset DEPOIS que os dados novos já estão na cena — nos dois modos.
   *
   * Efeitos de componente-filho rodam antes dos do pai, então quando este aqui executa o resync de
   * `DiceCanvasMulti` já trocou os dados — que é justamente por que a chamada não pode ficar
   * dentro de `rollGroups` (lá o `setGroups` ainda nem passou pelo React, e `roll()` arremessaria
   * o conjunto antigo).
   *
   * O gatilho é `presetRollSeq`, e não `groups`, pelo motivo no comentário daquele contador.
   */
  useEffect(() => {
    if (!pendingPresetRollRef.current) return
    pendingPresetRollRef.current = false
    multiRef.current?.roll()
  }, [presetRollSeq])

  const isSingleGroup = groups.length === 1
  const singleCount = isSingleGroup ? groups[0].count : 1
  /** Em vantagem/desvantagem a cena lança o grupo duas vezes; ver `handleMultiResult`. */
  /**
   * O que está NA BANDEJA. Durante uma onda de explosão são só os dados que voltaram pra cair de
   * novo; fora dela, a escolha da pessoa (dobrada em vantagem/desvantagem).
   */
  const canvasGroups = ondaDeExplosao ?? (mode === 'normal' ? groups : [...groups, ...groups])

  /**
   * Clicar num tipo de dado ADICIONA um dado desse tipo à rolagem (em vez de substituir a
   * seleção atual por ele) — é assim que dá pra montar uma rolagem com tipos diferentes
   * (ex.: 1d6 + 1d20) direto pela UI manual, sem precisar passar por um preset. Se o tipo já
   * está presente, só incrementa a contagem dele.
   */
  /** Cap efetivo pra ADICIONAR um dado do tipo `sides` — reflete a mesma regra de troca automática pra modo normal usada dentro de `addDie` (ver comentário lá), pra decidir tanto se o clique deve funcionar quanto se o botão deve aparecer desabilitado. */
  function capForAddingSides(sides: number): number {
    const distinctSidesAfter = new Set([...groups.map((g) => g.sides), sides]).size
    const nextMode: RollMode = distinctSidesAfter > 1 ? 'normal' : mode
    return nextMode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT
  }

  const currentDiceTotal = groups.reduce((sum, g) => sum + g.count, 0)
  /**
   * Rolagem VAZIA: dá pra tirar todos os dados (ver `comContagemAjustada`), e nesse estado o botão
   * de Rolar desliga em vez de rolar coisa nenhuma.
   *
   * O ref existe porque o atalho de teclado (Enter/Espaço) é instalado uma vez e enxerga o render
   * em que nasceu — sem ele, tirar o último dado e apertar Espaço ainda rolaria a lista velha.
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
     * VANTAGEM E EXPLOSÃO NÃO ANDAM JUNTAS, e o desligamento é automático dos dois lados.
     *
     * Não é limitação técnica escondida: são duas regras que dizem coisas diferentes sobre a MESMA
     * rolagem. Vantagem é "role tudo duas vezes e fique com a melhor tentativa"; explosão é "este
     * dado continua caindo". Juntas, a pergunta "a tentativa descartada também explode?" não tem
     * resposta que os sistemas concordem — e inventar uma seria o app decidir uma regra de RPG por
     * conta própria.
     *
     * Desligar sozinho é a mesma escolha que o app já faz quando a rolagem passa a ter mais de um
     * tipo de dado (ver `addDie`): a opção some em vez de ficar ligada sem efeito.
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

  function finalizeResult(result: RollResult) {
    setLastResult(result)
    setIsRolling(false)
    if (resultPopupEnabled) setResultPopup({ key: result.id, total: result.total })
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
       * A EXPLOSÃO ACONTECE AQUI, entre uma queda e a próxima.
       *
       * Primeira queda: cada dado da bandeja começa uma cadeia. Quedas seguintes: o que caiu se
       * encaixa nas cadeias que pediram outra chance (ver `encaixarOnda`). Enquanto sobrar dado no
       * máximo, a rolagem NÃO termina — os dados voltam pra bandeja e caem de novo, que é o gesto
       * que a mecânica descreve.
       */
      if (cadeiasRef.current.length === 0) {
        cadeiasRef.current = result.rolls.map((queda) => ({ sides: queda.sides, faces: [queda.value] }))
      } else {
        encaixarOnda(cadeiasRef.current, result.rolls, regraExplosiva)
      }

      const proximaOnda = gruposDaProximaOnda(cadeiasRef.current, regraExplosiva)
      if (proximaOnda.length > 0) {
        /**
         * Mesmo caminho da rolagem de preset: troca os dados da cena e só arremessa DEPOIS que o
         * resync do filho rodou (ver `pendingPresetRollRef`). Chamar `roll()` aqui arremessaria os
         * dados da onda anterior.
         *
         * `isRolling` continua ligado o tempo todo: pra quem está olhando isto é UMA rolagem, e
         * apagar o "Rolando..." entre as ondas piscaria a interface a cada explosão.
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
       * O total sai dos dados MANTIDOS quando o preset tem essa regra — "role 3d20 e use o maior",
       * de Ordem Paranormal. Sem regra, `totalMantido` soma tudo e o resultado é o de sempre.
       *
       * `result.total` da cena não serve aqui porque ele já vem somado; a conta precisa ver dado por
       * dado. E `porSides` continua com TODOS os dados: eles estão na bandeja, à vista.
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
      advantageMode: mode
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
       * DUAS guardas que faltavam, e que juntas explicam o relato "não consigo digitar em nada".
       *
       * 1. `shortcutsEnabled`: a aba de rolagem fica MONTADA e escondida ao trocar de aba (pra não
       *    reconstruir a cena 3D), então este ouvinte continuava na janela inteira e rolava os dados
       *    de dentro das Anotações;
       * 2. foco em campo de texto: Espaço e Enter são digitação lá dentro, e o `preventDefault`
       *    abaixo os engolia — a pessoa apertava espaço e não saía nada, só um dado rolando numa aba
       *    que ela nem estava vendo.
       */
      if (!shortcutsEnabled) return
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return
      if (e.repeat || isRolling || document.querySelector('.modal-overlay')) return
      const active = document.activeElement
      if (isTypingTarget(active)) return
      if (active instanceof HTMLButtonElement && e.code === 'Space') return
      e.preventDefault()
      handleRollClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // `handleRollClick` é recriado a cada render (ele lê grupos, modo, modificador e explosão do
    // render atual), e listá-lo aqui significaria remover e reinstalar o ouvinte de teclado a cada
    // clique num contador de dados. O ouvinte é instalado uma vez e sempre chama a versão do render
    // em que foi criado — o que basta porque as duas coisas que decidem se ele AGE (`isRolling` e
    // `shortcutsEnabled`) estão na lista.
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
                */}
                <div className="dice-roller-3d-mode">
                  <Button
                    selected={explode}
                    onClick={alternarExplosao}
                    disabled={isRolling}
                    title={t.roller.explodeHint}
                  >
                    {t.roller.explode}
                  </Button>
                </div>

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
          <span className="dice-roller-3d-quick-total">{lastResult ? lastResult.total : '—'}</span>
          {lastResult && <span className="dice-roller-3d-quick-expr">{lastResult.label}</span>}
        </div>
      ) : (
      <div className="dice-roller-3d-canvas">
        <DiceCanvasMulti
          // `groups`/`canvasGroups` NÃO entram mais aqui pro modo bandeja — trocar tipo/
          // quantidade manualmente resincroniza os dados no lugar (ver o efeito de resync em
          // `DiceCanvasMulti.tsx`), sem remontar a cena/física/renderer inteiros a cada clique.
          /**
           * SÓ modo de debug e modo de lançamento remontam a cena — nem os grupos, nem o contador de
           * preset, em modo nenhum.
           *
           * A torre remontava por completo a cada dado adicionado e a cada preset, porque quando ela
           * era o mecanismo antigo (cena própria, fila de queda por dentro) adaptar a
           * ressincronização parecia arriscado. Isso deixou de valer: hoje os dois modos usam a mesma
           * bandeja, o mesmo mundo físico e os mesmos colisores — só muda de onde o dado é lançado.
           *
           * E o custo era alto. Medido: remontar refaz a cena da bandeja (20ms), a torre inteira com
           * as texturas de tijolo (20ms) e um `WebGLRenderer` novo (15ms), e o primeiro quadro depois
           * disso recompila os shaders — um pico de 290ms num quadro só. É o "fica meio lagado quando
           * bota mais dados" que o usuário reportou.
           */
          /*
            A FORMA entra no `key`: parede física, chão e plataforma são construídos na montagem da
            cena, e trocar de hexágono pra círculo sem remontar deixaria o collider antigo contendo
            dados dentro de uma bandeja com outro desenho.
          */
          key={`${debugMode}-${launchMode}-${trayShape}`}
          ref={multiRef}
          groups={canvasGroups as { sides: PhysicalDiceSides; count: number }[]}
          onResult={handleMultiResult}
          onError={handleSceneError}
          autoRoll={autoRollArm}
          diceColors={resolvedDiceColors}
          material={diceMaterial}
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
        {resultPopup && (
          <div
            key={resultPopup.key}
            className="dice-result-popup"
            style={
              {
                '--popup-accent': wallColor,
                '--popup-body': diceBodyColor
              } as CSSProperties
            }
            onAnimationEnd={() => setResultPopup(null)}
          >
            <span className="dice-result-popup-label">{t.roller.total}</span>
            <span className="dice-result-popup-value">{resultPopup.total}</span>
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
            {lastResult.advantageMode && (
              <>
                {' '}
                {lastResult.advantageMode === 'advantage'
                  ? t.roller.advantageSuffix
                  : t.roller.disadvantageSuffix}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  )
})
