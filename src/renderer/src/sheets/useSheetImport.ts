import { useCallback, useState } from 'react'
import type { SheetWarningId } from '@shared/types/sheetWarning'
import { MAX_PROFILES } from '@shared/types/profile'
import { fichaEstaVazia } from '@shared/types/notes'
import { montarFicha } from '@shared/types/montarFicha'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { useProfiles } from '../settings/ProfilesContext'
import { useNotes } from '../hooks/useNotes'
import { EVENTO_PRESETS_MUDARAM } from '../hooks/usePresets'
import { useSettings } from '../settings/SettingsContext'
import { useTranslation } from '../i18n/useTranslation'
import { extractPdfSheet } from './extractPdfSheet'
import { readSheet } from './readers'
import { escolherDestino } from './destinoDaImportacao'

/**
 * O fluxo da importação de ficha, do clique até o personagem gravado, SEM JANELA NO MEIO.
 *
 * Pedido dele (02/09/2026): "não precisa perguntar para a pessoa e mostrar aquela página inteira de
 * ficha, apenas upload, scrap tudo, e deixa editável para o user". A importação já foi uma tela de
 * conferência campo a campo, depois um "ok, importaremos" pequeno; agora é um gesto só: escolher o
 * PDF. As etapas:
 *
 * 1. o processo principal abre o seletor e devolve os BYTES do PDF;
 * 2. o pdf.js extrai campos e texto (`extractPdfSheet`);
 * 3. o leitor certo interpreta (`readSheet`);
 * 4. o app DECIDE nome e destino por regra (`escolherDestino`) e o processo principal grava tudo:
 *    anotações, presets, barras, retrato, páginas e o texto sem rótulo.
 *
 * O que torna aceitável um importador que adivinha e grava sem perguntar: nada é destruído. Criar
 * é a operação que não estraga nada; preencher a ficha VAZIA do personagem aberto idem; e atualizar
 * um personagem de mesmo nome substitui só as seções da ficha (diário, anotações, presets e barras
 * feitas à mão ficam, ver `registerSheetHandlers`). E tudo o que entrou é editável e apagável na
 * aba Ficha, na hora. O que a tela ainda diz, DEPOIS de importar, é o que foi lido e o que NÃO foi
 * (`feito`): silêncio sobre isso viraria "o app importou errado".
 */
export interface ImportacaoFeita {
  /** O personagem que recebeu a ficha: o aviso só aparece enquanto ele estiver aberto. */
  profileId: string
  nome: string
  /** Um leitor dedicado reconheceu o sistema (o teste é o leitor, não `system` preenchido). */
  reconhecido: boolean
  readerLabel: string
  campos: number
  rolagens: number
  /** Campos que ficaram de fora pelo teto por seção (`MAXIMO_DE_CAMPOS_POR_SECAO`). */
  cortados: number
  warnings: SheetWarningId[]
  /** A ficha caiu por cima de um personagem que já tinha ficha (a reimportação). */
  atualizou: boolean
}

export function useSheetImport() {
  const [lendo, setLendo] = useState(false)
  const [feito, setFeito] = useState<ImportacaoFeita | null>(null)
  /**
   * O erro é guardado como TEXTO já traduzido, e não como identificador.
   *
   * Diferente dos avisos do leitor (ver `sheetWarning.ts`), que atravessam processo e chegam à tela
   * por outro caminho, este erro nasce e morre dentro deste hook, com o idioma escolhido à mão. Um
   * identificador aqui só acrescentaria um salto de indireção entre a falha e a frase.
   */
  const [erro, setErro] = useState<string | null>(null)
  const t = useTranslation()
  const { language } = useSettings()
  const { profiles, activeId, active, reload } = useProfiles()
  const { notes, loadedFor, recarregar: recarregarAnotacoes } = useNotes()

  const escolherArquivo = useCallback(async () => {
    setErro(null)
    setFeito(null)

    /**
     * A ESCOLHA do arquivo também dentro de `try`.
     *
     * Ela ficava fora, e isso engolia uma família inteira de falhas: o diálogo é do processo
     * principal, e qualquer coisa que dê errado lá (o IPC cair, o arquivo sumir entre escolher e
     * abrir, a pasta de rede desconectar) chegava aqui como promessa rejeitada sem ninguém pra
     * pegar. O resultado na tela era o pior possível: o botão não fazia absolutamente nada, sem
     * erro, sem carregando, sem janela.
     */
    let escolhido: Awaited<ReturnType<typeof window.api.sheets.pickPdf>>
    try {
      escolhido = await window.api.sheets.pickPdf()
    } catch (causa) {
      console.error('Falha ao abrir o seletor de ficha:', causa)
      setErro(t.sheetImport.errors.picker)
      return
    }

    if (!escolhido.ok) {
      // Fechar o diálogo não é erro: é a pessoa desistindo, e mensagem aqui seria acusação.
      if (escolhido.motivo === 'cancelado') return
      // Arquivo errado, dito com o nome do botão certo (pedido dele).
      if (escolhido.motivo === 'pacote-do-reroll') {
        setErro(t.sheetImport.errors.rerollPackage)
        return
      }
      if (escolhido.motivo === 'nao-e-pdf') {
        setErro(t.sheetImport.errors.notPdf)
        return
      }
      if (escolhido.motivo === 'muito-grande') {
        const mb = Math.round(escolhido.tamanho / (1024 * 1024))
        setErro(t.sheetImport.errors.tooLarge.replace('{mb}', String(mb)))
        return
      }
      console.error('Falha ao ler o arquivo escolhido:', escolhido.detalhe)
      setErro(t.sheetImport.errors.unreadable)
      return
    }

    setLendo(true)
    try {
      let lido: ReturnType<typeof readSheet>
      let retrato: string | undefined
      let paginas: string[] | undefined
      try {
        const sheet = await extractPdfSheet(escolhido.fileName, escolhido.bytes)
        // O retrato atravessa o leitor sem passar por ele: nenhum leitor sabe de imagem, e não precisa.
        lido = readSheet(sheet, language)
        retrato = sheet.retrato
        paginas = sheet.paginas
      } catch (causa) {
        /**
         * PDF protegido por senha, arquivo truncado, coisa que não é PDF apesar da extensão. A
         * mensagem do pdf.js é técnica demais pra tela, mas vai pro console: sem ela, um relato de
         * "não importou" não teria por onde ser investigado.
         */
        console.error('Falha ao ler a ficha:', causa)
        setErro(t.sheetImport.errors.parse)
        return
      }

      /**
       * NADA pra importar (imagem digitalizada sem texto, livro de 100+ páginas): nenhum personagem
       * nasce. Criar um vazio calado seria pior que o aviso; o aviso do leitor, quando há, é o que
       * explica o porquê.
       */
      const nadaLido = lido.fields.length === 0 && lido.presets.length === 0 && !(lido.rawText ?? '').trim()
      if (nadaLido) {
        const motivo = lido.warnings.find((aviso) => aviso === 'pdf-sem-texto' || aviso === 'paginas-demais')
        setErro(motivo ? t.sheetImport.warnings[motivo] : t.sheetImport.nothingRead)
        return
      }

      /** TUDO vai pra ficha: cada campo lido e o texto sem rótulo (a regra de que nada se perde). */
      const paraAFicha = montarFicha(lido.fields, lido.rawText || undefined)
      /** As barras (spec §3.4), de TODOS os campos lidos: gravadas mesmo com o HUD ainda fechado. */
      const recursos = extrairRecursos(lido.fields)

      const destino = escolherDestino({
        nomeLido: lido.characterName,
        fileName: escolhido.fileName,
        perfis: profiles,
        ativo: active,
        // Só conta como vazia a ficha que JÁ CARREGOU: no meio de uma troca de personagem, não decide.
        fichaDoAtivoVazia: loadedFor === activeId && fichaEstaVazia(notes)
      })

      /**
       * O teto de personagens (`MAX_PROFILES`: três nos testadores, o do disco no cliente do dono),
       * só quando a importação CRIA um novo. O processo principal recusaria de qualquer jeito, mas o
       * erro de lá é genérico; este diz o motivo e o que fazer.
       */
      if (!destino.targetProfileId && profiles.length >= MAX_PROFILES) {
        setErro(t.sheetImport.atLimit.replace('{max}', String(MAX_PROFILES)))
        return
      }

      try {
        const perfil = await window.api.sheets.apply({
          targetProfileId: destino.targetProfileId,
          characterName: destino.characterName,
          system: lido.system,
          notes: paraAFicha,
          recursos: recursos.map(({ nome, atual, maximo }) => ({ nome, atual, maximo })),
          photo: retrato ?? null,
          paginas: paginas ?? [],
          /**
           * O preset vai só com o que o app guarda (nome e expressão). O `kind` e o `source` eram
           * coisa da tela de conferência, dizer de onde a rolagem saiu, e não têm lugar no preset
           * gravado.
           */
          presets: lido.presets.map((preset) => ({ name: preset.name, expression: preset.expression }))
        })
        /**
         * Relê a lista de perfis do disco em vez de mexer no estado daqui: quem criou o personagem
         * foi o processo principal, e ele é a fonte da verdade sobre id, ordem e qual está aberto.
         * Recriar isso no renderer seria manter duas versões da mesma lista.
         */
        await reload()
        /**
         * E relê as ANOTAÇÕES: importar em cima do personagem que já está aberto não muda o
         * `activeId`, então o `useNotes` não perceberia sozinho, e a ficha na tela continuaria a
         * de antes, pronta pra gravar as seções velhas por cima das novas na próxima tecla.
         */
        recarregarAnotacoes()
        /**
         * E os PRESETS: a importação grava na pasta do personagem de destino, e quando o destino é o
         * que já está aberto (a ficha vazia recém-criada, a reimportação) o `activeId` não muda e a
         * lista da tela de rolagem não relê sozinha. Medido no harness: os presets importados só
         * apareciam depois de trocar de personagem. O evento é o mesmo do pacote de personagem.
         */
        window.dispatchEvent(new Event(EVENTO_PRESETS_MUDARAM))
        setFeito({
          profileId: perfil.id,
          nome: destino.characterName,
          reconhecido: lido.readerId !== 'generico',
          readerLabel: lido.readerLabel,
          campos: lido.fields.length,
          rolagens: lido.presets.length,
          cortados: paraAFicha.cortados ?? 0,
          warnings: lido.warnings,
          atualizou: destino.atualizou
        })
      } catch (causa) {
        console.error('Falha ao criar o personagem a partir da ficha:', causa)
        setErro(t.sheetImport.errors.save)
      }
    } finally {
      setLendo(false)
    }
  }, [t, language, profiles, activeId, active, reload, notes, loadedFor, recarregarAnotacoes])

  /** Fecha o aviso do que foi importado. Trocar de personagem também o esconde (ver `profileId`). */
  const dispensar = useCallback(() => {
    setFeito(null)
    setErro(null)
  }, [])

  return { lendo, feito, erro, escolherArquivo, dispensar }
}
