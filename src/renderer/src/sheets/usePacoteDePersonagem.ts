import { useCallback, useState } from 'react'
import { useProfiles } from '../settings/ProfilesContext'
import { useSettings } from '../settings/SettingsContext'
import { useNotes } from '../hooks/useNotes'
import { EVENTO_PRESETS_MUDARAM } from '../hooks/usePresets'
import { useTranslation } from '../i18n/useTranslation'
import { useDialogo } from '../components/common/Dialogo'

/**
 * Os dois botões do pacote de personagem na aba Ficha (ver `pacoteDePersonagem.ts`).
 *
 * A importação tem dois desfechos, e a aparência entra por caminhos diferentes em cada um:
 *
 * - o arquivo ATUALIZOU o personagem que já está aberto: o `activeId` não muda, então nada
 *   recarrega sozinho. A aparência é aplicada direto nas preferências (`aplicarAparencia`), as
 *   anotações são relidas, e os presets — que moram no `App` — são avisados por evento;
 * - criou um novo, ou atualizou um que não estava aberto: a aparência vai pro `localStorage` dele
 *   ANTES de `reload()` trocar pra ele, porque é a troca que lê a chave (ver `gravarAparenciaDe`).
 */
export function usePacoteDePersonagem() {
  const [ocupado, setOcupado] = useState(false)
  const t = useTranslation()
  const dialogo = useDialogo()
  const { language, aparenciaAtual, gravarAparenciaDe, aplicarAparencia } = useSettings()
  const { activeId, reload } = useProfiles()
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
      const mesmoAberto = resultado.perfil.id === activeId
      if (resultado.aparencia) {
        if (mesmoAberto) aplicarAparencia(resultado.aparencia)
        else gravarAparenciaDe(resultado.perfil.id, resultado.aparencia)
      }
      await reload()
      recarregar()
      if (mesmoAberto) window.dispatchEvent(new Event(EVENTO_PRESETS_MUDARAM))
      const nome = resultado.perfil.name || t.notesTab.profileUnnamed.replace('{n}', '?')
      const aviso = resultado.substituiu ? t.notesTab.profileImportReplaced : t.notesTab.profileImportSuccess
      await dialogo.avisar(aviso.replace('{name}', nome))
    } catch (causa) {
      console.error('Falha ao importar o personagem:', causa)
      await dialogo.avisar(t.notesTab.profileImportError.replace('{error}', (causa as Error).message))
    } finally {
      setOcupado(false)
    }
  }, [activeId, aplicarAparencia, gravarAparenciaDe, reload, recarregar, dialogo, t])

  return { ocupado, exportar, importar }
}
