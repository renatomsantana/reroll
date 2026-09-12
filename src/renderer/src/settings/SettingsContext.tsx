import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useProfiles } from './ProfilesContext'
import type { DiceMaterialFinish } from '@renderer/dice3d/materials/createDiceMaterial'
import type { TrayShape } from '@renderer/dice3d/geometry/trayShape'
import { migrarPreferencias, sanearPreferencias } from './sanearSettings'
import { VOLUME_PADRAO, definirVolume, volumeValido } from '@renderer/audio/volume'
import { DEFAULT_APP_ICON_ID, isValidAppIconId } from '@shared/appIcons'
import type { Language } from '@shared/types/idioma'
import { CHAVES_DA_APARENCIA, type AparenciaDoPersonagem } from '@shared/types/aparencia'
import { COR_PADRAO_DA_FLOR_1, COR_PADRAO_DA_FLOR_2 } from '@renderer/dice3d/materials/florDeResina'
import { COR_PADRAO_DO_GLITTER } from '@renderer/dice3d/materials/glitterDeResina'

export type ThemeMode = 'day' | 'night'

/**
 * O que a pessoa ESCOLHEU, que é diferente do tema valendo agora: `'system'` existe porque um app
 * aberto ao lado do Discord a noite inteira deveria escurecer junto com o Windows.
 *
 * A distinção evita espalhar condicional pelo app: `themeSource` é o que se guarda, `theme` continua
 * sendo 'day' ou 'night' e é o que todo o resto lê, inclusive o `data-theme` do `<html>`.
 */
export type ThemeSource = ThemeMode | 'system'
// Reexportado pra não quebrar quem já importava daqui; a definição mora em `shared` porque os
// leitores de ficha também precisam dela. Ver `shared/types/idioma.ts`.
export type { Language }
/**
 * Como o dado entra na bandeja, e se a torre aparece:
 *
 * - `tray`: sem torre, dado arremessado de fora e de cima (`tossDie`), o padrão de sempre;
 * - `tower`: torre encostada no hexágono e dado saindo da boca dela (`tossDieFromMouth`);
 * - `towerDecor`: torre na cena, dado arremessado por cima como no `tray`.
 *
 * Os três entram no `key` de remontagem em `DiceRoller3D.tsx`: dois trocam a física, o terceiro muda
 * a cena.
 */
export type LaunchMode = 'tray' | 'tower' | 'towerDecor'

/**
 * Como o WASD dirige a câmera:
 *
 * - `table`: anda pela MESA, deslizando no plano dela, sem sair;
 * - `dice`: TRAVADA nos dados, com o alvo perseguindo onde eles pararam e o WASD orbitando;
 * - `free`: LIVRE, voando na direção pra onde a câmera olha.
 *
 * Ao contrário de `launchMode`, NÃO entra no `key` de remount: só muda como as teclas são lidas.
 */
export type CameraMode = 'table' | 'dice' | 'free'

/**
 * Como o resultado aparece: em `3d` os dados caem na bandeja, em `quick` o número sai na hora, sem
 * física, pelo mesmo `rollExpression`.
 *
 * O modo rápido não é uma versão pobre: é o que a pessoa quer numa mesa corrida, é o que o modo
 * compacto já fazia sozinho, e é a REDE de quem não tem WebGL utilizável (ver `webglDisponivel.ts`).
 */
export type DisplayMode = '3d' | 'quick'

/**
 * As fontes do menu. A lista já teve dezoito e foi ENCURTADA a pedido dele: metade das que saíram
 * eram variações quase indistinguíveis das que ficaram. Quem tiver uma das removidas gravada nas
 * preferências cai no padrão na próxima abertura (ver `loadInitial`), e quem tiver uma numa ANOTAÇÃO
 * cai em "fonte padrão" no seletor do bloco (ver `familyToFontId` em `NotesTab.tsx`).
 *
 * O que vale ao mexer nesta lista:
 *
 * 1. a cadeia de RESERVA de cada fonte termina numa família genérica, NUNCA em outra fonte deste
 *    menu: terminando num item da própria lista, escolher uma dá visivelmente a outra — foi o bug do
 *    Papyrus, relatado por ele;
 * 2. fonte que não vem no Windows precisa de um de dois tratamentos, e quem decide é a LICENÇA.
 *    Montserrat, JetBrains Mono, Lora e Nunito são OFL: entram empacotadas em `assets/fonts/`, com a
 *    licença ao lado e um par de `@font-face` no `global.css`. Janda Silly Monkey, Sweetie e
 *    Determination são gratuitas só pra uso pessoal: entram só como NOME, e quem não as tiver vê o
 *    reserva. Sem um dos dois tratamentos, a fonte cai no reserva calada;
 * 3. fonte que só vem com o OFFICE (Century Gothic, Garamond) entra apenas se alguém a pedir pelo
 *    nome: na máquina sem Office ela vira outra coisa sem avisar. A Algerian é a única exceção, e o
 *    reserva dela é o que faz a exceção custar pouco — não a use como precedente.
 */
export const FONT_OPTIONS = [
  { id: 'tahoma', label: 'Tahoma (clássica)', family: "Tahoma, 'MS Sans Serif', Geneva, sans-serif" },
  // Empacotada (`global.css`). O reserva é a Segoe UI, que SAIU do menu (segunda limpeza) e virou
  // reserva legítima, como a Consolas: existe em toda máquina Windows e não é mais opção da lista.
  { id: 'montserrat', label: 'Montserrat', family: "Montserrat, 'Segoe UI', Tahoma, sans-serif" },
  // Empacotada (`global.css` + `assets/fonts/nunito-*.woff2`, OFL junto) — sans arredondada,
  // pedida pelo usuário com o crédito do juba. Mesmo reserva da Montserrat, pela mesma razão.
  { id: 'nunito', label: 'Nunito', family: "Nunito, 'Segoe UI', Tahoma, sans-serif", credit: 'by juba' },
  /**
   * Não é empacotada e não precisa: a Arial vem com o Windows desde sempre. O reserva é a Helvetica
   * (que no Windows o sistema resolve como Arial) e depois a genérica — nenhuma das duas é item deste
   * menu, que é a regra que o caso da Papyrus deixou aqui.
   */
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', credit: 'by dan' },
  {
    id: 'times',
    label: 'Times New Roman',
    family: "'Times New Roman', Times, serif",
    credit: 'by avigro'
  },
  /**
   * Empacotada (`global.css` + `assets/fonts/lora-*.woff2`), com a licença OFL junto. O reserva é a
   * genérica `serif`, e não a Times nem a Georgia: se o `@font-face` sumir um dia, cair numa fonte
   * que também é item deste menu faria escolher Lora dar visivelmente outra opção da lista.
   */
  { id: 'lora', label: 'Lora', family: "Lora, serif", credit: 'by cata' },
  // Empacotada (`global.css`). Reserva na Consolas e na Courier New — as duas monoespaçadas que o
  // Windows garante. As duas já foram opção DESTE menu e saíram (a Consolas na primeira limpeza, a
  // Courier New na segunda); continuam existindo no sistema, então seguem reservas legítimas: a
  // regra é a cadeia não terminar em outra opção da lista, e elas não são mais.
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: "'JetBrains Mono', Consolas, 'Courier New', monospace",
    /**
     * Crédito de quem indicou a fonte, mostrado ao lado do nome na lista. Vive AQUI, junto da fonte,
     * e não numa tabela à parte no componente: quem acrescentar uma fonte amanhã vai mexer nesta
     * lista, e crédito guardado longe é crédito que se perde.
     */
    credit: 'by caio'
  },
  // "MS" fora do rótulo a pedido dele; o nome real continua em `family`, que é o que o navegador
  // procura no sistema.
  /**
   * A opção AMIGÁVEL A DISLÉXICOS da lista, e o rótulo não diz isso, a pedido dele. A Comic Sans é
   * recomendada com frequência pra leitura com dislexia porque as letras têm formas irregulares o
   * bastante pra reduzir a troca de b/d/p/q; não é remédio e não funciona pra todo mundo, e por isso
   * entra como opção e não como padrão.
   *
   * Este comentário fica no lugar do rótulo: sem ele, a Comic Sans vira só "a fonte de piada" da
   * lista e some na próxima limpeza — e com ela some a única opção que cobre o requisito, já que a
   * OpenDyslexic saiu a pedido dele.
   */
  { id: 'comic-sans', label: 'Comic Sans', family: "'Comic Sans MS', 'Comic Sans', cursive" },
  /**
   * O reserva era `'Comic Sans MS'`, e isso virou bug relatado: "você errou no Papyrus, ela ficou com
   * a fonte Comic Sans". Não era troca de nome — a Papyrus não vem com o Windows (vem com o
   * Office e o macOS), conferido nas fontes instaladas da máquina dele, e a cadeia caía direto na
   * outra fonte da lista. `Segoe Print` vem com o Windows, é escrita à mão irregular e,
   * principalmente, não se disfarça de outra opção do menu.
   */
  { id: 'papyrus', label: 'Papyrus', family: "Papyrus, 'Segoe Print', 'Ink Free', fantasy" },
  /**
   * NÃO é empacotada, e não pode ser: a Janda Silly Monkey é da Kimberly Geswein, gratuita só pra USO
   * PESSOAL, e pôr o `.ttf` num app publicado no GitHub seria redistribuição. O que existe aqui é só
   * o NOME da família. O reserva é `Ink Free`, manuscrita que vem com o Windows 10+, e não uma das
   * outras opções desta lista, pela lição do Papyrus logo acima.
   */
  {
    id: 'janda-silly-monkey',
    label: 'Janda Silly Monkey',
    family: "'Janda Silly Monkey', 'Ink Free', cursive",
    credit: 'by xuga'
  },
  /**
   * SWEETIE, manuscrita, pedida com o crédito da vivi. Não empacotada pelo mesmo motivo da Janda
   * Silly Monkey: é da Graphix Line Studio, gratuita apenas pra uso pessoal, e vende licença
   * comercial à parte. Só o NOME da família, então o reserva dela importa de verdade.
   *
   * `Segoe Script` vem com o Windows desde o Vista, é manuscrita conectada (que é o que a Sweetie é)
   * e não é opção deste menu. A `Ink Free`, reserva da Janda e da Papyrus, é de traço mais grosso e
   * ficaria mais longe do script fino dela.
   */
  {
    id: 'sweetie',
    label: 'Sweetie',
    family: "Sweetie, 'Segoe Script', cursive",
    credit: 'by vivi'
  },
  /**
   * DETERMINATION, a fonte pixelada de Undertale, pedida com o crédito do sat (de Lucca Cedro). Não
   * empacotada, e não pode: o autor escreve "its for free, BUT ONLY FOR PERSONAL USE!!", mesma
   * situação da Janda e da Sweetie.
   *
   * `Consolas` é o reserva: não existe pixelada que venha com o Windows, e o parente mais próximo do
   * desenho blocado e de largura fixa dela é uma monoespaçada de console. Ela vem com o Windows, já
   * serve de reserva à JetBrains Mono e não é opção deste menu — ao contrário da `Courier New`, que
   * também lembraria console e cairia no bug do Papyrus.
   */
  {
    id: 'determination',
    label: 'Determination',
    family: 'Determination, Consolas, monospace',
    credit: 'by sat'
  },
  /**
   * ALGERIAN, decorativa e de caixa alta, pedida com o crédito do pedro. É a EXCEÇÃO da regra 3 lá em
   * cima, e entra sabendo disso: ela não vem com o Windows, vem com o Office desde 1993 (conferido na
   * máquina dele no dia do pedido — 154 fontes instaladas, e ela não estava entre elas). Empacotar
   * não é opção: é comercial (Letraset/URW), não OFL como a Lora nem grátis pra uso pessoal como a
   * Sweetie. Só o NOME, então o reserva é a parte que importa.
   *
   * `Impact` na frente: é o parente visual mais próximo (as duas são display pesadas) e vem com o
   * Windows. Enquanto era opção deste menu não podia ser reserva, pelo bug do Papyrus; saindo do
   * menu, virou o primeiro degrau. A `Arial Black` fica atrás, e não se confunde com a `Arial` da
   * lista: uma é preta e condensada, a outra é regular.
   */
  {
    id: 'algerian',
    label: 'Algerian',
    family: "Algerian, Impact, 'Arial Black', fantasy",
    credit: 'by pedro'
  }
] as const

export type FontId = (typeof FONT_OPTIONS)[number]['id']

interface Settings {
  /**
   * A ESCOLHA de tema, não o tema em vigor — ver `ThemeSource`. O tema em vigor sai daqui em
   * `SettingsProvider` e chega a quem consome como `theme`.
   */
  themeSource: ThemeSource
  fontId: FontId
  language: Language
  soundEnabled: boolean
  /**
   * O volume geral, 0 a 100 — a barrinha embaixo do interruptor de som (pedido dele, 05/09/2026:
   * "uma barrinha para medir o som do jogo e a pessoa diminuir ou aumentar"). Vale pra todos os
   * sons; quem toca lê do módulo `audio/volume.ts`, que o provedor mantém em dia.
   */
  volume: number
  compactMode: boolean
  diceBodyColor: string
  diceNumberColor: string
  diceMaterial: DiceMaterialFinish
  /** As cores da flor 1 (grande) e da flor 2 (pequena) do acabamento "Resina com flor" (CSS hex). */
  resinFlower1: string
  resinFlower2: string
  /** A cor dos flocos do acabamento "Resina com glitter" (CSS hex). */
  glitterColor: string
  /**
   * Cor do corpo e do número por TIPO de dado (chave = lados), sobrepondo a cor global só nos tipos
   * presentes aqui. Pedido dele depois de a prateleira decorativa mostrar todos os tipos lado a lado
   * fora do hexágono.
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
   * Id do ícone da janela e da barra de tarefas (ver `shared/appIcons.ts`). Espelha o que está em
   * `settings.json` no processo main, que é a fonte de verdade real porque o ícone precisa ser
   * conhecido já na criação da janela, antes de o renderer existir; aqui é só pra UI mostrar qual
   * está selecionado sem uma chamada IPC extra.
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
  /** Dados na bandeja ou número na hora — ver `DisplayMode`. */
  displayMode: DisplayMode
  debugMode: boolean
  /**
   * Imagem de fundo da cena (data URL base64); `null` usa a cor de fundo. Guardada como data URL
   * inteira, e não como caminho de arquivo, porque o arquivo escolhido pode estar em qualquer pasta:
   * um caminho ficaria inválido se a pessoa movesse ou apagasse o original.
   */
  backgroundImage: string | null
  /** Popup do total sobre a bandeja/torre ao assentar os dados (ver `DiceRoller3D.tsx`) — desligável porque nem todo mundo quer o efeito por cima da cena. */
  resultPopupEnabled: boolean
  /**
   * A linha copiada pro chat (spec §3.5) vai com o total em NEGRITO Markdown (`**17**`), que Discord
   * e WhatsApp renderizam. Desligado = texto puro, pra chat que mostra os asteriscos como estão.
   */
  copyMarkdown: boolean
  /** Copiar TODA rolagem sozinho, pra quem cola cada uma no chat da mesa. Desligado por padrão. */
  autoCopyRolls: boolean
  /**
   * Os efeitos de CRÍTICO e FALHA (spec §3.7), separados: o clarão na cena e o som. O som ainda
   * respeita o `soundEnabled` geral — desligar o som do app desliga este junto.
   */
  critVisualEnabled: boolean
  critSoundEnabled: boolean
  /**
   * As grades de cores prontas da aba Estilo aparecem ou ficam recolhidas. Fica aqui, e não num
   * `useState` da aba, porque a aba desmonta a cada troca de seção — recolher e voltar dois minutos
   * depois pra tudo aberto de novo é um botão que não lembra do que foi pedido.
   */
  palettesVisible: boolean
}

/** Mesmos padrões já hardcoded em `buildD6Visual`/`buildPolyhedronVisual`/`buildD4Visual` (0xf2ead6 / '#1a1a1a') e em `createScene.ts` (parede/fundo). */
const DEFAULT_SETTINGS: Settings = {
  /**
   * 'day' e não 'system' como padrão: a estética do app é a do Windows 98, que é clara por
   * natureza, e é ela que quem abre o Reroll pela primeira vez deve ver. Quem quiser acompanhar o
   * sistema escolhe — é uma opção, não uma suposição sobre o gosto de quem instalou.
   */
  themeSource: 'day',
  fontId: 'tahoma',
  language: 'pt-BR',
  soundEnabled: true,
  volume: VOLUME_PADRAO,
  compactMode: false,
  diceBodyColor: '#f2ead6',
  diceNumberColor: '#1a1a1a',
  diceMaterial: 'matte',
  resinFlower1: COR_PADRAO_DA_FLOR_1,
  resinFlower2: COR_PADRAO_DA_FLOR_2,
  glitterColor: COR_PADRAO_DO_GLITTER,
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
  // A bandeja 3D é o app; o modo rápido é escolha de quem quer, ou rede de quem precisa.
  displayMode: '3d',
  debugMode: false,
  backgroundImage: null,
  resultPopupEnabled: true,
  copyMarkdown: true,
  autoCopyRolls: false,
  critVisualEnabled: true,
  critSoundEnabled: true,
  palettesVisible: true
}

const STORAGE_KEY = 'rolador-settings'

/**
 * O que é APARÊNCIA DO PERSONAGEM e por isso é guardado por perfil (ver `shared/types/profile.ts`):
 * "os dados são customizados para o de Rodrigo, as cores, e já fica tudo salvo... mas quando eu voltar
 * pro profile do Rodrigo, volta como era antes". Tudo que não está nesta lista é preferência de quem
 * usa o programa (idioma, tema, fonte, som, ícone, câmera) e vale pra todos os personagens: ninguém
 * quer o app trocando de idioma porque mudou de ficha.
 */
const PROFILE_LOOK_KEYS = CHAVES_DA_APARENCIA

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
 * `JSON.stringify` do objeto INTEIRO, incluindo `backgroundImage`, que é uma imagem em base64 e pode
 * ter vários megabytes; os seletores de cor disparam `change` continuamente enquanto o mouse
 * arrasta, então sem espera cada pixel de arraste serializava a imagem de novo na thread da
 * interface. Só a GRAVAÇÃO espera: o estado em memória, e portanto a cena, muda na hora.
 */
const PERSIST_DEBOUNCE_MS = 300

interface SettingsContextValue extends Settings {
  /** O tema EM VIGOR — já resolvido, nunca 'system'. É o que a interface inteira lê. */
  theme: ThemeMode
  setThemeSource: (source: ThemeSource) => void
  /** Passa pra próxima opção do ciclo Dia → Noite → Sistema. */
  toggleTheme: () => void
  setFontId: (fontId: FontId) => void
  setLanguage: (language: Language) => void
  setSoundEnabled: (value: boolean) => void
  setVolume: (value: number) => void
  setCompactMode: (value: boolean) => void
  setDiceBodyColor: (value: string) => void
  setDiceNumberColor: (value: string) => void
  setDiceMaterial: (value: DiceMaterialFinish) => void
  setResinFlower1: (value: string) => void
  setResinFlower2: (value: string) => void
  setGlitterColor: (value: string) => void
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
  setDisplayMode: (value: DisplayMode) => void
  setDebugMode: (value: boolean) => void
  setBackgroundImage: (value: string | null) => void
  setResultPopupEnabled: (value: boolean) => void
  setCopyMarkdown: (value: boolean) => void
  setAutoCopyRolls: (value: boolean) => void
  setCritVisualEnabled: (value: boolean) => void
  setCritSoundEnabled: (value: boolean) => void
  setPalettesVisible: (value: boolean) => void
  resetSettings: () => void
  /**
   * A aparência do personagem ABERTO, pra ir no pacote exportado (ver `pacoteDePersonagem.ts`) —
   * é o que está valendo agora, e não o que está gravado, porque a gravação espera 300ms.
   */
  aparenciaAtual: () => AparenciaDoPersonagem
  /**
   * Grava a aparência de um personagem que ainda NÃO está aberto — o que acabou de ser importado.
   * Tem que acontecer ANTES de a lista de perfis trocar pra ele: é a troca que lê a chave dele do
   * `localStorage`, e uma chave gravada depois só valeria na próxima troca.
   */
  gravarAparenciaDe: (profileId: string, aparencia: AparenciaDoPersonagem) => void
  /** A aparência do arquivo sobre o personagem que JÁ está aberto — vale na hora, e grava como qualquer mudança. */
  aplicarAparencia: (aparencia: AparenciaDoPersonagem) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function loadInitial(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      /**
       * `sanearPreferencias` tira os campos de valor fechado que não são reconhecidos, pra caírem no
       * padrão em vez de entrar tortos. Sem isso um `trayShape` desconhecido, de uma versão em que a
       * lista era outra, leva a cena a NaN e mata a página de rolagem, sem jeito de consertar de
       * dentro do app.
       */
      const bruto = JSON.parse(raw)
      /**
       * A ordem importa: PADRÃO, depois o que estava gravado (já higienizado), e por último as
       * MIGRAÇÕES por cima — elas são a palavra final porque sabem traduzir o formato velho, e o
       * que veio do disco no formato velho é justamente o que não se deve deixar valer cru.
       */
      const merged = {
        ...DEFAULT_SETTINGS,
        ...sanearPreferencias(bruto),
        ...migrarPreferencias(bruto)
      }
      // Some com as chaves velhas que a migração já aproveitou, senão elas ficam sendo regravadas
      // pra sempre — lixo que não faz mal e que daqui a um ano ninguém sabe de onde veio.
      delete (merged as { theme?: unknown }).theme
      // `appIconId` persistido de uma versão anterior pode apontar pra um id removido (ex.: o
      // ícone branco 'rbranco') — cai pro padrão em vez de deixar a miniatura da Preferências
      // sem seleção nenhuma ou o splash tentando carregar uma imagem que não existe mais.
      if (!isValidAppIconId(merged.appIconId)) merged.appIconId = DEFAULT_SETTINGS.appIconId
      // Mesma higiene pra fonte: a lista encolheu, então quem escolheu uma das que saíram guarda um id
      // que não existe mais. Sem isto o app abriria em Tahoma (o fallback dos dois lugares que
      // consultam a lista) e continuaria gravando o id morto pra sempre.
      if (!FONT_OPTIONS.some((font) => font.id === merged.fontId)) {
        merged.fontId = DEFAULT_SETTINGS.fontId
      }
      // Só português por enquanto (ver o comentário no lugar do seletor, em `SettingsPanel.tsx`):
      // quem escolheu inglês antes volta pro português, senão fica numa língua sem botão pra sair.
      merged.language = 'pt-BR'
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

  /**
   * O tema do WINDOWS, perguntado ao próprio Chromium: não precisa de IPC nem de `nativeTheme`,
   * porque o Electron já traduz o tema do sistema pra `prefers-color-scheme` dentro da página. O
   * ouvinte é o que faz a troca valer na hora, com o app aberto. O `try` é porque `matchMedia` existe
   * em todo Chromium que interessa, mas um app que não abre por causa da preferência de tema seria um
   * preço absurdo.
   */
  const [sistemaEscuro, setSistemaEscuro] = useState(() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    } catch {
      return false
    }
  })

  useEffect(() => {
    let consulta: MediaQueryList
    try {
      consulta = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return
    }
    const aoMudar = (evento: MediaQueryListEvent): void => setSistemaEscuro(evento.matches)
    consulta.addEventListener('change', aoMudar)
    // Sincroniza uma vez: o Windows pode ter mudado entre o primeiro render e este efeito.
    setSistemaEscuro(consulta.matches)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [])

  /** A escolha resolvida pra 'day' ou 'night'. É o que o resto do app chama de `theme`. */
  const theme: ThemeMode =
    settings.themeSource === 'system' ? (sistemaEscuro ? 'night' : 'day') : settings.themeSource

  // Tema e fonte continuam aplicados na hora: são baratos (dois atributos no `<html>`) e qualquer
  // atraso aqui apareceria como a interface trocando de cara depois do clique.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const font = FONT_OPTIONS.find((f) => f.id === settings.fontId) ?? FONT_OPTIONS[0]
    document.documentElement.style.setProperty('--font-family', font.family)
  }, [theme, settings.fontId])

  // O volume vai pro módulo de áudio, que é de onde os sons leem (eles tocam fora do React).
  useEffect(() => {
    definirVolume(settings.volume)
  }, [settings.volume])

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
      theme,
      setThemeSource: (themeSource) => setSettings((prev) => ({ ...prev, themeSource })),
      /**
       * Ciclo de TRÊS, e não mais um liga/desliga: Dia → Noite → Sistema → Dia. O botão das
       * Preferências mostra em qual dos três está, então o ciclo é legível sem uma lista suspensa
       * — que é o que a tela de Preferências evita em todo campo curto.
       */
      toggleTheme: () =>
        setSettings((prev) => ({
          ...prev,
          themeSource:
            prev.themeSource === 'day' ? 'night' : prev.themeSource === 'night' ? 'system' : 'day'
        })),
      setFontId: (fontId) => setSettings((prev) => ({ ...prev, fontId })),
      setLanguage: (language) => setSettings((prev) => ({ ...prev, language })),
      setSoundEnabled: (soundEnabled) => setSettings((prev) => ({ ...prev, soundEnabled })),
      // A barrinha entrega 0 a 100; o que vier torto (NaN de um input vazio) não grava.
      setVolume: (volume) => {
        const valido = volumeValido(volume)
        if (valido !== null) setSettings((prev) => ({ ...prev, volume: valido }))
      },
      setCompactMode: (compactMode) => setSettings((prev) => ({ ...prev, compactMode })),
      setDiceBodyColor: (diceBodyColor) => setSettings((prev) => ({ ...prev, diceBodyColor })),
      setDiceNumberColor: (diceNumberColor) =>
        setSettings((prev) => ({ ...prev, diceNumberColor })),
      setDiceMaterial: (diceMaterial) => setSettings((prev) => ({ ...prev, diceMaterial })),
      setResinFlower1: (resinFlower1) => setSettings((prev) => ({ ...prev, resinFlower1 })),
      setResinFlower2: (resinFlower2) => setSettings((prev) => ({ ...prev, resinFlower2 })),
      setGlitterColor: (glitterColor) => setSettings((prev) => ({ ...prev, glitterColor })),
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
      setDisplayMode: (displayMode) => setSettings((prev) => ({ ...prev, displayMode })),
      setDebugMode: (debugMode) => setSettings((prev) => ({ ...prev, debugMode })),
      setBackgroundImage: (backgroundImage) => setSettings((prev) => ({ ...prev, backgroundImage })),
      setResultPopupEnabled: (resultPopupEnabled) =>
        setSettings((prev) => ({ ...prev, resultPopupEnabled })),
      setCopyMarkdown: (copyMarkdown) => setSettings((prev) => ({ ...prev, copyMarkdown })),
      setAutoCopyRolls: (autoCopyRolls) => setSettings((prev) => ({ ...prev, autoCopyRolls })),
      setCritVisualEnabled: (critVisualEnabled) => setSettings((prev) => ({ ...prev, critVisualEnabled })),
      setCritSoundEnabled: (critSoundEnabled) => setSettings((prev) => ({ ...prev, critSoundEnabled })),
      setPalettesVisible: (palettesVisible) => setSettings((prev) => ({ ...prev, palettesVisible })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
      aparenciaAtual: () => pickLook(settings),
      aplicarAparencia: (aparencia) =>
        setSettings((prev) => ({ ...prev, ...(sanearPreferencias(aparencia) as Partial<Settings>) })),
      gravarAparenciaDe: (profileId, aparencia) => {
        // Mesma higiene de `loadLook`: acabamento, forma e modo de lançamento desconhecidos caem fora
        // aqui, e o personagem novo fica com o que o app estava usando nesses campos.
        try {
          localStorage.setItem(lookStorageKey(profileId), JSON.stringify(sanearPreferencias(aparencia)))
        } catch (causa) {
          console.error('Falha ao gravar a aparência do personagem importado:', causa)
        }
      }
    }),
    // `theme` junto: ele é derivado do tema do sistema, então muda sem `settings` mudar — o
    // Windows escurecendo às onze da noite não passa por `setSettings`.
    [settings, theme]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings precisa ser usado dentro de um SettingsProvider')
  return ctx
}
