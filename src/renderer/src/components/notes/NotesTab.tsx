import type { CSSProperties } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useNotes } from '@renderer/hooks/useNotes'
import { FONT_OPTIONS } from '@renderer/settings/SettingsContext'
import { FontSelect, type FontSelectValue } from '../chrome/FontSelect'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './NotesTab.css'

/**
 * O bloco guarda a fonte como FAMÍLIA CSS (`"Comic Sans MS", cursive`), e o seletor trabalha com o
 * ID da fonte. Estas duas funções fazem a ponte.
 *
 * Guardar a família, e não o id, é o formato que já está gravado no `notes.json` de quem usa o app —
 * mudar isso exigiria migrar arquivo por um ganho nenhum. O preço é este par de conversões, e um
 * detalhe honesto: quem tiver gravada uma das cinco fontes da lista ANTIGA das anotações (ela tinha
 * cadeias de reserva próprias, e uma Arial que nem existe nas Preferências) não vai bater com
 * nenhuma família daqui e cai em "fonte padrão". É uma vez só, na primeira abertura.
 */
function familyToFontId(family: string): FontSelectValue {
  return (FONT_OPTIONS.find((font) => font.family === family)?.id) ?? ''
}

function fontIdToFamily(id: FontSelectValue): string {
  return FONT_OPTIONS.find((font) => font.id === id)?.family ?? ''
}

/**
 * ANOTAÇÕES: o diário do personagem, uma página por sessão de jogo.
 *
 * Esta aba já foi a ficha inteira — perfil, inventário, aparência, história e o diário, tudo na
 * mesma tela. O usuário pediu para separar ("vamos botar uma aba pra FICHA, outra para anotações"),
 * e o resto mudou-se para `SheetTab.tsx`. O ganho não é arrumação: o diário é o que se escreve
 * DURANTE o jogo e era o que ficava mais espremido dividindo altura com blocos que quase não mudam.
 *
 * A barra de formatação (fonte, negrito, itálico, sublinhado, cor) ficou AQUI e não foi para a
 * ficha, porque é a caneta com que se escreve o diário — na ficha se anota, não se redige.
 */
export function NotesTab() {
  const t = useTranslation()
  const { notes, saveError, loadError, updateField, updatePage, goToPage, addPage, removePage } =
    useNotes()

  const page = notes.pages[notes.currentPage]
  const dayLabel = t.notesTab.dayNumber.replace('{n}', String(notes.currentPage + 1))

  /** A formatação da barra vale pra página inteira do diário. */
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

  return (
    <Card className="notes-tab">
      <div className="notes-toolbar">
{/*
          O MESMO seletor das Preferências, e não um `<select>` nativo — que era o que faltava pras
          caveirinhas do Sans e do Papyrus aparecerem aqui: `<option>` não desenha imagem em navegador
          nenhum, e é por isso que aquele componente existe (ver `FontSelect.tsx`).
        */}
        <FontSelect
          value={familyToFontId(notes.font)}
          onChange={(value) => updateField('font', fontIdToFamily(value))}
          defaultLabel={t.notesTab.fontDefault}
        />
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
        {loadError && <span className="notes-save-error">{t.notesTab.loadError}</span>}
        {saveError && <span className="notes-save-error">{t.notesTab.saveError}</span>}
      </div>

      {/*
        A aba inteira é o DIÁRIO agora. Ficha (perfil, atributos, habilidades, inventário, aparência
        e história) virou aba própria — ver `SheetTab.tsx` e o comentário lá sobre a divisão.

        O que sobrou aqui ganhou toda a largura e toda a altura, que é o que o usuário perdeu quando
        as duas coisas dividiam a tela: o diário é o que se escreve DURANTE o jogo, e era o que
        ficava mais espremido.
      */}
      <fieldset className="notes-group notes-group-grow notes-group-diary">
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
              placeholder={t.notesTab.dayTitlePlaceholder}
              onChange={(e) => updatePage({ title: e.target.value })}
            />
            {/*
              Salto direto pra qualquer sessão. As setas continuam, mas sozinhas elas só servem
              pra um punhado de páginas: com vinte sessões, chegar na terceira a partir da última
              são dezessete cliques. O seletor mostra o nome escrito pela pessoa, ou "Sessão N"
              pela posição quando ela não escreveu nada — a mesma regra do campo de título.
            */}
            <select
              className="notes-diary-jump"
              title={t.notesTab.dayJump}
              aria-label={t.notesTab.dayJump}
              value={notes.currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
            >
              {notes.pages.map((item, index) => (
                <option key={item.id} value={index}>
                  {item.title || t.notesTab.dayNumber.replace('{n}', String(index + 1))}
                </option>
              ))}
            </select>
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
    </Card>
  )
}
