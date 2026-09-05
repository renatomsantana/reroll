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
    /** O quadradinho de cor do chip, que abre o seletor: `{name}` é a condição. */
    conditionColor: string
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
    /** A barra que SOBE (estresse, dano por região): a coluna do editor e a dica dela. */
    rises: string
    risesHint: string
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
    /** Botão e estado de espera da importação de ficha em PDF. */
    sheetImport: string
    sheetImportReading: string
    /** A dica do botão de importar APAGADO no teto de personagens (pedido dele). */
    sheetImportLimit: string
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
   * A IMPORTAÇÃO DE FICHA — a janela de confirmação, os erros do caminho e os avisos dos leitores.
   *
   * A janela deixou de ser conferência campo a campo (pedido do usuário, 30/08/2026: "apenas aperte
   * o PDF e diga ok importaremos"): agora ela resume o que foi lido, importa tudo, e a revisão é na
   * aba Ficha, onde tudo é editável.
   *
   * `warnings` é `Record<SheetWarningId, string>` de propósito: um aviso novo sem tradução não
   * compila. Ver `shared/types/sheetWarning.ts`.
   */
  sheetImport: {
    /**
     * O que a Ficha diz LOGO DEPOIS de importar (sem janela desde 02/09/2026): o sistema
     * reconhecido, ou não; quanto entrou; e que está tudo editável ali.
     */
    recognized: string
    unrecognized: string
    /** `{fields}` campos e `{presets}` rolagens, e a lembrança de que tudo é editável. */
    done: string
    /** O "tem certeza?" antes de escolher o PDF: importar sempre cria um personagem novo. */
    confirmNew: string
    dismiss: string
    /** PDF sem nada que dê pra importar: nenhum personagem nasce. */
    nothingRead: string
    /** No teto (`MAX_PROFILES`: três nos testadores), a importação que criaria um novo é recusada. */
    atLimit: string
    /** O corte por seção (`MAXIMO_DE_CAMPOS_POR_SECAO`), dito depois de importar. */
    sectionTrimmed: string
    errors: {
      picker: string
      tooLarge: string
      unreadable: string
      parse: string
      save: string
      /** O arquivo escolhido não é PDF, e o caso mais comum: é o personagem exportado pelo Reroll. */
      notPdf: string
      rerollPackage: string
    }
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
      conditionPlaceholder: 'Machucado, Caído...',
      conditionColor: 'Cor da condição {name}'
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
      colorAuto: 'Voltar à cor padrão do nome (PV bordô, PE azul, Sanidade roxo)',
      rises: 'Sobe',
      risesHint: 'Começa vazia e enche: estresse, dano por região, fadiga. Vai do amarelo ao vermelho conforme sobe.',
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
        'Máximo de personagens atingido: {max}. Apague um que não usa mais para criar outro: a ficha dele vai pra pasta de backup.',
      sheetImport: 'Importar ficha (PDF)',
      sheetImportReading: 'Lendo PDF...',
      sheetImportLimit: 'Limite alcançado: apenas {max} personagens!',
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
      recognized: 'Reconhecemos como ficha de',
      unrecognized: 'Sistema não reconhecido: importamos o que deu pra ler.',
      done: '{fields} campos e {presets} rolagens importados. Tudo fica editável aqui embaixo, a qualquer momento.',
      confirmNew: 'Importar uma ficha cria um personagem novo. Os que já existem não mudam. Continuar?',
      dismiss: 'Entendi',
      nothingRead: 'Não achei nada pra importar neste PDF, então nenhum personagem foi criado.',
      atLimit: 'Máximo de personagens atingido: {max}. Apague um antes de importar outra ficha.',
      sectionTrimmed: 'Só os primeiros {max} campos de cada seção entraram na ficha: {n} ficaram de fora.',
      errors: {
        picker: 'Não consegui abrir o seletor de arquivos.',
        tooLarge:
          'Este PDF tem {mb} MB e é grande demais para abrir com segurança. Ficha de personagem costuma ter menos de 10 MB.',
        unreadable:
          'Não consegui abrir esse arquivo. Confira se ele ainda está no lugar e se você tem permissão para lê-lo.',
        parse: 'Não consegui ler este PDF. Ele pode estar protegido por senha ou danificado.',
        notPdf: 'Este arquivo não é um PDF. Aqui entra a ficha de personagem em PDF; pra trazer um personagem exportado pelo Reroll, use "Importar personagem Reroll".',
        rerollPackage: 'Este arquivo é um personagem exportado pelo Reroll, não uma ficha em PDF. Use o botão "Importar personagem Reroll" pra trazer ele.',
        save: 'Li a ficha, mas não consegui gravar o personagem.'
      },
      warnings: {
        'pdf-sem-texto':
          'Este PDF não tem texto que dê pra ler: parece uma imagem digitalizada ou uma arte exportada sem texto. Uma ficha em PDF com campos preenchíveis, ou pelo menos com texto de verdade, funciona.',
        'sem-formulario':
          'Esta ficha não tem campos preenchíveis: é um PDF de texto. Lemos as linhas no formato "Rótulo: valor" e os valores na mesma linha de um rótulo, então a leitura é um palpite pela diagramação: confira item por item aqui na Ficha.',
        'formulario-vazio':
          'A ficha tem campos preenchíveis, mas todos estão em branco: parece ser o modelo vazio. Os campos entraram vazios, prontos pra preencher aqui.',
        'sem-nome-nem-rolagem':
          'Não achei nome de personagem nem nenhuma rolagem nesta ficha. Os valores importados podem ser só o preenchimento de fábrica do modelo em branco: confira aqui na Ficha.',
        'arte-com-anotacao':
          'Esta ficha é uma IMAGEM com o texto escrito por cima: os nomes dos campos fazem parte do desenho, então o app não tem como saber o que é cada valor. Trouxemos tudo o que você escreveu, na ordem da página, pra você organizar aqui na Ficha.',
        'ordem-maior-dado':
          'Nos testes desta ficha vale o MAIOR dado, e não a soma: é a regra de Ordem Paranormal, e os presets de teste já foram criados assim. Se algum ataque seu usa um atributo ZERO, que rola dois e fica com o PIOR, troque para "menor" no editor do preset.',
        'dnd5e-modelo-em-branco':
          'Não achei nome de personagem nem nenhum ataque nesta ficha: ela parece ser o modelo em branco. Confira o que veio aqui na Ficha.',
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
      conditionPlaceholder: 'Wounded, Prone...',
      conditionColor: 'Color of the {name} condition'
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
      colorAuto: 'Back to the default color for the name (HP maroon, PE blue, Sanity purple)',
      rises: 'Rises',
      risesHint: 'Starts empty and fills up: stress, damage per body part, fatigue. Goes from yellow to red as it rises.',
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
        'Maximum number of characters reached: {max}. Delete one you no longer use to create another: its sheet goes to the backup folder.',
      sheetImport: 'Import sheet (PDF)',
      sheetImportReading: 'Reading PDF...',
      sheetImportLimit: 'Limit reached: only {max} characters!',
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
      recognized: 'Recognized as a sheet for',
      unrecognized: 'System not recognized: we imported what could be read.',
      done: '{fields} fields and {presets} rolls imported. Everything stays editable down here, anytime.',
      confirmNew: 'Importing a sheet creates a new character. Existing ones are not changed. Continue?',
      dismiss: 'Got it',
      nothingRead: 'Found nothing to import in this PDF, so no character was created.',
      atLimit: 'Maximum number of characters reached: {max}. Delete one before importing another sheet.',
      sectionTrimmed: 'Only the first {max} fields of each section went into the sheet: {n} were left out.',
      errors: {
        picker: 'Could not open the file picker.',
        tooLarge:
          'This PDF is {mb} MB, too large to open safely. A character sheet is usually under 10 MB.',
        unreadable:
          'Could not open that file. Check that it is still there and that you have permission to read it.',
        parse: 'Could not read this PDF. It may be password protected or damaged.',
        notPdf: 'This file is not a PDF. This button takes the character sheet as a PDF; to bring in a character exported by Reroll, use "Import Reroll character".',
        rerollPackage: 'This file is a character exported by Reroll, not a PDF sheet. Use the "Import Reroll character" button to bring it in.',
        save: 'I read the sheet, but could not save the character.'
      },
      warnings: {
        'pdf-sem-texto':
          'This PDF has no readable text: it looks like a scanned image or artwork exported without text. A PDF sheet with fillable fields, or at least real text, works.',
        'sem-formulario':
          'This sheet has no fillable fields: it is a text PDF. We read lines in the "Label: value" format and values on the same line as a label, so the reading is a guess based on the layout: check it item by item here on the Sheet.',
        'formulario-vazio':
          'The sheet has fillable fields, but they are all blank: it looks like the empty template. The fields came in empty, ready to fill in here.',
        'sem-nome-nem-rolagem':
          'Found no character name and no rolls in this sheet. The imported values may just be the factory defaults of the blank template: check them here on the Sheet.',
        'arte-com-anotacao':
          'This sheet is an IMAGE with text written over it: the field names are part of the drawing, so the app cannot tell what each value is. We brought in everything you wrote, in page order, for you to organize here on the Sheet.',
        'ordem-maior-dado':
          'Tests on this sheet keep the HIGHEST die instead of adding them: that is the Ordem Paranormal rule, and the test presets were created that way. If one of your attacks uses a ZERO attribute, which rolls two and keeps the WORST, switch it to "lowest" in the preset editor.',
        'dnd5e-modelo-em-branco':
          'Found no character name and no attacks in this sheet: it looks like the blank template. Check what came in here on the Sheet.',
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
