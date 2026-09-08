import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createProfile,
  MAX_PROFILES,
  normalizeProfiles,
  type Profile,
  type ProfilesState
} from '@shared/types/profile'
import { trocarPerfil } from './trocaDePerfil'

/**
 * Perfis de personagem (ver `shared/types/profile.ts`): quem está aberto e a lista inteira. Fica
 * ACIMA do `SettingsProvider` na árvore porque é o id do perfil aberto que decide quais cores
 * carregar. A lista vive no processo main (`profiles.json`) e não no `localStorage`, pelo mesmo
 * motivo das anotações: é dado do personagem, e é dela que sai o caminho das pastas.
 */
interface ProfilesContextValue {
  profiles: Profile[]
  activeId: string
  active: Profile
  /** `true` até a primeira leitura do disco terminar. */
  loading: boolean
  select: (id: string) => void
  /** Cria um personagem em branco e já abre. Não faz nada quando o teto já foi alcançado. */
  create: () => void
  /** `false` quando a lista já tem `MAX_PROFILES` — ver o comentário daquela constante. */
  podeCriar: boolean
  update: (id: string, patch: Partial<Omit<Profile, 'id' | 'createdAt'>>) => void
  remove: (id: string) => void
  /** Abre o diálogo nativo de imagem e guarda a foto escolhida no perfil. */
  pickPhoto: (id: string) => Promise<void>
  /**
   * Relê a lista do disco, pra importação de ficha: quem cria o personagem lá é o PROCESSO PRINCIPAL,
   * num passo só junto das anotações e dos presets.
   */
  reload: () => Promise<void>
}

const ProfilesContext = createContext<ProfilesContextValue | null>(null)

const ESTADO_INICIAL: ProfilesState = normalizeProfiles(null)

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfilesState>(ESTADO_INICIAL)
  const [loading, setLoading] = useState(true)
  /**
   * A LISTA VEIO DO DISCO? Enquanto não tiver vindo, gravar é APAGAR — e este é o conserto do defeito
   * mais caro que este app já teve.
   *
   * `ESTADO_INICIAL` é uma lista INVENTADA, um personagem em branco feito aqui pra tela ter o que
   * desenhar no primeiro quadro, e nada impedia que ela fosse GRAVADA por cima da lista real. A
   * janela é curta e mesmo assim foi atingida: a máquina dele terminou com QUATORZE pastas de
   * personagem em `profiles/` e o `profiles.json` listando UMA.
   *
   * Dois caminhos chegavam lá, e a guarda fecha os dois: a leitura FALHAR (o `catch` só registrava no
   * console) e a leitura DEMORAR, porque basta uma escrita no intervalo — e existe uma automática, a
   * aba Ficha copiando o nome das anotações pro perfil. Aqui é pior que em `useNotes`: `profiles.json`
   * é o índice, então perdê-lo não perde um personagem, perde todos.
   */
  const veioDoDiscoRef = useRef(false)

  useEffect(() => {
    window.api.profiles
      .get()
      .then((loaded) => {
        setState(normalizeProfiles(loaded))
        veioDoDiscoRef.current = true
      })
      .catch((error: unknown) => {
        /**
         * Continua PROIBIDO gravar. É o contrário do instinto, mas o app funcionando por cima de uma
         * lista inventada é o que apagava tudo: sem gravar, o pior caso é uma sessão perdida.
         */
        console.error('Falha ao carregar perfis — a lista fica somente leitura nesta sessão:', error)
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Espelho do estado pra ler o valor ATUAL fora do React. Existe por causa de `trocarPara`, que
   * precisa montar o estado novo ANTES de chamar `setState` (ver lá).
   */
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Aplica a mudança e grava. A gravação saiu de DENTRO do `setState`: a função passada ao `setState`
   * tem que ser pura, porque o React pode chamá-la mais de uma vez pelo mesmo resultado — e chamava,
   * cada uma disparando uma gravação.
   */
  const update = useCallback((change: (previous: ProfilesState) => ProfilesState) => {
    // A lista ainda não é a de verdade: ver `veioDoDiscoRef`. Melhor perder a edição que a lista.
    if (!veioDoDiscoRef.current) {
      console.warn('Edição de perfil descartada: a lista ainda não foi lida do disco.')
      return stateRef.current
    }
    const next = normalizeProfiles(change(stateRef.current))
    stateRef.current = next
    setState(next)
    window.api.profiles
      .save(next)
      .catch((error: unknown) => console.error('Falha ao salvar perfis:', error))
    return next
  }, [])

  /**
   * TROCAR DE PERSONAGEM, o único caso em que a ORDEM importa, e ela é o contrário da intuição: grava
   * PRIMEIRO, muda a tela DEPOIS. Anotações e presets são lidos da pasta do perfil ativo, e quem sabe
   * qual é o ativo é o processo principal — se a tela trocar antes, os efeitos de `useNotes` pedem os
   * dados do personagem NOVO enquanto o principal ainda aponta pro ANTIGO, e a ficha errada volta e é
   * gravada por cima da certa na primeira digitação.
   *
   * A sequência mora em `trocaDePerfil.ts`, fora do React, pra ser testada inclusive quando a gravação
   * FALHA. Vale pras TRÊS operações que mexem em quem está aberto: trocar, CRIAR e APAGAR.
   */
  const aplicarComTroca = useCallback(async (change: (previous: ProfilesState) => ProfilesState) => {
    // Mesma guarda do `update`, e aqui ela é ainda mais importante: trocar/criar/apagar reescreve a
    // lista INTEIRA, então fazer isso sobre a lista inventada apagaria todos os personagens de uma vez.
    if (!veioDoDiscoRef.current) {
      console.warn('Troca de personagem descartada: a lista ainda não foi lida do disco.')
      return stateRef.current
    }
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
      create: () => {
        /**
         * O teto (ver `MAX_PROFILES`). A guarda fica aqui, e não só no botão desabilitado: o botão é
         * o aviso, esta linha é a regra, e vale pra qualquer outro caminho que chame `create`.
         */
        if (state.profiles.length >= MAX_PROFILES) {
          console.warn(`Limite de ${MAX_PROFILES} personagens atingido.`)
          return
        }
        void aplicarComTroca((previous) => {
          const novo = createProfile()
          return { profiles: [...previous.profiles, novo], activeId: novo.id }
        })
      },
      /** Ainda cabe personagem novo? A tela usa pra desabilitar o botão e explicar por quê. */
      podeCriar: state.profiles.length < MAX_PROFILES,
      update: (id, patch) =>
        update((previous) => ({
          ...previous,
          profiles: previous.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p))
        })),
      reload: async () => {
        const carregado = await window.api.profiles.get()
        setState(normalizeProfiles(carregado))
        // Releu do disco: a partir daqui a lista é de verdade e pode ser gravada. Vale também como
        // segunda chance quando a leitura da abertura falhou (ver `veioDoDiscoRef`).
        veioDoDiscoRef.current = true
      },
      /**
       * Apagar tira o personagem da lista; a pasta dele vai pra `backups/personagens-apagados/` (quem
       * move é `ProfilesRepository.save`, ao ver o id sumir). Apagar por engano continua recuperável.
       */
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
