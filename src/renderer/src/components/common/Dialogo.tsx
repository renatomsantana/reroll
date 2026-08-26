import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from './Button'
import { Card } from './Card'
import './Dialogo.css'

/**
 * OS DIÁLOGOS DO APP — "tem certeza?" e "não deu" — como janela do próprio app, e não o
 * `confirm()`/`alert()` do sistema.
 *
 * O motivo é um defeito do Electron no Windows, relatado pelo usuário como dois bugs: "criamos um
 * preset, apagamos, e não conseguimos criar outro" e "importamos uma ficha, apagamos um preset, e a
 * ficha não deixa editar mais nada". Os dois começam num `confirm()` nativo (o de apagar preset):
 * depois que o diálogo do sistema fecha, o Chromium do Electron deixa a janela sem foco de teclado
 * — os campos de texto param de receber tecla até a janela perder e ganhar foco de novo. O nome do
 * preset novo não digita; a ficha não digita. Um diálogo desenhado pelo app não tem esse efeito,
 * e ainda fica na cara do 98 em vez da caixa cinza do sistema.
 *
 * `useDialogo()` devolve `confirmar(texto)` e `avisar(texto)`, como promessas. FORA do provedor
 * (um teste que monta a aba sozinha) ele cai nos nativos — o comportamento de antes, que nos testes
 * não tem o defeito porque não há janela.
 */
interface DialogoContextValue {
  confirmar: (texto: string) => Promise<boolean>
  avisar: (texto: string) => Promise<void>
}

interface Pedido {
  tipo: 'confirmar' | 'avisar'
  texto: string
  resolver: (ok: boolean) => void
}

const DialogoContext = createContext<DialogoContextValue | null>(null)

export function DialogoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)

  const abrir = useCallback(
    (tipo: Pedido['tipo'], texto: string) =>
      new Promise<boolean>((resolver) => {
        setPedido({ tipo, texto, resolver })
      }),
    []
  )

  const valor = useMemo<DialogoContextValue>(
    () => ({
      confirmar: (texto) => abrir('confirmar', texto),
      avisar: async (texto) => {
        await abrir('avisar', texto)
      }
    }),
    [abrir]
  )

  function fechar(ok: boolean): void {
    pedido?.resolver(ok)
    setPedido(null)
  }

  return (
    <DialogoContext.Provider value={valor}>
      {children}
      {pedido && <Dialogo pedido={pedido} onFechar={fechar} />}
    </DialogoContext.Provider>
  )
}

export function useDialogo(): DialogoContextValue {
  const contexto = useContext(DialogoContext)
  return (
    contexto ?? {
      confirmar: (texto) => Promise.resolve(window.confirm(texto)),
      avisar: (texto) => {
        window.alert(texto)
        return Promise.resolve()
      }
    }
  )
}

function Dialogo({ pedido, onFechar }: { pedido: Pedido; onFechar: (ok: boolean) => void }) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onFechar(true)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar])

  return (
    <div className="modal-overlay dialogo-overlay" onClick={() => onFechar(false)}>
      <Card ref={cardRef} className="dialogo" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="dialogo-texto">{pedido.texto}</p>
        <div className="dialogo-acoes">
          {pedido.tipo === 'confirmar' && (
            <Button variant="ghost" onClick={() => onFechar(false)}>
              {t.dialog.cancel}
            </Button>
          )}
          <Button variant="primary" onClick={() => onFechar(true)} autoFocus>
            {t.dialog.ok}
          </Button>
        </div>
      </Card>
    </div>
  )
}
