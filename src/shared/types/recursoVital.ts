import { AZUL_DE_MANA_CHEIA, VERDE_DE_VIDA_CHEIA, clarearPeloGasto, corDaEscalaDeEstresse, ehCorHex } from './cor'

/**
 * RECURSO VITAL: o que o personagem gasta e recupera durante a sessão — PV, PE, Sanidade, HP, o que
 * for no sistema da mesa. É a barra clicável da tela de rolagem.
 *
 * Existe como MODELO PRÓPRIO, separado dos campos da ficha, por uma razão que a ficha importada
 * deixou clara: "PV atual" e "PV máximo" chegavam como dois campos de texto soltos, e a pessoa tinha
 * que abrir a aba Ficha e digitar "19" no meio de um combate — quando o gesto da mesa é "tomei 7".
 * Mora no `notes.json` do PERFIL: trocar de ficha troca as barras, e voltar traz o PV onde estava.
 *
 * Nada aqui sabe de sistema de RPG: nome livre, lista livre e teto folgado, e é o que faz um sistema
 * que o app nunca viu funcionar igual.
 */
export interface RecursoVital {
  id: string
  /** "PV", "Sanidade", "HP", "Espaços de 1º círculo" — o que a pessoa quiser ler na barra. */
  nome: string
  atual: number
  maximo: number
  /**
   * Cor da barra escolhida pela pessoa, `#rrggbb` — "a pessoa decide a cor também". AUSENTE é o
   * normal, e aí o padrão sai do que a barra mede: azul se é mana (`AZUL_DE_MANA_CHEIA`), verde no
   * resto (`VERDE_DE_VIDA_CHEIA`). Escolhida ou padrão, é a cor de CHEIA: a barra cai pro amarelo e
   * pro vermelho por cima dela, ou desbota, se é de mana.
   */
  cor?: string
  /**
   * A barra SOBE: começa vazia e o perigo é ENCHER. É o estresse de Oblívio (o dano por região,
   * "Torso 0/5"), a corrupção, a fadiga, a carga — "oblívio deixa o estresse subindo, tipo 1 amarelo
   * ... 5 vermelhasso, com vários níveis de cor". Ausente, a barra DESCE como PV: cheia é o normal, e
   * ela amarela nos 40% e avermelha nos 15%. Quem decide é o nome, e a pessoa troca no editor.
   */
  sobe?: boolean
}

/**
 * Barra que SOBE por padrão, pelo nome: estresse, dano, corrupção, fadiga, carga, e as regiões do
 * corpo de Oblívio (que são onde o dano se acumula naquela ficha).
 */
const NOME_QUE_SOBE = /estresse|stress|\bdano\b|ferimento|corrup|trauma|exaust|fadiga|\bcarga\b|\btorso\b|bra[çc]o|perna|cabe[çc]a/i

export function recursoSobePorPadrao(nome: string): boolean {
  return NOME_QUE_SOBE.test(nome.trim())
}

/**
 * Barra de MANA: o que se gasta pra conjurar, com o nome que cada sistema dá. PM em Tormenta, PE em
 * Ordem, MP e mana nos de língua inglesa, Esforço em quem escreve por extenso.
 *
 * É o NOME INTEIRO, e não um pedaço: "Pontos de Vida" tem "de" e "pontos" como qualquer outro, e um
 * teste frouxo pintaria de azul a barra errada. "PE" é PE de Ordem, e é a única sigla ambígua da
 * lista — em toda ficha que o app lê ela é energia, nunca vida.
 */
const NOME_DE_MANA = /^(pm|pe|mp|mana|magia|m[áa]gica|esfor[çc]o|energia|mana points?|magic points?|pontos? de (mana|magia|esfor[çc]o|energia))$/i
/**
 * Os ESPAÇOS DE MAGIA por círculo de D&D e de Pathfinder ("Espaços de 1º círculo", "3rd level spell
 * slots"): uma barra por círculo, e é gasto de conjuração como o PM — o mesmo azul desbotando.
 */
const NOME_DE_ESPACO_DE_MAGIA = /espa[çc]os?\s+de\s+(magia|\d)|c[íi]rculo|spell\s+slots?|slots?\s+de\s+magia/i

export function recursoDeMana(nome: string): boolean {
  const limpo = nome.trim()
  return NOME_DE_MANA.test(limpo) || NOME_DE_ESPACO_DE_MAGIA.test(limpo)
}

/**
 * A cor de CHEIA desta barra: a que a pessoa escolheu, ou o padrão do que ela mede — AZUL pra mana
 * (`recursoDeMana`) e VERDE pro resto.
 */
export function corDoRecurso(recurso: Pick<RecursoVital, 'nome' | 'cor'>): string {
  if (recurso.cor) return recurso.cor
  return recursoDeMana(recurso.nome) ? AZUL_DE_MANA_CHEIA : VERDE_DE_VIDA_CHEIA
}

/**
 * Quantas barras cabem num personagem. Ordem usa três, D&D uma, e o pior caso real são os espaços de
 * magia por círculo de um conjurador de D&D (nove) mais PV. Acima disso a faixa de barras na tela de
 * rolagem deixa de ser uma faixa e vira uma coluna, e no modo compacto não cabe de jeito nenhum.
 */
export const MAXIMO_DE_RECURSOS = 12

/** Nome curto por definição: ele mora numa barra de uns 200px ao lado dos números. */
export const TAMANHO_MAXIMO_DO_NOME_DO_RECURSO = 40

/**
 * Teto dos valores. Não existe sistema em que um recurso vital tenha um milhão de pontos, e o teto
 * é o que impede um `notes.json` editado à mão de pôr `1e308` na barra — que renderiza `Infinity`
 * e quebra a proporção de preenchimento de todas.
 */
export const TETO_DO_VALOR_DE_RECURSO = 999_999

/** Inteiro dentro de `[0, teto]`; qualquer coisa que não seja número finito vira `null`. */
function inteiroLimitado(valor: unknown, teto: number): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  return Math.min(Math.max(0, Math.trunc(valor)), teto)
}

/**
 * O valor ATUAL preso ao intervalo do recurso: nunca abaixo de zero, nunca acima do máximo. O teto é
 * escolha, não descuido — PV temporário de D&D estoura o máximo e há quem anote assim, mas uma barra
 * que passa de 100% não tem como ser desenhada e a régua de estado perderia a referência. Quem tem
 * PV temporário sobe o máximo por um instante, que é o que a ficha em papel faz.
 */
export function prenderAtual(atual: number, maximo: number): number {
  return Math.min(Math.max(0, Math.trunc(atual)), Math.max(0, Math.trunc(maximo)))
}

export function criarRecurso(nome: string, maximo: number, atual = maximo): RecursoVital {
  const maximoLimpo = inteiroLimitado(maximo, TETO_DO_VALOR_DE_RECURSO) ?? 0
  const nomeLimpo = nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO)
  const recurso: RecursoVital = {
    id: crypto.randomUUID(),
    nome: nomeLimpo,
    maximo: maximoLimpo,
    atual: prenderAtual(inteiroLimitado(atual, TETO_DO_VALOR_DE_RECURSO) ?? maximoLimpo, maximoLimpo)
  }
  if (recursoSobePorPadrao(nomeLimpo)) recurso.sobe = true
  return recurso
}

/**
 * Deixa qualquer lista lida do disco no formato atual — a mesma régua de `normalizeNotes` e
 * `normalizeProfiles`: item torto é DESCARTADO ou CORRIGIDO, nunca derruba a ficha inteira.
 *
 * - sem `nome` legível: fora. Barra sem nome não diz o que está medindo;
 * - `maximo`/`atual` que não são número finito: viram zero (e o atual, preso ao máximo);
 * - `id` repetido ou ausente: ganha um novo. Dois recursos com o mesmo id fariam o clique no "−" de
 *   um mexer nos dois;
 * - `cor` fora do formato: ausente, e a barra volta pro padrão (verde, ou azul se é mana);
 * - `sobe` que não é booleano: decidido pelo NOME (`recursoSobePorPadrao`), o que faz um `notes.json`
 *   antigo já mostrar "Torso 0/5" subindo. Um `false` gravado é a pessoa desmarcando, e fica;
 * - acima do teto de itens: os primeiros ficam. Ver `MAXIMO_DE_RECURSOS`.
 */
export function normalizarRecursos(raw: unknown): RecursoVital[] {
  if (!Array.isArray(raw)) return []
  const usados = new Set<string>()
  const limpos: RecursoVital[] = []
  for (const bruto of raw) {
    if (limpos.length >= MAXIMO_DE_RECURSOS) break
    if (!bruto || typeof bruto !== 'object') continue
    const entrada = bruto as Partial<RecursoVital>
    const nome = typeof entrada.nome === 'string' ? entrada.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO) : ''
    if (!nome) continue
    const maximo = inteiroLimitado(entrada.maximo, TETO_DO_VALOR_DE_RECURSO) ?? 0
    const atual = prenderAtual(inteiroLimitado(entrada.atual, TETO_DO_VALOR_DE_RECURSO) ?? maximo, maximo)
    const id = typeof entrada.id === 'string' && entrada.id.trim() && !usados.has(entrada.id) ? entrada.id : crypto.randomUUID()
    usados.add(id)
    const recurso: RecursoVital = { id, nome, atual, maximo }
    if (ehCorHex(entrada.cor)) recurso.cor = entrada.cor.toLowerCase()
    if (typeof entrada.sobe === 'boolean') recurso.sobe = entrada.sobe
    else if (recursoSobePorPadrao(nome)) recurso.sobe = true
    limpos.push(recurso)
  }
  return limpos
}

/**
 * As barras que a IMPORTAÇÃO traz, fundidas com as que o personagem já tem, pelo NOME e sem
 * diferenciar maiúsculas: reimportar a ficha depois de subir de nível traz um "PV" com máximo novo, e
 * ele tem que ser a MESMA barra, com o id que a tela já conhece e a cor que a pessoa escolheu.
 * Acrescentar deixaria dois "PV" lado a lado sem nada dizendo qual é qual. O que já estava e não veio
 * de novo FICA: barra criada à mão não some porque a ficha não a menciona.
 */
export function fundirRecursos(
  atuais: RecursoVital[],
  importados: Pick<RecursoVital, 'nome' | 'atual' | 'maximo'>[]
): RecursoVital[] {
  const resultado = [...atuais]
  for (const importado of importados) {
    const nome = importado.nome.trim().slice(0, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO)
    if (!nome) continue
    const indice = resultado.findIndex((recurso) => recurso.nome.toLowerCase() === nome.toLowerCase())
    if (indice >= 0) {
      const existente = resultado[indice]
      const maximo = inteiroLimitado(importado.maximo, TETO_DO_VALOR_DE_RECURSO) ?? existente.maximo
      resultado[indice] = { ...existente, maximo, atual: prenderAtual(inteiroLimitado(importado.atual, TETO_DO_VALOR_DE_RECURSO) ?? maximo, maximo) }
      continue
    }
    if (resultado.length >= MAXIMO_DE_RECURSOS) break
    resultado.push(criarRecurso(nome, importado.maximo, importado.atual))
  }
  return resultado
}

export type EstadoDoRecurso = 'normal' | 'aviso' | 'perigo'

/**
 * O estado de relance. Barra que DESCE (PV, PM) avisa nos 40% e é perigo nos 15% — as duas linhas que
 * ele pediu ("vai mudando de cor para amarela em 40% e vermelha em 15%"), no lugar da metade e do
 * quarto da spec. Barra que SOBE tem o espelho, 60% e 85%, porque ali o pior caso é cheia. Máximo
 * zero é "normal" de propósito: não há proporção a julgar, e pintar de perigo uma barra que ninguém
 * preencheu seria alarme falso.
 */
export const FRACAO_DE_AVISO = 0.4
export const FRACAO_DE_PERIGO = 0.15

export function estadoDoRecurso(recurso: Pick<RecursoVital, 'atual' | 'maximo' | 'sobe'>): EstadoDoRecurso {
  if (recurso.maximo <= 0) return 'normal'
  const fracao = recurso.atual / recurso.maximo
  // A distância do pior caso, nos dois sentidos: vazia pra quem desce, cheia pra quem sobe.
  const gravidade = recurso.sobe ? fracao : 1 - fracao
  const folga = 1e-9
  if (gravidade >= 1 - FRACAO_DE_PERIGO - folga) return 'perigo'
  if (gravidade >= 1 - FRACAO_DE_AVISO - folga) return 'aviso'
  return 'normal'
}

/**
 * A cor com que o PREENCHIMENTO da barra é pintado agora, e são TRÊS escalas, uma por tipo de barra:
 *
 * - VIDA e o resto que desce: VERDE cheia, AMARELO nos 40%, VERMELHO nos 15% — as três da paleta de
 *   16 do Windows. É a escala de qualquer jogo, e é a que se lê de relance;
 * - MANA (`recursoDeMana`): AZUL sempre, só mais CLARO a cada ponto gasto. Ficar sem PM não é ficar
 *   perto da morte, e o vermelho ali daria um susto que não é o caso;
 * - a que SOBE: cada nível é um degrau do amarelo ao vermelho (ver `corDaEscalaDeEstresse`).
 *
 * O verde e o azul são só o PADRÃO: barra com cor escolhida no editor usa a cor dela como cheia, e
 * cai (ou desbota) por cima dela.
 */
export function corDoPreenchimento(recurso: Pick<RecursoVital, 'nome' | 'cor' | 'atual' | 'maximo' | 'sobe'>): string {
  if (recurso.sobe) {
    if (recurso.maximo <= 1 || recurso.atual <= 1) return corDaEscalaDeEstresse(recurso.atual >= recurso.maximo && recurso.maximo > 0 ? 1 : 0)
    return corDaEscalaDeEstresse((recurso.atual - 1) / (recurso.maximo - 1))
  }
  if (recursoDeMana(recurso.nome)) {
    // O grau anda por PONTO, e não pela fração: assim a escala inteira cabe num PM de 3 tanto quanto
    // num de 40 — cheia é a cor de repouso e o ÚLTIMO ponto é o mais claro, como na do estresse.
    const passos = recurso.maximo - 1
    return clarearPeloGasto(corDoRecurso(recurso), passos > 0 ? (recurso.maximo - recurso.atual) / passos : 0)
  }
  const estado = estadoDoRecurso(recurso)
  if (estado === 'perigo') return '#ff0000'
  if (estado === 'aviso') return '#ffff00'
  return corDoRecurso(recurso)
}

/**
 * O que a pessoa DIGITOU no número da barra, virando o valor atual novo, ou `null` se não deu pra
 * ler. Três jeitos, e a diferença é o SINAL na frente:
 *
 * - `-7`, `+3`: conta em cima do atual, o gesto da mesa — um dano de 23 são vinte e três cliques ou
 *   um "-23";
 * - `12`: valor exato;
 * - `12/40`: os dois de uma vez, como toda ficha em papel escreve e como a importação lê.
 *
 * O resultado volta sempre PRESO ao intervalo: "-50" num PV 12 dá zero, não -38.
 */
export function lerEntradaDeRecurso(
  texto: string,
  recurso: Pick<RecursoVital, 'atual' | 'maximo'>
): { atual: number; maximo: number } | null {
  const limpo = texto.trim().replace(/\s+/g, '')
  if (!limpo) return null

  const par = /^(\d{1,7})\/(\d{1,7})$/.exec(limpo)
  if (par) {
    const maximo = Math.min(Number(par[2]), TETO_DO_VALOR_DE_RECURSO)
    return { maximo, atual: prenderAtual(Number(par[1]), maximo) }
  }

  const delta = /^([+-])(\d{1,7})$/.exec(limpo)
  if (delta) {
    const passo = Number(delta[2]) * (delta[1] === '-' ? -1 : 1)
    return { maximo: recurso.maximo, atual: prenderAtual(recurso.atual + passo, recurso.maximo) }
  }

  const exato = /^(\d{1,7})$/.exec(limpo)
  if (exato) return { maximo: recurso.maximo, atual: prenderAtual(Number(exato[1]), recurso.maximo) }

  return null
}
