import { useCallback, useEffect, useState } from 'react'
import type { Preset, PresetInput } from '@shared/types/preset'
import { useProfiles } from '@renderer/settings/ProfilesContext'

/** Disparado na `window` por quem reescreveu os presets do personagem aberto fora deste hook. */
export const EVENTO_PRESETS_MUDARAM = 'reroll:presets-mudaram'

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const { activeId } = useProfiles()
  /**
   * Um contador que força a releitura SEM trocar de personagem. Existe pela importação de pacote
   * (ver `usePacoteDePersonagem`): quando o arquivo ATUALIZA o personagem que já está aberto, os
   * presets no disco mudaram e o `activeId` não — e este hook mora no `App`, longe de quem importou.
   * O aviso chega por um evento da janela, que é o único canal que os dois têm em comum.
   */
  const [releitura, setReleitura] = useState(0)
  useEffect(() => {
    const ouvir = (): void => setReleitura((n) => n + 1)
    window.addEventListener(EVENTO_PRESETS_MUDARAM, ouvir)
    return () => window.removeEventListener(EVENTO_PRESETS_MUDARAM, ouvir)
  }, [])

  /**
   * Recarrega quando o PERSONAGEM muda (ou quando alguém pediu a releitura acima): anotações e presets moram na pasta do perfil aberto (ver
   * `ProfilesRepository.activeDirectory`), então trocar de perfil sem reler deixaria a tela mostrando
   * a ficha do personagem anterior — e, pior, a primeira digitação gravaria esse conteúdo velho por
   * cima do arquivo do novo.
   */
  useEffect(() => {
    // Mesma trava do `useNotes`: leitura que chega depois de já ter trocado de personagem é
    // descartada, senão a lista de presets do anterior fica na tela como se fosse a do atual.
    let atual = true
    setLoading(true)
    void window.api.presets
      .getAll()
      .then((carregados) => {
        if (atual) setPresets(carregados)
      })
      /**
       * Falha de LEITURA vira lista vazia e uma linha no console, e não uma rejeição sem dono.
       * Sem o `catch`, `presets.json` ilegível deixava o app preso em "carregando" pra sempre — o
       * `finally` até rodava, mas a promessa rejeitada não tinha quem a tratasse.
       */
      .catch((causa: unknown) => {
        console.error('Falha ao ler os presets do personagem:', causa)
        if (atual) setPresets([])
      })
      .finally(() => {
        if (atual) setLoading(false)
      })
    return () => {
      atual = false
    }
  }, [activeId, releitura])

  const createPreset = useCallback(async (input: PresetInput) => {
    const preset = await window.api.presets.create(input)
    setPresets((prev) => [...prev, preset])
    return preset
  }, [])

  const updatePreset = useCallback(async (id: string, input: PresetInput) => {
    const updated = await window.api.presets.update(id, input)
    setPresets((prev) => prev.map((p) => (p.id === id ? updated : p)))
    return updated
  }, [])

  const deletePreset = useCallback(async (id: string) => {
    await window.api.presets.delete(id)
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }, [])

  /**
   * A estrela (spec §3.9). O processo principal devolve a lista INTEIRA reindexada, e é ela que
   * entra — mexer só no preset clicado deixaria as posições dos outros desatualizadas na tela.
   */
  const setFavorite = useCallback(async (id: string, favorito: boolean) => {
    setPresets(await window.api.presets.setFavorite(id, favorito))
  }, [])

  const moveFavorite = useCallback(async (id: string, direcao: -1 | 1) => {
    setPresets(await window.api.presets.moveFavorite(id, direcao))
  }, [])

  /** Retorna o caminho do arquivo salvo, ou null se o usuário cancelou o diálogo. */
  const exportPresets = useCallback((): Promise<string | null> => {
    return window.api.presets.exportToFile()
  }, [])

  /**
   * Retorna null se o usuário cancelou o diálogo; senão importa, atualiza a
   * lista e informa quantos presets novos entraram (a resposta da API traz
   * a lista completa, não só os importados).
   */
  const importPresets = useCallback(
    async (): Promise<{ importedCount: number } | null> => {
      const updated = await window.api.presets.importFromFile()
      if (!updated) return null
      const importedCount = updated.length - presets.length
      setPresets(updated)
      return { importedCount }
    },
    [presets]
  )

  return { presets, loading, createPreset, updatePreset, deletePreset, exportPresets, importPresets, setFavorite, moveFavorite }
}
