import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfDeBytes } from './testes/abrirPdfNoNode'
import { pdfDeUmaPagina, widget } from './testes/pdfDeMentira'

/**
 * Uma ficha de um sistema que o app NUNCA VIU.
 *
 * As fichas de referência (`fichasReais.node.test.ts`) têm leitor dedicado ou já foram calibradas.
 * Este arquivo cobre o pedido literal do usuário — "qualquer pessoa com o app possa uploadar seus
 * PDFs e funcionem normalmente" — com um formulário de um sistema INVENTADO, cujos nomes de campo
 * (`ALMA`, `Arma1 Dano`, `PVatual`) nenhum leitor daqui conhece. Quem atende é o genérico.
 *
 * O fixture já foi o formulário oficial de D&D 5e, e mudou quando o D&D ganhou leitor próprio: com
 * um leitor dedicado no meio, este arquivo deixaria de exercitar o genérico e passaria a testar o
 * outro — que é justamente o caminho que ESTE teste não cobre. Um sistema inventado não corre esse
 * risco de virar conhecido.
 *
 * O que ele pegou, e é o que estas asserções travam: o rótulo impresso era distribuído SEM
 * exclusividade, então um mesmo texto virava rótulo de vários campos — "NOME DO PERSONAGEM"
 * rotulava o nome, o nome do JOGADOR e o primeiro atributo; e as duas armas viravam dois presets
 * com o mesmo nome, indistinguíveis na lista.
 *
 * Rótulo errado é pior que rótulo nenhum: o valor chega na tela de conferência com cara de certo, e
 * quem importa não tem como desconfiar de "Vigor = 8" estar escrito embaixo de "Nome do
 * personagem".
 */

/**
 * Um formulário de sistema desconhecido, com os espaços tortos nos nomes que exportador de PDF
 * produz de verdade (`Linhagem `, `Arma2 Acerto `). Eles não são enfeite do teste: nome de campo com
 * espaço sobrando é rotina em ficha publicada, e é o tipo de coisa que faz um casamento por
 * igualdade crua perder metade da ficha.
 */
const CAMPOS: [string, string][] = [
  ['NomeDoHeroi', 'Thalia Corvo'],
  ['CastaNivel', 'Bruxa 5'],
  ['Procedencia', 'Forasteira'],
  ['NomeDoJogador', 'Renato'],
  ['Linhagem ', 'Meio-elfa'],
  ['Postura', 'Caotica e boa'],
  ['VIGOR', '8'],
  ['REFLEXO', '16'],
  ['COURO', '14'],
  ['ENGENHO', '12'],
  ['INSTINTO', '10'],
  ['ALMA', '18'],
  ['Talento', '+3'],
  ['Guarda', '15'],
  ['Iniciativa', '+3'],
  ['Passada', '9m'],
  ['PVmaximo', '38'],
  ['PVatual', '31'],
  ['Arma1 Nome', 'Adaga'],
  ['Arma1 Acerto', '+6'],
  ['Arma1 Dano', '1d4+3 perfurante'],
  ['Arma2 Nome', 'Rajada Sobrenatural'],
  ['Arma2 Acerto ', '+7'],
  ['Arma2 Dano ', '1d10 de energia'],
  ['Dons', 'Presenca sobrenatural. Visao no escuro 18m.'],
  ['Bagagem', 'Adaga, foco arcano, mochila, corda de canhamo']
]

/**
 * Poucos rótulos impressos, de propósito: é assim que se parece uma ficha que o app não conhece —
 * alguns títulos de seção e muitos campos sem texto próprio ao lado. É exatamente a situação em que
 * um campo rouba o rótulo do vizinho.
 */
const ROTULOS = [
  { texto: 'NOME DO PERSONAGEM', x: 40, y: 740 },
  // Os títulos impressos são propositalmente DIFERENTES dos nomes de campo: se um texto impresso
  // coincidisse com o nome de um campo, não daria pra saber se um rótulo veio do papel ou do
  // recuo pro nome do campo — e é justamente essa diferença que estes testes medem.
  { texto: 'VIGOR FISICO', x: 40, y: 660 },
  { texto: 'REFLEXOS RAPIDOS', x: 40, y: 620 },
  { texto: 'ARMAS E CONJURACOES', x: 200, y: 500 }
]

async function importarFichaDesconhecida() {
  const bytes = pdfDeUmaPagina({
    widgets: CAMPOS.map(([nome, valor], i) =>
      widget(
        nome,
        valor,
        `[${40 + (i % 3) * 180} ${740 - Math.floor(i / 3) * 26} ${170 + (i % 3) * 180} ${756 - Math.floor(i / 3) * 26}]`
      )
    ),
    linhas: ROTULOS
  })
  return readSheet(await abrirPdfDeBytes('ficha-desconhecida.pdf', bytes))
}

describe('ficha de um sistema desconhecido', () => {
  it('cai no leitor genérico, sem nenhum leitor dedicado reivindicá-la', async () => {
    const lido = await importarFichaDesconhecida()
    expect(lido.readerId).toBe('generico')
    // E sem inventar sistema: dizer "D&D 5e" aqui seria pior que não dizer nada.
    expect(lido.system).toBe('')
  })

  it('nenhum rótulo IMPRESSO é usado por mais de um campo', async () => {
    const lido = await importarFichaDesconhecida()
    const impressos = ROTULOS.map((r) => r.texto)
    for (const impresso of impressos) {
      const quantos = lido.fields.filter((c) => c.label === impresso).length
      expect(quantos, `"${impresso}" rotulou ${quantos} campos`).toBeLessThanOrEqual(1)
    }
  })

  it('campo que perdeu o rótulo cai no próprio nome, e não no rótulo do vizinho', async () => {
    const lido = await importarFichaDesconhecida()
    const porValor = new Map(lido.fields.map((c) => [c.value, c.label]))
    // O nome do JOGADOR não pode aparecer como "nome do personagem".
    expect(porValor.get('Renato')).toBe('NomeDoJogador')
    expect(porValor.get('8')).toBe('VIGOR')
    expect(porValor.get('31')).toBe('PVatual')
    expect(porValor.get('Adaga')).toBe('Arma1 Nome')
  })

  it('as duas armas viram presets DISTINGUÍVEIS na lista', async () => {
    const lido = await importarFichaDesconhecida()
    const nomes = lido.presets.map((p) => p.name)
    expect(nomes).toHaveLength(2)
    expect(new Set(nomes).size).toBe(2)
    // As expressões também têm que ser as das armas, não uma só repetida.
    const expressoes = lido.presets.map((p) => JSON.stringify(p.expression))
    expect(new Set(expressoes).size).toBe(2)
  })

  it('o nome do personagem é proposto a partir do campo certo', async () => {
    const lido = await importarFichaDesconhecida()
    expect(lido.characterName).toBe('Thalia Corvo')
  })

  it('nenhum campo é rotulado com nome automático de exportador', async () => {
    const lido = await importarFichaDesconhecida()
    for (const campo of lido.fields) {
      // `Bns1.14`, `Atq1.0.0.2.1`, `1_2` — posição na grade não é rótulo de nada.
      expect(campo.label).not.toMatch(/^[A-Za-zÀ-ú]+\d*(\.\d+)+$/)
      expect(campo.label).not.toMatch(/^\d+(_\d+)?$/)
    }
  })
})
