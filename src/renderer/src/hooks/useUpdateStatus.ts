import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types/update'

/**
 * Estado da atualização, para quem só precisa saber se existe versão nova — a barra de status e o
 * botão de Preferências (ver `App.tsx`).
 *
 * Existe porque o aviso morava SÓ dentro das Preferências: quem nunca abrisse a engrenagem nunca
 * ficaria sabendo que havia versão nova esperando, e o app "não atualizava" na prática mesmo com
 * tudo funcionando por baixo.
 */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    // O main pode ter checado antes desta tela montar — sem ler o estado atual, um app já aberto
    // há tempos mostraria "nada aconteceu".
    void window.api.update.getStatus().then(setStatus)
    return window.api.update.onStatus(setStatus)
  }, [])

  return status
}
