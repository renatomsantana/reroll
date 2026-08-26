import { useEffect, useMemo, useRef, useState } from 'react'
import type { SheetImport } from '@shared/types/sheetImport'
import { montarFicha, type FichaMontada } from '@shared/types/montarFicha'
import { MAXIMO_DE_CAMPOS_POR_SECAO, type RecursoImportado } from '@shared/types/sheetImport'
import { extrairRecursos } from '@shared/types/extrairRecursos'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { Button } from '../common/Button'
import { Card } from '../common/Card'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'
import { RecorteDeFotoModal } from '../foto/RecorteDeFotoModal'
import './SheetImportModal.css'

/**
 * A tela de CONFERÊNCIA da ficha importada.
 *
 * Ela existe porque importar ficha é palpite, e palpite precisa de revisão antes de virar dado
 * gravado. Um importador que cria o personagem direto do que achou é um importador que, no primeiro
 * PDF fora do padrão, cria um personagem chamado "Assinatura do Mestre" com quatro presets de lixo —
 * e o usuário só descobre depois, tendo que apagar tudo à mão.
 *
 * Por isso três coisas aqui não são enfeite:
 *
 * - TUDO é desmarcável, campo por campo e preset por preset;
 * - o nome e o sistema são editáveis, porque são os dois que o leitor mais erra;
 * - os avisos do leitor aparecem em destaque no topo, antes da lista. O usuário precisa saber o que
 *   NÃO foi lido; silêncio sobre isso vira "o app importou errado".
 */

interface SheetImportModalProps {
  sheet: SheetImport
  onCancel: () => void
  onConfirm: (escolha: {
    /** Personagem a atualizar, ou `undefined` pra criar um novo. Ver `alvo` no componente. */
    targetProfileId?: string
    characterName: string
    system: string
    notes: FichaMontada
    presets: SheetImport['presets']
    /** As barras que ficaram marcadas — ver `extrairRecursos.ts`. */
    recursos: RecursoImportado[]
    /** A foto escolhida na conferência (spec §3.6): a do PDF, outra, ou nenhuma. */
    photo: string | null
    /** As páginas desenhadas do PDF, pra ficarem com o personagem (ver `paginasDaFicha.ts`). */
    paginas: string[]
  }) => void
  /** `true` enquanto a gravação acontece — trava os botões pra não criar dois personagens. */
  saving: boolean
  /**
   * O personagem ABERTO agora, que é o candidato a ser atualizado por esta importação. `null` quando
   * não há um que faça sentido atualizar — um recém-criado e ainda sem nome, por exemplo, em que
   * "atualizar" e "criar" dariam no mesmo.
   */
  perfilAtual: { id: string; name: string } | null
}

export function SheetImportModal({
  sheet,
  onCancel,
  onConfirm,
  saving,
  perfilAtual
}: SheetImportModalProps) {
  const t = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  useModalFocusTrap(cardRef)

  const [nome, setNome] = useState(sheet.characterName)
  const [sistema, setSistema] = useState(sheet.system)
  /**
   * Um leitor DEDICADO reconheceu a ficha. O teste é o leitor, e não `sheet.system` estar
   * preenchido: são a mesma coisa hoje, mas um leitor novo pode reconhecer um sistema e deixar o
   * nome dele em branco, e aí a tela ofereceria um campo editável dizendo que reconheceu.
   */
  const reconhecido = sheet.readerId !== 'generico'
  /**
   * Marcados por ÍNDICE, e tudo começa marcado. O usuário abriu esta janela pra importar; fazê-lo
   * marcar sessenta caixas antes de conseguir isso seria transformar um atalho em trabalho manual.
   */
  const [camposFora, setCamposFora] = useState<Set<number>>(new Set())
  const [presetsFora, setPresetsFora] = useState<Set<number>>(new Set())
  /**
   * As BARRAS que a ficha propõe (spec §3.4), a partir de TODOS os campos lidos — e não só dos
   * marcados: a barra e o campo da ficha são coisas diferentes (uma se clica, o outro se lê), e
   * desmarcar o "PV máximo" da lista de anotações não deveria apagar a barra de PV sem avisar.
   * Cada barra tem a própria caixa.
   */
  const recursosLidos = useMemo(() => extrairRecursos(sheet.fields), [sheet.fields])
  const [recursosFora, setRecursosFora] = useState<Set<number>>(new Set())
  const recursosEscolhidos = recursosLidos.filter((_, i) => !recursosFora.has(i))
  /**
   * O RETRATO (spec §3.6): começa com o que o PDF trouxe, e a pessoa mantém, troca por um arquivo
   * dela, ou tira. `null` é "sem retrato" — e no personagem atualizado isso não apaga a foto que
   * ele já tinha (ver `photo` em `SheetApplyPayload`).
   */
  const [retrato, setRetrato] = useState<string | null>(sheet.retrato ?? null)
  const [erroDoRetrato, setErroDoRetrato] = useState(false)
  /** A foto escolhida (ou a tirada do PDF) passa pelo RECORTE — zoom no rosto — antes de valer. */
  const [recortando, setRecortando] = useState<string | null>(null)

  async function escolherOutroRetrato(): Promise<void> {
    setErroDoRetrato(false)
    try {
      const escolhido = await window.api.profiles.pickPhoto()
      if (escolhido) setRecortando(escolhido)
    } catch (causa) {
      console.error('Falha ao escolher o retrato:', causa)
      setErroDoRetrato(true)
    }
  }
  /**
   * O texto SEM RÓTULO da ficha (ver `rawText` em `SheetImport`), que só existe quando a ficha é uma
   * arte com anotação por cima. Vem marcado: nesse tipo de arquivo ele é quase tudo o que há, e
   * desmarcado por padrão o usuário importaria um personagem vazio sem entender por quê.
   */
  const [trazerTexto, setTrazerTexto] = useState(true)
  /**
   * A PÁGINA DO PDF ao lado dos campos (spec da importação §9: "side-by-side view ... so the user
   * can compare without leaving the app"; pedido do usuário: "o mais parecido possível com os
   * PDFs"). Uma página por vez, com setas: a coluna é estreita, e a ficha tem uma a quatro.
   */
  const paginas = sheet.paginas ?? []
  const [pagina, setPagina] = useState(0)
  /**
   * ONDE a ficha vai parar. Começa sempre em "personagem novo", e isso é deliberado: criar é a
   * operação que não estraga nada, e atualizar substitui as seções de quem está aberto. Um padrão
   * que sobrescreve seria a escolha errada pro clique distraído.
   *
   * A opção de atualizar existe por um caso que acontece toda campanha: subiu de nível, salvou o
   * PDF, importou de novo. Sem ela o app criava um segundo personagem com o mesmo nome, e juntar os
   * dois de volta significava apagar um — levando junto o diário, que não está em PDF nenhum.
   */
  const [atualizar, setAtualizar] = useState(false)
  const alvo = atualizar && perfilAtual ? perfilAtual.id : undefined

  /**
   * "(3 de 12)" — quantos itens seguem marcados. Vem de um molde traduzido, e não montado com
   * `de`/`of` no meio do JSX: a ordem das palavras muda de idioma pra idioma.
   */
  const contagem = (escolhidos: number, total: number): string =>
    t.sheetImport.count.replace('{selected}', String(escolhidos)).replace('{total}', String(total))

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onCancel, saving])

  const camposEscolhidos = sheet.fields.filter((_, i) => !camposFora.has(i))
  const presetsEscolhidos = sheet.presets.filter((_, i) => !presetsFora.has(i))

  /**
   * O que vai pra ficha, dividido entre BLOCOS e SEÇÕES.
   *
   * Grupo que tem bloco correspondente (Habilidades, Inventário, Aparência, História) cai no bloco,
   * como texto de uma linha por campo. O que é NÚMERO — Atributos, Perícias, Recursos — vira seção,
   * e a ficha desenha seção de valores curtos como quadro. O resto (Identificação, Corpo) também
   * vira seção, com o nome que o sistema usa. Ver `sheetBlocks.ts` sobre por quê.
   */
  const paraAFicha = useMemo(
    () => montarFicha(camposEscolhidos, trazerTexto ? sheet.rawText : undefined),
    [camposEscolhidos, sheet.rawText, trazerTexto]
  )

  function alternar(conjunto: Set<number>, indice: number, aplicar: (s: Set<number>) => void): void {
    const proximo = new Set(conjunto)
    if (proximo.has(indice)) proximo.delete(indice)
    else proximo.add(indice)
    aplicar(proximo)
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onCancel()}>
      <Card ref={cardRef} className={`sheet-import ${paginas.length > 0 ? 'sheet-import-com-pagina' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-import-header">
          <h2 className="sheet-import-title">{t.sheetImport.title}</h2>
          {/*
            O sistema é AFIRMADO, não perguntado — pedido do usuário: "coloca o sistema sem a pessoa
            poder editar, já afirme que reconhecemos que é uma ficha do sistema".

            Ele tem razão sobre o caso reconhecido: quem diz o sistema é a ESTRUTURA do arquivo (os
            nomes de campo da ficha de Ordem Paranormal, os dez atributos da de Oblivio — ver o
            `detect` de cada leitor), não um palpite. Oferecer um campo de texto ali só convidava a
            digitar por cima de algo que o arquivo já provou.
          */}
          {reconhecido ? (
            <span className="sheet-import-reader">
              {t.sheetImport.recognized} <strong>{sheet.readerLabel}</strong>
            </span>
          ) : (
            <span className="sheet-import-reader">{t.sheetImport.unrecognized}</span>
          )}
        </div>

        {/*
          A IMPORTAÇÃO É BETA, e isso é dito aqui — na tela onde se decide confiar no que foi lido —,
          e não só no rótulo da aba. O aviso é fixo, e não um `warning` da lista abaixo: aqueles
          falam do ARQUIVO ("ficha sem formulário", "modelo em branco"), este fala do APP.
        */}
        <p className="sheet-import-beta">{t.sheetImport.betaNotice}</p>

        {sheet.warnings.length > 0 && (
          <ul className="sheet-import-warnings">
            {sheet.warnings.map((aviso) => (
              <li key={aviso}>{t.sheetImport.warnings[aviso]}</li>
            ))}
          </ul>
        )}
        {/* O corte por seção é dito AQUI, onde a pessoa decide — e não descoberto na ficha depois. */}
        {(paraAFicha.cortados ?? 0) > 0 && (
          <ul className="sheet-import-warnings">
            <li>
              {t.sheetImport.sectionTrimmed
                .replace('{max}', String(MAXIMO_DE_CAMPOS_POR_SECAO))
                .replace('{n}', String(paraAFicha.cortados))}
            </li>
          </ul>
        )}

        <div className="sheet-import-lado-a-lado">
        {paginas.length > 0 && (
          <aside className="sheet-import-pagina" aria-label={t.sheetImport.pageTitle}>
            <div className="sheet-import-pagina-nav">
              <button
                type="button"
                className="sheet-import-pagina-btn"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
                aria-label={t.sheetImport.pagePrev}
              >
                ◀
              </button>
              <span>{t.sheetImport.pageOf.replace('{n}', String(pagina + 1)).replace('{total}', String(paginas.length))}</span>
              <button
                type="button"
                className="sheet-import-pagina-btn"
                onClick={() => setPagina((p) => Math.min(paginas.length - 1, p + 1))}
                disabled={pagina >= paginas.length - 1}
                aria-label={t.sheetImport.pageNext}
              >
                ▶
              </button>
            </div>
            <div className="sheet-import-pagina-folha">
              <img src={paginas[Math.min(pagina, paginas.length - 1)]} alt="" draggable={false} />
            </div>
          </aside>
        )}
        <div className="sheet-import-campos">
        <div className="sheet-import-identity">
          {/*
            O retrato ao lado do nome — é a identidade da ficha. Sem candidato do PDF o bloco ainda
            aparece, com o botão de escolher: importar é o momento em que a pessoa está montando o
            personagem, e a foto faz parte disso.
          */}
          <div className="sheet-import-portrait">
            {retrato ? (
              <img className="sheet-import-portrait-img" src={retrato} alt="" draggable={false} />
            ) : (
              <span className="sheet-import-portrait-img sheet-import-portrait-empty">{t.sheetImport.portraitEmpty}</span>
            )}
            <div className="sheet-import-portrait-actions">
              <button type="button" className="sheet-import-portrait-btn" onClick={() => void escolherOutroRetrato()}>
                {retrato ? t.sheetImport.portraitReplace : t.sheetImport.portraitChoose}
              </button>
              {retrato && (
                <button type="button" className="sheet-import-portrait-btn" onClick={() => setRecortando(retrato)}>
                  {t.photoCrop.adjust}
                </button>
              )}
              {retrato && (
                <button type="button" className="sheet-import-portrait-btn" onClick={() => setRetrato(null)}>
                  {t.sheetImport.portraitRemove}
                </button>
              )}
            </div>
            {sheet.retrato && retrato === sheet.retrato && (
              <span className="sheet-import-portrait-hint">{t.sheetImport.portraitFromPdf}</span>
            )}
            {erroDoRetrato && <span className="sheet-import-portrait-hint">{t.notesTab.profilePhotoError}</span>}
          </div>
          <label>
            {t.sheetImport.character}
            <input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          {/*
            O campo de sistema só aparece quando NENHUM leitor reconheceu a ficha. Nesse caso não há
            o que afirmar, e deixar o personagem sem sistema nenhum seria pior que perguntar — é a
            única informação da tela que o arquivo não entregou.
          */}
          {!reconhecido && (
            <label>
              {t.sheetImport.system}
              <input
                value={sistema}
                placeholder={t.sheetImport.systemPlaceholder}
                onChange={(e) => setSistema(e.target.value)}
              />
            </label>
          )}
        </div>

        {perfilAtual && (
          <div className="sheet-import-destination">
            <span className="sheet-import-destination-label">{t.sheetImport.destinationLabel}</span>
            <label>
              <input
                type="radio"
                name="sheet-import-destino"
                checked={!atualizar}
                onChange={() => setAtualizar(false)}
              />
              {t.sheetImport.destinationNew}
            </label>
            <label>
              <input
                type="radio"
                name="sheet-import-destino"
                checked={atualizar}
                onChange={() => setAtualizar(true)}
              />
              {t.sheetImport.destinationUpdate.replace('{name}', perfilAtual.name)}
            </label>
            {atualizar && <p className="sheet-import-destination-hint">{t.sheetImport.destinationUpdateHint}</p>}
          </div>
        )}

        {/*
          As barras vêm ANTES das duas listas: são poucas (três numa ficha de Ordem) e são o que a
          pessoa vai clicar em toda sessão — o que mais vale conferir, e o que mais custa se vier
          errado. "Atual em branco" é dito barra por barra, como a spec pede.
        */}
        {recursosLidos.length > 0 && (
          <section className="sheet-import-section sheet-import-resources">
            <h3>
              {t.sheetImport.resourcesTitle} <span>{contagem(recursosEscolhidos.length, recursosLidos.length)}</span>
            </h3>
            <ul className="sheet-import-list sheet-import-resources-list">
              {recursosLidos.map((recurso, i) => (
                <li key={`${recurso.nome}-${i}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!recursosFora.has(i)}
                      onChange={() => alternar(recursosFora, i, setRecursosFora)}
                    />
                    <span className="sheet-import-label">{recurso.nome}</span>
                    <span className="sheet-import-value">
                      {recurso.atual} / {recurso.maximo}
                    </span>
                    {recurso.atualEmBranco && (
                      <span className="sheet-import-kind">{t.sheetImport.resourceBlankCurrent}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="sheet-import-columns">
          <section className="sheet-import-section">
            <h3>
              {t.sheetImport.fieldsTitle} <span>{contagem(camposEscolhidos.length, sheet.fields.length)}</span>
            </h3>
            {sheet.fields.length === 0 ? (
              <p className="sheet-import-empty">{t.sheetImport.fieldsEmpty}</p>
            ) : (
              <ul className="sheet-import-list">
                {sheet.fields.map((campo, i) => (
                  <li key={`${campo.label}-${i}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!camposFora.has(i)}
                        onChange={() => alternar(camposFora, i, setCamposFora)}
                      />
                      <span className="sheet-import-label">{campo.label}</span>
                      <span className="sheet-import-value">{campo.value}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sheet-import-section">
            <h3>
              {t.sheetImport.presetsTitle} <span>{contagem(presetsEscolhidos.length, sheet.presets.length)}</span>
            </h3>
            {sheet.presets.length === 0 ? (
              <p className="sheet-import-empty">{t.sheetImport.presetsEmpty}</p>
            ) : (
              <ul className="sheet-import-list">
                {sheet.presets.map((preset, i) => (
                  <li key={`${preset.name}-${i}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!presetsFora.has(i)}
                        onChange={() => alternar(presetsFora, i, setPresetsFora)}
                      />
                      <span className="sheet-import-label">{preset.name}</span>
                      <span className="sheet-import-kind">{t.sheetImport.kinds[preset.kind]}</span>
                      <span className="sheet-import-value">{descreverExpressao(preset)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/*
          O texto que não tem rótulo. Só aparece na ficha que é ARTE com anotação por cima, onde os
          nomes dos campos são desenho e não há como dizer o que é cada valor — mostrar isso como uma
          lista de "campo = valor" seria inventar rótulo. Aqui ele aparece como está na página, e o
          usuário decide se traz ou não.
        */}
        {sheet.rawText && (
          <section className="sheet-import-section sheet-import-raw">
            <h3>
              <label>
                <input
                  type="checkbox"
                  checked={trazerTexto}
                  onChange={() => setTrazerTexto((atual) => !atual)}
                />
                {t.sheetImport.rawTextTitle} <span>{t.sheetImport.rawTextHint}</span>
              </label>
            </h3>
            <pre className="sheet-import-rawtext">{sheet.rawText}</pre>
          </section>
        )}

        </div>
        </div>

        <div className="sheet-import-actions">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            {t.sheetImport.cancel}
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                targetProfileId: alvo,
                characterName: nome,
                system: reconhecido ? sheet.system : sistema,
                notes: paraAFicha,
                presets: presetsEscolhidos,
                recursos: recursosEscolhidos.map(({ nome, atual, maximo }) => ({ nome, atual, maximo })),
                photo: retrato,
                paginas: sheet.paginas ?? []
              })
            }
            disabled={saving || !nome.trim()}
          >
            {saving ? t.sheetImport.confirming : alvo ? t.sheetImport.update : t.sheetImport.confirm}
          </Button>
        </div>

        {recortando && (
          <RecorteDeFotoModal
            imagem={recortando}
            onConfirm={(foto) => {
              setRetrato(foto)
              setRecortando(null)
            }}
            onCancel={() => setRecortando(null)}
          />
        )}
      </Card>
    </div>
  )
}

/** "1d20+7" a partir da expressão — a mesma leitura que o usuário fez na ficha, de volta pra ele. */
function descreverExpressao(preset: SheetImport['presets'][number]): string {
  const dados = preset.expression.groups.map((grupo) => `${grupo.count}d${grupo.sides}`).join(' + ')
  const total = preset.expression.modifiers.reduce((soma, m) => soma + m.value, 0)
  if (total === 0) return dados
  return `${dados} ${total > 0 ? '+' : '-'} ${Math.abs(total)}`
}
