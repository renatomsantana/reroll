import type { Language } from '@renderer/settings/SettingsContext'

export interface TranslationDict {
  appTitle: string
  tabs: { roll: string; style: string; notes: string }
  roller: {
    quantityLabel: string
    typeLabel: string
    /** Legenda da caixa de grupo com quantidade/modo/modificador + botão de rolar. */
    rollGroupTitle: string
    rollButton: string
    modifier: string
    mode: { normal: string; advantage: string; disadvantage: string }
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
    addDieHint: string
    maxDiceReachedHint: string
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
    importSuccess: string
    importError: string
    saveError: string
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
  }
  emojiPicker: { hint: string }
  statusBar: { shortcutsHint: string }
  history: { title: string; empty: string; clear: string }
  /** Modo compacto — a janelinha de canto, que só tem presets e resultado (ver `CompactWidget.tsx`). */
  compact: { empty: string; resultEmpty: string }
  settings: {
    title: string
    language: string
    theme: string
    day: string
    night: string
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
    resultPopupHint: string
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
    updateError: string
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
    trayShapes: { triangle: string; square: string; hexagon: string; circle: string }
    launchMode: string
    launchModeOptions: { tray: string; tower: string; towerDecor: string }
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
    inventoryBlock: string
    appearanceBlock: string
    backstoryBlock: string
    notesBlock: string
    /** Navegação do diário: uma página por dia. */
    dayNumber: string
    dayCounter: string
    dayPrev: string
    dayNext: string
    dayNew: string
    dayDelete: string
    dayDeleteConfirm: string
    /** Rótulo do seletor que pula direto pra uma sessão, sem passar de uma em uma pelas setas. */
    dayJump: string
    /**
     * Texto de exemplo do campo de título da sessão. É um convite ("Bote um título"), não o número da
     * página: o número já está no contador ao lado, e um campo que mostra "Sessão 3" sozinho parece
     * rótulo preenchido, não campo vazio esperando um nome.
     */
    dayTitlePlaceholder: string
    /** Bloco do PERFIL do personagem (foto, nome, sistema) — ver `shared/types/profile.ts`. */
    profileSystem: string
    profilePhoto: string
    profilePhotoEmpty: string
    profileNew: string
    profileDelete: string
    profileDeleteConfirm: string
    profileUnnamed: string
    profileSwitch: string
    fontDefault: string
    boldLabel: string
    italicLabel: string
    underlineLabel: string
    colorLabel: string
    colorReset: string
    saveError: string
  }
  errorBoundary: { title: string; message: string; reload: string }
  credit: string
}

export const translations: Record<Language, TranslationDict> = {
  'pt-BR': {
    appTitle: 'Reroll',
    tabs: { roll: 'Rolagem', style: '🎨 Estilo', notes: '📝 Anotações' },
    roller: {
      quantityLabel: 'Quantidade de dados',
      typeLabel: 'Tipo de dado',
      rollGroupTitle: 'Rolagem',
      rollButton: 'ROLAR',
      modifier: 'Mod:',
      mode: { normal: 'Normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' },
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
      addDieHint: 'Adiciona um dado deste tipo à rolagem',
      maxDiceReachedHint: 'Limite de {max} dados por rolagem atingido'
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
      importSuccess: '{count} preset(s) importado(s) com sucesso.',
      importError: 'Não foi possível importar: {error}',
      saveError: 'Não foi possível salvar o preset: {error}'
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
      cancel: 'Cancelar',
      save: 'Salvar',
      tooManyDice: 'Máximo de {max} dados no total (soma de todos os grupos).',
      keep: 'No total, usar',
      keepAll: 'todos os dados (somar)',
      keepHighest: 'os maiores',
      keepLowest: 'os menores',
      keepCount: 'Quantos dados contam',
      keepHint: 'Os outros dados continuam sendo rolados e aparecem na bandeja — só não entram na conta.'
    },
    emojiPicker: {
      hint: 'Dica: com o campo de ícone selecionado, pressione Win + . pra abrir o seletor de emojis completo do Windows.'
    },
    statusBar: {
      shortcutsHint: 'Enter/Espaço : ROLL! · WASD move a câmera · Esc fecha · Ctrl+N novo preset'
    },
    history: {
      title: 'Histórico',
      empty: 'Nenhuma rolagem ainda nesta sessão.',
      clear: 'Limpar'
    },
    compact: {
      empty: 'Nenhum preset ainda. Saia do modo compacto pra criar — a janela pequena não tem espaço pro editor.',
      resultEmpty: 'Toque num preset pra rolar.'
    },
    settings: {
      title: 'Preferências',
      language: 'Idioma',
      theme: 'Tema',
      day: '☀️ Dia',
      night: '🌙 Noite',
      font: 'Fonte',
      sound: 'Som',
      soundOn: 'Ativado',
      soundOff: 'Desativado',
      compactMode: 'Modo compacto',
      compactModeHint: 'Janela pequena com seus presets, sempre por cima das outras.',
      compactEnter: 'Modo compacto',
      compactExit: 'Sair do modo compacto',
      resultPopup: 'Popup de resultado',
      resultPopupHint: 'Mostra o total somado num popup por cima da bandeja ao assentar os dados.',
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
        'Tem certeza?\n\nO Reroll vai baixar cerca de 76 MB e reiniciar sozinho para aplicar. Seus presets, anotações e preferências continuam onde estão.',
      restartNow: 'Reiniciar agora',
      updateBadge: '▲ Versão {version} disponível — clique para atualizar',
      updatePromptTitle: 'Atualização disponível',
      updateLater: 'Agora não',
      updateConfirmYes: 'Sim, atualizar',
      updateChecking: 'Procurando atualizações...',
      updateUpToDate: 'Você está na versão mais recente.',
      updateAvailable: 'Existe uma atualização nova: versão {version}.',
      updateDownloading: 'Baixando a versão {version}... {percent}%',
      updateReady: 'Versão {version} baixada — reiniciando para aplicar...',
      updateError: 'Não deu pra procurar atualizações agora.',
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
        '{n} tipo(s) com cor própria — eles ignoram a cor padrão até você aplicar aqui.',
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
      trayShapes: { triangle: 'Triângulo', square: 'Quadrado', hexagon: 'Hexágono', circle: 'Círculo' },
      launchMode: 'Modo de lançamento',
      launchModeOptions: { tray: 'Sem torre', tower: 'Torre rolando', towerDecor: 'Torre de enfeite' },
      cameraLockOn: 'Câmera travada nos dados — clique pra soltar (WASD move, Q/E sobe e desce)',
      cameraLockOff: 'Câmera solta — clique pra travar nos dados (WASD move, Q/E sobe e desce)',
      backgroundImage: 'Imagem de fundo',
      backgroundImagePick: 'Escolher imagem...',
      backgroundImageClear: 'Remover imagem',
      backgroundImageError: 'Não foi possível carregar a imagem escolhida.'
    },
    notesTab: {
      sheetBlock: 'Personagem',
      name: 'Nome',
      inventoryBlock: 'Inventário',
      appearanceBlock: 'Aparência',
      backstoryBlock: 'Backstory',
      notesBlock: 'Bloco',
      dayNumber: 'Sessão {n}',
      dayCounter: '{current}/{total}',
      dayPrev: 'Sessão anterior',
      dayNext: 'Próxima sessão',
      dayNew: 'Nova sessão',
      dayDelete: 'Apagar esta sessão',
      dayDeleteConfirm: 'Apagar "{day}"? O que estiver escrito nessa sessão se perde.',
      dayJump: 'Ir para a sessão',
      dayTitlePlaceholder: 'Bote um título',
      profileSystem: 'Sistema',
      profilePhoto: 'Escolher foto',
      profilePhotoEmpty: 'sem foto',
      profileNew: 'Novo personagem',
      profileDelete: 'Apagar personagem',
      profileDeleteConfirm:
        'Apagar "{name}" da lista? As anotações e os presets dele continuam no disco, mas ele some daqui.',
      profileUnnamed: 'Personagem {n}',
      profileSwitch: 'Trocar de personagem',
      fontDefault: 'Fonte padrão',
      boldLabel: 'Negrito',
      italicLabel: 'Itálico',
      underlineLabel: 'Sublinhado',
      colorLabel: 'Cor do texto',
    colorReset: 'Padrão (segue o tema)',
      saveError: 'Não foi possível salvar as anotações. Suas últimas alterações podem ter sido perdidas.'
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
    tabs: { roll: 'Roll', style: '🎨 Style', notes: '📝 Notes' },
    roller: {
      quantityLabel: 'Number of dice',
      typeLabel: 'Dice type',
      rollGroupTitle: 'Roll',
      rollButton: 'ROLL',
      modifier: 'Mod:',
      mode: { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' },
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
      addDieHint: 'Adds one die of this type to the roll',
      maxDiceReachedHint: 'Limit of {max} dice per roll reached'
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
      importSuccess: '{count} preset(s) imported successfully.',
      importError: 'Could not import: {error}',
      saveError: 'Could not save preset: {error}'
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
      cancel: 'Cancel',
      save: 'Save',
      tooManyDice: 'Maximum of {max} dice total (sum of all groups).',
      keep: 'For the total, use',
      keepAll: 'every die (sum them)',
      keepHighest: 'the highest',
      keepLowest: 'the lowest',
      keepCount: 'How many dice count',
      keepHint: 'The other dice are still rolled and land on the tray — they just do not count.'
    },
    emojiPicker: {
      hint: 'Tip: with the icon field selected, press Win + . to open the full Windows emoji picker.'
    },
    statusBar: {
      shortcutsHint: 'Enter/Space : ROLL! · WASD moves the camera · Esc closes · Ctrl+N new preset'
    },
    history: {
      title: 'History',
      empty: 'No rolls yet this session.',
      clear: 'Clear'
    },
    compact: {
      empty: 'No presets yet. Leave compact mode to create one — the small window has no room for the editor.',
      resultEmpty: 'Tap a preset to roll.'
    },
    settings: {
      title: 'Preferences',
      language: 'Language',
      theme: 'Theme',
      day: '☀️ Day',
      night: '🌙 Night',
      font: 'Font',
      sound: 'Sound',
      soundOn: 'On',
      soundOff: 'Off',
      compactMode: 'Compact mode',
      compactModeHint: 'Small window with your presets, always on top.',
      compactEnter: 'Compact mode',
      compactExit: 'Leave compact mode',
      resultPopup: 'Result popup',
      resultPopupHint: 'Shows the summed total in a popup over the tray once the dice settle.',
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
        'Are you sure?\n\nReroll will download about 76 MB and restart itself to apply it. Your presets, notes and preferences stay where they are.',
      restartNow: 'Restart now',
      updateBadge: '▲ Version {version} available — click to update',
      updatePromptTitle: 'Update available',
      updateLater: 'Not now',
      updateConfirmYes: 'Yes, update',
      updateChecking: 'Checking for updates...',
      updateUpToDate: "You're on the latest version.",
      updateAvailable: 'There is a new update: version {version}.',
      updateDownloading: 'Downloading version {version}... {percent}%',
      updateReady: 'Version {version} downloaded — restarting to apply...',
      updateError: "Couldn't check for updates right now.",
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
        '{n} type(s) have their own colour — they ignore the default until you apply it here.',
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
      trayShapes: { triangle: 'Triangle', square: 'Square', hexagon: 'Hexagon', circle: 'Circle' },
      launchMode: 'Launch mode',
      launchModeOptions: { tray: 'No tower', tower: 'Tower rolls', towerDecor: 'Tower as decor' },
      cameraLockOn: 'Camera locked on the dice — click to release (WASD moves, Q/E up and down)',
      cameraLockOff: 'Camera free — click to lock on the dice (WASD moves, Q/E up and down)',
      backgroundImage: 'Background image',
      backgroundImagePick: 'Choose image...',
      backgroundImageClear: 'Remove image',
      backgroundImageError: 'Could not load the chosen image.'
    },
    notesTab: {
      sheetBlock: 'Character',
      name: 'Name',
      inventoryBlock: 'Inventory',
      appearanceBlock: 'Appearance',
      backstoryBlock: 'Backstory',
      notesBlock: 'Notepad',
      dayNumber: 'Session {n}',
      dayCounter: '{current}/{total}',
      dayPrev: 'Previous session',
      dayNext: 'Next session',
      dayNew: 'New session',
      dayDelete: 'Delete this session',
      dayDeleteConfirm: 'Delete "{day}"? Anything written in that session is lost.',
      dayJump: 'Jump to session',
      dayTitlePlaceholder: 'Give it a title',
      profileSystem: 'System',
      profilePhoto: 'Choose photo',
      profilePhotoEmpty: 'no photo',
      profileNew: 'New character',
      profileDelete: 'Delete character',
      profileDeleteConfirm:
        'Remove "{name}" from the list? Their notes and presets stay on disk, but they disappear from here.',
      profileUnnamed: 'Character {n}',
      profileSwitch: 'Switch character',
      fontDefault: 'Default font',
      boldLabel: 'Bold',
      italicLabel: 'Italic',
      underlineLabel: 'Underline',
      colorLabel: 'Text color',
      colorReset: 'Default (follows theme)',
      saveError: 'Could not save notes. Your latest changes may have been lost.'
    },
    errorBoundary: {
      title: 'Something went wrong',
      message: 'The interface ran into an unexpected error. You can try reloading the window.',
      reload: 'Reload'
    },
    credit: 'made by renatinm1'
  }
}
