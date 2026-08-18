import { useEffect, useRef, useState } from 'react'
import type { DiceGroup } from '@shared/types/dice'
import type { Preset, PresetInput } from '@shared/types/preset'
import { DEFAULT_DICE_SIDES, MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'
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
  const [modifier, setModifier] = useState(
    preset?.expression.modifiers.reduce((sum, m) => sum + m.value, 0) ?? 0
  )

  const totalDiceCount = groups.reduce((sum, g) => sum + g.count, 0)
  const tooManyDice = totalDiceCount > MAX_SIMULTANEOUS_DICE
  const isValid =
    name.trim().length > 0 && groups.every((g) => g.count > 0 && g.sides > 0) && !tooManyDice

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

  function handleSubmit() {
    if (!isValid) return
    onSave({
      name: name.trim(),
      icon: icon.trim() || undefined,
      expression: { groups, modifiers: modifier !== 0 ? [{ type: 'flat', value: modifier }] : [] }
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
          <span>{t.presetEditor.dice}</span>
          <div className="preset-editor-groups">
            {groups.map((group, index) => (
              <div key={index} className="preset-editor-group-row">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={group.count}
                  onChange={(e) =>
                    updateGroup(index, { count: Math.max(1, Number(e.target.value) || 1) })
                  }
                  aria-label={t.roller.quantityLabel}
                />
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
            ))}
          </div>
          <Button variant="ghost" onClick={addGroup}>
            {t.presetEditor.addGroup}
          </Button>
          {tooManyDice && (
            <p className="preset-editor-warning">
              {t.presetEditor.tooManyDice.replace('{max}', String(MAX_SIMULTANEOUS_DICE))}
            </p>
          )}
        </div>

        <label className="preset-editor-field">
          <span>{t.presetEditor.modifier}</span>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(Number(e.target.value) || 0)}
            aria-label={t.presetEditor.modifier}
          />
        </label>

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
