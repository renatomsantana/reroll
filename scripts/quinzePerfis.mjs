/**
 * QUINZE PERSONAGENS, cada um com uma ficha DIFERENTE — o teto do app (`MAX_PROFILES`) em forma de
 * dado de verdade.
 *
 * Serve a duas coisas ao mesmo tempo, e é por isso que mora aqui e não dentro de um teste:
 *
 * 1. `storage/quinzeFichas.test.ts` grava estes quinze pelos repositórios de verdade e confere que
 *    cada um volta com a ficha DELE — isolamento no teto, que é onde ele quebraria;
 * 2. `node scripts/quinzePerfis.mjs <pasta>` escreve a mesma coisa em disco, no formato exato do
 *    `userData`, pra ter quinze personagens prontos pra usar sem preencher nada à mão.
 *
 * As fichas não são quinze cópias com o nome trocado. Cada uma tem as SEÇÕES do sistema dela (é
 * assim que a aba Ficha funciona — ver `SheetSection`), com os nomes que aquele sistema usa, campos
 * que rolam onde o sistema rola, presets do que aquele personagem faz e um diário com o tom da mesa.
 * Ficha de teste toda igual esconde exatamente o defeito que este material existe pra encontrar.
 */

/**
 * Os três tipos de rolagem que a ficha entende (ver `sheetRoll.ts`) — o TIPO, nunca a expressão:
 *
 * - `d20`: o valor é um BÔNUS ("+9" vira 1d20+9), que é como perícia e salvaguarda se escrevem;
 * - `d20-valor`: o valor é um ATRIBUTO de D&D (16 rola 1d20+3, o modificador calculado);
 * - `pool-d20`: o valor é QUANTOS dados rolar ficando com o melhor — a regra de Ordem Paranormal.
 *
 * Escrever um tipo fora dessa lista não quebra nada e é PIOR do que quebrar: `normalizarTipoDeRolagem`
 * descarta o desconhecido na leitura, e o campo volta do disco sem botão de rolar, calado.
 */
export const ATRIBUTO_DND = 'd20-valor'
export const POOL = 'pool-d20'
export const BONUS = 'd20'

export function campo(label, value, roll) {
  const id = `${label}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return roll ? { id, label, value, roll } : { id, label, value }
}

export function secao(title, campos) {
  return { id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, fields: campos }
}

export function pagina(id, dia, titulo, texto) {
  // `createdAt` é fixo e crescente: data inventada na hora faria dois saves iguais nascerem
  // diferentes, e o app mostra essa data na lista de sessões.
  return { id, createdAt: Date.UTC(2026, 7, dia), title: titulo, text: texto }
}

export function preset(id, name, icon, groups, modificador = 0, extras = {}) {
  return {
    id,
    name,
    icon,
    expression: {
      groups,
      modifiers: modificador !== 0 ? [{ type: 'flat', value: modificador }] : [],
      ...extras
    },
    createdAt: 1,
    updatedAt: 1
  }
}

/**
 * Os quinze. A ordem é a de criação: quem abrir o app encontra o primeiro deles aberto.
 *
 * Os dois primeiros são CÓPIA FIEL do que o importador extrai dos PDFs da pasta de fichas do
 * projeto (Ordem Paranormal e Oblivio) — conferido campo a campo contra o arquivo, e não de
 * memória. A primeira versão deste material tinha valor INVENTADO nesses dois (PV 16 onde a ficha
 * diz 45, Vigor 1 onde diz 2), e isso é pior do que não ter exemplo: quem compara a importação de
 * verdade com o "exemplo oficial" conclui que o importador está errado. Os outros treze são de
 * sistemas variados, escritos à mão, e não têm PDF com que bater.
 */
export const QUINZE_PERFIS = [
  {
    id: 'matais-ordem',
    name: 'Matias',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Matias',
      sections: [
        secao('Identificação', [
          campo('Personagem', 'Matias'),
          campo('Jogador', 'Jefferson'),
          campo('Classe', 'Especialista'),
          campo('Origem', 'Agente de Saúde'),
          campo('NEX', '5% · 1 PE/turno')
        ]),
        secao('Atributos', [
          campo('Agilidade', '1', POOL),
          campo('Força', '3', POOL),
          campo('Intelecto', '2', POOL),
          campo('Presença', '4', POOL),
          campo('Vigor', '2', POOL)
        ]),
        secao('Recursos', [
          campo('PV máximo', '45'),
          campo('PE máximo', '12'),
          campo('Sanidade máxima', '15'),
          campo('Defesa', '11'),
          campo('Deslocamento', '9m/6q'),
          campo('DT de rituais', '10')
        ]),
        secao('Proficiências', [campo('Armas simples', 'sim'), campo('Armas táticas', 'sim')])
      ],
      inventory: 'Faca de cozinha, lanterna, kit de primeiros socorros, celular rachado.',
      appearance: 'Magro, jaleco emprestado, olheiras de dois plantões seguidos.',
      backstory: 'Atendeu a vítima que ninguém mais quis atender. Desde então enxerga o que ela via.',
      pages: [pagina('p1', 3, 'Hospital', 'O corredor da ala leste continua frio mesmo com o aquecedor ligado.')]
    },
    presets: [
      preset('matais-faca', 'Ataque com Faca (teste)', '🔪', [{ count: 2, sides: 20 }], 0, {
        keep: { mode: 'highest', count: 1 }
      }),
      preset('matais-dano', 'Ataque com Faca (dano)', '🩸', [{ count: 2, sides: 6 }])
    ]
  },
  {
    id: 'rodrigo-oblivio',
    name: 'Rodrigo Barreto',
    system: 'Oblivio',
    notes: {
      characterName: 'Rodrigo Barreto',
      sections: [
        secao('Identificação', [
          campo('Nome', 'Rodrigo Barreto'),
          campo('Papel', 'Quem Age'),
          campo('Motivação', 'Se Redimir')
        ]),
        secao('Atributos', [
          campo('Carne', '2/10'),
          campo('Força', '1/10'),
          campo('Prontidão', '4/10'),
          campo('Determinação', '1/10'),
          campo('Mente', '2/10')
        ]),
        secao('Aspectos', [
          campo('Coragem', '1/10'),
          campo('Dor', '2/10'),
          campo('Fôlego', '1/10'),
          campo('Proteção', '3/10'),
          campo('Velocidade', '2/10')
        ]),
        secao('Corpo', [
          campo('Torso', '0/5'),
          campo('Braço Direito', '0/3'),
          campo('Braço Esquerdo', '0/3'),
          campo('Perna Direita', '0/3'),
          campo('Perna Esquerda', '0/3')
        ])
      ],
      abilities: 'Voracidade: primeira vez na cena, dobra o dado.\nEstocada: realiza a Ação de Combate duas vezes.',
      appearance: '1,87m, cabelos loiros, cicatriz no antebraço direito.',
      backstory: 'Voltou da estrada sem lembrar dos três dias que faltam no calendário.',
      pages: [pagina('p1', 5, 'A estrada', 'O posto estava aberto às quatro da manhã. Não havia ninguém no balcão.')]
    },
    presets: [preset('rodrigo-lamina', 'Lâmina Curta (dano)', '🗡️', [{ count: 1, sides: 4 }])]
  },
  {
    id: 'elandra-dnd',
    name: 'Elandra Vex',
    system: 'D&D 5e',
    notes: {
      characterName: 'Elandra Vex',
      sections: [
        secao('Identificação', [
          campo('Classe e nível', 'Maga 5'),
          campo('Raça', 'Meio-elfa'),
          campo('Antecedente', 'Sábia'),
          campo('Tendência', 'Neutra e boa')
        ]),
        secao('Atributos', [
          campo('Força', '8', ATRIBUTO_DND),
          campo('Destreza', '14', ATRIBUTO_DND),
          campo('Constituição', '13', ATRIBUTO_DND),
          campo('Inteligência', '18', ATRIBUTO_DND),
          campo('Sabedoria', '12', ATRIBUTO_DND),
          campo('Carisma', '10', ATRIBUTO_DND)
        ]),
        secao('Combate', [campo('CA', '12'), campo('Iniciativa', '+2', BONUS), campo('Deslocamento', '9m')])
      ],
      inventory: 'Grimório, bolsa de componentes, 3 frascos de tinta, 42 PO.',
      appearance: 'Baixa, cabelo preso com um estilete, dedos manchados de tinta.',
      backstory: 'Expulsa da academia por ler o que não devia. Levou o livro junto.',
      pages: [
        pagina('p1', 6, 'Torre de Ilvara', 'A escada continua girando. Marcamos os degraus com giz e o giz sumiu.'),
        pagina('p2', 7, 'Descida', 'Chegamos ao terceiro subsolo. Alguém já esteve aqui, e faz pouco tempo.')
      ]
    },
    presets: [
      preset('elandra-misseis', 'Mísseis Mágicos', '✨', [{ count: 3, sides: 4 }], 3),
      preset('elandra-arcano', 'Teste de Arcanismo', '📘', [{ count: 1, sides: 20 }], 7)
    ]
  },
  {
    id: 'iris-cthulhu',
    name: 'Íris Salgado',
    system: 'Call of Cthulhu',
    notes: {
      characterName: 'Íris Salgado',
      sections: [
        secao('Investigador', [
          campo('Ocupação', 'Jornalista'),
          campo('Idade', '34'),
          campo('Residência', 'Arkham')
        ]),
        secao('Características', [
          campo('FOR', '45'),
          campo('CON', '60'),
          campo('TAM', '55'),
          campo('DES', '70'),
          campo('EDU', '80')
        ]),
        secao('Sanidade', [campo('Sanidade atual', '52'), campo('Máxima', '80'), campo('Pontos de Magia', '11')])
      ],
      abilities: 'Achar 70 · Persuasão 55 · História 60 · Biblioteca 75',
      inventory: 'Máquina fotográfica, caderno, revólver .38, dois bilhetes de trem.',
      backstory: 'Foi cobrir um desaparecimento e voltou com trinta fotos que não revelam.',
      pages: [pagina('p1', 8, 'Arkham', 'A biblioteca fecha às nove, mas a luz do segundo andar fica acesa.')]
    },
    presets: [preset('iris-revolver', 'Revólver .38', '🔫', [{ count: 1, sides: 10 }])]
  },
  {
    id: 'valdo-tormenta',
    name: 'Valdo Pedra-Rubra',
    system: 'Tormenta20',
    notes: {
      characterName: 'Valdo Pedra-Rubra',
      sections: [
        secao('Identificação', [campo('Raça', 'Anão'), campo('Classe', 'Guerreiro 4'), campo('Divindade', 'Khalmyr')]),
        secao('Atributos', [
          campo('Força', '4', ATRIBUTO_DND),
          campo('Destreza', '1', ATRIBUTO_DND),
          campo('Constituição', '3', ATRIBUTO_DND),
          campo('Inteligência', '0', ATRIBUTO_DND),
          campo('Sabedoria', '1', ATRIBUTO_DND),
          campo('Carisma', '-1', ATRIBUTO_DND)
        ]),
        secao('Defesa', [campo('Defesa', '19'), campo('PV', '48'), campo('PM', '4')])
      ],
      inventory: 'Machado de guerra, escudo pesado, 12 T$, barril pequeno de cerveja.',
      backstory: 'Desceu da montanha atrás do irmão. Achou a picareta dele, e mais nada.',
      pages: [pagina('p1', 9, 'Valkaria', 'A guilda paga por escolta até Ahlen. Aceitamos antes de perguntar o motivo.')]
    },
    presets: [preset('valdo-machado', 'Machado de guerra', '🪓', [{ count: 1, sides: 12 }], 4)]
  },
  {
    id: 'nero-vampiro',
    name: 'Nero Bastos',
    system: 'Vampiro: A Máscara',
    notes: {
      characterName: 'Nero Bastos',
      sections: [
        secao('Personagem', [campo('Clã', 'Toreador'), campo('Geração', '11ª'), campo('Predador', 'Sedutor')]),
        secao('Atributos', [campo('Força', '2'), campo('Destreza', '4'), campo('Carisma', '4'), campo('Manipulação', '3')]),
        secao('Vitae', [campo('Fome', '2'), campo('Humanidade', '6'), campo('Vontade', '5')])
      ],
      abilities: 'Presença 3 · Auspícios 2 · Subterfúgio 4',
      appearance: 'Terno de veludo fora de moda, sempre com as mãos frias.',
      backstory: 'Cantava em casa de show nos anos 70. Continua com a mesma voz e o mesmo público.',
      pages: [pagina('p1', 10, 'Elysium', 'O Príncipe não olhou para mim, o que já é uma resposta.')]
    },
    presets: [preset('nero-presenca', 'Presença', '🌹', [{ count: 7, sides: 10 }])]
  },
  {
    id: 'kaya-kids',
    name: 'Kaya Moreira',
    system: 'Kids on Bikes',
    notes: {
      characterName: 'Kaya Moreira',
      sections: [
        secao('Personagem', [campo('Tipo', 'Nova Aluna Misteriosa'), campo('Idade', '11'), campo('Medo', 'Supersticiosa')]),
        secao('Estatísticas', [
          campo('Vigor (Braços)', 'd8'),
          campo('Graça (Corpo)', 'd12'),
          campo('Cérebro', 'd20'),
          campo('Charme', 'd6'),
          campo('Coragem', 'd10')
        ])
      ],
      abilities: 'Bike preta intensa: +1 em testes de Luta.\nDurão: perdeu a rolagem de combate? some +3 ao negativo.',
      inventory: 'Bicicleta preta, walkie-talkie sem par, chave de fenda.',
      pages: [pagina('p1', 11, 'Cidade pequena', 'A ponte velha continua interditada. Vimos luz do outro lado mesmo assim.')]
    },
    presets: [preset('kaya-cerebro', 'Teste de Cérebro', '🧠', [{ count: 1, sides: 20 }])]
  },
  {
    id: 'quinn-cyberpunk',
    name: 'Quinn "Estática"',
    system: 'Cyberpunk RED',
    notes: {
      characterName: 'Quinn "Estática"',
      sections: [
        secao('Papel', [campo('Função', 'Netrunner'), campo('Reputação', '4'), campo('Gangue', 'Sem filiação')]),
        secao('Estatísticas', [campo('INT', '8'), campo('REF', '6'), campo('TEC', '7'), campo('FRIEZA', '5')]),
        secao('Equipamento', [campo('Ciberdeck', 'Arasaka Mk.3'), campo('Blindagem', 'SP11'), campo('Eurodólares', '1.240')])
      ],
      inventory: 'Ciberdeck, dois programas quebra-gelo, pistola leve, inalador.',
      backstory: 'Vendeu o próprio rosto pra pagar o deck. Usa o de outra pessoa desde então.',
      pages: [pagina('p1', 12, 'Night City', 'O prédio da Arasaka trocou o firewall. De novo. Em três dias.')]
    },
    presets: [preset('quinn-interface', 'Interface', '💻', [{ count: 1, sides: 10 }], 8)]
  },
  {
    id: 'thera-pathfinder',
    name: 'Thera Kai',
    system: 'Pathfinder 2e',
    notes: {
      characterName: 'Thera Kai',
      sections: [
        secao('Identificação', [campo('Ancestralidade', 'Élfica'), campo('Classe', 'Ladina 3'), campo('Antecedente', 'Batedora')]),
        secao('Atributos', [
          campo('Força', '+1', ATRIBUTO_DND),
          campo('Destreza', '+4', ATRIBUTO_DND),
          campo('Constituição', '+2', ATRIBUTO_DND),
          campo('Sabedoria', '+2', ATRIBUTO_DND)
        ]),
        secao('Perícias', [campo('Furtividade', '+9', BONUS), campo('Acrobacia', '+9', BONUS), campo('Ladroagem', '+7', BONUS)])
      ],
      inventory: 'Adaga curta, gazua, corda de seda, capa cinza.',
      pages: [pagina('p1', 13, 'Absalom', 'O contrato dizia "recuperar". O objeto tinha o brasão da própria guilda.')]
    },
    presets: [preset('thera-furtiva', 'Ataque furtivo', '🗡️', [{ count: 2, sides: 6 }], 4)]
  },
  {
    id: 'sam-fate',
    name: 'Sam Okonkwo',
    system: 'Fate Core',
    notes: {
      characterName: 'Sam Okonkwo',
      sections: [
        secao('Aspectos', [
          campo('Conceito', 'Piloto de carga que não faz perguntas'),
          campo('Complicação', 'Devo favores demais a gente errada'),
          campo('Aspecto livre', 'A nave é mais teimosa que eu')
        ]),
        secao('Perícias', [campo('Pilotar', '+4'), campo('Enganar', '+3'), campo('Contatos', '+3'), campo('Vontade', '+2')])
      ],
      abilities: 'Manobra evasiva: gasta um ponto de destino pra ignorar a primeira falha por sessão.',
      backstory: 'Nunca perdeu uma carga. Perdeu dois sócios.',
      pages: [pagina('p1', 14, 'Doca 9', 'A carga estava selada, e alguém abriu antes de nós.')]
    },
    presets: [preset('sam-pilotar', 'Pilotar', '🚀', [{ count: 4, sides: 6 }], 4)]
  },
  {
    id: 'greta-gurps',
    name: 'Greta Lindqvist',
    system: 'GURPS',
    notes: {
      characterName: 'Greta Lindqvist',
      sections: [
        secao('Atributos', [campo('ST', '11'), campo('DX', '13'), campo('IQ', '12'), campo('HT', '11')]),
        secao('Vantagens', [campo('Reflexos de Combate', '15 pts'), campo('Sorte', '15 pts')]),
        secao('Perícias', [campo('Rifle', '15', BONUS), campo('Sobrevivência (Ártico)', '13', BONUS)])
      ],
      inventory: 'Rifle de ferrolho, parka, lamparina, rádio de campo.',
      backstory: 'Guia de expedição. A última que guiou voltou com uma pessoa a menos e um caixote a mais.',
      pages: [pagina('p1', 15, 'Base Norte', 'Vinte e dois graus negativos. O gerador aguenta mais duas noites.')]
    },
    presets: [preset('greta-rifle', 'Rifle', '🎯', [{ count: 3, sides: 6 }])]
  },
  {
    id: 'bruno-3det',
    name: 'Bruno Kazama',
    system: '3D&T Alpha',
    notes: {
      characterName: 'Bruno Kazama',
      sections: [
        secao('Características', [
          campo('Força', '3'),
          campo('Habilidade', '4'),
          campo('Resistência', '2'),
          campo('Armadura', '2'),
          campo('Poder de Fogo', '1')
        ]),
        secao('Pontos', [campo('Pontos de Vida', '10'), campo('Pontos de Magia', '10')])
      ],
      abilities: 'Ataque Especial · Aceleração · Torcida',
      backstory: 'Treinou no dojo do avô até o dia em que o dojo virou estacionamento.',
      pages: [pagina('p1', 16, 'Torneio', 'Primeira luta contra o cara da faixa vermelha. Ganhei no terceiro round.')]
    },
    presets: [preset('bruno-especial', 'Ataque Especial', '👊', [{ count: 2, sides: 6 }], 3)]
  },
  {
    id: 'lin-starwars',
    name: 'Lin Sarova',
    system: 'Star Wars FFG',
    notes: {
      characterName: 'Lin Sarova',
      sections: [
        secao('Personagem', [campo('Espécie', 'Twi’lek'), campo('Carreira', 'Contrabandista'), campo('Especialização', 'Pilota')]),
        secao('Características', [campo('Agilidade', '4'), campo('Astúcia', '3'), campo('Vontade', '2'), campo('Presença', '3')]),
        secao('Recursos', [campo('Créditos', '850'), campo('Obrigação', 'Dívida 15'), campo('Nave', 'YT-1300 remendada')])
      ],
      inventory: 'Blaster leve, kit de reparo, dois códigos de atracamento falsos.',
      pages: [pagina('p1', 17, 'Nar Shaddaa', 'O contato não apareceu. O hangar estava pago até de manhã.')]
    },
    presets: [preset('lin-pilotagem', 'Pilotagem', '🛸', [{ count: 4, sides: 12 }])]
  },
  {
    id: 'ana-ordem2',
    name: 'Ana Ferraz',
    system: 'Ordem Paranormal',
    notes: {
      characterName: 'Ana Ferraz',
      sections: [
        secao('Identificação', [campo('Classe', 'Ocultista'), campo('Origem', 'Universitária'), campo('NEX', '25% · 3 PE/turno')]),
        secao('Atributos', [
          campo('Agilidade', '2', POOL),
          campo('Força', '1', POOL),
          campo('Intelecto', '4', POOL),
          campo('Presença', '3', POOL),
          campo('Vigor', '2', POOL)
        ]),
        secao('Rituais', [campo('DT de rituais', '17'), campo('Rituais conhecidos', '5')])
      ],
      inventory: 'Caderno de anotações, giz, sal grosso, isqueiro.',
      backstory: 'Entrou no grupo de estudos errado no primeiro semestre.',
      pages: [pagina('p1', 18, 'Campus', 'A sala 4 do subsolo não está na planta do prédio.')]
    },
    presets: [
      preset('ana-ritual', 'Ritual (teste)', '🕯️', [{ count: 4, sides: 20 }], 0, { keep: { mode: 'highest', count: 1 } })
    ]
  },
  {
    id: 'joca-oblivio2',
    name: 'Joca',
    system: 'Oblivio',
    notes: {
      characterName: 'Joca',
      sections: [
        secao('Identificação', [campo('Papel', 'Quem Sabe'), campo('Motivação', 'Entender')]),
        secao('Atributos', [campo('Carne', '1/10'), campo('Prontidão', '4/10'), campo('Mente', '4/10'), campo('Determinação', '3/10')]),
        secao('Corpo', [campo('Dor', '2/10'), campo('Fôlego', '3/10')])
      ],
      abilities: 'Leitura fria: sabe quando alguém repete uma frase decorada.',
      pages: [pagina('p1', 19, 'Rodoviária', 'Comprei a passagem de volta. O guichê disse que eu já tinha comprado.')]
    },
    presets: [preset('joca-leitura', 'Leitura fria', '👁️', [{ count: 2, sides: 10 }], 2)]
  }
]

/** O `notes.json` completo — os campos que o gerador não escreve ficam no padrão do app. */
export function notesDoPerfil(perfil) {
  return {
    characterName: '',
    attributes: '',
    abilities: '',
    sections: [],
    inventory: '',
    appearance: '',
    backstory: '',
    pages: [],
    currentPage: 0,
    font: '',
    bold: false,
    italic: false,
    underline: false,
    color: '',
    ...perfil.notes
  }
}

/** Escreve os quinze no formato exato do `userData` (`profiles.json` + `profiles/<id>/`). */
export async function escreverEmDisco(pasta, leva = QUINZE_PERFIS) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const profiles = leva.map((perfil, i) => ({
    id: perfil.id,
    name: perfil.name,
    system: perfil.system,
    photo: null,
    createdAt: Date.UTC(2026, 7, 1) + i * 60_000
  }))

  await mkdir(join(pasta, 'profiles'), { recursive: true })
  await writeFile(
    join(pasta, 'profiles.json'),
    JSON.stringify({ profiles, activeId: profiles[0].id }, null, 2),
    'utf-8'
  )

  for (const perfil of leva) {
    const dir = join(pasta, 'profiles', perfil.id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'notes.json'), JSON.stringify(notesDoPerfil(perfil), null, 2), 'utf-8')
    await writeFile(join(dir, 'presets.json'), JSON.stringify(perfil.presets ?? [], null, 2), 'utf-8')
  }

  return { pasta, quantos: leva.length }
}

// `node scripts/quinzePerfis.mjs <pasta>` — escreve e diz onde.
if (process.argv[1] && process.argv[1].endsWith('quinzePerfis.mjs')) {
  const destino = process.argv[2]
  if (!destino) {
    console.error('uso: node scripts/quinzePerfis.mjs <pasta de destino>')
    process.exit(1)
  }
  escreverEmDisco(destino).then(({ pasta, quantos }) => {
    console.log(`${quantos} personagens escritos em ${pasta}`)
  })
}
