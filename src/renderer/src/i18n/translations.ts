import type { Language } from '@renderer/settings/SettingsContext'

import type { SheetWarningId } from '@shared/types/sheetWarning'

export interface TranslationDict {
  appTitle: string
  tabs: { roll: string; style: string; sheet: string; notes: string }
  roller: {
    quantityLabel: string
    typeLabel: string
    /** Legenda da caixa de grupo com quantidade/modo/modificador + botão de rolar. */
    rollGroupTitle: string
    rollButton: string
    /** Botão que abre o histórico direto da rolagem, sem passar pelas Preferências. */
    historyButton: string
    modifier: string
    /** Botões de menos e mais do modificador — substituíram as setinhas do campo numérico. */
    modifierMinus: string
    modifierPlus: string
    mode: { normal: string; advantage: string; disadvantage: string }
    /** Interruptor dos DADOS EXPLOSIVOS na barra de rolagem (ver `ExplodeRule`). */
    explode: string
    explodeHint: string
    /** Sufixo do resultado quando algum dado explodiu — "(explodiu)". */
    explodeSuffix: string
    /** Aviso do modo rápido FORÇADO — a máquina não desenha a bandeja 3D (ver `webglDisponivel`). */
    quickForced: string
    resultEmpty: string
    total: string
    advantageSuffix: string
    disadvantageSuffix: string
    rolling: string
    results: string
    rollError: string
    higherDie: string
    lowerDie: string
    /** Com regra de manter, o destaque diz QUEM CONTA — e não quem é maior. Ver `RollResultView`. */
    keptDie: string
    discardedDie: string
    /** O julgamento do alvo de uma fórmula (`>= 15` no fim) — sucesso ou fracasso da rolagem inteira. */
    success: string
    failure: string
    addDieHint: string
    maxDiceReachedHint: string
    removeDieGroup: string
    noDiceHint: string
    /** O botão que copia a linha da rolagem pro chat (spec §3.5; ver `linhaParaChat.ts`). */
    copy: string
    copied: string
    /** Sufixos CURTOS de vantagem/desvantagem na linha do chat — ela precisa caber no celular. */
    copyAdvantage: string
    copyDisadvantage: string
    /** O clarão de CRÍTICO e de FALHA sobre a cena, e as marcas ao lado do total (spec §3.7). */
    critical: string
    fumble: string
  }
  presets: {
    title: string
    newPreset: string
    empty: string
    edit: string
    delete: string
    deleteConfirm: string
    export: string
    import: string
    exportSuccess: string
    /** A GRAVAÇÃO do arquivo falhou (disco cheio, pasta sem permissão, pendrive removido). */
    exportError: string
    importSuccess: string
    importError: string
    saveError: string
    /** A estrela (spec §3.9): favoritar, desmarcar, o teto, e as setas de ordem. */
    favorite: string
    unfavorite: string
    favoriteLimit: string
    moveUp: string
    moveDown: string
  }
  presetEditor: {
    titleNew: string
    titleEdit: string
    name: string
    namePlaceholder: string
    icon: string
    dice: string
    addGroup: string
    modifier: string
    /** O campo de FÓRMULA — a gramática de rolagem (`shared/dice/formula.ts`) dentro do editor. */
    formula: string
    formulaPlaceholder: string
    formulaHint: string
    /** Aviso do modo FÓRMULA: a rolagem só existe no texto, e os controles de dados saem de cena. */
    formulaOnlyHint: string
    cancel: string
    save: string
    tooManyDice: string
    /** "Role N e use o maior" — a regra de Ordem Paranormal e de vários outros sistemas. */
    keep: string
    keepAll: string
    keepHighest: string
    keepLowest: string
    keepCount: string
    keepHint: string
    /** Caixa de marcar dos DADOS EXPLOSIVOS no editor de presets (ver `ExplodeRule`). */
    explode: string
    explodeHint: string
  }
  emojiPicker: { hint: string }
  statusBar: { shortcutsHint: string }
  /**
   * `restEvent` é a linha do descanso no diário da sessão (spec §3.8): "[ {name} ]". A spec sugere
   * travessões, e o usuário vetou travessão em qualquer texto do app: os colchetes fazem o mesmo
   * papel de separar o evento das rolagens.
   */
  history: { title: string; empty: string; clear: string; restEvent: string }
  /** Os botões do diálogo do app ("tem certeza?" / "não deu") — ver `Dialogo.tsx`. */
  dialog: { ok: string; cancel: string }
  /** O RECORTE da foto — zoom no rosto (ver `recorteDeFoto.ts`). */
  photoCrop: {
    title: string
    hint: string
    frame: string
    zoom: string
    reset: string
    use: string
    cancel: string
    /** O botão que abre o recorte de uma foto que já existe. */
    adjust: string
  }
  /** O HUD do personagem sobre a cena (spec §3.6; ver `HudDoPersonagem.tsx`). */
  hud: {
    title: string
    dragHint: string
    collapse: string
    expand: string
    hide: string
    show: string
    conditionOn: string
    conditionOff: string
    conditionRemove: string
    conditionAdd: string
    conditionPlaceholder: string
  }
  /** O DESCANSO (spec §3.8): o botão, a confirmação com o delta, e o editor dos tipos. */
  rest: {
    button: string
    title: string
    type: string
    noChange: string
    noResources: string
    confirm: string
    cancel: string
    editTypes: string
    editorTitle: string
    editorEmpty: string
    typeName: string
    typeNamePlaceholder: string
    add: string
    remove: string
    modeMax: string
    modePlus: string
    modeNone: string
    quantity: string
    save: string
    defaultName: string
    limit: string
  }
  /** Modo compacto — a janelinha de canto, que só tem presets e resultado (ver `CompactWidget.tsx`). */
  compact: { empty: string; resultEmpty: string }
  /** As BARRAS de PV/PE/Sanidade da tela de rolagem (spec §3.4; ver `BarrasDeRecurso.tsx`). */
  resources: {
    title: string
    edit: string
    editorTitle: string
    add: string
    name: string
    namePlaceholder: string
    current: string
    max: string
    color: string
    colorAuto: string
    remove: string
    save: string
    cancel: string
    /** Rótulos de acessibilidade dos botões de menos e mais — `{name}` é o recurso. */
    minus: string
    plus: string
    /** Rótulo do número clicável ("19 / 45") — diz que dá pra digitar ali. */
    valueLabel: string
    inputPlaceholder: string
    hint: string
    empty: string
    /** Aviso do editor: o teto de barras foi atingido. */
    limit: string
  }
  settings: {
    title: string
    language: string
    theme: string
    day: string
    night: string
    /** Terceira opção do tema: acompanhar o Windows. `{mode}` vira "dia" ou "noite". */
    themeSystem: string
    font: string
    sound: string
    soundOn: string
    soundOff: string
    compactMode: string
    compactModeHint: string
    /** Botão de compactar na barra de título — é a única saída do modo, então precisa de rótulo. */
    compactEnter: string
    compactExit: string
    resultPopup: string
    /** Como o resultado aparece: bandeja 3D ou número na hora (ver `DisplayMode`). */
    displayMode: string
    displayModeHint: string
    displayMode3d: string
    displayModeQuick: string
    resultPopupHint: string
    /** A linha copiada pro chat (spec §3.5): negrito Markdown, e copiar toda rolagem sozinho. */
    copyMarkdown: string
    copyMarkdownHint: string
    autoCopy: string
    autoCopyHint: string
    /** Os efeitos de crítico/falha (spec §3.7), clarão e som separados. */
    critVisual: string
    critVisualHint: string
    critSound: string
    critSoundHint: string
    history: string
    historyHint: string
    historyOpen: string
    appIcon: string
    debugMode: string
    debugModeHint: string
    /** Versão instalada e estado da atualização automática (ver `UpdateSection.tsx`/`updater.ts`). */
    version: string
    checkUpdates: string
    updateNow: string
    /** As DUAS perguntas antes de baixar (pedido do usuário) — a segunda avisa que o app reinicia sozinho. */
    updateConfirm: string
    updateConfirmAgain: string
    /** Cabeçalho do changelog dentro do aviso de versão nova. */
    updateNotesTitle: string
    restartNow: string
    /** Aviso na barra de status quando existe versão nova (ver `StatusBar.tsx`). */
    updateBadge: string
    /** Janela que o app abre sozinho ao encontrar versão nova (ver `UpdatePrompt.tsx`). */
    updatePromptTitle: string
    updateLater: string
    updateConfirmYes: string
    updateChecking: string
    updateUpToDate: string
    updateAvailable: string
    updateDownloading: string
    updateReady: string
    /** Mostrado enquanto o instalador roda e o app está prestes a sumir da tela. */
    updateInstalling: string
    updateError: string
    /** A build portátil não se atualiza sozinha (ver `updater.ts`). */
    updatePortable: string
    reset: string
    close: string
  }
  styleTab: {
    bodyColor: string
    numberColor: string
    perDieColor: string
    perDieColorReset: string
    /** Botão que faz a cor PADRÃO valer pra todos os tipos, descartando as cores individuais. */
    applyDefaultToAll: string
    applyDefaultToAllConfirm: string
    applyDefaultToAllHint: string
    defaultColorOption: string
    material: string
    materialOptions: { matte: string; metallic: string; plastic: string; glass: string }
    /** Legenda da prévia 3D e das duas seções em que a aba se divide. */
    preview: string
    sectionDice: string
    sectionScene: string
    /** Paletas prontas: um seletor de família (metal/gema/fosco/plástico) no lugar de quatro listas idênticas empilhadas. */
    palettes: string
    paletteFamilies: { metal: string; gem: string; matte: string; plastic: string }
    paletteEmpty: string
    /**
     * Roda de cores (`ColorWheel.tsx`) e os alvos que ela edita. Os rótulos são de uma palavra
     * porque cada um é um botão dentro da coluna estreita da prévia — "Cor do dado"/"Cor da parede"
     * ali viram duas linhas cada.
     */
    colorWheel: string
    brightness: string
    hex: string
    /** "Fundo" é o papel de parede da cena (o que aparece atrás da mesa) — ver `SceneColorTarget` em `StyleTab.tsx`. */
    colorTargets: {
      body: string
      number: string
      wall: string
      floor: string
      background: string
      /** As quatro peças da torre ao lado da bandeja (`createTowerBesideTray.ts`). */
      towerStone: string
      towerRoof: string
      towerFlag: string
      towerDoor: string
    }
    /** Legendas das duas fileiras de alvos de cor da cena — bandeja e torre, ver `StyleTab`. */
    targetsTray: string
    targetsTower: string
    trayPresets: string
    /** Rótulos do seletor de modo de lançamento, na aba Estilo (`StyleTab.tsx`). */
    /** Forma da bandeja e os nomes das quatro. */
    trayShape: string
    /** Linha da legenda da prévia quando a torre só está em cena pra a cor ser escolhida. */
    towerForColorOnly: string
    trayShapes: { triangle: string; square: string; hexagon: string; circle: string }
    launchMode: string
    /**
     * Cada modo tem TÍTULO e uma frase dizendo o que acontece com o dado nele.
     *
     * A frase não é enfeite: "Torre rolando" e "Torre de enfeite" põem a mesma torre na mesma mesa,
     * e o que muda — se o dado sai pela boca dela ou é jogado direto — não cabe num rótulo de botão.
     */
    launchModeOptions: Record<
      'tray' | 'tower' | 'towerDecor',
      { title: string; description: string }
    >
    /** Estados do olho que trava a câmera nos dados (`CameraModeSwitch.tsx`). */
    cameraLockOn: string
    cameraLockOff: string
    backgroundImage: string
    backgroundImagePick: string
    backgroundImageClear: string
    backgroundImageError: string
  }
  notesTab: {
    /**
     * Cabeçalho da ficha. Já teve classe, nível, raça, antecedente, alinhamento, atributos e
     * combate — tudo removido a pedido do usuário, sobrou o nome (ver `NotesTab.tsx`).
     */
    sheetBlock: string
    name: string
    /** Os três blocos fixos do personagem + o diário (`notesBlock`), que é o único com dias. */
    /** Seções de uma ficha importada (ver `SheetSection`). */
    sectionRemove: string
    sectionRemoveConfirm: string
    attributesBlock: string
    abilitiesBlock: string
    inventoryBlock: string
    appearanceBlock: string
    backstoryBlock: string
    /**
     * O convite dentro de cada bloco VAZIO: o que se escreve ali. Sem ele, uma ficha importada
     * mostrava caixas brancas enormes sem uma palavra dizendo pra que servem (visto na conferência
     * visual: a Aparência de um personagem importado era só branco).
     */
    blockHints: {
      attributes: string
      abilities: string
      inventory: string
      appearance: string
      backstory: string
    }
    notesBlock: string
    /**
     * Navegação do diário: uma sessão por dia. `dayCounter`, `dayPrev`, `dayNext` e `dayJump` saíram
     * junto com as setas ◀ ▶, o contador e o seletor de salto — a lista de sessões faz o que os
     * quatro faziam (ver `NotesTab.tsx`).
     */
    dayNumber: string
    dayNew: string
    dayDelete: string
    dayDeleteConfirm: string
    /**
     * Texto de exemplo do campo de título da sessão. É um convite ("Bote um título"), não o número da
     * página: o número já está no contador ao lado, e um campo que mostra "Sessão 3" sozinho parece
     * rótulo preenchido, não campo vazio esperando um nome.
     */
    dayTitlePlaceholder: string
    /**
     * A LISTA DE SESSÕES na lateral do diário (ver `NotesTab.tsx`). Substituiu as setas ◀ ▶, o
     * contador e o seletor de salto: com vinte sessões, três controles diferentes pra chegar numa
     * delas é mais navegação do que diário.
     */
    sessionsTitle: string
    /** Data embaixo do nome, na lista. `{date}` sai formatado no idioma da interface. */
    sessionCreated: string
    /**
     * Sessão SEM data de criação — as escritas antes de o campo existir. A tela diz isso em vez de
     * mostrar uma data inventada; ver `NotesPage.createdAt`.
     */
    sessionCreatedUnknown: string
    /** Bloco do PERFIL do personagem (foto, nome, sistema) — ver `shared/types/profile.ts`. */
    profileSystem: string
    profilePhoto: string
    profilePhotoEmpty: string
    /** A escolha da foto falhou (grande demais, formato fora da lista, arquivo ilegível). */
    profilePhotoError: string
    profileNew: string
    /** Explica por que "Novo personagem" está travado — ver `MAX_PROFILES`. */
    profileLimit: string
    /** Botão e estado de espera da importação de ficha em PDF (`SheetImportModal`). */
    sheetImport: string
    sheetImportReading: string
    /** A regra de CRÍTICO do personagem (spec §3.7): qual dado e em que direção. `{die}` é "d20". */
    critRule: string
    critRuleHigh: string
    critRuleLow: string
    critRuleNone: string
    /** A FICHA VAZIA do personagem novo: o convite de importar o PDF, e o "preencher à mão". */
    sheetEmptyTitle: string
    sheetEmptyHint: string
    sheetEmptyManual: string
    /** Botão de dado ao lado de um número da ficha que é rolagem (ver `sheetRoll.ts`). */
    sheetRollField: string
    profileDelete: string
    profileDeleteConfirm: string
    profileUnnamed: string
    /** O pacote de personagem (spec §3.2; ver `pacoteDePersonagem.ts`): exportar e importar o personagem inteiro. */
    profileExport: string
    profileExportHint: string
    profileImport: string
    profileImportHint: string
    profileExportSuccess: string
    profileExportError: string
    profileImportSuccess: string
    /** A FICHA ORIGINAL: as páginas do PDF guardadas com o personagem (ver `paginasDaFicha.ts`). */
    originalSheet: string
    originalSheetShow: string
    originalSheetHide: string
    /** O arquivo ATUALIZOU um personagem que já existia com o mesmo nome. */
    profileImportReplaced: string
    profileImportError: string
    profileSwitch: string
    fontDefault: string
    boldLabel: string
    italicLabel: string
    underlineLabel: string
    colorLabel: string
    colorReset: string
    saveError: string
    /** A LEITURA da ficha falhou — ver `loadError` em `useNotes`. Trava a edição, e diz por quê. */
    loadError: string
  }
  /**
   * A IMPORTAÇÃO DE FICHA — a janela de conferência, os erros do caminho e os avisos dos leitores.
   *
   * Estava tudo escrito em português dentro dos componentes e dos leitores, o que deixava metade do
   * app sem tradução: quem usa a interface em inglês abria a janela de conferência e encontrava um
   * parágrafo em português explicando o que não deu pra ler — justamente a mensagem que mais precisa
   * ser entendida.
   *
   * `warnings` é `Record<SheetWarningId, string>` de propósito: um aviso novo sem tradução não
   * compila. Ver `shared/types/sheetWarning.ts`.
   */
  sheetImport: {
    title: string
    /**
     * O aviso de que a importação de ficha está EM TESTE — ela volta no 1.1.0 marcada como beta.
     * Fica na tela de conferência porque é ali que a pessoa decide confiar no que foi lido.
     */
    betaNotice: string
    recognized: string
    unrecognized: string
    character: string
    system: string
    systemPlaceholder: string
    fieldsTitle: string
    fieldsEmpty: string
    presetsTitle: string
    presetsEmpty: string
    /** As BARRAS que a ficha propõe (ver `extrairRecursos.ts`), com o aviso de "atual em branco". */
    resourcesTitle: string
    resourcesEmpty: string
    resourceBlankCurrent: string
    /** O RETRATO tirado do PDF (spec §3.6): manter, trocar por um arquivo, ou tirar. */
    portraitEmpty: string
    portraitChoose: string
    portraitReplace: string
    portraitRemove: string
    portraitFromPdf: string
    /** A página do PDF ao lado dos campos (spec da importação §9). */
    pageTitle: string
    pageOf: string
    pagePrev: string
    pageNext: string
    /** "(3 de 12)" — quantos itens seguem marcados. */
    count: string
    rawTextTitle: string
    rawTextHint: string
    cancel: string
    confirm: string
    confirming: string
    /** O corte por seção (`MAXIMO_DE_CAMPOS_POR_SECAO`), dito na conferência. */
    sectionTrimmed: string
    /** Onde a ficha lida vai parar: um personagem novo ou o que já está aberto. */
    destinationLabel: string
    destinationNew: string
    destinationUpdate: string
    destinationUpdateHint: string
    update: string
    kinds: { test: string; damage: string; other: string }
    errors: { picker: string; tooLarge: string; unreadable: string; parse: string; save: string }
    warnings: Record<SheetWarningId, string>
  }
  errorBoundary: { title: string; message: string; reload: string }
  credit: string
}

export const translations: Record<Language, TranslationDict> = {
  'pt-BR': {
    appTitle: 'Reroll',
    tabs: { roll: 'Rolagem', style: '🎨 Estilo', sheet: '📜 Ficha (beta)', notes: '📝 Anotações' },
    roller: {
      quantityLabel: 'Quantidade de dados',
      typeLabel: 'Tipo de dado',
      rollGroupTitle: 'Rolagem',
      rollButton: 'ROLAR',
      historyButton: 'Histórico',
      modifier: 'Mod:',
      modifierMinus: 'Diminuir o modificador',
      modifierPlus: 'Aumentar o modificador',
      mode: { normal: 'Normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' },
      explode: 'Explode',
      explodeHint:
        'Dado que tira o valor máximo cai de novo, e os dois somam. Não combina com vantagem/desvantagem.',
      explodeSuffix: '(explodiu)',
      quickForced:
        'Este computador não conseguiu desenhar a bandeja 3D, então o Reroll está no modo rápido. Os dados são os mesmos: só não aparecem caindo.',
      resultEmpty: 'Role os dados pra ver o resultado aqui.',
      total: 'Total',
      advantageSuffix: '(vantagem)',
      disadvantageSuffix: '(desvantagem)',
      rolling: 'Rolando...',
      results: 'Resultados',
      rollError: 'Não foi possível iniciar a rolagem 3D. Tente novamente.',
      higherDie: 'Maior',
      lowerDie: 'Menor',
      keptDie: 'Conta pro total',
      discardedDie: 'Não conta pro total',
      success: 'Sucesso',
      failure: 'Fracasso',
      addDieHint: 'Adiciona um dado deste tipo à rolagem',
      maxDiceReachedHint: 'Limite de {max} dados por rolagem atingido',
      removeDieGroup: 'Tira este tipo de dado da rolagem',
      noDiceHint: 'Escolha um tipo de dado pra rolar',
      copy: 'Copiar pro chat',
      copied: 'Copiado!',
      copyAdvantage: 'vant.',
      copyDisadvantage: 'desv.',
      critical: 'Crítico!',
      fumble: 'Falha crítica!'
    },
    presets: {
      title: 'Presets',
      newPreset: '+ Novo preset',
      empty: 'Nenhum preset ainda. Crie um pra ataques, magias ou qualquer ação que você repete bastante.',
      edit: 'Editar',
      delete: 'Excluir',
      deleteConfirm: 'Excluir o preset "{name}"?',
      export: 'Exportar',
      import: 'Importar',
      exportSuccess: 'Presets exportados para {path}',
      exportError: 'Não foi possível exportar: {error}',
      importSuccess: '{count} preset(s) importado(s) com sucesso.',
      importError: 'Não foi possível importar: {error}',
      saveError: 'Não foi possível salvar o preset: {error}',
      favorite: 'Favoritar: aparece no modo compacto',
      unfavorite: 'Tirar dos favoritos',
      favoriteLimit: 'Máximo de 6 favoritos: tire a estrela de um antes',
      moveUp: 'Subir na fileira de favoritos',
      moveDown: 'Descer na fileira de favoritos'
    },
    presetEditor: {
      titleNew: 'Novo preset',
      titleEdit: 'Editar preset',
      name: 'Nome',
      namePlaceholder: 'Ex: Ataque Espada',
      icon: 'Ícone (emoji, opcional)',
      dice: 'Dados',
      addGroup: '+ Adicionar grupo de dados',
      modifier: 'Modificador (+/-)',
      formula: 'Fórmula',
      formulaPlaceholder: '1d20 + 5 · 4d6kh3 · 2d20kl1 · 1d6!',
      formulaHint:
        'Escreva a rolagem e os botões abaixo acompanham. kh3 usa os 3 maiores, kl1 o menor, ! explode no máximo, r<2 rerola uma vez, #>=5 conta sucessos, e um alvo no fim (>= 15) julga a rolagem.',
      formulaOnlyHint:
        'Este preset rola pelo texto da fórmula: os controles de dados ficam de fora, porque não têm como descrever esta rolagem.',
      cancel: 'Cancelar',
      save: 'Salvar',
      tooManyDice: 'Máximo de {max} dados no total (soma de todos os grupos).',
      keep: 'No total, usar',
      keepAll: 'todos os dados (somar)',
      keepHighest: 'os maiores',
      keepLowest: 'os menores',
      keepCount: 'Quantos dados contam',
      keepHint: 'Os outros dados continuam sendo rolados e aparecem na bandeja: só não entram na conta.',
      explode: 'Dados explosivos',
      explodeHint:
        'Dado que tira o valor máximo volta pra bandeja e cai de novo; as quedas somam. Vale pra cada dado da rolagem, separadamente.'
    },
    emojiPicker: {
      hint: 'Dica: com o campo de ícone selecionado, pressione Win + . pra abrir o seletor de emojis completo do Windows.'
    },
    statusBar: {
      shortcutsHint: 'Enter/Espaço : ROLL! · WASD move a câmera · Esc fecha · Ctrl+N novo preset'
    },
    dialog: { ok: 'OK', cancel: 'Cancelar' },
    history: {
      title: 'Histórico',
      empty: 'Nenhuma rolagem ainda nesta sessão.',
      clear: 'Limpar',
      restEvent: '[ {name} ]'
    },
    photoCrop: {
      title: 'Recortar a foto',
      hint: 'Arraste a foto pra centrar o rosto no quadro e dê zoom com a roda do mouse ou o controle. O quadrado é o que fica.',
      frame: 'Quadro do recorte: arraste pra posicionar',
      zoom: 'Zoom',
      reset: 'Centrar',
      use: 'Usar esta',
      cancel: 'Cancelar',
      adjust: 'Recortar…'
    },
    hud: {
      title: 'Personagem',
      dragHint: 'Arraste pra outro canto da cena',
      collapse: 'Encolher (só retrato e barras)',
      expand: 'Expandir',
      hide: 'Esconder o HUD',
      show: 'Mostrar o HUD do personagem',
      conditionOn: '{name}: ligada; clique pra desligar',
      conditionOff: '{name}: desligada; clique pra ligar',
      conditionRemove: 'Remover a condição {name}',
      conditionAdd: 'Adicionar condição',
      conditionPlaceholder: 'Machucado, Caído...'
    },
    rest: {
      button: 'Descansar',
      title: 'Descansar',
      type: 'Tipo',
      noChange: 'Este descanso não muda nenhuma barra. Confira as regras em "Editar tipos".',
      noResources: 'Nenhuma barra de recurso ainda: crie as barras primeiro.',
      confirm: 'Descansar',
      cancel: 'Cancelar',
      editTypes: 'Editar tipos…',
      editorTitle: 'Tipos de descanso',
      editorEmpty: 'Nenhum tipo ainda. Sem nenhum, o botão oferece um descanso que devolve tudo ao máximo.',
      typeName: 'Nome do descanso',
      typeNamePlaceholder: 'Descanso longo, Intervalo...',
      add: 'Adicionar tipo',
      remove: 'Remover {name}',
      modeMax: 'Volta ao máximo',
      modePlus: 'Soma…',
      modeNone: 'Não muda',
      quantity: 'Quanto soma',
      save: 'Salvar',
      defaultName: 'Descanso',
      limit: 'Máximo de {max} tipos de descanso.'
    },
    compact: {
      empty: 'Nenhum preset ainda. Saia do modo compacto pra criar: a janela pequena não tem espaço pro editor.',
      resultEmpty: 'Toque num preset pra rolar.'
    },
    resources: {
      title: 'Recursos',
      edit: 'Lápis: criar e editar as barras de PV, PE, Sanidade',
      editorTitle: 'Barras de recurso',
      add: 'Adicionar barra',
      name: 'Nome',
      namePlaceholder: 'PV, PE, Sanidade...',
      current: 'Atual',
      max: 'Máximo',
      color: 'Cor',
      colorAuto: 'Cor automática (muda com o estado)',
      remove: 'Remover barra {name}',
      save: 'Salvar',
      cancel: 'Cancelar',
      minus: 'Tirar de {name}',
      plus: 'Somar em {name}',
      valueLabel: '{name}: {current} de {max}. Clique pra digitar',
      inputPlaceholder: '-7, 12 ou 12/40',
      hint: 'Clique: ±1 · Shift+clique ou segurar: ±5 · clique no número pra digitar (-7, 12, 12/40)',
      empty: 'O lápis ali em cima cria as barras de PV, PE, Sanidade e o que mais o seu sistema usar.',
      limit: 'Máximo de {max} barras por personagem.'
    },
    settings: {
      title: 'Preferências',
      language: 'Idioma',
      theme: 'Tema',
      day: 'Dia',
      night: 'Noite',
      themeSystem: 'Sistema ({mode})',
      font: 'Fonte',
      sound: 'Som',
      soundOn: 'Ativado',
      soundOff: 'Desativado',
      compactMode: 'Modo compacto',
      compactModeHint: 'Janela pequena com seus presets, sempre por cima das outras.',
      compactEnter: 'Modo compacto',
      compactExit: 'Sair do modo compacto',
      displayMode: 'Como o resultado aparece',
      displayModeHint: 'A bandeja 3D, ou só o número: mais rápido em computador mais fraco.',
      displayMode3d: 'Bandeja 3D',
      displayModeQuick: 'Resultado rápido',
      resultPopup: 'Popup de resultado',
      resultPopupHint: 'Mostra o total somado num popup por cima da bandeja ao assentar os dados.',
      copyMarkdown: 'Copiar com negrito (Markdown)',
      copyMarkdownHint:
        'A linha copiada pro chat vai com o total entre asteriscos (**17**), que o Discord e o WhatsApp mostram em negrito. Desligue pra chat que mostra os asteriscos.',
      autoCopy: 'Copiar toda rolagem',
      autoCopyHint: 'Cada rolagem já vai pra área de transferência sozinha, pronta pra colar no chat da mesa.',
      critVisual: 'Clarão de crítico e falha',
      critVisualHint: 'Um segundo de festa (ou de luto) sobre a cena no 20 natural e no 1 natural. Qual dado conta é escolha por personagem, na Ficha.',
      critSound: 'Som de crítico e falha',
      critSoundHint: 'Uma fanfarra curta no crítico e um "womp" na falha. Segue o interruptor geral de som.',
      history: 'Histórico de rolagens',
      historyHint: 'Hora, nome do golpe e os dados de cada rolagem desta sessão.',
      historyOpen: 'Abrir',
      appIcon: 'Ícone do app',
      version: 'Versão',
      checkUpdates: 'Procurar atualizações',
      updateNow: 'Atualizar',
      updateConfirm:
        'Existe uma atualização nova (versão {version}).\n\nDeseja atualizar para a última versão?',
      updateConfirmAgain:
        'Tem certeza?\n\nO Reroll vai baixar cerca de 100 MB e reiniciar sozinho para aplicar. Seus presets, anotações e preferências continuam onde estão.',
      updateNotesTitle: 'O que mudou nesta versão:',
      restartNow: 'Reiniciar agora',
      updateBadge: '▲ Versão {version} disponível. Clique para atualizar',
      updatePromptTitle: 'Atualização disponível',
      updateLater: 'Agora não',
      updateConfirmYes: 'Sim, atualizar',
      updateChecking: 'Procurando atualizações...',
      updateUpToDate: 'Você está na versão mais recente.',
      updateAvailable: 'Existe uma atualização nova: versão {version}.',
      updateDownloading: 'Baixando a versão {version}... {percent}%',
      updateReady: 'Versão {version} baixada: reiniciando para aplicar...',
      updateInstalling:
        'Instalando a versão {version}. O Reroll vai fechar e abrir sozinho em alguns segundos: nesse intervalo a tela fica sem ele. Não desligue o computador.',
      updateError: 'Não deu pra procurar atualizações agora.',
      updatePortable: 'Versão portátil: ela não se atualiza sozinha. A versão nova se baixa na página de releases do Reroll no GitHub.',
      debugMode: 'Modo debug',
      debugModeHint: 'Mostra colisores, normais de face, confiança da leitura e FPS por cima da cena 3D.',
      reset: 'Restaurar padrões',
      close: 'Fechar'
    },
    styleTab: {
      bodyColor: 'Cor do dado',
      numberColor: 'Cor do número',
      perDieColor: 'Cor dos dados',
      perDieColorReset: 'Usar a cor padrão neste dado',
      applyDefaultToAll: 'Aplicar a todos os dados',
      applyDefaultToAllConfirm:
        'Aplicar a cor padrão a TODOS os dados?\n\nOs {n} tipo(s) com cor própria voltam pra padrão, e essas cores se perdem.',
      applyDefaultToAllHint:
        '{n} tipo(s) com cor própria: eles ignoram a cor padrão até você aplicar aqui.',
      defaultColorOption: 'Padrão',
      material: 'Acabamento',
      materialOptions: {
        matte: 'Fosco',
        metallic: 'Metálico',
        plastic: 'Plástico',
        glass: 'Vidro'
      },
      preview: 'Prévia',
      sectionDice: 'Dados',
      sectionScene: 'Mesa e bandeja',
      palettes: 'Paletas prontas',
      paletteFamilies: {
        metal: 'Metálicas',
        gem: 'Gemas',
        matte: 'Foscas',
        plastic: 'Plásticas'
      },
      paletteEmpty: 'Passe o mouse pra ver o nome',
      colorWheel: 'Roda de cores',
      brightness: 'Brilho',
      hex: 'Hex',
      colorTargets: {
        body: 'Corpo',
        number: 'Número',
        wall: 'Parede',
        floor: 'Veludo',
        background: 'Fundo',
        towerStone: 'Pedra',
        towerRoof: 'Bico',
        towerFlag: 'Bandeira',
        towerDoor: 'Porta'
      },
      targetsTray: 'Bandeja',
      targetsTower: 'Torre',
      trayPresets: 'Estilos de bandeja prontos',
      trayShape: 'Formato da bandeja',
      towerForColorOnly: 'torre em cena só pra você escolher a cor',
      trayShapes: { triangle: 'Triângulo', square: 'Quadrado', hexagon: 'Hexágono', circle: 'Círculo' },
      launchMode: 'Onde os dados são rolados',
      launchModeOptions: {
        tray: {
          title: 'Direto na bandeja',
          description: 'Você joga os dados por cima. A torre não fica na mesa.'
        },
        tower: {
          title: 'Pela torre',
          description:
            'Os dados saem pela boca da torre, um de cada vez, e caem na bandeja. Rolagem com muitos dados demora mais.'
        },
        towerDecor: {
          title: 'Torre só de enfeite',
          description: 'A torre fica na mesa, mas os dados são jogados direto na bandeja.'
        }
      },
      cameraLockOn: 'Câmera travada nos dados: clique pra soltar (WASD move, Q/E sobe e desce)',
      cameraLockOff: 'Câmera solta: clique pra travar nos dados (WASD move, Q/E sobe e desce)',
      backgroundImage: 'Imagem de fundo',
      backgroundImagePick: 'Escolher imagem...',
      backgroundImageClear: 'Remover imagem',
      backgroundImageError: 'Não foi possível carregar a imagem escolhida.'
    },
    notesTab: {
      sheetBlock: 'Personagem',
      name: 'Nome',
      sectionRemove: 'Remover esta seção',
      sectionRemoveConfirm: 'Remover a seção “{title}” da ficha? Os valores dela se perdem.',
      attributesBlock: 'Atributos',
      abilitiesBlock: 'Habilidades',
      inventoryBlock: 'Inventário',
      appearanceBlock: 'Aparência',
      backstoryBlock: 'Backstory',
      blockHints: {
        attributes: 'Os números do personagem: Força, Agilidade, o que o sistema usar.',
        abilities: 'Golpes, magias, rituais, talentos.',
        inventory: 'O que o personagem carrega.',
        appearance: 'Como o personagem se parece.',
        backstory: 'De onde o personagem veio e o que ele busca.'
      },
      notesBlock: 'Bloco',
      dayNumber: 'Sessão {n}',
      dayNew: 'Nova sessão',
      dayDelete: 'Apagar esta sessão',
      dayDeleteConfirm: 'Apagar "{day}"? O que estiver escrito nessa sessão se perde.',
      dayTitlePlaceholder: 'Bote um título',
      sessionsTitle: 'Sessões',
      sessionCreated: 'Criada em {date}',
      sessionCreatedUnknown: 'sem data',
      profileSystem: 'Sistema',
      profilePhoto: 'Escolher foto',
      profilePhotoEmpty: 'sem foto',
      profilePhotoError: 'Não deu pra usar essa imagem. Tente outra, menor que 12 MB.',
      profileNew: 'Novo personagem',
      profileLimit:
        'Você chegou no limite de {max} personagens. Apague um que não usa mais para criar outro: a ficha dele vai pra pasta de backup.',
      sheetImport: 'Importar ficha (PDF)',
      sheetImportReading: 'Lendo PDF...',
      critRule: 'Crítico',
      critRuleHigh: '{die}: máximo é crítico, 1 é falha',
      critRuleLow: '{die}: 1 é crítico, máximo é falha',
      critRuleNone: 'Sem crítico neste sistema',
      sheetEmptyTitle: 'Esta ficha está vazia.',
      sheetEmptyHint:
        'Importe a ficha em PDF do seu personagem: o app lê os campos, monta a ficha e cria os presets de rolagem pra você conferir. É o que está em teste neste beta: vale a pena tentar com a sua.',
      sheetEmptyManual: 'Prefiro preencher à mão',
      sheetRollField: 'Rolar {field}',
      profileDelete: 'Apagar personagem',
      profileDeleteConfirm:
        'Apagar "{name}"? Ele some da lista; a ficha, as anotações e os presets dele vão pra pasta de backup do Reroll.',
      profileUnnamed: 'Personagem {n}',
      profileExport: 'Exportar personagem',
      profileExportHint:
        'Salva a ficha, as anotações, os presets e a aparência dos dados num arquivo só: pra mostrar ao mestre (abre no navegador) ou levar pra outro computador.',
      profileImport: 'Importar personagem Reroll',
      profileImportHint:
        'Abre um arquivo exportado pelo Reroll e traz o personagem com tudo o que ele tinha. Se já existe um com o mesmo nome, ele é atualizado: não cria outro.',
      profileExportSuccess:
        'Personagem exportado em:\n{path}\n\nO arquivo abre no navegador pra mostrar a ficha, e o Reroll traz ele de volta em "Importar personagem Reroll".',
      profileExportError: 'Não deu pra exportar: {error}',
      profileImportSuccess: '"{name}" chegou inteiro: ficha, anotações, presets e aparência dos dados.',
      originalSheet: 'Ficha original (PDF)',
      originalSheetShow: 'Mostrar as {n} páginas',
      originalSheetHide: 'Esconder',
      profileImportReplaced: '"{name}" já existia e foi atualizado com o arquivo: ficha, anotações, presets e aparência dos dados.',
      profileImportError: 'Não deu pra importar: {error}',
      profileSwitch: 'Trocar de personagem',
      fontDefault: 'Fonte padrão',
      boldLabel: 'Negrito',
      italicLabel: 'Itálico',
      underlineLabel: 'Sublinhado',
      colorLabel: 'Cor do texto',
    colorReset: 'Padrão (segue o tema)',
      saveError: 'Não foi possível salvar as anotações. Suas últimas alterações podem ter sido perdidas.',
      loadError: 'Não consegui ler a ficha deste personagem. Ela está bloqueada pra edição até a leitura funcionar: assim nada é gravado por cima do que está no arquivo.'
    },
    sheetImport: {
      title: 'Conferir ficha importada',
      recognized: 'Reconhecemos como ficha de',
      betaNotice:
        'A importação de ficha está em teste. Ela lê bem as fichas dos sistemas que conhece e pode errar nas outras: confira os campos abaixo antes de confirmar.',
      unrecognized: 'Sistema não reconhecido',
      character: 'Personagem',
      system: 'Sistema',
      systemPlaceholder: 'Ordem Paranormal, D&D 5e, Oblivio...',
      fieldsTitle: 'Anotações',
      fieldsEmpty: 'Nenhum campo preenchido foi encontrado.',
      presetsTitle: 'Presets',
      presetsEmpty: 'Nenhuma rolagem foi encontrada nesta ficha.',
      resourcesTitle: 'Barras de recurso',
      resourcesEmpty: 'Nenhum par atual/máximo preenchido: dá pra criar as barras depois, na tela de rolagem.',
      resourceBlankCurrent: 'atual em branco na ficha: a barra começa cheia',
      portraitEmpty: 'sem retrato',
      portraitChoose: 'Escolher foto…',
      portraitReplace: 'Trocar…',
      portraitRemove: 'Tirar',
      portraitFromPdf: 'retrato tirado do PDF',
      pageTitle: 'Página do PDF',
      pageOf: 'Página {n} de {total}',
      pagePrev: 'Página anterior',
      pageNext: 'Próxima página',
      count: '({selected} de {total})',
      rawTextTitle: 'Texto da ficha',
      rawTextHint: '(vai para o bloco Backstory)',
      cancel: 'Cancelar',
      confirm: 'Criar personagem',
      confirming: 'Importando...',
      sectionTrimmed: 'Só os primeiros {max} campos de cada seção entram na ficha: {n} ficaram de fora.',
      destinationLabel: 'Importar para',
      destinationNew: 'Um personagem novo',
      destinationUpdate: 'Atualizar "{name}"',
      destinationUpdateHint:
        'As seções da ficha são substituídas pelas do PDF. O diário, as anotações e os presets que você já tinha ficam.',
      update: 'Atualizar personagem',
      kinds: { test: 'teste', damage: 'dano', other: 'rolagem' },
      errors: {
        picker: 'Não consegui abrir o seletor de arquivos.',
        tooLarge:
          'Este PDF tem {mb} MB e é grande demais para abrir com segurança. Ficha de personagem costuma ter menos de 10 MB.',
        unreadable:
          'Não consegui abrir esse arquivo. Confira se ele ainda está no lugar e se você tem permissão para lê-lo.',
        parse: 'Não consegui ler este PDF. Ele pode estar protegido por senha ou danificado.',
        save: 'Li a ficha, mas não consegui gravar o personagem.'
      },
      warnings: {
        'pdf-sem-texto':
          'Este PDF não tem texto que dê pra ler: ele parece ser uma imagem digitalizada ou uma arte exportada sem texto. Não dá pra importar nada dele automaticamente; uma ficha em PDF com campos preenchíveis, ou pelo menos com texto de verdade, funciona.',
        'sem-formulario':
          'Esta ficha não tem campos preenchíveis: é um PDF de texto. O que dá pra ler são as linhas no formato "Rótulo: valor" e os valores que estão na mesma linha de um rótulo, então a leitura é um palpite baseado na diagramação: confira item por item antes de importar.',
        'formulario-vazio':
          'A ficha tem campos preenchíveis, mas todos estão em branco: parece ser o modelo vazio.',
        'sem-nome-nem-rolagem':
          'Não achei nome de personagem nem nenhuma rolagem nesta ficha. Os valores que aparecem abaixo podem ser só o preenchimento de fábrica do modelo em branco: confira antes de importar.',
        'arte-com-anotacao':
          'Esta ficha é uma IMAGEM com o texto escrito por cima: os nomes dos campos fazem parte do desenho, então o app não tem como saber o que é cada valor. Trouxe tudo o que você escreveu, na ordem em que está na página, pra você organizar na ficha do personagem.',
        'ordem-maior-dado':
          'Nos testes desta ficha vale o MAIOR dado, e não a soma: é a regra de Ordem Paranormal, e os presets de teste já foram criados assim. Se algum ataque seu usa um atributo ZERO, que rola dois e fica com o PIOR, troque para "menor" no editor do preset.',
        'dnd5e-modelo-em-branco':
          'Não achei nome de personagem nem nenhum ataque nesta ficha: ela parece ser o modelo em branco. Confira o que veio abaixo antes de importar.',
        'paginas-demais':
          'Este PDF tem mais de 100 páginas: é um livro, não uma ficha de personagem. Nada foi lido dele.'
      }
    },
    errorBoundary: {
      title: 'Algo deu errado',
      message: 'A interface encontrou um erro inesperado. Você pode tentar recarregar a janela.',
      reload: 'Recarregar'
    },
    credit: 'made by renatinm1'
  },
  'en-US': {
    appTitle: 'Reroll',
    tabs: { roll: 'Roll', style: '🎨 Style', sheet: '📜 Sheet (beta)', notes: '📝 Notes' },
    roller: {
      quantityLabel: 'Number of dice',
      typeLabel: 'Dice type',
      rollGroupTitle: 'Roll',
      rollButton: 'ROLL',
      historyButton: 'History',
      modifier: 'Mod:',
      modifierMinus: 'Decrease the modifier',
      modifierPlus: 'Increase the modifier',
      mode: { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' },
      explode: 'Explode',
      explodeHint:
        'A die that rolls its highest face is rolled again, and both add up. Does not combine with advantage/disadvantage.',
      explodeSuffix: '(exploded)',
      quickForced:
        'This computer could not draw the 3D tray, so Reroll is in quick mode. The dice are the same: they just do not fall on screen.',
      resultEmpty: 'Roll the dice to see the result here.',
      total: 'Total',
      advantageSuffix: '(advantage)',
      disadvantageSuffix: '(disadvantage)',
      rolling: 'Rolling...',
      results: 'Results',
      rollError: 'Could not start the 3D roll. Please try again.',
      higherDie: 'Higher',
      lowerDie: 'Lower',
      keptDie: 'Counts toward the total',
      discardedDie: 'Does not count',
      success: 'Success',
      failure: 'Failure',
      addDieHint: 'Adds one die of this type to the roll',
      maxDiceReachedHint: 'Limit of {max} dice per roll reached',
      removeDieGroup: 'Removes this die type from the roll',
      noDiceHint: 'Pick a die type to roll',
      copy: 'Copy for chat',
      copied: 'Copied!',
      copyAdvantage: 'adv',
      copyDisadvantage: 'dis',
      critical: 'Critical!',
      fumble: 'Fumble!'
    },
    presets: {
      title: 'Presets',
      newPreset: '+ New preset',
      empty: 'No presets yet. Create one for attacks, spells, or anything you roll often.',
      edit: 'Edit',
      delete: 'Delete',
      deleteConfirm: 'Delete preset "{name}"?',
      export: 'Export',
      import: 'Import',
      exportSuccess: 'Presets exported to {path}',
      exportError: 'Could not export: {error}',
      importSuccess: '{count} preset(s) imported successfully.',
      importError: 'Could not import: {error}',
      saveError: 'Could not save preset: {error}',
      favorite: 'Favorite: shows in compact mode',
      unfavorite: 'Remove from favorites',
      favoriteLimit: 'At most 6 favorites: unstar one first',
      moveUp: 'Move up in the favorites row',
      moveDown: 'Move down in the favorites row'
    },
    presetEditor: {
      titleNew: 'New preset',
      titleEdit: 'Edit preset',
      name: 'Name',
      namePlaceholder: 'E.g.: Sword Attack',
      icon: 'Icon (emoji, optional)',
      dice: 'Dice',
      addGroup: '+ Add dice group',
      modifier: 'Modifier (+/-)',
      formula: 'Formula',
      formulaPlaceholder: '1d20 + 5 · 4d6kh3 · 2d20kl1 · 1d6!',
      formulaHint:
        'Type the roll and the buttons below follow. kh3 keeps the 3 highest, kl1 the lowest, ! explodes on the max, r<2 rerolls once, #>=5 counts successes, and a target at the end (>= 15) judges the roll.',
      formulaOnlyHint:
        'This preset rolls from the formula text: the dice controls stay out, because they cannot describe this roll.',
      cancel: 'Cancel',
      save: 'Save',
      tooManyDice: 'Maximum of {max} dice total (sum of all groups).',
      keep: 'For the total, use',
      keepAll: 'every die (sum them)',
      keepHighest: 'the highest',
      keepLowest: 'the lowest',
      keepCount: 'How many dice count',
      keepHint: 'The other dice are still rolled and land on the tray: they just do not count.',
      explode: 'Exploding dice',
      explodeHint:
        'A die that rolls its highest face goes back to the tray and falls again; the rolls add up. Applies to each die separately.'
    },
    emojiPicker: {
      hint: 'Tip: with the icon field selected, press Win + . to open the full Windows emoji picker.'
    },
    statusBar: {
      shortcutsHint: 'Enter/Space : ROLL! · WASD moves the camera · Esc closes · Ctrl+N new preset'
    },
    dialog: { ok: 'OK', cancel: 'Cancel' },
    history: {
      title: 'History',
      empty: 'No rolls yet this session.',
      clear: 'Clear',
      restEvent: '[ {name} ]'
    },
    photoCrop: {
      title: 'Crop the photo',
      hint: 'Drag the photo to center the face in the frame and zoom with the mouse wheel or the slider. The square is what stays.',
      frame: 'Crop frame: drag to position',
      zoom: 'Zoom',
      reset: 'Center',
      use: 'Use this',
      cancel: 'Cancel',
      adjust: 'Crop…'
    },
    hud: {
      title: 'Character',
      dragHint: 'Drag to another corner of the scene',
      collapse: 'Collapse (portrait and bars only)',
      expand: 'Expand',
      hide: 'Hide the HUD',
      show: 'Show the character HUD',
      conditionOn: '{name}: on; click to turn off',
      conditionOff: '{name}: off; click to turn on',
      conditionRemove: 'Remove the {name} condition',
      conditionAdd: 'Add condition',
      conditionPlaceholder: 'Wounded, Prone...'
    },
    rest: {
      button: 'Rest',
      title: 'Rest',
      type: 'Type',
      noChange: 'This rest changes no bar. Check the rules under "Edit types".',
      noResources: 'No resource bars yet: create the bars first.',
      confirm: 'Rest',
      cancel: 'Cancel',
      editTypes: 'Edit types…',
      editorTitle: 'Rest types',
      editorEmpty: 'No types yet. With none, the button offers a rest that restores everything to max.',
      typeName: 'Rest name',
      typeNamePlaceholder: 'Long rest, Short rest...',
      add: 'Add type',
      remove: 'Remove {name}',
      modeMax: 'Restore to max',
      modePlus: 'Add…',
      modeNone: 'No change',
      quantity: 'How much',
      save: 'Save',
      defaultName: 'Rest',
      limit: 'At most {max} rest types.'
    },
    compact: {
      empty: 'No presets yet. Leave compact mode to create one: the small window has no room for the editor.',
      resultEmpty: 'Tap a preset to roll.'
    },
    resources: {
      title: 'Resources',
      edit: 'Pencil: create and edit the HP, MP, Sanity bars',
      editorTitle: 'Resource bars',
      add: 'Add bar',
      name: 'Name',
      namePlaceholder: 'HP, Sanity, Spell slots...',
      current: 'Current',
      max: 'Max',
      color: 'Color',
      colorAuto: 'Automatic color (changes with state)',
      remove: 'Remove bar {name}',
      save: 'Save',
      cancel: 'Cancel',
      minus: 'Subtract from {name}',
      plus: 'Add to {name}',
      valueLabel: '{name}: {current} of {max}. Click to type',
      inputPlaceholder: '-7, 12 or 12/40',
      hint: 'Click: ±1 · Shift+click or hold: ±5 · click the number to type (-7, 12, 12/40)',
      empty: 'The pencil up there creates the bars for HP, MP, Sanity and whatever else your system uses.',
      limit: 'At most {max} bars per character.'
    },
    settings: {
      title: 'Preferences',
      language: 'Language',
      theme: 'Theme',
      day: 'Day',
      night: 'Night',
      themeSystem: 'System ({mode})',
      font: 'Font',
      sound: 'Sound',
      soundOn: 'On',
      soundOff: 'Off',
      compactMode: 'Compact mode',
      compactModeHint: 'Small window with your presets, always on top.',
      compactEnter: 'Compact mode',
      compactExit: 'Leave compact mode',
      displayMode: 'How the result shows up',
      displayModeHint: 'The 3D tray, or just the number: faster on a weaker computer.',
      displayMode3d: '3D tray',
      displayModeQuick: 'Quick result',
      resultPopup: 'Result popup',
      resultPopupHint: 'Shows the summed total in a popup over the tray once the dice settle.',
      copyMarkdown: 'Copy with bold (Markdown)',
      copyMarkdownHint:
        'The line copied for chat has the total between asterisks (**17**), which Discord and WhatsApp render bold. Turn off for chats that show the asterisks.',
      autoCopy: 'Copy every roll',
      autoCopyHint: 'Each roll goes to the clipboard by itself, ready to paste into the table chat.',
      critVisual: 'Critical and fumble flash',
      critVisualHint: 'One second of celebration (or mourning) over the scene on a natural 20 and a natural 1. Which die counts is a per-character choice, on the Sheet.',
      critSound: 'Critical and fumble sound',
      critSoundHint: 'A short fanfare on a critical and a "womp" on a fumble. Follows the general sound switch.',
      history: 'Roll history',
      historyHint: 'Time, move name and the dice of every roll in this session.',
      historyOpen: 'Open',
      appIcon: 'App icon',
      version: 'Version',
      checkUpdates: 'Check for updates',
      updateNow: 'Update',
      updateConfirm:
        'There is a new update (version {version}).\n\nDo you want to update to the latest version?',
      updateConfirmAgain:
        'Are you sure?\n\nReroll will download about 100 MB and restart itself to apply it. Your presets, notes and preferences stay where they are.',
      updateNotesTitle: 'What changed in this version:',
      restartNow: 'Restart now',
      updateBadge: '▲ Version {version} available. Click to update',
      updatePromptTitle: 'Update available',
      updateLater: 'Not now',
      updateConfirmYes: 'Yes, update',
      updateChecking: 'Checking for updates...',
      updateUpToDate: "You're on the latest version.",
      updateAvailable: 'There is a new update: version {version}.',
      updateDownloading: 'Downloading version {version}... {percent}%',
      updateReady: 'Version {version} downloaded: restarting to apply...',
      updateInstalling:
        'Installing version {version}. Reroll will close and reopen by itself in a few seconds: the screen sits without it in between. Do not turn the computer off.',
      updateError: "Couldn't check for updates right now.",
      updatePortable: 'Portable build: it does not update itself. Download the new version from the Reroll releases page on GitHub.',
      debugMode: 'Debug mode',
      debugModeHint: 'Shows colliders, face normals, reading confidence and FPS over the 3D scene.',
      reset: 'Reset to defaults',
      close: 'Close'
    },
    styleTab: {
      bodyColor: 'Dice color',
      numberColor: 'Number color',
      perDieColor: 'Dice colors',
      perDieColorReset: 'Use the default colour on this die',
      applyDefaultToAll: 'Apply to every die',
      applyDefaultToAllConfirm:
        'Apply the default colour to EVERY die?\n\nThe {n} type(s) with their own colour go back to the default, and those colours are lost.',
      applyDefaultToAllHint:
        '{n} type(s) have their own colour: they ignore the default until you apply it here.',
      defaultColorOption: 'Default',
      material: 'Finish',
      materialOptions: {
        matte: 'Matte',
        metallic: 'Metallic',
        plastic: 'Plastic',
        glass: 'Glass'
      },
      preview: 'Preview',
      sectionDice: 'Dice',
      sectionScene: 'Table & tray',
      palettes: 'Ready-made palettes',
      paletteFamilies: {
        metal: 'Metal',
        gem: 'Gem',
        matte: 'Matte',
        plastic: 'Plastic'
      },
      paletteEmpty: 'Hover a swatch to see its name',
      colorWheel: 'Color wheel',
      brightness: 'Brightness',
      hex: 'Hex',
      colorTargets: {
        body: 'Body',
        number: 'Number',
        wall: 'Wall',
        floor: 'Velvet',
        background: 'Background',
        towerStone: 'Stone',
        towerRoof: 'Spire',
        towerFlag: 'Flag',
        towerDoor: 'Door'
      },
      targetsTray: 'Tray',
      targetsTower: 'Tower',
      trayPresets: 'Ready-made tray styles',
      trayShape: 'Tray shape',
      towerForColorOnly: 'tower shown only so you can pick its colour',
      trayShapes: { triangle: 'Triangle', square: 'Square', hexagon: 'Hexagon', circle: 'Circle' },
      launchMode: 'Where the dice are rolled',
      launchModeOptions: {
        tray: {
          title: 'Straight onto the tray',
          description: 'You throw the dice in from above. The tower is not on the table.'
        },
        tower: {
          title: 'Through the tower',
          description:
            'Dice come out of the tower mouth, one at a time, and land on the tray. Rolls with many dice take longer.'
        },
        towerDecor: {
          title: 'Tower as decor only',
          description: 'The tower stays on the table, but the dice are thrown straight onto the tray.'
        }
      },
      cameraLockOn: 'Camera locked on the dice: click to release (WASD moves, Q/E up and down)',
      cameraLockOff: 'Camera free: click to lock on the dice (WASD moves, Q/E up and down)',
      backgroundImage: 'Background image',
      backgroundImagePick: 'Choose image...',
      backgroundImageClear: 'Remove image',
      backgroundImageError: 'Could not load the chosen image.'
    },
    notesTab: {
      sheetBlock: 'Character',
      name: 'Name',
      sectionRemove: 'Remove this section',
      sectionRemoveConfirm: 'Remove the “{title}” section from the sheet? Its values are lost.',
      attributesBlock: 'Attributes',
      abilitiesBlock: 'Abilities',
      inventoryBlock: 'Inventory',
      appearanceBlock: 'Appearance',
      backstoryBlock: 'Backstory',
      blockHints: {
        attributes: 'The character numbers: Strength, Agility, whatever the system uses.',
        abilities: 'Attacks, spells, rituals, talents.',
        inventory: 'What the character carries.',
        appearance: 'What the character looks like.',
        backstory: 'Where the character came from and what they seek.'
      },
      notesBlock: 'Notepad',
      dayNumber: 'Session {n}',
      dayNew: 'New session',
      dayDelete: 'Delete this session',
      dayDeleteConfirm: 'Delete "{day}"? Anything written in that session is lost.',
      dayTitlePlaceholder: 'Give it a title',
      sessionsTitle: 'Sessions',
      sessionCreated: 'Created on {date}',
      sessionCreatedUnknown: 'no date',
      profileSystem: 'System',
      profilePhoto: 'Choose photo',
      profilePhotoEmpty: 'no photo',
      profilePhotoError: 'That image could not be used. Try another one, under 12 MB.',
      profileNew: 'New character',
      profileLimit:
        'You have reached the limit of {max} characters. Delete one you no longer use to create another: its sheet goes to the backup folder.',
      sheetImport: 'Import sheet (PDF)',
      sheetImportReading: 'Reading PDF...',
      critRule: 'Critical',
      critRuleHigh: '{die}: max is a critical, 1 is a fumble',
      critRuleLow: '{die}: 1 is a critical, max is a fumble',
      critRuleNone: 'No criticals in this system',
      sheetEmptyTitle: 'This sheet is empty.',
      sheetEmptyHint:
        "Import your character's PDF sheet: the app reads the fields, builds the sheet and creates the roll presets for you to review. That's what this beta is testing: give it a try with yours.",
      sheetEmptyManual: "I'd rather fill it in by hand",
      sheetRollField: 'Roll {field}',
      profileDelete: 'Delete character',
      profileDeleteConfirm:
        'Delete "{name}"? They leave the list; their sheet, notes and presets go to the Reroll backup folder.',
      profileUnnamed: 'Character {n}',
      profileExport: 'Export character',
      profileExportHint:
        'Saves the sheet, notes, presets and dice look in a single file: to show your GM (it opens in a browser) or to move to another computer.',
      profileImport: 'Import Reroll character',
      profileImportHint:
        'Opens a file exported by Reroll and brings the character with everything it had. If one with the same name already exists, it is updated: no duplicate.',
      profileExportSuccess:
        'Character exported to:\n{path}\n\nThe file opens in a browser to show the sheet, and Reroll brings it back with "Import Reroll character".',
      profileExportError: 'Could not export: {error}',
      profileImportSuccess: '"{name}" is here in full: sheet, notes, presets and dice look.',
      originalSheet: 'Original sheet (PDF)',
      originalSheetShow: 'Show the {n} pages',
      originalSheetHide: 'Hide',
      profileImportReplaced: '"{name}" already existed and was updated from the file: sheet, notes, presets and dice look.',
      profileImportError: 'Could not import: {error}',
      profileSwitch: 'Switch character',
      fontDefault: 'Default font',
      boldLabel: 'Bold',
      italicLabel: 'Italic',
      underlineLabel: 'Underline',
      colorLabel: 'Text color',
      colorReset: 'Default (follows theme)',
      saveError: 'Could not save notes. Your latest changes may have been lost.',
      loadError: 'Could not read this character sheet. Editing is locked until the read succeeds, so nothing overwrites what is in the file.'
    },
    sheetImport: {
      title: 'Review imported sheet',
      recognized: 'Recognized as a sheet for',
      betaNotice:
        'Sheet import is in testing. It reads the systems it knows well and may get others wrong: check the fields below before confirming.',
      unrecognized: 'System not recognized',
      character: 'Character',
      system: 'System',
      systemPlaceholder: 'D&D 5e, Ordem Paranormal, Oblivio...',
      fieldsTitle: 'Notes',
      fieldsEmpty: 'No filled-in field was found.',
      presetsTitle: 'Presets',
      presetsEmpty: 'No roll was found in this sheet.',
      resourcesTitle: 'Resource bars',
      resourcesEmpty: 'No filled current/max pair: you can create the bars later, on the roll screen.',
      resourceBlankCurrent: 'current value blank on the sheet: the bar starts full',
      portraitEmpty: 'no portrait',
      portraitChoose: 'Choose photo…',
      portraitReplace: 'Replace…',
      portraitRemove: 'Remove',
      portraitFromPdf: 'portrait taken from the PDF',
      pageTitle: 'PDF page',
      pageOf: 'Page {n} of {total}',
      pagePrev: 'Previous page',
      pageNext: 'Next page',
      count: '({selected} of {total})',
      rawTextTitle: 'Sheet text',
      rawTextHint: '(goes to the Backstory block)',
      cancel: 'Cancel',
      confirm: 'Create character',
      confirming: 'Importing...',
      sectionTrimmed: 'Only the first {max} fields of each section go into the sheet: {n} were left out.',
      destinationLabel: 'Import into',
      destinationNew: 'A new character',
      destinationUpdate: 'Update "{name}"',
      destinationUpdateHint:
        'The sheet sections are replaced by the ones in the PDF. Your journal, notes and existing presets stay.',
      update: 'Update character',
      kinds: { test: 'check', damage: 'damage', other: 'roll' },
      errors: {
        picker: 'Could not open the file picker.',
        tooLarge:
          'This PDF is {mb} MB, too large to open safely. A character sheet is usually under 10 MB.',
        unreadable:
          'Could not open that file. Check that it is still there and that you have permission to read it.',
        parse: 'Could not read this PDF. It may be password protected or damaged.',
        save: 'I read the sheet, but could not save the character.'
      },
      warnings: {
        'pdf-sem-texto':
          'This PDF has no readable text: it looks like a scan, or artwork exported without text. Nothing can be imported from it automatically; a PDF sheet with fillable fields, or at least with real text, works.',
        'sem-formulario':
          'This sheet has no fillable fields: it is a text PDF. What can be read are lines shaped like "Label: value" and values sitting on the same line as a label, so the reading is a guess based on the layout: check item by item before importing.',
        'formulario-vazio':
          'The sheet has fillable fields, but they are all empty: it looks like the blank template.',
        'sem-nome-nem-rolagem':
          'I found no character name and no roll in this sheet. The values below may be just the blank template defaults: check them before importing.',
        'arte-com-anotacao':
          'This sheet is an IMAGE with the text typed over it: the field names are part of the drawing, so the app cannot tell what each value is. I brought everything you wrote, in the order it appears on the page, for you to organize in the character sheet.',
        'ordem-maior-dado':
          'Checks on this sheet use the HIGHEST die, not the sum: that is the Ordem Paranormal rule, and the check presets were created that way. If one of your attacks uses a ZERO attribute, which rolls two and keeps the WORST, switch it to "lowest" in the preset editor.',
        'dnd5e-modelo-em-branco':
          'I found no character name and no attack in this sheet: it looks like the blank template. Check what came through before importing.',
        'paginas-demais':
          'This PDF has more than 100 pages: it is a book, not a character sheet. Nothing was read from it.'
      }
    },
    errorBoundary: {
      title: 'Something went wrong',
      message: 'The interface ran into an unexpected error. You can try reloading the window.',
      reload: 'Reload'
    },
    credit: 'made by renatinm1'
  }
}
