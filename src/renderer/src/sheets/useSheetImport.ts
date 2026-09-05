import { useCallback, useState } from 'react'
import type { SheetWarningId } from '@shared/types/sheetWarning'
import { MAX_PROFILES } from '@shared/types/profile'
import { montarFicha } from '@shared/types/montarFicha'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { useProfiles } from '../settings/ProfilesContext'
import { useNotes } from '../hooks/useNotes'
import { EVENTO_PRESETS_MUDARAM } from '../hooks/usePresets'
import { useSettings } from '../settings/SettingsContext'
import { useTranslation } from '../i18n/useTranslation'
import { useDialogo } from '../components/common/Dialogo'
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
 * 4. o app decide o nome por regra (`escolherDestino`) e o processo principal CRIA o personagem
 *    e grava tudo nele: anotações, presets, barras (o HUD), retrato, páginas e o texto sem rótulo.
 *
 * Antes da etapa 1 há UM "tem certeza?" (o diálogo do app), e é a única pergunta. Regra dele
 * (02/09/2026): "toda vez que uploadar uma ficha nova, que CRIE um personagem novo, para não perder
 * o que já está lá; clicou em uploadar, tem certeza? aí cria um novo". Importar nunca grava por
 * cima de ninguém: é por isso que um importador que adivinha e grava sem conferência é aceitável.
 * No teto de personagens o botão fica apagado com a dica do limite (ver `SheetTab`), e este hook
 * ainda recusa por conta própria, pro caso de o clique escapar. Tudo o que entrou é editável e
 * apagável na aba Ficha, na hora. O que a tela ainda diz, DEPOIS de importar, é o que foi lido e o
 * que NÃO foi (`feito`): silêncio sobre isso viraria "o app importou errado".
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
  const dialogo = useDialogo()
  const { language } = useSettings()
  const { profiles, reload } = useProfiles()
  const { recarregar: recarregarAnotacoes } = useNotes()

  const escolherArquivo = useCallback(async () => {
    setErro(null)
    setFeito(null)

    /**
     * O TETO de personagens (`MAX_PROFILES`: três nos testadores, o do disco no cliente do dono),
     * antes de qualquer pergunta: importar sempre cria um personagem, então no teto não há o que
     * importar. O botão já vem apagado com a dica do limite; isto é a segunda tranca.
     */
    if (profiles.length >= MAX_PROFILES) {
      setErro(t.sheetImport.atLimit.replace('{max}', String(MAX_PROFILES)))
      return
    }

    // O único "tem certeza?": a ficha vira um personagem NOVO, e os de antes ficam como estão.
    if (!(await dialogo.confirmar(t.sheetImport.confirmNew))) return

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

      const destino = escolherDestino({ nomeLido: lido.characterName, fileName: escolhido.fileName })

      try {
        // Sem `targetProfileId`: o processo principal CRIA o personagem e o deixa aberto.
        const perfil = await window.api.sheets.apply({
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
         * E relê as ANOTAÇÕES e os PRESETS. O personagem novo fica aberto e o `activeId` muda, o
         * que já faz a ficha e a lista de rolagem relerem; os dois avisos ficam como cinto de
         * segurança do caso em que o id não muda (medido no harness quando a importação ainda
         * caía no personagem aberto: presets só apareciam depois de trocar de personagem).
         */
        recarregarAnotacoes()
        window.dispatchEvent(new Event(EVENTO_PRESETS_MUDARAM))
        setFeito({
          profileId: perfil.id,
          nome: destino.characterName,
          reconhecido: lido.readerId !== 'generico',
          readerLabel: lido.readerLabel,
          campos: lido.fields.length,
          rolagens: lido.presets.length,
          cortados: paraAFicha.cortados ?? 0,
          warnings: lido.warnings
        })
      } catch (causa) {
        console.error('Falha ao criar o personagem a partir da ficha:', causa)
        setErro(t.sheetImport.errors.save)
      }
    } finally {
      setLendo(false)
    }
  }, [t, dialogo, language, profiles, reload, recarregarAnotacoes])

  /** Fecha o aviso do que foi importado. Trocar de personagem também o esconde (ver `profileId`). */
  const dispensar = useCallback(() => {
    setFeito(null)
    setErro(null)
  }, [])

  return { lendo, feito, erro, escolherArquivo, dispensar }
}
