import { useEffect, type CSSProperties } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useNotes } from '@renderer/hooks/useNotes'
import { FONT_OPTIONS, type FontId } from '@renderer/settings/SettingsContext'
import { FontSelect, type FontSelectValue } from '../chrome/FontSelect'
import { ProfileSelect } from './ProfileSelect'
import { useProfiles } from '@renderer/settings/ProfilesContext'
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
  return (FONT_OPTIONS.find((font) => font.family === family)?.id as FontId | undefined) ?? ''
}

function fontIdToFamily(id: FontSelectValue): string {
  return FONT_OPTIONS.find((font) => font.id === id)?.family ?? ''
}

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
  const profiles = useProfiles()

  const nomeDoPerfil = (index: number): string =>
    profiles.profiles[index].name || t.notesTab.profileUnnamed.replace('{n}', String(index + 1))

  /**
   * Adota UMA VEZ o nome que estava em `notes.characterName`, de quem já usava o app antes de
   * existirem perfis. Sem isso a pessoa abriria a ficha e veria o campo de nome vazio, com o nome
   * antigo preso dentro do arquivo de anotações e sem nenhum caminho até ele.
   *
   * A condição é estreita de propósito — só quando o perfil ainda não tem nome nenhum —, então isto
   * nunca sobrescreve um nome escrito de verdade.
   */
  useEffect(() => {
    if (profiles.active.name || !notes.characterName) return
    profiles.update(profiles.activeId, { name: notes.characterName })
  }, [notes.characterName, profiles.active.name, profiles.activeId])

  function handleRemoveProfile(): void {
    const index = profiles.profiles.findIndex((p) => p.id === profiles.activeId)
    if (profiles.profiles.length <= 1) return
    if (!confirm(t.notesTab.profileDeleteConfirm.replace('{name}', nomeDoPerfil(index)))) return
    profiles.remove(profiles.activeId)
  }

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
        {saveError && <span className="notes-save-error">{t.notesTab.saveError}</span>}
      </div>

{/*
        PERFIL do personagem: foto, nome, sistema e o seletor que troca de personagem — pedido do
        usuário ("um espaço para poder selecionar o profile do personagem, tipo nome e qual sistema
        de rpg, e aí precisa colocar uma foto também").

        Trocar aqui troca TUDO: anotações, presets e as cores da cena vêm da pasta e das preferências
        daquele personagem (ver `ProfilesContext` e `PROFILE_LOOK_KEYS`). Fica nesta faixa, que já era
        o cabeçalho da ficha, porque é literalmente a mesma informação — só que agora ela identifica
        um compartimento inteiro em vez de ser um campo de texto solto.

        O nome mora no PERFIL, não mais em `notes.characterName`: é ele que aparece no seletor. O
        campo antigo continua no arquivo de anotações e é adotado uma vez, pra quem já tinha um nome
        escrito antes de existirem perfis não achar que perdeu.
      */}
      <fieldset className="notes-group notes-group-name">
        <legend>{t.notesTab.sheetBlock}</legend>
        <div className="notes-profile">
          <button
            type="button"
            className="notes-profile-photo"
            title={t.notesTab.profilePhoto}
            onClick={() => void profiles.pickPhoto(profiles.activeId)}
          >
            {profiles.active.photo ? (
              <img src={profiles.active.photo} alt="" />
            ) : (
              <span>{t.notesTab.profilePhotoEmpty}</span>
            )}
          </button>

          <div className="notes-profile-fields">
            <label className="notes-field">
              <span>{t.notesTab.name}</span>
              <input
                value={profiles.active.name}
                onChange={(e) => profiles.update(profiles.activeId, { name: e.target.value })}
              />
            </label>
            <label className="notes-field">
              <span>{t.notesTab.profileSystem}</span>
              <input
                value={profiles.active.system}
                placeholder="Ordem Paranormal, Kids on Bikes, Oblivio..."
                onChange={(e) => profiles.update(profiles.activeId, { system: e.target.value })}
              />
            </label>
          </div>

          <div className="notes-profile-actions">
{/*
              Seletor PRÓPRIO, não um `<select>` nativo: a lista mostra a miniatura 3×4 de cada
              personagem ao lado do nome, e `<option>` não desenha imagem em navegador nenhum — a
              mesma parede que fez o seletor de fonte existir.
            */}
            <ProfileSelect
              profiles={profiles.profiles}
              activeId={profiles.activeId}
              onSelect={profiles.select}
              fallbackName={nomeDoPerfil}
              label={t.notesTab.profileSwitch}
              emptyPhotoLabel={t.notesTab.profilePhotoEmpty}
            />
            <Button variant="secondary" onClick={profiles.create}>
              {t.notesTab.profileNew}
            </Button>
            <Button
              variant="ghost"
              title={t.notesTab.profileDelete}
              aria-label={t.notesTab.profileDelete}
              disabled={profiles.profiles.length <= 1}
              onClick={handleRemoveProfile}
            >
              ✕
            </Button>
          </div>
        </div>
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
        </div>
      </div>
    </Card>
  )
}
