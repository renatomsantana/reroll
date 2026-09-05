import { forwardRef, type MouseEvent, type TextareaHTMLAttributes } from 'react'
import { flushSync } from 'react-dom'
import { quebrasParaOClique } from './cliqueNaLinha'

/**
 * A `textarea` onde SE ESCREVE ONDE SE CLICA: o caderno das anotações e as caixas da ficha.
 *
 * Pedido dele, duas vezes (02 e 04/09/2026): "clicar com o mouse onde quiser digitar, não precisar
 * apenas com Enter". O navegador, num clique abaixo do texto, põe o cursor no fim da última linha;
 * aqui o clique numa pauta vazia acrescenta as quebras que faltam até ela e deixa o cursor lá
 * (ver `cliqueNaLinha.ts`). Clique em cima de texto que existe não mexe em nada.
 *
 * O `flushSync` é o que põe o cursor no lugar certo SEM esperar: a gravação é do dono do texto
 * (`onChangeText`, que na prática é o `useNotes`), e o cursor só pode ir pro fim depois que o
 * campo mostra o texto novo. Com o React forçado a pintar ali mesmo, o gesto inteiro acontece no
 * clique, e se o dono recusou a mudança (teto da anotação, ficha ainda carregando) o campo continua
 * igual e o cursor fica onde o navegador pôs.
 */
interface CampoDeCadernoProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string
  onChangeText: (texto: string) => void
}

export const CampoDeCaderno = forwardRef<HTMLTextAreaElement, CampoDeCadernoProps>(function CampoDeCaderno(
  { value, onChangeText, onClick, ...resto },
  ref
) {
  function aoClicar(e: MouseEvent<HTMLTextAreaElement>): void {
    onClick?.(e)
    const campo = e.currentTarget
    const faltam = quebrasParaOClique(campo, e.clientY)
    if (faltam === 0) return
    const antes = campo.value
    flushSync(() => onChangeText(value + '\n'.repeat(faltam)))
    if (campo.value === antes) return
    campo.focus()
    campo.setSelectionRange(campo.value.length, campo.value.length)
  }

  return <textarea ref={ref} value={value} onClick={aoClicar} onChange={(e) => onChangeText(e.target.value)} {...resto} />
})
