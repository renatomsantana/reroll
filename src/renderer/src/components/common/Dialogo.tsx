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
 * O motivo é um defeito do Electron no Windows, relatado como dois bugs: "criamos um preset,
 * apagamos, e não conseguimos criar outro" e "importamos uma ficha, apagamos um preset, e a ficha
 * não deixa editar mais nada". Os dois começam num `confirm()` nativo: depois que o diálogo do
 * sistema fecha, o Chromium do Electron deixa a janela sem foco de teclado, e os campos param de
 * receber tecla até a janela perder e ganhar foco de novo.
 *
 * `useDialogo()` devolve `confirmar`, `avisar` e `escolher` como promessas. FORA do provedor (um
 * teste que monta a aba sozinha) cai nos nativos, que nos testes não têm o defeito porque não há
 * janela.
 */
export interface OpcaoDoDialogo {
  id: string
  label: string
}

interface DialogoContextValue {
  confirmar: (texto: string) => Promise<boolean>
  avisar: (texto: string) => Promise<void>
  /**
   * UMA ESCOLHA numa lista — a lista de sistemas da importação (pedido dele, 06/09/2026): o texto
   * em cima, um seletor fechado mostrando `marcado` (a lista abre no clique), e o botão principal
   * com o rótulo dado. Resolve com o `id` escolhido, ou `null` no Cancelar/Esc.
   */
  escolher: (texto: string, opcoes: OpcaoDoDialogo[], marcado: string, botao: string) => Promise<string | null>
}

interface Pedido {
  tipo: 'confirmar' | 'avisar' | 'escolher'
  texto: string
  opcoes?: OpcaoDoDialogo[]
  marcado?: string
  botao?: string
  resolver: (resultado: boolean | string | null) => void
}

const DialogoContext = createContext<DialogoContextValue | null>(null)

export function DialogoProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null)

  const abrir = useCallback(
    (dados: Omit<Pedido, 'resolver'>) =>
      new Promise<boolean | string | null>((resolver) => {
        setPedido({ ...dados, resolver })
      }),
    []
  )

  const valor = useMemo<DialogoContextValue>(
    () => ({
      confirmar: async (texto) => (await abrir({ tipo: 'confirmar', texto })) === true,
      avisar: async (texto) => {
        await abrir({ tipo: 'avisar', texto })
      },
      escolher: async (texto, opcoes, marcado, botao) => {
        const resultado = await abrir({ tipo: 'escolher', texto, opcoes, marcado, botao })
        return typeof resultado === 'string' ? resultado : null
      }
    }),
    [abrir]
  )

  function fechar(resultado: boolean | string | null): void {
    pedido?.resolver(resultado)
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
      },
      // Sem provedor não há lista: fica o que já estava marcado, que é o que o app detectou.
      escolher: (_texto, _opcoes, marcado) => Promise.resolve(marcado)
    }
  )
}

function Dialogo({ pedido, onFechar }: { pedido: Pedido; onFechar: (resultado: boolean | string | null) => void }) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)
  const opcoes = pedido.opcoes ?? []
  const [selecionado, setSelecionado] = useState(pedido.marcado ?? opcoes[0]?.id ?? '')
  const ehLista = pedido.tipo === 'escolher'

  function confirmar(): void {
    onFechar(ehLista ? selecionado : true)
  }

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFechar(ehLista ? null : false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onFechar(ehLista ? selecionado : true)
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar, ehLista, selecionado])

  return (
    <div className="modal-overlay dialogo-overlay" onClick={() => onFechar(ehLista ? null : false)}>
      <Card ref={cardRef} className="dialogo" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p className="dialogo-texto">{pedido.texto}</p>
        {/*
          UM nome fechado, e a lista só no clique (pedido dele, 06/09/2026: "ainda quero apenas UM
          nome, aí clica e sobe a lista para escolher UM nome"). Foi uma caixa aberta com todos os
          nomes; um `<select>` nativo é exatamente o gesto que ele descreveu, e já é o do 98.
        */}
        {ehLista && (
          <select className="dialogo-select" value={selecionado} onChange={(e) => setSelecionado(e.target.value)} aria-label={pedido.texto}>
            {opcoes.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.label}
              </option>
            ))}
          </select>
        )}
        <div className="dialogo-acoes">
          {pedido.tipo !== 'avisar' && (
            <Button variant="ghost" onClick={() => onFechar(ehLista ? null : false)}>
              {t.dialog.cancel}
            </Button>
          )}
          <Button variant="primary" onClick={confirmar} autoFocus>
            {ehLista ? pedido.botao : t.dialog.ok}
          </Button>
        </div>
      </Card>
    </div>
  )
}
