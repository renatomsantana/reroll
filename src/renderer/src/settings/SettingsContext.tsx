import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useProfiles } from './ProfilesContext'
import type { DiceMaterialFinish } from '@renderer/dice3d/materials/createDiceMaterial'
import type { TrayShape } from '@renderer/dice3d/geometry/trayShape'
import { sanearPreferencias } from './sanearSettings'
import { DEFAULT_APP_ICON_ID, isValidAppIconId } from '@shared/appIcons'
import type { Language } from '@shared/types/idioma'

export type ThemeMode = 'day' | 'night'
// Reexportado pra não quebrar quem já importava daqui; a definição mora em `shared` porque os
// leitores de ficha também precisam dela. Ver `shared/types/idioma.ts`.
export type { Language }
/**
 * Como o dado entra na bandeja, e se a torre aparece — três opções, pedido do usuário ("uma opção de
 * escolher se quer que tenha a torre ou não, ou se quer que jogue por cima como é o padrão, ou se
 * quer a torre ali só por decoração"):
 *
 * - `tray`: sem torre. O dado é arremessado de fora e de cima da bandeja (`tossDie`) — o padrão de
 *   sempre;
 * - `tower`: a torre encostada no hexágono E o dado saindo da boca dela (`tossDieFromMouth`);
 * - `towerDecor`: a torre na cena, mas o dado arremessado por cima como no `tray`. É a torre como
 *   peça de cenário, sem participar da rolagem.
 *
 * As duas primeiras trocam a FÍSICA e por isso entram no `key` de remontagem em `DiceRoller3D.tsx`;
 * a terceira também, porque muda a cena.
 */
export type LaunchMode = 'tray' | 'tower' | 'towerDecor'

/**
 * Como o WASD dirige a câmera (pedido do usuário: "poder movimentar pela mesa inteira, ou deixar
 * lockado no dado, ou free way"):
 *
 * - `table`: anda pela MESA. W/S e A/D deslizam a câmera no plano da mesa, sem sair dela.
 * - `dice`: TRAVADA nos dados. O alvo persegue sozinho onde os dados pararam e o WASD orbita em
 *   volta deles.
 * - `free`: LIVRE. A câmera voa na direção pra onde está olhando, sem ficar presa a nada.
 *
 * Ao contrário de `launchMode`, isto NÃO entra no `key` de remount da cena: trocar de modo não
 * reconstrói nada, só muda como as teclas são interpretadas no laço de animação.
 */
export type CameraMode = 'table' | 'dice' | 'free'

/**
 * DEZOITO fontes no fechamento do alfa.
 *
 * O número já foi motivo de bug de layout: a lista do seletor tinha teto de altura FIXO, com uma
 * cópia no CSS, e crescer a lista sem lembrar dos dois lugares deixava a lista cortada e a conta de
 * abrir-pra-cima errada. Isso não é mais um risco — a altura agora é calculada a partir de quantas
 * opções existem (ver `FontSelect.tsx`), então acrescentar fonte aqui é só acrescentar fonte.
 *
 * O que continua valendo ao mexer nesta lista:
 *
 * 1. A cadeia de RESERVA de cada fonte termina numa família genérica, nunca em outra fonte deste
 *    menu. Quando a cadeia cai num item da própria lista, escolher uma dá visivelmente a outra — foi
 *    o bug do Papyrus, relatado por ele (ver mais abaixo).
 * 2. Só Montserrat e JetBrains Mono NÃO vêm no Windows: elas são empacotadas em `assets/fonts/` e
 *    declaradas por `@font-face` no `global.css`. Fonte de fora sem esse par cai no reserva calada.
 * 3. Fonte que só vem com o OFFICE (Century Gothic, Garamond) não entra: na máquina que não tem
 *    Office ela vira outra coisa sem avisar.
 */
export const FONT_OPTIONS = [
  { id: 'tahoma', label: 'Tahoma (clássica)', family: "Tahoma, 'MS Sans Serif', Geneva, sans-serif" },
  {
    id: 'ms-sans-serif',
    label: 'MS Sans Serif',
    family: "'Microsoft Sans Serif', Tahoma, sans-serif"
  },
  { id: 'segoe', label: 'Segoe UI', family: "'Segoe UI', Tahoma, sans-serif" },
  // Empacotada (`global.css`). O reserva atrás dela é a outra sans moderna da lista, não a Tahoma:
  // se um dia o `@font-face` sumir, o menos pior é cair em algo do mesmo peso visual.
  { id: 'montserrat', label: 'Montserrat', family: "Montserrat, 'Segoe UI', Tahoma, sans-serif" },
  /**
   * Pedido do usuário, com o crédito de quem indicou — mesmo esquema da JetBrains Mono e da Janda
   * Silly Monkey.
   *
   * Não é empacotada e não precisa: a Arial vem com o Windows desde sempre. O reserva é a Helvetica
   * (que no Windows o próprio sistema resolve como Arial) e depois a genérica `sans-serif` — nenhuma
   * das duas é item deste menu, que é a regra que o caso da Papyrus deixou aqui: cadeia de reserva
   * terminando em outra opção da lista faz escolher uma dar visivelmente a outra.
   */
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', credit: 'by dan' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  /**
   * As cinco abaixo entraram no fechamento do alfa, a pedido do usuário ("adicionar mais algumas
   * fontes"). Todas vêm COM O WINDOWS — nenhuma é do Office nem precisa ser empacotada.
   *
   * O reserva de cada uma termina na família GENÉRICA (`sans-serif`, `serif`, `monospace`) e nunca
   * em outra fonte deste menu. É a regra que o caso da Papyrus deixou aqui: quando a cadeia de
   * reserva cai numa fonte que também é item da lista, escolher uma dá visivelmente a outra, e isso
   * já virou bug relatado neste projeto.
   */
  { id: 'trebuchet', label: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
  { id: 'candara', label: 'Candara', family: 'Candara, sans-serif' },
  { id: 'times', label: 'Times New Roman', family: "'Times New Roman', Times, serif" },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'palatino', label: 'Palatino', family: "'Palatino Linotype', 'Book Antiqua', serif" },
  { id: 'courier', label: 'Courier New', family: "'Courier New', Courier, monospace" },
  { id: 'consolas', label: 'Consolas', family: 'Consolas, monospace' },
  // Empacotada (`global.css`). Reserva na Consolas e na Courier — as duas monoespaçadas que o
  // Windows garante, pela mesma razão da linha da Montserrat.
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: "'JetBrains Mono', Consolas, 'Courier New', monospace",
    /**
     * Crédito de quem indicou a fonte, mostrado ao lado do nome na lista (ver `FontSelect.tsx`).
     * Vive AQUI, junto da fonte, e não numa tabela à parte no componente: quem acrescentar uma fonte
     * amanhã vai mexer nesta lista, e um crédito guardado longe é um crédito que se perde.
     */
    credit: 'by caio'
  },
  { id: 'impact', label: 'Impact', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  // "MS" fora do rótulo a pedido do usuário — o nome real da fonte continua em `family`, que é o
  // que o navegador procura no sistema.
  { id: 'comic-sans', label: 'Comic Sans', family: "'Comic Sans MS', 'Comic Sans', cursive" },
  /**
   * O reserva era `'Comic Sans MS'` e isso virou bug relatado: "você errou no Papyrus, ela ficou
   * com a fonte Comic Sans". Não era troca de nome — a Papyrus simplesmente NÃO vem com o Windows
   * (ela vem com o Office/macOS), confirmado consultando as fontes instaladas na máquina do
   * usuário, e a cadeia caía direto no reserva seguinte, que era justamente a outra fonte da lista.
   * `Segoe Print` vem com o Windows e é escrita à mão irregular — não é Papyrus, mas é o parente
   * mais próximo disponível e, principalmente, não se disfarça de outra opção do menu.
   */
  { id: 'papyrus', label: 'Papyrus', family: "Papyrus, 'Segoe Print', 'Ink Free', fantasy" },
  /**
   * NÃO É EMPACOTADA — e não pode ser. A Janda Silly Monkey é da Kimberly Geswein, gratuita só pra
   * USO PESSOAL; pôr o `.ttf` dentro do app (que é publicado no GitHub) seria redistribuição, e pra
   * isso o autor cobra uma licença de aplicação à parte. O que existe aqui é só o NOME da família: se
   * a fonte estiver instalada na máquina, o Chromium a encontra; se não estiver, cai no reserva.
   *
   * O reserva é `Ink Free` (manuscrita que vem com o Windows 10+) e não uma das outras opções desta
   * lista, pela lição do Papyrus logo acima: quando a cadeia de reserva termina numa fonte que também
   * é item do menu, escolher uma dá visivelmente a outra, e isso já virou bug relatado aqui.
   */
  {
    id: 'janda-silly-monkey',
    label: 'Janda Silly Monkey',
    family: "'Janda Silly Monkey', 'Ink Free', cursive",
    credit: 'by xuga'
  }
] as const

export type FontId = (typeof FONT_OPTIONS)[number]['id']

interface Settings {
  theme: ThemeMode
  fontId: FontId
  language: Language
  soundEnabled: boolean
  compactMode: boolean
  diceBodyColor: string
  diceNumberColor: string
  diceMaterial: DiceMaterialFinish
  /**
   * Cor do corpo/número por TIPO de dado (chave = lados, ex.: 6, 20, 100) — sobrepõe
   * `diceBodyColor`/`diceNumberColor` só pro(s) tipo(s) presentes aqui; tipos ausentes usam a
   * cor global normalmente. Pedido do usuário depois da prateleira decorativa (`DiceCanvasMulti.tsx`)
   * mostrar todos os tipos lado a lado fora do hexágono — ver cada tipo com cor própria ali.
   */
  diceColorOverrides: Record<number, { bodyColor: string; numberColor: string }>
  /** Cor da parede da bandeja (CSS hex) — substitui os temas prontos (cerca/floresta) removidos a pedido do usuário; cor livre igual à do dado. */
  wallColor: string
  backgroundColor: string
  /** Cor do chão da bandeja — antes fixa (0x2b5b3f em `createScene.ts`), liberada pra customização junto do preset "Couro". */
  floorColor: string
  /**
   * Cores da torre que fica ao lado da bandeja (ver `createTowerBesideTray.ts`) — pedra, telhado
   * ("bico"), flâmula e porta. Só aparecem no modo torre; ficam guardadas de qualquer jeito, como
   * qualquer outra preferência de cor.
   */
  towerStoneColor: string
  towerRoofColor: string
  towerFlagColor: string
  towerDoorColor: string
  /**
   * Id do ícone da janela/barra de tarefas (ver `shared/appIcons.ts`) — espelha o que está
   * persistido em `settings.json` no processo main (fonte de verdade real, porque o ícone
   * precisa ser conhecido já na criação da janela, antes do renderer existir). Guardado aqui
   * também só pra UI mostrar qual está selecionado sem precisar de uma chamada IPC extra.
   */
  appIconId: string
  /** Bandeja aberta (arremesso de fora) ou torre de castelo com rampa em espiral (`TOWER_CONFIG`). Estrutural — faz parte do `key` de remount em `DiceRoller3D.tsx`. */
  launchMode: LaunchMode
  /**
   * FORMA da bandeja — triângulo, quadrado, hexágono ou círculo, pedido do usuário. Vive por
   * PERSONAGEM (está em `PROFILE_LOOK_KEYS`), como o resto da aparência: a mesa de cada um é a dele.
   */
  trayShape: TrayShape
  /** Como o WASD dirige a câmera (ver `CameraMode`). Não é estrutural: trocar não remonta a cena. */
  cameraMode: CameraMode
  debugMode: boolean
  /**
   * Imagem de fundo da cena 3D (data URL base64, ver `registerSceneBackgroundHandlers.ts`) —
   * `null` = usa `backgroundColor` sólida (padrão). Guardada como data URL inteira (não um
   * caminho de arquivo) porque o arquivo escolhido pode estar em qualquer pasta do sistema —
   * um caminho ficaria inválido se o usuário mover/apagar o arquivo original depois.
   */
  backgroundImage: string | null
  /** Popup do total sobre a bandeja/torre ao assentar os dados (ver `DiceRoller3D.tsx`) — desligável porque nem todo mundo quer o efeito por cima da cena. */
  resultPopupEnabled: boolean
  /**
   * As grades de cores prontas da aba Estilo (paletas de dado e estilos de bandeja) aparecem ou
   * ficam recolhidas. Fica AQUI, e não num `useState` da aba, porque a aba desmonta a cada troca de
   * seção/aba — recolher e voltar dois minutos depois pra tudo aberto de novo não é uma opção, é um
   * botão que não lembra do que foi pedido.
   */
  palettesVisible: boolean
}

/** Mesmos padrões já hardcoded em `buildD6Visual`/`buildPolyhedronVisual`/`buildD4Visual` (0xf2ead6 / '#1a1a1a') e em `createScene.ts` (parede/fundo). */
const DEFAULT_SETTINGS: Settings = {
  theme: 'day',
  fontId: 'tahoma',
  language: 'pt-BR',
  soundEnabled: true,
  compactMode: false,
  diceBodyColor: '#f2ead6',
  diceNumberColor: '#1a1a1a',
  diceMaterial: 'matte',
  diceColorOverrides: {},
  /**
   * A bandeja de fábrica que o usuário definiu: "o padrão sempre vai ser paredes marrons cor
   * madeira, veludo azul e fundo preto — mas todos os usuários podem mudar". Os mesmos três valores
   * estão em `createScene.ts` (`DEFAULT_*`), pra cena montada sem preferências cair no mesmo lugar.
   */
  wallColor: '#6b4a2a',
  backgroundColor: '#000000',
  floorColor: '#243b6b',
  // Espelham as `DEFAULT_TOWER_*` de `createTowerBesideTray.ts`, pra cena montada sem preferências
  // cair exatamente no mesmo lugar.
  towerStoneColor: '#45423a',
  towerRoofColor: '#2f3542',
  towerFlagColor: '#b03030',
  towerDoorColor: '#4a3520',
  appIconId: DEFAULT_APP_ICON_ID,
  launchMode: 'tray',
  trayShape: 'hexagon',
  // `table` como padrão: é o modo que mais parece com o que já existia (orbitar/aproximar em volta
  // da mesa) e o único que nunca tira a bandeja do enquadramento sozinho.
  cameraMode: 'table',
  debugMode: false,
  backgroundImage: null,
  resultPopupEnabled: true,
  palettesVisible: true
}

const STORAGE_KEY = 'rolador-settings'

/**
 * O que é APARÊNCIA DO PERSONAGEM e por isso é guardado por perfil (ver `shared/types/profile.ts`):
 * "os dados são customizados para o de Rodrigo, as cores, e já fica tudo salvo... mas quando eu
 * voltar pro profile do Rodrigo, volta como era antes".
 *
 * Tudo que NÃO está nesta lista é preferência de quem usa o programa — idioma, tema, fonte, som,
 * ícone do app, modo de câmera — e continua valendo pra todos os personagens. A divisão importa:
 * ninguém quer o app trocando de idioma porque mudou de ficha.
 */
const PROFILE_LOOK_KEYS = [
  'diceBodyColor',
  'diceNumberColor',
  'diceMaterial',
  'diceColorOverrides',
  'wallColor',
  'backgroundColor',
  'floorColor',
  'towerStoneColor',
  'towerRoofColor',
  'towerFlagColor',
  'towerDoorColor',
  'backgroundImage',
  'launchMode',
  'trayShape'
] as const

type ProfileLook = Pick<Settings, (typeof PROFILE_LOOK_KEYS)[number]>

/** Uma chave de `localStorage` por personagem — trocar de perfil é ler outra chave, nada mais. */
function lookStorageKey(profileId: string): string {
  return `rolador-look::${profileId}`
}

function pickLook(settings: Settings): ProfileLook {
  const look = {} as ProfileLook
  for (const key of PROFILE_LOOK_KEYS) {
    // @ts-expect-error — cópia chave a chave da mesma união de chaves; o tipo do resultado é garantido por `ProfileLook`.
    look[key] = settings[key]
  }
  return look
}

/**
 * Aparência gravada do personagem. Ausente (perfil novo, ou o primeiro a existir) devolve `null` pra
 * quem chama cair no que já estava valendo — assim criar um personagem não joga a cena pro padrão de
 * fábrica, ela começa parecida com a que a pessoa estava vendo.
 */
function loadLook(profileId: string): Partial<ProfileLook> | null {
  try {
    const raw = localStorage.getItem(lookStorageKey(profileId))
    // Mesma higiene do `loadInitial`: aqui moram `trayShape`, `launchMode` e `diceMaterial`, que são
    // os três campos de valor fechado da APARÊNCIA — e é por esta porta que eles chegam.
    return raw ? sanearPreferencias(JSON.parse(raw) as ProfileLook) : null
  } catch {
    return null
  }
}

/**
 * Espera antes de gravar as preferências no `localStorage`. Gravar é síncrono e passa pelo
 * `JSON.stringify` do objeto INTEIRO — incluindo `backgroundImage`, que é uma imagem em base64 e
 * pode ter vários megabytes. Os seletores de cor da aba Estilo disparam `change` continuamente
 * enquanto o mouse arrasta, então sem espera cada pixel de arraste serializava a imagem de fundo
 * de novo, na thread da interface. É o que fazia a aba inteira "arrastar" junto com o seletor.
 *
 * Só a GRAVAÇÃO espera; o estado em memória (e portanto a cena e a prévia) muda no mesmo instante.
 */
const PERSIST_DEBOUNCE_MS = 300

interface SettingsContextValue extends Settings {
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  setFontId: (fontId: FontId) => void
  setLanguage: (language: Language) => void
  setSoundEnabled: (value: boolean) => void
  setCompactMode: (value: boolean) => void
  setDiceBodyColor: (value: string) => void
  setDiceNumberColor: (value: string) => void
  setDiceMaterial: (value: DiceMaterialFinish) => void
  setDiceColorOverride: (sides: number, bodyColor: string, numberColor: string) => void
  clearDiceColorOverride: (sides: number) => void
  setWallColor: (value: string) => void
  setBackgroundColor: (value: string) => void
  setFloorColor: (value: string) => void
  setTowerStoneColor: (value: string) => void
  setTowerRoofColor: (value: string) => void
  setTowerFlagColor: (value: string) => void
  setTowerDoorColor: (value: string) => void
  setAppIconId: (value: string) => void
  setLaunchMode: (value: LaunchMode) => void
  setTrayShape: (value: TrayShape) => void
  setCameraMode: (value: CameraMode) => void
  setDebugMode: (value: boolean) => void
  setBackgroundImage: (value: string | null) => void
  setResultPopupEnabled: (value: boolean) => void
  setPalettesVisible: (value: boolean) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadInitial(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      /**
       * `sanearPreferencias` tira os campos de VALOR FECHADO que não são reconhecidos, pra eles
       * caírem no padrão em vez de entrar torto. Sem isso um `trayShape` desconhecido — de uma
       * versão em que a lista era outra — leva a cena inteira a NaN e mata a página de rolagem, sem
       * jeito de consertar de dentro do app. Ver `sanearSettings.ts`.
       */
      const merged = { ...DEFAULT_SETTINGS, ...sanearPreferencias(JSON.parse(raw)) }
      // `appIconId` persistido de uma versão anterior pode apontar pra um id removido (ex.: o
      // ícone branco 'rbranco') — cai pro padrão em vez de deixar a miniatura da Preferências
      // sem seleção nenhuma ou o splash tentando carregar uma imagem que não existe mais.
      if (!isValidAppIconId(merged.appIconId)) merged.appIconId = DEFAULT_SETTINGS.appIconId
      // Mesma higiene pra fonte: a lista encolheu de catorze pra nove opções, então quem tinha
      // escolhido uma das que saíram (Arial, Georgia, Trebuchet, Consolas, Century Gothic) guarda um
      // id que não existe mais. Sem isto o app abriria em Tahoma (o fallback dos dois lugares que
      // consultam a lista) mas continuaria gravando o id morto pra sempre.
      if (!FONT_OPTIONS.some((font) => font.id === merged.fontId)) {
        merged.fontId = DEFAULT_SETTINGS.fontId
      }
      return merged
    }
  } catch {
    // localStorage indisponível ou JSON corrompido: cai no padrão
  }
  return DEFAULT_SETTINGS
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadInitial)
  const { activeId } = useProfiles()
  /**
   * Guarda de qual perfil é a aparência que está em `settings` neste momento. Sem ela, o efeito de
   * troca abaixo rodaria também no primeiro render e na volta de qualquer outra mudança de estado,
   * regravando a aparência de um perfil por cima da do outro.
   */
  const lookProfileRef = useRef(activeId)

  /**
   * Troca de personagem: guarda a aparência do que estava aberto e carrega a do que entrou. É isto
   * que faz "mudar de personagem e voltar" devolver as cores exatamente como estavam.
   */
  useEffect(() => {
    const anterior = lookProfileRef.current
    if (anterior === activeId) return
    lookProfileRef.current = activeId
    setSettings((atual) => {
      localStorage.setItem(lookStorageKey(anterior), JSON.stringify(pickLook(atual)))
      const proximo = loadLook(activeId)
      return proximo ? { ...atual, ...proximo } : atual
    })
  }, [activeId])

  // Tema e fonte continuam aplicados na hora: são baratos (dois atributos no `<html>`) e qualquer
  // atraso aqui apareceria como a interface trocando de cara depois do clique.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    const font = FONT_OPTIONS.find((f) => f.id === settings.fontId) ?? FONT_OPTIONS[0]
    document.documentElement.style.setProperty('--font-family', font.family)
  }, [settings.theme, settings.fontId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      localStorage.setItem(lookStorageKey(activeId), JSON.stringify(pickLook(settings)))
    }, PERSIST_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [settings, activeId])

  /**
   * Fechar a janela cancela o `setTimeout` pendente sem ele nunca ter rodado — então a última
   * mudança (a cor escolhida segundos antes de fechar, por exemplo) se perderia. `pagehide` cobre
   * o fechamento da janela do Electron; a gravação é síncrona e cabe no tempo que o navegador dá.
   */
  useEffect(() => {
    function persistNow() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      localStorage.setItem(lookStorageKey(activeId), JSON.stringify(pickLook(settings)))
    }
    window.addEventListener('pagehide', persistNow)
    return () => window.removeEventListener('pagehide', persistNow)
  }, [settings, activeId])

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setTheme: (theme) => setSettings((prev) => ({ ...prev, theme })),
      toggleTheme: () =>
        setSettings((prev) => ({ ...prev, theme: prev.theme === 'day' ? 'night' : 'day' })),
      setFontId: (fontId) => setSettings((prev) => ({ ...prev, fontId })),
      setLanguage: (language) => setSettings((prev) => ({ ...prev, language })),
      setSoundEnabled: (soundEnabled) => setSettings((prev) => ({ ...prev, soundEnabled })),
      setCompactMode: (compactMode) => setSettings((prev) => ({ ...prev, compactMode })),
      setDiceBodyColor: (diceBodyColor) => setSettings((prev) => ({ ...prev, diceBodyColor })),
      setDiceNumberColor: (diceNumberColor) =>
        setSettings((prev) => ({ ...prev, diceNumberColor })),
      setDiceMaterial: (diceMaterial) => setSettings((prev) => ({ ...prev, diceMaterial })),
      setDiceColorOverride: (sides, bodyColor, numberColor) =>
        setSettings((prev) => ({
          ...prev,
          diceColorOverrides: { ...prev.diceColorOverrides, [sides]: { bodyColor, numberColor } }
        })),
      clearDiceColorOverride: (sides) =>
        setSettings((prev) => {
          const next = { ...prev.diceColorOverrides }
          delete next[sides]
          return { ...prev, diceColorOverrides: next }
        }),
      setWallColor: (wallColor) => setSettings((prev) => ({ ...prev, wallColor })),
      setBackgroundColor: (backgroundColor) => setSettings((prev) => ({ ...prev, backgroundColor })),
      setFloorColor: (floorColor) => setSettings((prev) => ({ ...prev, floorColor })),
      setTowerStoneColor: (towerStoneColor) => setSettings((prev) => ({ ...prev, towerStoneColor })),
      setTowerRoofColor: (towerRoofColor) => setSettings((prev) => ({ ...prev, towerRoofColor })),
      setTowerFlagColor: (towerFlagColor) => setSettings((prev) => ({ ...prev, towerFlagColor })),
      setTowerDoorColor: (towerDoorColor) => setSettings((prev) => ({ ...prev, towerDoorColor })),
      setAppIconId: (appIconId) => {
        setSettings((prev) => ({ ...prev, appIconId }))
        void window.api.windowControls.setAppIcon(appIconId)
      },
      setLaunchMode: (launchMode) => setSettings((prev) => ({ ...prev, launchMode })),
      setTrayShape: (trayShape) => setSettings((prev) => ({ ...prev, trayShape })),
      setCameraMode: (cameraMode) => setSettings((prev) => ({ ...prev, cameraMode })),
      setDebugMode: (debugMode) => setSettings((prev) => ({ ...prev, debugMode })),
      setBackgroundImage: (backgroundImage) => setSettings((prev) => ({ ...prev, backgroundImage })),
      setResultPopupEnabled: (resultPopupEnabled) =>
        setSettings((prev) => ({ ...prev, resultPopupEnabled })),
      setPalettesVisible: (palettesVisible) => setSettings((prev) => ({ ...prev, palettesVisible })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS)
    }),
    [settings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa ser usado dentro de um SettingsProvider')
  return ctx
}
