import { useEffect, useRef, useState } from 'react'
import type { RecursoVital } from '@shared/types/recursoVital'
import {
  MAXIMO_DE_DESCANSOS,
  TAMANHO_MAXIMO_DO_NOME_DO_DESCANSO,
  descansoCompleto,
  efeitoPara,
  normalizarDescansos,
  type Descanso,
  type ModoDeDescanso
} from '@shared/types/descanso'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './DescansoModal.css'

/**
 * O EDITOR dos tipos de descanso (spec §3.8: "fully user-editable"): cada tipo tem nome e, barra
 * por barra, o que acontece — volta ao máximo, soma N, nada. Trabalha numa cópia e grava no
 * Salvar, pela mesma régua do disco (`normalizarDescansos`).
 */
interface DescansoEditorModalProps {
  recursos: RecursoVital[]
  descansos: Descanso[]
  onSave: (descansos: Descanso[]) => void
  onCancel: () => void
}

/** A quantidade fica como TEXTO enquanto se edita, senão apagar pra digitar outra vira zero. */
interface LinhaEmEdicao {
  id: string
  nome: string
  efeitos: Record<string, { modo: ModoDeDescanso; quantidade: string }>
}

export function DescansoEditorModal({ recursos, descansos, onSave, onCancel }: DescansoEditorModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)
  const [linhas, setLinhas] = useState<LinhaEmEdicao[]>(() => descansos.map(paraLinha))

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancel])

  function paraLinha(descanso: Descanso): LinhaEmEdicao {
    const efeitos: LinhaEmEdicao['efeitos'] = {}
    for (const recurso of recursos) {
      const efeito = efeitoPara(descanso, recurso.id)
      efeitos[recurso.id] = { modo: efeito.modo, quantidade: String(efeito.quantidade ?? 0) }
    }
    return { id: descanso.id, nome: descanso.nome, efeitos }
  }

  function mudar(id: string, mudanca: (linha: LinhaEmEdicao) => LinhaEmEdicao): void {
    setLinhas((atuais) => atuais.map((linha) => (linha.id === id ? mudanca(linha) : linha)))
  }

  function mudarEfeito(id: string, recursoId: string, parte: Partial<{ modo: ModoDeDescanso; quantidade: string }>): void {
    mudar(id, (linha) => ({ ...linha, efeitos: { ...linha.efeitos, [recursoId]: { ...linha.efeitos[recursoId], ...parte } } }))
  }

  function acrescentar(): void {
    if (linhas.length >= MAXIMO_DE_DESCANSOS) return
    // O tipo novo nasce devolvendo tudo — é o descanso mais comum, e mudar pra "nada" é um clique.
    setLinhas((atuais) => [...atuais, paraLinha(descansoCompleto(recursos, t.rest.defaultName))])
  }

  function salvar(): void {
    onSave(
      normalizarDescansos(
        linhas.map((linha) => ({
          id: linha.id,
          nome: linha.nome,
          efeitos: Object.entries(linha.efeitos).map(([recursoId, efeito]) => ({
            recursoId,
            modo: efeito.modo,
            quantidade: Number(efeito.quantidade)
          }))
        })),
        recursos
      )
    )
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <Card ref={cardRef} className="descanso-editor" onClick={(e) => e.stopPropagation()}>
        <h2 className="descanso-modal-titulo">{t.rest.editorTitle}</h2>

        {linhas.length === 0 && <p className="descanso-editor-vazio">{t.rest.editorEmpty}</p>}

        <div className="descanso-editor-lista">
          {linhas.map((linha) => (
            <fieldset key={linha.id} className="descanso-editor-tipo">
              <legend>
                <input
                  value={linha.nome}
                  placeholder={t.rest.typeNamePlaceholder}
                  maxLength={TAMANHO_MAXIMO_DO_NOME_DO_DESCANSO}
                  aria-label={t.rest.typeName}
                  onChange={(e) => mudar(linha.id, (l) => ({ ...l, nome: e.target.value }))}
                />
                <Button
                  variant="ghost"
                  aria-label={t.rest.remove.replace('{name}', linha.nome || '?')}
                  title={t.rest.remove.replace('{name}', linha.nome || '?')}
                  onClick={() => setLinhas((atuais) => atuais.filter((l) => l.id !== linha.id))}
                >
                  ✕
                </Button>
              </legend>
              {recursos.length === 0 ? (
                <p className="descanso-editor-vazio">{t.rest.noResources}</p>
              ) : (
                recursos.map((recurso) => {
                  const efeito = linha.efeitos[recurso.id]
                  return (
                    <div key={recurso.id} className="descanso-editor-linha">
                      <span>{recurso.nome}</span>
                      <select
                        value={efeito.modo}
                        aria-label={`${linha.nome || t.rest.defaultName}: ${recurso.nome}`}
                        onChange={(e) => mudarEfeito(linha.id, recurso.id, { modo: e.target.value as ModoDeDescanso })}
                      >
                        <option value="maximo">{t.rest.modeMax}</option>
                        <option value="somar">{t.rest.modePlus}</option>
                        <option value="nada">{t.rest.modeNone}</option>
                      </select>
                      {efeito.modo === 'somar' ? (
                        <input
                          type="number"
                          min={0}
                          value={efeito.quantidade}
                          aria-label={t.rest.quantity}
                          onChange={(e) => mudarEfeito(linha.id, recurso.id, { quantidade: e.target.value })}
                        />
                      ) : (
                        <span />
                      )}
                    </div>
                  )
                })
              )}
            </fieldset>
          ))}
        </div>

        <div className="descanso-editor-rodape">
          {linhas.length >= MAXIMO_DE_DESCANSOS ? (
            <span className="descanso-editor-vazio">{t.rest.limit.replace('{max}', String(MAXIMO_DE_DESCANSOS))}</span>
          ) : (
            <Button variant="ghost" onClick={acrescentar}>
              + {t.rest.add}
            </Button>
          )}
        </div>

        <div className="descanso-editor-acoes">
          <Button variant="ghost" onClick={onCancel}>
            {t.rest.cancel}
          </Button>
          <Button variant="primary" onClick={salvar}>
            {t.rest.save}
          </Button>
        </div>
      </Card>
    </div>
  )
}
