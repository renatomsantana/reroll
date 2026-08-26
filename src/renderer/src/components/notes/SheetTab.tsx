import { useEffect, useRef, useState } from 'react'
import type { DiceExpression } from '@shared/types/dice'
import type { SheetSection, SheetSectionField } from '@shared/types/notes'
import { blockForGroup, secaoCobreAtributos, type SheetBlockKey } from '@shared/types/sheetBlocks'
import { rolagemDoCampo } from '@shared/types/sheetRoll'
import { LADOS_DE_CRITICO, codigoDaRegra, regraDoCodigo } from '@shared/dice/critico'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { useNotes } from '@renderer/hooks/useNotes'
import { useProfiles } from '@renderer/settings/ProfilesContext'
import { ProfileSelect } from './ProfileSelect'
import { MAX_PROFILES } from '@shared/types/profile'
import { IMPORTACAO_DE_FICHA_LIGADA } from '@shared/recursos'
import { SheetImportModal } from './SheetImportModal'
import { RecorteDeFotoModal } from '../foto/RecorteDeFotoModal'
import { useDialogo } from '../common/Dialogo'
import { useSheetImport } from '../../sheets/useSheetImport'
import { usePacoteDePersonagem } from '../../sheets/usePacoteDePersonagem'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import './SheetTab.css'
import { IconeReroll } from '../common/IconeReroll'

/**
 * A FICHA do personagem, em aba própria — separada das Anotações a pedido do usuário: "vamos botar
 * uma aba pra FICHA, outra para anotações".
 *
 * A divisão tem uma lógica que vale escrever, porque não é só arrumação: a ficha é o que o
 * personagem É (quem ele é, quanto tem de cada coisa, o que sabe fazer, o que carrega) e muda
 * devagar; as anotações são o que ACONTECEU, e mudam a cada sessão. Estavam na mesma tela disputando
 * altura, e o diário — que é o que se escreve durante o jogo — ficava espremido embaixo dos blocos
 * fixos.
 *
 * A página tem DUAS FORMAS, e qual delas aparece depende do personagem aberto:
 *
 * - IMPORTADO de um PDF: as seções do sistema, com os nomes que aquele sistema usa e os campos
 *   dele, editáveis um a um. Uma ficha de Ordem Paranormal mostra Identificação, Atributos e
 *   Recursos; uma de Oblivio mostra Identificação, Atributos e Corpo. Foi pedido assim depois de a
 *   primeira versão espremer a ficha inteira dentro de blocos fixos: "eu quero que se a pessoa
 *   carregue um pdf de cada sistema a página Ficha mude para exatamente os nomes das coisas de cada
 *   sistema";
 * - CRIADO À MÃO: os blocos livres de atributos e habilidades, porque aí não há sistema nenhum a
 *   seguir e o que falta é espaço pra escrever.
 *
 * Inventário, aparência e história aparecem nos dois casos: são texto de quem joga, não campo de
 * sistema, e uma ficha importada também quer ter onde escrever.
 *
 * As seções moram no `notes.json` do PERFIL, e é isso que faz a página inteira trocar junto com o
 * personagem — sem nada de especial aqui: voltar pro personagem anterior traz a ficha dele de volta
 * porque é outro arquivo.
 *
 * Rola verticalmente (`sheet-tab-body`), porque ficha de RPG não cabe em tela nenhuma sem espremer
 * todo mundo — foi o outro pedido junto: "pode fazer com que seja possível scrollar pra baixo".
 *
 * E ela ROLA DADO: cada número que é rolagem no sistema tem um botão de dado do lado (ver
 * `sheetRoll.ts`). Sem isso a ficha era um formulário bonito e inerte dentro de um rolador de dados
 * — ninguém consulta a ficha por consultar, consulta pra rolar.
 */
export interface SheetTabProps {
  /**
   * Rola o que foi clicado na ficha. Quem rola de verdade é a aba de Rolagem, que fica montada o
   * tempo todo (ver o comentário do `display` em `App.tsx`) — daqui só sai a expressão e o nome.
   *
   * Opcional porque a ficha tem que continuar servindo sem rolador nenhum por trás: no modo
   * compacto não existe cena 3D montada, e uma ficha que quebra sem ela seria pior que uma ficha
   * sem botão.
   */
  onRoll?: (expression: DiceExpression, name: string) => void
  /**
   * Trava os botões de dado enquanto uma rolagem NA TORRE está em andamento.
   *
   * É a mesma condição da lista de presets (`rollDisabled` em `App.tsx`), e pelo mesmo motivo: na
   * torre a rolagem é uma fila de dados, e cortar no meio deixa dados presos em espera — então
   * `rollGroups` recusa o pedido. Sem esta trava o botão aceitaria o clique e não aconteceria nada,
   * que é a pior forma de dizer não.
   */
  rollDisabled?: boolean
}

export function SheetTab({ onRoll, rollDisabled }: SheetTabProps) {
  const t = useTranslation()
  const { notes, saveError, loadError, updateField, loadedFor } = useNotes()
  const profiles = useProfiles()
  const dialogo = useDialogo()
  const importacao = useSheetImport()
  const pacote = usePacoteDePersonagem()
  /**
   * As páginas do PDF do personagem aberto (ver `PaginasRepository`). Relidas quando a ficha
   * carrega (`loadedFor`): é o mesmo gatilho de trocar de personagem e de importar por cima.
   */
  const [paginasDoPdf, setPaginasDoPdf] = useState<string[]>([])
  const [mostrarOriginal, setMostrarOriginal] = useState(false)
  useEffect(() => {
    let atual = true
    setMostrarOriginal(false)
    // Fora do app compilado (testes de componente) o preload não existe: sem páginas, sem erro.
    const api = (window as unknown as { api?: { sheets?: { paginas?: () => Promise<string[]> } } }).api
    const pedir = api?.sheets?.paginas
    if (!pedir || !loadedFor) {
      setPaginasDoPdf([])
      return
    }
    pedir()
      .then((paginas) => {
        if (atual) setPaginasDoPdf(paginas)
      })
      .catch((causa: unknown) => {
        console.error('Falha ao ler as páginas do PDF do personagem:', causa)
        if (atual) setPaginasDoPdf([])
      })
    return () => {
      atual = false
    }
  }, [loadedFor])
  /**
   * Ficha vinda de PDF. É o que decide a forma da página: com seções, ela mostra a ficha DAQUELE
   * sistema; sem, mostra os blocos livres.
   *
   * Como as seções moram no `notes.json` do perfil, trocar de personagem troca a página inteira — e
   * voltar pro anterior traz a ficha dele de volta, sem nada a mais pra fazer aqui.
   */
  const temSecoes = notes.sections.length > 0
  /**
   * A ficha está VAZIA — nenhuma seção importada e nenhuma letra em bloco nenhum. É o estado do
   * personagem recém-criado, e é quando a aba mostra o convite de importar em vez dos blocos.
   */
  const fichaVazia =
    !temSecoes &&
    !notes.attributes.trim() &&
    !notes.abilities.trim() &&
    !notes.inventory.trim() &&
    !notes.appearance.trim() &&
    !notes.backstory.trim()
  /**
   * "Preencher à mão" escolhido nesta ficha vazia. Só na memória e só deste personagem: trocar de
   * personagem volta ao convite — cada ficha vazia faz a pergunta de novo.
   */
  const [preencherAMao, setPreencherAMao] = useState(false)
  useEffect(() => {
    setPreencherAMao(false)
  }, [profiles.activeId])
  const nomeRef = useRef<HTMLInputElement>(null)
  /**
   * A escolha da FOTO pode falhar — imagem grande demais, formato que o app não abre, arquivo numa
   * pasta de rede que caiu (ver `escolherImagem.ts` no processo principal).
   *
   * Antes daqui, esse `void profiles.pickPhoto(...)` engolia a falha como promessa rejeitada sem
   * ninguém pra pegar: o clique não fazia NADA, sem foto, sem erro, sem explicação. É o mesmo defeito
   * que o `PdfEscolhido` já tinha consertado no botão de importar ficha, um andar acima nesta mesma
   * tela.
   */
  const [erroDaFoto, setErroDaFoto] = useState(false)

  /**
   * A foto escolhida vai pro RECORTE antes de virar a foto do personagem (zoom no rosto — ver
   * `recorteDeFoto.ts`). O arquivo cru fica só na memória deste modal; o que se grava é o quadrado.
   */
  const [recortando, setRecortando] = useState<string | null>(null)

  async function escolherFoto(): Promise<void> {
    setErroDaFoto(false)
    try {
      const escolhida = await window.api.profiles.pickPhoto()
      if (escolhida) setRecortando(escolhida)
    } catch (causa) {
      console.error('Falha ao escolher a foto do personagem:', causa)
      setErroDaFoto(true)
    }
  }

  /**
   * Blocos que uma SEÇÃO já cobre — esses não aparecem duas vezes.
   *
   * A ficha do Matais mostrava a seção "Atributos" (em caixas, vinda do PDF) e, logo abaixo, um bloco
   * de texto VAZIO também chamado "Atributos". Dois lugares com o mesmo nome pedindo a mesma coisa é
   * exatamente o tipo de tela que faz a pessoa não saber onde escrever.
   */
  const cobertosPorSecao = new Set<SheetBlockKey>()
  for (const secao of notes.sections) {
    const chave = blockForGroup(secao.title)
    if (chave) cobertosPorSecao.add(chave)
    // Ver `secaoCobreAtributos`: a lista de palavras cobre os sistemas que chamam atributo de
    // "Características" ou "Estatísticas", que mostravam o quadro certo e um bloco vazio embaixo.
    if (secaoCobreAtributos(secao.title)) cobertosPorSecao.add('attributes')
  }

  /**
   * Personagem SEM NOME recém-aberto: o cursor vai direto pro campo de nome.
   *
   * É o "agiliza a criação" pedido pelo usuário. Criar um personagem é sempre seguido de nomeá-lo,
   * e sem isto o gesto era clicar em "Novo personagem", procurar o campo com o mouse e só então
   * digitar. A condição é estreita — só quando o nome está vazio —, então abrir um personagem já
   * nomeado não rouba o foco de quem estava escrevendo noutro lugar.
   */
  useEffect(() => {
    if (profiles.active.name) return
    nomeRef.current?.focus()
  }, [profiles.activeId, profiles.active.name])

  const nomeDoPerfil = (index: number): string =>
    profiles.profiles[index].name || t.notesTab.profileUnnamed.replace('{n}', String(index + 1))

  /**
   * Adota UMA VEZ o nome que estava em `notes.characterName`, de quem já usava o app antes de
   * existirem perfis. Sem isso a pessoa abriria a ficha e veria o campo de nome vazio, com o nome
   * antigo preso dentro do arquivo de anotações e sem nenhum caminho até ele.
   *
   * A condição é estreita de propósito — só quando o perfil ainda não tem nome nenhum —, então isto
   * nunca sobrescreve um nome escrito de verdade.
   */
  useEffect(() => {
    /**
     * Só com as anotações JÁ CARREGADAS deste personagem. Sem essa guarda, criar um personagem novo
     * pegava o nome do anterior: no instante seguinte ao clique o perfil novo ainda não tem nome e
     * `notes` ainda é do anterior, e a condição abaixo dava verdadeira com o nome errado na mão.
     */
    if (loadedFor !== profiles.activeId) return
    if (profiles.active.name || !notes.characterName) return
    profiles.update(profiles.activeId, { name: notes.characterName })
    // O objeto `profiles` inteiro fora de propósito: ele é recriado a cada render do contexto, e
    // listá-lo faria este efeito rodar de novo a cada tecla digitada em qualquer campo da ficha. O
    // que ele de fato observa são os quatro valores abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedFor, notes.characterName, profiles.active.name, profiles.activeId])

  function handleRemoveProfile(): void {
    const index = profiles.profiles.findIndex((p) => p.id === profiles.activeId)
    if (profiles.profiles.length <= 1) return
    const id = profiles.activeId
    void dialogo.confirmar(t.notesTab.profileDeleteConfirm.replace('{name}', nomeDoPerfil(index))).then((ok) => {
      if (ok) profiles.remove(id)
    })
  }

  /**
   * Edita o valor de um campo de seção. Vai por ID, e não por posição, porque a lista pode ganhar
   * seções depois (uma segunda ficha importada no mesmo personagem) e índice envelhece mal.
   */
  function editarCampo(secaoId: string, campoId: string, valor: string): void {
    updateField(
      'sections',
      notes.sections.map((secao) =>
        secao.id !== secaoId
          ? secao
          : {
              ...secao,
              fields: secao.fields.map((campo) => (campo.id !== campoId ? campo : { ...campo, value: valor }))
            }
      )
    )
  }

  function removerSecao(secao: SheetSection): void {
    void dialogo.confirmar(t.notesTab.sectionRemoveConfirm.replace('{title}', secao.title)).then((ok) => {
      if (!ok) return
      updateField(
        'sections',
        notes.sections.filter((atual) => atual.id !== secao.id)
      )
    })
  }

  /**
   * A seção é um QUADRO DE VALORES (rótulo pequeno, número grande) ou uma lista de campos?
   *
   * A regra é o tamanho do CONTEÚDO, não o nome da seção — assim ela vale pra qualquer sistema sem
   * ninguém cadastrar nada. Atributos ("1", "3"), recursos ("45", "9m/6q") e partes do corpo ("0/5")
   * são todos curtos e ficam ótimos em caixa; identificação ("Agente de Saúde") é texto e ficaria
   * espremido numa.
   */
  function secaoDeValores(secao: SheetSection): boolean {
    return secao.fields.length > 1 && secao.fields.every((campo) => campo.value.trim().length <= 8)
  }

  /**
   * O botão de dado de um campo, ou nada.
   *
   * Ele só existe onde há rolagem de verdade — o `null` de `rolagemDoCampo` é o que impede um dado
   * ao lado de "Classe de Armadura" ou de "Agente de Saúde". E o nome que vai junto é o RÓTULO da
   * ficha ("Percepção", "Agilidade"), porque é ele que aparece no histórico depois: sem isso, três
   * rolagens de 1d20+3 na lista ficam indistinguíveis.
   */
  function botaoDeRolar(secao: SheetSection, campo: SheetSectionField) {
    if (!onRoll) return null
    const expressao = rolagemDoCampo(campo.value, campo.roll)
    if (!expressao) return null
    const nome = `${campo.label} (${secao.title})`
    return (
      <button
        type="button"
        className="sheet-roll"
        title={t.notesTab.sheetRollField.replace('{field}', campo.label)}
        aria-label={t.notesTab.sheetRollField.replace('{field}', campo.label)}
        disabled={rollDisabled}
        onClick={() => onRoll(expressao, nome)}
      >
        <IconeReroll tamanho={14} />
      </button>
    )
  }

  function renderBloco(
    field: 'attributes' | 'abilities' | 'inventory' | 'appearance' | 'backstory',
    label: string,
    className = ''
  ) {
    return (
      <fieldset className={`sheet-group ${className}`}>
        <legend>{label}</legend>
        <textarea
          className="sheet-textarea"
          value={notes[field]}
          onChange={(e) => updateField(field, e.target.value)}
        />
      </fieldset>
    )
  }

  return (
    <Card className="sheet-tab">
      <div className="sheet-tab-body">
        <fieldset className="sheet-group sheet-group-profile">
          <legend>{t.notesTab.sheetBlock}</legend>
          <div className="sheet-profile">
            {/* A coluna da foto: o botão e, embaixo dele, o recado de quando a escolha não deu. */}
            <div className="sheet-profile-photo-column">
              <button
                type="button"
                className="sheet-profile-photo"
                title={t.notesTab.profilePhoto}
                onClick={() => void escolherFoto()}
              >
                {profiles.active.photo ? (
                  <img src={profiles.active.photo} alt="" />
                ) : (
                  <span>{t.notesTab.profilePhotoEmpty}</span>
                )}
              </button>
              {/* Recortar de novo a foto que já está: mais zoom no rosto, outro enquadramento. */}
              {profiles.active.photo && (
                <button type="button" className="sheet-photo-recortar" onClick={() => setRecortando(profiles.active.photo)}>
                  {t.photoCrop.adjust}
                </button>
              )}
              {erroDaFoto && <p className="sheet-photo-error">{t.notesTab.profilePhotoError}</p>}
            </div>

            <div className="sheet-profile-fields">
              <label className="sheet-field sheet-field-name">
                <span>{t.notesTab.name}</span>
                <input
                  ref={nomeRef}
                  value={profiles.active.name}
                  placeholder={t.notesTab.profileUnnamed.replace('{n}', '')}
                  onChange={(e) => profiles.update(profiles.activeId, { name: e.target.value })}
                />
              </label>
              <label className="sheet-field">
                <span>{t.notesTab.profileSystem}</span>
                <input
                  value={profiles.active.system}
                  placeholder="Ordem Paranormal, Kids on Bikes, Oblivio..."
                  onChange={(e) => profiles.update(profiles.activeId, { system: e.target.value })}
                />
              </label>
              {/*
                A regra de CRÍTICO (spec §3.7) mora aqui, ao lado do sistema, porque é DELE que ela
                vem: d20 "20 é crítico" em D&D e Ordem, d100 "1 é crítico" em Cthulhu, nenhum em Kids
                on Bikes. Um `<select>` nativo serve: são só texto e poucas opções.
              */}
              <label className="sheet-field">
                <span>{t.notesTab.critRule}</span>
                <select
                  value={codigoDaRegra(notes.critico)}
                  onChange={(e) => updateField('critico', regraDoCodigo(e.target.value))}
                >
                  {LADOS_DE_CRITICO.map((lados) => (
                    <option key={`${lados}:alto`} value={`${lados}:alto`}>
                      {t.notesTab.critRuleHigh.replace('{die}', `d${lados}`)}
                    </option>
                  ))}
                  {LADOS_DE_CRITICO.map((lados) => (
                    <option key={`${lados}:baixo`} value={`${lados}:baixo`}>
                      {t.notesTab.critRuleLow.replace('{die}', `d${lados}`)}
                    </option>
                  ))}
                  <option value="nenhum">{t.notesTab.critRuleNone}</option>
                </select>
              </label>

              <div className="sheet-profile-actions">
                {/*
                  Seletor PRÓPRIO, não um `<select>` nativo: a lista mostra a miniatura 3×4 de cada
                  personagem ao lado do nome, e `<option>` não desenha imagem em navegador nenhum —
                  a mesma parede que fez o seletor de fonte existir.
                */}
                <ProfileSelect
                  profiles={profiles.profiles}
                  activeId={profiles.activeId}
                  onSelect={profiles.select}
                  fallbackName={nomeDoPerfil}
                  label={t.notesTab.profileSwitch}
                  emptyPhotoLabel={t.notesTab.profilePhotoEmpty}
                />
                {/*
                  Desabilitado no teto, com o motivo no `title`. Um botão que aceita o clique e não
                  faz nada é a pior das três opções: pior que o botão cinza, e muito pior que o botão
                  cinza que explica.
                */}
                <Button
                  variant="secondary"
                  onClick={profiles.create}
                  disabled={!profiles.podeCriar}
                  title={
                    profiles.podeCriar
                      ? undefined
                      : t.notesTab.profileLimit.replace('{max}', String(MAX_PROFILES))
                  }
                >
                  {t.notesTab.profileNew}
                </Button>
                {/*
                  Importar ficha fica ao lado de "Novo personagem" porque é a mesma decisão vista de
                  dois jeitos: criar um personagem do zero, ou criar um a partir de um PDF pronto.

                  A bandeira `IMPORTACAO_DE_FICHA_LIGADA` continua mandando: desligada, o botão some
                  inteiro em vez de aparecer cinza — botão que nunca liga só faz a pessoa procurar o
                  que está faltando. Ligada desde o 1.1.0, que é o beta do scraping.
                */}
                {IMPORTACAO_DE_FICHA_LIGADA && (
                  <Button
                    variant="secondary"
                    onClick={() => void importacao.escolherArquivo()}
                    disabled={importacao.lendo}
                  >
                    {importacao.lendo ? t.notesTab.sheetImportReading : t.notesTab.sheetImport}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  title={t.notesTab.profileDelete}
                  aria-label={t.notesTab.profileDelete}
                  disabled={profiles.profiles.length <= 1}
                  onClick={handleRemoveProfile}
                >
                  ✕
                </Button>
              </div>
              {/*
                O PACOTE (spec §3.2; ver `pacoteDePersonagem.ts`): o personagem inteiro num arquivo,
                pra mostrar ao mestre ou levar pra outro computador. Fileira própria, abaixo da de
                criar/importar ficha, porque é outra pergunta — aquela é "de onde nasce um
                personagem", esta é "como ele sai daqui e volta inteiro".
              */}
              <div className="sheet-profile-actions sheet-profile-pacote">
                <Button
                  variant="secondary"
                  title={t.notesTab.profileExportHint}
                  disabled={pacote.ocupado}
                  onClick={() => void pacote.exportar()}
                >
                  {t.notesTab.profileExport}
                </Button>
                <Button
                  variant="secondary"
                  title={t.notesTab.profileImportHint}
                  disabled={pacote.ocupado}
                  onClick={() => void pacote.importar()}
                >
                  {t.notesTab.profileImport}
                </Button>
              </div>
            </div>
          </div>
        </fieldset>

        {/*
          A FICHA ORIGINAL: as páginas do PDF guardadas com o personagem (ver `paginasDaFicha.ts`).
          Pedido do usuário: "as fichas precisam ser intuitivas e o mais parecido possível com os
          PDFs". Recolhida por padrão, porque a ficha editável é o que se usa na sessão; um clique
          abre as páginas em tamanho de leitura, aqui mesmo, sem sair do app.
        */}
        {paginasDoPdf.length > 0 && (
          <fieldset className="sheet-group sheet-original">
            <legend>{t.notesTab.originalSheet}</legend>
            <div className="sheet-original-barra">
              <Button variant="secondary" onClick={() => setMostrarOriginal((v) => !v)}>
                {mostrarOriginal
                  ? t.notesTab.originalSheetHide
                  : t.notesTab.originalSheetShow.replace('{n}', String(paginasDoPdf.length))}
              </Button>
            </div>
            {mostrarOriginal && (
              <div className="sheet-original-paginas">
                {paginasDoPdf.map((pagina, i) => (
                  <img key={i} src={pagina} alt="" draggable={false} />
                ))}
              </div>
            )}
          </fieldset>
        )}

        {/*
          A ficha assume a forma do SISTEMA quando veio de um PDF importado: cada seção com o nome
          que aquele sistema usa, e os campos dele, editáveis.

          Quando não há seções (personagem criado à mão), caem os blocos livres — atributos e
          habilidades lado a lado, porque são os dois que se consulta no meio da jogada. Num
          personagem importado eles não aparecem: as seções já dizem isso, com os nomes certos.
        */}
        {temSecoes && (
          <div className="sheet-sections">
            {notes.sections.map((secao) => (
              <fieldset key={secao.id} className="sheet-group sheet-group-section">
                <legend>
                  {secao.title}
                  <button
                    type="button"
                    className="sheet-section-remove"
                    title={t.notesTab.sectionRemove}
                    aria-label={t.notesTab.sectionRemove}
                    onClick={() => removerSecao(secao)}
                  >
                    ✕
                  </button>
                </legend>
                <div className={secaoDeValores(secao) ? 'sheet-section-stats' : 'sheet-section-fields'}>
                  {secao.fields.map((campo) => (
                    <label
                      key={campo.id}
                      className={secaoDeValores(secao) ? 'sheet-stat' : 'sheet-section-field'}
                    >
                      <span title={campo.label}>{campo.label}</span>
                      {/*
                        O campo e o dado numa linha só: o botão fica GRUDADO no número que ele rola,
                        que é o que deixa óbvio de quem ele é. Num quadro de valores a linha fica
                        embaixo do rótulo; numa lista, à direita dele.
                      */}
                      <span className="sheet-field-value">
                        <input
                          value={campo.value}
                          onChange={(e) => editarCampo(secao.id, campo.id, e.target.value)}
                        />
                        {botaoDeRolar(secao, campo)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {/*
          FICHA VAZIA — pedido do usuário pro beta: "deixa a ficha vazia, para a pessoa poder usufruir
          e fazer questão de uploadar uma para testar". Um personagem sem seção e sem uma letra nos
          blocos não mostra cinco caixas de texto pra preencher: mostra o convite de importar o PDF
          (que é o que está em teste), com o "preencher à mão" como segundo caminho. Basta uma
          seção importada, ou uma palavra digitada, e a ficha volta a ser a ficha de sempre.
        */}
        {fichaVazia && !preencherAMao ? (
          <div className="sheet-empty">
            <p className="sheet-empty-title">{t.notesTab.sheetEmptyTitle}</p>
            <p className="sheet-empty-hint">{t.notesTab.sheetEmptyHint}</p>
            <div className="sheet-empty-actions">
              {IMPORTACAO_DE_FICHA_LIGADA && (
                <Button variant="primary" onClick={() => void importacao.escolherArquivo()} disabled={importacao.lendo}>
                  {importacao.lendo ? t.notesTab.sheetImportReading : t.notesTab.sheetImport}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setPreencherAMao(true)}>
                {t.notesTab.sheetEmptyManual}
              </Button>
              {/* Quem chega num PC novo com o personagem exportado começa exatamente desta tela. */}
              <Button
                variant="ghost"
                title={t.notesTab.profileImportHint}
                disabled={pacote.ocupado}
                onClick={() => void pacote.importar()}
              >
                {t.notesTab.profileImport}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/*
              Os blocos aparecem com ou sem seções. Eles deixaram de ser a alternativa à ficha
              importada e viraram o destino dela: atributos importados caem no bloco de atributos,
              inventário no de inventário, história na de história (ver `sheetBlocks.ts`). O que vira
              seção é só o que NÃO tem bloco — Identificação, Recursos, Corpo.
            */}
            <div className="sheet-row">
              {!cobertosPorSecao.has('attributes') && renderBloco('attributes', t.notesTab.attributesBlock)}
              {!cobertosPorSecao.has('abilities') && renderBloco('abilities', t.notesTab.abilitiesBlock)}
            </div>

            <div className="sheet-row">
              {!cobertosPorSecao.has('inventory') && renderBloco('inventory', t.notesTab.inventoryBlock)}
              {!cobertosPorSecao.has('appearance') && renderBloco('appearance', t.notesTab.appearanceBlock)}
            </div>
            {!cobertosPorSecao.has('backstory') &&
              renderBloco('backstory', t.notesTab.backstoryBlock, 'sheet-group-wide')}
          </>
        )}

        {loadError && <p className="sheet-save-error">{t.notesTab.loadError}</p>}
        {saveError && <p className="sheet-save-error">{t.notesTab.saveError}</p>}
        {IMPORTACAO_DE_FICHA_LIGADA && importacao.erro && (
          <p className="sheet-save-error">{importacao.erro}</p>
        )}
      </div>

      {IMPORTACAO_DE_FICHA_LIGADA && importacao.lido && (
        <SheetImportModal
          sheet={importacao.lido}
          saving={importacao.gravando}
          /*
            Personagem SEM NOME não é oferecido pra atualizar: ele é o que o botão "Novo personagem"
            acabou de criar, e ali "atualizar" e "criar" dão exatamente no mesmo — com a diferença de
            que uma das duas frases não faz sentido nenhum na tela.
          */
          perfilAtual={
            profiles.active.name.trim()
              ? { id: profiles.activeId, name: profiles.active.name }
              : null
          }
          onCancel={importacao.cancelar}
          onConfirm={(escolha) => void importacao.confirmar(escolha)}
        />
      )}

      {recortando && (
        <RecorteDeFotoModal
          imagem={recortando}
          onConfirm={(foto) => {
            profiles.update(profiles.activeId, { photo: foto })
            setRecortando(null)
          }}
          onCancel={() => setRecortando(null)}
        />
      )}
    </Card>
  )
}
