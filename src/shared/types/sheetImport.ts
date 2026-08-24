import type { DiceExpression } from './dice'
import type { PresetInput } from './preset'
import type { SheetBlockKey } from './sheetBlocks'
import type { CampoMontado } from './montarFicha'
import type { SheetRollKind } from './sheetRoll'
import type { SheetWarningId } from './sheetWarning'

/**
 * O que se consegue LER de um PDF, antes de qualquer interpretação de sistema de RPG.
 *
 * É a fronteira do desenho inteiro do importador: quem extrai (`extractPdfSheet.ts`) faz IO e
 * devolve isto; quem interpreta (os leitores em `sheets/readers/`) é função PURA daqui pra
 * `SheetImport`. É o que permite testar leitor de ficha sem PDF nenhum no repositório — e as fichas
 * de referência estão no `.gitignore`, então não haveria como testar de outro jeito.
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
}

export interface PdfField {
  name: string
  /** `text`, `checkbox`, `radiobutton`, `combobox`… como o pdf.js classifica. */
  type: string
  value: string
  page: number
  /** Retângulo do campo na página, em pontos: `[x0, y0, x1, y1]`, origem embaixo à esquerda. */
  rect: [number, number, number, number]
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
 * O resultado da leitura de uma ficha: o que vai virar personagem no app.
 *
 * Nada aqui é gravado direto — isto alimenta a TELA DE CONFERÊNCIA, e é o usuário que confirma. Um
 * importador de ficha que grava sozinho o que achou é um importador que, no primeiro PDF estranho,
 * cria um personagem chamado "Assinatura do Mestre" com quatro presets de lixo.
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
   * Tudo que foi lido, em pares rótulo/valor — vira o texto das anotações do personagem. Guardado
   * como lista, e não como texto já montado, pra tela poder mostrar em duas colunas e pro usuário
   * poder desmarcar o que não quer.
   */
  fields: SheetImportField[]
  presets: SheetImportPreset[]
  /**
   * Avisos pra tela: ficha sem formulário, campo esperado que não veio, expressão que não deu pra
   * entender. O usuário precisa saber o que NÃO foi lido — silêncio aqui vira "o app importou
   * errado".
   *
   * São IDENTIFICADORES, e não frases: o texto mora no dicionário de tradução, porque a interface
   * tem dois idiomas e o aviso é a mensagem que mais precisa ser entendida. Ver `sheetWarning.ts`.
   */
  warnings: SheetWarningId[]
  /**
   * O texto da ficha que NÃO deu pra rotular, na ordem em que está na página.
   *
   * Existe pra ficha que é uma arte com anotação por cima (ver `anotacoesSobreImagem.ts`): ali os
   * nomes dos campos são desenho, então o que a pessoa escreveu não tem como virar par rótulo/valor.
   * Jogar isso fora seria perder a ficha inteira; inventar rótulo seria pior. Vai como texto, e a
   * tela de conferência mostra pra pessoa decidir.
   */
  rawText?: string
}

export interface SheetImportField {
  label: string
  value: string
  /** Seção da ficha ("Atributos", "Perícias"), quando o leitor souber agrupar. */
  group?: string
  /**
   * Nome do campo do PDF de onde este valor saiu, quando veio de um formulário.
   *
   * Existe pra um leitor dedicado poder dizer com exatidão "este eu já tratei" sobre o que o leitor
   * genérico produziu. A alternativa — casar por valor — confunde dois campos que por acaso
   * tenham o mesmo conteúdo, e numa ficha de RPG isso é rotina: metade dos atributos é "2".
   */
  fieldName?: string
  /**
   * COMO SE ROLA este campo, quando ele for de rolar (ver `sheetRoll.ts`).
   *
   * Só um leitor de sistema preenche isto, porque só ele sabe o que o número quer dizer: o mesmo "3"
   * é 1d20-3 num sistema e "role 3d20 e fique com o maior" noutro. Ausente é o normal — nome, classe
   * e deslocamento não se rolam —, e aí a ficha ainda tenta ler notação de dado do próprio valor.
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
   * Campo do PDF de onde a expressão saiu, quando veio de um formulário. Mesmo papel que em
   * `SheetImportField`: um leitor dedicado precisa poder dizer com exatidão "esta célula eu já
   * tratei", e casar por texto confunde duas armas que causam o mesmo dano.
   */
  fieldName?: string
}

/**
 * Limite de tamanho do PDF que o app aceita abrir, em bytes.
 *
 * Não é desconfiança do arquivo, é o custo real do caminho: os bytes são lidos no processo
 * principal, CLONADOS pelo IPC pra chegar ao renderer e clonados de novo pelo pdf.js ao abrir. Um
 * arquivo de centenas de megabytes vira mais de um gigabyte de memória viva antes de qualquer
 * leitura, e o app morre sem dizer nada — que é o pior desfecho possível pra quem só arrastou um
 * arquivo.
 *
 * 80 MB é folgado de propósito: a maior das fichas de referência tem 4.5 MB, e uma ficha
 * DIGITALIZADA em alta resolução chega perto de 50 MB. Acima disso deixa de ser ficha de personagem.
 */
export const TAMANHO_MAXIMO_DA_FICHA = 80 * 1024 * 1024

/**
 * Quantas páginas do PDF são varridas. A partir daí o arquivo é ignorado, com um aviso no console.
 *
 * O limite de BYTES acima não cobre este caso, e é por isso que existem os dois: página de PDF quase
 * não custa espaço, então um arquivo de poucos megabytes pode declarar dezenas de milhares delas. Só
 * que a varredura custa por PÁGINA (duas chamadas assíncronas ao pdf.js em cada uma), e uma ficha
 * dessas deixa a importação rodando por minutos com uma ampulheta que não tem botão de cancelar —
 * pra quem está olhando, o app pendurou.
 *
 * 100 é muito acima do real: a maior ficha de referência tem 5 páginas, e um livro de personagem
 * inteiro não passa de algumas dezenas. Acima disso não é ficha de personagem.
 */
export const MAXIMO_DE_PAGINAS_DA_FICHA = 100

/**
 * Quantos CAMPOS de formulário e quantos FRAGMENTOS de texto a varredura guarda, no total.
 *
 * Os dois tetos acima (bytes e páginas) não cobrem este caso, e ele é o que custa caro: os leitores
 * fazem conta de distância entre cada campo e cada texto da página (`labelForField`,
 * `rotulosExclusivos`, `nomeDaPericia`), ou seja, campos × textos. Um PDF de UMA página com cinco
 * mil campos e duzentos mil fragmentos — cabe em poucos megabytes — são um bilhão de comparações
 * dentro do renderer, e a janela inteira congela sem botão de cancelar. Medido nas fichas reais:
 * a maior tem 458 campos e 886 fragmentos. Os tetos são dez e cinquenta vezes isso.
 */
export const MAXIMO_DE_CAMPOS_DA_FICHA = 5_000
export const MAXIMO_DE_TEXTOS_DA_FICHA = 50_000

/**
 * O resultado de escolher um PDF, com o MOTIVO quando não deu.
 *
 * Era `PickedPdf | null`, e o `null` significava só "o usuário fechou o diálogo" — então tudo o que
 * dava errado ANTES da leitura (arquivo removido entre escolher e abrir, pasta de rede que caiu,
 * permissão negada, arquivo grande demais) virava uma promessa rejeitada. E a chamada no renderer
 * está fora do `try` que trata falha de leitura, ou seja, esses casos não viravam mensagem nenhuma:
 * o botão simplesmente não fazia nada.
 */
export type PdfEscolhido =
  | { ok: true; fileName: string; bytes: Uint8Array }
  | { ok: false; motivo: 'cancelado' }
  | { ok: false; motivo: 'muito-grande'; tamanho: number }
  | { ok: false; motivo: 'ilegivel'; detalhe: string }

export interface SheetApplyPayload {
  /**
   * Personagem de destino, quando a importação for pra ATUALIZAR um que já existe. Ausente = criar
   * um novo, que é o padrão.
   *
   * Existe por um caso que acontece toda sessão de campanha: o jogador sobe de nível, salva o PDF de
   * novo e importa. Sem isto o app criava um SEGUNDO personagem com o mesmo nome, e recuperar o
   * anterior significava apagar um dos dois — levando junto o diário e as anotações dele, que não
   * estão em PDF nenhum.
   *
   * Id que não existe mais (personagem apagado com a janela de conferência aberta) cai no caminho de
   * criar novo: perder a importação inteira por causa disso seria pior.
   */
  targetProfileId?: string
  characterName: string
  system: string
  /**
   * As SEÇÕES da ficha, com os nomes que o sistema de RPG dá a elas, e só o que o usuário deixou
   * marcado na conferência.
   *
   * Isto já foi uma string só (tudo ia pra história do personagem) e depois três (atributos,
   * habilidades, história). As duas versões tinham o mesmo defeito, que o usuário apontou: espremiam
   * uma ficha de RPG inteira dentro de blocos fixos que o app inventou. Agora quem manda na forma da
   * ficha é o SISTEMA — Ordem Paranormal traz Identificação/Atributos/Recursos, Oblivio traz
   * Identificação/Atributos/Corpo — e a aba Ficha desenha o que veio.
   */
  notes: {
    /** Texto pros blocos livres da ficha (atributos, habilidades, inventário, aparência, história). */
    blocks: Partial<Record<SheetBlockKey, string>>
    sections: { title: string; fields: CampoMontado[] }[]
  }
  presets: PresetInput[]
}

