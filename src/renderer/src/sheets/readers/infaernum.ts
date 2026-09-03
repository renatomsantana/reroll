import type { PdfSheet, SheetImport, SheetImportField } from '@shared/types/sheetImport'
import { extrairGenerico } from './generic'
import { ancorasPresentes, camposEm, linhasDe, marcadasEm, r, textoEm, type Regiao } from './porPosicao'
import type { SheetReader } from './types'

/**
 * Leitor da ficha de INFAERNUM (Luz Negra Editora), o "RPG de apocalipse brutal": narrativo, joga-se
 * com três d6 e um baralho, e o personagem não tem atributo com número. A ficha editável oficial
 * (`Ficha de Personagem Editável - Infaernum`, 02/09/2026) é uma página de arte com sete caixas de
 * texto e seis caixinhas, nomeadas `Text Field 1` e `Check Box 4` — e sem um fragmento de texto
 * impresso. O que cada caixa é foi medido na arte (ver `porPosicao.ts`):
 *
 * - "Quem é você?", a faixa no alto: quem é o personagem, e de onde sai o nome;
 * - Sorte (à esquerda, em cima) e Azar (à esquerda, embaixo): o que joga a favor e contra;
 * - Desgraças: seis caixinhas na testa da caveira, que se marcam conforme o fim se aproxima;
 * - Maldição (logo abaixo das Desgraças) e Bênção (a faixa na boca da caveira);
 * - Tormentos (a coluna à direita) e Tralhas (o quadro embaixo).
 */
const REGIOES = {
  quemEVoce: r(1, 106, 504, 225, 43),
  sorte: r(1, 20, 372, 86, 64),
  azar: r(1, 30, 227, 97, 69),
  tormentos: r(1, 307, 265, 93, 152),
  maldicao: r(1, 129, 347, 154, 43),
  bencao: r(1, 156, 181, 132, 32),
  tralhas: r(1, 105, 21, 217, 73),
  desgracas: r(1, 120, 430, 170, 40)
}

const ANCORAS: Regiao[] = [REGIOES.quemEVoce, REGIOES.sorte, REGIOES.azar, REGIOES.tormentos, REGIOES.maldicao, REGIOES.bencao, REGIOES.tralhas]

const GRUPOS = {
  identificacao: 'Identificação',
  recursos: 'Recursos',
  habilidades: 'Habilidades',
  historia: 'História',
  inventario: 'Inventário'
}

function confianca(sheet: PdfSheet): number {
  if (sheet.fields.length === 0 || sheet.fields.length > 40) return 0
  const achadas = ancorasPresentes(sheet, ANCORAS)
  if (achadas >= 5) return 0.95
  if (achadas >= 3) return 0.6
  return 0
}

function extrair(sheet: PdfSheet): SheetImport {
  const base = extrairGenerico(sheet, 'infaernum', 'Infaernum', 0.95)
  const campos: SheetImportField[] = []
  const consumidos = new Set<string>()
  const pegar = (regiao: Regiao, cru = false): string | null => {
    for (const campo of camposEm(sheet, regiao)) consumidos.add(campo.name)
    return textoEm(sheet, regiao, { cru })
  }
  const push = (label: string, valor: string | null, group: string): void => {
    if (valor) campos.push({ label, value: valor, group })
  }

  /** O nome é a primeira linha de "Quem é você?": é assim que se apresenta um personagem ali. */
  const quemEVoce = pegar(REGIOES.quemEVoce, true)
  const nome = linhasDe(quemEVoce)[0] ?? ''
  push('Quem é você', quemEVoce ? quemEVoce.replace(/\s+/g, ' ') : null, GRUPOS.identificacao)

  /**
   * As DESGRAÇAS como barra que sobe: "2/6" é o que a testa da caveira mostra, e é o número que a
   * mesa acompanha. Só numa ficha com dono; um modelo em branco não tem desgraça nenhuma.
   */
  const desgracas = marcadasEm(sheet, REGIOES.desgracas)
  for (const campo of camposEm(sheet, REGIOES.desgracas)) consumidos.add(campo.name)
  if (nome && desgracas.total > 0) push('Desgraças', `${desgracas.marcadas}/${desgracas.total}`, GRUPOS.recursos)

  push('Sorte', pegar(REGIOES.sorte), GRUPOS.habilidades)
  push('Azar', pegar(REGIOES.azar), GRUPOS.habilidades)
  push('Bênção', pegar(REGIOES.bencao), GRUPOS.habilidades)
  push('Maldição', pegar(REGIOES.maldicao), GRUPOS.habilidades)
  push('Tormentos', pegar(REGIOES.tormentos), GRUPOS.historia)
  for (const tralha of linhasDe(pegar(REGIOES.tralhas, true))) campos.push({ label: tralha, value: '', group: GRUPOS.inventario })

  const restantes = base.fields.filter((campo) => !campo.fieldName || !consumidos.has(campo.fieldName))
  return {
    ...base,
    characterName: nome || base.characterName,
    system: 'Infaernum',
    // O genérico não achou nome nem rolagem (não há rótulo que diga "nome"); este leitor achou.
    warnings: base.warnings.filter((aviso) => !(nome && aviso === 'sem-nome-nem-rolagem')),
    fields: [...campos, ...restantes],
    // Sem rótulo impresso, o genérico mandava TUDO pro texto sem rótulo; aqui cada caixa tem lugar.
    rawText: undefined
  }
}

export const infaernumReader: SheetReader = {
  id: 'infaernum',
  label: 'Infaernum',
  detect: confianca,
  extract: (sheet) => extrair(sheet)
}
