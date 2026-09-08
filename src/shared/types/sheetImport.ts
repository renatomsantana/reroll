import type { DiceExpression } from './dice'
import type { PresetInput } from './preset'
import type { SheetBlockKey } from './sheetBlocks'
import type { CampoMontado } from './montarFicha'
import type { SheetRollKind } from './sheetRoll'
import type { SheetWarningId } from './sheetWarning'

/**
 * O que se consegue LER de um PDF, antes de qualquer interpretação de sistema de RPG. É a fronteira
 * do importador: quem extrai (`extractPdfSheet.ts`) faz IO e devolve isto; quem interpreta (os
 * leitores em `sheets/readers/`) é função PURA daqui pra `SheetImport`. Por isso dá pra testar leitor
 * sem PDF nenhum no repositório, e as fichas de referência estão no `.gitignore`.
 */
export interface PdfSheet {
  /** Nome do arquivo, sem caminho — entra como palpite de nome do personagem em último caso. */
  fileName: string
  pageCount: number
  /**
   * Campos de FORMULÁRIO (AcroForm), quando a ficha tiver. É a fonte boa: vem com nome e valor, sem
   * depender de posição na página. A ficha de Ordem Paranormal tem 458 deles; a de Oblivio, nenhum.
   */
  fields: PdfField[]
  /** Todo o texto IMPRESSO, com posição — a fonte para fichas sem formulário. */
  texts: PdfText[]
  /**
   * O RETRATO embutido na página de identificação, como data URL (spec §3.6; ver
   * `retratoDoPdf.ts`). Ausente quando não há imagem que sirva — e isso nunca segura a importação.
   */
  retrato?: string
  /**
   * As PÁGINAS desenhadas em imagem (ver `paginasDaFicha.ts`): pra conferência mostrar o PDF ao
   * lado dos campos e pra Ficha guardar a ficha original. Ausente quando não deu pra desenhar.
   */
  paginas?: string[]
}

export interface PdfField {
  name: string
  /** `text`, `checkbox`, `radiobutton`, `combobox`… como o pdf.js classifica. */
  type: string
  value: string
  page: number
  /** Retângulo do campo na página, em pontos: `[x0, y0, x1, y1]`, origem embaixo à esquerda. */
  rect: [number, number, number, number]
  /**
   * Campo que a pessoa NÃO VÊ (bandeiras HIDDEN/NOVIEW do PDF). O genérico o ignora por inteiro: é
   * onde formulário calculado esconde total interno, e um "TOTAL_INTERNO = 999" tem cara de dado
   * lido. O leitor DEDICADO precisa dele (as Gotas de Suor de Tenebra, o modificador de perícia de
   * Tormenta20). Vêm no FIM da lista, pra um mapa "primeiro nome ganha" preferir o visível.
   */
  oculto?: boolean
}

export interface PdfText {
  text: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * O resultado da leitura de uma ficha: o que vai virar personagem no app. Nada aqui é gravado
 * direto — isto alimenta a TELA DE CONFERÊNCIA, e é o usuário que confirma. Importador que grava
 * sozinho cria, no primeiro PDF estranho, um personagem chamado "Assinatura do Mestre".
 */
export interface SheetImport {
  /** Qual leitor produziu isto, e o quanto ele confia — a tela mostra os dois. */
  readerId: string
  readerLabel: string
  confidence: number
  characterName: string
  /** Sistema de RPG, quando o leitor souber dizer. Vira o campo `system` do perfil. */
  system: string
  /**
   * Tudo que foi lido, em pares rótulo/valor. Guardado como lista, e não como texto já montado, pra
   * tela poder mostrar em duas colunas e pro usuário poder desmarcar o que não quer.
   */
  fields: SheetImportField[]
  presets: SheetImportPreset[]
  /**
   * Avisos pra tela: ficha sem formulário, campo esperado que não veio, expressão que não deu pra
   * entender. Silêncio aqui vira "o app importou errado". São IDENTIFICADORES e não frases, porque o
   * texto mora no dicionário de tradução (ver `sheetWarning.ts`).
   */
  warnings: SheetWarningId[]
  /**
   * O texto da ficha que NÃO deu pra rotular, na ordem da página. Existe pra ficha que é arte com
   * anotação por cima (ver `anotacoesSobreImagem.ts`): ali os nomes dos campos são desenho. Jogar
   * fora seria perder a ficha inteira; inventar rótulo seria pior.
   */
  rawText?: string
  /** O retrato candidato (ver `PdfSheet.retrato`), passado adiante pra conferência oferecer. */
  retrato?: string
  /** As páginas desenhadas (ver `PdfSheet.paginas`), passadas adiante do mesmo jeito. */
  paginas?: string[]
}

export interface SheetImportField {
  label: string
  value: string
  /** Seção da ficha ("Atributos", "Perícias"), quando o leitor souber agrupar. */
  group?: string
  /**
   * Nome do campo do PDF de onde este valor saiu, quando veio de um formulário: é como um leitor
   * dedicado diz com exatidão "este eu já tratei" sobre o que o genérico produziu. Casar por VALOR
   * confundiria dois campos de mesmo conteúdo, e numa ficha de RPG metade dos atributos é "2".
   */
  fieldName?: string
  /**
   * COMO SE ROLA este campo, quando ele for de rolar (ver `sheetRoll.ts`). Só um leitor de sistema
   * preenche: o mesmo "3" é 1d20-3 num sistema e "role 3d20 e fique com o maior" noutro. Ausente é o
   * normal, e aí a ficha ainda tenta ler notação de dado do próprio valor.
   */
  roll?: SheetRollKind
}

/**
 * Um preset proposto. `kind` existe porque um ataque de RPG são DUAS rolagens — o teste de acerto e
 * o dano —, e um preset guarda uma expressão só (ver `Preset` em `preset.ts`). Então cada ataque
 * lido vira até dois presets, e o `kind` é o que a tela usa pra dizer qual é qual.
 */
export interface SheetImportPreset {
  name: string
  kind: 'test' | 'damage' | 'other'
  expression: DiceExpression
  /** Texto original de onde a expressão saiu, pra tela poder mostrar "veio daqui". */
  source: string
  /**
   * Campo do PDF de onde a expressão saiu, mesmo papel que em `SheetImportField`: casar por texto
   * confunde duas armas que causam o mesmo dano.
   */
  fieldName?: string
}

/**
 * Limite de tamanho do PDF que o app aceita abrir, em bytes. É o custo real do caminho: os bytes são
 * lidos no processo principal, CLONADOS pelo IPC pra chegar ao renderer e clonados de novo pelo
 * pdf.js, então centenas de megabytes viram mais de um gigabyte de memória viva e o app morre calado.
 * 80 MB é folgado: a maior ficha de referência tem 4.5 MB, e uma digitalizada em alta chega a 50 MB.
 */
export const TAMANHO_MAXIMO_DA_FICHA = 80 * 1024 * 1024

/**
 * Quantas páginas do PDF são varridas; daí pra cima o arquivo é ignorado, com um aviso no console.
 * O teto de BYTES não cobre isto: página quase não custa espaço, então poucos megabytes podem
 * declarar dezenas de milhares delas, e a varredura custa por página (duas chamadas ao pdf.js em
 * cada) — minutos de ampulheta sem cancelar. A maior ficha de referência tem 5 páginas.
 */
export const MAXIMO_DE_PAGINAS_DA_FICHA = 100

/**
 * Quantos CAMPOS de formulário e quantos FRAGMENTOS de texto a varredura guarda, no total. É o teto
 * que custa caro: os leitores fazem conta de distância entre cada campo e cada texto, ou seja,
 * campos × textos. Cinco mil campos e duzentos mil fragmentos cabem em poucos megabytes e dão um
 * bilhão de comparações, congelando a janela. A maior ficha real tem 458 campos e 886 fragmentos.
 */
export const MAXIMO_DE_CAMPOS_DA_FICHA = 5_000
export const MAXIMO_DE_TEXTOS_DA_FICHA = 50_000

/**
 * O resultado de escolher um PDF, com o MOTIVO quando não deu. Era `PickedPdf | null`, e o `null` só
 * dizia "o usuário fechou o diálogo": tudo que falhava ANTES da leitura (arquivo removido, pasta de
 * rede caída, permissão negada) virava promessa rejeitada fora do `try` do renderer, e o botão
 * simplesmente não fazia nada.
 */
export type PdfEscolhido =
  | { ok: true; fileName: string; bytes: Uint8Array }
  | { ok: false; motivo: 'cancelado' }
  | { ok: false; motivo: 'muito-grande'; tamanho: number }
  | { ok: false; motivo: 'ilegivel'; detalhe: string }
  /** Não tem a assinatura de PDF: outro tipo de arquivo (ver `parecePacoteDoReroll` pro caso especial). */
  | { ok: false; motivo: 'nao-e-pdf' }
  /** É o personagem exportado pelo Reroll: o botão certo é "Importar personagem Reroll". */
  | { ok: false; motivo: 'pacote-do-reroll' }

export interface SheetApplyPayload {
  /**
   * Personagem de destino, quando a importação for pra ATUALIZAR um que já existe; ausente = criar
   * novo. O caso é o de toda sessão: o jogador sobe de nível, salva o PDF e importa. Sem isto o app
   * criava um SEGUNDO personagem de mesmo nome, e escolher um significava perder o diário do outro.
   * Id que não existe mais cai no caminho de criar novo: perder a importação inteira seria pior.
   */
  targetProfileId?: string
  characterName: string
  system: string
  /**
   * As SEÇÕES da ficha, com os nomes que o sistema de RPG dá a elas, e só o que ficou marcado na
   * conferência. Já foi uma string só e depois três (atributos, habilidades, história), e ele apontou
   * o mesmo defeito nas duas: espremiam uma ficha inteira em blocos fixos que o app inventou. Quem
   * manda na forma da ficha é o SISTEMA, e a aba Ficha desenha o que veio.
   */
  notes: {
    /** Texto pros blocos livres da ficha (atributos, habilidades, inventário, aparência, história). */
    blocks: Partial<Record<SheetBlockKey, string>>
    sections: { title: string; fields: CampoMontado[] }[]
  }
  presets: PresetInput[]
  /**
   * As BARRAS de recurso que a conferência deixou marcadas (ver `extrairRecursos.ts`), já com
   * número dos dois lados. Ausente numa versão de renderer anterior a elas — e aí a ficha entra sem
   * barra, como sempre entrou.
   */
  recursos?: RecursoImportado[]
  /**
   * A FOTO do personagem escolhida na conferência (spec §3.6): a do PDF, uma que a pessoa
   * escolheu, ou nada. `null`/ausente NÃO apaga a foto de um personagem atualizado — "sem retrato"
   * na conferência quer dizer "não traga este", não "tire o que já tinha".
   */
  photo?: string | null
  /**
   * As PÁGINAS do PDF (ver `paginasDaFicha.ts`) pra ficar na pasta do personagem. Ausente ou vazio
   * NÃO apaga as que um personagem atualizado já tinha; com páginas, substitui.
   */
  paginas?: string[]
}

export interface RecursoImportado {
  nome: string
  atual: number
  maximo: number
}

/**
 * Campos por SEÇÃO da ficha, cobrado na gravação (`LIMITES_DA_FICHA`) e avisado na conferência —
 * antes só a gravação sabia, e cortava calada: 5.001 campos passavam pela conferência inteiros e
 * chegavam ao disco 2.000. Nenhuma ficha real chega perto; o teto é pra entrada adversarial.
 */
export const MAXIMO_DE_CAMPOS_POR_SECAO = 2_000
