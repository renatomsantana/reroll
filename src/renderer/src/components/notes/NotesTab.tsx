import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useDialogo } from '@renderer/components/common/Dialogo'
import { useNotes } from '@renderer/hooks/useNotes'
import { useSettings } from '@renderer/settings/SettingsContext'
import type { Language } from '@shared/types/idioma'
import { TAMANHO_MAXIMO_DA_ANOTACAO } from '@shared/types/notes'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { EditorDeAnotacoesRich, type EditorDeAnotacoesRichHandle, type RichFormatState, visibleText } from './EditorDeAnotacoesRich'
import './NotesTab.css'

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
 * A NAVEGAÇÃO É UMA LISTA, e não mais as setas ◀ ▶ com um contador e um seletor de salto ao lado:
 * "ajeita as anotações para ser uma lista com as sessões e poder escolher e dizer qual dia foi criada,
 * e deixa mais organizado algo como o Obsidian". Em concreto, chegar na terceira de vinte sessões era
 * escolher entre dezessete cliques na seta ou abrir um `<select>` que mostra um nome por vez; agora
 * elas estão todas na tela, com o nome e o dia em que nasceram, e escolher é um clique.
 *
 * O "como o Obsidian" é a FORMA (coluna de arquivos à esquerda, texto à direita), não a aparência: a
 * moldura continua Windows 98. A barra de formatação fica no alto, valendo pro diário inteiro — é a
 * caneta com que se escreve, e não pertence a nenhuma sessão em particular.
 */
export function NotesTab() {
  const t = useTranslation()
  const dialogo = useDialogo()
  const { language } = useSettings()
  const { notes, saveError, loadError, updatePage, goToPage, addPage, removePage } =
    useNotes()
  const page = notes.pages[notes.currentPage]
  const dayLabel = t.notesTab.dayNumber.replace('{n}', String(notes.currentPage + 1))
  const editorRef = useRef<EditorDeAnotacoesRichHandle>(null)
  const [formatState, setFormatState] = useState<RichFormatState>({ bold: false, italic: false, underline: false })

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

  function format(command: 'bold' | 'italic' | 'underline' | 'foreColor', value?: string): void {
    editorRef.current?.format(command, value)
  }

  function handleRemovePage(): void {
    void dialogo.confirmar(t.notesTab.dayDeleteConfirm.replace('{day}', page.title || dayLabel)).then((ok) => {
      if (ok) removePage()
    })
  }

  return (
    <Card className="notes-tab">
      <div className="notes-toolbar">
        <button
          type="button"
          className={`fmt-btn fmt-btn-bold ${formatState.bold ? 'active' : ''}`}
          title={t.notesTab.boldLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('bold')}
        >
          B
        </button>
        <button
          type="button"
          className={`fmt-btn fmt-btn-italic ${formatState.italic ? 'active' : ''}`}
          title={t.notesTab.italicLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('italic')}
        >
          I
        </button>
        <button
          type="button"
          className={`fmt-btn fmt-btn-underline ${formatState.underline ? 'active' : ''}`}
          title={t.notesTab.underlineLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('underline')}
        >
          U
        </button>
        <input
          type="color"
          className="notes-color-input"
          title={t.notesTab.colorLabel}
          defaultValue="#000000"
          onChange={(e) => format('foreColor', e.target.value)}
        />
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
          <EditorDeAnotacoesRich
            ref={editorRef}
            value={page.text}
            richText={page.richText === true}
            /*
             * O TETO da sessão (ver `TAMANHO_MAXIMO_DA_ANOTACAO`): o `maxLength` para a digitação
             * no limite, e o corte no `onChange` cobre o que entra por outro caminho (arrastar
             * texto pra dentro, por exemplo). Sessão antiga MAIOR que o teto continua inteira —
             * só não cresce mais.
             */
            maxLength={TAMANHO_MAXIMO_DA_ANOTACAO}
            onChange={(text) => updatePage({ text, richText: true })}
            onFormatStateChange={setFormatState}
          />
          {/* O contador diz onde se está ANTES de o campo parar de aceitar — cheio, avisa em cor. */}
          <div
            className={`notes-contador ${
              visibleText(page.richText ? page.text : page.text.replaceAll('\n', '<br>')).length >= TAMANHO_MAXIMO_DA_ANOTACAO ? 'notes-contador-cheio' : ''
            }`}
          >
            {visibleText(page.richText ? page.text : page.text.replaceAll('\n', '<br>')).length}/{TAMANHO_MAXIMO_DA_ANOTACAO}
          </div>
        </div>
      </div>
    </Card>
  )
}
