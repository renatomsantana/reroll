import type { PdfField, PdfSheet, SheetImport, SheetImportField } from '@shared/types/sheetImport'
import { extrairGenerico, valorDeFicha } from './generic'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de ASSIMILAÇÃO — nascido da ficha real do Kieran, que chegou "não bem organizada"
 * pelo genérico: 27 campos numa seção "Outros", caixa marcada virando "Aptidao40 = sim".
 *
 * O arquivo é ARTE DIGITALIZADA com formulário por cima: sondado página a página, tem ZERO texto
 * impresso — os nomes de instintos e aptidões são pixel. O que existe de verdade são os NOMES DE
 * CAMPO (288), e é deles que a organização sai:
 *
 * - `Nome`, `Evento`, `Ocupacao`, `geracao`, `Propositos_Pessoais(1)`, `Proposito_Coletivo` — a
 *   identificação;
 * - `Saude`, `Det`, `Ass` — os três recursos do sistema (Saúde 18, Determinação 8, Assimilação 2
 *   na ficha do Kieran), cada um com uma TRILHA de toggles (`ptSaude×66`, `btnDet×10`,
 *   `btnAss×10`) que é desenho de marcar na tela, não valor — fica de fora;
 * - `Instinto_1..24` e `Aptidao1..60` — caixinhas cujo NOME está na arte. O que dá pra dizer com
 *   verdade é QUAIS números estão marcados, numa linha só ("5, 21, 22") — melhor que 10 linhas
 *   "Aptidao40 = sim", e sem inventar nome que o arquivo não tem;
 * - `Car_1..4` (características) e `Assimilacao1..4` (mutações) — textos longos, que vão pro bloco
 *   de Habilidades; `Notas` vai pra História.
 */

const GRUPOS = {
  identificacao: 'Identificação',
  recursos: 'Recursos',
  marcados: 'Instintos e aptidões',
  habilidades: 'Habilidades',
  historia: 'História'
}

/** Caixa marcada no PDF: qualquer valor que não seja vazio nem Off (este arquivo grava "Yes"). */
function marcada(campo: PdfField): boolean {
  return valorDeFicha(campo.value, campo.type) !== null
}

/** Os números das caixinhas marcadas de um prefixo, em ordem: "5, 21, 22". */
function numerosMarcados(sheet: PdfSheet, padrao: RegExp): string {
  return sheet.fields
    .filter((campo) => padrao.test(campo.name) && marcada(campo))
    .map((campo) => Number(campo.name.replace(/\D+/g, '')))
    .sort((a, b) => a - b)
    .join(', ')
}

/** O que este leitor consome — o resto (se um dia houver) passa pelo genérico. */
const CONSUMIDOS = [
  /^(Instinto_|Aptidao|ptSaude|TgptSaude|btnDet|btnAss|Invent)\d/i,
  /^btn(Det|Ass)\d+Toggle$/,
  /^(Nome|Evento|Ocupacao|geracao|Saude|Det|Ass|Notas)$/,
  /^Car_\d$/,
  /^Assimilacao\d$/,
  /^Propositos?_/
]

export const assimilacaoReader: SheetReader = {
  id: 'assimilacao',
  label: 'Assimilação',

  /**
   * Reconhece pela COMBINAÇÃO de nomes que só esta ficha tem: a grafia `geracao` +
   * `Propositos_Pessoais` + as grades numeradas de instinto/aptidão. Estrutura, não texto — a
   * página nem tem texto.
   */
  detect: (sheet) => {
    if (sheet.fields.length === 0) return 0
    const nomes = new Set(sheet.fields.map((campo) => campo.name))
    const marcas = ['geracao', 'Propositos_Pessoais', 'Saude', 'Det', 'Ass', 'Assimilacao1'].filter((n) =>
      nomes.has(n)
    ).length
    const temGrades = sheet.fields.some((campo) => /^(Instinto_|Aptidao)\d/.test(campo.name))
    if (marcas >= 4 && temGrades) return 0.95
    if (marcas >= 3) return 0.6
    return 0
  },

  extract: (sheet) => extrairAssimilacao(sheet)
}

function extrairAssimilacao(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'assimilacao', 'Assimilação', 0.95)

  const porNome = new Map<string, PdfField>()
  for (const campo of sheet.fields) if (!porNome.has(campo.name)) porNome.set(campo.name, campo)
  const bruto = (nome: string): string | null => {
    const campo = porNome.get(nome)
    return campo ? valorDeFicha(campo.value, campo.type) : null
  }

  const nome = bruto('Nome') ?? ''
  const temDono = nome !== ''

  const campos: SheetImportField[] = []
  const push = (label: string, valor: string | null, group: string, sempre = false, fieldName?: string): void => {
    if (valor) campos.push({ label, value: valor, group, fieldName })
    else if (sempre && temDono) campos.push({ label, value: '', group, fieldName })
  }

  push('Nome', nome || null, GRUPOS.identificacao, true, 'Nome')
  push('Ocupação', bruto('Ocupacao'), GRUPOS.identificacao, true, 'Ocupacao')
  push('Geração', bruto('geracao'), GRUPOS.identificacao, true, 'geracao')
  push('Evento', bruto('Evento'), GRUPOS.identificacao, false, 'Evento')
  push('Propósito pessoal 1', bruto('Propositos_Pessoais'), GRUPOS.identificacao, true, 'Propositos_Pessoais')
  push('Propósito pessoal 2', bruto('Propositos_Pessoais1'), GRUPOS.identificacao, true, 'Propositos_Pessoais1')
  push('Propósito coletivo', bruto('Proposito_Coletivo'), GRUPOS.identificacao, true, 'Proposito_Coletivo')

  push('Saúde', bruto('Saude'), GRUPOS.recursos, true, 'Saude')
  push('Determinação', bruto('Det'), GRUPOS.recursos, true, 'Det')
  push('Assimilação', bruto('Ass'), GRUPOS.recursos, true, 'Ass')

  /**
   * Os NÚMEROS marcados, numa linha por grade. O nome de cada caixinha é arte — dizer "quais
   * números" é tudo o que o arquivo permite dizer sem inventar, e a pessoa confere no papel.
   */
  const instintos = numerosMarcados(sheet, /^Instinto_\d+$/)
  const aptidoes = numerosMarcados(sheet, /^Aptidao\d+$/)
  push('Instintos marcados', instintos || null, GRUPOS.marcados, true)
  push('Aptidões marcadas', aptidoes || null, GRUPOS.marcados, true)

  for (let i = 1; i <= 4; i++) push(`Característica ${i}`, bruto(`Car_${i}`), GRUPOS.habilidades, false, `Car_${i}`)
  for (let i = 1; i <= 4; i++) push(`Assimilação ${i}`, bruto(`Assimilacao${i}`), GRUPOS.habilidades, false, `Assimilacao${i}`)

  push('Notas', bruto('Notas'), GRUPOS.historia, false, 'Notas')

  const consumido = (nomeDoCampo: string | undefined): boolean =>
    nomeDoCampo !== undefined && CONSUMIDOS.some((padrao) => padrao.test(nomeDoCampo))
  const restantes = base.fields.filter((campo) => !consumido(campo.fieldName))

  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Assimilação',
    warnings: base.warnings,
    fields: [...campos, ...restantes],
    presets: base.presets.filter((preset) => !consumido(preset.fieldName))
  }
}
