import { useCallback, useState } from 'react'
import { useProfiles } from '../settings/ProfilesContext'
import { useSettings } from '../settings/SettingsContext'
import { useNotes } from '../hooks/useNotes'
import { useTranslation } from '../i18n/useTranslation'
import { useDialogo } from '../components/common/Dialogo'

/**
 * Os dois botões do pacote de personagem na aba Ficha (ver `pacoteDePersonagem.ts`).
 *
 * A ordem da importação é a parte que importa: a aparência vai pro `localStorage` do personagem
 * novo ANTES de `reload()` trocar pra ele — é a troca que lê a chave (ver `gravarAparenciaDe`).
 * Depois, as anotações são relidas explicitamente pelo mesmo motivo de `useSheetImport`: quem
 * gravou foi o processo principal, e o renderer tem que buscar o resultado.
 */
export function usePacoteDePersonagem() {
  const [ocupado, setOcupado] = useState(false)
  const t = useTranslation()
  const dialogo = useDialogo()
  const { language, aparenciaAtual, gravarAparenciaDe } = useSettings()
  const { reload } = useProfiles()
  const { recarregar } = useNotes()

  const exportar = useCallback(async () => {
    setOcupado(true)
    try {
      const caminho = await window.api.pacote.exportar({ aparencia: aparenciaAtual(), idioma: language })
      if (caminho) await dialogo.avisar(t.notesTab.profileExportSuccess.replace('{path}', caminho))
    } catch (causa) {
      console.error('Falha ao exportar o personagem:', causa)
      await dialogo.avisar(t.notesTab.profileExportError.replace('{error}', (causa as Error).message))
    } finally {
      setOcupado(false)
    }
  }, [aparenciaAtual, language, dialogo, t])

  const importar = useCallback(async () => {
    setOcupado(true)
    try {
      const resultado = await window.api.pacote.importar()
      if (!resultado) return
      if (resultado.aparencia) gravarAparenciaDe(resultado.perfil.id, resultado.aparencia)
      await reload()
      recarregar()
      const nome = resultado.perfil.name || t.notesTab.profileUnnamed.replace('{n}', '?')
      await dialogo.avisar(t.notesTab.profileImportSuccess.replace('{name}', nome))
    } catch (causa) {
      console.error('Falha ao importar o personagem:', causa)
      await dialogo.avisar(t.notesTab.profileImportError.replace('{error}', (causa as Error).message))
    } finally {
      setOcupado(false)
    }
  }, [gravarAparenciaDe, reload, recarregar, dialogo, t])

  return { ocupado, exportar, importar }
}
