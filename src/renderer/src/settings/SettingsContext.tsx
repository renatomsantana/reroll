import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useProfiles } from './ProfilesContext'
import type { DiceMaterialFinish } from '@renderer/dice3d/materials/createDiceMaterial'
import type { TrayShape } from '@renderer/dice3d/geometry/trayShape'
import { migrarPreferencias, sanearPreferencias } from './sanearSettings'
import { DEFAULT_APP_ICON_ID, isValidAppIconId } from '@shared/appIcons'
import type { Language } from '@shared/types/idioma'

export type ThemeMode = 'day' | 'night'

/**
 * O que a pessoa ESCOLHEU, que é diferente do tema que está valendo agora.
 *
 * `'system'` é a terceira opção, e ela existe porque um app que fica aberto ao lado do Discord a
 * noite inteira deveria escurecer junto com o Windows, e não ficar sendo o único retângulo branco da
 * tela às onze da noite.
 *
 * A distinção entre ESCOLHA e EFEITO é o que faz isso funcionar sem espalhar condicional pelo app:
 * `themeSource` é o que se guarda, `theme` continua sendo 'day' ou 'night' e é o que todo o resto lê
 * (inclusive o `data-theme` no `<html>`, de onde sai o CSS inteiro). Nada que consumia `theme`
 * precisou saber que esta opção passou a existir.
 */
export type ThemeSource = ThemeMode | 'system'
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
 * COMO O RESULTADO APARECE — a escolha que a spec pede em 2.3.
 *
 * - `3d`: os dados caem na bandeja e o resultado é o que eles mostram. É o app;
 * - `quick`: o número na hora, sem física e sem espera. O mesmo cálculo, feito por
 *   `rollExpression` em vez de por dados de verdade.
 *
 * O modo rápido não é uma versão pobre: ele resolve três coisas ao mesmo tempo. É o que a pessoa
 * quer numa mesa corrida (o mestre esperando pelo número), é o que o modo compacto já fazia por
 * conta própria, e é a REDE de quem não tem WebGL utilizável — sem ele, essa máquina não rola dado
 * nenhum (ver `webglDisponivel.ts` e o requisito 5.8 da spec).
 */
export type DisplayMode = '3d' | 'quick'

/**
 * CATORZE fontes: doze no fechamento do alfa, mais a Sweetie e a Algerian, pedidas logo depois.
 *
 * A Parisienne e a Hello Honey chegaram a entrar junto da Sweetie e SAÍRAM a pedido do usuário no
 * mesmo dia — é por isso que `assets/fonts/` não tem mais nenhum arquivo de manuscrita.
 *
 * A lista já teve dezoito e foi ENCURTADA a pedido do usuário — saíram MS Sans Serif, Verdana,
 * Trebuchet, Candara, Georgia, Palatino, Consolas e OpenDyslexic. Menu de fonte longo não é menu
 * melhor: metade das que saíram eram variações quase indistinguíveis das que ficaram, e escolher
 * fica mais fácil com menos.
 *
 * Quem tiver uma das removidas gravada nas preferências cai no padrão na próxima abertura (ver
 * `loadInitial`), e quem tiver uma delas gravada numa ANOTAÇÃO cai em "fonte padrão" no seletor do
 * bloco (ver `familyToFontId` em `NotesTab.tsx`) — os dois caminhos já existiam, justamente porque
 * esta lista já encolheu antes.
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
 * 2. Fonte que NÃO vem no Windows precisa de um de dois tratamentos, e o que decide é a LICENÇA.
 *    Montserrat, JetBrains Mono e Lora são OFL: entram empacotadas em `assets/fonts/`, com a
 *    licença ao lado e um par de `@font-face` no `global.css`. Janda Silly Monkey e Sweetie são
 *    gratuitas só pra uso pessoal: entram só como NOME, e quem não as tiver instaladas vê o
 *    reserva. Fonte de fora sem um dos dois tratamentos cai no reserva calada.
 * 3. Fonte que só vem com o OFFICE (Century Gothic, Garamond) entra apenas se alguém a pedir pelo
 *    nome, e nunca por iniciativa de quem mexe aqui: na máquina sem Office ela vira outra coisa sem
 *    avisar, e quem escolheu não descobre por quê. A regra era "não entra" até a ALGERIAN ser
 *    pedida (ver mais abaixo) — ela é a única exceção, e o reserva dela é que faz a exceção custar
 *    pouco. Não use a existência dela como precedente para a próxima.
 */
export const FONT_OPTIONS = [
  { id: 'tahoma', label: 'Tahoma (clássica)', family: "Tahoma, 'MS Sans Serif', Geneva, sans-serif" },
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
  { id: 'courier', label: 'Courier New', family: "'Courier New', Courier, monospace" },
  // Empacotada (`global.css`). Reserva na Consolas e na Courier — as duas monoespaçadas que o
  // Windows garante. A Consolas saiu do MENU, mas continua existindo no sistema, então segue sendo
  // um reserva legítimo: a regra é a cadeia não terminar em outra opção DESTA lista, e ela não é mais.
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
  /**
   * A opção AMIGÁVEL A DISLÉXICOS da lista — e o rótulo NÃO diz isso, a pedido do usuário.
   *
   * O rótulo já foi "Comic Sans (p/ dislexia)". A explicação saiu, a fonte fica: a Comic Sans é
   * recomendada com frequência pra leitura com dislexia, porque as letras têm formas irregulares o
   * bastante pra reduzir a troca de b/d/p/q, que é a confusão mais comum. Não é remédio e não
   * funciona pra todo mundo; é por isso que ela entra como opção, não como padrão.
   *
   * Este comentário fica no lugar do rótulo. Sem ele, a Comic Sans vira só "a fonte de piada" da
   * lista e some na próxima limpeza — e com ela some a única opção que cobre o requisito. A
   * OpenDyslexic, desenhada especificamente pra isso, chegou a entrar e SAIU a pedido do usuário
   * junto de outras sete; a Comic Sans ficou e vem com o Windows, então cobre sem empacotar arquivo.
   */
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
  },
  /**
   * SWEETIE — manuscrita, pedida pelo usuário e NÃO EMPACOTADA, pelo mesmo motivo da Janda Silly
   * Monkey logo acima: ela é da Graphix Line Studio, gratuita apenas para USO PESSOAL, e vende
   * licença comercial à parte. Pôr o arquivo dentro de um app publicado no GitHub seria
   * redistribuição, e a licença não cobre isso.
   *
   * O que existe aqui é só o NOME da família. Quem tiver a fonte instalada no Windows vê a fonte;
   * quem não tiver cai no reserva — e por isso o reserva dela importa de verdade, ao contrário do
   * das empacotadas.
   *
   * `Segoe Script` é o reserva: vem com o Windows desde o Vista, é manuscrita conectada (que é o
   * que a Sweetie é) e, principalmente, NÃO é opção deste menu. A `Ink Free` já é o reserva da Janda
   * e da Papyrus, mas ela é uma manuscrita solta, de traço mais grosso — a Segoe Script fica mais
   * perto do desenho de script fino da Sweetie.
   */
  { id: 'sweetie', label: 'Sweetie', family: "Sweetie, 'Segoe Script', cursive" },
  /**
   * ALGERIAN — decorativa, de caixa alta, pedida pelo usuário com o crédito do pedro.
   *
   * Ela é a EXCEÇÃO da regra 3 lá em cima, e entra sabendo disso. A Algerian não vem com o Windows:
   * vem com o Microsoft Office desde 1993, o que é outra coisa. Conferido na máquina do usuário no
   * dia em que ela foi pedida — 154 fontes instaladas, e a Algerian não estava entre elas.
   *
   * Empacotar não é opção: ela é comercial (Letraset/URW, vendida avulsa), não é OFL como a Lora
   * nem "grátis pra uso pessoal" como a Sweetie. O que existe aqui é só o NOME, então quem não
   * tiver Office vê o reserva — e por isso o reserva dela é a parte que importa.
   *
   * `Arial Black` é o reserva, e a escolha tem duas contas:
   *
   * - ela vem com o Windows, então existe mesmo na máquina limpa;
   * - ela NÃO é opção deste menu. A `Impact` seria o parente visual mais próximo da Algerian (as
   *   duas são display pesadas), mas a Impact está na lista logo acima — e cair numa fonte do
   *   próprio menu é exatamente o bug do Papyrus, onde escolher uma dava visivelmente a outra.
   *
   * A `Arial Black` não se confunde com a `Arial` do menu: uma é preta e condensada, a outra é
   * regular. São famílias diferentes, e a distinção é visível na primeira palavra.
   */
  {
    id: 'algerian',
    label: 'Algerian',
    family: "Algerian, 'Arial Black', fantasy",
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
  /** Dados na bandeja ou número na hora — ver `DisplayMode`. */
  displayMode: DisplayMode
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
  /**
   * 'day' e não 'system' como padrão: a estética do app é a do Windows 98, que é clara por
   * natureza, e é ela que quem abre o Reroll pela primeira vez deve ver. Quem quiser acompanhar o
   * sistema escolhe — é uma opção, não uma suposição sobre o gosto de quem instalou.
   */
  themeSource: 'day',
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
  // A bandeja 3D é o app; o modo rápido é escolha de quem quer, ou rede de quem precisa.
  displayMode: '3d',
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
  /** O tema EM VIGOR — já resolvido, nunca 'system'. É o que a interface inteira lê. */
  theme: ThemeMode
  setThemeSource: (source: ThemeSource) => void
  /** Passa pra próxima opção do ciclo Dia → Noite → Sistema. */
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
  setDisplayMode: (value: DisplayMode) => void
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

  /**
   * O tema do WINDOWS, perguntado ao próprio Chromium.
   *
   * Não precisa de IPC nem de `nativeTheme`: o Electron já traduz o tema do sistema pra
   * `prefers-color-scheme` dentro da página. O ouvinte é o que faz a troca valer NA HORA — a pessoa
   * muda o Windows pro escuro com o Reroll aberto e o app acompanha, sem reabrir.
   *
   * O `try` é pela mesma razão de sempre: `matchMedia` existe em todo Chromium que nos interessa,
   * mas um app que não abre por causa da preferência de tema seria um preço absurdo.
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
      setDisplayMode: (displayMode) => setSettings((prev) => ({ ...prev, displayMode })),
      setDebugMode: (debugMode) => setSettings((prev) => ({ ...prev, debugMode })),
      setBackgroundImage: (backgroundImage) => setSettings((prev) => ({ ...prev, backgroundImage })),
      setResultPopupEnabled: (resultPopupEnabled) =>
        setSettings((prev) => ({ ...prev, resultPopupEnabled })),
      setPalettesVisible: (palettesVisible) => setSettings((prev) => ({ ...prev, palettesVisible })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS)
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
