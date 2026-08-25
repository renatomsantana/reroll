import { useEffect, useRef, useState } from 'react'
import {
  MAXIMO_DE_RECURSOS,
  TAMANHO_MAXIMO_DO_NOME_DO_RECURSO,
  TETO_DO_VALOR_DE_RECURSO,
  criarRecurso,
  normalizarRecursos,
  type RecursoVital
} from '@shared/types/recursoVital'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useModalFocusTrap } from '@renderer/hooks/useModalFocusTrap'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './RecursoEditorModal.css'

/**
 * O EDITOR das barras: nome, atual, máximo, cor; acrescentar e remover.
 *
 * É a metade "lenta" do §3.4 — sobe de nível, o PV máximo muda; a mesa começou a usar Sorte; a
 * pessoa quer PE azul. Fica num modal, e não inline, porque nada disso acontece no meio do
 * combate: o que acontece no combate é o "−", e ele está na barra.
 *
 * Trabalha numa CÓPIA e só grava no Salvar: mexer no máximo direto na ficha viva prenderia o atual
 * a cada tecla ("4" enquanto se digita "45" já cortaria o PV pra 4).
 */
interface RecursoEditorModalProps {
  recursos: RecursoVital[]
  onSave: (recursos: RecursoVital[]) => void
  onCancel: () => void
}

/** A linha em edição guarda TEXTO nos números, senão apagar o campo pra digitar outro vira zero. */
interface LinhaEmEdicao {
  id: string
  nome: string
  atual: string
  maximo: string
  cor?: string
}

export function RecursoEditorModal({ recursos, onSave, onCancel }: RecursoEditorModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)
  const [linhas, setLinhas] = useState<LinhaEmEdicao[]>(() =>
    recursos.map((recurso) => ({
      id: recurso.id,
      nome: recurso.nome,
      atual: String(recurso.atual),
      maximo: String(recurso.maximo),
      cor: recurso.cor
    }))
  )

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancel])

  function mudar(id: string, mudanca: Partial<LinhaEmEdicao>): void {
    setLinhas((atuais) => atuais.map((linha) => (linha.id === id ? { ...linha, ...mudanca } : linha)))
  }

  function acrescentar(): void {
    if (linhas.length >= MAXIMO_DE_RECURSOS) return
    const novo = criarRecurso('', 10)
    setLinhas((atuais) => [...atuais, { id: novo.id, nome: '', atual: '10', maximo: '10' }])
  }

  function remover(id: string): void {
    setLinhas((atuais) => atuais.filter((linha) => linha.id !== id))
  }

  function salvar(): void {
    /**
     * A mesma régua do disco (`normalizarRecursos`): nome vazio cai fora, número torto vira zero,
     * atual preso ao máximo. Assim o que a tela grava é exatamente o que ela leria de volta.
     */
    onSave(
      normalizarRecursos(
        linhas.map((linha) => ({
          id: linha.id,
          nome: linha.nome,
          atual: Number(linha.atual),
          maximo: Number(linha.maximo),
          cor: linha.cor
        }))
      )
    )
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <Card ref={cardRef} className="recurso-editor" onClick={(e) => e.stopPropagation()}>
        <h2 className="recurso-editor-titulo">{t.resources.editorTitle}</h2>

        <div className="recurso-editor-cabecalho" aria-hidden="true">
          <span>{t.resources.name}</span>
          <span>{t.resources.current}</span>
          <span>{t.resources.max}</span>
          <span>{t.resources.color}</span>
          <span />
        </div>

        <div className="recurso-editor-linhas">
          {linhas.map((linha) => (
            <div key={linha.id} className="recurso-editor-linha">
              <input
                value={linha.nome}
                placeholder={t.resources.namePlaceholder}
                maxLength={TAMANHO_MAXIMO_DO_NOME_DO_RECURSO}
                aria-label={t.resources.name}
                onChange={(e) => mudar(linha.id, { nome: e.target.value })}
              />
              <input
                type="number"
                min={0}
                max={TETO_DO_VALOR_DE_RECURSO}
                value={linha.atual}
                aria-label={t.resources.current}
                onChange={(e) => mudar(linha.id, { atual: e.target.value })}
              />
              <input
                type="number"
                min={0}
                max={TETO_DO_VALOR_DE_RECURSO}
                value={linha.maximo}
                aria-label={t.resources.max}
                onChange={(e) => mudar(linha.id, { maximo: e.target.value })}
              />
              <span className="recurso-editor-cor">
                <input
                  type="color"
                  value={linha.cor ?? '#008000'}
                  aria-label={t.resources.color}
                  onChange={(e) => mudar(linha.id, { cor: e.target.value })}
                />
                {linha.cor && (
                  <button
                    type="button"
                    className="recurso-editor-cor-auto"
                    title={t.resources.colorAuto}
                    aria-label={t.resources.colorAuto}
                    onClick={() => mudar(linha.id, { cor: undefined })}
                  >
                    ↺
                  </button>
                )}
              </span>
              <Button
                variant="ghost"
                className="recurso-editor-remover"
                aria-label={t.resources.remove.replace('{name}', linha.nome || '?')}
                title={t.resources.remove.replace('{name}', linha.nome || '?')}
                onClick={() => remover(linha.id)}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>

        <div className="recurso-editor-rodape">
          {linhas.length >= MAXIMO_DE_RECURSOS ? (
            <span className="recurso-editor-limite">{t.resources.limit.replace('{max}', String(MAXIMO_DE_RECURSOS))}</span>
          ) : (
            <Button variant="ghost" onClick={acrescentar}>
              + {t.resources.add}
            </Button>
          )}
        </div>

        <div className="recurso-editor-acoes">
          <Button variant="ghost" onClick={onCancel}>
            {t.resources.cancel}
          </Button>
          <Button variant="primary" onClick={salvar}>
            {t.resources.save}
          </Button>
        </div>
      </Card>
    </div>
  )
}
