import { useState } from 'react'
import { useSettings } from '@renderer/settings/SettingsContext'
import { METAL_PRESETS } from '@renderer/settings/metalPresets'
import { GEM_PRESETS } from '@renderer/settings/gemPresets'
import { MATTE_PRESETS } from '@renderer/settings/mattePresets'
import { PLASTIC_PRESETS } from '@renderer/settings/plasticPresets'
import { TRAY_PRESETS } from '@renderer/settings/trayPresets'
import type { MetalPreset } from '@renderer/settings/metalPresets'
import { AVAILABLE_DICE_TYPES } from '@renderer/dice3d/dice-defs/registry'
import type { DiceMaterialFinish } from '@renderer/dice3d/materials/createDiceMaterial'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { ColorWheel } from './ColorWheel'
import { StylePreview } from './StylePreview'
import { TrayPreview } from './TrayPreview'
import './StyleTab.css'

const MATERIAL_OPTIONS: DiceMaterialFinish[] = ['matte', 'metallic', 'plastic', 'glass']

type PaletteFamilyId = 'metal' | 'gem' | 'matte' | 'plastic'
/** O que a roda de cores está editando em cada seção — dado (corpo/número) ou cena (parede/chão/fundo). */
type DiceColorTarget = 'body' | 'number'
/**
 * O FUNDO é o papel de parede da cena — o que aparece atrás/acima da mesa. Ele chegou a sair daqui
 * ("a cor do fundo não mexe, tira essa opção"), porque mexer nele não mudava nada do que estava à
 * vista: ele só aparece no pedaço de céu acima da mesa, a prévia desta aba desenha em canvas
 * transparente (sem fundo nenhum), e a cor que estava escolhida era quase igual à padrão. Voltou
 * assim que ficou claro o que ele é — "o fundo é o wallpaper né? realmente ajeita".
 */
type SceneColorTarget = 'wall' | 'floor' | 'background'

const SCENE_TARGETS: SceneColorTarget[] = ['wall', 'floor', 'background']

/**
 * As quatro famílias de cor prontas, com o acabamento que cada uma pressupõe. Antes elas eram
 * QUATRO seções empilhadas, visualmente idênticas — quase cinquenta quadradinhos anônimos em
 * sequência, sem nada dizendo onde uma família terminava e a outra começava. Agora é uma seção
 * só, com a família escolhida por botão.
 */
const PALETTE_FAMILIES: { id: PaletteFamilyId; presets: MetalPreset[]; material: DiceMaterialFinish }[] = [
  { id: 'metal', presets: METAL_PRESETS, material: 'metallic' },
  { id: 'gem', presets: GEM_PRESETS, material: 'plastic' },
  { id: 'matte', presets: MATTE_PRESETS, material: 'matte' },
  { id: 'plastic', presets: PLASTIC_PRESETS, material: 'plastic' }
]

/** Comparação de cor tolerante a caixa (`#D4AF37` vs `#d4af37`) — a roda de cores normaliza pra minúsculo, os presets são escritos à mão. */
function sameColor(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Aba própria pra estilizar dados/bandeja — antes essas opções viviam espremidas no modal de
 * Preferências (⚙️), que ficou pequeno demais conforme a lista cresceu.
 *
 * A largura se divide em duas partes com papéis diferentes:
 *
 * - COLUNA FIXA da esquerda: o seletor de seção e a PRÉVIA, que ocupa toda a altura que sobra
 *   (~350px de lado, contra os 140px fixos de antes). Ela não rola: é olhando pra ela que se mexe
 *   em qualquer coisa aqui.
 * - GRADE rolável da direita: as caixas de opção, em quantas colunas couberem. Antes era uma
 *   coluna só ocupando os ~1000px restantes da janela, o que esticava cada botão de "Fosco" ou
 *   "Gemas" numa barra larguíssima — o pedido de "reorganizar pros botões não ficarem tão longos"
 *   é resolvido pela grade: cada coluna tem ~250px, e o botão volta ao tamanho do rótulo dele.
 */
export function StyleTab() {
  const t = useTranslation()
  const {
    diceBodyColor,
    diceNumberColor,
    diceMaterial,
    diceColorOverrides,
    wallColor,
    floorColor,
    backgroundColor,
    backgroundImage,
    palettesVisible,
    setDiceBodyColor,
    setDiceNumberColor,
    setDiceMaterial,
    setDiceColorOverride,
    clearDiceColorOverride,
    setWallColor,
    setFloorColor,
    setBackgroundColor,
    setBackgroundImage,
    setPalettesVisible
  } = useSettings()
  const [backgroundImageError, setBackgroundImageError] = useState(false)
  const [section, setSection] = useState<'dice' | 'scene'>('dice')
  const [paletteFamily, setPaletteFamily] = useState<PaletteFamilyId>('metal')
  /** Nome do preset sob o mouse — alimenta a legenda embaixo da grade, pra dar nome às cores sem precisar de um rótulo embaixo de cada quadradinho (doze rótulos numa linha não cabem). */
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)
  /**
   * `'default'` = cor de fallback (`diceBodyColor`/`diceNumberColor`, usada por qualquer tipo
   * sem override próprio); um `PhysicalDiceSides` = cor SÓ daquele tipo. Uma LISTA (pedido do
   * usuário) em vez da grade de botões que havia aqui: com o nome, a cor do corpo e a cor do
   * número em cada linha, dá pra ver de relance quais tipos já foram personalizados — na grade
   * de botões todos os oito pareciam iguais.
   */
  const [selectedDiceType, setSelectedDiceType] = useState<PhysicalDiceSides | 'default'>('default')
  /** Qual das duas cores do dado a roda edita. Um alvo por vez: existe UMA roda na tela, e ela sempre mostra a cor de quem está marcado aqui. */
  const [diceTarget, setDiceTarget] = useState<DiceColorTarget>('body')
  const [sceneTarget, setSceneTarget] = useState<SceneColorTarget>('wall')

  const selectedOverride = selectedDiceType === 'default' ? undefined : diceColorOverrides[selectedDiceType]
  const selectedBodyColor = selectedOverride?.bodyColor ?? diceBodyColor
  const selectedNumberColor = selectedOverride?.numberColor ?? diceNumberColor
  const previewSides = selectedDiceType === 'default' ? 20 : selectedDiceType

  const activeFamily = PALETTE_FAMILIES.find((family) => family.id === paletteFamily) ?? PALETTE_FAMILIES[0]
  const activePreset = activeFamily.presets.find((preset) => sameColor(preset.bodyColor, selectedBodyColor))
  const activeTray = TRAY_PRESETS.find(
    (preset) => sameColor(preset.wallColor, wallColor) && sameColor(preset.floorColor, floorColor)
  )

  const sceneColors: Record<SceneColorTarget, string> = {
    wall: wallColor,
    floor: floorColor,
    background: backgroundColor
  }
  const setSceneColors: Record<SceneColorTarget, (value: string) => void> = {
    wall: setWallColor,
    floor: setFloorColor,
    background: setBackgroundColor
  }

  /**
   * Atualiza corpo E número JUNTOS, numa única chamada — usado pelos presets prontos
   * (metálico/gema/fosco/plástico), que mudam os dois de uma vez. BUG REAL encontrado testando
   * ao vivo (print da janela + clique simulado, não só lido no código): antes disso existiam
   * DUAS funções separadas, cada uma lendo `selectedBodyColor`/`selectedNumberColor` do
   * closure do render atual — um preset chamando as duas em sequência fazia a SEGUNDA
   * sobrescrever o override inteiro com o valor ANTIGO (ainda não atualizado) do campo que a
   * PRIMEIRA acabou de mudar, perdendo aquela mudança. Só não era óbvio de imediato porque o
   * preset testado (Zinabre) tem `numberColor` igual ao preto padrão, então "não mudou nada"
   * parecia só a cor do corpo emperrada, quando na real as DUAS chamadas se atropelavam.
   */
  function handleSelectedColorChange(bodyColor: string, numberColor: string): void {
    if (selectedDiceType === 'default') {
      setDiceBodyColor(bodyColor)
      setDiceNumberColor(numberColor)
    } else {
      setDiceColorOverride(selectedDiceType, bodyColor, numberColor)
    }
  }

  /** Cor que a roda mostra e edita: depende da seção aberta e do alvo marcado nela. */
  const wheelColor =
    section === 'scene'
      ? sceneColors[sceneTarget]
      : diceTarget === 'body'
        ? selectedBodyColor
        : selectedNumberColor

  function handleWheelChange(hex: string): void {
    if (section === 'scene') {
      setSceneColors[sceneTarget](hex)
    } else if (diceTarget === 'body') {
      handleSelectedColorChange(hex, selectedNumberColor)
    } else {
      handleSelectedColorChange(selectedBodyColor, hex)
    }
  }

  async function handlePickBackgroundImage(): Promise<void> {
    setBackgroundImageError(false)
    try {
      const dataUrl = await window.api.scene.pickBackgroundImage()
      if (dataUrl) setBackgroundImage(dataUrl)
    } catch {
      setBackgroundImageError(true)
    }
  }

  /**
   * O próprio rótulo da caixa de grupo é o botão que recolhe as cores prontas — o título mais a
   * seta, do jeito que o 98 recolhe uma seção. Foi o que substituiu uma caixa de marcar "Visível"
   * embaixo do rótulo: o usuário achou que ela não dizia o que fazia ("não é tipo visível assim,
   * bota algo tipo paletas prontas e uma seta pra baixo").
   *
   * A seta aponta pra BAIXO quando está recolhido (é o que vai descer ao clicar) e pra cima quando
   * está aberto — mesma convenção da caixa de combinação do 98.
   */
  function renderPalettesToggle(label: string) {
    return (
      <button
        type="button"
        className="style-tab-collapse"
        aria-expanded={palettesVisible}
        onClick={() => setPalettesVisible(!palettesVisible)}
      >
        {label}
        <span className="style-tab-collapse-arrow" aria-hidden="true">
          {palettesVisible ? '▲' : '▼'}
        </span>
      </button>
    )
  }

  /** Uma linha da lista de dados: as duas cores em uso + o rótulo, com `*` em quem tem cor própria. */
  function renderDiceRow(value: PhysicalDiceSides | 'default') {
    const override = value === 'default' ? undefined : diceColorOverrides[value]
    const bodyColor = override?.bodyColor ?? diceBodyColor
    const numberColor = override?.numberColor ?? diceNumberColor
    const label = value === 'default' ? t.styleTab.defaultColorOption : `d${value}`
    return (
      <button
        key={value}
        type="button"
        role="option"
        aria-selected={selectedDiceType === value}
        className={`style-tab-list-item ${
          selectedDiceType === value ? 'style-tab-list-item-selected' : ''
        }`}
        onClick={() => setSelectedDiceType(value)}
      >
        <span className="style-tab-list-swatch" style={{ background: bodyColor }} />
        <span className="style-tab-list-swatch" style={{ background: numberColor }} />
        <span className="style-tab-list-label">{label}</span>
        {override && <span className="style-tab-list-mark">*</span>}
      </button>
    )
  }

  return (
    <Card className="style-tab">
      {/*
        Coluna parada: o seletor de seção e a prévia, que fica com toda a altura restante. Nada
        aqui rola — a prévia sumindo da tela justo quando se mexe na cor era o problema que essa
        divisão resolveu.
      */}
      <div className="style-tab-preview-pane">
        <div className="style-tab-sections">
          <Button selected={section === 'dice'} onClick={() => setSection('dice')}>
            {t.styleTab.sectionDice}
          </Button>
          <Button selected={section === 'scene'} onClick={() => setSection('scene')}>
            {t.styleTab.sectionScene}
          </Button>
        </div>

        {/*
          A prévia acompanha a SEÇÃO aberta: dado enquanto se mexe em cor/acabamento de dado,
          bandeja enquanto se mexe em parede/chão — pedido do usuário, que só via o efeito das
          cores da cena voltando pra aba Rolagem. Mostrar as duas ao mesmo tempo custaria duas
          cenas WebGL vivas e espremeria as duas na mesma coluna estreita.
        */}
        <fieldset className="style-group style-tab-preview-group">
          <legend>{t.styleTab.preview}</legend>
          {section === 'scene' ? (
            <>
              <TrayPreview wallColor={wallColor} floorColor={floorColor} />
              <p className="style-tab-preview-caption">{t.styleTab.sectionScene}</p>
            </>
          ) : (
            <>
              <StylePreview
                sides={previewSides}
                bodyColor={selectedBodyColor}
                numberColor={selectedNumberColor}
                material={diceMaterial}
              />
              <p className="style-tab-preview-caption">
                {selectedDiceType === 'default'
                  ? t.styleTab.defaultColorOption
                  : `d${selectedDiceType}`}
                {' · '}
                {t.styleTab.materialOptions[diceMaterial]}
              </p>
            </>
          )}
        </fieldset>

      </div>

      <div className="style-tab-options">
        {/*
          Roda de cores: qualquer cor na hora, sem passar pelo diálogo do Windows que o
          `input[type=color]` abria — ele tapava justamente a prévia enquanto a cor era escolhida,
          então só dava pra ver o efeito DEPOIS de fechar. Uma roda só, com botões dizendo o que
          ela edita: dois campos de cor lado a lado com rótulos parecidos já tinham confundido o
          usuário antes ("Cor do dado" × "Cor do número" pareciam a mesma coisa duplicada).

          Primeira caixa da grade, logo ao lado da prévia — as duas se usam juntas (arrastar a cor
          olhando o dado), e com as três ou quatro caixas de cada seção nada disso rola pra fora da
          tela na janela padrão.
        */}
        <fieldset className="style-group style-tab-wheel-group">
          <legend>{t.styleTab.colorWheel}</legend>
          <div className="style-tab-targets">
            {section === 'scene'
              ? SCENE_TARGETS.map((target) => (
                  <Button
                    key={target}
                    selected={sceneTarget === target}
                    onClick={() => setSceneTarget(target)}
                  >
                    <span
                      className="style-tab-type-swatch"
                      style={{ background: sceneColors[target] }}
                    />
                    {t.styleTab.colorTargets[target]}
                  </Button>
                ))
              : (['body', 'number'] as DiceColorTarget[]).map((target) => (
                  <Button
                    key={target}
                    selected={diceTarget === target}
                    onClick={() => setDiceTarget(target)}
                  >
                    <span
                      className="style-tab-type-swatch"
                      style={{
                        background: target === 'body' ? selectedBodyColor : selectedNumberColor
                      }}
                    />
                    {t.styleTab.colorTargets[target]}
                  </Button>
                ))}
          </div>
          <ColorWheel
            color={wheelColor}
            onChange={handleWheelChange}
            label={t.styleTab.colorWheel}
            hexLabel={t.styleTab.hex}
            brightnessLabel={t.styleTab.brightness}
          />
        </fieldset>

        {section === 'dice' && (
          <>
            <fieldset className="style-group">
              <legend>{t.styleTab.perDieColor}</legend>
              <div className="style-tab-list" role="listbox" aria-label={t.styleTab.perDieColor}>
                {renderDiceRow('default')}
                {AVAILABLE_DICE_TYPES.map((sides) => renderDiceRow(sides))}
              </div>
              {selectedDiceType !== 'default' && selectedOverride && (
                <Button variant="ghost" onClick={() => clearDiceColorOverride(selectedDiceType)}>
                  {t.styleTab.perDieColorReset}
                </Button>
              )}
            </fieldset>

            <fieldset className="style-group">
              <legend>{t.styleTab.material}</legend>
              <div className="style-tab-grid-2">
                {MATERIAL_OPTIONS.map((finish) => (
                  <Button
                    key={finish}
                    selected={diceMaterial === finish}
                    onClick={() => setDiceMaterial(finish)}
                  >
                    {t.styleTab.materialOptions[finish]}
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset className="style-group">
              <legend>{renderPalettesToggle(t.styleTab.palettes)}</legend>
              {palettesVisible && (
                <>
                  <div className="style-tab-grid-2">
                    {PALETTE_FAMILIES.map((family) => (
                      <Button
                        key={family.id}
                        selected={paletteFamily === family.id}
                        onClick={() => setPaletteFamily(family.id)}
                      >
                        {t.styleTab.paletteFamilies[family.id]}
                      </Button>
                    ))}
                  </div>
                  <div className="style-tab-swatches" onMouseLeave={() => setHoveredPreset(null)}>
                    {activeFamily.presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`style-tab-swatch ${
                          activePreset?.id === preset.id ? 'style-tab-swatch-active' : ''
                        }`}
                        style={{ background: preset.bodyColor }}
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={activePreset?.id === preset.id}
                        onMouseEnter={() => setHoveredPreset(preset.label)}
                        onFocus={() => setHoveredPreset(preset.label)}
                        onClick={() => {
                          handleSelectedColorChange(preset.bodyColor, preset.numberColor)
                          setDiceMaterial(activeFamily.material)
                        }}
                      />
                    ))}
                  </div>
                  {/* Nome do que está sob o mouse (ou do preset ativo) — sem isso as cores prontas são só quadradinhos sem nome, só descobertos parando o mouse em cima. */}
                  <p className="style-tab-swatch-caption">
                    {hoveredPreset ?? activePreset?.label ?? t.styleTab.paletteEmpty}
                  </p>
                </>
              )}
            </fieldset>
          </>
        )}

        {section === 'scene' && (
          <>
            {/*
              NÃO devolver o seletor de "Modo de lançamento" (bandeja × torre) aqui. Ele já esteve
              nesta seção duas vezes e saiu de novo a pedido do usuário: "tira o modo de lançamento,
              a torre é algo escondido, não demos pra frente". A torre continua inteira no código
              (`createTowerScene`, os colliders, a física da rampa) e `launchMode` continua sendo uma
              preferência de verdade — o que sai é só o caminho da interface até ela.

              Da última vez a ausência do seletor foi tratada como bug ("a torre está inalcançável")
              e ele voltou. Desta vez é decisão: só volta se o usuário pedir.
            */}

            {/*
              O modo de CÂMERA morava aqui e saiu a pedido do usuário ("não gostei de ser no
              estilo"): virou um trio de ícones sobrepostos na própria cena 3D
              (`CameraModeSwitch.tsx`). Faz sentido — é um controle que se mexe OLHANDO a cena, e
              obrigar a trocar de aba pra mexer nele quebra justamente o que ele serve pra fazer.

              As cores da cena também não têm mais campo próprio aqui: elas são escolhidas na roda,
              com os botões Parede/Veludo dizendo qual está sendo editada.
            */}
            <fieldset className="style-group">
              <legend>{renderPalettesToggle(t.styleTab.trayPresets)}</legend>
              {palettesVisible && (
                <>
                  {/* Cada amostra mostra o PAR (parede na diagonal de cima, chão embaixo) — antes só o chão aparecia, então duas bandejas de chão parecido eram indistinguíveis. */}
                  <div className="style-tab-swatches" onMouseLeave={() => setHoveredPreset(null)}>
                    {TRAY_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`style-tab-swatch ${
                          activeTray?.id === preset.id ? 'style-tab-swatch-active' : ''
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.wallColor} 0 50%, ${preset.floorColor} 50% 100%)`
                        }}
                        title={preset.label}
                        aria-label={preset.label}
                        aria-pressed={activeTray?.id === preset.id}
                        onMouseEnter={() => setHoveredPreset(preset.label)}
                        onFocus={() => setHoveredPreset(preset.label)}
                        onClick={() => {
                          setWallColor(preset.wallColor)
                          setFloorColor(preset.floorColor)
                        }}
                      />
                    ))}
                  </div>
                  <p className="style-tab-swatch-caption">
                    {hoveredPreset ?? activeTray?.label ?? t.styleTab.paletteEmpty}
                  </p>
                </>
              )}
            </fieldset>

            <fieldset className="style-group">
              <legend>{t.styleTab.backgroundImage}</legend>
              <div className="style-tab-options-row">
                <Button onClick={() => void handlePickBackgroundImage()}>
                  {t.styleTab.backgroundImagePick}
                </Button>
                {backgroundImage && (
                  <Button onClick={() => setBackgroundImage(null)}>
                    {t.styleTab.backgroundImageClear}
                  </Button>
                )}
              </div>
              {backgroundImageError && (
                <p className="style-tab-error">{t.styleTab.backgroundImageError}</p>
              )}
            </fieldset>
          </>
        )}
      </div>
    </Card>
  )
}
