import { promises as fs } from 'fs'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcChannels'
import { MAX_PROFILES, type Profile } from '@shared/types/profile'
import type { PresetInput } from '@shared/types/preset'
import { SHEET_BLOCK_KEYS, type SheetBlockKey } from '@shared/types/sheetBlocks'
import { normalizarTipoDeRolagem } from '@shared/types/sheetRoll'
import {
  MAXIMO_DE_CAMPOS_POR_SECAO,
  TAMANHO_MAXIMO_DA_FICHA,
  type PdfEscolhido,
  type RecursoImportado,
  type SheetApplyPayload
} from '@shared/types/sheetImport'
import {
  MAXIMO_DE_RECURSOS,
  TAMANHO_MAXIMO_DO_NOME_DO_RECURSO,
  TETO_DO_VALOR_DE_RECURSO,
  fundirRecursos
} from '@shared/types/recursoVital'
import { regraDeCriticoDoSistema } from '@shared/dice/critico'
import { descansosPadrao } from '@shared/types/descanso'
import { isValidPresetInput } from './registerPresetsHandlers'
import { escolherArquivo } from './dialogos'
import type { ProfilesRepository } from '../storage/ProfilesRepository'
import type { NotesRepository } from '../storage/NotesRepository'
import type { PresetsRepository } from '../storage/PresetsRepository'

/**
 * Escolher o PDF e APLICAR o que foi lido dele.
 *
 * A divisão de trabalho entre os dois processos: o principal abre a janela nativa e mexe em disco
 * (renderer não tem acesso a arquivo), e o renderer INTERPRETA o PDF (ver o comentário em
 * `sheets/extractPdfSheet.ts` sobre por que o pdf.js não roda aqui).
 */

/**
 * Lê o PDF escolhido, devolvendo o MOTIVO em vez de estourar quando não dá.
 *
 * Separada do `ipcMain.handle` pra poder ser testada sem Electron (ver `pdfEscolhido.test.ts`) — as
 * falhas que interessam aqui são de sistema de arquivos, e reproduzi-las é fácil; o que era difícil
 * era alcançá-las por trás de um diálogo nativo.
 */
export async function lerPdfEscolhido(caminho: string): Promise<PdfEscolhido> {
  let tamanho: number
  try {
    const info = await fs.stat(caminho)
    // Pasta escolhida no lugar de arquivo: o diálogo não deixa, mas o caminho também chega aqui de
    // outros lugares, e `readFile` numa pasta dá um erro obscuro (EISDIR) em vez de uma explicação.
    if (!info.isFile()) return { ok: false, motivo: 'ilegivel', detalhe: 'não é um arquivo' }
    tamanho = info.size
  } catch (causa) {
    return { ok: false, motivo: 'ilegivel', detalhe: (causa as Error).message }
  }

  // ANTES de ler: o ponto do limite é não trazer os bytes pra memória (ver `TAMANHO_MAXIMO_DA_FICHA`).
  if (tamanho > TAMANHO_MAXIMO_DA_FICHA) return { ok: false, motivo: 'muito-grande', tamanho }

  try {
    const buffer = await fs.readFile(caminho)
    /**
     * A ASSINATURA do formato, e não só a extensão — pedido do spec da importação (Stage 0). Um
     * `.pdf` que não começa com `%PDF-` é outra coisa renomeada: um vídeo, um executável, um zip.
     * O pdf.js recusaria de qualquer jeito, mas recusaria DEPOIS de os bytes atravessarem o IPC e
     * chegarem ao renderer; aqui a recusa é antes, com o motivo certo na tela ("ilegível") em vez
     * de um erro de análise.
     */
    if (!ehPdf(buffer)) return { ok: false, motivo: 'ilegivel', detalhe: 'não é um PDF (assinatura %PDF- ausente)' }
    /**
     * Bytes puros, sem base64: o IPC do Electron serializa `Uint8Array` por conta própria, e uma
     * ficha de RPG passa fácil dos 4 MB — base64 inflaria isso em um terço à toa.
     */
    return { ok: true, fileName: basename(caminho), bytes: new Uint8Array(buffer) }
  } catch (causa) {
    return { ok: false, motivo: 'ilegivel', detalhe: (causa as Error).message }
  }
}

/**
 * Todo PDF começa com `%PDF-` (a versão vem logo depois: `%PDF-1.7`). Alguns geradores põem lixo
 * ou uma quebra de linha antes, e o padrão tolera até 1024 bytes de cabeçalho — por isso a busca é
 * no COMEÇO do arquivo, e não só nos cinco primeiros bytes.
 */
export function ehPdf(bytes: Uint8Array): boolean {
  const cabecalho = Buffer.from(bytes.subarray(0, 1024)).toString('latin1')
  return cabecalho.includes('%PDF-')
}

/**
 * Os limites do que uma ficha pode trazer. Folgados de propósito: a maior ficha de referência (Ordem
 * Paranormal) tem 458 campos, e nenhuma delas chega perto de qualquer número daqui.
 *
 * Eles não existem contra ficha grande, existem contra ficha ABSURDA — um PDF gerado com dez mil
 * campos, ou um defeito num leitor futuro que multiplique seções em laço. O `notes.json` é lido
 * inteiro toda vez que o personagem abre; um arquivo de 300 MB não dá erro, dá um app que demora
 * cinco segundos pra trocar de personagem e ninguém sabe por quê.
 */
export const LIMITES_DA_FICHA = {
  nome: 200,
  sistema: 200,
  /** Por bloco livre (inventário, história...). 200 mil caracteres são ~60 páginas de texto. */
  bloco: 200_000,
  secoes: 200,
  camposPorSecao: MAXIMO_DE_CAMPOS_POR_SECAO,
  presets: 500,
  rotulo: 300,
  valor: 2_000
} as const

/** Texto, cortado no limite. Tipo errado vira vazio — ver o porquê em `validarSheetApplyPayload`. */
function texto(valor: unknown, limite: number, onde: string): string {
  if (typeof valor !== 'string') return ''
  if (valor.length <= limite) return valor
  console.warn(`Ficha importada: ${onde} passava de ${limite} caracteres e foi cortado.`)
  return valor.slice(0, limite)
}

/**
 * O payload da importação, conferido ANTES de qualquer gravação.
 *
 * O motivo de existir não é desconfiar do renderer — ele é código nosso. É que este canal é o ÚNICO
 * que grava três coisas em sequência (perfil, ficha, presets), e sem a conferência aqui um payload
 * torto só estourava no meio: `payload.characterName.trim()` num valor que não é texto derruba o
 * handler DEPOIS de o perfil já ter sido criado e ativado. O resultado é um personagem vazio,
 * aberto, que ninguém pediu — e a ficha, que era o ponto, perdida. Conferir na porta é o que torna a
 * importação tudo-ou-nada.
 *
 * A régua tem dois pesos, e é de propósito:
 *
 * - ESTRUTURA errada (não é objeto, `notes` ausente, `sections` que não é lista) ESTOURA. Não é
 *   ficha estranha, é contrato quebrado — bug meu, ou versão de renderer que não bate com a do main.
 *   A tela mostra o erro de gravação e nada foi tocado.
 * - TAMANHO e tipo de campo solto são CORRIGIDOS: corta no limite, descarta o item torto e segue com
 *   o resto. É a mesma escolha que os presets já fazem logo abaixo ("perder o personagem inteiro por
 *   causa de uma linha de ataque torta seria pior que perder a linha"), e pela mesma razão: o que
 *   chega aqui é o palpite de um leitor sobre um PDF de terceiro, e palpite erra em um campo, não no
 *   documento todo.
 */
export function validarSheetApplyPayload(bruto: unknown): SheetApplyPayload {
  if (typeof bruto !== 'object' || bruto === null) throw new Error('Ficha inválida: payload vazio.')
  const payload = bruto as Record<string, unknown>

  const anotacoes = payload.notes
  if (typeof anotacoes !== 'object' || anotacoes === null) {
    throw new Error('Ficha inválida: faltam as anotações.')
  }
  const { blocks, sections } = anotacoes as Record<string, unknown>
  if (blocks !== undefined && (typeof blocks !== 'object' || blocks === null)) {
    throw new Error('Ficha inválida: blocos em formato inesperado.')
  }
  if (!Array.isArray(sections)) throw new Error('Ficha inválida: seções em formato inesperado.')
  if (!Array.isArray(payload.presets)) throw new Error('Ficha inválida: presets em formato inesperado.')

  const blocosLimpos: Partial<Record<SheetBlockKey, string>> = {}
  for (const chave of SHEET_BLOCK_KEYS) {
    const conteudo = (blocks as Record<string, unknown> | undefined)?.[chave]
    if (typeof conteudo !== 'string' || !conteudo) continue
    blocosLimpos[chave] = texto(conteudo, LIMITES_DA_FICHA.bloco, `o bloco "${chave}"`)
  }

  if (sections.length > LIMITES_DA_FICHA.secoes) {
    console.warn(`Ficha importada: ${sections.length} seções, cortando em ${LIMITES_DA_FICHA.secoes}.`)
  }
  const secoesLimpas = sections
    .slice(0, LIMITES_DA_FICHA.secoes)
    .filter((secao): secao is Record<string, unknown> => typeof secao === 'object' && secao !== null)
    .map((secao) => ({
      title: texto(secao.title, LIMITES_DA_FICHA.rotulo, 'um título de seção'),
      fields: (Array.isArray(secao.fields) ? secao.fields : [])
        .slice(0, LIMITES_DA_FICHA.camposPorSecao)
        .filter((campo): campo is Record<string, unknown> => typeof campo === 'object' && campo !== null)
        .map((campo) => ({
          label: texto(campo.label, LIMITES_DA_FICHA.rotulo, 'um rótulo'),
          value: texto(campo.value, LIMITES_DA_FICHA.valor, 'um valor'),
          // Tipo de rolagem desconhecido vira ausente: o campo perde o botão de dado, não a ficha.
          roll: normalizarTipoDeRolagem(campo.roll)
        }))
    }))
    /**
     * Seção sem TÍTULO é descartada, e sem isso o estrago é visível: a aba Ficha desenha uma caixa
     * com cabeçalho vazio, e `sheets.apply` numa reimportação casa seções pelo título — duas sem
     * título viram "a mesma", e uma apaga a outra.
     */
    .filter((secao) => secao.title.trim() !== '')

  /**
   * As BARRAS (spec §3.4), na régua branda: item torto é pulado, número fora do teto é preso. Lista
   * ausente é o normal de um renderer anterior a elas; lista que não é lista é contrato quebrado.
   */
  if (payload.recursos !== undefined && !Array.isArray(payload.recursos)) {
    throw new Error('Ficha inválida: recursos em formato inesperado.')
  }
  const recursosLimpos: RecursoImportado[] = (payload.recursos ?? [])
    .slice(0, MAXIMO_DE_RECURSOS)
    .filter((recurso): recurso is Record<string, unknown> => typeof recurso === 'object' && recurso !== null)
    .map((recurso) => ({
      nome: texto(recurso.nome, TAMANHO_MAXIMO_DO_NOME_DO_RECURSO, 'o nome de um recurso').trim(),
      atual: numero(recurso.atual),
      maximo: numero(recurso.maximo)
    }))
    .filter((recurso) => recurso.nome !== '')

  return {
    targetProfileId:
      typeof payload.targetProfileId === 'string' ? payload.targetProfileId : undefined,
    characterName: texto(payload.characterName, LIMITES_DA_FICHA.nome, 'o nome do personagem'),
    system: texto(payload.system, LIMITES_DA_FICHA.sistema, 'o sistema'),
    notes: { blocks: blocosLimpos, sections: secoesLimpas },
    /**
     * Os presets vão CRUS daqui: quem julga cada um é o `isValidPresetInput` mais abaixo, que é a
     * mesma régua do canal de presets. Duplicar a checagem aqui criaria uma segunda régua pra mesma
     * pergunta — e é sempre a segunda que fica pra trás.
     */
    presets: (payload.presets as PresetInput[]).slice(0, LIMITES_DA_FICHA.presets),
    recursos: recursosLimpos
  }
}

/** Inteiro em `[0, teto]`; o que não é número finito vira zero — a barra nasce vazia, não a ficha. */
function numero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  return Math.min(Math.max(0, Math.trunc(valor)), TETO_DO_VALOR_DE_RECURSO)
}

export function registerSheetHandlers(
  profiles: ProfilesRepository,
  notes: NotesRepository,
  presets: PresetsRepository
): void {
  ipcMain.handle(IpcChannels.sheetsPickPdf, async (): Promise<PdfEscolhido> => {
    // Pela porta de `dialogos.ts`, que é quem lembra a pasta — ver o cabeçalho de lá.
    const caminho = await escolherArquivo({
      proposito: 'ficha',
      titulo: 'Escolher ficha de personagem (PDF)',
      filtros: [{ name: 'Ficha em PDF', extensions: ['pdf'] }]
    })
    if (!caminho) return { ok: false, motivo: 'cancelado' }
    return lerPdfEscolhido(caminho)
  })

  /**
   * Cria o personagem e grava anotações e presets DENTRO dele, aqui no processo principal e em
   * ordem — e é por isso que existe como um canal só em vez de três chamadas do renderer.
   *
   * O motivo é onde os dados moram: `NotesRepository` e `PresetsRepository` escrevem na pasta do
   * perfil ATIVO (ver `ProfilesRepository.activeDirectory`), que só passa a ser o novo depois que a
   * lista de perfis é gravada. Do renderer, cada passo é uma promessa separada e a troca de perfil
   * ainda passa pelo React — a ficha importada tinha chance real de cair na pasta do personagem
   * ANTERIOR, sobrescrevendo os presets dele. Aqui é `await` atrás de `await`, sem interface no
   * meio.
   */
  ipcMain.handle(
    IpcChannels.sheetsApply,
    async (_event, bruto: unknown): Promise<Profile> => {
      /**
       * A PRIMEIRA linha, antes de ler o estado e muito antes de gravar: é o que garante que uma
       * importação ou acontece inteira ou não acontece. Ver `validarSheetApplyPayload`.
       */
      const payload = validarSheetApplyPayload(bruto)

      const estado = await profiles.get()
      const existente = payload.targetProfileId
        ? estado.profiles.find((perfil) => perfil.id === payload.targetProfileId)
        : undefined

      /**
       * O TETO DE PERSONAGENS (ver `MAX_PROFILES`), cobrado ANTES de qualquer gravação.
       *
       * Só quando a importação vai CRIAR um: atualizar um personagem que já existe não aumenta a
       * lista, e recusar aí seria travar justamente o caso mais comum — o jogador subiu de nível e
       * está reimportando a ficha dele.
       *
       * O erro sobe pra tela como falha da importação, com o texto de `sheetImport.errors.save`.
       * Não é o recado mais preciso do mundo, mas é honesto (nada foi gravado) e a alternativa —
       * criar o personagem dezesseis calado — seria o app decidindo ignorar o próprio limite.
       */
      if (!existente && estado.profiles.length >= MAX_PROFILES) {
        throw new Error(
          `Limite de ${MAX_PROFILES} personagens atingido — apague um antes de importar outra ficha.`
        )
      }

      /**
       * ATUALIZAR mantém o personagem (e portanto a pasta dele, com o diário e as anotações) e só
       * troca nome e sistema pelo que veio da conferência. CRIAR faz um do zero.
       */
      const novo: Profile = existente
        ? { ...existente, name: payload.characterName.trim(), system: payload.system.trim() }
        : {
            id: randomUUID(),
            name: payload.characterName.trim(),
            system: payload.system.trim(),
            photo: null,
            createdAt: Date.now()
          }
      const lista = existente
        ? estado.profiles.map((perfil) => (perfil.id === novo.id ? novo : perfil))
        : [...estado.profiles, novo]
      await profiles.save({ profiles: lista, activeId: novo.id })

      /**
       * TUDO OU NADA, de verdade — a revisão de código pegou o buraco: a conferência na porta
       * garante a FORMA do payload, mas a gravação das anotações passou a ter um teto de tamanho
       * (ver `NotesRepository.save`), e `LIMITES_DA_FICHA` admite mais do que ele. Uma ficha dentro
       * dos limites de campo e acima do teto total criava o personagem, ativava, e estourava na
       * ficha — a pessoa ficava num personagem novo e vazio, com um erro na tela. É exatamente o
       * desfecho que a conferência existe pra impedir.
       *
       * Por isso o que vem depois do perfil roda dentro de um `try`, e a falha DESFAZ o perfil:
       * a lista volta a ser a de antes (personagem novo some; nome e sistema de um atualizado
       * voltam), e o erro sobe pra tela como sempre. O que pode sobrar é uma pasta órfã com
       * presets já gravados, que nenhum personagem aponta — melhor que um personagem fantasma.
       */
      try {
        await gravarFichaEPresets()
      } catch (causa) {
        await profiles.save(estado)
        throw causa
      }
      return novo

      async function gravarFichaEPresets(): Promise<void> {

      const blocos = payload.notes.blocks
      const recursosImportados = payload.recursos ?? []
      if (payload.notes.sections.length > 0 || Object.keys(blocos).length > 0 || recursosImportados.length > 0) {
        const atuais = await notes.get()
        /**
         * As seções vão pra FICHA do personagem, e nada vai pro diário: o diário é por sessão de
         * jogo (ver `NotesPage`) e a ficha é o que o personagem É, não o que aconteceu num dia.
         *
         * ACRESCENTA às que já existem em vez de substituir. Hoje este canal só é chamado logo
         * depois de criar um perfil vazio, então na prática não há o que preservar — mas ele não tem
         * como saber disso, e apagar a ficha de alguém seria irreversível.
         */
        /**
         * Cada bloco recebe o texto do grupo correspondente, ACRESCENTADO ao que houver. Hoje o
         * perfil acaba de nascer e não há o que preservar, mas este canal não tem como saber disso
         * — e apagar a ficha de alguém seria irreversível.
         */
        /**
         * O texto novo entra DEPOIS do que já estava, e não por cima: acrescentar deixa uma linha
         * repetida, que se apaga; substituir apaga a história que a pessoa escreveu à mão, que não
         * se recupera.
         *
         * A exceção é o texto que JÁ ESTÁ LÁ, palavra por palavra — é o caso de reimportar a mesma
         * ficha depois de subir de nível, e sem esta pergunta o bloco de inventário ganharia uma
         * cópia do equipamento a cada importação.
         */
        const juntar = (atual: string, novoTexto: string | undefined): string => {
          if (!novoTexto?.trim()) return atual
          if (atual.includes(novoTexto.trim())) return atual
          return atual.trim() ? `${atual}

${novoTexto}` : novoTexto
        }
        const recursosFundidos = fundirRecursos(atuais.recursos, recursosImportados)
        await notes.save({
          ...atuais,
          characterName: novo.name,
          attributes: juntar(atuais.attributes, blocos.attributes),
          abilities: juntar(atuais.abilities, blocos.abilities),
          inventory: juntar(atuais.inventory, blocos.inventory),
          appearance: juntar(atuais.appearance, blocos.appearance),
          backstory: juntar(atuais.backstory, blocos.backstory),
          /**
           * As BARRAS fundem pelo nome (ver `fundirRecursos`): reimportar traz o PV com máximo novo
           * pra MESMA barra, e as criadas à mão ficam.
           */
          recursos: recursosFundidos,
          /**
           * A regra de crítico vem do SISTEMA da ficha só no personagem NOVO (Cthulhu nasce d100
           * rola-abaixo). Num personagem atualizado a regra que a pessoa escolheu fica.
           */
          critico: existente ? atuais.critico : regraDeCriticoDoSistema(payload.system),
          /**
           * Os tipos de DESCANSO (spec §3.8) vêm do sistema quando o personagem ainda não tem
           * nenhum — no novo, sempre; no atualizado, só se a pessoa nunca configurou. Um que já
           * editou os seus não os perde por reimportar a ficha.
           */
          descansos:
            existente && atuais.descansos.length > 0
              ? atuais.descansos
              : descansosPadrao(payload.system, recursosFundidos),
          /**
           * Seção com o MESMO TÍTULO é substituída, e não duplicada.
           *
           * A seção é o retrato de um pedaço da ficha naquele sistema — "Atributos", "Perícias" —, e
           * numa reimportação o que veio do PDF é a versão nova dela. Acrescentar produzia duas
           * seções "Atributos" na tela, uma com os números velhos e outra com os novos, sem nada
           * dizendo qual é qual.
           *
           * O que NÃO tem correspondente novo fica como está: uma seção de outra ficha importada no
           * mesmo personagem não é apagada por esta importação.
           */
          sections: [
            ...atuais.sections.filter(
              (secao) => !payload.notes.sections.some((nova) => nova.title === secao.title)
            ),
            ...payload.notes.sections.map((secao) => ({
              id: randomUUID(),
              title: secao.title,
              /**
               * O `roll` atravessa junto: é ele que faz o número na ficha virar botão de dado (ver
               * `sheetRoll.ts`). Sem isto, a ficha importada chegaria ao disco sem saber que
               * "Agilidade 3" é uma rolagem, e o botão só existiria até o app fechar.
               */
              fields: secao.fields.map((campo) => ({
                id: randomUUID(),
                label: campo.label,
                value: campo.value,
                roll: campo.roll
              }))
            }))
          ]
        })
      }

      /**
       * Os presets da ficha passam pela MESMA validação do canal de presets (`isValidPresetInput`).
       *
       * Não é conserto de defeito observado: os leitores derivam toda expressão de
       * `parseDiceExpression`, que já recusa tipo de dado que o app não rola e quantidade acima de
       * `MAX_SIMULTANEOUS_DICE`. É o fechamento de um DESVIO: este caminho gravava direto no
       * repositório, então a garantia dependia de todo leitor futuro se lembrar do limite. Um preset
       * com 40 dados ou com `d30` não quebra aqui — quebra depois, na cena 3D, longe de onde entrou.
       *
       * Preset recusado é PULADO, e o resto da importação segue: perder o personagem inteiro por
       * causa de uma linha de ataque torta seria pior que perder a linha.
       */
      /**
       * Preset que já existe COM O MESMO NOME não é criado de novo — senão reimportar a ficha
       * encheria a lista de "Adaga (ataque)" repetidos. Pelo nome, e não pela expressão: o dano da
       * arma muda quando o personagem sobe de nível, e é a mesma arma.
       *
       * O que já está lá fica como está, inclusive se a expressão mudou. Mexer nele seria desfazer
       * o ajuste que a pessoa possa ter feito no editor de presets — e a ficha nova continua ali
       * pra ela conferir.
       */
      const jaExistem = new Set((await presets.getAll()).map((preset) => preset.name))
      for (const preset of payload.presets) {
        if (jaExistem.has(preset.name)) continue
        if (!isValidPresetInput(preset)) {
          console.warn('Preset da ficha recusado pela validação; importando o resto:', preset)
          continue
        }
        await presets.create(preset)
      }

      }
    }
  )
}
