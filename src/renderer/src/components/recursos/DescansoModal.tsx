import { useEffect, useRef, useState } from 'react'
import type { RecursoVital } from '@shared/types/recursoVital'
import { aplicarDescanso, descansoCompleto, type Descanso } from '@shared/types/descanso'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './DescansoModal.css'

/**
 * A CONFIRMAÇÃO do descanso (spec §3.8): "Descanso longo: PV 12→27, PE 4→12?" — um clique pra
 * confirmar, nunca silencioso. Com mais de um tipo, o tipo se escolhe aqui em cima; o resumo
 * embaixo muda junto. Sem nenhum tipo configurado, oferece o descanso completo (tudo ao máximo).
 *
 * O "Editar tipos…" mora aqui, e não num botão à parte na tela de rolagem: é olhando o que o
 * descanso vai fazer que a pessoa descobre que a regra está errada.
 */
interface DescansoModalProps {
  recursos: RecursoVital[]
  descansos: Descanso[]
  onConfirm: (descanso: Descanso) => void
  onEdit: () => void
  onCancel: () => void
}

export function DescansoModal({ recursos, descansos, onConfirm, onEdit, onCancel }: DescansoModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)
  /** O tipo oferecido: os do personagem, ou o completo — id fixo pra `key` e `value` do select. */
  const opcoes = descansos.length > 0 ? descansos : [descansoCompleto(recursos, t.rest.defaultName, 'completo')]
  const [escolhidoId, setEscolhidoId] = useState(opcoes[0].id)
  const escolhido = opcoes.find((descanso) => descanso.id === escolhidoId) ?? opcoes[0]
  const { mudancas } = aplicarDescanso(recursos, escolhido)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <Card ref={cardRef} className="descanso-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="descanso-modal-titulo">{t.rest.title}</h2>

        {opcoes.length > 1 ? (
          <label className="descanso-modal-tipo">
            <span>{t.rest.type}</span>
            <select value={escolhidoId} onChange={(e) => setEscolhidoId(e.target.value)}>
              {opcoes.map((descanso) => (
                <option key={descanso.id} value={descanso.id}>
                  {descanso.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="descanso-modal-tipo-unico">{escolhido.nome}</p>
        )}

        {mudancas.length === 0 ? (
          <p className="descanso-modal-vazio">{t.rest.noChange}</p>
        ) : (
          <ul className="descanso-modal-lista">
            {mudancas.map((mudanca) => (
              <li key={mudanca.nome}>
                <span className="descanso-modal-nome">{mudanca.nome}</span>
                <span className="descanso-modal-delta">
                  {mudanca.de} → <strong>{mudanca.para}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="descanso-modal-acoes">
          <Button variant="ghost" onClick={onEdit}>
            {t.rest.editTypes}
          </Button>
          <span className="descanso-modal-espaco" />
          <Button variant="ghost" onClick={onCancel}>
            {t.rest.cancel}
          </Button>
          <Button variant="primary" onClick={() => onConfirm(escolhido)}>
            {t.rest.confirm}
          </Button>
        </div>
      </Card>
    </div>
  )
}
