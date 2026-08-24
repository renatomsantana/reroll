import { ATRIBUTO_DND, POOL, BONUS, campo, secao, preset, escreverEmDisco } from './quinzePerfis.mjs'

/**
 * A TERCEIRA LEVA — quinze personagens PESADOS.
 *
 * As duas primeiras levas testam coisas diferentes: a primeira, ficha cheia e isolamento entre
 * personagens; a segunda, LACUNA sobrevivendo ao disco. Esta testa VOLUME, que é outro eixo:
 *
 * - texto longo de verdade nos blocos (história, inventário, aparência) — parágrafos, não frases;
 * - muitos campos por ficha (30 a 60), como fica uma ficha importada com o esqueleto inteiro;
 * - MUITAS SESSÕES por personagem (cinco a doze páginas de diário), que é o que se acumula numa
 *   campanha real e o que o usuário pediu pra conferir: "coloca sessões, troca perfis para ver se
 *   as sessões se mantêm".
 *
 * Volume não é enfeite de teste: `notes.json` é um arquivo por personagem, e quinze fichas gordas
 * são o caso em que uma gravação truncada, um limite de tamanho ou uma troca de perfil no meio da
 * escrita aparecem. Com ficha magra, tudo passa.
 *
 * `node scripts/terceiraLeva.mjs <pasta>` escreve os quinze no formato do `userData`.
 */

/** Um parágrafo de diário com cara de sessão de verdade, e não de recheio. */
function sessao(n, titulo, ...paragrafos) {
  return {
    id: `s${n}`,
    createdAt: Date.UTC(2026, 5, n * 2),
    title: titulo,
    text: paragrafos.join('\n\n')
  }
}

/**
 * As sessões de uma campanha, com o texto crescendo como cresce de verdade: a primeira é curta
 * ("chegamos"), as do meio são as longas, e a última é a que ficou sem terminar.
 */
function campanha(nome, lugares) {
  return lugares.map((lugar, i) =>
    sessao(
      i + 1,
      `Sessão ${i + 1} — ${lugar.titulo}`,
      lugar.abertura,
      ...(lugar.detalhes ?? []),
      i === lugares.length - 1 ? `(${nome}) A sessão parou aqui. Retomar por este ponto.` : lugar.fecho ?? ''
    )
  )
}

const HISTORIA_LONGA = [
  'Nasceu na cidade baixa, onde a água do rio sobe duas vezes por ano e leva junto o que estiver solto.',
  'Aprendeu o ofício com quem não queria ensinar, olhando por cima do ombro e apanhando quando era visto.',
  'A primeira vez que saiu da cidade foi para acompanhar um caixote que ninguém explicou, e voltou sozinho.',
  'Desde então mede as pessoas pelo que elas escondem, e não pelo que dizem — o que dá certo mais vezes do que deveria.'
].join(' ')

const INVENTARIO_LONGO = [
  'Mochila de lona encerada, com alça remendada duas vezes.',
  'Corda de trinta metros, seca, enrolada em oito voltas.',
  'Caderno de capa dura com metade das folhas arrancadas.',
  'Duas mudas de roupa, uma delas boa o bastante para entrar em prédio público.',
  'Lamparina pequena, três frascos de óleo, isqueiro de pederneira.',
  'Faca de cinto, sem enfeite, amolada na semana passada.',
  'Bolsa de moedas com o troco de três cidades diferentes.'
].join('\n')

const APARENCIA_LONGA =
  'Alto para a média da região, ombros largos de carregar peso, e uma cicatriz que sai da orelha esquerda ' +
  'e some no cabelo. Anda sempre com a mesma jaqueta, que já foi azul. Fala pouco e devagar, e quando ' +
  'termina de falar continua olhando, o que faz as pessoas acrescentarem coisas que não pretendiam contar.'

/** Uma ficha de Ordem Paranormal com o esqueleto inteiro — 29 perícias, rituais e itens. */
function fichaDeOrdem(dados) {
  const PERICIAS = [
    'Acrobacia', 'Adestramento', 'Artes', 'Atletismo', 'Atualidades', 'Ciências', 'Crime',
    'Diplomacia', 'Enganação', 'Fortitude', 'Furtividade', 'Iniciativa', 'Intimidação', 'Intuição',
    'Investigação', 'Luta', 'Medicina', 'Ocultismo', 'Percepção', 'Pilotagem', 'Pontaria',
    'Profissão', 'Reflexos', 'Religião', 'Sobrevivência', 'Tática', 'Tecnologia', 'Vontade', 'Furto'
  ]
  return [
    secao('Identificação', [
      campo('Personagem', dados.nome),
      campo('Jogador', dados.jogador),
      campo('Classe', dados.classe),
      campo('Origem', dados.origem),
      campo('Trilha', dados.trilha ?? ''),
      campo('NEX', dados.nex)
    ]),
    secao('Atributos', [
      campo('Agilidade', dados.agi, POOL),
      campo('Força', dados.forca, POOL),
      campo('Intelecto', dados.int, POOL),
      campo('Presença', dados.pre, POOL),
      campo('Vigor', dados.vig, POOL)
    ]),
    secao('Recursos', [
      campo('PV atual', dados.pvAtual),
      campo('PV máximo', dados.pv),
      campo('PE atual', dados.peAtual ?? ''),
      campo('PE máximo', dados.pe),
      campo('Sanidade atual', dados.sanAtual),
      campo('Sanidade máxima', dados.san),
      campo('Defesa', dados.defesa),
      campo('Deslocamento', '9m/6q'),
      campo('DT de rituais', dados.dt)
    ]),
    secao('Perícias', PERICIAS.map((nome) => campo(nome, dados.pericias?.[nome] ?? ''))),
    secao('Rituais', Array.from({ length: 8 }, (_, i) => campo(`Ritual ${i + 1}`, dados.rituais?.[i] ?? ''))),
    secao('Itens', Array.from({ length: 10 }, (_, i) => campo(`Item ${i + 1}`, dados.itens?.[i] ?? '')))
  ]
}

export const TERCEIRA_LEVA = [
  {
    id: 'agata-ordem-pesada',
    name: 'Ágata Ferrer',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Ágata Ferrer',
      sections: fichaDeOrdem({
        nome: 'Ágata Ferrer',
        jogador: 'Lu',
        classe: 'Ocultista',
        origem: 'Acadêmica',
        trilha: 'Conjurador',
        nex: '45% · 5 PE/turno',
        agi: '2', forca: '1', int: '5', pre: '3', vig: '2',
        pvAtual: '18', pv: '38', peAtual: '7', pe: '22', sanAtual: '11', san: '24', defesa: '13', dt: '17',
        pericias: { Ocultismo: '15', Investigação: '10', Vontade: '10', Intuição: '5', Atualidades: '5' },
        rituais: ['Amaldiçoar', 'Presságio', 'Perturbação'],
        itens: ['Caderno de campo', 'Giz de calcário', 'Sal grosso', 'Isqueiro', 'Espelho de bolso']
      }),
      inventory: INVENTARIO_LONGO,
      appearance: APARENCIA_LONGA,
      backstory: HISTORIA_LONGA,
      pages: campanha('Ágata', [
        { titulo: 'O convite', abertura: 'A carta chegou sem remetente, com o endereço escrito à mão e a data de ontem.' },
        {
          titulo: 'A casa da rua 9',
          abertura: 'A porta estava destrancada e o corredor cheirava a cobre.',
          detalhes: ['Encontramos treze relógios, todos parados às 3h47.', 'O da sala continuou andando enquanto ninguém olhava.'],
          fecho: 'Saímos antes de escurecer, com dois dos relógios.'
        },
        {
          titulo: 'Arquivo municipal',
          abertura: 'O funcionário não quis abrir a caixa de 1974 sem autorização.',
          detalhes: ['Voltamos à noite. A caixa tinha sido aberta antes de nós, e faltavam três pastas.'],
          fecho: 'A quarta pasta estava fora de ordem, com uma foto que não é do arquivo.'
        },
        { titulo: 'A entrevista', abertura: 'A testemunha falou por duas horas e não disse nada que já não estivesse no boletim.' },
        {
          titulo: 'Subsolo',
          abertura: 'A planta do prédio não tem esse andar.',
          detalhes: ['Contamos os degraus na descida: 22. Na subida, 19.'],
          fecho: ''
        }
      ])
    },
    presets: [
      preset('agata-ritual', 'Ritual (teste)', '🕯️', [{ count: 5, sides: 20 }], 0, { keep: { mode: 'highest', count: 1 } }),
      preset('agata-ocultismo', 'Ocultismo', '📕', [{ count: 5, sides: 20 }], 15, { keep: { mode: 'highest', count: 1 } })
    ]
  },
  {
    id: 'bento-ordem-pesada',
    name: 'Bento Aroeira',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Bento Aroeira',
      sections: fichaDeOrdem({
        nome: 'Bento Aroeira',
        jogador: 'Pam',
        classe: 'Combatente',
        origem: 'Lutador',
        nex: '30% · 3 PE/turno',
        agi: '3', forca: '4', int: '1', pre: '2', vig: '4',
        pvAtual: '31', pv: '52', peAtual: '', pe: '15', sanAtual: '16', san: '20', defesa: '16', dt: '11',
        pericias: { Luta: '15', Fortitude: '10', Atletismo: '10', Iniciativa: '5' },
        itens: ['Marreta', 'Colete de kevlar', 'Rádio', 'Bandagem']
      }),
      inventory: INVENTARIO_LONGO,
      backstory: HISTORIA_LONGA,
      pages: campanha('Bento', [
        { titulo: 'Treino', abertura: 'O ginásio fechou às onze e a luz do vestiário ficou acesa.' },
        {
          titulo: 'A ronda',
          abertura: 'Três quarteirões, duas horas, nenhuma ocorrência registrada.',
          detalhes: ['O cachorro da esquina não latiu quando passamos. Ele late para tudo.'],
          fecho: 'Voltamos pelo mesmo caminho e a rua tinha um poste a mais.'
        },
        { titulo: 'Hospital', abertura: 'A enfermeira do turno da noite pediu para não voltarmos.' },
        {
          titulo: 'Depósito',
          abertura: 'A porta de aço cedeu no terceiro golpe.',
          detalhes: ['Lá dentro havia caixas com nosso próprio endereço escrito.'],
          fecho: ''
        }
      ])
    },
    presets: [preset('bento-marreta', 'Marreta (dano)', '🔨', [{ count: 2, sides: 8 }], 4)]
  },
  {
    id: 'clara-dnd-pesada',
    name: 'Clara Vandergrift',
    system: 'D&D 5e',
    notes: {
      characterName: 'Clara Vandergrift',
      sections: [
        secao('Identificação', [
          campo('Classe e nível', 'Bruxa 7'),
          campo('Raça', 'Tiefling'),
          campo('Antecedente', 'Charlatã'),
          campo('Tendência', 'Caótica neutra'),
          campo('Patrono', 'O Insondável')
        ]),
        secao('Atributos', [
          campo('Força', '8', ATRIBUTO_DND),
          campo('Destreza', '14', ATRIBUTO_DND),
          campo('Constituição', '15', ATRIBUTO_DND),
          campo('Inteligência', '12', ATRIBUTO_DND),
          campo('Sabedoria', '10', ATRIBUTO_DND),
          campo('Carisma', '18', ATRIBUTO_DND)
        ]),
        secao('Combate', [
          campo('CA', '14'),
          campo('PV atual', '29'),
          campo('PV máximo', '52'),
          campo('Dados de vida', '7d8'),
          campo('Iniciativa', '+2', BONUS),
          campo('Deslocamento', '9m')
        ]),
        secao('Perícias', [
          campo('Enganação', '+8', BONUS),
          campo('Intimidação', '+8', BONUS),
          campo('Arcanismo', '+4', BONUS),
          campo('Percepção', '+1', BONUS),
          campo('Atuação', ''),
          campo('Furtividade', '')
        ]),
        secao('Magias', [
          campo('Espaços de 4º nível', '2'),
          campo('Invocações', 'Visão do Diabo, Máscara de Muitas Faces'),
          campo('Truques', 'Rajada Mística, Prestidigitação, Toque Gélido'),
          campo('Preparadas', '')
        ])
      ],
      inventory: INVENTARIO_LONGO,
      appearance: APARENCIA_LONGA,
      backstory: HISTORIA_LONGA,
      pages: campanha('Clara', [
        { titulo: 'Taverna do Cordeiro', abertura: 'Vendemos o mapa duas vezes antes do jantar.' },
        {
          titulo: 'Estrada velha',
          abertura: 'O comboio parou porque a ponte não estava mais lá.',
          detalhes: ['O rio também não. Só a marca dele no chão, seca há muito tempo.'],
          fecho: 'Dormimos na carroça, revezando.'
        },
        { titulo: 'Feira', abertura: 'Compramos silêncio de três pessoas e a lealdade de nenhuma.' },
        {
          titulo: 'A torre',
          abertura: 'Sete andares, e o sétimo é o primeiro visto de dentro.',
          detalhes: ['O patrono falou pela primeira vez em dois meses. Disse apenas: "ainda não".'],
          fecho: ''
        }
      ])
    },
    presets: [
      preset('clara-rajada', 'Rajada Mística', '🟣', [{ count: 2, sides: 10 }], 4),
      preset('clara-enganacao', 'Enganação', '🎭', [{ count: 1, sides: 20 }], 8)
    ]
  }
]

/**
 * Os outros doze saem do mesmo molde, variando sistema e conteúdo — escritos por função porque o
 * que interessa aqui é VOLUME e variedade de forma, não quinze biografias à mão.
 */
const MOLDES = [
  { id: 'dario-tormenta', name: 'Dário Sallum', system: 'Tormenta20', papel: 'Bárbaro 6', lugar: 'Ahlen' },
  { id: 'eva-cthulhu', name: 'Eva Kraus', system: 'Call of Cthulhu', papel: 'Antiquária', lugar: 'Boston' },
  { id: 'fabio-vampiro', name: 'Fábio Cordeiro', system: 'Vampiro: A Máscara', papel: 'Ventrue', lugar: 'Centro' },
  { id: 'gil-cyberpunk', name: 'Gil Antunes', system: 'Cyberpunk RED', papel: 'Fixer', lugar: 'Heywood' },
  { id: 'hana-pathfinder', name: 'Hana Okonjo', system: 'Pathfinder 2e', papel: 'Feiticeira 5', lugar: 'Absalom' },
  { id: 'igor-fate', name: 'Igor Peña', system: 'Fate Core', papel: 'Mecânico de nave', lugar: 'Doca 3' },
  { id: 'julia-gurps', name: 'Júlia Sanz', system: 'GURPS', papel: 'Rastreadora', lugar: 'Serra' },
  { id: 'kaue-3det', name: 'Kauê Ribas', system: '3D&T Alpha', papel: 'Piloto', lugar: 'Arena' },
  { id: 'lia-starwars', name: 'Lia Vos', system: 'Star Wars FFG', papel: 'Contrabandista', lugar: 'Tatooine' },
  { id: 'marco-oblivio', name: 'Marco Dutra', system: 'Oblivio', papel: 'Quem Aguenta', lugar: 'Rodovia' },
  { id: 'nilo-kids', name: 'Nilo Prado', system: 'Kids on Bikes', papel: 'Nerd da turma', lugar: 'Bairro' },
  { id: 'olga-ordem', name: 'Olga Petrova', system: 'Ordem Paranormal', papel: 'Especialista', lugar: 'Porto' }
]

for (const molde of MOLDES) {
  TERCEIRA_LEVA.push({
    id: molde.id,
    name: molde.name,
    system: molde.system,
    notes: {
      characterName: molde.name,
      sections: [
        secao('Identificação', [
          campo('Personagem', molde.name),
          campo('Papel', molde.papel),
          campo('Base de operações', molde.lugar),
          campo('Contato', ''),
          campo('Objetivo', 'Terminar o que a última sessão deixou aberto')
        ]),
        secao('Atributos', [
          campo('Corpo', '3'),
          campo('Mente', '4'),
          campo('Reflexo', '2'),
          campo('Vontade', '3'),
          campo('Presença', '2')
        ]),
        secao('Recursos', [
          campo('Vida atual', '12'),
          campo('Vida máxima', '20'),
          campo('Energia atual', ''),
          campo('Energia máxima', '10'),
          campo('Defesa', '13')
        ]),
        secao('Perícias', [
          campo('Perícia principal', '+5', BONUS),
          campo('Perícia secundária', '+3', BONUS),
          campo('Perícia terciária', ''),
          campo('Ofício', ''),
          campo('Idiomas', 'comum, mais um que ninguém confirma')
        ]),
        secao('Equipamento', [
          campo('Mão principal', 'ferramenta do ofício'),
          campo('Mão secundária', ''),
          campo('Corpo', 'roupa de trabalho'),
          campo('Mochila', 'ver inventário')
        ])
      ],
      abilities: `Talento de ${molde.papel.toLowerCase()}: resolve com o que tem à mão, e cobra depois.`,
      inventory: INVENTARIO_LONGO,
      appearance: APARENCIA_LONGA,
      backstory: HISTORIA_LONGA,
      pages: campanha(molde.name, [
        { titulo: `Chegada a ${molde.lugar}`, abertura: `Passamos o dia inteiro em ${molde.lugar} e ninguém quis falar com forasteiro.` },
        {
          titulo: 'O contato',
          abertura: 'A pessoa apareceu, cobrou adiantado e sumiu antes de terminar a frase.',
          detalhes: ['O endereço que ela deu existe. A casa, não.'],
          fecho: 'Ficamos com metade da informação e a conta inteira.'
        },
        {
          titulo: 'A busca',
          abertura: 'Três dias de procura, dois becos sem saída e uma pista que não parecia pista.',
          detalhes: [
            'Anotei tudo o que vimos, na ordem em que vimos, porque na hora nada fazia sentido.',
            'Relendo agora, três coisas fazem.'
          ],
          fecho: 'Amanhã voltamos ao primeiro lugar.'
        },
        { titulo: 'Confronto', abertura: 'Não era para ter virado briga, e virou.' },
        {
          titulo: 'Depois',
          abertura: 'Contamos o que sobrou: pouca coisa, e nenhuma delas era a que fomos buscar.',
          detalhes: ['Combinamos de recomeçar pelo arquivo, que é o único lugar onde ninguém mentiu ainda.'],
          fecho: ''
        }
      ])
    },
    presets: [
      preset(`${molde.id}-teste`, `Teste de ${molde.papel.split(' ')[0]}`, '🎲', [{ count: 2, sides: 20 }], 3, {
        keep: { mode: 'highest', count: 1 }
      }),
      preset(`${molde.id}-dano`, 'Dano da ferramenta', '💥', [{ count: 1, sides: 8 }], 2)
    ]
  })
}

if (process.argv[1] && process.argv[1].endsWith('terceiraLeva.mjs')) {
  const destino = process.argv[2]
  if (!destino) {
    console.error('uso: node scripts/terceiraLeva.mjs <pasta de destino>')
    process.exit(1)
  }
  escreverEmDisco(destino, TERCEIRA_LEVA).then(({ pasta, quantos }) => {
    console.log(`${quantos} personagens escritos em ${pasta}`)
  })
}
