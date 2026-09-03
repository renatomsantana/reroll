import type { PdfField, PdfSheet } from '@shared/types/sheetImport'
import { valorDeFicha } from './generic'

/**
 * LER UMA FICHA PELA POSIÇÃO DOS CAMPOS.
 *
 * As fichas editáveis da Luz Negra (Breu, Tenebra, Infaernum) são ARTE com formulário por cima: o
 * texto impresso é desenho (Tenebra e Infaernum não têm um fragmento de texto sequer) e os nomes de
 * campo são os automáticos do editor (`Text1.0.1.0.1…`, `Campo de Texto12`, `Text Field 4`). Nem
 * rótulo impresso nem nome de campo dizem o que uma caixa é. O que diz é ONDE ela está: a caixa
 * em (74, 710) da ficha de Tenebra é a "Assinatura do Sobrevivente" em toda cópia daquele modelo,
 * porque o modelo é o mesmo arquivo.
 *
 * Então cada leitor desses sistemas carrega um MAPA medido no PDF em branco (`scripts` de
 * sondagem, 02/09/2026): retângulos em pontos, origem embaixo à esquerda, como o `rect` de
 * `PdfField`. Um campo "está" numa região quando o CENTRO dele cai dentro dela, com folga de uns
 * pontos: é o que tolera a diferença de décimos entre versões exportadas do mesmo modelo, sem
 * deixar a caixa vizinha (a 15 ou 20 pontos) entrar no lugar.
 *
 * O mesmo mapa serve pra RECONHECER a ficha: um modelo é identificado por meia dúzia de
 * retângulos-âncora que só ele tem naquele lugar e naquele tamanho (`ancorasPresentes`).
 */
export interface Regiao {
  page: number
  x: number
  y: number
  w: number
  h: number
}

/** Atalho pra escrever os mapas: `r(1, 74, 710, 168, 60)`. */
export function r(page: number, x: number, y: number, w: number, h: number): Regiao {
  return { page, x, y, w, h }
}

function centro(campo: PdfField): { x: number; y: number } {
  return { x: (campo.rect[0] + campo.rect[2]) / 2, y: (campo.rect[1] + campo.rect[3]) / 2 }
}

export function centroDentro(campo: PdfField, regiao: Regiao, folga = 3): boolean {
  if (campo.page !== regiao.page) return false
  const c = centro(campo)
  return c.x >= regiao.x - folga && c.x <= regiao.x + regiao.w + folga && c.y >= regiao.y - folga && c.y <= regiao.y + regiao.h + folga
}

/** Os campos cujo centro cai na região, na ordem da ficha. */
export function camposEm(sheet: PdfSheet, regiao: Regiao, folga = 3): PdfField[] {
  return sheet.fields.filter((campo) => centroDentro(campo, regiao, folga))
}

/**
 * O texto escrito na região: o primeiro campo de texto preenchido, com a mesma régua do resto do
 * importador (`valorDeFicha`: vazio, "Off" e instrução de fábrica são `null`). Com `cru`, o valor
 * vem como foi digitado, COM as quebras de linha: é o que uma caixa de várias linhas (a lista de
 * itens dos Bolsos de Tenebra, as Tralhas de Infaernum) precisa pra virar um item por linha.
 */
export function textoEm(sheet: PdfSheet, regiao: Regiao, opcoes: { cru?: boolean; folga?: number } = {}): string | null {
  for (const campo of camposEm(sheet, regiao, opcoes.folga ?? 3)) {
    if (campo.type === 'checkbox' || campo.type === 'radiobutton' || campo.type === 'btn') continue
    const valor = valorDeFicha(campo.value, campo.type)
    if (valor !== null) return opcoes.cru ? campo.value.trim() : valor
  }
  return null
}

/**
 * As caixas de marcar da região: quantas estão MARCADAS e quantas existem. É como a ficha de
 * Tenebra guarda as Gotas de Suor (cinco caixas por Disposição) e a de Infaernum as Desgraças.
 * Quando a região tem caixas de nome com um prefixo dado (`prefixo`), só elas contam: a Barra de
 * Feridas de Tenebra tem duas camadas de caixa no mesmo lugar (`fr` e `tr`), e contar as duas
 * dobraria a ferida.
 */
export function marcadasEm(sheet: PdfSheet, regiao: Regiao, prefixo?: RegExp, folga = 3): { marcadas: number; total: number } {
  let caixas = camposEm(sheet, regiao, folga).filter((campo) => campo.type === 'checkbox' || campo.type === 'radiobutton' || campo.type === 'btn')
  if (prefixo) {
    const soDoPrefixo = caixas.filter((campo) => prefixo.test(campo.name))
    if (soDoPrefixo.length > 0) caixas = soDoPrefixo
  }
  const marcadas = caixas.filter((campo) => valorDeFicha(campo.value, campo.type) === 'sim').length
  return { marcadas, total: caixas.length }
}

/**
 * As marcas que são BOTÕES MOSTRADOS OU ESCONDIDOS, e não caixas de marcar.
 *
 * É como a ficha editável de Tenebra guarda as Gotas de Suor, a Fadiga, a Barra de Feridas, a
 * Proteção e o Óleo (medido em 02/09/2026): cada gota é um botão de imagem (`fo0`…`fo19`) que
 * nasce OCULTO, e o botão visível ao lado ("Pressionar Botão3") roda um script que o mostra ou
 * esconde. Não há valor gravado em lugar nenhum: a gota está acesa quando o botão dela não está
 * oculto. O extrator traz esses botões marcados com `oculto` (ver `PdfField.oculto`), e é a
 * ausência da marca que conta. `prefixo` separa as camadas que dividem o mesmo lugar (`fr` e `tr`
 * na Barra de Feridas).
 */
export function acesosEm(sheet: PdfSheet, regiao: Regiao, prefixo: RegExp, folga = 3): { marcadas: number; total: number } {
  const botoes = camposEm(sheet, regiao, folga).filter((campo) => prefixo.test(campo.name))
  return { marcadas: botoes.filter((campo) => !campo.oculto).length, total: botoes.length }
}

/**
 * Quantas âncoras têm um campo no lugar: mesmo centro (com folga) e tamanho parecido. É a
 * assinatura de um modelo de ficha sem texto e sem nome de campo — ver o cabeçalho.
 */
export function ancorasPresentes(sheet: PdfSheet, ancoras: Regiao[], folga = 4): number {
  return ancoras.filter((ancora) =>
    sheet.fields.some((campo) => {
      if (!centroDentro(campo, ancora, folga)) return false
      const w = campo.rect[2] - campo.rect[0]
      const h = campo.rect[3] - campo.rect[1]
      return Math.abs(w - ancora.w) <= folga * 2 && Math.abs(h - ancora.h) <= folga * 2
    })
  ).length
}

/** As linhas de um campo de texto com várias linhas, sem as vazias. */
export function linhasDe(texto: string | null): string[] {
  if (!texto) return []
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
}
