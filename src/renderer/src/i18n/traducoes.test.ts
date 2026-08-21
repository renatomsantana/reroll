import { describe, expect, it } from 'vitest'
import { translations } from './translations'

/**
 * O APP EM INGLÊS ESTÁ MESMO EM INGLÊS?
 *
 * O TypeScript já garante que os dois dicionários têm as MESMAS CHAVES — `TranslationDict` é um
 * tipo, e uma chave nova sem par não compila. O que ele não vê é o conteúdo: um valor copiado de
 * cima e não traduzido tem o tipo certo e o idioma errado, e passa por toda a compilação sem um
 * arranhão.
 *
 * Isso não é hipótese. O projeto já teve exatamente esse defeito em escala: os avisos do importador
 * de ficha eram frases escritas em português DENTRO dos leitores, e quem usava a interface em inglês
 * abria a tela de conferência e encontrava um parágrafo em português explicando o que o app não
 * tinha conseguido ler — justamente a mensagem que mais precisa ser entendida.
 *
 * O teste é bobo de propósito: compara os dois lados e cobra explicação pra cada valor idêntico.
 */

type Plano = { caminho: string; pt: string; en: string }

/** Achata os dois dicionários lado a lado, pra comparar folha por folha. */
function achatar(pt: unknown, en: unknown, caminho = ''): Plano[] {
  if (typeof pt === 'string' && typeof en === 'string') return [{ caminho, pt, en }]
  if (typeof pt !== 'object' || pt === null || typeof en !== 'object' || en === null) return []
  return Object.keys(pt as Record<string, unknown>).flatMap((chave) =>
    achatar(
      (pt as Record<string, unknown>)[chave],
      (en as Record<string, unknown>)[chave],
      caminho ? `${caminho}.${chave}` : chave
    )
  )
}

const plano = achatar(translations['pt-BR'], translations['en-US'])

/**
 * Os valores que SÃO iguais nos dois idiomas de propósito, com o motivo.
 *
 * Cada entrada aqui é uma decisão, não uma exceção — a lista curta é o que mantém o teste útil.
 */
const IGUAIS_DE_PROPOSITO = new Map<string, string>([
  ['appTitle', 'nome do app'],
  ['credit', 'assinatura do autor'],
  ['roller.mode.normal', '"Normal" se escreve igual nos dois'],
  ['roller.explode', 'emoji + "Explode", que é a mesma palavra'],
  ['presetEditor.explode', 'idem'],
  ['roller.modifier', '"Mod:" é a mesma abreviação nos dois'],
  ['roller.total', '"Total" se escreve igual nos dois'],
  ['presets.title', '"Presets" já é o termo usado em português no jargão de RPG'],
  ['sheetImport.presetsTitle', 'idem'],
  ['styleTab.hex', '"Hex", do código de cor — igual nos dois'],
  [
    'notesTab.backstoryBlock',
    '"Backstory" é como a mesa fala em português; traduzir pra "História" confundiria com o bloco de história'
  ],
  ['notesTab.dayCounter', 'só marcadores: "{current}/{total}", sem palavra nenhuma']
])

describe('o dicionário em inglês', () => {
  it('cobre o mesmo conjunto de textos que o português', () => {
    // Se isto falhar, a estrutura divergiu — o tipo deveria ter pegado antes, mas um `as` perdido
    // no meio do arquivo é suficiente pra abrir esse buraco.
    expect(plano.length).toBeGreaterThan(150)
    for (const { caminho, en } of plano) {
      expect(en, `faltou traduzir ${caminho}`).toBeTypeOf('string')
    }
  })

  it('não tem texto em português esquecido do lado inglês', () => {
    const suspeitos = plano
      .filter(({ caminho, pt, en }) => pt === en && pt.trim() !== '' && !IGUAIS_DE_PROPOSITO.has(caminho))
      .map(({ caminho, pt }) => `${caminho}: ${JSON.stringify(pt)}`)

    expect(
      suspeitos,
      'Estes textos são idênticos nos dois idiomas. Traduza, ou registre em `IGUAIS_DE_PROPOSITO` com o motivo.'
    ).toEqual([])
  })

  it('não sobrou acento onde deveria ser inglês', () => {
    /**
     * Uma segunda rede, pro caso do texto QUASE traduzido — meia frase em inglês e uma palavra em
     * português no meio, que a comparação de igualdade não pega. O inglês não usa acento, então
     * qualquer um é sinal.
     *
     * As exceções são nomes próprios e o que é intencionalmente idêntico.
     */
    const comAcento = plano
      .filter(({ caminho, en }) => /[áàâãéêíóôõúüç]/i.test(en) && !IGUAIS_DE_PROPOSITO.has(caminho))
      .map(({ caminho, en }) => `${caminho}: ${JSON.stringify(en)}`)

    expect(comAcento, 'Texto com acento no dicionário em inglês.').toEqual([])
  })

  it('marcadores de substituição sobrevivem à tradução', () => {
    /**
     * `{n}`, `{path}`, `{max}` — a interface troca esses pedaços por valores em tempo de execução.
     * Um que se perca na tradução vira uma frase com um buraco ("Delete ?"), e um que apareça só do
     * lado inglês nunca é substituído e chega ao usuário como está escrito.
     */
    const marcador = /\{[a-zA-Z]+\}/g
    const divergentes = plano
      .filter(({ pt, en }) => {
        const nosDois = (texto: string) => [...texto.matchAll(marcador)].map((m) => m[0]).sort().join(',')
        return nosDois(pt) !== nosDois(en)
      })
      .map(({ caminho, pt, en }) => `${caminho}: pt=${JSON.stringify(pt)} en=${JSON.stringify(en)}`)

    expect(divergentes, 'Marcadores diferentes entre os dois idiomas.').toEqual([])
  })
})
