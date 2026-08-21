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
  /** Cria um personagem em branco e já abre. Não faz nada quando o teto já foi alcançado. */
  create: () => void
  /** `false` quando a lista já tem `MAX_PROFILES` — ver o comentário daquela constante. */
  podeCriar: boolean
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
  /**
   * A LISTA VEIO DO DISCO? Enquanto não tiver vindo, gravar é APAGAR.
   *
   * Este é o conserto do defeito mais caro que este app já teve, e ele merece o parágrafo inteiro.
   *
   * `ESTADO_INICIAL` é uma lista INVENTADA — um personagem em branco, feito aqui mesmo, pra a tela
   * ter o que desenhar no primeiro quadro. Ela não veio de lugar nenhum. E nada impedia que ela
   * fosse GRAVADA: qualquer chamada a `update` ou `aplicarComTroca` antes de a leitura voltar
   * mandava esse personagem fictício pro `profiles.json`, por cima da lista de verdade.
   *
   * A janela é curta, e mesmo assim foi atingida: a máquina do usuário terminou com QUATORZE pastas
   * de personagem em `%APPDATA%/reroll/profiles/` e o `profiles.json` listando UMA. Treze
   * personagens com anotações e presets continuavam no disco, inteiros, e simplesmente não
   * apareciam mais em lugar nenhum do app. Da tela isso lê como "as anotações não estão
   * funcionando" — o que a pessoa escreveu ontem sumiu, e o que ela escreve hoje some amanhã.
   *
   * Dois caminhos chegavam lá, e a guarda fecha os dois:
   *
   * 1. A leitura FALHA. O `catch` registrava no console e a vida seguia com a lista inventada, que
   *    a primeira edição gravava por cima da real.
   * 2. A leitura DEMORA. Basta uma escrita nesse intervalo — e existe uma automática: a aba Ficha
   *    copia o nome do personagem das anotações pro perfil assim que as duas coisas batem, e no
   *    primeiro quadro elas batem, porque as anotações vêm do processo principal (que sabe qual é o
   *    perfil ativo de verdade) enquanto a lista aqui ainda é a fictícia.
   *
   * É a mesma guarda que `useNotes` já tinha (`prontoRef`) e que aqui faltava — e aqui era pior,
   * porque `profiles.json` é o índice: perdê-lo não perde um personagem, perde todos.
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
   * Aplica a mudança e grava.
   *
   * A gravação saiu de DENTRO do `setState`, onde estava. Uma função passada ao `setState` tem que
   * ser pura — o React pode chamá-la mais de uma vez pelo mesmo resultado, e chamava: cada uma
   * disparava uma gravação. Agora o novo estado é calculado a partir do espelho e a gravação
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
       * Apagar NÃO remove a pasta do personagem em disco — as anotações e os presets dele continuam
       * lá. É de propósito: apagar um personagem por engano é irreversível de outra forma, e um
       * `profiles.json` editado de volta traz tudo. O que some é a entrada na lista.
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
