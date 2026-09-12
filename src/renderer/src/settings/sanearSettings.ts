import { TRAY_SHAPES } from '@renderer/dice3d/geometry/trayShape'
import { volumeValido } from '@renderer/audio/volume'

/**
 * Higiene do que veio do `localStorage`.
 *
 * As preferências são gravadas e lidas como JSON solto, e a leitura era um `as Settings` — uma promessa
 * ao compilador que ninguém verifica em tempo de execução. Funciona enquanto o arquivo tiver sido
 * escrito por ESTA versão, e é justamente isso que não se pode supor.
 *
 * O app já fazia essa higiene em dois campos, `appIconId` e `fontId`, cada um consertado depois de
 * aparecer. Os que vieram depois ficaram de fora, e o pior deles é a FORMA DA BANDEJA: um valor
 * desconhecido ali não dá erro nenhum, vira `undefined` no mapa de lados, e daí em diante é NaN.
 * Medido: apótema NaN, rotação NaN, e as posições de nascimento dos dados viram `{x: null, z: null}` —
 * a página de rolagem morre e não há botão no app que conserte, a pessoa teria que limpar o
 * `localStorage` por fora.
 *
 * Por isso a régua é: campo de VALOR FECHADO que não bate com a lista volta pro padrão. Cor, texto e
 * booleano continuam passando direto, porque errar neles é feio e não é fatal.
 */

const VALORES_FECHADOS = {
  themeSource: ['day', 'night', 'system'],
  language: ['pt-BR', 'en-US'],
  diceMaterial: ['matte', 'metallic', 'plastic', 'glass', 'resin', 'lunar'],
  launchMode: ['tray', 'tower', 'towerDecor'],
  trayShape: [...TRAY_SHAPES],
  cameraMode: ['table', 'dice', 'free'],
  displayMode: ['3d', 'quick']
} as const satisfies Record<string, readonly string[]>

/**
 * Devolve uma cópia SEM os campos de valor fechado que não são reconhecidos.
 *
 * Remove em vez de corrigir de propósito: quem chama sempre mescla isto por cima de um padrão (ou do
 * estado atual), então tirar o campo torto faz o valor bom de baixo aparecer. Corrigir aqui exigiria
 * conhecer o padrão, e este módulo não precisa conhecer.
 */
export function sanearPreferencias<T extends Record<string, unknown>>(bruto: T): Partial<T> {
  const limpo: Record<string, unknown> = { ...bruto }
  for (const [campo, aceitos] of Object.entries(VALORES_FECHADOS)) {
    if (!(campo in limpo)) continue
    const valor = limpo[campo]
    if (typeof valor !== 'string' || !(aceitos as readonly string[]).includes(valor)) {
      delete limpo[campo]
    }
  }
  /**
   * O volume é NÚMERO de faixa fechada, e errar nele é fatal do mesmo jeito que a bandeja: o
   * `HTMLMediaElement.volume` lança `IndexSizeError` fora de 0..1, e o som de rolagem dispara de
   * dentro de um `setTimeout`, onde ninguém pega o erro.
   */
  if ('volume' in limpo && volumeValido(limpo.volume) === null) delete limpo.volume
  return limpo as Partial<T>
}

/**
 * As MIGRAÇÕES de formato das preferências: campo que mudou de nome ou de forma entre versões.
 * Separada de `sanearPreferencias` porque as duas respondem perguntas diferentes — aquela pergunta
 * "este valor ainda existe?" e joga fora o que não, esta pergunta "onde isto morava antes?" e traz pra
 * cá. Recebe o objeto CRU do `localStorage`, e não o já saneado, porque o campo velho não está na
 * lista de campos conhecidos.
 */
export function migrarPreferencias(bruto: unknown): Record<string, unknown> {
  if (typeof bruto !== 'object' || bruto === null) return {}
  const entrada = bruto as Record<string, unknown>
  const migrado: Record<string, unknown> = {}

  /**
   * `theme` ('day' | 'night') virou `themeSource` ('day' | 'night' | 'system') quando o tema ganhou a
   * opção de acompanhar o Windows. A escolha de quem já usava o app TEM que atravessar: sem isto, todo
   * mundo que estava no noturno reabriria no claro depois de atualizar — não é perda grave, é daquelas
   * que fazem a pessoa desconfiar do resto. Só quando `themeSource` ainda não existe, senão toda
   * abertura desfaria a escolha mais recente.
   */
  if (!('themeSource' in entrada)) {
    const antigo = entrada.theme
    if (antigo === 'day' || antigo === 'night') migrado.themeSource = antigo
  }

  return migrado
}
