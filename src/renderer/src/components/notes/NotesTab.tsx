import type { CSSProperties } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useNotes } from '@renderer/hooks/useNotes'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './NotesTab.css'

const NOTES_FONTS = [
  { value: '', label: '' },
  { value: 'Tahoma, "MS Sans Serif", Geneva, sans-serif', label: 'Tahoma' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: '"Comic Sans MS", cursive', label: 'Comic Sans' },
  { value: 'Arial, sans-serif', label: 'Arial' }
]

/**
 * Ficha de RPG: o nome do personagem no topo e quatro blocos — inventário, aparência, backstory e o
 * BLOCO, que é o diário com uma página por dia.
 *
 * Chegou a ter classe, nível, raça, antecedente, alinhamento, os seis atributos com modificador
 * calculado e os números de combate; o usuário mandou tirar tudo isso ("deixa só nome, bloco,
 * inventário, aparência, backstory"). Não devolver sem ele pedir.
 *
 * O que faz ler como ficha, sem sair do vocabulário do Windows 98 (nada de gradiente, canto redondo
 * ou sombra difusa, que é o que já foi reprovado neste projeto): cada assunto dentro de uma CAIXA
 * DE GRUPO com legenda, que é o desenho de formulário do 98 e por acaso é também o de ficha
 * impressa, e o nome do personagem numa faixa própria no topo, atravessando a largura toda.
 */
export function NotesTab() {
  const t = useTranslation()
  const { notes, saveError, updateField, updatePage, goToPage, addPage, removePage } = useNotes()

  const page = notes.pages[notes.currentPage]
  const dayLabel = t.notesTab.dayNumber.replace('{n}', String(notes.currentPage + 1))

  /** A formatação da barra vale pros quatro blocos — é a mesma caneta pro caderno inteiro. */
  const textStyle: CSSProperties = {
    fontFamily: notes.font || undefined,
    fontWeight: notes.bold ? 'bold' : undefined,
    fontStyle: notes.italic ? 'italic' : undefined,
    textDecoration: notes.underline ? 'underline' : undefined,
    color: notes.color || undefined
  }

  function handleRemovePage(): void {
    if (!confirm(t.notesTab.dayDeleteConfirm.replace('{day}', page.title || dayLabel))) return
    removePage()
  }

  function renderTextBlock(field: 'inventory' | 'appearance' | 'backstory', label: string) {
    return (
      <fieldset className="notes-group notes-group-grow">
        <legend>{label}</legend>
        <textarea
          className="notes-textarea"
          value={notes[field]}
          onChange={(e) => updateField(field, e.target.value)}
          style={textStyle}
        />
      </fieldset>
    )
  }

  return (
    <Card className="notes-tab">
      <div className="notes-toolbar">
        <select value={notes.font} onChange={(e) => updateField('font', e.target.value)}>
          {NOTES_FONTS.map((font) => (
            <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
              {font.label || t.notesTab.fontDefault}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`fmt-btn fmt-btn-bold ${notes.bold ? 'active' : ''}`}
          title={t.notesTab.boldLabel}
          onClick={() => updateField('bold', !notes.bold)}
        >
          B
        </button>
        <button
          type="button"
          className={`fmt-btn fmt-btn-italic ${notes.italic ? 'active' : ''}`}
          title={t.notesTab.italicLabel}
          onClick={() => updateField('italic', !notes.italic)}
        >
          I
        </button>
        <button
          type="button"
          className={`fmt-btn fmt-btn-underline ${notes.underline ? 'active' : ''}`}
          title={t.notesTab.underlineLabel}
          onClick={() => updateField('underline', !notes.underline)}
        >
          U
        </button>
        <input
          type="color"
          className="notes-color-input"
          title={t.notesTab.colorLabel}
          value={notes.color || '#000000'}
          onChange={(e) => updateField('color', e.target.value)}
        />
        {notes.color && (
          <button
            type="button"
            className="fmt-btn fmt-btn-color-reset"
            title={t.notesTab.colorReset}
            onClick={() => updateField('color', '')}
          >
            ↺
          </button>
        )}
        {saveError && <span className="notes-save-error">{t.notesTab.saveError}</span>}
      </div>

      {/* Nome do personagem: faixa própria atravessando a ficha inteira, como cabeçalho de ficha impressa. */}
      <fieldset className="notes-group notes-group-name">
        <legend>{t.notesTab.sheetBlock}</legend>
        <label className="notes-field">
          <span>{t.notesTab.name}</span>
          <input
            value={notes.characterName}
            onChange={(e) => updateField('characterName', e.target.value)}
          />
        </label>
      </fieldset>

      <div className="notes-layout">
        <div className="notes-column">
          <div className="notes-row notes-row-grow">
            {renderTextBlock('inventory', t.notesTab.inventoryBlock)}
            {renderTextBlock('appearance', t.notesTab.appearanceBlock)}
          </div>
          {renderTextBlock('backstory', t.notesTab.backstoryBlock)}
        </div>

        {/* Coluna do diário: a página do dia, com a lombada de navegação em cima. */}
        <div className="notes-column">
          <fieldset className="notes-group notes-group-grow">
            <legend>{t.notesTab.notesBlock}</legend>
            <div className="notes-diary-bar">
              <Button
                variant="secondary"
                className="notes-diary-arrow"
                title={t.notesTab.dayPrev}
                aria-label={t.notesTab.dayPrev}
                disabled={notes.currentPage === 0}
                onClick={() => goToPage(notes.currentPage - 1)}
              >
                ◀
              </Button>
              {/*
                O nome do dia é um campo, não um rótulo: o padrão é "Dia 3" (pela posição) e quem
                quiser escreve "Chegada em Neverwinter" por cima. Vazio volta a ser o número.
              */}
              <input
                className="notes-diary-title"
                value={page.title}
                placeholder={dayLabel}
                onChange={(e) => updatePage({ title: e.target.value })}
              />
              <span className="notes-diary-count">
                {t.notesTab.dayCounter
                  .replace('{current}', String(notes.currentPage + 1))
                  .replace('{total}', String(notes.pages.length))}
              </span>
              <Button
                variant="secondary"
                className="notes-diary-arrow"
                title={t.notesTab.dayNext}
                aria-label={t.notesTab.dayNext}
                disabled={notes.currentPage === notes.pages.length - 1}
                onClick={() => goToPage(notes.currentPage + 1)}
              >
                ▶
              </Button>
              <Button variant="secondary" onClick={addPage}>
                {t.notesTab.dayNew}
              </Button>
              <Button
                variant="ghost"
                title={t.notesTab.dayDelete}
                aria-label={t.notesTab.dayDelete}
                onClick={handleRemovePage}
              >
                ✕
              </Button>
            </div>
            <textarea
              className="notes-textarea"
              value={page.text}
              onChange={(e) => updatePage({ text: e.target.value })}
              style={textStyle}
            />
          </fieldset>
        </div>
      </div>
    </Card>
  )
}
