import { ATRIBUTO_DND, POOL, BONUS, campo, secao, pagina, preset, escreverEmDisco } from './quinzePerfis.mjs'

/**
 * A SEGUNDA LEVA — mais quinze personagens, e existem por um motivo diferente da primeira.
 *
 * A primeira leva (`quinzePerfis.mjs`) tem ficha CHEIA: serve pra ver o app com conteúdo e pra
 * provar isolamento entre personagens no teto. Esta aqui tem LACUNAS de propósito — perícia sem
 * valor, espaço de ritual vazio, item por escrever, PE atual em branco com o máximo preenchido.
 *
 * É o que o usuário pediu ao ver a importação: "coloca lacunas para TUDO que é preenchível, porque
 * às vezes precisamos preencher no app também mesmo que não tenha, porque é um item novo na
 * sessão". E é o estado REAL de uma ficha no meio de campanha: metade preenchida, metade esperando
 * a próxima sessão.
 *
 * Testar só com ficha cheia esconde metade da tela — a caixa que não cabe o texto, o rótulo que
 * some quando o valor é vazio, a seção que colapsa sem conteúdo. Por isso a segunda leva.
 *
 * `node scripts/segundaLeva.mjs <pasta>` escreve estes quinze no formato do `userData`.
 */
export const SEGUNDA_LEVA = [
  {
    id: 'helena-ordem',
    name: 'Helena Duarte',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Helena Duarte',
      sections: [
        secao('Identificação', [
          campo('Personagem', 'Helena Duarte'),
          campo('Jogador', 'Marina'),
          campo('Classe', 'Combatente'),
          campo('Origem', 'Militar'),
          campo('Trilha', ''),
          campo('NEX', '35% · 4 PE/turno')
        ]),
        secao('Atributos', [
          campo('Agilidade', '3', POOL),
          campo('Força', '4', POOL),
          campo('Intelecto', '1', POOL),
          campo('Presença', '2', POOL),
          campo('Vigor', '3', POOL)
        ]),
        secao('Recursos', [
          campo('PV atual', '22'),
          campo('PV máximo', '58'),
          campo('PE atual', ''),
          campo('PE máximo', '18'),
          campo('Sanidade atual', '9'),
          campo('Sanidade máxima', '20'),
          campo('Defesa', '15'),
          campo('Deslocamento', '9m/6q'),
          campo('DT de rituais', '12')
        ]),
        secao('Perícias', [
          campo('Luta', '10'),
          campo('Fortitude', '5'),
          campo('Percepção', '5'),
          campo('Iniciativa', ''),
          campo('Pontaria', ''),
          campo('Sobrevivência', '')
        ]),
        secao('Rituais', [campo('Ritual 1', ''), campo('Ritual 2', '')]),
        secao('Itens', [
          campo('Item 1', 'Escopeta calibre 12'),
          campo('Item 2', 'Colete balístico'),
          campo('Item 3', '')
        ])
      ],
      inventory: 'Escopeta calibre 12, colete balístico, dois carregadores, lanterna tática.',
      backstory: 'Saiu da corporação depois da noite em que metade do pelotão não voltou.',
      pages: [pagina('p1', 4, 'Ocorrência', 'A casa estava trancada por dentro. A porta abriu sozinha na terceira batida.')]
    },
    presets: [
      preset('helena-escopeta', 'Escopeta (teste)', '🔫', [{ count: 3, sides: 20 }], 0, {
        keep: { mode: 'highest', count: 1 }
      }),
      preset('helena-dano', 'Escopeta (dano)', '💥', [{ count: 4, sides: 6 }], 2)
    ]
  },
  {
    id: 'teo-dnd',
    name: 'Teodoro Braga',
    system: 'D&D 5e',
    notes: {
      characterName: 'Teodoro Braga',
      sections: [
        secao('Identificação', [
          campo('Classe e nível', 'Clérigo 3'),
          campo('Raça', 'Humano'),
          campo('Antecedente', 'Acólito')
        ]),
        secao('Atributos', [
          campo('Força', '12', ATRIBUTO_DND),
          campo('Destreza', '10', ATRIBUTO_DND),
          campo('Constituição', '14', ATRIBUTO_DND),
          campo('Inteligência', '11', ATRIBUTO_DND),
          campo('Sabedoria', '16', ATRIBUTO_DND),
          campo('Carisma', '13', ATRIBUTO_DND)
        ]),
        secao('Combate', [
          campo('CA', '16'),
          campo('PV atual', '11'),
          campo('PV máximo', '24'),
          campo('Iniciativa', '+0', BONUS)
        ]),
        secao('Magias', [
          campo('Espaço de 1º nível', '4'),
          campo('Espaço de 2º nível', '2'),
          campo('Preparadas', '')
        ])
      ],
      inventory: 'Maça, escudo, símbolo sagrado, 3 poções de cura.',
      backstory: 'O templo mandou investigar o milagre. Ele voltou com dúvidas em vez de relatório.',
      pages: [pagina('p1', 8, 'Vilarejo', 'A fonte curou o ferreiro e cegou o filho dele na mesma tarde.')]
    },
    presets: [preset('teo-maca', 'Maça', '🔨', [{ count: 1, sides: 6 }], 1)]
  },
  {
    id: 'ravi-tormenta',
    name: 'Ravi Sétimo',
    system: 'Tormenta20',
    notes: {
      characterName: 'Ravi Sétimo',
      sections: [
        secao('Identificação', [
          campo('Raça', 'Qareen'),
          campo('Classe', 'Arcanista 5'),
          campo('Divindade', 'Wynna')
        ]),
        secao('Atributos', [
          campo('Força', '0'),
          campo('Destreza', '2'),
          campo('Constituição', '1'),
          campo('Inteligência', '4')
        ]),
        secao('Recursos', [
          campo('PV atual', '18'),
          campo('PV máximo', '32'),
          campo('PM atual', ''),
          campo('PM máximo', '19')
        ])
      ],
      abilities: 'Caminho do Mago · Foco: bastão rúnico',
      pages: [pagina('p1', 9, 'Vectora', 'A guilda arcana cobra por consulta. Pagamos em favores, o que sai mais caro.')]
    },
    presets: [preset('ravi-raio', 'Raio Arcano', '⚡', [{ count: 3, sides: 8 }])]
  },
  {
    id: 'noa-cthulhu',
    name: 'Noa Vilar',
    system: 'Call of Cthulhu',
    notes: {
      characterName: 'Noa Vilar',
      sections: [
        secao('Investigador', [
          campo('Ocupação', 'Médica legista'),
          campo('Idade', '41'),
          campo('Residência', 'Providence')
        ]),
        secao('Características', [
          campo('FOR', '50'),
          campo('CON', '65'),
          campo('DES', '55'),
          campo('EDU', '85')
        ]),
        secao('Sanidade', [
          campo('Sanidade atual', '38'),
          campo('Máxima', '85'),
          campo('Pontos de Magia', '')
        ])
      ],
      abilities: 'Medicina 80 · Ciências (Biologia) 65 · Psicologia 45',
      inventory: 'Maleta forense, luvas, caderno, lanterna.',
      pages: [pagina('p1', 10, 'Necrotério', 'O corpo da mesa três tinha marcas que não são de faca nem de dente.')]
    },
    presets: [preset('noa-medicina', 'Medicina', '🩺', [{ count: 1, sides: 100 }])]
  },
  {
    id: 'sol-vampiro',
    name: 'Sol Aranha',
    system: 'Vampiro: A Máscara',
    notes: {
      characterName: 'Sol Aranha',
      sections: [
        secao('Personagem', [
          campo('Clã', 'Nosferatu'),
          campo('Geração', '12ª'),
          campo('Predador', 'Necrófago')
        ]),
        secao('Atributos', [
          campo('Força', '3'),
          campo('Destreza', '3'),
          campo('Raciocínio', '4'),
          campo('Manipulação', '1')
        ]),
        secao('Vitae', [
          campo('Fome', '4'),
          campo('Humanidade', '4'),
          campo('Vontade atual', ''),
          campo('Vontade máxima', '6')
        ])
      ],
      abilities: 'Ofuscação 4 · Potência 2 · Animalismo 1',
      pages: [pagina('p1', 11, 'Esgoto', 'O território novo tem três saídas. Duas dão no rio.')]
    },
    presets: [preset('sol-ofuscacao', 'Ofuscação', '🕸️', [{ count: 8, sides: 10 }])]
  },
  {
    id: 'dan-kids',
    name: 'Dandara Melo',
    system: 'Kids on Bikes',
    notes: {
      characterName: 'Dandara Melo',
      sections: [
        secao('Personagem', [campo('Tipo', 'Atleta Popular'), campo('Idade', '13'), campo('Medo', '')]),
        secao('Estatísticas', [
          campo('Vigor (Braços)', 'd20'),
          campo('Graça (Corpo)', 'd12'),
          campo('Cérebro', 'd6'),
          campo('Charme', 'd10'),
          campo('Coragem', 'd8')
        ])
      ],
      inventory: 'Bicicleta laranja, taco de beisebol, rádio.',
      pages: [pagina('p1', 12, 'Escola', 'O ginásio ficou aberto depois do treino. As luzes apagaram sozinhas.')]
    },
    presets: [preset('dan-vigor', 'Teste de Vigor', '💪', [{ count: 1, sides: 20 }])]
  },
  {
    id: 'iko-cyberpunk',
    name: 'Iko Tanaka',
    system: 'Cyberpunk RED',
    notes: {
      characterName: 'Iko Tanaka',
      sections: [
        secao('Papel', [campo('Função', 'Solo'), campo('Reputação', '6'), campo('Gangue', 'Ex-Militech')]),
        secao('Estatísticas', [campo('REF', '8'), campo('CORPO', '7'), campo('FRIEZA', '8'), campo('TEC', '4')]),
        secao('Equipamento', [
          campo('Arma', 'Fuzil de assalto'),
          campo('Blindagem', 'SP15'),
          campo('Eurodólares', '')
        ])
      ],
      backstory: 'Contrato encerrado por escrito. A empresa não concorda com o "encerrado".',
      pages: [pagina('p1', 13, 'Watson', 'A entrega era pra ser em dois minutos. Levou quarenta e uma balas.')]
    },
    presets: [preset('iko-fuzil', 'Fuzil (dano)', '🔫', [{ count: 5, sides: 6 }])]
  },
  {
    id: 'pilar-pathfinder',
    name: 'Pilar do Norte',
    system: 'Pathfinder 2e',
    notes: {
      characterName: 'Pilar do Norte',
      sections: [
        secao('Identificação', [
          campo('Ancestralidade', 'Anã'),
          campo('Classe', 'Clériga 4'),
          campo('Divindade', 'Torag')
        ]),
        secao('Atributos', [
          campo('Força', '+2', ATRIBUTO_DND),
          campo('Constituição', '+3', ATRIBUTO_DND),
          campo('Sabedoria', '+4', ATRIBUTO_DND)
        ]),
        secao('Perícias', [
          campo('Religião', '+10', BONUS),
          campo('Medicina', '+8', BONUS),
          campo('Diplomacia', '')
        ])
      ],
      pages: [pagina('p1', 14, 'Forja', 'O martelo do templo trincou sozinho durante a prece da manhã.')]
    },
    presets: [preset('pilar-cura', 'Curar Ferimentos', '✨', [{ count: 2, sides: 8 }], 4)]
  },
  {
    id: 'brenno-fate',
    name: 'Brenno Sá',
    system: 'Fate Core',
    notes: {
      characterName: 'Brenno Sá',
      sections: [
        secao('Aspectos', [
          campo('Conceito', 'Detetive que não desiste'),
          campo('Complicação', 'Devo a verdade a quem menos merece'),
          campo('Aspecto livre', '')
        ]),
        secao('Perícias', [
          campo('Investigar', '+4'),
          campo('Vontade', '+3'),
          campo('Provocar', '+2'),
          campo('Atirar', '')
        ])
      ],
      pages: [pagina('p1', 15, 'Arquivo', 'O processo sumiu do sistema, mas a cópia em papel continua na caixa 12.')]
    },
    presets: [preset('brenno-investigar', 'Investigar', '🔎', [{ count: 4, sides: 6 }], 4)]
  },
  {
    id: 'edda-gurps',
    name: 'Edda Ristow',
    system: 'GURPS',
    notes: {
      characterName: 'Edda Ristow',
      sections: [
        secao('Atributos', [campo('ST', '10'), campo('DX', '14'), campo('IQ', '13'), campo('HT', '12')]),
        secao('Pontos', [
          campo('PV atual', '7'),
          campo('PV máximo', '10'),
          campo('Fadiga atual', ''),
          campo('Fadiga máxima', '12')
        ]),
        secao('Perícias', [
          campo('Arquearia', '16', BONUS),
          campo('Furtividade', '14', BONUS),
          campo('Diagnose', '')
        ])
      ],
      pages: [pagina('p1', 16, 'Fronteira', 'A trilha do norte está fechada por neve. O contrabandista cobra o dobro.')]
    },
    presets: [preset('edda-arco', 'Arco', '🏹', [{ count: 3, sides: 6 }], 1)]
  },
  {
    id: 'zeca-3det',
    name: 'Zeca Furtado',
    system: '3D&T Alpha',
    notes: {
      characterName: 'Zeca Furtado',
      sections: [
        secao('Características', [
          campo('Força', '2'),
          campo('Habilidade', '5'),
          campo('Resistência', '3'),
          campo('Armadura', '1'),
          campo('Poder de Fogo', '0')
        ]),
        secao('Pontos', [
          campo('PV atual', '9'),
          campo('PV máximo', '15'),
          campo('PM atual', ''),
          campo('PM máximo', '15')
        ])
      ],
      abilities: 'Esquiva Fantástica · Reflexos',
      pages: [pagina('p1', 17, 'Torneio', 'Perdi de propósito pra ver quem apostava contra.')]
    },
    presets: [preset('zeca-esquiva', 'Esquiva', '🌀', [{ count: 1, sides: 6 }], 5)]
  },
  {
    id: 'vera-starwars',
    name: 'Vera Ohan',
    system: 'Star Wars FFG',
    notes: {
      characterName: 'Vera Ohan',
      sections: [
        secao('Personagem', [
          campo('Espécie', 'Humana'),
          campo('Carreira', 'Guardiã'),
          campo('Especialização', 'Protetora')
        ]),
        secao('Características', [
          campo('Vigor', '3'),
          campo('Perícia', '3'),
          campo('Vontade', '4'),
          campo('Presença', '2')
        ]),
        secao('Recursos', [
          campo('Ferimentos', '6/14'),
          campo('Tensão', '2/12'),
          campo('Créditos', '')
        ])
      ],
      pages: [pagina('p1', 18, 'Lothal', 'A patrulha imperial passou duas vezes na mesma rua em dez minutos.')]
    },
    presets: [preset('vera-sabre', 'Sabre de luz', '⚔️', [{ count: 3, sides: 12 }])]
  },
  {
    id: 'tuca-oblivio',
    name: 'Tuca',
    system: 'Oblivio',
    notes: {
      characterName: 'Tuca',
      sections: [
        secao('Identificação', [campo('Papel', 'Quem Cuida'), campo('Motivação', 'Proteger')]),
        secao('Atributos', [
          campo('Carne', '3/10'),
          campo('Força', '2/10'),
          campo('Prontidão', '2/10'),
          campo('Determinação', '4/10'),
          campo('Mente', '1/10')
        ]),
        secao('Aspectos', [
          campo('Coragem', '3/10'),
          campo('Dor', '2/10'),
          campo('Fôlego', '3/10'),
          campo('Proteção', '2/10'),
          campo('Velocidade', '1/10')
        ]),
        secao('Corpo', [
          campo('Torso', '2/5'),
          campo('Braço Direito', '0/3'),
          campo('Braço Esquerdo', '1/3'),
          campo('Perna Direita', '0/3'),
          campo('Perna Esquerda', '0/3')
        ]),
        secao('Equipamento', [campo('Torso', 'Jaqueta grossa'), campo('Braço Direito', '')])
      ],
      inventory: 'Jaqueta grossa — 1 espaço / Limite de Estresse 4.',
      pages: [pagina('p1', 19, 'Abrigo', 'Dividimos a última lata. Sobrou pergunta pra amanhã.')]
    },
    presets: [preset('tuca-soco', 'Ataque desarmado', '👊', [{ count: 1, sides: 4 }])]
  },
  {
    id: 'nadia-ordem2',
    name: 'Nádia Prado',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Nádia Prado',
      sections: [
        secao('Identificação', [
          campo('Classe', 'Especialista'),
          campo('Origem', 'Investigadora'),
          campo('NEX', '15% · 2 PE/turno')
        ]),
        secao('Atributos', [
          campo('Agilidade', '2', POOL),
          campo('Força', '1', POOL),
          campo('Intelecto', '3', POOL),
          campo('Presença', '3', POOL),
          campo('Vigor', '2', POOL)
        ]),
        secao('Recursos', [
          campo('PV atual', '14'),
          campo('PV máximo', '26'),
          campo('PE atual', '4'),
          campo('PE máximo', '8'),
          campo('Sanidade atual', ''),
          campo('Sanidade máxima', '16')
        ]),
        secao('Perícias', [
          campo('Investigação', '10'),
          campo('Percepção', '5'),
          campo('Crime', ''),
          campo('Intuição', '')
        ])
      ],
      pages: [pagina('p1', 20, 'Delegacia', 'O arquivo do caso 88 está com uma página a menos que o índice diz.')]
    },
    presets: [
      preset('nadia-investiga', 'Investigação', '🔍', [{ count: 3, sides: 20 }], 0, {
        keep: { mode: 'highest', count: 1 }
      })
    ]
  },
  {
    id: 'ori-fate2',
    name: 'Ori Nakamura',
    system: 'Fate Core',
    notes: {
      characterName: 'Ori Nakamura',
      sections: [
        secao('Aspectos', [
          campo('Conceito', 'Arqueóloga com dívidas'),
          campo('Complicação', 'Nunca deixo o achado para trás'),
          campo('Aspecto livre', '')
        ]),
        secao('Perícias', [
          campo('Conhecimento', '+4'),
          campo('Atletismo', '+3'),
          campo('Recursos', '+1'),
          campo('Contatos', '')
        ])
      ],
      inventory: 'Caderno de campo, pá dobrável, lanterna, corda.',
      pages: [pagina('p1', 21, 'Escavação', 'O sítio tem uma câmara a mais do que a planta do século passado registrava.')]
    },
    presets: [preset('ori-conhecimento', 'Conhecimento', '📖', [{ count: 4, sides: 6 }], 4)]
  }
]

if (process.argv[1] && process.argv[1].endsWith('segundaLeva.mjs')) {
  const destino = process.argv[2]
  if (!destino) {
    console.error('uso: node scripts/segundaLeva.mjs <pasta de destino>')
    process.exit(1)
  }
  escreverEmDisco(destino, SEGUNDA_LEVA).then(({ pasta, quantos }) => {
    console.log(`${quantos} personagens escritos em ${pasta}`)
  })
}
