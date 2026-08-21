import { useEffect, useRef, useState } from 'react'
import type { DiceExpression, RollResult } from '@shared/types/dice'
import type { Preset, PresetInput } from '@shared/types/preset'
import { rollExpression } from '@renderer/domain/dice/diceEngine'
import { usePresets } from '@renderer/hooks/usePresets'
import { useRollHistory } from '@renderer/hooks/useRollHistory'
import { useUpdateStatus } from '@renderer/hooks/useUpdateStatus'
import { useSettings } from '@renderer/settings/SettingsContext'
import { useTranslation } from '@renderer/i18n/useTranslation'
import { playRollSound } from '@renderer/audio/rollSound'
import { TitleBar } from '@renderer/components/chrome/TitleBar'
import { Toolbar, type AppTab } from '@renderer/components/chrome/Toolbar'
import { StatusBar } from '@renderer/components/chrome/StatusBar'
import { SettingsPanel } from '@renderer/components/chrome/SettingsPanel'
import { DiceRoller3D, type DiceRoller3DHandle } from '@renderer/components/roller/DiceRoller3D'
import { CompactWidget } from '@renderer/components/compact/CompactWidget'
import { PresetList } from '@renderer/components/presets/PresetList'
import { PresetEditorModal } from '@renderer/components/presets/PresetEditorModal'
import { HistoryModal } from '@renderer/components/history/HistoryModal'
import { SheetTab } from '@renderer/components/notes/SheetTab'
import { NotesTab } from '@renderer/components/notes/NotesTab'
import { StyleTab } from '@renderer/components/style/StyleTab'
import { UpdatePrompt } from '@renderer/components/chrome/UpdatePrompt'
import { SplashScreen } from '@renderer/components/splash/SplashScreen'
import './App.css'

export default function App() {
  const { soundEnabled, compactMode, launchMode } = useSettings()
  const t = useTranslation()
  const [showSplash, setShowSplash] = useState(true)
  const [activeTab, setActiveTab] = useState<AppTab>('roll')
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Histórico de rolagens, aberto pelo botão dentro das Preferências (ver `HistoryModal`). */
  const [historyOpen, setHistoryOpen] = useState(false)
  const [compactLastResult, setCompactLastResult] = useState<RollResult | null>(null)
  const roller3DRef = useRef<DiceRoller3DHandle>(null)
  const { history, addToHistory, clearHistory } = useRollHistory()
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
  const { presets, createPreset, updatePreset, deletePreset, exportPresets, importPresets } =
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

  useEffect(() => {
    if (showSplash) return
    void window.api.windowControls.setCompact(compactMode)
    if (compactMode) setActiveTab('roll')
  }, [compactMode, showSplash])

  useEffect(() => {
    if (showSplash) return
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || e.key.toLowerCase() !== 'n') return
      if (compactMode || activeTab !== 'roll' || isCreating || editingPreset || settingsOpen) return
      e.preventDefault()
      setIsCreating(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSplash, compactMode, activeTab, isCreating, editingPreset, settingsOpen])

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
    const result = { ...rollExpression(preset.expression), sourceName: preset.name }
    setCompactLastResult(result)
    // Som aqui, junto com o cálculo do resultado — é o mais perto que o roller compacto
    // (instantâneo, sem física) tem de um "início" de rolagem.
    if (soundEnabled) {
      const diceCount = result.groups.reduce((sum, g) => sum + g.rolls.length, 0)
      playRollSound(diceCount)
    }
    addToHistory(result)
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
      alert(t.presets.saveError.replace('{error}', (error as Error).message))
    }
  }

  function handleDeletePreset(preset: Preset) {
    if (!confirm(t.presets.deleteConfirm.replace('{name}', preset.name))) return
    // `void` com `catch`: apagar é gravação em disco e pode falhar. Sem o `catch`, a falha era uma
    // rejeição sem dono — o preset continuava na tela e ninguém sabia por quê.
    void deletePreset(preset.id).catch((causa: unknown) => {
      console.error('Falha ao apagar o preset:', causa)
      alert(t.presets.exportError.replace('{error}', String((causa as Error)?.message ?? causa)))
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
      if (path) alert(t.presets.exportSuccess.replace('{path}', path))
    } catch (causa) {
      console.error('Falha ao exportar presets:', causa)
      alert(t.presets.exportError.replace('{error}', (causa as Error).message))
    }
  }

  async function handleImportPresets() {
    try {
      const result = await importPresets()
      if (result) alert(t.presets.importSuccess.replace('{count}', String(result.importedCount)))
    } catch (error) {
      alert(t.presets.importError.replace('{error}', (error as Error).message))
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
              <section className="app-section" style={{ flex: 1, minHeight: 0 }}>
                <DiceRoller3D
                  ref={roller3DRef}
                  onRoll={addToHistory}
                  onRollingChange={setIsAnyRollInProgress}
                  /*
                    Atalhos SÓ com a aba de rolagem na tela. Ela fica montada e escondida nas outras
                    (ver o comentário do `display` acima), e sem isto o Espaço rolava os dados
                    enquanto a pessoa escrevia nas Anotações.
                  */
                  shortcutsEnabled={activeTab === 'roll' && !settingsOpen && !isEditorOpen}
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
