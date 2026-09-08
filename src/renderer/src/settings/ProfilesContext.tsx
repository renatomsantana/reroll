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
 * Perfis de personagem (ver `shared/types/profile.ts`): quem está aberto e a lista inteira.
 *
 * Fica ACIMA do `SettingsProvider` na árvore porque é o id do perfil aberto que decide quais cores
 * carregar. A lista vive no processo main (`profiles.json`), e não no `localStorage`, pelo mesmo
 * motivo das anotações e dos presets: é dado do personagem, não preferência de janela — e é de lá que
 * sai o caminho das pastas de cada perfil.
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
   * Relê a lista do disco. Existe pra importação de ficha: quem cria o personagem lá é o PROCESSO
   * PRINCIPAL, num passo só junto das anotações e dos presets, então o renderer tem que buscar o
   * resultado em vez de montar uma cópia dele aqui e torcer pra bater.
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
   * `ESTADO_INICIAL` é uma lista INVENTADA, um personagem em branco feito aqui mesmo pra a tela ter o
   * que desenhar no primeiro quadro, e nada impedia que ela fosse GRAVADA: qualquer `update` antes de
   * a leitura voltar mandava esse personagem fictício pro `profiles.json`, por cima da lista real.
   *
   * A janela é curta e mesmo assim foi atingida: a máquina dele terminou com QUATORZE pastas de
   * personagem em `%APPDATA%/reroll/profiles/` e o `profiles.json` listando UMA. Treze personagens com
   * anotações e presets continuavam no disco, inteiros, sem aparecer em lugar nenhum do app — e da
   * tela isso lê como "as anotações não estão funcionando".
   *
   * Dois caminhos chegavam lá, e a guarda fecha os dois: a leitura FALHAR (o `catch` registrava no
   * console e a vida seguia com a lista inventada) e a leitura DEMORAR, porque basta uma escrita no
   * intervalo — e existe uma automática, a aba Ficha copiando o nome das anotações pro perfil, que no
   * primeiro quadro bate justamente porque as anotações vêm do processo principal.
   *
   * É a mesma guarda que `useNotes` já tinha, e aqui era pior: `profiles.json` é o índice, então
   * perdê-lo não perde um personagem, perde todos.
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
         * Continua PROIBIDO gravar. É o contrário do instinto — parece que o app "não funciona" —,
         * mas o app funcionando por cima de uma lista inventada é o que apagava tudo. Sem poder
         * gravar, o pior caso é uma sessão perdida; com a gravação liberada, o pior caso são todos
         * os personagens.
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
   * Aplica a mudança e grava. A gravação saiu de DENTRO do `setState`, onde estava: uma função passada
   * ao `setState` tem que ser pura, porque o React pode chamá-la mais de uma vez pelo mesmo resultado
   * — e chamava, cada uma disparando uma gravação. Agora o estado novo sai do espelho e a gravação
   * acontece uma vez só, fora do render.
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
   * TROCAR DE PERSONAGEM. É o único caso em que a ORDEM importa, e ela é o contrário da intuição:
   * grava PRIMEIRO, muda a tela DEPOIS.
   *
   * Anotações e presets são lidos da pasta do perfil ativo, e quem sabe qual é o ativo é o processo
   * principal. Se a tela trocar antes de a gravação chegar lá, os efeitos de `useNotes`/`usePresets`
   * disparam na hora e pedem os dados do personagem NOVO enquanto o principal ainda aponta pro
   * ANTIGO — e o que volta é a ficha errada, que na primeira digitação é gravada por cima da certa.
   * Com o `await` antes do `setState` essa janela deixa de existir.
   *
   * A sequência mora em `trocaDePerfil.ts`, fora do React, pra poder ser testada, inclusive o caso de
   * a gravação FALHAR. Vale pras TRÊS operações que mexem em quem está aberto — trocar, CRIAR e
   * APAGAR: criar também muda o ativo, e era por isso que criar vinha bugado.
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
         * O teto (ver `MAX_PROFILES`). A guarda fica aqui, e não só no botão desabilitado da tela:
         * o botão é o aviso, esta linha é a regra — e é ela que continua valendo pra qualquer outro
         * caminho que chame `create` amanhã.
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
      /**
       * Apagar tira o personagem da lista; a pasta dele em disco vai pra
       * `backups/personagens-apagados/` (quem move é `ProfilesRepository.save`, ao ver o id sumir,
       * ver `backupsDeDados.ts`). Apagar por engano continua recuperável: é copiar a pasta de volta.
       */
      reload: async () => {
        const carregado = await window.api.profiles.get()
        setState(normalizeProfiles(carregado))
        // Releu do disco: a partir daqui a lista é de verdade e pode ser gravada. Vale também como
        // segunda chance quando a leitura da abertura falhou (ver `veioDoDiscoRef`).
        veioDoDiscoRef.current = true
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
