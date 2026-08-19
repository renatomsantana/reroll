import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { DiceGroup, DiceGroupResult, RollResult } from '@shared/types/dice'
import { DEFAULT_DICE_SIDES, colorForDice } from '@shared/diceRegistry'
import { expressionLabel, type RollMode } from '@renderer/domain/dice/diceEngine'
import { MAX_SIMULTANEOUS_DICE } from '@renderer/dice3d/config/physicsConfig'
import {
  DiceCanvasMulti,
  type DiceCanvasMultiHandle,
  type MultiRollResult
} from '@renderer/dice3d/scene/DiceCanvasMulti'
import { AVAILABLE_DICE_TYPES } from '@renderer/dice3d/dice-defs/registry'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import type { LaunchMode } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useSettings } from '@renderer/settings/SettingsContext'
import { playRollSound } from '@renderer/audio/rollSound'
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
  rollGroups: (groups: DiceGroup[], modifier: number, sourceName?: string) => void
}

interface DiceRoller3DProps {
  onRoll: (result: RollResult) => void
  /** Avisa o pai sempre que `isRolling` muda — usado pra desabilitar ações de preset (editar/excluir/rolar OUTRO) enquanto qualquer rolagem está em andamento, mesmo padrão já usado pros próprios botões de tipo/quantidade de dado aqui dentro. */
  onRollingChange?: (isRolling: boolean) => void
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
  { onRoll, onRollingChange },
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
    cameraMode,
    debugMode,
    soundEnabled,
    resultPopupEnabled
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
  const [modifier, setModifier] = useState(0)
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
  const [mode, setMode] = useState<RollMode>('normal')
  const [lastResult, setLastResult] = useState<RollResult | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [rollError, setRollError] = useState(false)
  /** Nome do preset da rolagem em curso — ver `rollGroups` e `finalizeResult`. */
  const sourceNameRef = useRef<string | undefined>(undefined)
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
    rollGroups: (newGroups, newModifier, sourceName) => {
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
      // Presets não carregam modo de vantagem/desvantagem — sempre volta a 'normal'
      // pra não herdar um modo deixado ligado de uma rolagem manual anterior.
      setMode('normal')
      setModifier(newModifier)
      setGroups(newGroups.length > 0 ? newGroups : DEFAULT_GROUPS)
      setLastResult(null)
      setRollError(false)
      setResultPopup(null)
      setIsRolling(true)
      setPresetRollSeq((n) => n + 1)

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
  const canvasGroups = mode === 'normal' ? groups : [...groups, ...groups]

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
    setGroups((prev) => {
      const existing = prev.find((g) => g.sides === sides)
      if (existing) {
        return prev.map((g) => (g.sides === sides ? { ...g, count: g.count + 1 } : g))
      }
      return [...prev, { sides, count: 1 }]
    })
    setLastResult(null)
  }

  /** Ajusta a contagem de UM grupo específico — remove o grupo se chegar a zero (exceto o último, que nunca fica vazio). */
  function adjustGroupCount(index: number, delta: number) {
    if (isRolling) return
    const cap = mode === 'normal' ? MAX_SIMULTANEOUS_DICE : ADVANTAGE_MAX_COUNT
    const currentTotal = groups.reduce((sum, g) => sum + g.count, 0)
    if (delta > 0 && currentTotal >= cap) return
    setGroups((prev) => {
      const group = prev[index]
      if (!group) return prev
      const nextCount = group.count + delta
      if (nextCount <= 0) {
        return prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
      }
      return prev.map((g, i) => (i === index ? { ...g, count: nextCount } : g))
    })
    setLastResult(null)
  }

  function removeGroup(index: number) {
    if (isRolling || groups.length <= 1) return
    setGroups((prev) => prev.filter((_, i) => i !== index))
    setLastResult(null)
  }

  function selectMode(newMode: RollMode) {
    setMode(newMode)
    if (newMode !== 'normal' && isSingleGroup && singleCount > ADVANTAGE_MAX_COUNT) {
      setGroups([{ sides: groups[0].sides, count: ADVANTAGE_MAX_COUNT }])
    }
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
    const expression = { groups, modifiers: modifier !== 0 ? [{ type: 'flat' as const, value: modifier }] : [] }

    if (mode === 'normal') {
      finalizeResult({
        id: crypto.randomUUID(),
        label: expressionLabel(expression),
        groups: groupRollsBySides(result.rolls),
        modifierTotal: modifier,
        total: result.total + modifier,
        timestamp: Date.now()
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
    if (isRolling) return
    // Rolagem MANUAL não tem nome de golpe. Limpa aqui também (e não só no `finalizeResult`) pro
    // caso de clicar "Rolar" antes de uma rolagem de preset chegar a assentar.
    sourceNameRef.current = undefined
    setIsRolling(true)
    setRollError(false)
    setResultPopup(null)
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
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return
      if (e.repeat || isRolling || document.querySelector('.modal-overlay')) return
      const active = document.activeElement
      if (active instanceof HTMLSelectElement) return
      if (active instanceof HTMLButtonElement && e.code === 'Space') return
      e.preventDefault()
      handleRollClick()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRolling])

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
                    {groups.length > 1 && (
                      <Button
                        variant="ghost"
                        onClick={() => removeGroup(index)}
                        disabled={isRolling}
                        aria-label="✕"
                      >
                        ✕
                      </Button>
                    )}
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

                <label className="dice-roller-3d-modifier">
                  <span>{t.roller.modifier}</span>
                  <input
                    type="number"
                    value={modifier}
                    onChange={(e) => setModifier(Number(e.target.value) || 0)}
                    aria-label={t.roller.modifier}
                  />
                </label>
              </div>
            </div>

            <Button
              variant="primary"
              className="dice-roller-3d-roll-btn"
              onClick={handleRollClick}
              disabled={isRolling}
            >
              {t.roller.rollButton}
            </Button>
          </div>
        </fieldset>
      </div>

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
          key={`${debugMode}-${launchMode}`}
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
          debugMode={debugMode}
          caseOpen={caseOpen}
          onCaseClick={() => setCaseOpen((open) => !open)}
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
