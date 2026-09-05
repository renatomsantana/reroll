import type { PdfSheet, SheetImport, SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import { parseDiceExpression, parseTestBonus } from '@shared/dice/parseDiceExpression'
import { extrairGenerico, presetsSemRepetidos } from './generic'
import { ancorasPresentes, camposEm, marcadasEm, r, textoEm, type Regiao } from './porPosicao'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de BREU (Luz Negra Editora): fantasia sombria de escola velha sobre a base da
 * quinta edição de D&D. Seis atributos com valor e modificador, Testes de Resistência por atributo
 * (marcados como proficientes), Bônus de Proficiência, CA em quatro proteções (sem armadura, com
 * armadura, com escudo, com magia), PV e Dados de Vida, Debilidades com consequências, Benefícios
 * de Classe, carga em pontos, e a magia por círculos com Teste Mágico e Potência Mágica.
 *
 * O Pack de Fichas oficial (02/09/2026) traz três modelos editáveis com a MESMA diagramação da
 * frente (Geral, Magias em Detalhes, Não Conjuradores), nomeados por máquina (`Text1.0.1.0.1…`,
 * `Check Box2.5.1.1…`). Os rótulos estão impressos, mas a grade é apertada demais pro rótulo
 * mais próximo acertar sempre ("TR" aparece seis vezes, "Arma" duas, "Carga" oito), então a
 * leitura é pela POSIÇÃO, medida no modelo Geral (ver `porPosicao.ts`). O que não estiver no mapa
 * (uma variante com um bloco a mais) entra pelo genérico, com o rótulo impresso mais perto.
 */
const ATRIBUTOS = [
  { nome: 'Força', sigla: 'FOR', valor: r(1, 45, 547, 40, 33), mod: r(1, 49, 507, 31, 24), tr: r(1, 61, 534, 9, 9) },
  { nome: 'Destreza', sigla: 'DES', valor: r(1, 105, 548, 40, 32), mod: r(1, 110, 507, 31, 24), tr: r(1, 121, 534, 9, 9) },
  { nome: 'Constituição', sigla: 'CON', valor: r(1, 166, 548, 40, 32), mod: r(1, 170, 507, 31, 24), tr: r(1, 181, 534, 9, 9) },
  { nome: 'Inteligência', sigla: 'INT', valor: r(1, 226, 548, 40, 32), mod: r(1, 230, 507, 31, 24), tr: r(1, 242, 534, 9, 9) },
  { nome: 'Sabedoria', sigla: 'SAB', valor: r(1, 286, 548, 40, 32), mod: r(1, 291, 507, 31, 24), tr: r(1, 302, 534, 9, 9) },
  { nome: 'Carisma', sigla: 'CAR', valor: r(1, 347, 548, 40, 32), mod: r(1, 351, 507, 31, 24), tr: r(1, 362, 534, 9, 9) }
]

const P1 = {
  nome: r(1, 60, 682, 266, 17),
  classe: r(1, 356, 682, 131, 17),
  xp: r(1, 499, 682, 56, 17),
  euSou: r(1, 88, 664, 152, 17),
  bomEm: r(1, 281, 664, 274, 17),
  emBuscaDe: r(1, 88, 647, 468, 17),
  heranca: [r(1, 116, 629, 439, 17), r(1, 40, 612, 516, 17)],
  proficiencia: r(1, 100, 463, 28, 21),
  protecoes: [
    { nome: 'CA sem armadura', regiao: r(1, 181, 467, 24, 17) },
    { nome: 'CA com armadura', regiao: r(1, 208, 467, 24, 17) },
    { nome: 'CA com escudo', regiao: r(1, 235, 467, 24, 17) },
    { nome: 'CA com magia', regiao: r(1, 264, 467, 24, 17) }
  ],
  deslocamento: r(1, 304, 467, 87, 17),
  pvMaximo: r(1, 76, 429, 35, 17),
  pvAtual: r(1, 112, 429, 35, 17),
  dadosDeVida: r(1, 192, 429, 100, 17),
  dvUsados: r(1, 300, 429, 89, 17),
  cargaMaxima: r(1, 415, 430, 33, 17),
  cargaZero: r(1, 452, 430, 33, 17),
  cargaAtual: r(1, 493, 430, 25, 17),
  prata: r(1, 339, 387, 50, 17),
  debilidades: [567, 550, 532, 515].map((y) => ({ texto: r(1, 414, y, 73, 17), marcas: r(1, 486, y + 3, 34, 12) })),
  beneficios: [369, 352, 334, 317, 299, 281, 264, 246, 229, 211].map((y) => r(1, 49, y, 350, 17)),
  vestimentas: [r(1, 408, 371, 149, 17), r(1, 408, 354, 149, 17)],
  vestidos: [
    { nome: 'Mochila', y: 314 },
    { nome: 'Armadura', y: 271 },
    { nome: 'Escudo', y: 233 }
  ].map((item) => ({ nome: item.nome, texto: r(1, 408, item.y, 113, 17), carga: [r(1, 523, item.y, 16, 17), r(1, 542, item.y, 16, 17)] })),
  itensAMao: [182, 165, 147, 130, 112, 95].map((y) => ({ texto: r(1, 408, y, 113, 17), carga: [r(1, 523, y, 16, 17), r(1, 542, y, 16, 17)] })),
  consumiveisAMao: [46, 28].map((y) => ({ texto: r(1, 408, y, 50, 17), marcas: r(1, 458, y, 100, 12) })),
  corpoACorpo: [154, 136, 119].map((y) => ({ arma: r(1, 38, y, 128, 16), mod: r(1, 168, y, 30, 16), dano: r(1, 199, y, 45, 16), municao: null as Regiao | null, obs: r(1, 246, y, 145, 16) })),
  aDistancia: [64, 46, 29].map((y) => ({ arma: r(1, 38, y, 128, 16), mod: r(1, 168, y, 30, 16), dano: r(1, 199, y, 45, 16), municao: r(1, 244, y, 45, 16), obs: r(1, 291, y, 101, 16) }))
}

const P2 = {
  paradigma: [r(2, 109, 780, 284, 17), r(2, 40, 763, 352, 17), r(2, 40, 745, 352, 17), r(2, 40, 728, 352, 17)],
  formaDeConjuracao: [r(2, 119, 710, 274, 17), r(2, 40, 693, 352, 17)],
  testeMagico: r(2, 142, 642, 40, 33),
  potenciaMagica: r(2, 142, 596, 40, 33),
  circulos: [197, 238, 278, 319, 359].map((x, i) => ({ nome: `${i + 1}º círculo`, total: r(2, x, 643, 31, 24), usados: r(2, x + 2, 594, 27, 47) })),
  magias: [529, 512, 494, 476, 459, 441, 424, 406, 389, 371, 354, 336, 319, 301, 284].map((y) => ({ magia: r(2, 38, y, 288, 17), circulo: r(2, 328, y, 30, 17), pagina: r(2, 361, y, 31, 17) })),
  mochila: [761, 744, 726, 709, 691, 674, 656, 639, 621, 603, 586, 568, 551, 533, 516, 498, 481, 463, 446, 428, 411, 393, 376, 358, 341, 323, 305, 288, 270].map((y) => ({ texto: r(2, 408, y, 114, 17), carga: [r(2, 523, y, 16, 17), r(2, 542, y, 16, 17)] })),
  consumiveisZero: [225, 207, 189, 171, 153].map((y) => ({ texto: r(2, 408, y, 67, 17), marcas: r(2, 477, y, 82, 12) })),
  consumiveisUm: [99, 81, 64, 46, 28].map((y) => ({ texto: r(2, 408, y, 67, 17), marcas: r(2, 477, y, 82, 12) })),
  notas: r(2, 37, 16, 358, 262)
}

const ANCORAS: Regiao[] = [P1.nome, ...ATRIBUTOS.map((a) => a.valor), ...ATRIBUTOS.map((a) => a.mod)]

const GRUPOS = {
  identificacao: 'Identificação',
  atributos: 'Atributos',
  recursos: 'Recursos',
  combate: 'Combate',
  ataques: 'Ataques',
  debilidades: 'Debilidades',
  habilidades: 'Habilidades',
  magia: 'Magia',
  inventario: 'Inventário',
  aparencia: 'Aparência',
  historia: 'História'
}

function confianca(sheet: PdfSheet): number {
  if (sheet.fields.length < 40) return 0
  const achadas = ancorasPresentes(sheet, ANCORAS)
  if (achadas >= 9) return 0.95
  if (achadas >= 6) return 0.6
  return 0
}

function numero(valor: string | null): number | null {
  if (valor === null) return null
  const achado = /^([+-]?)\s*(\d{1,3})(?!\d)/.exec(valor.trim())
  return achado ? Number(achado[2]) * (achado[1] === '-' ? -1 : 1) : null
}

function comSinal(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function extrair(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'breu', 'Breu', 0.95)
  const campos: SheetImportField[] = []
  const presets: SheetImportPreset[] = []
  const consumidos = new Set<string>()
  const consumir = (regiao: Regiao): void => {
    for (const campo of camposEm(sheet, regiao)) consumidos.add(campo.name)
  }
  const pegar = (regiao: Regiao): string | null => {
    consumir(regiao)
    return textoEm(sheet, regiao)
  }
  const marcadas = (regiao: Regiao): { marcadas: number; total: number } => {
    consumir(regiao)
    return marcadasEm(sheet, regiao)
  }
  /** Várias linhas do mesmo campo lógico (a Herança, o Paradigma) viram um texto só. */
  const juntar = (regioes: Regiao[]): string | null => {
    const partes = regioes.map((regiao) => pegar(regiao)).filter(Boolean)
    return partes.length > 0 ? partes.join(' ') : null
  }
  const carga = (regioes: Regiao[]): string => {
    const [a, b] = regioes.map((regiao) => pegar(regiao))
    if (a && b) return `carga ${a}/${b}`
    return a || b ? `carga ${a ?? b}` : ''
  }

  const nome = pegar(P1.nome) ?? ''
  const temDono = nome !== ''
  const push = (label: string, valor: string | null, group: string, roll?: SheetImportField['roll'], sempre = false): void => {
    if (valor) campos.push({ label, value: valor, group, roll })
    else if (sempre && temDono) campos.push({ label, value: '', group, roll })
  }

  push('Nome', nome || null, GRUPOS.identificacao, undefined, true)
  push('Classe', pegar(P1.classe), GRUPOS.identificacao, undefined, true)
  push('XP', pegar(P1.xp), GRUPOS.identificacao, undefined, true)
  push('Eu sou um(a)', pegar(P1.euSou), GRUPOS.identificacao, undefined, true)
  push('Bom(a) em', pegar(P1.bomEm), GRUPOS.identificacao, undefined, true)
  push('Em busca de', pegar(P1.emBuscaDe), GRUPOS.identificacao, undefined, true)
  push('Herança/Aparência', juntar(P1.heranca), GRUPOS.aparencia)

  /**
   * Atributos: o VALOR (rola pelo modificador de D&D) com o modificador escrito ao lado, ou só o
   * modificador quando é o que está escrito. Os Testes de Resistência proficientes viram uma
   * linha só ("FOR, CON"): é como a ficha impressa marca, um ponto embaixo de cada atributo.
   */
  const resistencias: string[] = []
  for (const atributo of ATRIBUTOS) {
    const valor = numero(pegar(atributo.valor))
    const mod = numero(pegar(atributo.mod))
    if (marcadas(atributo.tr).marcadas > 0) resistencias.push(atributo.sigla)
    if (valor !== null) push(atributo.nome, mod !== null ? `${valor} (${comSinal(mod)})` : String(valor), GRUPOS.atributos, 'd20-valor', true)
    else if (mod !== null) push(atributo.nome, comSinal(mod), GRUPOS.atributos, 'd20', true)
    else push(atributo.nome, null, GRUPOS.atributos, 'd20-valor', true)
  }
  if (temDono) push('Testes de resistência', resistencias.join(', ') || null, GRUPOS.combate, undefined, true)

  const proficiencia = numero(pegar(P1.proficiencia))
  push('Bônus de proficiência', proficiencia === null ? null : comSinal(proficiencia), GRUPOS.combate, undefined, true)
  for (const protecao of P1.protecoes) push(protecao.nome, pegar(protecao.regiao), GRUPOS.combate)
  push('Deslocamento', pegar(P1.deslocamento), GRUPOS.combate, undefined, true)

  push('PV atual', pegar(P1.pvAtual), GRUPOS.recursos, undefined, true)
  push('PV máximo', pegar(P1.pvMaximo), GRUPOS.recursos, undefined, true)
  push('Dados de Vida', pegar(P1.dadosDeVida), GRUPOS.recursos, undefined, true)
  push('DVs usados', pegar(P1.dvUsados), GRUPOS.recursos)

  for (const [i, debilidade] of P1.debilidades.entries()) {
    const texto = pegar(debilidade.texto)
    const gravidade = marcadas(debilidade.marcas).marcadas
    if (!texto) continue
    const rotulo = ['', 'leve', 'pesada', 'permanente'][Math.min(gravidade, 3)]
    push(`Debilidade ${i + 1}`, rotulo ? `${texto} (${rotulo})` : texto, GRUPOS.debilidades)
  }

  P1.beneficios.forEach((regiao, i) => push(`Benefício de classe ${i + 1}`, pegar(regiao), GRUPOS.habilidades))

  const ataque = (linha: { arma: Regiao; mod: Regiao; dano: Regiao; municao: Regiao | null; obs: Regiao }, distancia: boolean): void => {
    const arma = pegar(linha.arma)
    const mod = pegar(linha.mod)
    const dano = pegar(linha.dano) ?? ''
    const municao = linha.municao ? pegar(linha.municao) : null
    const obs = pegar(linha.obs)
    if (!arma) return
    const modNumero = numero(mod)
    const resumo = [modNumero === null ? '' : comSinal(modNumero), dano, municao ? `munição ${municao}` : '', obs ?? ''].filter(Boolean).join(' · ')
    campos.push({ label: distancia ? `${arma} (à distância)` : arma, value: resumo, group: GRUPOS.ataques })
    const teste = modNumero === null ? null : parseTestBonus(comSinal(modNumero))
    if (teste) presets.push({ name: `${arma} (ataque)`, kind: 'test', expression: teste, source: resumo })
    const expressaoDeDano = parseDiceExpression(dano)
    if (expressaoDeDano) presets.push({ name: `${arma} (dano)`, kind: 'damage', expression: expressaoDeDano.expression, source: resumo })
  }
  for (const linha of P1.corpoACorpo) ataque(linha, false)
  for (const linha of P1.aDistancia) ataque(linha, true)

  // Inventário: o que veste, o que carrega e a carga em pontos; a prata.
  for (const regiao of P1.vestimentas) {
    const item = pegar(regiao)
    if (item) campos.push({ label: item, value: 'vestimenta', group: GRUPOS.inventario })
  }
  for (const item of [...P1.vestidos.map((v) => ({ ...v, rotulo: v.nome })), ...P1.itensAMao.map((v) => ({ ...v, rotulo: '' }))]) {
    const texto = pegar(item.texto)
    const cargaDoItem = carga(item.carga)
    if (!texto) continue
    campos.push({ label: item.rotulo ? `${item.rotulo}: ${texto}` : texto, value: cargaDoItem, group: GRUPOS.inventario })
  }
  for (const consumivel of [...P1.consumiveisAMao, ...P2.consumiveisZero, ...P2.consumiveisUm]) {
    const texto = pegar(consumivel.texto)
    const marcas = marcadas(consumivel.marcas)
    if (texto) campos.push({ label: texto, value: marcas.total > 0 ? `${marcas.marcadas}/${marcas.total}` : '', group: GRUPOS.inventario })
  }
  for (const item of P2.mochila) {
    const texto = pegar(item.texto)
    const cargaDoItem = carga(item.carga)
    if (texto) campos.push({ label: `Mochila: ${texto}`, value: cargaDoItem, group: GRUPOS.inventario })
  }
  const cargaAtual = pegar(P1.cargaAtual)
  const cargaMaxima = pegar(P1.cargaMaxima)
  const cargaZero = pegar(P1.cargaZero)
  push('Carga', cargaAtual && cargaMaxima ? `${cargaAtual}/${cargaMaxima}` : (cargaAtual ?? cargaMaxima), GRUPOS.inventario)
  push('Carga zero', cargaZero, GRUPOS.inventario)
  push('Prata', pegar(P1.prata), GRUPOS.inventario, undefined, true)

  // Magia (página 2): só o que estiver escrito; o guerreiro não ganha quinze linhas vazias.
  push('Paradigma/Crença', juntar(P2.paradigma), GRUPOS.magia)
  push('Forma de conjuração', juntar(P2.formaDeConjuracao), GRUPOS.magia)
  push('Teste mágico', pegar(P2.testeMagico), GRUPOS.magia, 'd20')
  push('Potência mágica', pegar(P2.potenciaMagica), GRUPOS.magia)
  for (const circulo of P2.circulos) {
    const total = pegar(circulo.total)
    const usados = pegar(circulo.usados)
    if (total || usados) push(circulo.nome, usados && total ? `${usados}/${total}` : (total ?? usados), GRUPOS.magia)
  }
  for (const linha of P2.magias) {
    const magia = pegar(linha.magia)
    const circulo = pegar(linha.circulo)
    const pagina = pegar(linha.pagina)
    if (!magia) continue
    const detalhes = [circulo ? `${circulo}º círculo` : '', pagina ? `p. ${pagina}` : ''].filter(Boolean).join(', ')
    campos.push({ label: magia, value: detalhes, group: GRUPOS.magia })
  }

  push('Notas', pegar(P2.notas), GRUPOS.historia)

  const restantes = base.fields.filter((campo) => !campo.fieldName || !consumidos.has(campo.fieldName))
  const presetsRestantes = base.presets.filter((preset) => !preset.fieldName || !consumidos.has(preset.fieldName))
  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Breu',
    fields: [...campos, ...restantes],
    presets: presetsSemRepetidos([...presets, ...presetsRestantes]),
    rawText: undefined
  }
}

export const breuReader: SheetReader = {
  id: 'breu',
  label: 'Breu',
  detect: confianca,
  extract: (sheet) => extrair(sheet)
}
