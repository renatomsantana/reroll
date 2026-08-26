import { useEffect, useRef, useState } from 'react'
import type { DiceExpression, RollResult } from '@shared/types/dice'
import type { Preset, PresetInput } from '@shared/types/preset'
import { rolarFormula, rollExpression } from '@renderer/domain/dice/diceEngine'
import { botaoDeExplodeVisivel } from '@renderer/domain/dice/explodeDoSistema'
import { analisarFormula } from '@shared/dice/formula'
import { usePresets } from '@renderer/hooks/usePresets'
import { useNotes } from '@renderer/hooks/useNotes'
import { useRollHistory } from '@renderer/hooks/useRollHistory'
import { alturaExtraCompacta } from '@shared/windowSizes'
import { useUpdateStatus } from '@renderer/hooks/useUpdateStatus'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useProfiles } from '@renderer/settings/ProfilesContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { playRollSound } from '@renderer/audio/rollSound'
import { TitleBar } from '@renderer/components/chrome/TitleBar'
import { Toolbar, type AppTab } from '@renderer/components/chrome/Toolbar'
import { StatusBar } from '@renderer/components/chrome/StatusBar'
import { SettingsPanel } from '@renderer/components/chrome/SettingsPanel'
import { DiceRoller3D, type DiceRoller3DHandle } from '@renderer/components/roller/DiceRoller3D'
import { CompactWidget } from '@renderer/components/compact/CompactWidget'
import { ProfileBadge } from '@renderer/components/common/ProfileBadge'
import { PresetList } from '@renderer/components/presets/PresetList'
import { PresetEditorModal } from '@renderer/components/presets/PresetEditorModal'
import { HistoryModal } from '@renderer/components/history/HistoryModal'
import { RecursoEditorModal } from '@renderer/components/recursos/RecursoEditorModal'
import { DescansoModal } from '@renderer/components/recursos/DescansoModal'
import { HudDoPersonagem } from '@renderer/components/hud/HudDoPersonagem'
import { DescansoEditorModal } from '@renderer/components/recursos/DescansoEditorModal'
import { aplicarDescanso, resumoDoDescanso, type Descanso } from '@shared/types/descanso'
import { rotulosDoChat } from '@renderer/components/common/BotaoCopiar'
import { useDialogo } from '@renderer/components/common/Dialogo'
import { linhaParaChat } from '@shared/dice/linhaParaChat'
import { comMarcasDeCritico } from '@shared/dice/critico'
import { tocarCritico, tocarFalha } from '@renderer/audio/efeitosDeCritico'
import { SheetTab } from '@renderer/components/notes/SheetTab'
import { NotesTab } from '@renderer/components/notes/NotesTab'
import { StyleTab } from '@renderer/components/style/StyleTab'
import { UpdatePrompt } from '@renderer/components/chrome/UpdatePrompt'
import { SplashScreen } from '@renderer/components/splash/SplashScreen'
import './App.css'

export default function App() {
  const { soundEnabled, compactMode, launchMode, autoCopyRolls, copyMarkdown, critSoundEnabled } = useSettings()
  const t = useTranslation()
  const dialogo = useDialogo()
  const profiles = useProfiles()
  const indiceDoAtivo = Math.max(0, profiles.profiles.findIndex((p) => p.id === profiles.activeId))
  const [showSplash, setShowSplash] = useState(true)
  const [activeTab, setActiveTab] = useState<AppTab>('roll')
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Histórico de rolagens, aberto pelo botão dentro das Preferências (ver `HistoryModal`). */
  const [historyOpen, setHistoryOpen] = useState(false)
  const [compactLastResult, setCompactLastResult] = useState<RollResult | null>(null)
  const roller3DRef = useRef<DiceRoller3DHandle>(null)
  const { history, addToHistory, registrarDescanso, clearHistory } = useRollHistory()
  /** O DESCANSO (spec §3.8): a confirmação com o delta, e o editor dos tipos. */
  const [descansando, setDescansando] = useState(false)
  const [editandoDescansos, setEditandoDescansos] = useState(false)
  /**
   * Toda rolagem terminada passa por aqui: vai pro histórico e, com "copiar toda rolagem" ligado
   * (spec §3.5), já vai pra área de transferência na linha do chat. Um funil só, pros dois
   * caminhos (cena 3D e modo compacto) copiarem a mesma linha.
   */
  function registrarRolagem(result: RollResult): void {
    addToHistory(result)
    if (autoCopyRolls) {
      void window.api.clipboard.writeText(linhaParaChat(result, copyMarkdown, rotulosDoChat(t))).catch((causa: unknown) => {
        console.error('Falha ao copiar a rolagem:', causa)
      })
    }
  }
  /**
   * Existe versão nova? O aviso vive na barra de status e numa marca na engrenagem — sem isso ele
   * ficaria escondido dentro das Preferências, que é onde ninguém entra sem motivo.
   */
  const updateStatus = useUpdateStatus()
  /**
   * Versão que a pessoa dispensou com "Agora não". Guardada só na memória de propósito: a pergunta
   * não se repete nesta sessão, mas volta na próxima abertura — quem adiou não é perseguido, e quem
   * esqueceu não fica pra trás. O aviso na barra de baixo continua visível o tempo todo.
   */
  const [dismissedUpdate, setDismissedUpdate] = useState<string | null>(null)
  const { presets, createPreset, updatePreset, deletePreset, exportPresets, importPresets, setFavorite, moveFavorite } =
    usePresets()
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  /**
   * Espelha `DiceRoller3D`'s `isRolling` — usado só pra desabilitar as ações de preset
   * (rolar/editar/excluir) enquanto QUALQUER rolagem está em andamento, mesmo padrão de
   * `disabled={isRolling}` já usado dentro do próprio `DiceRoller3D.tsx`. Existe pra fechar
   * um bug real: editar um preset e cancelar enquanto a rolagem que ELE MESMO disparou ainda
   * está animando podia travar a interface (achado testando ao vivo) — impedir a interação
   * nesse período evita o cenário inteiro, independente da causa exata.
   */
  const [isAnyRollInProgress, setIsAnyRollInProgress] = useState(false)
  /**
   * As BARRAS de recurso do personagem aberto (spec §3.4) vêm das anotações dele — a instância
   * única do `NotesProvider`, a mesma que a aba Ficha edita. Ver o cabeçalho de `useNotes.ts` sobre
   * por que não pode ser uma cópia própria.
   */
  const notas = useNotes()
  const recursos = notas.notes.recursos
  const [editandoRecursos, setEditandoRecursos] = useState(false)
  const quantidadeDeBarras = recursos.length
  /** Algum modal das barras aberto — trava os atalhos da cena e o Ctrl+N. */
  const modalDasBarrasAberto = editandoRecursos || descansando || editandoDescansos

  /** Confirmado: aplica, grava, e o histórico ganha a linha "— Descanso longo — PV 12→27". */
  function confirmarDescanso(descanso: Descanso): void {
    const { recursos: novos, mudancas } = aplicarDescanso(recursos, descanso)
    notas.updateField('recursos', novos)
    registrarDescanso(descanso.nome, resumoDoDescanso(mudancas))
    setDescansando(false)
  }

  useEffect(() => {
    if (showSplash) return
    /**
     * No modo compacto a janela cresce uma faixa por barra (ver `alturaExtraCompacta`). Espera as
     * anotações carregarem pra não redimensionar duas vezes na abertura — uma sem barra e outra
     * com — que é um pulo visível na janelinha.
     */
    if (compactMode && notas.loading) return
    void window.api.windowControls.setCompact(compactMode, compactMode ? alturaExtraCompacta(quantidadeDeBarras) : 0)
    if (compactMode) setActiveTab('roll')
  }, [compactMode, showSplash, quantidadeDeBarras, notas.loading])

  useEffect(() => {
    if (showSplash) return
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.key.toLowerCase() !== 'n') return
      if (compactMode || activeTab !== 'roll' || isCreating || editingPreset || settingsOpen || modalDasBarrasAberto) return
      e.preventDefault()
      setIsCreating(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSplash, compactMode, activeTab, isCreating, editingPreset, settingsOpen, modalDasBarrasAberto])

  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => {
          // Redimensiona a janela ENQUANTO o splash ainda está visível, não depois — sem isso
          // (`setShowSplash(false)` primeiro) a interface completa chegava a renderizar por um
          // instante dentro da janela ainda pequena (360×320, tamanho do splash) antes do
          // redimensionamento assíncrono terminar, um "flash" visível de layout espremido. O
          // usuário só quer ver o splash mini e, na sequência, já a janela no tamanho padrão —
          // nunca um estado intermediário quebrado no meio.
          void window.api.windowControls.setCompact(compactMode).then(() => setShowSplash(false))
        }}
      />
    )
  }

  /**
   * Preset rolado no modo compacto. Aqui NÃO dá pra usar o `handlePresetRoll`: aquele delega pro
   * `roller3DRef`, e no modo compacto não existe cena 3D montada — o ref é nulo e o clique não faria
   * nada. Este resolve na hora, com `rollExpression`, que é o mesmo cálculo sem a física.
   */
  function handleCompactPresetRoll(preset: Preset) {
    // `sourceName` é o que faz o histórico registrar QUAL preset foi, e não só "1d20 + 5".
    const bruto = rolarPresetSemFisica(preset)
    if (!bruto) return
    // As marcas de crítico/falha (spec §3.7) pela regra do personagem — o mesmo funil da cena.
    const result = comMarcasDeCritico(bruto, notas.notes.critico)
    setCompactLastResult(result)
    // Som aqui, junto com o cálculo do resultado — é o mais perto que o roller compacto
    // (instantâneo, sem física) tem de um "início" de rolagem.
    if (soundEnabled) {
      const diceCount = result.groups.reduce((sum, g) => sum + g.rolls.length, 0)
      playRollSound(diceCount)
      if (critSoundEnabled && (result.critico || result.falha)) (result.critico ? tocarCritico : tocarFalha)()
    }
    registrarRolagem(result)
  }

  /**
   * Rolagem disparada da FICHA — um atributo, uma perícia, o dano de uma arma (ver `sheetRoll.ts`).
   *
   * Ela troca pra aba de Rolagem antes de rolar, e isso não é enfeite: os dados caem na bandeja 3D,
   * que mora lá. Sem a troca, o clique na ficha faria os dados rolarem numa tela que a pessoa não
   * está vendo — o botão pareceria quebrado enquanto o app fazia exatamente o que foi pedido.
   *
   * Não custa remontagem nenhuma: a aba de Rolagem fica montada o tempo todo, só escondida (ver o
   * comentário do `display` mais abaixo), então o `roller3DRef` já aponta pra uma cena viva.
   */
  function handleSheetRoll(expression: DiceExpression, name: string) {
    const modifierTotal = expression.modifiers.reduce((sum, m) => sum + m.value, 0)
    setActiveTab('roll')
    roller3DRef.current?.rollGroups(expression.groups, modifierTotal, name, expression.keep, expression.explode)
  }

  function handlePresetRoll(preset: Preset) {
    /**
     * PRESET DE FÓRMULA rola pela gramática, em ondas na cena (ver `rolagemPorEtapas.ts`). O texto
     * gravado passou pela validação ao ser salvo; se mesmo assim não ler (um `presets.json`
     * editado à mão depois disso), o clique não rola OUTRA coisa no lugar — fica no console.
     */
    if (preset.formula) {
      const lida = analisarFormula(preset.formula)
      if (!lida.ok) {
        console.error(`Preset de fórmula não lê: "${preset.formula}": ${lida.mensagem}`)
        return
      }
      roller3DRef.current?.rollFormula(lida.formula, preset.name)
      return
    }
    if (!preset.expression) return
    const modifierTotal = preset.expression.modifiers.reduce((sum, m) => sum + m.value, 0)
    // O nome vai junto só pro histórico registrar QUAL golpe foi (ver `sourceName` em `RollResult`).
    // A regra de manter ("role 3d20 e use o maior") vai junto porque quem soma o total é a cena.
    roller3DRef.current?.rollGroups(
      preset.expression.groups,
      modifierTotal,
      preset.name,
      preset.expression.keep,
      preset.expression.explode
    )
  }

  /**
   * O preset resolvido na hora, sem cena — o caminho do modo compacto, pros DOIS tipos de preset:
   * expressão pelo `rollExpression` de sempre, fórmula pelo `rolarFormula` (o mesmo RNG). `null`
   * quando não há o que rolar (arquivo editado à mão) — e aí não se rola outra coisa no lugar.
   */
  function rolarPresetSemFisica(preset: Preset): RollResult | null {
    if (preset.formula) {
      const lida = analisarFormula(preset.formula)
      const result = lida.ok ? rolarFormula(lida.formula, preset.name) : null
      if (!result) console.error(`Preset de fórmula não rola: "${preset.formula}"`)
      return result
    }
    if (!preset.expression) return null
    return { ...rollExpression(preset.expression), sourceName: preset.name }
  }

  async function handleSavePreset(input: PresetInput) {
    try {
      if (editingPreset) {
        await updatePreset(editingPreset.id, input)
      } else {
        await createPreset(input)
      }
      setEditingPreset(null)
      setIsCreating(false)
    } catch (error) {
      // Deixa o modal aberto (com os dados já digitados) em vez de fechar silenciosamente —
      // o usuário perderia o preset sem nenhum aviso se create/update falhar (ex.: disco
      // cheio, sem permissão em %APPDATA%).
      void dialogo.avisar(t.presets.saveError.replace('{error}', (error as Error).message))
    }
  }

  /**
   * O "tem certeza?" é o diálogo do APP (`useDialogo`), não o `confirm()` do sistema — era o
   * `confirm()` daqui que deixava a janela sem teclado depois de apagar (ver `Dialogo.tsx`).
   */
  function handleDeletePreset(preset: Preset) {
    void dialogo.confirmar(t.presets.deleteConfirm.replace('{name}', preset.name)).then((ok) => {
      if (!ok) return
      // `catch` porque apagar é gravação em disco e pode falhar. Sem ele, a falha era uma rejeição
      // sem dono — o preset continuava na tela e ninguém sabia por quê.
      return deletePreset(preset.id).catch((causa: unknown) => {
        console.error('Falha ao apagar o preset:', causa)
        return dialogo.avisar(t.presets.exportError.replace('{error}', String((causa as Error)?.message ?? causa)))
      })
    })
  }

  async function handleExportPresets() {
    /**
     * O `try` faltava, e o `import` logo abaixo já tinha o dele — a assimetria era o defeito.
     * Exportar é gravar um arquivo numa pasta que a pessoa escolheu, e isso falha de verdade: disco
     * cheio, pasta protegida, pendrive removido entre escolher e gravar. Sem o `catch`, o clique em
     * "Exportar" simplesmente não fazia nada.
     */
    try {
      const path = await exportPresets()
      if (path) await dialogo.avisar(t.presets.exportSuccess.replace('{path}', path))
    } catch (causa) {
      console.error('Falha ao exportar presets:', causa)
      await dialogo.avisar(t.presets.exportError.replace('{error}', (causa as Error).message))
    }
  }

  async function handleImportPresets() {
    try {
      const result = await importPresets()
      if (result) await dialogo.avisar(t.presets.importSuccess.replace('{count}', String(result.importedCount)))
    } catch (error) {
      await dialogo.avisar(t.presets.importError.replace('{error}', (error as Error).message))
    }
  }

  const isEditorOpen = isCreating || editingPreset !== null

  return (
    <div className={`app-window ${compactMode ? 'app-window-compact' : ''}`}>
      <TitleBar />
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
        showTabs={!compactMode}
        hasUpdate={updateStatus.state === 'available'}
      />

      {/*
        Uma coluna só. Havia uma barra lateral fixa de 260px com o histórico, ligada o tempo todo na
        aba Rolagem; ela saiu (o histórico virou o `HistoryModal`, aberto pelas Preferências) e a
        largura dela foi inteira pra cena 3D e pros presets — pedido do usuário: "expande mais a
        tela principal já que agora tá sem histórico".
      */}
      <div className="app-layout">
        <main className="app-main">
          {compactMode ? (
            <CompactWidget
              presets={presets}
              result={compactLastResult}
              onRoll={handleCompactPresetRoll}
              recursos={recursos}
              onChangeRecursos={(lista) => notas.updateField('recursos', lista)}
            />
          ) : (
            <>
              {/*
                A aba de ROLAGEM fica sempre montada, só escondida — as outras duas é que entram e
                saem.

                Ela era desmontada como as outras, e desmontar leva junto TODO o estado dela: os
                dados montados, o modificador, o resultado da última rolagem e a cena 3D inteira.
                Voltar pra aba reconstruía tudo do zero, e o usuário viu isso como "está resetando".
                Não era estado mal guardado: era o componente deixando de existir.
                
                Esconder em vez de desmontar preserva o que ele já tinha e ainda evita reconstruir a
                cena — que custa ~55ms de geometria e um pico de compilação de shader, o mesmo custo
                que a remontagem por troca de dados tinha (ver o `key` em `DiceRoller3D.tsx`).
              */}
              <div
                className="app-tab-roll"
                style={{ display: activeTab === 'roll' ? 'contents' : 'none' }}
              >
              {/*
                `flex: 1 0 auto`, e NÃO `flex: 1` (que é `1 1 0%`): a seção da cena CRESCE quando
                sobra espaço, mas nunca ENCOLHE abaixo do próprio conteúdo. Com `1 1 0%` ela era
                espremida pelas seções de baixo e o conteúdo (canvas com `min-height` mais a linha de
                resultado) vazava por cima das barras e dos presets — medido em `medirAbaDeRolagem.mjs`:
                a linha de resultado terminava em 643px com a seção seguinte começando em 623. É a
                mesma regra de `.app-section` em `App.css`; o inline a estava desfazendo.
              */}
              <section className="app-section" style={{ flex: '1 0 auto', minHeight: 0 }}>
                <DiceRoller3D
                  ref={roller3DRef}
                  onRoll={registrarRolagem}
                  onRollingChange={setIsAnyRollInProgress}
                  /* O botão Explode só aparece com perfil de D&D — ver `explodeDoSistema.ts`. */
                  explodeVisivel={botaoDeExplodeVisivel(profiles.active?.system ?? '')}
                  /* A regra de crítico é do personagem — ver `critico.ts` e a Ficha. */
                  regraDeCritico={notas.notes.critico}
                  /*
                    O HUD sobre a cena (spec §3.6) — só quando a ficha carregada é a do personagem
                    aberto. É a ÚNICA casa das barras de recurso na tela cheia: elas já foram também
                    uma seção própria e depois uma caixa na linha de controles, e o usuário pediu pra
                    tirar — a mesma barra em dois lugares da mesma tela era uma a mais. O lápis de
                    criar/editar barras e o Descansar moram no HUD por isso.
                  */
                  overlay={
                    notas.loadedFor === profiles.activeId && (
                      <HudDoPersonagem
                        profile={profiles.active}
                        fallbackName={t.notesTab.profileUnnamed.replace('{n}', String(indiceDoAtivo + 1))}
                        recursos={recursos}
                        onChangeRecursos={(lista) => notas.updateField('recursos', lista)}
                        condicoes={notas.notes.condicoes}
                        onChangeCondicoes={(lista) => notas.updateField('condicoes', lista)}
                        hud={notas.notes.hud}
                        onChangeHud={(estado) => notas.updateField('hud', estado)}
                        onRest={() => setDescansando(true)}
                        onEditRecursos={() => setEditandoRecursos(true)}
                      />
                    )
                  }
                  /*
                    Atalhos SÓ com a aba de rolagem na tela. Ela fica montada e escondida nas outras
                    (ver o comentário do `display` acima), e sem isto o Espaço rolava os dados
                    enquanto a pessoa escrevia nas Anotações.
                  */
                  shortcutsEnabled={activeTab === 'roll' && !settingsOpen && !isEditorOpen && !modalDasBarrasAberto}
                  /* De quem são os dados — o crachá ao lado do ROLAR (ver `ProfileBadge.tsx`). */
                  badge={
                    <ProfileBadge
                      profile={profiles.active}
                      fallbackName={t.notesTab.profileUnnamed.replace('{n}', String(indiceDoAtivo + 1))}
                      emptyPhotoLabel={t.notesTab.profilePhotoEmpty}
                      variant="roll"
                    />
                  }
                />
              </section>

              <section className="app-section">
                <PresetList
                  presets={presets}
                  onRoll={handlePresetRoll}
                  onEdit={setEditingPreset}
                  onDelete={handleDeletePreset}
                  onCreate={() => setIsCreating(true)}
                  onExport={() => void handleExportPresets()}
                  onImport={() => void handleImportPresets()}
                  /* A estrela (spec §3.9): gravação em disco, então a falha tem dono — vai pro console e pra tela. */
                  onToggleFavorite={(preset) =>
                    void setFavorite(preset.id, preset.favorito === undefined).catch((causa: unknown) => {
                      console.error('Falha ao favoritar o preset:', causa)
                      return dialogo.avisar(t.presets.saveError.replace('{error}', String((causa as Error)?.message ?? causa)))
                    })
                  }
                  onMoveFavorite={(preset, direcao) =>
                    void moveFavorite(preset.id, direcao).catch((causa: unknown) => {
                      console.error('Falha ao mover o favorito:', causa)
                    })
                  }
                  disabled={isAnyRollInProgress}
                  /**
                   * Rolar continua liberado durante uma rolagem NA BANDEJA — pedido do usuário
                   * ("que aconteça a qualquer momento"), possível agora que preset não remonta
                   * mais a cena. Na TORRE segue travado: lá a rolagem é uma fila de dados e cortar
                   * no meio deixa dados presos em espera (ver `rollGroups` em `DiceRoller3D.tsx`,
                   * que recusa o clique nesse caso — o botão travado é só o aviso visual disso).
                   */
                  rollDisabled={isAnyRollInProgress && launchMode === 'tower'}
                />
              </section>
              </div>

              {activeTab === 'style' && (
                <section className="app-section">
                  <StyleTab />
                </section>
              )}
              {activeTab === 'sheet' && (
                <SheetTab
                  onRoll={handleSheetRoll}
                  /* Mesma trava da lista de presets — ver o comentário do `rollDisabled` de lá. */
                  rollDisabled={isAnyRollInProgress && launchMode === 'tower'}
                />
              )}

              {activeTab === 'notes' && (
                <section className="app-section">
                  <NotesTab />
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {!compactMode && (
        <StatusBar updateStatus={updateStatus} onOpenSettings={() => setSettingsOpen(true)} />
      )}

      {/*
        O app PERGUNTA sozinho ao encontrar versão nova. Só aparece com a janela normal (no modo
        compacto a janela tem 300×230 e não cabe diálogo nenhum) e enquanto a versão não tiver sido
        dispensada nesta sessão.
      */}
      {!compactMode &&
        (updateStatus.state === 'downloading' ||
          (updateStatus.state === 'available' && dismissedUpdate !== updateStatus.version)) && (
          <UpdatePrompt
            status={updateStatus}
            onDismiss={() =>
              setDismissedUpdate(updateStatus.state === 'available' ? updateStatus.version : null)
            }
          />
        )}

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          onOpenHistory={() => {
            // Fecha as Preferências antes de abrir: dois modais empilhados dariam duas camadas de
            // fundo escuro e dois cercos de foco brigando pelo Tab.
            setSettingsOpen(false)
            setHistoryOpen(true)
          }}
        />
      )}

      {editandoRecursos && (
        <RecursoEditorModal
          recursos={recursos}
          onSave={(lista) => {
            notas.updateField('recursos', lista)
            setEditandoRecursos(false)
          }}
          onCancel={() => setEditandoRecursos(false)}
        />
      )}

      {descansando && (
        <DescansoModal
          recursos={recursos}
          descansos={notas.notes.descansos}
          onConfirm={confirmarDescanso}
          onEdit={() => {
            // Um modal de cada vez — ver o mesmo cuidado em `onOpenHistory`.
            setDescansando(false)
            setEditandoDescansos(true)
          }}
          onCancel={() => setDescansando(false)}
        />
      )}

      {editandoDescansos && (
        <DescansoEditorModal
          recursos={recursos}
          descansos={notas.notes.descansos}
          onSave={(lista) => {
            notas.updateField('descansos', lista)
            setEditandoDescansos(false)
            setDescansando(true)
          }}
          onCancel={() => {
            setEditandoDescansos(false)
            setDescansando(true)
          }}
        />
      )}

      {historyOpen && (
        <HistoryModal
          history={history}
          onClear={clearHistory}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {isEditorOpen && (
        <PresetEditorModal
          preset={editingPreset}
          // O `void` diz "esta promessa é tratada lá dentro" — e é: `handleSavePreset` tem o `try`
          // dele, e é ele que mantém o modal aberto quando a gravação falha.
          onSave={(input) => void handleSavePreset(input)}
          onCancel={() => {
            setEditingPreset(null)
            setIsCreating(false)
          }}
        />
      )}
    </div>
  )
}
