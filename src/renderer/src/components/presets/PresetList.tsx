import type { Preset } from '@shared/types/preset'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from '../common/Button'
import { PresetCard } from './PresetCard'
import './PresetList.css'

interface PresetListProps {
  presets: Preset[]
  onRoll: (preset: Preset) => void
  onEdit: (preset: Preset) => void
  onDelete: (preset: Preset) => void
  onCreate: () => void
  onExport: () => void
  onImport: () => void
  /** Desabilita EDITAR/EXCLUIR de qualquer preset enquanto uma rolagem está em andamento. */
  disabled?: boolean
  /** Desabilita só o ROLAR — ver `rollDisabled` em `PresetCard`. */
  rollDisabled?: boolean
}

export function PresetList({
  presets,
  onRoll,
  onEdit,
  onDelete,
  onCreate,
  onExport,
  onImport,
  disabled,
  rollDisabled
}: PresetListProps) {
  const t = useTranslation()

  return (
    <div className="preset-list">
      <div className="preset-list-header">
        <h2 className="preset-list-title">{t.presets.title}</h2>
        <div className="preset-list-header-actions">
          <Button variant="ghost" onClick={onImport}>
            {t.presets.import}
          </Button>
          <Button variant="ghost" onClick={onExport} disabled={presets.length === 0}>
            {t.presets.export}
          </Button>
          <Button variant="secondary" onClick={onCreate}>
            {t.presets.newPreset}
          </Button>
        </div>
      </div>

      {presets.length === 0 ? (
        <p className="preset-list-empty">{t.presets.empty}</p>
      ) : (
        <div className="preset-list-grid">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onRoll={onRoll}
              onEdit={onEdit}
              onDelete={onDelete}
              disabled={disabled}
              rollDisabled={rollDisabled}
            />
          ))}
        </div>
      )}
    </div>
  )
}
