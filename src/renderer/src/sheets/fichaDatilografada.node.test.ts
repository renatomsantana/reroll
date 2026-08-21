import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { pdfDeUmaPagina } from './testes/pdfDeMentira'

/**
 * A ficha SEM FORMULÁRIO NENHUM — texto impresso e mais nada.
 *
 * É metade do mundo real: quem não usa o PDF editável do sistema escreve a ficha no Word, no Google
 * Docs ou no bloco de notas e exporta. Não há campo pra ler, só linhas "Rótulo: valor" e blocos de
 * texto — e é a única coisa que o app recebe de quem joga um sistema pequeno, caseiro ou traduzido.
 *
 * As fichas de referência não cobrem isto: duas têm formulário e a de Kids on Bikes é uma ARTE com
 * anotação por cima, que é outro caso (texto esparso, sem rótulo escrito, ver
 * `anotacoesSobreImagem.ts`).
 *
 * O defeito que este arquivo trava: o app propunha o nome do ARQUIVO como nome do personagem
 * ("cthulhu") tendo lido "Nome: Elias Ramos" na segunda linha. O palpite de nome deste caminho
 * olhava só o primeiro parágrafo da página — que numa ficha datilografada é o TÍTULO, longo demais
 * pra passar no filtro — e ignorava os campos que ele mesmo tinha acabado de extrair.
 */

const LINHAS = [
  'FICHA DE INVESTIGADOR - Chamado de Cthulhu',
  'Nome: Elias Ramos',
  'Ocupacao: Jornalista',
  'Idade: 34',
  'Residencia: Sao Paulo',
  'FOR 55   DES 60   INT 75',
  'CON 50   APA 45   POD 65',
  'TAM 65   EDU 80   SOR 40',
  'Pontos de Vida: 11',
  'Sanidade: 65',
  'Pericias',
  'Achar 70   Persuasao 55   Historia 60',
  'Armas',
  'Revolver .38  dano 1d10',
  'Cassetete  dano 1d6+1',
  'Notas: Ele nunca dorme direito desde a viagem a Arkham.'
]

async function importarDatilografada(nomeDoArquivo = 'cthulhu.pdf') {
  const bytes = pdfDeUmaPagina({
    linhas: LINHAS.map((texto, i) => ({ texto, x: 60, y: 740 - i * 22 }))
  })
  return readSheet(await abrirPdfDeBytes(nomeDoArquivo, bytes))
}

describe('ficha datilografada, sem campos de formulário', () => {
  it('propõe o nome ESCRITO na ficha, e não o nome do arquivo', async () => {
    const lido = await importarDatilografada('cthulhu.pdf')
    expect(lido.characterName).toBe('Elias Ramos')
  })

  it('o nome do arquivo continua sendo o último recurso, não o primeiro', async () => {
    /**
     * Sem nenhuma linha que diga o nome, cair no arquivo é razoável — é melhor que campo vazio, e a
     * tela de conferência deixa corrigir. O que não pode é ele GANHAR de um nome escrito na ficha.
     */
    const bytes = pdfDeUmaPagina({
      linhas: [
        { texto: 'Anotacoes da sessao de ontem', x: 60, y: 740 },
        { texto: 'Compramos corda e lampiao no armazem.', x: 60, y: 718 }
      ]
    })
    const lido = readSheet(await abrirPdfDeBytes('Elias - ficha.pdf', bytes))
    expect(lido.characterName).toBe('Elias - ficha')
  })

  it('as linhas "Rótulo: valor" viram campos com rótulo e valor separados', async () => {
    const lido = await importarDatilografada()
    const porRotulo = new Map(lido.fields.map((c) => [c.label, c.value]))
    expect(porRotulo.get('Nome')).toBe('Elias Ramos')
    expect(porRotulo.get('Ocupacao')).toBe('Jornalista')
    expect(porRotulo.get('Idade')).toBe('34')
    expect(porRotulo.get('Sanidade')).toBe('65')
  })

  it('as armas escritas no texto viram presets com a expressão certa', async () => {
    const lido = await importarDatilografada()
    const revolver = lido.presets.find((p) => p.source.includes('1d10'))
    const cassetete = lido.presets.find((p) => p.source.includes('1d6'))

    expect(revolver?.expression.groups).toEqual([{ sides: 10, count: 1 }])
    expect(cassetete?.expression.groups).toEqual([{ sides: 6, count: 1 }])
    expect(cassetete?.expression.modifiers).toEqual([{ type: 'flat', value: 1 }])
    // Nomes distintos: dois botões iguais na lista de presets são dois botões inúteis.
    expect(revolver?.name).not.toBe(cassetete?.name)
  })

  it('o texto sem rótulo não é jogado fora — fica no bruto pra pessoa aproveitar', async () => {
    const lido = await importarDatilografada()
    expect(lido.rawText).toContain('FOR 55')
    expect(lido.rawText).toContain('Achar 70')
  })

  it('avisa que a leitura é um palpite — ficha sem formulário nunca é certeza', async () => {
    const lido = await importarDatilografada()
    expect(lido.warnings.length).toBeGreaterThan(0)
  })
})
