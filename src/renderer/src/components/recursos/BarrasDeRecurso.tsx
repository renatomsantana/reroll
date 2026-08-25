import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  estadoDoRecurso,
  lerEntradaDeRecurso,
  prenderAtual,
  type RecursoVital
} from '@shared/types/recursoVital'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { IconeLapis } from '../common/IconeLapis'
import './BarrasDeRecurso.css'

/**
 * As BARRAS DE RECURSO (spec §3.4): PV, PE, Sanidade — o que o personagem gasta e recupera na
 * sessão, sempre à vista na tela de rolagem, com "−" e "+" ao lado de cada uma.
 *
 * É o gesto mais frequente de uma sessão online ("tomei 7", "gastei 2 PE"), e por isso três
 * decisões deste arquivo:
 *
 * - a barra mora na tela onde os dados rolam, e no modo compacto também (`compact`): tomar dano
 *   não pode exigir sair da janelinha nem abrir a aba Ficha;
 * - cada clique GRAVA na hora (quem grava é o `useNotes`, que escreve o arquivo inteiro a cada
 *   mudança — ver lá): fechar o app no meio do combate não perde o PV;
 * - o número é clicável e aceita conta ("-7") — vinte e três cliques no "−" não é tracker, é
 *   castigo. Ver `lerEntradaDeRecurso`.
 *
 * Nada de automático: a barra não desconta o dano da rolagem nem soma cura sozinha. O jogador
 * manda, e é o que a spec pede nesta fase.
 */
interface BarrasDeRecursoProps {
  recursos: RecursoVital[]
  onChange: (recursos: RecursoVital[]) => void
  /** Abre o editor (nome, máximo, cor, acrescentar, remover). Ausente no modo compacto. */
  onEdit?: () => void
  /** O botão DESCANSAR (spec §3.8), ao lado das barras — só existe quando há barra pra devolver. */
  onRest?: () => void
  /** A versão fina do modo compacto: sem título, sem dica, uma linha de 16px por barra. */
  compact?: boolean
}

/** Quanto anda com Shift ou segurando o botão. */
const PASSO_GRANDE = 5
/** Segurar o botão por este tempo começa a repetir (ver `useSegurar`). */
const ATRASO_DO_SEGURAR_MS = 400
const INTERVALO_DO_SEGURAR_MS = 200

export function BarrasDeRecurso({ recursos, onChange, onEdit, onRest, compact = false }: BarrasDeRecursoProps) {
  const t = useTranslation()

  function alterar(id: string, mudanca: Partial<Pick<RecursoVital, 'atual' | 'maximo'>>): void {
    onChange(
      recursos.map((recurso) => {
        if (recurso.id !== id) return recurso
        const maximo = mudanca.maximo ?? recurso.maximo
        return { ...recurso, maximo, atual: prenderAtual(mudanca.atual ?? recurso.atual, maximo) }
      })
    )
  }

  if (compact) {
    if (recursos.length === 0) return null
    return (
      <div className="barras-compactas" role="group" aria-label={t.resources.title}>
        {recursos.map((recurso) => (
          <BarraDeRecurso key={recurso.id} recurso={recurso} onChange={(mudanca) => alterar(recurso.id, mudanca)} compact />
        ))}
      </div>
    )
  }

  return (
    <fieldset className="barras-de-recurso">
      <legend>
        {t.resources.title}
        {onEdit && (
          <button type="button" className="barras-editar" onClick={onEdit} title={t.resources.edit} aria-label={t.resources.edit}>
            <IconeLapis tamanho={11} />
          </button>
        )}
        {onRest && recursos.length > 0 && (
          <button type="button" className="barras-descansar" onClick={onRest}>
            {t.rest.button}
          </button>
        )}
      </legend>
      {recursos.length === 0 ? (
        <p className="barras-vazio">{t.resources.empty}</p>
      ) : (
        <div className="barras-lista" title={t.resources.hint}>
          {recursos.map((recurso) => (
            <BarraDeRecurso key={recurso.id} recurso={recurso} onChange={(mudanca) => alterar(recurso.id, mudanca)} />
          ))}
        </div>
      )}
    </fieldset>
  )
}

interface BarraDeRecursoProps {
  recurso: RecursoVital
  onChange: (mudanca: Partial<Pick<RecursoVital, 'atual' | 'maximo'>>) => void
  compact?: boolean
}

function BarraDeRecurso({ recurso, onChange, compact = false }: BarraDeRecursoProps) {
  const t = useTranslation()
  const [digitando, setDigitando] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (digitando !== null) inputRef.current?.select()
  }, [digitando])

  const estado = estadoDoRecurso(recurso)
  const fracao = recurso.maximo > 0 ? Math.min(1, recurso.atual / recurso.maximo) : 0

  function somar(passo: number): void {
    onChange({ atual: recurso.atual + passo })
  }

  /** Clique simples anda 1; com Shift, 5. O segurar é tratado em `useSegurar`, e ignora este. */
  function aoClicar(sinal: 1 | -1) {
    return (e: MouseEvent<HTMLButtonElement>) => {
      if (segurou.current) {
        segurou.current = false
        return
      }
      somar(sinal * (e.shiftKey ? PASSO_GRANDE : 1))
    }
  }

  const { segurou, aoPressionar, aoSoltar } = useSegurar((sinal) => somar(sinal * PASSO_GRANDE))

  function confirmarDigitado(): void {
    if (digitando === null) return
    const lido = lerEntradaDeRecurso(digitando, recurso)
    setDigitando(null)
    if (lido) onChange(lido)
  }

  function aoTeclarNoCampo(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmarDigitado()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDigitando(null)
    }
  }

  const rotuloDoValor = t.resources.valueLabel
    .replace('{name}', recurso.nome)
    .replace('{current}', String(recurso.atual))
    .replace('{max}', String(recurso.maximo))

  return (
    <div
      className={`barra-recurso barra-${estado} ${compact ? 'barra-compacta' : ''} ${recurso.cor ? 'barra-cor-fixa' : ''}`}
      style={recurso.cor ? ({ '--recurso-cor': recurso.cor } as React.CSSProperties) : undefined}
    >
      <span className="barra-nome" title={recurso.nome}>
        {recurso.nome}
      </span>
      <div className="barra-trilho" role="progressbar" aria-label={recurso.nome} aria-valuemin={0} aria-valuemax={recurso.maximo} aria-valuenow={recurso.atual}>
        <div className="barra-preenchido" style={{ width: `${fracao * 100}%` }} />
      </div>
      <button
        type="button"
        className="barra-passo"
        aria-label={t.resources.minus.replace('{name}', recurso.nome)}
        onClick={aoClicar(-1)}
        onPointerDown={aoPressionar(-1)}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        −
      </button>
      {digitando === null ? (
        <button type="button" className="barra-valor" aria-label={rotuloDoValor} title={rotuloDoValor} onClick={() => setDigitando(String(recurso.atual))}>
          {recurso.atual}
          <span className="barra-valor-max">/{recurso.maximo}</span>
        </button>
      ) : (
        <input
          ref={inputRef}
          className="barra-entrada"
          value={digitando}
          placeholder={t.resources.inputPlaceholder}
          aria-label={rotuloDoValor}
          onChange={(e) => setDigitando(e.target.value)}
          onKeyDown={aoTeclarNoCampo}
          onBlur={confirmarDigitado}
          autoFocus
        />
      )}
      <button
        type="button"
        className="barra-passo"
        aria-label={t.resources.plus.replace('{name}', recurso.nome)}
        onClick={aoClicar(1)}
        onPointerDown={aoPressionar(1)}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        +
      </button>
    </div>
  )
}

/**
 * SEGURAR o botão: depois de `ATRASO_DO_SEGURAR_MS`, aplica o passo grande e repete a cada
 * `INTERVALO_DO_SEGURAR_MS` até soltar. É o "hold = ±5" da spec.
 *
 * O `segurou` existe pelo `click` que o navegador dispara ao soltar: sem a marca, soltar depois de
 * segurar ainda somaria 1 por cima dos 5 que o segurar já aplicou. Quem consome a marca é o
 * `onClick` da barra.
 */
function useSegurar(aplicar: (sinal: 1 | -1) => void) {
  const segurou = useRef(false)
  const atraso = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeticao = useRef<ReturnType<typeof setInterval> | null>(null)
  const aplicarRef = useRef(aplicar)
  aplicarRef.current = aplicar

  function parar(): void {
    if (atraso.current) clearTimeout(atraso.current)
    if (repeticao.current) clearInterval(repeticao.current)
    atraso.current = null
    repeticao.current = null
  }

  useEffect(() => parar, [])

  function aoPressionar(sinal: 1 | -1) {
    return (e: PointerEvent<HTMLButtonElement>) => {
      // Só o botão principal: o direito abre menu, o do meio rola a página.
      if (e.button !== 0) return
      parar()
      atraso.current = setTimeout(() => {
        segurou.current = true
        aplicarRef.current(sinal)
        repeticao.current = setInterval(() => aplicarRef.current(sinal), INTERVALO_DO_SEGURAR_MS)
      }, ATRASO_DO_SEGURAR_MS)
    }
  }

  function aoSoltar(): void {
    parar()
  }

  return { segurou, aoPressionar, aoSoltar }
}
