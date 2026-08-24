import { useEffect, useRef, useState } from 'react'
import type { DiceGroup, KeepRule } from '@shared/types/dice'
import type { Preset, PresetInput } from '@shared/types/preset'
import { DEFAULT_DICE_SIDES, MAX_EXPLOSOES_POR_DADO, MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'
import {
  modificadorDoTexto,
  textoDeModificadorAceito,
  textoDoModificadorAjustado
} from '@shared/dice/modificador'
import { expressaoParaFormula, textoParaExpressao } from '@shared/dice/formulaParaExpressao'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { EmojiPicker } from '../common/EmojiPicker'
import './PresetEditorModal.css'

interface PresetEditorModalProps {
  preset: Preset | null
  onSave: (input: PresetInput) => void
  onCancel: () => void
}

function emptyGroup(): DiceGroup {
  return { count: 1, sides: 20 }
}

export function PresetEditorModal({ preset, onSave, onCancel }: PresetEditorModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)
  const [name, setName] = useState(preset?.name ?? '')
  const [icon, setIcon] = useState(preset?.icon ?? '')
  const [groups, setGroups] = useState<DiceGroup[]>(
    preset?.expression.groups.length ? preset.expression.groups : [emptyGroup()]
  )
  /**
   * O modificador vive como TEXTO — ver `shared/dice/modificador.ts`. Guardar o número convertido a
   * cada tecla é o que impedia digitar preset com modificador negativo (uma arma amaldiçoada, um
   * teste com penalidade), porque o sinal de menos sozinho virava zero na hora.
   */
  const [textoDoModificador, setTextoDoModificador] = useState(
    String(preset?.expression.modifiers.reduce((sum, m) => sum + m.value, 0) ?? 0)
  )
  const modifier = modificadorDoTexto(textoDoModificador)
  /**
   * A regra de manter, em dois estados separados — o MODO e QUANTOS.
   *
   * Separados porque a pessoa muda um sem querer perder o outro: trocar "os maiores" por "os
   * menores" não deveria zerar o "quantos contam" que ela acabou de ajustar. `modo` em `'all'` é a
   * ausência de regra, que é o comportamento de sempre.
   */
  /**
   * Uma regra guardada que NÃO faz nada — "usar os 3 maiores" de 3 dados, ou `count` zero de um
   * `presets.json` editado à mão — abre como "todos os dados", que é o que ela sempre foi.
   *
   * Achado da revisão de código: abrir e salvar (só pra renomear) um preset assim transformava a
   * regra inerte numa regra de verdade, porque o mostrador prende o valor em `total − 1` e o que
   * está na tela é o que se grava. Prender é certo; o erro era deixar uma regra inerte chegar ao
   * mostrador como se fosse uma escolha.
   */
  const dadosNoInicio = (preset?.expression.groups ?? []).reduce((soma, g) => soma + g.count, 0)
  const regraInicial = preset?.expression.keep
  const regraTemEfeito =
    regraInicial !== undefined && regraInicial.count >= 1 && regraInicial.count < dadosNoInicio
  const [keepMode, setKeepMode] = useState<KeepRule['mode'] | 'all'>(regraTemEfeito ? regraInicial.mode : 'all')
  const [keepCount, setKeepCount] = useState(regraTemEfeito ? regraInicial.count : 1)
  /**
   * DADOS EXPLOSIVOS no preset. Booleano e não número: o teto da cadeia é do app
   * (`MAX_EXPLOSOES_POR_DADO`) e não uma escolha de quem monta o preset — ninguém quer decidir
   * "quantas vezes no máximo" pra salvar um ataque de espada.
   */
  const [explode, setExplode] = useState(Boolean(preset?.expression.explode))

  const totalDiceCount = groups.reduce((sum, g) => sum + g.count, 0)
  const tooManyDice = totalDiceCount > MAX_SIMULTANEOUS_DICE
  /**
   * QUANTOS DADOS PODEM CONTAR: no máximo um a menos que o total — com todos contando não existe
   * regra, é a soma de sempre.
   *
   * `keepEfetivo` é o valor que MANDA em tudo: no que aparece, no que os botões fazem e no que é
   * gravado. Antes, só o mostrador era limitado (`Math.min(...)` na hora de desenhar) e o estado
   * guardava o número velho, e daí saíam dois defeitos que o usuário viu como "botão bugado":
   *
   * 1. um preset de 6 dados guardando "os 5 maiores", reduzido pra 2 dados, mostrava 1 na tela e
   *    tinha 5 na memória — os três primeiros cliques no "−" não mudavam nada do que se via;
   * 2. pior, salvar nesse estado PERDIA A REGRA sem avisar: `regraDeManter` comparava os 5 guardados
   *    com os 2 dados, concluía "não é regra" e gravava o preset somando tudo. A tela dizia "os
   *    maiores"; o preset gravado somava os dois dados.
   */
  const keepMaximo = Math.max(1, totalDiceCount - 1)
  const keepEfetivo = Math.max(1, Math.min(keepCount, keepMaximo))
  const isValid =
    name.trim().length > 0 && groups.every((g) => g.count > 0 && g.sides > 0) && !tooManyDice

  /**
   * O CAMPO DE FÓRMULA — a gramática de rolagem (`shared/dice/formula.ts`) dentro do editor, o que
   * o spec chama de "the universal escape hatch for any system": quem sabe escrever "4d6kh3 + 2"
   * não precisa clicar, e os botões continuam lá pra quem não sabe. Os dois falam do MESMO preset:
   * o texto preenche os botões, e os botões reescrevem o texto, na forma canônica, a cada mudança.
   *
   * O texto só NÃO é reescrito enquanto a pessoa está digitando nele — senão "4d6k" (que ainda não
   * lê) viraria "4d6" debaixo do dedo. Ao sair do campo fica a forma canônica do que foi aceito; o
   * que não foi aceito fica escrito, com o motivo embaixo, e os botões não mudam. O motivo vem da
   * ponte (`formulaParaExpressao.ts`): ou a fórmula não lê, ou diz algo que o rolador desta versão
   * ainda não faz — e cada um desses casos é dito com o nome, em vez de um preset que rola diferente
   * do que está escrito.
   */
  const campoDaFormula = useRef<HTMLInputElement>(null)
  const formulaDosBotoes =
    expressaoParaFormula({
      groups,
      modifiers: modifier !== 0 ? [{ type: 'flat', value: modifier }] : [],
      keep: regraDeManter(),
      explode: explode ? { maxChain: MAX_EXPLOSOES_POR_DADO } : undefined
    }) ?? ''
  const [textoDaFormula, setTextoDaFormula] = useState(formulaDosBotoes)
  const [erroDaFormula, setErroDaFormula] = useState<string | null>(null)

  useEffect(() => {
    if (document.activeElement === campoDaFormula.current) return
    setTextoDaFormula(formulaDosBotoes)
    setErroDaFormula(null)
  }, [formulaDosBotoes])

  function aplicarFormula(texto: string) {
    setTextoDaFormula(texto)
    const reduzida = textoParaExpressao(texto)
    if (!reduzida.ok) {
      setErroDaFormula(reduzida.motivo)
      return
    }
    setErroDaFormula(null)
    const { expression } = reduzida
    setGroups(expression.groups)
    setTextoDoModificador(String(expression.modifiers.reduce((soma, m) => soma + m.value, 0)))
    if (expression.keep) {
      setKeepMode(expression.keep.mode)
      setKeepCount(expression.keep.count)
    } else {
      setKeepMode('all')
    }
    setExplode(Boolean(expression.explode))
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function updateGroup(index: number, patch: Partial<DiceGroup>) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  }

  function addGroup() {
    setGroups((prev) => [...prev, emptyGroup()])
  }

  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index))
  }

  /**
   * A regra só é GRAVADA quando muda alguma coisa: manter todos, ou manter tantos quanto se rola, é
   * o mesmo que não ter regra. Gravar assim mesmo encheria o rótulo do preset com "(usa os 3
   * maiores)" numa rolagem de 3 dados, onde os três contam de qualquer jeito.
   */
  function regraDeManter(): KeepRule | undefined {
    if (keepMode === 'all') return undefined
    // Com um dado só não há o que escolher — e é o único caso em que a regra some, porque aí ela
    // não existe mesmo. Fora dele, o que está na tela (`keepEfetivo`) é o que vai pro disco.
    if (totalDiceCount < 2) return undefined
    return { mode: keepMode, count: keepEfetivo }
  }

  function handleSubmit() {
    if (!isValid) return
    onSave({
      name: name.trim(),
      icon: icon.trim() || undefined,
      expression: {
        groups,
        modifiers: modifier !== 0 ? [{ type: 'flat', value: modifier }] : [],
        keep: regraDeManter(),
        explode: explode ? { maxChain: MAX_EXPLOSOES_POR_DADO } : undefined
      }
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <Card ref={cardRef} className="preset-editor" onClick={(e) => e.stopPropagation()}>
        <h2 className="preset-editor-title">
          {preset ? t.presetEditor.titleEdit : t.presetEditor.titleNew}
        </h2>

        <label className="preset-editor-field">
          <span>{t.presetEditor.name}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.presetEditor.namePlaceholder}
            autoFocus
          />
        </label>

        <div className="preset-editor-field">
          <span>{t.presetEditor.icon}</span>
          <div className="preset-editor-icon-row">
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="⚔️"
              maxLength={4}
            />
            <EmojiPicker onSelect={setIcon} />
          </div>
        </div>

        <div className="preset-editor-field">
          <span>{t.presetEditor.formula}</span>
          <input
            ref={campoDaFormula}
            type="text"
            className="preset-editor-formula"
            value={textoDaFormula}
            onChange={(e) => aplicarFormula(e.target.value)}
            onBlur={() => {
              if (!erroDaFormula) setTextoDaFormula(formulaDosBotoes)
            }}
            placeholder={t.presetEditor.formulaPlaceholder}
            aria-label={t.presetEditor.formula}
            spellCheck={false}
          />
          {erroDaFormula ? (
            <p className="preset-editor-warning">{erroDaFormula}</p>
          ) : (
            <p className="preset-editor-hint">{t.presetEditor.formulaHint}</p>
          )}
        </div>

        <div className="preset-editor-field">
          <span>{t.presetEditor.dice}</span>
          <div className="preset-editor-groups">
            {groups.map((group, index) => {
              /**
               * O TETO É DO APP, não do grupo: 20 dados por rolagem no total
               * (`MAX_SIMULTANEOUS_DICE`), somando todos os grupos. O "+" ia até 100 por grupo, e a
               * pessoa subia clicando até ver o aviso vermelho e descobrir que o Salvar tinha
               * desligado — trabalho jogado fora por um botão que deixava chegar onde não dá.
               *
               * O que sobra pra ESTE grupo é o teto menos o que os outros já ocupam.
               */
              const tetoDoGrupo = Math.max(1, MAX_SIMULTANEOUS_DICE - (totalDiceCount - group.count))
              return (
              <div key={index} className="preset-editor-group-row">
                {/*
                  Mesma dupla "-" / "+" do rolador, no lugar do campo numérico — pedido do usuário
                  ("muda a aumentar e diminuir dado dos presets, coloca o - e + também"). Além de
                  ficar igual aos dois lugares, tira a digitação livre: o campo aceitava qualquer
                  número e só corrigia depois, então dava pra ver "0" ou um valor absurdo enquanto se
                  escrevia.
                */}
                <div className="preset-editor-count" aria-label={t.roller.quantityLabel}>
                  <Button
                    variant="ghost"
                    aria-label="-"
                    disabled={group.count <= 1}
                    onClick={() => updateGroup(index, { count: Math.max(1, group.count - 1) })}
                  >
                    -
                  </Button>
                  <span>{group.count}</span>
                  <Button
                    variant="ghost"
                    aria-label="+"
                    disabled={group.count >= tetoDoGrupo}
                    onClick={() => updateGroup(index, { count: Math.min(tetoDoGrupo, group.count + 1) })}
                  >
                    +
                  </Button>
                </div>
                <select
                  value={group.sides}
                  onChange={(e) => updateGroup(index, { sides: Number(e.target.value) })}
                  aria-label={t.roller.typeLabel}
                >
                  {DEFAULT_DICE_SIDES.map((s) => (
                    <option key={s} value={s}>
                      d{s}
                    </option>
                  ))}
                </select>
                {groups.length > 1 && (
                  <Button variant="ghost" onClick={() => removeGroup(index)} aria-label="✕">
                    ✕
                  </Button>
                )}
              </div>
              )
            })}
          </div>
          {/* Cada grupo novo entra com um dado, então adicionar no teto também estouraria. */}
          <Button variant="ghost" onClick={addGroup} disabled={totalDiceCount >= MAX_SIMULTANEOUS_DICE}>
            {t.presetEditor.addGroup}
          </Button>
          {tooManyDice && (
            <p className="preset-editor-warning">
              {t.presetEditor.tooManyDice.replace('{max}', String(MAX_SIMULTANEOUS_DICE))}
            </p>
          )}
        </div>

        {/*
          A regra de "usar o maior" só aparece com MAIS DE UM dado — com um só não há o que escolher,
          e o controle seria uma pergunta sem resposta possível.
        */}
        {totalDiceCount > 1 && (
          <div className="preset-editor-field">
            <span>{t.presetEditor.keep}</span>
            <div className="preset-editor-keep">
              <select
                value={keepMode}
                onChange={(e) => setKeepMode(e.target.value as KeepRule['mode'] | 'all')}
                aria-label={t.presetEditor.keep}
              >
                <option value="all">{t.presetEditor.keepAll}</option>
                <option value="highest">{t.presetEditor.keepHighest}</option>
                <option value="lowest">{t.presetEditor.keepLowest}</option>
              </select>
              {keepMode !== 'all' && (
                <div className="preset-editor-count" aria-label={t.presetEditor.keepCount}>
                  <Button
                    variant="ghost"
                    aria-label="-"
                    disabled={keepEfetivo <= 1}
                    onClick={() => setKeepCount(Math.max(1, keepEfetivo - 1))}
                  >
                    -
                  </Button>
                  <span>{keepEfetivo}</span>
                  <Button
                    variant="ghost"
                    aria-label="+"
                    disabled={keepEfetivo >= keepMaximo}
                    onClick={() => setKeepCount(Math.min(keepMaximo, keepEfetivo + 1))}
                  >
                    +
                  </Button>
                </div>
              )}
            </div>
            {keepMode !== 'all' && <p className="preset-editor-hint">{t.presetEditor.keepHint}</p>}
          </div>
        )}

        {/*
          Uma caixa de marcar, e não uma lista: explode ou não explode. O detalhe de quantas vezes
          no máximo é do app (ver `MAX_EXPLOSOES_POR_DADO`), não de quem monta um preset de ataque.
        */}
        <label className="preset-editor-field preset-editor-check">
          <input
            type="checkbox"
            checked={explode}
            onChange={(e) => setExplode(e.target.checked)}
          />
          <span>{t.presetEditor.explode}</span>
        </label>
        {explode && <p className="preset-editor-hint">{t.presetEditor.explodeHint}</p>}

        {/* `div` e não `label`: o rótulo roubaria o clique dos botões pro campo de dentro dele. */}
        <div className="preset-editor-field">
          <span>{t.presetEditor.modifier}</span>
          {/*
            MENOS e MAIS no lugar das setinhas do campo numérico, e o estado é TEXTO — ver
            `shared/dice/modificador.ts`. Sem isso não dá pra digitar modificador negativo: o campo
            numérico converte a cada tecla, e o sinal de menos sozinho vira zero na hora.
          */}
          <div className="preset-editor-modifier-campo">
            <Button
              variant="ghost"
              className="preset-editor-modifier-btn"
              aria-label={t.roller.modifierMinus}
              title={t.roller.modifierMinus}
              onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, -1))}
            >
              −
            </Button>
            <input
              type="text"
              inputMode="numeric"
              value={textoDoModificador}
              onChange={(e) => {
                const bruto = e.target.value.trim()
                if (textoDeModificadorAceito(bruto)) setTextoDoModificador(bruto)
              }}
              onBlur={() => setTextoDoModificador(String(modifier))}
              aria-label={t.presetEditor.modifier}
            />
            <Button
              variant="ghost"
              className="preset-editor-modifier-btn"
              aria-label={t.roller.modifierPlus}
              title={t.roller.modifierPlus}
              onClick={() => setTextoDoModificador((atual) => textoDoModificadorAjustado(atual, 1))}
            >
              +
            </Button>
          </div>
        </div>

        <div className="preset-editor-actions">
          <Button variant="secondary" onClick={onCancel}>
            {t.presetEditor.cancel}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
            {t.presetEditor.save}
          </Button>
        </div>
      </Card>
    </div>
  )
}
