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
    addDieHint: string
    maxDiceReachedHint: string
    removeDieGroup: string
    noDiceHint: string
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
  history: { title: string; empty: string; clear: string }
  /** Modo compacto — a janelinha de canto, que só tem presets e resultado (ver `CompactWidget.tsx`). */
  compact: { empty: string; resultEmpty: string }
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
    /** Botão de dado ao lado de um número da ficha que é rolagem (ver `sheetRoll.ts`). */
    sheetRollField: string
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
    /** "(3 de 12)" — quantos itens seguem marcados. */
    count: string
    rawTextTitle: string
    rawTextHint: string
    cancel: string
    confirm: string
    confirming: string
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
      modifier: 'Mod:',
      modifierMinus: 'Diminuir o modificador',
      modifierPlus: 'Aumentar o modificador',
      mode: { normal: 'Normal', advantage: 'Vantagem', disadvantage: 'Desvantagem' },
      explode: '💥 Explode',
      explodeHint:
        'Dado que tira o valor máximo cai de novo, e os dois somam. Não combina com vantagem/desvantagem.',
      explodeSuffix: '(explodiu)',
      quickForced:
        'Este computador não conseguiu desenhar a bandeja 3D, então o Reroll está no modo rápido. Os dados são os mesmos — só não aparecem caindo.',
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
      maxDiceReachedHint: 'Limite de {max} dados por rolagem atingido',
      removeDieGroup: 'Tira este tipo de dado da rolagem',
      noDiceHint: 'Escolha um tipo de dado pra rolar'
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
      formula: 'Fórmula',
      formulaPlaceholder: '1d20 + 5 · 4d6kh3 · 2d20kl1 · 1d6!',
      formulaHint: 'Escreva a rolagem e os botões abaixo acompanham. kh3 usa os 3 maiores, kl1 o menor, ! explode no máximo.',
      cancel: 'Cancelar',
      save: 'Salvar',
      tooManyDice: 'Máximo de {max} dados no total (soma de todos os grupos).',
      keep: 'No total, usar',
      keepAll: 'todos os dados (somar)',
      keepHighest: 'os maiores',
      keepLowest: 'os menores',
      keepCount: 'Quantos dados contam',
      keepHint: 'Os outros dados continuam sendo rolados e aparecem na bandeja — só não entram na conta.',
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
      themeSystem: '🖥️ Sistema ({mode})',
      font: 'Fonte',
      sound: 'Som',
      soundOn: 'Ativado',
      soundOff: 'Desativado',
      compactMode: 'Modo compacto',
      compactModeHint: 'Janela pequena com seus presets, sempre por cima das outras.',
      compactEnter: 'Modo compacto',
      compactExit: 'Sair do modo compacto',
      displayMode: 'Como o resultado aparece',
      displayModeHint: 'A bandeja 3D, ou só o número — mais rápido em computador mais fraco.',
      displayMode3d: '🎲 Bandeja 3D',
      displayModeQuick: '⚡ Resultado rápido',
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
        'Tem certeza?\n\nO Reroll vai baixar cerca de 100 MB e reiniciar sozinho para aplicar. Seus presets, anotações e preferências continuam onde estão.',
      updateNotesTitle: 'O que mudou nesta versão:',
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
      updateInstalling:
        'Instalando a versão {version}. O Reroll vai fechar e abrir sozinho em alguns segundos — nesse intervalo a tela fica sem ele. Não desligue o computador.',
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
      sectionRemove: 'Remover esta seção',
      sectionRemoveConfirm: 'Remover a seção “{title}” da ficha? Os valores dela se perdem.',
      attributesBlock: 'Atributos',
      abilitiesBlock: 'Habilidades',
      inventoryBlock: 'Inventário',
      appearanceBlock: 'Aparência',
      backstoryBlock: 'Backstory',
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
        'Você chegou no limite de {max} personagens. Apague um que não usa mais para criar outro — as anotações dele continuam no disco.',
      sheetImport: 'Importar ficha (PDF)',
      sheetImportReading: 'Lendo PDF...',
      sheetRollField: 'Rolar {field}',
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
      saveError: 'Não foi possível salvar as anotações. Suas últimas alterações podem ter sido perdidas.',
      loadError: 'Não consegui ler a ficha deste personagem. Ela está bloqueada pra edição até a leitura funcionar — assim nada é gravado por cima do que está no arquivo.'
    },
    sheetImport: {
      title: 'Conferir ficha importada',
      recognized: 'Reconhecemos como ficha de',
      betaNotice:
        'A importação de ficha está em teste. Ela lê bem as fichas dos sistemas que conhece e pode errar nas outras — confira os campos abaixo antes de confirmar.',
      unrecognized: 'Sistema não reconhecido',
      character: 'Personagem',
      system: 'Sistema',
      systemPlaceholder: 'Ordem Paranormal, D&D 5e, Oblivio...',
      fieldsTitle: 'Anotações',
      fieldsEmpty: 'Nenhum campo preenchido foi encontrado.',
      presetsTitle: 'Presets',
      presetsEmpty: 'Nenhuma rolagem foi encontrada nesta ficha.',
      count: '({selected} de {total})',
      rawTextTitle: 'Texto da ficha',
      rawTextHint: '(vai para o bloco História)',
      cancel: 'Cancelar',
      confirm: 'Criar personagem',
      confirming: 'Importando...',
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
          'Este PDF não tem texto que dê pra ler — ele parece ser uma imagem digitalizada ou uma arte exportada sem texto. Não dá pra importar nada dele automaticamente; uma ficha em PDF com campos preenchíveis, ou pelo menos com texto de verdade, funciona.',
        'sem-formulario':
          'Esta ficha não tem campos preenchíveis — é um PDF de texto. O que dá pra ler são as linhas no formato "Rótulo: valor" e os valores que estão na mesma linha de um rótulo, então a leitura é um palpite baseado na diagramação: confira item por item antes de importar.',
        'formulario-vazio':
          'A ficha tem campos preenchíveis, mas todos estão em branco — parece ser o modelo vazio.',
        'sem-nome-nem-rolagem':
          'Não achei nome de personagem nem nenhuma rolagem nesta ficha. Os valores que aparecem abaixo podem ser só o preenchimento de fábrica do modelo em branco — confira antes de importar.',
        'arte-com-anotacao':
          'Esta ficha é uma IMAGEM com o texto escrito por cima — os nomes dos campos fazem parte do desenho, então o app não tem como saber o que é cada valor. Trouxe tudo o que você escreveu, na ordem em que está na página, pra você organizar na ficha do personagem.',
        'ordem-maior-dado':
          'Nos testes desta ficha vale o MAIOR dado, e não a soma — é a regra de Ordem Paranormal, e os presets de teste já foram criados assim. Se algum ataque seu usa um atributo ZERO, que rola dois e fica com o PIOR, troque para "menor" no editor do preset.',
        'dnd5e-magias-sem-nome':
          'Esta ficha tem magias escritas na página de conjuração. O PDF guarda cada linha delas sem nome nenhum (só a posição na página), então não dá pra trazer o nome de cada magia — as que estiverem na caixa "Ataques e Magias" da primeira página vieram, e o resto você escreve no bloco de habilidades.',
        'dnd5e-modelo-em-branco':
          'Não achei nome de personagem nem nenhum ataque nesta ficha — ela parece ser o modelo em branco. Confira o que veio abaixo antes de importar.'
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
      modifier: 'Mod:',
      modifierMinus: 'Decrease the modifier',
      modifierPlus: 'Increase the modifier',
      mode: { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' },
      explode: '💥 Explode',
      explodeHint:
        'A die that rolls its highest face is rolled again, and both add up. Does not combine with advantage/disadvantage.',
      explodeSuffix: '(exploded)',
      quickForced:
        'This computer could not draw the 3D tray, so Reroll is in quick mode. The dice are the same — they just do not fall on screen.',
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
      maxDiceReachedHint: 'Limit of {max} dice per roll reached',
      removeDieGroup: 'Removes this die type from the roll',
      noDiceHint: 'Pick a die type to roll'
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
      formula: 'Formula',
      formulaPlaceholder: '1d20 + 5 · 4d6kh3 · 2d20kl1 · 1d6!',
      formulaHint: 'Type the roll and the buttons below follow. kh3 keeps the 3 highest, kl1 the lowest, ! explodes on the max.',
      cancel: 'Cancel',
      save: 'Save',
      tooManyDice: 'Maximum of {max} dice total (sum of all groups).',
      keep: 'For the total, use',
      keepAll: 'every die (sum them)',
      keepHighest: 'the highest',
      keepLowest: 'the lowest',
      keepCount: 'How many dice count',
      keepHint: 'The other dice are still rolled and land on the tray — they just do not count.',
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
      themeSystem: '🖥️ System ({mode})',
      font: 'Font',
      sound: 'Sound',
      soundOn: 'On',
      soundOff: 'Off',
      compactMode: 'Compact mode',
      compactModeHint: 'Small window with your presets, always on top.',
      compactEnter: 'Compact mode',
      compactExit: 'Leave compact mode',
      displayMode: 'How the result shows up',
      displayModeHint: 'The 3D tray, or just the number — faster on a weaker computer.',
      displayMode3d: '🎲 3D tray',
      displayModeQuick: '⚡ Quick result',
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
        'Are you sure?\n\nReroll will download about 100 MB and restart itself to apply it. Your presets, notes and preferences stay where they are.',
      updateNotesTitle: 'What changed in this version:',
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
      updateInstalling:
        'Installing version {version}. Reroll will close and reopen by itself in a few seconds — the screen sits without it in between. Do not turn the computer off.',
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
      sectionRemove: 'Remove this section',
      sectionRemoveConfirm: 'Remove the “{title}” section from the sheet? Its values are lost.',
      attributesBlock: 'Attributes',
      abilitiesBlock: 'Abilities',
      inventoryBlock: 'Inventory',
      appearanceBlock: 'Appearance',
      backstoryBlock: 'Backstory',
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
        'You have reached the limit of {max} characters. Delete one you no longer use to create another — its notes stay on disk.',
      sheetImport: 'Import sheet (PDF)',
      sheetImportReading: 'Reading PDF...',
      sheetRollField: 'Roll {field}',
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
      saveError: 'Could not save notes. Your latest changes may have been lost.',
      loadError: 'Could not read this character sheet. Editing is locked until the read succeeds, so nothing overwrites what is in the file.'
    },
    sheetImport: {
      title: 'Review imported sheet',
      recognized: 'Recognized as a sheet for',
      betaNotice:
        'Sheet import is in testing. It reads the systems it knows well and may get others wrong — check the fields below before confirming.',
      unrecognized: 'System not recognized',
      character: 'Character',
      system: 'System',
      systemPlaceholder: 'D&D 5e, Ordem Paranormal, Oblivio...',
      fieldsTitle: 'Notes',
      fieldsEmpty: 'No filled-in field was found.',
      presetsTitle: 'Presets',
      presetsEmpty: 'No roll was found in this sheet.',
      count: '({selected} of {total})',
      rawTextTitle: 'Sheet text',
      rawTextHint: '(goes to the Backstory block)',
      cancel: 'Cancel',
      confirm: 'Create character',
      confirming: 'Importing...',
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
          'This PDF has no readable text — it looks like a scan, or artwork exported without text. Nothing can be imported from it automatically; a PDF sheet with fillable fields, or at least with real text, works.',
        'sem-formulario':
          'This sheet has no fillable fields — it is a text PDF. What can be read are lines shaped like "Label: value" and values sitting on the same line as a label, so the reading is a guess based on the layout: check item by item before importing.',
        'formulario-vazio':
          'The sheet has fillable fields, but they are all empty — it looks like the blank template.',
        'sem-nome-nem-rolagem':
          'I found no character name and no roll in this sheet. The values below may be just the blank template defaults — check them before importing.',
        'arte-com-anotacao':
          'This sheet is an IMAGE with the text typed over it — the field names are part of the drawing, so the app cannot tell what each value is. I brought everything you wrote, in the order it appears on the page, for you to organize in the character sheet.',
        'ordem-maior-dado':
          'Checks on this sheet use the HIGHEST die, not the sum — that is the Ordem Paranormal rule, and the check presets were created that way. If one of your attacks uses a ZERO attribute, which rolls two and keeps the WORST, switch it to "lowest" in the preset editor.',
        'dnd5e-magias-sem-nome':
          'This sheet has spells written on the spellcasting page. The PDF stores each of those lines with no name at all (only its position on the page), so the name of each spell cannot be brought over — whatever is in the "Attacks & Spellcasting" box on page one did come through, and you can write the rest in the abilities block.',
        'dnd5e-modelo-em-branco':
          'I found no character name and no attack in this sheet — it looks like the blank template. Check what came through before importing.'
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
