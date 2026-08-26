/**
 * A GRAMÁTICA DE ROLAGEM — uma notação só pra tudo o que rola no app.
 *
 * É o Stage 4 do spec de importação (`AGENT_SPEC_pdf-import.md`), e o spec manda construir isto
 * PRIMEIRO: "one internal roll formula grammar used everywhere in the app (rolling screen, presets,
 * editor)". Lê-se assim:
 *
 *   1d20+5            dado e bônus                     4d6kh3     fica com os 3 maiores
 *   2d20kl1           fica com o menor (desvantagem)   4d6dl1     descarta o menor
 *   1d6!              explode no máximo                2d6r<2     rerola (uma vez) o que deu < 2
 *   6d6#>=5           CONTA os dados que deram >= 5    d%         d100
 *   (1d8+2)*2         aritmética com parênteses        -1d4       dado negativo
 *   1d20+@STR.mod+@prof >= 15
 *                     referências à ficha e um alvo no fim: a rolagem inteira vira sucesso/fracasso
 *
 * É um módulo PURO, em duas metades: `analisarFormula` lê o texto e devolve uma árvore, e
 * `avaliarFormula` calcula a árvore com uma FONTE DE DADOS injetada — a bandeja 3D, um gerador, ou
 * um teste com a lista de faces pronta. Nada aqui sabe de tela nem de física, e é isso que permite
 * testar a gramática à exaustão ("unit-test the grammar parser exhaustively — it is the heart of
 * the app").
 *
 * O que ela RECUSA, de propósito, com a posição do erro pra tela poder apontar:
 *
 * - quantidade zero, dado de um lado só, e números absurdos (101 dados num termo, d1001, uma
 *   fórmula de mil caracteres, vinte parênteses aninhados): fórmula vinda de um preset importado
 *   é entrada de fora, e o que não tem teto vira app travado;
 * - duas regras da mesma família no mesmo dado (`kh1kl1`, `r<2r<3`, `!!`): a segunda contradiz
 *   ou repete a primeira, e escolher em silêncio seria rolar diferente do que está escrito;
 * - manter mais dados do que rola (`2d6kh3`) e descartar todos (`1d6dl1`): não têm resultado que
 *   faça sentido;
 * - divisão: nenhum dos sistemas do spec divide, e "metade do dano, arredonda pra baixo" é regra
 *   de cada sistema, não da notação. Entra no dia em que for pedida, com o arredondamento escrito.
 *
 * A avaliação é a que os sistemas usam: reroll acontece ANTES da explosão (rerola-se a face que
 * caiu; a explosão é sobre a face que ficou), manter/descartar olham o valor final de cada dado
 * (um d6 explodido em 6+4 vale 10 pra regra, e é UM dado — a mesma leitura de `ExplodeRule`), e
 * `#` conta entre os dados mantidos.
 */

import { MAX_EXPLOSOES_POR_DADO } from '../diceRegistry'

export type Comparador = '>=' | '<=' | '>' | '<' | '='

export interface RegraDeManter {
  modo: 'maior' | 'menor'
  quantos: number
}

export interface RegraDeDescartar {
  modo: 'maior' | 'menor'
  quantos: number
}

export interface Condicao {
  comparador: Comparador
  alvo: number
}

export interface TermoDeDado {
  tipo: 'dado'
  quantidade: number
  lados: number
  manter?: RegraDeManter
  descartar?: RegraDeDescartar
  explodir: boolean
  /** `r<2`: cada dado que satisfizer a condição é rolado de novo UMA vez. */
  rerolar?: Condicao
  /** `#>=5`: o valor do termo passa a ser a CONTAGEM dos dados mantidos que satisfazem a condição. */
  contar?: Condicao
}

export type NoDaFormula =
  | { tipo: 'numero'; valor: number }
  | TermoDeDado
  | { tipo: 'referencia'; caminho: string[] }
  | { tipo: 'operacao'; operador: '+' | '-' | '*'; esquerda: NoDaFormula; direita: NoDaFormula }
  | { tipo: 'negativo'; de: NoDaFormula }

export interface Formula {
  expressao: NoDaFormula
  /** `>= 15` no fim: a rolagem inteira vira sucesso ou fracasso contra o alvo. */
  alvo?: Condicao
  /** O texto como foi escrito, sem os espaços das pontas. */
  texto: string
}

export interface ErroDeFormula {
  ok: false
  mensagem: string
  /** Índice (base zero) no texto onde o erro está, pra tela poder apontar. */
  posicao: number
}

export type ResultadoDaAnalise = { ok: true; formula: Formula } | ErroDeFormula

export const TAMANHO_MAXIMO_DA_FORMULA = 200
export const MAXIMO_DE_DADOS_POR_TERMO = 100
export const MAXIMO_DE_LADOS = 1000
export const MAXIMO_DE_PARENTESES_ANINHADOS = 20
/** Um número solto na fórmula não passa disto; acima é erro de digitação ou tentativa de estourar. */
export const MAIOR_NUMERO_SOLTO = 1_000_000

const DADO = /(\d*)[dD](\d+|%)/y
const NUMERO = /\d+/y
const REFERENCIA = /@([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)/y
const SUFIXO_MANTER = /[kK]([hHlL]?)(\d*)/y
const SUFIXO_DESCARTAR = /[dD]([hHlL])(\d*)/y
const SUFIXO_REROLAR = /[rR](>=|<=|>|<|=)(\d+)/y
const SUFIXO_CONTAR = /#(>=|<=|>|<|=)(\d+)/y
const COMPARADOR = /(>=|<=|>|<|=)/y
const ESPACO = /\s*/y

class Leitor {
  posicao = 0
  profundidade = 0

  constructor(readonly texto: string) {}

  pularEspaco(): void {
    ESPACO.lastIndex = this.posicao
    ESPACO.exec(this.texto)
    this.posicao = ESPACO.lastIndex
  }

  /** Tenta casar `padrao` (que precisa ser sticky) exatamente na posição atual. */
  casar(padrao: RegExp): RegExpExecArray | null {
    padrao.lastIndex = this.posicao
    const m = padrao.exec(this.texto)
    if (m) this.posicao = padrao.lastIndex
    return m
  }

  espiar(): string {
    return this.texto[this.posicao] ?? ''
  }

  acabou(): boolean {
    return this.posicao >= this.texto.length
  }
}

class FalhaDeLeitura extends Error {
  constructor(
    mensagem: string,
    readonly posicao: number
  ) {
    super(mensagem)
  }
}

function falhar(mensagem: string, posicao: number): never {
  throw new FalhaDeLeitura(mensagem, posicao)
}

export function analisarFormula(entrada: string): ResultadoDaAnalise {
  const texto = (entrada ?? '').trim()
  if (texto === '') return { ok: false, mensagem: 'Escreva uma rolagem, como 1d20+5.', posicao: 0 }
  if (texto.length > TAMANHO_MAXIMO_DA_FORMULA) {
    return {
      ok: false,
      mensagem: `A fórmula passou de ${TAMANHO_MAXIMO_DA_FORMULA} caracteres.`,
      posicao: TAMANHO_MAXIMO_DA_FORMULA
    }
  }

  const leitor = new Leitor(texto)
  try {
    const expressao = lerSoma(leitor)
    leitor.pularEspaco()

    let alvo: Condicao | undefined
    const inicioDoAlvo = leitor.posicao
    const comparador = leitor.casar(COMPARADOR)
    if (comparador) {
      leitor.pularEspaco()
      const numero = leitor.casar(NUMERO)
      if (!numero) falhar('Depois do comparador vem o número do alvo, como >= 15.', leitor.posicao)
      alvo = { comparador: comparador[1] as Comparador, alvo: lerNumero(numero[0], inicioDoAlvo) }
      leitor.pularEspaco()
    }

    if (!leitor.acabou()) {
      falhar(`Não entendi "${leitor.espiar()}" aqui.`, leitor.posicao)
    }
    return { ok: true, formula: { expressao, alvo, texto } }
  } catch (causa) {
    if (causa instanceof FalhaDeLeitura) return { ok: false, mensagem: causa.message, posicao: causa.posicao }
    throw causa
  }
}

function lerNumero(digitos: string, posicao: number): number {
  const valor = Number(digitos)
  if (valor > MAIOR_NUMERO_SOLTO) falhar(`Número grande demais (o máximo é ${MAIOR_NUMERO_SOLTO}).`, posicao)
  return valor
}

/** soma := produto (('+' | '-') produto)* */
function lerSoma(leitor: Leitor): NoDaFormula {
  let esquerda = lerProduto(leitor)
  for (;;) {
    leitor.pularEspaco()
    const sinal = leitor.espiar()
    if (sinal !== '+' && sinal !== '-') return esquerda
    leitor.posicao += 1
    const direita = lerProduto(leitor)
    esquerda = { tipo: 'operacao', operador: sinal, esquerda, direita }
  }
}

/** produto := unario ('*' unario)* */
function lerProduto(leitor: Leitor): NoDaFormula {
  let esquerda = lerUnario(leitor)
  for (;;) {
    leitor.pularEspaco()
    const sinal = leitor.espiar()
    if (sinal === '/') falhar('Divisão não existe na notação: cada sistema arredonda do seu jeito.', leitor.posicao)
    if (sinal !== '*') return esquerda
    leitor.posicao += 1
    const direita = lerUnario(leitor)
    esquerda = { tipo: 'operacao', operador: '*', esquerda, direita }
  }
}

/** unario := '-' unario | atomo */
function lerUnario(leitor: Leitor): NoDaFormula {
  leitor.pularEspaco()
  if (leitor.espiar() === '-') {
    leitor.posicao += 1
    return { tipo: 'negativo', de: lerUnario(leitor) }
  }
  if (leitor.espiar() === '+') {
    // "+5" solto no começo, ou "1d6 + +2": o sinal a mais não muda nada.
    leitor.posicao += 1
    return lerUnario(leitor)
  }
  return lerAtomo(leitor)
}

/** atomo := dado sufixos* | numero | referencia | '(' soma ')' */
function lerAtomo(leitor: Leitor): NoDaFormula {
  leitor.pularEspaco()
  const inicio = leitor.posicao

  if (leitor.acabou()) falhar('A fórmula acabou antes da hora: faltou um dado ou um número.', inicio)

  if (leitor.espiar() === '(') {
    leitor.posicao += 1
    leitor.profundidade += 1
    if (leitor.profundidade > MAXIMO_DE_PARENTESES_ANINHADOS) {
      falhar(`Parênteses demais (o máximo é ${MAXIMO_DE_PARENTESES_ANINHADOS} níveis).`, inicio)
    }
    const dentro = lerSoma(leitor)
    leitor.pularEspaco()
    if (leitor.espiar() !== ')') falhar('Faltou fechar o parêntese.', leitor.posicao)
    leitor.posicao += 1
    leitor.profundidade -= 1
    return dentro
  }

  const dado = leitor.casar(DADO)
  if (dado) return lerSufixos(leitor, lerDado(dado, inicio))

  const referencia = leitor.casar(REFERENCIA)
  if (referencia) return { tipo: 'referencia', caminho: referencia[1].split('.') }
  if (leitor.espiar() === '@') falhar('Referência precisa de um nome, como @STR.mod ou @prof.', inicio)

  const numero = leitor.casar(NUMERO)
  if (numero) {
    // "1d" — o dado ficou sem lados; sem esta espiada, o 1 viraria número e o "d" sobraria solto.
    if (/[dD]/.test(leitor.espiar())) falhar('Dado sem número de lados: escreva d20, d6, d%.', inicio)
    return { tipo: 'numero', valor: lerNumero(numero[0], inicio) }
  }

  if (leitor.espiar() === ')') falhar('Parêntese fechado sem abrir.', inicio)
  if (/[dD]/.test(leitor.espiar())) falhar('Dado sem número de lados: escreva d20, d6, d%.', inicio)
  falhar(`Não entendi "${leitor.espiar()}" aqui.`, inicio)
}

function lerDado(casado: RegExpExecArray, inicio: number): TermoDeDado {
  const quantidade = casado[1] === '' ? 1 : Number(casado[1])
  const lados = casado[2] === '%' ? 100 : Number(casado[2])
  if (quantidade < 1) falhar('Zero dados não rola nada.', inicio)
  if (quantidade > MAXIMO_DE_DADOS_POR_TERMO) {
    falhar(`Dados demais num termo só (o máximo é ${MAXIMO_DE_DADOS_POR_TERMO}).`, inicio)
  }
  if (lados < 2) falhar('Dado de um lado só não é dado.', inicio)
  if (lados > MAXIMO_DE_LADOS) falhar(`Lados demais (o máximo é d${MAXIMO_DE_LADOS}).`, inicio)
  return { tipo: 'dado', quantidade, lados, explodir: false }
}

/** Os sufixos de um dado, em qualquer ordem: kh3, kl1, dh1, dl1, !, r<2, #>=5. */
function lerSufixos(leitor: Leitor, termo: TermoDeDado): TermoDeDado {
  for (;;) {
    leitor.pularEspaco()
    const inicio = leitor.posicao

    const manter = leitor.casar(SUFIXO_MANTER)
    if (manter) {
      if (termo.manter || termo.descartar) falhar('Só uma regra de manter ou descartar por dado.', inicio)
      const quantos = manter[2] === '' ? 1 : Number(manter[2])
      if (quantos < 1) falhar('Manter zero dados não deixa nada pra somar.', inicio)
      if (quantos > termo.quantidade) {
        falhar(`Não dá pra manter ${quantos} dados de ${termo.quantidade}.`, inicio)
      }
      termo.manter = { modo: manter[1].toLowerCase() === 'l' ? 'menor' : 'maior', quantos }
      continue
    }

    const descartar = leitor.casar(SUFIXO_DESCARTAR)
    if (descartar) {
      if (termo.manter || termo.descartar) falhar('Só uma regra de manter ou descartar por dado.', inicio)
      const quantos = descartar[2] === '' ? 1 : Number(descartar[2])
      if (quantos < 1) falhar('Descartar zero dados não muda nada.', inicio)
      if (quantos >= termo.quantidade) {
        falhar(`Descartar ${quantos} de ${termo.quantidade} dados não deixa nenhum.`, inicio)
      }
      termo.descartar = { modo: descartar[1].toLowerCase() === 'l' ? 'menor' : 'maior', quantos }
      continue
    }

    if (leitor.espiar() === '!') {
      if (termo.explodir) falhar('O dado já explode: um "!" basta.', inicio)
      leitor.posicao += 1
      termo.explodir = true
      continue
    }

    const rerolar = leitor.casar(SUFIXO_REROLAR)
    if (rerolar) {
      if (termo.rerolar) falhar('Só uma regra de rerolar por dado.', inicio)
      termo.rerolar = condicao(rerolar, termo, inicio)
      continue
    }

    const contar = leitor.casar(SUFIXO_CONTAR)
    if (contar) {
      if (termo.contar) falhar('Só uma contagem por dado.', inicio)
      termo.contar = condicao(contar, termo, inicio)
      continue
    }

    // "1d6k" sem número nem h/l já é kh1; o que sobra aqui são restos como "1d6r" ou "1d6#".
    if (/[rR]/.test(leitor.espiar()) && /[<>=]/.test(leitor.texto[leitor.posicao + 1] ?? '')) {
      falhar('Rerolar precisa de comparador e número, como r<2.', inicio)
    }
    if (leitor.espiar() === '#') falhar('Contar precisa de comparador e número, como #>=5.', inicio)
    return termo
  }
}

function condicao(casado: RegExpExecArray, termo: TermoDeDado, posicao: number): Condicao {
  const alvo = Number(casado[2])
  const comparador = casado[1] as Comparador
  // Alvo fora das faces ("1d6#>=7") é erro de quem escreveu; "1d6r>=1" rerolaria todo dado, sempre,
  // e também. "1d6r<1" nunca rerola, e passa: é inofensivo.
  if (alvo < 1 || alvo > termo.lados) {
    falhar(`O alvo precisa estar entre 1 e ${termo.lados} num d${termo.lados}.`, posicao)
  }
  if (casado[0][0].toLowerCase() === 'r' && satisfazSempre(comparador, alvo, termo.lados)) {
    falhar('Essa regra rerolaria todo dado, sempre.', posicao)
  }
  return { comparador, alvo }
}

function satisfazSempre(comparador: Comparador, alvo: number, lados: number): boolean {
  for (let face = 1; face <= lados; face += 1) if (!compara(face, comparador, alvo)) return false
  return true
}

export function compara(valor: number, comparador: Comparador, alvo: number): boolean {
  switch (comparador) {
    case '>=':
      return valor >= alvo
    case '<=':
      return valor <= alvo
    case '>':
      return valor > alvo
    case '<':
      return valor < alvo
    case '=':
      return valor === alvo
  }
}

// ---------------------------------------------------------------------------------------------
// Avaliação
// ---------------------------------------------------------------------------------------------

/**
 * Quem fornece as faces. Recebe o tipo do dado e quantos, e devolve exatamente essa quantidade de
 * faces entre 1 e `lados`. É chamada uma vez por termo, e de novo para cada reroll e cada elo de
 * explosão — sempre com a quantidade certa, pra bandeja poder jogar só o que falta.
 */
export type FonteDeDados = (lados: number, quantidade: number) => number[]

export interface ContextoDeAvaliacao {
  dados: FonteDeDados
  /** O valor de `@STR.mod`, `@prof`... `undefined` quando a ficha não tem: a fórmula falha, não chuta. */
  referencia?: (caminho: string[]) => number | undefined
  /** Teto de elos de explosão por dado. O padrão é o mesmo da bandeja. */
  tetoDeExplosoes?: number
}

export interface DadoAvaliado {
  /** As faces deste dado, na ordem: a que caiu e, se explodiu, as seguintes. */
  faces: number[]
  /** A face que foi descartada por `r`, quando houve reroll. */
  rerolado?: number
  /** A soma das faces — o que a regra de manter e a contagem enxergam. */
  valor: number
  mantido: boolean
}

export interface TermoAvaliado {
  quantidade: number
  lados: number
  dados: DadoAvaliado[]
  /** Soma dos mantidos — ou, com `#`, a contagem. */
  valor: number
}

export type ResultadoDaFormula =
  | { ok: true; total: number; sucesso?: boolean; termos: TermoAvaliado[] }
  | { ok: false; mensagem: string }

export function avaliarFormula(formula: Formula, contexto: ContextoDeAvaliacao): ResultadoDaFormula {
  const termos: TermoAvaliado[] = []
  try {
    const total = avaliarNo(formula.expressao, contexto, termos)
    const sucesso = formula.alvo ? compara(total, formula.alvo.comparador, formula.alvo.alvo) : undefined
    return { ok: true, total, sucesso, termos }
  } catch (causa) {
    if (causa instanceof FalhaDeAvaliacao) return { ok: false, mensagem: causa.message }
    throw causa
  }
}

class FalhaDeAvaliacao extends Error {}

function avaliarNo(no: NoDaFormula, contexto: ContextoDeAvaliacao, termos: TermoAvaliado[]): number {
  switch (no.tipo) {
    case 'numero':
      return no.valor
    case 'negativo':
      return -avaliarNo(no.de, contexto, termos)
    case 'operacao': {
      const esquerda = avaliarNo(no.esquerda, contexto, termos)
      const direita = avaliarNo(no.direita, contexto, termos)
      if (no.operador === '+') return esquerda + direita
      if (no.operador === '-') return esquerda - direita
      return esquerda * direita
    }
    case 'referencia': {
      const valor = contexto.referencia?.(no.caminho)
      if (valor === undefined || !Number.isFinite(valor)) {
        throw new FalhaDeAvaliacao(`A ficha não tem valor para @${no.caminho.join('.')}.`)
      }
      return valor
    }
    case 'dado': {
      const termo = avaliarDado(no, contexto)
      termos.push(termo)
      return termo.valor
    }
  }
}

function pedirFaces(contexto: ContextoDeAvaliacao, lados: number, quantidade: number): number[] {
  const faces = contexto.dados(lados, quantidade)
  if (!Array.isArray(faces) || faces.length !== quantidade) {
    throw new FalhaDeAvaliacao(`A fonte de dados devolveu ${faces?.length ?? 0} faces em vez de ${quantidade}.`)
  }
  for (const face of faces) {
    if (!Number.isInteger(face) || face < 1 || face > lados) {
      throw new FalhaDeAvaliacao(`A fonte de dados devolveu ${face} num d${lados}.`)
    }
  }
  return faces
}

function avaliarDado(termo: TermoDeDado, contexto: ContextoDeAvaliacao): TermoAvaliado {
  const teto = contexto.tetoDeExplosoes ?? MAX_EXPLOSOES_POR_DADO
  const primeiras = pedirFaces(contexto, termo.lados, termo.quantidade)

  const dados: DadoAvaliado[] = primeiras.map((face) => ({ faces: [face], valor: face, mantido: true }))

  // Reroll antes da explosão: rerola-se a face que caiu; a explosão é sobre a que ficou.
  if (termo.rerolar) {
    const { comparador, alvo } = termo.rerolar
    for (const dado of dados) {
      if (compara(dado.faces[0], comparador, alvo)) {
        dado.rerolado = dado.faces[0]
        dado.faces = [pedirFaces(contexto, termo.lados, 1)[0]]
      }
    }
  }

  if (termo.explodir) {
    for (const dado of dados) {
      while (dado.faces[dado.faces.length - 1] === termo.lados && dado.faces.length <= teto) {
        dado.faces.push(pedirFaces(contexto, termo.lados, 1)[0])
      }
    }
  }

  for (const dado of dados) dado.valor = dado.faces.reduce((soma, face) => soma + face, 0)

  const mantidos = indicesMantidos(dados, termo)
  dados.forEach((dado, i) => {
    dado.mantido = mantidos.has(i)
  })

  const contar = termo.contar
  const valor = contar
    ? dados.filter((d) => d.mantido && compara(d.valor, contar.comparador, contar.alvo)).length
    : dados.reduce((soma, d) => (d.mantido ? soma + d.valor : soma), 0)

  return { quantidade: termo.quantidade, lados: termo.lados, dados, valor }
}

/**
 * Quais dados ficam. Empate fica com quem veio primeiro — a mesma regra de `manterDados.ts`, pra
 * marcação na tela ser estável entre um render e outro.
 */
function indicesMantidos(dados: DadoAvaliado[], termo: TermoDeDado): Set<number> {
  const todos = new Set(dados.map((_, i) => i))
  const regra = termo.manter
    ? { modo: termo.manter.modo, quantos: termo.manter.quantos }
    : termo.descartar
      ? {
          // Descartar os N menores é manter os (total − N) maiores, e vice-versa.
          modo: termo.descartar.modo === 'menor' ? 'maior' : 'menor',
          quantos: dados.length - termo.descartar.quantos
        }
      : null
  if (!regra || regra.quantos >= dados.length) return todos

  const ordem = dados
    .map((dado, indice) => ({ valor: dado.valor, indice }))
    .sort((a, b) => (regra.modo === 'maior' ? b.valor - a.valor : a.valor - b.valor) || a.indice - b.indice)
  return new Set(ordem.slice(0, regra.quantos).map((d) => d.indice))
}

// ---------------------------------------------------------------------------------------------
// De volta a texto
// ---------------------------------------------------------------------------------------------

/**
 * A fórmula escrita de forma canônica: minúsculas, um espaço em volta de `+`, `-` e `*`, sufixos
 * colados ao dado. É o que a tela mostra depois de aceitar o que a pessoa digitou.
 */
export function escreverFormula(formula: Formula): string {
  const corpo = escreverNo(formula.expressao)
  return formula.alvo ? `${corpo} ${formula.alvo.comparador} ${formula.alvo.alvo}` : corpo
}

function escreverNo(no: NoDaFormula): string {
  switch (no.tipo) {
    case 'numero':
      return String(no.valor)
    case 'referencia':
      return `@${no.caminho.join('.')}`
    case 'negativo':
      return `-${envolver(no.de, escreverNo(no.de))}`
    case 'operacao': {
      const esquerda = no.operador === '*' ? envolver(no.esquerda, escreverNo(no.esquerda)) : escreverNo(no.esquerda)
      const direita =
        no.operador === '*' || no.operador === '-'
          ? envolver(no.direita, escreverNo(no.direita))
          : escreverNo(no.direita)
      return `${esquerda} ${no.operador} ${direita}`
    }
    case 'dado':
      return escreverDado(no)
  }
}

/** Parênteses só onde a precedência exige — `(1d8 + 2) * 2`, mas `1d8 + 2 * 2` fica sem. */
function envolver(no: NoDaFormula, texto: string): string {
  return no.tipo === 'operacao' ? `(${texto})` : texto
}

export function escreverDado(termo: TermoDeDado): string {
  let texto = `${termo.quantidade}d${termo.lados}`
  if (termo.manter) texto += `k${termo.manter.modo === 'maior' ? 'h' : 'l'}${termo.manter.quantos}`
  if (termo.descartar) texto += `d${termo.descartar.modo === 'maior' ? 'h' : 'l'}${termo.descartar.quantos}`
  if (termo.explodir) texto += '!'
  if (termo.rerolar) texto += `r${termo.rerolar.comparador}${termo.rerolar.alvo}`
  if (termo.contar) texto += `#${termo.contar.comparador}${termo.contar.alvo}`
  return texto
}
