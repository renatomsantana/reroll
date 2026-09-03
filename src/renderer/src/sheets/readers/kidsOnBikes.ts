import type { PdfSheet, SheetImport, SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import { MAX_EXPLOSOES_POR_DADO } from '@shared/diceRegistry'
import { extrairGenerico, presetsSemRepetidos } from './generic'
import { fragmentosEm, r, textoImpressoEm, type Regiao } from './porPosicao'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de KIDS ON BIKES (2ª edição, em português): cada atributo é UM DADO (d4 a d20),
 * que explode no máximo; o resto é prosa (motivação, medos, fraquezas, obrigações, talentos,
 * bicicleta) e as Forças marcadas numa lista.
 *
 * A ficha que o usuário trouxe (a do Rodrigo Barreto, "Ficha Kids on Bikes - Preenchida.pdf") é
 * ARTE COM ANOTAÇÃO POR CIMA: nenhum campo de formulário, nenhum rótulo impresso (os rótulos são
 * pixel), e vinte e poucos fragmentos de texto flutuando onde o jogador digitou. Ela ficou meses
 * no leitor genérico, que a tratava como "texto sem rótulo" — três habilidades e uma lista solta
 * de "d20, d12, +1, xxxxxxxx". Ele cobrou (03/09/2026: "você tem ficha de Kids on Bikes, você
 * deveria saber"), e a resposta é a mesma das fichas da Luz Negra: o LUGAR diz o que cada texto
 * é. As regiões abaixo foram medidas na arte da ficha (`porPosicao.ts`), e é por elas que um
 * "d20" à direita, na altura de "LUTA", vira o atributo Luta.
 *
 * O que só quem conhece o sistema sabe, e é o que vira preset: o atributo se rola como o dado
 * dele MAIS o bônus escrito ao lado, EXPLODINDO (no máximo o dado rola de novo e soma); é a
 * regra central do jogo, e é por isso que o botão de explodir aparece pra este sistema
 * (`explodeDoSistema.ts`).
 */
const P1 = {
  nome: r(1, 75, 730, 205, 28),
  idade: r(1, 282, 730, 80, 28),
  arquetipo: r(1, 130, 705, 235, 25),
  motivacao: r(1, 115, 668, 250, 30),
  medos: r(1, 100, 640, 265, 28),
  fraquezas: r(1, 120, 585, 245, 50),
  obrigacoes: r(1, 120, 555, 245, 28),
  talentos: r(1, 110, 535, 255, 20),
  bicicleta: r(1, 110, 500, 255, 32),
  descricao: r(1, 40, 380, 325, 115),
  fichasDeAdversidade: r(1, 470, 465, 90, 40),
  perguntas: r(1, 30, 20, 540, 115)
}

/** Os seis atributos, em duas colunas: a caixa do dado, com o bônus pequeno logo à direita. */
const ATRIBUTOS: { nome: string; regiao: Regiao }[] = [
  { nome: 'Luta', regiao: r(1, 380, 675, 95, 50) },
  { nome: 'Fuga', regiao: r(1, 475, 675, 95, 50) },
  { nome: 'Mente', regiao: r(1, 380, 600, 95, 60) },
  { nome: 'Músculo', regiao: r(1, 475, 600, 95, 60) },
  { nome: 'Charme', regiao: r(1, 380, 525, 95, 65) },
  { nome: 'Garra', regiao: r(1, 475, 525, 95, 65) }
]

/** As Forças, na ordem da lista: coluna da esquerda (X em x≈32) e da direita (X em x≈198). */
const FORCAS: { nome: string; x: number; y: number }[] = [
  ...['Calmo sob pressão', 'Caçador de tesouros', 'Discreto', 'Durão', 'Heróico', 'Hábil em', 'Intuitivo', 'Leal'].map((nome, i) => ({ nome, x: 32, y: [339, 315, 292, 271, 248, 225, 203, 180][i] })),
  ...['Nojento', 'Preparado', 'Protetor', 'Rebelde', 'Recuperação rápida', 'Rico', 'Sortudo', 'Tranquilão'].map((nome, i) => ({ nome, x: 198, y: [339, 315, 292, 271, 248, 225, 203, 180][i] }))
]

const P2 = {
  consentimento: [
    { nome: 'Crush', x: 50, y: 735 },
    { nome: 'Namorico', x: 125, y: 735 },
    { nome: 'Compromisso', x: 230, y: 735 },
    { nome: 'Intimidade em cena', x: 365, y: 748 },
    { nome: 'Intimidade fora de cena', x: 365, y: 720 }
  ],
  relacionamentos: r(2, 30, 370, 540, 270),
  notas: r(2, 60, 120, 480, 210)
}

const GRUPOS = {
  identificacao: 'Identificação',
  atributos: 'Atributos',
  recursos: 'Recursos',
  personalidade: 'Personalidade',
  forcas: 'Forças',
  habilidades: 'Habilidades',
  inventario: 'Inventário',
  aparencia: 'Aparência',
  relacionamentos: 'Relacionamentos',
  historia: 'História'
}

const DADO = /^d(4|6|8|10|12|20)$/i
const BONUS = /^([+-])\s*(\d{1,2})$/

/** O "X" (ou "x") digitado em cima de uma caixinha: marca dentro de 16 pontos do canto dela. */
function marcada(sheet: PdfSheet, page: number, x: number, y: number): boolean {
  return sheet.texts.some((texto) => texto.page === page && /^x$/i.test(texto.text.trim()) && Math.abs(texto.x - x) <= 16 && Math.abs(texto.y - y) <= 12)
}

function confianca(sheet: PdfSheet): number {
  if (sheet.fields.length > 0) return 0
  const dados = ATRIBUTOS.filter((atributo) => fragmentosEm(sheet, atributo.regiao).some((texto) => DADO.test(texto.text.trim()))).length
  if (dados >= 4) return 0.92
  if (dados >= 2) return 0.5
  return 0
}

function extrair(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'kids-on-bikes', 'Kids on Bikes', 0.92)
  const campos: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  const push = (label: string, valor: string | null, group: string, sempre = false): void => {
    if (valor) campos.push({ label, value: valor, group })
    else if (sempre && temDono) campos.push({ label, value: '', group })
  }

  const nome = textoImpressoEm(sheet, P1.nome) ?? ''
  const temDono = nome !== ''

  push('Nome', nome || null, GRUPOS.identificacao, true)
  push('Idade', textoImpressoEm(sheet, P1.idade), GRUPOS.identificacao, true)
  push('Arquétipo', textoImpressoEm(sheet, P1.arquetipo), GRUPOS.identificacao, true)

  /**
   * ATRIBUTOS: o dado grande e o bônus pequeno na mesma caixa. O valor é a notação ("d20+1"), que
   * é o que a ficha mostra e o que a Ficha rola no clique; o preset é o mesmo dado EXPLODINDO,
   * porque é assim que Kids on Bikes rola tudo.
   */
  for (const atributo of ATRIBUTOS) {
    const fragmentos = fragmentosEm(sheet, atributo.regiao).map((texto) => texto.text.trim())
    const dado = fragmentos.find((texto) => DADO.test(texto))
    const bonus = fragmentos.map((texto) => BONUS.exec(texto)).find(Boolean)
    if (!dado) {
      push(atributo.nome, null, GRUPOS.atributos, true)
      continue
    }
    const lados = Number(dado.slice(1))
    const valorDoBonus = bonus ? Number(bonus[2]) * (bonus[1] === '-' ? -1 : 1) : 0
    const notacao = `${dado.toLowerCase()}${valorDoBonus ? (valorDoBonus > 0 ? `+${valorDoBonus}` : String(valorDoBonus)) : ''}`
    campos.push({ label: atributo.nome, value: notacao, group: GRUPOS.atributos })
    presets.push({
      name: atributo.nome,
      kind: 'test',
      expression: {
        groups: [{ sides: lados, count: 1 }],
        modifiers: valorDoBonus ? [{ type: 'flat', value: valorDoBonus }] : [],
        explode: { maxChain: MAX_EXPLOSOES_POR_DADO }
      },
      source: fragmentos.join(' ')
    })
  }

  push('Fichas de adversidade', textoImpressoEm(sheet, P1.fichasDeAdversidade), GRUPOS.recursos, true)

  push('Motivação', textoImpressoEm(sheet, P1.motivacao), GRUPOS.personalidade, true)
  push('Medos', textoImpressoEm(sheet, P1.medos), GRUPOS.personalidade, true)
  push('Fraquezas', textoImpressoEm(sheet, P1.fraquezas), GRUPOS.personalidade, true)
  push('Obrigações', textoImpressoEm(sheet, P1.obrigacoes), GRUPOS.personalidade, true)
  push('Talentos', textoImpressoEm(sheet, P1.talentos), GRUPOS.habilidades)
  push('Bicicleta', textoImpressoEm(sheet, P1.bicicleta), GRUPOS.inventario, true)
  push('Descrição', textoImpressoEm(sheet, P1.descricao), GRUPOS.aparencia)
  push('Perguntas do arquétipo', textoImpressoEm(sheet, P1.perguntas), GRUPOS.historia)

  const forcas = FORCAS.filter((forca) => marcada(sheet, 1, forca.x, forca.y)).map((forca) => forca.nome)
  push('Forças', forcas.join(', ') || null, GRUPOS.forcas, true)

  const consentimento = P2.consentimento.filter((item) => marcada(sheet, 2, item.x, item.y)).map((item) => item.nome)
  push('Consentimento', consentimento.join(', ') || null, GRUPOS.relacionamentos)
  fragmentosEm(sheet, P2.relacionamentos).forEach((texto, i) => campos.push({ label: `Relacionamento ${i + 1}`, value: texto.text.trim(), group: GRUPOS.relacionamentos }))

  /**
   * PENSAMENTOS & NOTAS (o livro da página 2), lido COLUNA A COLUNA. O livro tem duas páginas
   * lado a lado, e a leitura em ordem de página (de cima pra baixo, da esquerda pra direita)
   * entrelaça as duas: a segunda linha do "Heróico" da esquerda vinha depois da primeira do "Pegs"
   * da direita, e `camposDoTexto` cortava o parágrafo ali (medido na ficha do Rodrigo: "Heróico =
   * Você não precisa da"). Cada coluna é lida sozinha, e um parágrafo que começa com "Nome:" é uma
   * Força ou um acessório escrito por extenso (habilidade); o resto é nota.
   */
  const notas: string[] = []
  for (const coluna of [[60, 300] as const, [300, 540] as const]) {
    const linhas = fragmentosEm(sheet, P2.notas).filter((texto) => texto.x >= coluna[0] && texto.x < coluna[1])
    let paragrafo: string[] = []
    let ultimoY: number | null = null
    const fechar = (): void => {
      const texto = paragrafo.join(' ').replace(/\s+/g, ' ').trim()
      paragrafo = []
      if (!texto) return
      const par = /^([^:]{2,40}):\s*(.+)$/.exec(texto)
      if (par) campos.push({ label: par[1].trim(), value: par[2].trim(), group: GRUPOS.habilidades })
      else notas.push(texto)
    }
    for (const linha of linhas) {
      const texto = linha.text.trim()
      const novoParagrafo = /^[^:]{2,40}:\s/.test(texto) || (ultimoY !== null && ultimoY - linha.y > 22)
      if (novoParagrafo) fechar()
      paragrafo.push(texto)
      ultimoY = linha.y
    }
    fechar()
  }
  push('Pensamentos e notas', notas.join('\n') || null, GRUPOS.historia)

  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Kids on Bikes',
    warnings: base.warnings.filter((aviso) => !(nome && aviso === 'sem-nome-nem-rolagem')),
    // Tudo que a ficha tem está no mapa; os pares do genérico eram o livro cortado ao meio.
    fields: campos,
    presets: presetsSemRepetidos([...presets, ...base.presets]),
    rawText: undefined
  }
}

export const kidsOnBikesReader: SheetReader = {
  id: 'kids-on-bikes',
  label: 'Kids on Bikes',
  detect: confianca,
  extract: (sheet) => extrair(sheet)
}
