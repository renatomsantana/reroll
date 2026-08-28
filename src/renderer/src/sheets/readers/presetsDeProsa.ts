import type { SheetImportField, SheetImportPreset } from '@shared/types/sheetImport'
import { parseDiceExpression } from '@shared/dice/parseDiceExpression'

/**
 * GOLPE ESCRITO EM PROSA VIRA PRESET — em QUALQUER ficha.
 *
 * Nasceu no leitor de Oblívio (reporte de tester: "golpes que tinham o nome do golpe e um teste no
 * golpe, e não foi criado preset") e o usuário mandou valer pra todas: "esse jeito do Oblívio, vamos
 * deixar pra TODAS as fichas". Por isso mora aqui, fora de qualquer leitor, e roda no `readSheet`
 * sobre os campos FINAIS que o leitor escolhido devolveu — o "Características" de D&D, o
 * "Habilidades" de Ordem, o talento de classe de Pathfinder, o campo sem sistema do genérico.
 *
 * A regra é a mesma que foi segura no Oblívio, que traz as regras impressas junto e ainda assim não
 * rendeu lixo: o dado tem que vir logo depois de uma ÂNCORA — Teste, Dano, Ataque, Attack, Damage,
 * Hit, Cura… — na MESMA frase, a até 60 caracteres. É a âncora que separa "Teste de Combate com
 * 2D6+1" (rolagem do personagem) de "permanentemente reduzido em 1D4 pontos" (prosa de regra), que
 * foi o que proibiu preset de texto solto no genérico (ver `presetsDoTexto`).
 *
 * O NOME do botão é o que a pessoa procura na lista no meio da mesa: o "Nome:" que abre a frase
 * ("Corte Cruel: Teste de…"), ou, sem ele, o rótulo do campo — que é o nome do golpe quando a ficha
 * já veio "Rótulo: valor" (Oblívio), e o nome do bloco quando é um campo grande de formulário
 * ("Features & Traits"). No segundo caso duas rolagens do mesmo bloco ganham o dado no nome pra não
 * virarem dois botões iguais.
 */

const DADO = /\d*[dD]\d+(?:\s*[+-]\s*\d+)?/
const DADO_GLOBAL = new RegExp(DADO.source, 'g')

const ANCORA_DE_TESTE = /\b(?:teste|ataque|acerto|attack|hit|check|roll|rolagem|rola|rolar|jogada)\b/i
const ANCORA_DE_DANO = /\b(?:dano|damage|dmg)\b/i
const ANCORA_DE_CURA = /\b(?:cura|curar|heal|heals|healing)\b/i
const QUALQUER_ANCORA = new RegExp(`${ANCORA_DE_TESTE.source}|${ANCORA_DE_DANO.source}|${ANCORA_DE_CURA.source}`, 'i')

/** A âncora tem que estar ANTES do dado, a até isto — é a régua original do Oblívio. */
const ALCANCE_DA_ANCORA = 60
/**
 * E o que vem logo DEPOIS do dado decide entre teste e dano quando a âncora de antes foi "Ataque":
 * "Sneak Attack: 3d6 extra damage" é dano, não teste. Só vale pro ÚLTIMO dado da frase: em "Teste
 * com 1D20 e, ao acertar, Dano: 2D4+2" o "Dano" depois do 1D20 apresenta o 2D4+2, não o 1D20.
 */
const ALCANCE_DEPOIS = 30

/** "Corte Cruel: …" — o nome que abre a frase. Curto, com letra, e que não seja a própria âncora. */
const NOME_NA_FRASE = /^\s*([^:]{2,40}?):\s+/

export interface LeituraDeProsa {
  presets: SheetImportPreset[]
  /**
   * Os presets de "campo inteiro" que os daqui SUBSTITUEM: o genérico faz um preset de qualquer
   * campo em que ache um dado, com o nome do campo e o valor inteiro como `source` — pra um campo
   * de prosa isso é um botão "Habilidades" que rola o primeiro dado do parágrafo. Quando a prosa
   * rendeu golpes com nome, esse botão sai.
   */
  substituidos: Set<SheetImportPreset>
}

export function presetsDeProsa(fields: SheetImportField[], jaLidos: SheetImportPreset[] = []): LeituraDeProsa {
  const presets: SheetImportPreset[] = []
  const substituidos = new Set<SheetImportPreset>()
  for (const campo of fields) {
    if (!campo.value || !QUALQUER_ANCORA.test(campo.value)) continue
    const doCampoInteiro = jaLidos.filter((preset) => ehDoCampoInteiro(preset, campo))
    /**
     * Campo que um leitor DEDICADO já transformou em preset fica de fora: o item de Oblívio
     * ("Espada. Dano: 1D6 PE.") já virou "Espada (dano)" com o nome curto certo, e ler de novo aqui
     * daria um segundo botão, "Torso (dano)", pela região do corpo que rotula o campo. O sinal é o
     * `source` do preset dentro do valor do campo — e NÃO é o preset de campo inteiro do genérico,
     * que é o que os daqui vêm substituir.
     */
    if (jaLidos.some((preset) => !doCampoInteiro.includes(preset) && preset.source && campo.value.includes(preset.source))) continue

    const antes = presets.length
    const usadosNesteCampo = new Set<string>()
    for (const frase of frases(campo.value)) {
      const nome = nomeDaFrase(frase)
      for (const achado of rolagensDaFrase(frase, nome?.fim ?? 0)) {
        const lido = parseDiceExpression(achado.dado)
        if (!lido) continue
        const base = nome?.nome ?? campo.label
        let name = achado.kind === 'damage' ? `${base} (dano)` : base
        // Duas rolagens do mesmo bloco com o mesmo nome: o dado entra no nome, senão são dois botões iguais.
        if (usadosNesteCampo.has(name)) name = `${name} ${achado.dado.replace(/\s+/g, '')}`
        usadosNesteCampo.add(name)
        presets.push({ name, kind: achado.kind, expression: lido.expression, source: achado.source, fieldName: campo.fieldName })
      }
    }
    if (presets.length > antes) for (const preset of doCampoInteiro) substituidos.add(preset)
  }
  return { presets, substituidos }
}

/** O preset que o genérico faz do campo INTEIRO: nome do campo, tipo em aberto, o valor todo como fonte. */
function ehDoCampoInteiro(preset: SheetImportPreset, campo: SheetImportField): boolean {
  return preset.kind === 'other' && preset.name === campo.label && preset.source === campo.value
}

/** Uma frase por vez: ponto, ponto e vírgula, quebra de linha. É o `[^.]` da régua original. */
function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((frase) => frase.trim())
    .filter((frase) => frase.length > 0)
}

interface RolagemAchada {
  dado: string
  kind: SheetImportPreset['kind']
  source: string
}

/**
 * `fimDoNome`: onde termina o "Nome:" que abre a frase. Uma âncora que mora DENTRO do nome ("Ataque
 * furtivo: 1d6", na ficha de D&D do Go) ainda qualifica o dado — é um golpe com nome e dado, que é
 * o que a pessoa quer na lista —, mas não diz se aquilo é teste ou dano: "ataque" ali é o nome da
 * habilidade, não a descrição da rolagem. Fica `other`, salvo o que vier depois do dado dizer.
 */
function rolagensDaFrase(frase: string, fimDoNome: number): RolagemAchada[] {
  const achados: RolagemAchada[] = []
  const dados = [...frase.matchAll(DADO_GLOBAL)]
  dados.forEach((dado, posicao) => {
    const inicio = dado.index ?? 0
    const janela = Math.max(0, inicio - ALCANCE_DA_ANCORA)
    const antes = frase.slice(janela, inicio)
    const ancora = ultimaAncora(antes)
    if (!ancora) return
    const ancoraNoNome = janela + ancora.indice < fimDoNome

    const fim = inicio + dado[0].length
    const ehOUltimo = posicao === dados.length - 1
    const depois = ehOUltimo ? frase.slice(fim, fim + ALCANCE_DEPOIS) : ''

    let kind: SheetImportPreset['kind']
    if ((ancora.kind === 'damage' && !ancoraNoNome) || ANCORA_DE_DANO.test(depois)) kind = 'damage'
    else if (ancoraNoNome || ancora.kind === 'other' || ANCORA_DE_CURA.test(depois)) kind = 'other'
    else kind = 'test'

    achados.push({ dado: dado[0], kind, source: frase.slice(janela + ancora.indice, fim).trim().slice(0, 120) })
  })
  return achados
}

/** A ÚLTIMA âncora antes do dado é a que manda: "Ataque… Dano: 2D4" é dano. */
function ultimaAncora(trecho: string): { indice: number; kind: SheetImportPreset['kind'] } | null {
  let melhor: { indice: number; kind: SheetImportPreset['kind'] } | null = null
  const candidatos: [RegExp, SheetImportPreset['kind']][] = [
    [ANCORA_DE_TESTE, 'test'],
    [ANCORA_DE_DANO, 'damage'],
    [ANCORA_DE_CURA, 'other']
  ]
  for (const [padrao, kind] of candidatos) {
    for (const achado of trecho.matchAll(new RegExp(padrao.source, 'gi'))) {
      const indice = achado.index ?? 0
      if (!melhor || indice > melhor.indice) melhor = { indice, kind }
    }
  }
  return melhor
}

/**
 * O nome pode CONTER uma âncora ("Ataque furtivo") — o que não pode é SER só ela: "Teste: 2D6+1" e
 * "Dano: 1d8" são a descrição da rolagem, não o nome de um golpe, e aí quem nomeia é o campo.
 */
function nomeDaFrase(frase: string): { nome: string; fim: number } | null {
  const achado = NOME_NA_FRASE.exec(frase)
  if (!achado) return null
  const nome = achado[1].trim()
  if (DADO.test(nome)) return null
  const semAncoras = nome.replace(new RegExp(QUALQUER_ANCORA.source, 'gi'), ' ')
  if (!/\p{L}{2}/u.test(semAncoras)) return null
  return { nome, fim: achado[0].length }
}
