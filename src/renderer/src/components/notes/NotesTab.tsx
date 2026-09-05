import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useDialogo } from '@renderer/components/common/Dialogo'
import { useNotes } from '@renderer/hooks/useNotes'
import { FONT_OPTIONS, useSettings } from '@renderer/settings/SettingsContext'
import type { Language } from '@shared/types/idioma'
import { useProfiles } from '@renderer/settings/ProfilesContext'
import { TAMANHO_MAXIMO_DA_ANOTACAO, textoDeAnotacaoLimitado } from '@shared/types/notes'
import { FontSelect, type FontSelectValue } from '../chrome/FontSelect'
import { ProfileBadge } from '../common/ProfileBadge'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { CampoDeCaderno } from './CampoDeCaderno'
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
  return FONT_OPTIONS.find((font) => font.family === family)?.id ?? ''
}

function fontIdToFamily(id: FontSelectValue): string {
  return FONT_OPTIONS.find((font) => font.id === id)?.family ?? ''
}

/**
 * A data de criação, no formato do idioma da interface (21/08/2026 em português, 08/21/2026 em
 * inglês) — em vez de um formato fixo escolhido aqui, que estaria errado pra metade das pessoas.
 *
 * Só a DATA, sem hora: a lista é uma coluna estreita ao lado do texto, e a hora em que se começou a
 * escrever não é o que se procura quando se bate o olho nela.
 */
function formatarCriacao(createdAt: number, idioma: Language): string {
  return new Date(createdAt).toLocaleDateString(idioma, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * ANOTAÇÕES: o diário do personagem, uma sessão por dia de jogo.
 *
 * A NAVEGAÇÃO É UMA LISTA, e não mais as setas ◀ ▶ com um contador e um seletor de salto ao lado.
 * Pedido do usuário: "ajeita as anotações para ser uma lista com as sessões e poder escolher e dizer
 * qual dia foi criada, e deixa mais organizado algo como o Obsidian".
 *
 * O que isso troca, em concreto: antes, chegar na terceira de vinte sessões era escolher entre
 * dezessete cliques na seta ou abrir um `<select>` que só mostra um nome por vez. Agora as sessões
 * estão TODAS na tela ao mesmo tempo, com o nome e o dia em que nasceram, e escolher é um clique.
 * Os três controles antigos saíram porque a lista faz o que os três faziam — manter os quatro seria
 * o contrário de "mais organizado".
 *
 * O "como o Obsidian" é a FORMA (coluna de arquivos à esquerda, texto à direita), não a aparência:
 * a moldura continua Windows 98, com a seleção em azul cheio e as bordas de dois tons. Um painel
 * moderno aqui dentro brigaria com o resto do app.
 *
 * A barra de formatação (fonte, negrito, itálico, sublinhado, cor) fica no alto, valendo pro diário
 * inteiro — é a caneta com que se escreve, e ela não pertence a nenhuma sessão em particular.
 */
export function NotesTab() {
  const t = useTranslation()
  const dialogo = useDialogo()
  const { language } = useSettings()
  const { notes, saveError, loadError, updateField, updatePage, goToPage, addPage, removePage } =
    useNotes()
  const profiles = useProfiles()
  const indiceDoAtivo = Math.max(0, profiles.profiles.findIndex((p) => p.id === profiles.activeId))

  const page = notes.pages[notes.currentPage]
  const dayLabel = t.notesTab.dayNumber.replace('{n}', String(notes.currentPage + 1))

  /**
   * A LISTA ROLA ATÉ A SESSÃO ABERTA. Problema que a lista cria e as setas ◀ ▶ não tinham: com vinte
   * sessões, a coluna mostra uma dúzia e "Nova sessão" põe a nova NO FIM, fora da parte visível. Sem
   * isto, o clique acende uma linha que ninguém vê — e da tela isso lê como o botão não ter feito
   * nada, mesmo com o texto à direita já trocado.
   *
   * `block: 'nearest'` pra rolar o MÍNIMO: escolher uma sessão que já está à vista não deve
   * sacudir a coluna pra centralizá-la.
   */
  const aberturaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    aberturaRef.current?.scrollIntoView({ block: 'nearest' })
  }, [notes.currentPage])

  /** A formatação da barra vale pro diário inteiro. */
  const textStyle: CSSProperties = {
    fontFamily: notes.font || undefined,
    fontWeight: notes.bold ? 'bold' : undefined,
    fontStyle: notes.italic ? 'italic' : undefined,
    textDecoration: notes.underline ? 'underline' : undefined,
    color: notes.color || undefined
  }

  function handleRemovePage(): void {
    void dialogo.confirmar(t.notesTab.dayDeleteConfirm.replace('{day}', page.title || dayLabel)).then((ok) => {
      if (ok) removePage()
    })
  }

  return (
    <Card className="notes-tab">
      {/*
        DE QUEM É ESTE CADERNO — o crachá do personagem ativo, e não o seletor.

        O seletor chegou a morar aqui: quando a Ficha saiu da interface no fechamento do alfa, o app
        ficou sem nenhuma porta pra trocar de personagem, e as Anotações receberam a dele. Com a
        Ficha de volta no beta, o usuário decidiu onde cada coisa fica: a TROCA só na Ficha, e as
        Anotações só lembram de quem se trata — "fotinha, nome e sobrenome". Ver `ProfileBadge.tsx`.
      */}
      <div className="notes-profile">
        <ProfileBadge
          profile={profiles.active}
          fallbackName={t.notesTab.profileUnnamed.replace('{n}', String(indiceDoAtivo + 1))}
          emptyPhotoLabel={t.notesTab.profilePhotoEmpty}
        />
      </div>

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

      <div className="notes-workspace">
        {/*
          A COLUNA DAS SESSÕES. Largura fixa de propósito: o texto do diário é que deve crescer com a
          janela, não a lista de nomes — uma coluna de nomes com 400px de largura é espaço morto.
        */}
        <div className="notes-sessions">
          <div className="notes-sessions-head">
            <span className="notes-sessions-title">{t.notesTab.sessionsTitle}</span>
            <Button variant="secondary" className="notes-sessions-new" onClick={addPage}>
              {t.notesTab.dayNew}
            </Button>
          </div>
          {/*
            `listbox`/`option` e não uma lista de botões: pro leitor de tela isto é UMA escolha entre
            várias, com uma marcada — que é o que a coluna é. Uma pilha de botões seria anunciada como
            vinte ações independentes, sem dizer qual está aberta.
          */}
          <div className="notes-sessions-list" role="listbox" aria-label={t.notesTab.sessionsTitle}>
            {notes.pages.map((item, index) => {
              const aberta = index === notes.currentPage
              return (
                <div
                  key={item.id}
                  ref={aberta ? aberturaRef : undefined}
                  role="option"
                  aria-selected={aberta}
                  tabIndex={0}
                  className={`notes-session ${aberta ? 'notes-session-open' : ''}`}
                  onClick={() => goToPage(index)}
                  onKeyDown={(e) => {
                    // Enter e Espaço porque `div` não é botão: sem isto a lista existe pro mouse e
                    // não pro teclado, e o `tabIndex` acima seria uma promessa que não se cumpre.
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    goToPage(index)
                  }}
                >
                  {/*
                    Nome escrito pela pessoa, ou "Sessão N" pela POSIÇÃO quando ela não escreveu nada
                    — a mesma regra do campo de título ao lado. Pela posição, e não por um número
                    gravado: assim apagar a sessão 2 renumera o resto sozinho.
                  */}
                  <span className="notes-session-name">
                    {item.title || t.notesTab.dayNumber.replace('{n}', String(index + 1))}
                  </span>
                  <span className="notes-session-date">
                    {item.createdAt
                      ? t.notesTab.sessionCreated.replace(
                          '{date}',
                          formatarCriacao(item.createdAt, language)
                        )
                      : t.notesTab.sessionCreatedUnknown}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="notes-editor">
          <div className="notes-editor-head">
            {/*
              O nome da sessão é um campo, não um rótulo: o padrão é "Sessão 3" (pela posição) e quem
              quiser escreve "Chegada em Neverwinter" por cima. Vazio volta a ser o número, e o que
              for digitado aqui aparece na lista ao lado na mesma tecla.
            */}
            <input
              className="notes-session-title-input"
              value={page.title}
              placeholder={t.notesTab.dayTitlePlaceholder}
              onChange={(e) => updatePage({ title: e.target.value })}
            />
            <Button
              variant="ghost"
              title={t.notesTab.dayDelete}
              aria-label={t.notesTab.dayDelete}
              onClick={handleRemovePage}
            >
              ✕
            </Button>
          </div>
          {/* Clicar numa pauta vazia leva o cursor pra ela: ver `CampoDeCaderno`. */}
          <CampoDeCaderno
            className="notes-textarea"
            value={page.text}
            /*
             * O TETO da sessão (ver `TAMANHO_MAXIMO_DA_ANOTACAO`): o `maxLength` para a digitação
             * no limite, e o corte no `onChange` cobre o que entra por outro caminho (arrastar
             * texto pra dentro, por exemplo). Sessão antiga MAIOR que o teto continua inteira —
             * só não cresce mais.
             */
            maxLength={TAMANHO_MAXIMO_DA_ANOTACAO}
            onChangeText={(texto) => updatePage({ text: textoDeAnotacaoLimitado(texto) })}
            style={textStyle}
          />
          {/* O contador diz onde se está ANTES de o campo parar de aceitar — cheio, avisa em cor. */}
          <div
            className={`notes-contador ${
              page.text.length >= TAMANHO_MAXIMO_DA_ANOTACAO ? 'notes-contador-cheio' : ''
            }`}
          >
            {page.text.length}/{TAMANHO_MAXIMO_DA_ANOTACAO}
          </div>
        </div>
      </div>
    </Card>
  )
}
