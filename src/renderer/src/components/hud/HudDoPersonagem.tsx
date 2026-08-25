import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Profile } from '@shared/types/profile'
import type { RecursoVital } from '@shared/types/recursoVital'
import { MAXIMO_DE_CONDICOES, criarCondicao, type Canto, type Condicao, type EstadoDoHud } from '@shared/types/hud'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { BarrasDeRecurso } from '../recursos/BarrasDeRecurso'
import { IconeLapis } from '../common/IconeLapis'
import './HudDoPersonagem.css'

/**
 * O HUD DO PERSONAGEM (spec §3.6): o cartão de jogo sobre a cena 3D — retrato, nome, as barras de
 * recurso (as mesmas, com os mesmos "−"/"+") e as condições —, pra gerenciar o personagem sem sair
 * da tela onde os dados caem.
 *
 * É DOM por cima do canvas, e não geometria dentro da cena: texto nítido, custo zero por quadro, e
 * a mesma linguagem visual do resto do app — caixa cinza com relevo, nada de degradê.
 *
 * ARRASTÁVEL entre os quatro cantos: segura pelo cabeçalho, solta, e ele encaixa no canto mais
 * perto. Canto, escondido e mini são do personagem (ver `hud.ts`) e gravam na hora. No modo
 * compacto o HUD não existe — lá as barras finas já fazem esse papel.
 */
interface HudDoPersonagemProps {
  profile: Profile
  fallbackName: string
  recursos: RecursoVital[]
  onChangeRecursos: (recursos: RecursoVital[]) => void
  condicoes: Condicao[]
  onChangeCondicoes: (condicoes: Condicao[]) => void
  hud: EstadoDoHud
  onChangeHud: (hud: EstadoDoHud) => void
  onRest?: () => void
  /** Abre o editor de barras (criar, renomear, máximo, cor). O HUD é a única casa das barras na tela cheia. */
  onEditRecursos?: () => void
}

/** Menos que isto entre apertar e soltar é clique, não arrasto — o canto não muda. */
const ARRASTO_MINIMO_PX = 6

export function HudDoPersonagem({
  profile,
  fallbackName,
  recursos,
  onChangeRecursos,
  condicoes,
  onChangeCondicoes,
  hud,
  onChangeHud,
  onRest,
  onEditRecursos
}: HudDoPersonagemProps) {
  const t = useTranslation()
  const raiz = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ x: number; y: number; moveu: boolean } | null>(null)
  const [deslocamento, setDeslocamento] = useState<{ x: number; y: number } | null>(null)
  const [novaCondicao, setNovaCondicao] = useState<string | null>(null)
  const nome = profile.name || fallbackName

  if (!hud.visivel) {
    return (
      <button
        type="button"
        className={`hud-mostrar hud-${hud.canto}`}
        onClick={() => onChangeHud({ ...hud, visivel: true })}
        title={t.hud.show}
        aria-label={t.hud.show}
      >
        {profile.photo ? <img src={profile.photo} alt="" draggable={false} /> : <span>{inicial(nome)}</span>}
      </button>
    )
  }

  function aoPressionar(e: PointerEvent<HTMLDivElement>): void {
    // Só o botão principal, e nunca a partir de um botão do cabeçalho (mini/esconder).
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    arrasto.current = { x: e.clientX, y: e.clientY, moveu: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function aoMover(e: PointerEvent<HTMLDivElement>): void {
    if (!arrasto.current) return
    const dx = e.clientX - arrasto.current.x
    const dy = e.clientY - arrasto.current.y
    if (!arrasto.current.moveu && Math.hypot(dx, dy) < ARRASTO_MINIMO_PX) return
    arrasto.current.moveu = true
    setDeslocamento({ x: dx, y: dy })
  }

  function aoSoltar(e: PointerEvent<HTMLDivElement>): void {
    if (!arrasto.current) return
    const moveu = arrasto.current.moveu
    arrasto.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDeslocamento(null)
    if (!moveu || !raiz.current?.parentElement) return
    /**
     * O canto mais perto do CENTRO do cartão onde ele foi solto, medido contra a área da cena —
     * o pai do HUD é o contêiner do canvas. Snap, e não posição livre: quatro cantos gravam num
     * campo só e nunca deixam o cartão meio fora da cena depois de redimensionar a janela.
     */
    const cena = raiz.current.parentElement.getBoundingClientRect()
    const cartao = raiz.current.getBoundingClientRect()
    const centroX = cartao.left + cartao.width / 2 - cena.left
    const centroY = cartao.top + cartao.height / 2 - cena.top
    const canto: Canto = `${centroY < cena.height / 2 ? 'n' : 's'}${centroX < cena.width / 2 ? 'w' : 'e'}` as Canto
    if (canto !== hud.canto) onChangeHud({ ...hud, canto })
  }

  function alternarCondicao(id: string): void {
    onChangeCondicoes(condicoes.map((condicao) => (condicao.id === id ? { ...condicao, ativa: !condicao.ativa } : condicao)))
  }

  function removerCondicao(id: string): void {
    onChangeCondicoes(condicoes.filter((condicao) => condicao.id !== id))
  }

  function confirmarNovaCondicao(): void {
    const nomeNovo = (novaCondicao ?? '').trim()
    setNovaCondicao(null)
    if (!nomeNovo || condicoes.length >= MAXIMO_DE_CONDICOES) return
    onChangeCondicoes([...condicoes, criarCondicao(nomeNovo)])
  }

  function aoTeclarNaCondicao(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmarNovaCondicao()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setNovaCondicao(null)
    }
  }

  return (
    <div
      ref={raiz}
      className={`hud hud-${hud.canto} ${hud.mini ? 'hud-mini' : ''} ${deslocamento ? 'hud-arrastando' : ''}`}
      style={deslocamento ? { transform: `translate(${deslocamento.x}px, ${deslocamento.y}px)` } : undefined}
      role="region"
      aria-label={t.hud.title}
    >
      <div
        className="hud-cabecalho"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        title={t.hud.dragHint}
      >
        {profile.photo ? (
          <img className="hud-retrato" src={profile.photo} alt="" draggable={false} />
        ) : (
          <span className="hud-retrato hud-retrato-vazio">{inicial(nome)}</span>
        )}
        {!hud.mini && <span className="hud-nome">{nome}</span>}
        <span className="hud-botoes">
          {/* O lápis CRIA e edita as barras (nome, máximo, cor) — é daqui que nasce a primeira. */}
          {onEditRecursos && (
            <button type="button" className="hud-botao" onClick={onEditRecursos} title={t.resources.edit} aria-label={t.resources.edit}>
              <IconeLapis tamanho={9} />
            </button>
          )}
          <button
            type="button"
            className="hud-botao"
            onClick={() => onChangeHud({ ...hud, mini: !hud.mini })}
            title={hud.mini ? t.hud.expand : t.hud.collapse}
            aria-label={hud.mini ? t.hud.expand : t.hud.collapse}
          >
            {hud.mini ? '▢' : '▁'}
          </button>
          <button
            type="button"
            className="hud-botao"
            onClick={() => onChangeHud({ ...hud, visivel: false })}
            title={t.hud.hide}
            aria-label={t.hud.hide}
          >
            ✕
          </button>
        </span>
      </div>

      {recursos.length > 0 ? (
        <BarrasDeRecurso recursos={recursos} onChange={onChangeRecursos} />
      ) : (
        !hud.mini && <p className="hud-sem-barras">{t.resources.empty}</p>
      )}

      {!hud.mini && (
        <>
          <div className="hud-condicoes">
            {condicoes.map((condicao) => (
              <button
                key={condicao.id}
                type="button"
                className={`hud-condicao ${condicao.ativa ? 'hud-condicao-ativa' : ''}`}
                onClick={() => alternarCondicao(condicao.id)}
                aria-pressed={condicao.ativa}
                aria-label={condicao.ativa ? t.hud.conditionOn.replace('{name}', condicao.nome) : t.hud.conditionOff.replace('{name}', condicao.nome)}
                title={condicao.ativa ? t.hud.conditionOn.replace('{name}', condicao.nome) : t.hud.conditionOff.replace('{name}', condicao.nome)}
              >
                {condicao.nome}
                <span
                  className="hud-condicao-remover"
                  role="button"
                  aria-label={t.hud.conditionRemove.replace('{name}', condicao.nome)}
                  title={t.hud.conditionRemove.replace('{name}', condicao.nome)}
                  onClick={(e) => {
                    e.stopPropagation()
                    removerCondicao(condicao.id)
                  }}
                >
                  ×
                </span>
              </button>
            ))}
            {novaCondicao === null ? (
              condicoes.length < MAXIMO_DE_CONDICOES && (
                <button type="button" className="hud-condicao hud-condicao-nova" onClick={() => setNovaCondicao('')} title={t.hud.conditionAdd}>
                  +
                </button>
              )
            ) : (
              <input
                className="hud-condicao-entrada"
                value={novaCondicao}
                placeholder={t.hud.conditionPlaceholder}
                aria-label={t.hud.conditionAdd}
                onChange={(e) => setNovaCondicao(e.target.value)}
                onKeyDown={aoTeclarNaCondicao}
                onBlur={confirmarNovaCondicao}
                autoFocus
              />
            )}
          </div>
          {onRest && recursos.length > 0 && (
            <button type="button" className="hud-descansar" onClick={onRest}>
              {t.rest.button}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** A inicial do nome como retrato de quem não tem foto — "?" pra personagem sem nome. */
function inicial(nome: string): string {
  const letra = nome.trim().charAt(0)
  return letra ? letra.toUpperCase() : '?'
}
