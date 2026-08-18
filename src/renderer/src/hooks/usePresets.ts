import { useCallback, useEffect, useState } from 'react'
import type { Preset, PresetInput } from '@shared/types/preset'

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.presets
      .getAll()
      .then(setPresets)
      .finally(() => setLoading(false))
  }, [])

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

  return { presets, loading, createPreset, updatePreset, deletePreset, exportPresets, importPresets }
}
