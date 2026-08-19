import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createProfile,
  normalizeProfiles,
  type Profile,
  type ProfilesState
} from '@shared/types/profile'

/**
 * Perfis de personagem (ver `shared/types/profile.ts`) — quem está aberto e a lista inteira.
 *
 * Fica ACIMA do `SettingsProvider` na árvore (`main.tsx`) porque é o id do perfil aberto que decide
 * quais cores carregar: cada personagem tem a própria aparência, e o `SettingsProvider` precisa
 * saber de quem são as cores antes de montar a cena.
 *
 * A lista vive no processo main (arquivo `profiles.json`), não no `localStorage`, pelo mesmo motivo
 * das anotações e dos presets: é dado do personagem, não preferência de janela — e é de lá que sai o
 * caminho das pastas de cada perfil.
 */
interface ProfilesContextValue {
  profiles: Profile[]
  activeId: string
  active: Profile
  /** `true` até a primeira leitura do disco terminar. */
  loading: boolean
  select: (id: string) => void
  /** Cria um personagem em branco e já abre. */
  create: () => void
  update: (id: string, patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => void
  remove: (id: string) => void
  /** Abre o diálogo nativo de imagem e guarda a foto escolhida no perfil. */
  pickPhoto: (id: string) => Promise<void>
}

const ProfilesContext = createContext<ProfilesContextValue | null>(null)

const ESTADO_INICIAL: ProfilesState = normalizeProfiles(null)

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfilesState>(ESTADO_INICIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.profiles
      .get()
      .then((loaded) => setState(normalizeProfiles(loaded)))
      .catch((error: unknown) => console.error('Falha ao carregar perfis:', error))
      .finally(() => setLoading(false))
  }, [])

  /**
   * Aplica a mudança e grava. Recebe função pra sempre partir do estado ATUAL, não do que a tela viu
   * — mesmo padrão de `useNotes`, e pelo mesmo motivo: as edições vêm de campos que disparam a cada
   * tecla.
   */
  const update = useCallback((change: (previous: ProfilesState) => ProfilesState) => {
    setState((previous) => {
      const next = normalizeProfiles(change(previous))
      window.api.profiles
        .save(next)
        .catch((error: unknown) => console.error('Falha ao salvar perfis:', error))
      return next
    })
  }, [])

  const value = useMemo<ProfilesContextValue>(() => {
    const active = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0]
    return {
      profiles: state.profiles,
      activeId: state.activeId,
      active,
      loading,
      select: (id) => update((previous) => ({ ...previous, activeId: id })),
      create: () =>
        update((previous) => {
          const novo = createProfile()
          return { profiles: [...previous.profiles, novo], activeId: novo.id }
        }),
      update: (id, patch) =>
        update((previous) => ({
          ...previous,
          profiles: previous.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p))
        })),
      /**
       * Apagar NÃO remove a pasta do personagem em disco — as anotações e os presets dele continuam
       * lá. É de propósito: apagar um personagem por engano é irreversível de outra forma, e um
       * `profiles.json` editado de volta traz tudo. O que some é a entrada na lista.
       */
      remove: (id) =>
        update((previous) => {
          const restantes = previous.profiles.filter((p) => p.id !== id)
          if (restantes.length === 0) return previous
          return {
            profiles: restantes,
            activeId: previous.activeId === id ? restantes[0].id : previous.activeId
          }
        }),
      pickPhoto: async (id) => {
        const photo = await window.api.profiles.pickPhoto()
        if (!photo) return
        update((previous) => ({
          ...previous,
          profiles: previous.profiles.map((p) => (p.id === id ? { ...p, photo } : p))
        }))
      }
    }
  }, [state, loading, update])

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
}

export function useProfiles(): ProfilesContextValue {
  const context = useContext(ProfilesContext)
  if (!context) throw new Error('useProfiles precisa estar dentro de <ProfilesProvider>')
  return context
}
