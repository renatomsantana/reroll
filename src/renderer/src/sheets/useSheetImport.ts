import { useCallback, useState } from 'react'
import type { RecursoImportado, SheetImport } from '@shared/types/sheetImport'
import type { FichaMontada } from '@shared/types/montarFicha'
import { useProfiles } from '../settings/ProfilesContext'
import { useNotes } from '../hooks/useNotes'
import { useSettings } from '../settings/SettingsContext'
import { useTranslation } from '../i18n/useTranslation'
import { extractPdfSheet } from './extractPdfSheet'
import { readSheet } from './readers'

/**
 * O fluxo da importação de ficha, do clique até o personagem criado.
 *
 * Fica num hook (e não dentro da aba de anotações) porque são quatro etapas com três estados de
 * espera diferentes, e misturar isso com o resto da aba deixaria os dois ilegíveis. As etapas:
 *
 * 1. o processo principal abre o seletor e devolve os BYTES do PDF;
 * 2. o pdf.js extrai campos e texto (`extractPdfSheet`);
 * 3. o leitor certo interpreta (`readSheet`) — nada foi gravado ainda;
 * 4. o usuário confere, ajusta, confirma; só então o processo principal grava.
 *
 * Nada é gravado antes do passo 4, e é isso que torna aceitável um importador que ADIVINHA.
 */
export function useSheetImport() {
  const [lendo, setLendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [lido, setLido] = useState<SheetImport | null>(null)
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
  const { reload } = useProfiles()
  const { recarregar: recarregarAnotacoes } = useNotes()

  const escolherArquivo = useCallback(async () => {
    setErro(null)

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
      // Fechar o diálogo não é erro — é a pessoa desistindo, e mensagem aqui seria acusação.
      if (escolhido.motivo === 'cancelado') return
      // Arquivo errado, dito com o nome do botão certo — pedido dele.
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
      const sheet = await extractPdfSheet(escolhido.fileName, escolhido.bytes)
      // O retrato atravessa o leitor sem passar por ele: nenhum leitor sabe de imagem, e não precisa.
      const lido = readSheet(sheet, language)
      setLido({
        ...lido,
        ...(sheet.retrato ? { retrato: sheet.retrato } : {}),
        ...(sheet.paginas ? { paginas: sheet.paginas } : {})
      })
    } catch (causa) {
      /**
       * PDF protegido por senha, arquivo truncado, coisa que não é PDF apesar da extensão. A
       * mensagem do pdf.js é técnica demais pra tela, mas vai pro console: sem ela, um relato de
       * "não importou" não teria por onde ser investigado.
       */
      console.error('Falha ao ler a ficha:', causa)
      setErro(t.sheetImport.errors.parse)
    } finally {
      setLendo(false)
    }
  }, [t, language])

  const confirmar = useCallback(
    async (escolha: {
      targetProfileId?: string
      characterName: string
      system: string
      notes: FichaMontada
      presets: SheetImport['presets']
      recursos: RecursoImportado[]
      photo: string | null
      paginas: string[]
    }) => {
      setGravando(true)
      try {
        await window.api.sheets.apply({
          targetProfileId: escolha.targetProfileId,
          characterName: escolha.characterName,
          system: escolha.system,
          notes: escolha.notes,
          recursos: escolha.recursos,
          photo: escolha.photo,
          paginas: escolha.paginas,
          /**
           * O preset vai só com o que o app guarda (nome e expressão). O `kind` e o `source` são
           * coisa da tela de conferência — dizer de onde a rolagem saiu — e não têm lugar no preset
           * gravado.
           */
          presets: escolha.presets.map((preset) => ({ name: preset.name, expression: preset.expression }))
        })
        /**
         * Relê a lista de perfis do disco em vez de mexer no estado daqui: quem criou o personagem
         * foi o processo principal, e ele é a fonte da verdade sobre id, ordem e qual está aberto.
         * Recriar isso no renderer seria manter duas versões da mesma lista.
         */
        await reload()
        /**
         * E relê as ANOTAÇÕES: importar em cima do personagem que já está aberto não muda o
         * `activeId`, então o `useNotes` não perceberia sozinho — e a ficha na tela continuaria a
         * de antes, pronta pra gravar as seções velhas por cima das novas na próxima tecla.
         */
        recarregarAnotacoes()
        setLido(null)
      } catch (causa) {
        console.error('Falha ao criar o personagem a partir da ficha:', causa)
        setErro(t.sheetImport.errors.save)
      } finally {
        setGravando(false)
      }
    },
    [reload, recarregarAnotacoes, t]
  )

  const cancelar = useCallback(() => {
    setLido(null)
    setErro(null)
  }, [])

  return { lendo, gravando, lido, erro, escolherArquivo, confirmar, cancelar }
}
