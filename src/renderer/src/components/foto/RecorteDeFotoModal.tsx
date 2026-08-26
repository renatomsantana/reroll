import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import {
  LADO_DO_QUADRO,
  ZOOM_MAXIMO,
  escalaMinima,
  gravarRecorte,
  limitar,
  recorteInicial,
  transformDaPrevia,
  type Recorte,
  type TamanhoDaImagem
} from './recorteDeFoto'
import './RecorteDeFotoModal.css'

/**
 * O RECORTE da foto (zoom no rosto): um quadro de 256px, a imagem por baixo, arrastar pra
 * posicionar, roda do mouse ou o controle pra dar zoom, e "Usar" grava o quadrado. Ver a geometria
 * em `recorteDeFoto.ts`.
 *
 * O arrasto ouve a JANELA (como o HUD): o mouse sai do quadro em todo gesto rápido.
 */
interface RecorteDeFotoModalProps {
  imagem: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export function RecorteDeFotoModal({ imagem, onConfirm, onCancel }: RecorteDeFotoModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  useModalFocusTrap(cardRef)
  const [tamanho, setTamanho] = useState<TamanhoDaImagem | null>(null)
  const [recorte, setRecorte] = useState<Recorte>({ escala: 1, x: 0, y: 0 })
  const arrasto = useRef<{ x: number; y: number; origem: Recorte } | null>(null)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancel])

  function aoCarregar(): void {
    const img = imgRef.current
    if (!img) return
    const medida = { largura: img.naturalWidth, altura: img.naturalHeight }
    setTamanho(medida)
    setRecorte(recorteInicial(medida))
  }

  function aoPressionar(e: PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0 || !tamanho) return
    e.preventDefault()
    const origem = recorte
    arrasto.current = { x: e.clientX, y: e.clientY, origem }
    const mover = (ev: globalThis.PointerEvent): void => {
      if (!arrasto.current || !tamanho) return
      setRecorte(limitar({ ...arrasto.current.origem, x: arrasto.current.origem.x + ev.clientX - arrasto.current.x, y: arrasto.current.origem.y + ev.clientY - arrasto.current.y }, tamanho))
    }
    const soltar = (): void => {
      arrasto.current = null
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
  }

  function aoRodar(e: WheelEvent<HTMLDivElement>): void {
    if (!tamanho) return
    e.preventDefault()
    const fator = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setRecorte((atual) => limitar({ ...atual, escala: atual.escala * fator }, tamanho))
  }

  function confirmar(): void {
    const img = imgRef.current
    if (!img || !tamanho) return
    const dataUrl = gravarRecorte(img, recorte)
    if (dataUrl) onConfirm(dataUrl)
  }

  const minima = tamanho ? escalaMinima(tamanho) : 1
  /** O controle de zoom vai de 1× (cobrir) a `ZOOM_MAXIMO`×, em relação à escala mínima. */
  const zoom = tamanho ? recorte.escala / minima : 1

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <Card ref={cardRef} className="recorte-foto" onClick={(e) => e.stopPropagation()}>
        <h2 className="recorte-foto-titulo">{t.photoCrop.title}</h2>
        <p className="recorte-foto-dica">{t.photoCrop.hint}</p>

        <div
          className="recorte-foto-quadro"
          style={{ width: LADO_DO_QUADRO, height: LADO_DO_QUADRO }}
          onPointerDown={aoPressionar}
          onWheel={aoRodar}
          role="img"
          aria-label={t.photoCrop.frame}
        >
          <img
            ref={imgRef}
            src={imagem}
            alt=""
            draggable={false}
            onLoad={aoCarregar}
            style={{ transform: transformDaPrevia(recorte), visibility: tamanho ? 'visible' : 'hidden' }}
          />
        </div>

        <label className="recorte-foto-zoom">
          <span>{t.photoCrop.zoom}</span>
          <input
            type="range"
            min={1}
            max={ZOOM_MAXIMO}
            step={0.01}
            value={zoom}
            disabled={!tamanho}
            onChange={(e) => tamanho && setRecorte((atual) => limitar({ ...atual, escala: Number(e.target.value) * minima }, tamanho))}
          />
          <Button variant="ghost" onClick={() => tamanho && setRecorte(recorteInicial(tamanho))} disabled={!tamanho}>
            {t.photoCrop.reset}
          </Button>
        </label>

        <div className="recorte-foto-acoes">
          <Button variant="ghost" onClick={onCancel}>
            {t.photoCrop.cancel}
          </Button>
          <Button variant="primary" onClick={confirmar} disabled={!tamanho}>
            {t.photoCrop.use}
          </Button>
        </div>
      </Card>
    </div>
  )
}
