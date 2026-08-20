import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createProfile,
  normalizeProfiles,
  type Profile,
  type ProfilesState
} from '@shared/types/profile'
import { trocarPerfil } from './trocaDePerfil'

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
  /**
   * Relê a lista do disco.
   *
   * Existe pra importação de ficha: quem cria o personagem lá é o PROCESSO PRINCIPAL, num passo só
   * junto das anotações e dos presets (ver `registerSheetHandlers`), então o renderer tem que buscar
   * o resultado em vez de montar uma cópia dele aqui e torcer pra bater.
   */
  reload: () => Promise<void>
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
   * Espelho do estado pra ler o valor ATUAL fora do React. Existe por causa de `trocarPara`, que
   * precisa montar o estado novo ANTES de chamar `setState` (ver lá).
   */
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Aplica a mudança e grava.
   *
   * A gravação saiu de DENTRO do `setState`, onde estava. Uma função passada ao `setState` tem que
   * ser pura — o React pode chamá-la mais de uma vez pelo mesmo resultado, e chamava: cada uma
   * disparava uma gravação. Agora o novo estado é calculado a partir do espelho e a gravação
   * acontece uma vez só, fora do render.
   */
  const update = useCallback((change: (previous: ProfilesState) => ProfilesState) => {
    const next = normalizeProfiles(change(stateRef.current))
    stateRef.current = next
    setState(next)
    window.api.profiles
      .save(next)
      .catch((error: unknown) => console.error('Falha ao salvar perfis:', error))
    return next
  }, [])

  /**
   * TROCAR DE PERSONAGEM. É o único caso em que a ORDEM importa, e ela é o contrário da intuição:
   * grava PRIMEIRO, muda a tela DEPOIS.
   *
   * Anotações e presets são lidos da pasta do perfil ativo, e quem sabe qual é o ativo é o processo
   * principal (`ProfilesRepository.activeDirectory`). Se a tela trocar antes de a gravação chegar
   * lá, os efeitos de `useNotes`/`usePresets` disparam na hora e pedem os dados do personagem NOVO
   * enquanto o principal ainda aponta pro ANTIGO — e o que volta é a ficha errada, que na primeira
   * digitação é gravada por cima da certa.
   *
   * Com o `await` antes do `setState` essa janela deixa de existir. É a mesma razão pela qual a
   * importação de ficha virou um canal único e atômico (ver `registerSheetHandlers`).
   *
   * A sequência em si mora em `trocaDePerfil.ts`, fora do React, pra poder ser testada — inclusive o
   * caso de a gravação FALHAR, em que a tela tem que ficar onde está.
   *
   * Vale pras TRÊS operações que mexem em quem está aberto — trocar, CRIAR e APAGAR. Criar um
   * personagem também muda o ativo, e era por isso que criar vinha bugado: a tela abria o
   * personagem novo enquanto o processo principal ainda apontava pro anterior, então a ficha que
   * aparecia era a do anterior — e a primeira tecla gravava aquilo por cima do novo.
   */
  const aplicarComTroca = useCallback(async (change: (previous: ProfilesState) => ProfilesState) => {
    const { estado, trocou, erro } = await trocarPerfil(stateRef.current, change, (proximo) =>
      window.api.profiles.save(proximo)
    )
    if (!trocou) console.error('Falha ao salvar perfis — o personagem aberto não mudou:', erro)
    stateRef.current = estado
    setState(estado)
    return estado
  }, [])

  const value = useMemo<ProfilesContextValue>(() => {
    const active = state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0]
    return {
      profiles: state.profiles,
      activeId: state.activeId,
      active,
      loading,
      select: (id) => {
        if (state.activeId === id) return
        void aplicarComTroca((previous) => ({ ...previous, activeId: id }))
      },
      create: () =>
        void aplicarComTroca((previous) => {
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
      reload: async () => {
        const carregado = await window.api.profiles.get()
        setState(normalizeProfiles(carregado))
      },
      remove: (id) =>
        void aplicarComTroca((previous) => {
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
  }, [state, loading, update, aplicarComTroca])

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
}

export function useProfiles(): ProfilesContextValue {
  const context = useContext(ProfilesContext)
  if (!context) throw new Error('useProfiles precisa estar dentro de <ProfilesProvider>')
  return context
}
