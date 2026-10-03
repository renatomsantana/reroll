import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent
} from 'react'

export type RichFormatCommand = 'bold' | 'italic' | 'underline' | 'foreColor'

export interface RichFormatState {
  bold: boolean
  italic: boolean
  underline: boolean
}

export interface EditorDeAnotacoesRichHandle {
  format: (command: RichFormatCommand, value?: string) => void
}

interface EditorDeAnotacoesRichProps {
  value: string
  richText: boolean
  maxLength: number
  onChange: (html: string) => void
  onFormatStateChange: (state: RichFormatState) => void
}

/**
 * Campo rico do diário. A formatação vira marcação no próprio texto, em vez de
 * uma regra CSS no diário inteiro: desligar o B só muda o que será digitado a
 * partir dali; o trecho já escrito continua em negrito.
 */
export const EditorDeAnotacoesRich = forwardRef<EditorDeAnotacoesRichHandle, EditorDeAnotacoesRichProps>(
  function EditorDeAnotacoesRich({ value, richText, maxLength, onChange, onFormatStateChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)
    const lastValidHtmlRef = useRef('')
    const lastEmittedHtmlRef = useRef<string | null>(null)

    useEffect(() => {
      const editor = editorRef.current
      if (!editor) return
      const html = richText ? sanitizeRichHtml(value) : escapeText(value)
      // O navegador pode manter <font color> enquanto o valor salvo vira <span style>.
      // Reescrever o DOM após cada tecla por essa diferença manda o cursor para o começo.
      // O valor vindo do próprio editor já está sanitizado; sincronizar o DOM só quando a
      // anotação mudar por fora (troca de sessão, importação etc.).
      if (lastEmittedHtmlRef.current !== html && editor.innerHTML !== html) editor.innerHTML = html
      lastEmittedHtmlRef.current = null
      lastValidHtmlRef.current = html
    }, [value, richText])

    function reportFormatState(): void {
      onFormatStateChange({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline')
      })
    }

    function save(): void {
      const editor = editorRef.current
      if (!editor) return
      const html = sanitizeRichHtml(editor.innerHTML)
      if (visibleText(html).length > maxLength) {
        editor.innerHTML = lastValidHtmlRef.current
        return
      }
      lastValidHtmlRef.current = html
      lastEmittedHtmlRef.current = html
      onChange(html)
      reportFormatState()
    }

    function onInput(_event: FormEvent<HTMLDivElement>): void {
      save()
    }

    function onPaste(event: ClipboardEvent<HTMLDivElement>): void {
      // Cola somente texto: evita trazer HTML, links escondidos ou estilos de uma página externa.
      event.preventDefault()
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
    }

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
      const editor = editorRef.current
      if (editor && visibleText(editor.innerHTML).length >= maxLength) event.preventDefault()
    }

    useImperativeHandle(ref, () => ({
      format(command, value) {
        const editor = editorRef.current
        if (!editor) return
        editor.focus()
        document.execCommand(command, false, value)
        save()
      }
    }))

    return (
      <div
        ref={editorRef}
        className="notes-textarea notes-rich-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        spellCheck
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onKeyUp={reportFormatState}
        onMouseUp={reportFormatState}
        onFocus={reportFormatState}
      />
    )
  }
)

/** Texto antigo é texto literal; só páginas já editadas no campo rico são tratadas como HTML. */
function escapeText(text: string): string {
  const container = document.createElement('div')
  container.textContent = text
  return container.innerHTML.replaceAll('\n', '<br>')
}

/** Mantém só os poucos elementos que o editor cria. */
export function sanitizeRichHtml(html: string): string {
  const source = document.createElement('template')
  source.innerHTML = html
  const output = document.createElement('div')

  function copy(node: Node, parent: HTMLElement): void {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.textContent ?? ''))
      return
    }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName.toLowerCase()
    const allowed = tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em' || tag === 'u' || tag === 'br' || tag === 'div' || tag === 'p' || tag === 'span' || tag === 'font'
    if (!allowed) {
      node.childNodes.forEach((child) => copy(child, parent))
      return
    }
    if (tag === 'br') {
      parent.append(document.createElement('br'))
      return
    }
    const element = document.createElement(tag === 'strong' ? 'b' : tag === 'em' ? 'i' : tag === 'font' ? 'span' : tag)
    const color = node.style.color || node.getAttribute('color')
    // O navegador escreve `rgb(r, g, b)` ao aplicar foreColor, mesmo quando o seletor entregou
    // `#rrggbb`. Aceitar só hex apagava a cor na primeira gravação do diário.
    if (color && (/^#[0-9a-f]{6}$/i.test(color) || corRgbValida(color))) element.style.color = color
    node.childNodes.forEach((child) => copy(child, element))
    parent.append(element)
  }

  source.content.childNodes.forEach((node) => copy(node, output))
  return output.innerHTML
}

function corRgbValida(color: string): boolean {
  const parts = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(color)
  return parts !== null && parts.slice(1).every((part) => Number(part) <= 255)
}

export function visibleText(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  return container.innerText
}
