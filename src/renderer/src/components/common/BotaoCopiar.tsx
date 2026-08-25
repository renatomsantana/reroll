import { useEffect, useRef, useState } from 'react'
import type { RotulosDoChat } from '@shared/dice/linhaParaChat'
import { useTranslation } from '@renderer/i18n/useTranslation'
import type { TranslationDict } from '@renderer/i18n/translations'
import './BotaoCopiar.css'

/**
 * O botão de COPIAR PRO CHAT (spec §3.5), com o "Copiado!" de confirmação por um instante.
 *
 * Recebe o texto como FUNÇÃO, e não pronto: ele mora na linha de resultado e em cada entrada do
 * histórico, e montar a linha do chat de cada uma delas a cada render seria trabalho jogado fora
 * — a linha só existe quando alguém clica.
 *
 * A confirmação é visual e curta (1,5 s) porque copiar não tem outro sinal: nada muda na tela, e
 * sem o "Copiado!" a pessoa clica de novo sem saber se pegou.
 */
interface BotaoCopiarProps {
  texto: () => string
  /** A versão miúda do modo compacto e do histórico. */
  pequeno?: boolean
  className?: string
}

const DURACAO_DO_COPIADO_MS = 1500

export function BotaoCopiar({ texto, pequeno = false, className }: BotaoCopiarProps) {
  const t = useTranslation()
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  async function copiar(): Promise<void> {
    try {
      const ok = await window.api.clipboard.writeText(texto())
      if (!ok) return
      setCopiado(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiado(false), DURACAO_DO_COPIADO_MS)
    } catch (causa) {
      // A área de transferência é do sistema e pode falhar (outro programa segurando-a). Não é
      // motivo pra derrubar a tela — fica no console, e o botão continua ali pra tentar de novo.
      console.error('Falha ao copiar a rolagem:', causa)
    }
  }

  return (
    <button
      type="button"
      className={`botao-copiar ${pequeno ? 'botao-copiar-pequeno' : ''} ${copiado ? 'botao-copiar-copiado' : ''} ${className ?? ''}`}
      title={t.roller.copy}
      aria-label={copiado ? t.roller.copied : t.roller.copy}
      onClick={() => void copiar()}
    >
      {copiado ? (
        <span className="botao-copiar-texto">{t.roller.copied}</span>
      ) : (
        <IconeCopiar tamanho={pequeno ? 11 : 13} />
      )}
    </button>
  )
}

/** Os rótulos que a linha do chat precisa, tirados do dicionário — ver `linhaParaChat.ts`. */
export function rotulosDoChat(t: TranslationDict): RotulosDoChat {
  return {
    advantage: t.roller.copyAdvantage,
    disadvantage: t.roller.copyDisadvantage,
    success: t.roller.success,
    failure: t.roller.failure
  }
}

/** Duas folhas sobrepostas — o ícone de copiar, em traço de 1px como os outros ícones do app. */
function IconeCopiar({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" />
      <path d="M8.5 4.5V1.5H1.5v7h3" />
    </svg>
  )
}
