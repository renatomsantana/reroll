import type { PdfSheet, SheetImport, SheetImportField } from '@shared/types/sheetImport'
import { extrairGenerico } from './generic'
import { acesosEm, ancorasPresentes, camposEm, linhasDe, marcadasEm, r, textoEm, type Regiao } from './porPosicao'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de TENEBRA (Luz Negra Editora): o pós-pós-apocalipse de "glitter, sangue e
 * sucata". Não há atributo com número: há quatro DISPOSIÇÕES (Fôlego, Equilíbrio, Raciocínio,
 * Lucidez) alimentadas de 1 a 5 por GOTAS DE SUOR, que se gastam e se recuperam; a Barra de
 * Feridas tem seis caixas; e o resto é prosa e lista (bolsos, biosucatas, contatos, armas com a
 * sua Sina, habilidades e traços).
 *
 * A ficha editável oficial (`Ficha de Personagem Editável - Tenebra`, 02/09/2026) é arte com
 * formulário por cima, sem texto impresso, com nomes de campo automáticos (`Campo de Texto12`,
 * `Caixa de Seleção58`). Cada caixa foi medida na arte (ver `porPosicao.ts`). Duas coisas dela
 * decidem a forma deste leitor:
 *
 * 1. as GOTAS, a FADIGA, as FERIDAS, a PROTEÇÃO e o ÓLEO são BOTÕES de imagem que nascem
 *    ocultos (`fo0`…`fo19`, `fad0`…`fad3`, `fr0`…`fr5`, `tr6`…`tr8`, `Oil0`…`Oil19`) e que os
 *    botões visíveis da página MOSTRAM ou ESCONDEM por script: não há valor gravado, a gota está
 *    acesa quando o botão dela não está oculto (ver `acesosEm`). O extrator entrega esses botões
 *    no fim da lista, com a marca `PdfField.oculto`, e é a ausência da marca que conta: gotas
 *    acesas de cinco, feridas acesas de seis;
 * 2. os Bolsos são UMA caixa de texto de várias linhas ao lado de dezesseis fileiras de cinco
 *    caixinhas de Estragos. A linha N do texto é o item da fileira N: é assim que a ficha se
 *    preenche, e é assim que os estragos de cada item são lidos.
 */
const P1 = {
  nome: r(1, 74, 710, 168, 60),
  titulo: r(1, 80, 672, 71, 23),
  estirpe: r(1, 155, 682, 71, 21),
  nivel: r(1, 248, 685, 23, 22),
  bolsos: r(1, 125, 71, 167, 271),
  trecos: r(1, 354, 71, 167, 271),
  tralhas: [r(1, 77, 40, 18, 19), r(1, 111, 40, 18, 19), r(1, 147, 40, 18, 19)],
  feridas: r(1, 100, 455, 195, 35),
  protecao: r(1, 100, 410, 100, 35)
}

/** As quatro Disposições, de cima pra baixo: a fileira de gotas e a nuvem de Fadiga ao lado. */
const DISPOSICOES: { nome: string; gotas: Regiao; fadiga: Regiao }[] = [
  { nome: 'Fôlego', gotas: r(1, 125, 620, 92, 32), fadiga: r(1, 214, 622, 40, 40) },
  { nome: 'Equilíbrio', gotas: r(1, 125, 588, 92, 32), fadiga: r(1, 214, 586, 40, 40) },
  { nome: 'Raciocínio', gotas: r(1, 125, 555, 92, 32), fadiga: r(1, 214, 550, 40, 40) },
  { nome: 'Lucidez', gotas: r(1, 125, 521, 92, 32), fadiga: r(1, 214, 513, 40, 40) }
]

/** Biosucatas: quatro implantes, cada um com duas linhas de texto e cinco gotas de óleo. */
const IMPLANTES: { linhas: [Regiao, Regiao]; oleo: Regiao }[] = [
  { linhas: [r(1, 313, 516, 123, 16), r(1, 314, 504, 122, 16)], oleo: r(1, 440, 500, 85, 28) },
  { linhas: [r(1, 313, 485, 123, 16), r(1, 314, 473, 122, 16)], oleo: r(1, 440, 469, 85, 28) },
  { linhas: [r(1, 314, 454, 123, 16), r(1, 315, 441, 122, 16)], oleo: r(1, 440, 436, 85, 28) },
  { linhas: [r(1, 313, 420, 123, 16), r(1, 314, 407, 122, 16)], oleo: r(1, 440, 403, 85, 28) }
]

/** As dezesseis fileiras de Estragos dos Bolsos, de cima pra baixo (cinco caixinhas em x 67–124). */
const FILEIRAS_DE_ESTRAGOS = [322, 305, 289, 272, 255, 239, 223, 206, 188, 171, 156, 139, 122, 105, 89, 72].map((y) => r(1, 65, y, 62, 12))

const CONTATOS = [748, 721, 693, 666, 639, 612].map((y) => ({ nome: r(2, 53, y, 133, 23), utilidade: r(2, 200, y, 347, 23) }))

const ARMAS = [
  { nome: r(2, 169, 529, 139, 14), distancia: r(2, 373, 528, 167, 14), sina: r(2, 175, 509, 366, 14) },
  { nome: r(2, 170, 482, 139, 14), distancia: r(2, 374, 481, 167, 14), sina: r(2, 176, 462, 366, 14) },
  { nome: r(2, 170, 435, 139, 14), distancia: r(2, 375, 434, 167, 14), sina: r(2, 176, 415, 366, 14) }
]

const HABILIDADES = [
  [343, 318], [303, 277], [262, 236], [222, 197], [180, 155], [139, 114], [100, 74], [60, 34]
].map(([nome, descricao]) => ({ nome: r(2, 105, nome, 138, 14), descricao: r(2, 72, descricao, 465, 28) }))

const ANCORAS: Regiao[] = [P1.nome, P1.titulo, P1.estirpe, P1.nivel, P1.bolsos, P1.trecos, ...P1.tralhas]

const GRUPOS = {
  identificacao: 'Identificação',
  disposicoes: 'Disposições',
  recursos: 'Recursos',
  biosucatas: 'Biosucatas',
  contatos: 'Contatos',
  ataques: 'Armas',
  habilidades: 'Habilidades',
  inventario: 'Inventário'
}

function confianca(sheet: PdfSheet): number {
  if (sheet.fields.length < 30) return 0
  const achadas = ancorasPresentes(sheet, ANCORAS)
  if (achadas >= 6) return 0.95
  if (achadas >= 4) return 0.6
  return 0
}

function extrair(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'tenebra', 'Tenebra', 0.95)
  const campos: SheetImportField[] = []
  const consumidos = new Set<string>()
  const consumir = (regiao: Regiao): void => {
    for (const campo of camposEm(sheet, regiao)) consumidos.add(campo.name)
  }
  const pegar = (regiao: Regiao, cru = false): string | null => {
    consumir(regiao)
    return textoEm(sheet, regiao, { cru })
  }
  const push = (label: string, valor: string | null, group: string, sempre = false): void => {
    if (valor) campos.push({ label, value: valor, group })
    else if (sempre && temDono) campos.push({ label, value: '', group })
  }

  const nome = (pegar(P1.nome, true) ?? '').split(/\r?\n/)[0].trim()
  const temDono = nome !== ''

  push('Nome', nome || null, GRUPOS.identificacao, true)
  push('Título', pegar(P1.titulo), GRUPOS.identificacao, true)
  push('Estirpe', pegar(P1.estirpe), GRUPOS.identificacao, true)
  push('Nível de vivência', pegar(P1.nivel), GRUPOS.identificacao, true)

  /**
   * As Disposições como BARRAS: gotas marcadas de cinco, escritas "3/5" e nada mais, que é o que
   * `extrairRecursos` reconhece como par. É o que se gasta na sessão, então é barra, não
   * atributo (o grupo se chama "Disposições" de propósito: "Atributos" faria a Ficha tratar
   * "3/5" como valor numa escala, e a barra sumiria). A Fadiga marcada vira uma linha à parte,
   * com as Disposições fatigadas.
   */
  const fatigadas: string[] = []
  for (const disposicao of DISPOSICOES) {
    const gotas = acesosEm(sheet, disposicao.gotas, /^fo/i)
    const fadiga = acesosEm(sheet, disposicao.fadiga, /^fad/i)
    consumir(disposicao.gotas)
    consumir(disposicao.fadiga)
    if (fadiga.marcadas > 0) fatigadas.push(disposicao.nome)
    // Só com dono: o modelo em branco tem as vinte gotas vazias, e "0/5" quatro vezes não é ficha de ninguém.
    push(disposicao.nome, gotas.total > 0 && temDono ? `${gotas.marcadas}/${gotas.total}` : null, GRUPOS.disposicoes, true)
  }
  if (fatigadas.length > 0) push('Fadiga', fatigadas.join(', '), GRUPOS.disposicoes)

  const feridas = acesosEm(sheet, P1.feridas, /^fr/i)
  consumir(P1.feridas)
  if (feridas.total > 0 && temDono) push('Feridas', `${feridas.marcadas}/${feridas.total}`, GRUPOS.recursos)
  const protecao = acesosEm(sheet, P1.protecao, /^tr/i)
  consumir(P1.protecao)
  if (protecao.total > 0 && temDono) push('Proteção', `${protecao.marcadas}/${protecao.total}`, GRUPOS.recursos)

  IMPLANTES.forEach((implante, i) => {
    const texto = implante.linhas.map((linha) => pegar(linha)).filter(Boolean).join(' ')
    const oleo = acesosEm(sheet, implante.oleo, /^oil/i)
    consumir(implante.oleo)
    if (texto) push(texto, oleo.total > 0 ? `óleo ${oleo.marcadas}/${oleo.total}` : '', GRUPOS.biosucatas)
    else if (oleo.marcadas > 0) push(`Implante ${i + 1}`, `óleo ${oleo.marcadas}/${oleo.total}`, GRUPOS.biosucatas)
  })

  // Bolsos: a linha N do texto é o item da fileira N de Estragos (ver o cabeçalho).
  const itens = linhasDe(pegar(P1.bolsos, true))
  itens.forEach((item, i) => {
    const fileira = FILEIRAS_DE_ESTRAGOS[i]
    const estragos = fileira ? marcadasEm(sheet, fileira) : { marcadas: 0, total: 0 }
    campos.push({ label: item, value: estragos.marcadas > 0 ? `estragos ${estragos.marcadas}/${estragos.total}` : '', group: GRUPOS.inventario })
  })
  for (const fileira of FILEIRAS_DE_ESTRAGOS) consumir(fileira)
  for (const treco of linhasDe(pegar(P1.trecos, true))) campos.push({ label: `Sabe montar: ${treco}`, value: '', group: GRUPOS.inventario })
  const tralhas = P1.tralhas.map((regiao) => pegar(regiao))
  if (tralhas.some(Boolean)) push('Quantidade de tralhas', tralhas.map((valor) => valor ?? '0').join(' / '), GRUPOS.inventario)

  for (const contato of CONTATOS) {
    const nomeDoContato = pegar(contato.nome)
    const utilidade = pegar(contato.utilidade)
    if (nomeDoContato || utilidade) push(nomeDoContato ?? 'Contato', utilidade ?? '', GRUPOS.contatos)
  }

  for (const arma of ARMAS) {
    const nomeDaArma = pegar(arma.nome)
    const distancia = pegar(arma.distancia)
    const sina = pegar(arma.sina)
    if (!nomeDaArma && !sina) continue
    const detalhes = [distancia ? `distância ${distancia}` : '', sina ? `sina: ${sina}` : ''].filter(Boolean).join(' · ')
    push(nomeDaArma ?? 'Arma', detalhes, GRUPOS.ataques)
  }

  for (const habilidade of HABILIDADES) {
    const nomeDaHabilidade = pegar(habilidade.nome)
    const descricao = pegar(habilidade.descricao)
    if (nomeDaHabilidade || descricao) push(nomeDaHabilidade ?? 'Habilidade', descricao ?? '', GRUPOS.habilidades)
  }

  const restantes = base.fields.filter((campo) => !campo.fieldName || !consumidos.has(campo.fieldName))
  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Tenebra',
    // O genérico não achou nome nem rolagem (não há rótulo que diga "nome"); este leitor achou.
    warnings: base.warnings.filter((aviso) => !(nome && aviso === 'sem-nome-nem-rolagem')),
    fields: [...campos, ...restantes],
    rawText: undefined
  }
}

export const tenebraReader: SheetReader = {
  id: 'tenebra',
  label: 'Tenebra',
  detect: confianca,
  extract: (sheet) => extrair(sheet)
}
