import type { FichaDeTeste } from './corpusDePdfs'
import { pdfDeUmaPagina, widget } from './pdfDeMentira'

/**
 * A SÉTIMA LEVA: quinze fichas fabricadas de QUINZE SISTEMAS que o app nunca viu — pedido do
 * usuário ("continua testando com mais sistemas, cria novas 15 fichas").
 *
 * Nenhum destes sistemas tem leitor dedicado, e é esse o ponto: tudo aqui cai no leitor GENÉRICO,
 * que é o que atende a ficha que ninguém previu. Cada sistema escreve os números de um jeito — dado
 * por atributo (Savage Worlds), porcentagem (Cthulhu), bolinhas (Vampiro), escada de adjetivos
 * (Fate), "2d-1" (GURPS), relógio "3/9" (Blades), THAC0 descendente (OSR), pools (Shadowrun,
 * Numenera), bônus negativo (Monster of the Week) — e o genérico tem que devolver campos legíveis
 * e presets SÓ onde há notação de dado de verdade, sem inventar nada no resto.
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/**
 * Formulário simples: um widget por linha com o rótulo impresso ao lado — a diagramação de sempre.
 * A caixa começa a 180, e não mais longe: o rótulo é medido do CENTRO dele até a BORDA da caixa
 * (ver `distanciaDoRotulo`), e com a caixa a 220 a distância passava do teto de 70pt — o rótulo
 * impresso não casava e o campo ficava com o nome interno, que foi exatamente a primeira falha
 * desta leva ao rodar.
 */
function formulario(campos: [string, string][]): { widgets: string[]; linhas: ReturnType<typeof linha>[] } {
  const widgets: string[] = []
  const linhas: ReturnType<typeof linha>[] = []
  campos.forEach(([nome, valor], i) => {
    const y = 740 - i * 26
    widgets.push(widget(nome, valor, `[180 ${y} 340 ${y + 18}]`))
    linhas.push(linha(nome.toUpperCase(), y + 3, 100))
  })
  return { widgets, linhas }
}

export const SETIMA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '39-savage-worlds-formulario.pdf',
    proposito: 'Savage Worlds: cada atributo é um DADO ("d8") — vira campo e vira preset, sem conhecer o sistema',
    espera: {
      leitor: 'generico',
      nome: 'Hank Barlow',
      minimoDeCampos: 8,
      minimoDePresets: 4,
      campos: [
        { label: 'AGILITY', value: 'd8' },
        { label: 'PARRY', value: '7' }
      ]
    },
    bytes: () => {
      const f = formulario([
        ['Name', 'Hank Barlow'],
        ['Agility', 'd8'],
        ['Smarts', 'd6'],
        ['Spirit', 'd8'],
        ['Strength', 'd10'],
        ['Vigor', 'd6'],
        ['Shooting', 'd10'],
        ['Pace', '6'],
        ['Parry', '7'],
        ['Toughness', '9']
      ])
      return pdfDeUmaPagina(f)
    }
  },
  {
    arquivo: '40-cthulhu-formulario.pdf',
    proposito: 'Chamado de Cthulhu em FORMULÁRIO: características e perícias em porcentagem — campos limpos, nenhum preset inventado',
    espera: {
      leitor: 'generico',
      nome: 'Aldo Peixoto',
      minimoDeCampos: 10,
      campos: [
        { label: 'SANIDADE', value: '55' },
        { label: 'ESCUTAR', value: '40' }
      ]
    },
    bytes: () => {
      const f = formulario([
        ['Nome', 'Aldo Peixoto'],
        ['Ocupacao', 'Jornalista'],
        ['FOR', '45'],
        ['DES', '60'],
        ['INT', '75'],
        ['POD', '50'],
        ['EDU', '80'],
        ['Sanidade', '55'],
        ['Sorte', '65'],
        ['Escutar', '40'],
        ['Ocultismo', '25'],
        ['Psicologia', '60']
      ])
      return pdfDeUmaPagina(f)
    }
  },
  {
    arquivo: '41-vampiro-v5-datilografada.pdf',
    proposito: 'Vampiro (V5) datilografado: atributo em BOLINHAS ("•••") atravessa como está escrito',
    /**
     * As bolinhas são `\x95` — o bullet do WinAnsi, que é o que uma fonte de PDF sem embutir sabe
     * mostrar. O `●` (U+25CF) nem existe em latin1: escrito cru no fluxo, virava "ÏÏÏ" na leitura,
     * e a primeira rodada desta leva pegou exatamente isso. O que o teste cobra é que a BOLINHA que
     * o arquivo tem chegue como bolinha, não que o app adivinhe pontos de vampiro.
     */
    espera: {
      leitor: 'generico',
      nome: 'Marta Leão',
      minimoDeCampos: 6,
      campos: [
        { label: 'Força', value: '•••' },
        { label: 'Manipulação', value: '••••' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('VAMPIRO — A MÁSCARA', 770),
          linha('Nome: Marta Leão', 745),
          linha('Clã: Toreador', 730),
          linha('Geração: 12ª', 715),
          linha('Força: \x95\x95\x95', 690),
          linha('Destreza: \x95\x95', 675),
          linha('Manipulação: \x95\x95\x95\x95', 660),
          linha('Autocontrole: \x95\x95\x95', 645),
          linha('Fome: 2', 620),
          linha('Humanidade: 7', 605)
        ]
      })
  },
  {
    arquivo: '42-fate-datilografada.pdf',
    proposito: 'Fate: abordagens com bônus ("+2") viram campos; os aspectos, que são frases, ficam de fora dos campos',
    espera: {
      leitor: 'generico',
      nome: 'Ivo Salles',
      minimoDeCampos: 6,
      campos: [
        { label: 'Ágil', value: '+2' },
        { label: 'Sorrateiro', value: '+1' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('FATE ACELERADO', 770),
          linha('Nome: Ivo Salles', 745),
          linha('Conceito: Detetive amaldiçoado de Salvador', 730),
          linha('Ágil: +2', 700),
          linha('Cuidadoso: +1', 685),
          linha('Esperto: +2', 670),
          linha('Chamativo: +0', 655),
          linha('Poderoso: +1', 640),
          linha('Sorrateiro: +1', 625),
          linha('Recarga: 3', 600),
          linha('Aspecto: Sempre chego cinco minutos atrasado, e isso já salvou minha vida.', 570)
        ]
      })
  },
  {
    arquivo: '43-gurps-formulario.pdf',
    proposito: 'GURPS: "2d-1" NÃO é notação que o app rola — o campo entra como está escrito e nenhum preset torto nasce dele',
    espera: {
      leitor: 'generico',
      nome: 'Olga Brandt',
      minimoDeCampos: 6,
      campos: [
        { label: 'DAMAGE', value: '2d-1' },
        { label: 'BASIC SPEED', value: '6.25' }
      ]
    },
    bytes: () => {
      const f = formulario([
        ['Name', 'Olga Brandt'],
        ['ST', '11'],
        ['DX', '13'],
        ['IQ', '14'],
        ['HT', '10'],
        ['Damage', '2d-1'],
        ['Basic Speed', '6.25'],
        ['Dodge', '9']
      ])
      return pdfDeUmaPagina(f)
    }
  },
  {
    arquivo: '44-cyberpunk-red-datilografada.pdf',
    proposito: 'Cyberpunk RED: a arma com "3d6" escrito vira preset; os STATS numéricos ficam como campos',
    espera: {
      leitor: 'generico',
      nome: 'Rocco Lima',
      minimoDeCampos: 6,
      minimoDePresets: 1,
      campos: [{ label: 'REF', value: '8' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('CYBERPUNK RED', 770),
          linha('Nome: Rocco Lima', 745),
          linha('Papel: Solo', 730),
          linha('REF: 8', 700),
          linha('COOL: 6', 685),
          linha('TECH: 5', 670),
          linha('BODY: 7', 655),
          linha('HP: 40', 640),
          linha('Armas', 610),
          linha('Pistola pesada 3d6', 595),
          linha('Faca 1d6', 580)
        ]
      })
  },
  {
    arquivo: '45-blades-in-the-dark-datilografada.pdf',
    proposito: 'Blades in the Dark: ações em pontos e o relógio de estresse "3/9" atravessam como estão',
    espera: {
      leitor: 'generico',
      nome: 'Nadia Kess',
      minimoDeCampos: 6,
      campos: [
        { label: 'Stress', value: '3/9' },
        { label: 'Prowl', value: '2' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('BLADES IN THE DARK', 770),
          linha('Nome: Nadia Kess', 745),
          linha('Playbook: Lurk', 730),
          linha('Prowl: 2', 700),
          linha('Skirmish: 1', 685),
          linha('Finesse: 2', 670),
          linha('Hunt: 1', 655),
          linha('Stress: 3/9', 630),
          linha('Trauma: 1', 615)
        ]
      })
  },
  {
    arquivo: '46-tormenta20-modelo-em-branco.pdf',
    proposito: 'modelo em branco de Tormenta20: o leitor dedicado o reconhece pelos nomes de campo, e ainda assim instruções de fábrica não são resposta nem o arquivo vira nome de ninguém',
    espera: { leitor: 'tormenta20', nome: '', maximoDeCampos: 0, avisos: ['formulario-vazio'] },
    bytes: () => {
      const f = formulario([
        ['Nome', ''],
        ['Raça', 'Escolha uma raça'],
        ['Classe', 'Escolha uma classe'],
        ['Força', ''],
        ['Destreza', ''],
        ['PV', ''],
        ['PM', '']
      ])
      return pdfDeUmaPagina(f)
    }
  },
  {
    arquivo: '47-daggerheart-datilografada.pdf',
    proposito: 'Daggerheart: os dados de dualidade escritos ("2d12") viram preset, e Esperança/Medo ficam como campos',
    espera: {
      leitor: 'generico',
      nome: 'Wren Aveleda',
      minimoDeCampos: 5,
      minimoDePresets: 1,
      campos: [{ label: 'Esperança', value: '2' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('DAGGERHEART', 770),
          linha('Nome: Wren Aveleda', 745),
          linha('Classe: Guardiã', 730),
          linha('Agilidade: +1', 700),
          linha('Instinto: +2', 685),
          linha('Esperança: 2', 660),
          linha('Armas', 630),
          linha('Lâmina dupla 2d12', 615)
        ]
      })
  },
  {
    arquivo: '48-osr-bx-datilografada.pdf',
    proposito: 'OSR (B/X): THAC0, CA descendente e dado de vida — números velhos de quarenta anos entram como campos',
    espera: {
      leitor: 'generico',
      nome: 'Padre Cosme',
      minimoDeCampos: 5,
      campos: [
        { label: 'THAC0', value: '19' },
        { label: 'CA', value: '4' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('AVENTURAS FANTÁSTICAS', 770),
          linha('Nome: Padre Cosme', 745),
          linha('Classe: Clérigo', 730),
          linha('Nível: 3', 715),
          linha('CA: 4', 690),
          linha('THAC0: 19', 675),
          linha('PV: 14', 660),
          linha('Sabedoria: 16', 645)
        ]
      })
  },
  {
    arquivo: '49-mutants-masterminds-formulario.pdf',
    proposito: 'Mutants & Masterminds: bônus altos ("+12") são campos, não rolagens inventadas',
    espera: {
      leitor: 'generico',
      nome: 'Pulsar',
      minimoDeCampos: 5,
      campos: [{ label: 'FIGHTING', value: '+12' }]
    },
    bytes: () => {
      const f = formulario([
        ['Name', 'Pulsar'],
        ['PL', '10'],
        ['Strength', '+8'],
        ['Fighting', '+12'],
        ['Toughness', '+10'],
        ['Will', '+7']
      ])
      return pdfDeUmaPagina(f)
    }
  },
  {
    arquivo: '50-numenera-datilografada.pdf',
    proposito: 'Numenera: reservas (Might/Speed/Intellect) com Edge — pares numéricos simples, sem preset nenhum',
    espera: {
      leitor: 'generico',
      nome: 'Sefira',
      minimoDeCampos: 6,
      campos: [
        { label: 'Might', value: '12' },
        { label: 'Might Edge', value: '1' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('NUMENERA', 770),
          linha('Nome: Sefira', 745),
          linha('Tipo: Nano', 730),
          linha('Might: 12', 700),
          linha('Might Edge: 1', 685),
          linha('Speed: 10', 670),
          linha('Speed Edge: 0', 655),
          linha('Intellect: 16', 640),
          linha('Intellect Edge: 2', 625)
        ]
      })
  },
  {
    arquivo: '51-monster-of-the-week-datilografada.pdf',
    proposito: 'Monster of the Week: o bônus NEGATIVO ("-1") é valor de ficha como qualquer outro',
    espera: {
      leitor: 'generico',
      nome: 'Billy Rocha',
      minimoDeCampos: 5,
      campos: [
        { label: 'Charme', value: '-1' },
        { label: 'Durão', value: '+2' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('MONSTER OF THE WEEK', 770),
          linha('Nome: Billy Rocha', 745),
          linha('Arquétipo: O Durão', 730),
          linha('Durão: +2', 700),
          linha('Charme: -1', 685),
          linha('Esquisito: +1', 670),
          linha('Afiado: 0', 655),
          linha('Sorte restante: 5', 630)
        ]
      })
  },
  {
    arquivo: '52-ficha-em-espanhol.pdf',
    proposito: 'ficha em ESPANHOL: "Nombre:" também é campo de nome — o vizinho de idioma não pode cair no nome do arquivo',
    espera: {
      leitor: 'generico',
      nome: 'Paco Ibáñez',
      minimoDeCampos: 5,
      campos: [{ label: 'Fuerza', value: '15' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('HOJA DE PERSONAJE', 770),
          linha('Nombre: Paco Ibáñez', 745),
          linha('Clase: Explorador', 730),
          linha('Fuerza: 15', 700),
          linha('Destreza: 13', 685),
          linha('Carisma: 12', 670),
          linha('Puntos de golpe: 22', 655)
        ]
      })
  },
  {
    arquivo: '53-shadowrun-datilografada.pdf',
    proposito: 'Shadowrun: pools numéricos são campos; a iniciativa com "3d6" no meio rende o preset do dado, não do número solto',
    espera: {
      leitor: 'generico',
      nome: 'Vex',
      minimoDeCampos: 6,
      minimoDePresets: 1,
      campos: [{ label: 'Armas de Fogo', value: '12' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('SHADOWRUN', 770),
          linha('Nome: Vex', 745),
          linha('Metatipo: Elfa', 730),
          linha('Corpo: 5', 700),
          linha('Agilidade: 6', 685),
          linha('Armas de Fogo: 12', 670),
          linha('Furtividade: 9', 655),
          linha('Iniciativa: 9 + 3d6', 630)
        ]
      })
  },
  {
    arquivo: '54-troika-datilografada.pdf',
    proposito: 'Troika!: Vigor/Sorte/Habilidade e a arma com "1d6+2" — o formato britânico esquisito também rende',
    espera: {
      leitor: 'generico',
      nome: 'Ermelinda',
      minimoDeCampos: 4,
      minimoDePresets: 1,
      campos: [{ label: 'Sorte', value: '9' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('TROIKA!', 770),
          linha('Nome: Ermelinda', 745),
          linha('Antecedente: Apicultora do Vazio', 730),
          linha('Habilidade: 6', 700),
          linha('Vigor: 18', 685),
          linha('Sorte: 9', 670),
          linha('Espada enferrujada 1d6+2', 640)
        ]
      })
  },
  {
    arquivo: '55-cairn-datilografada.pdf',
    proposito: 'Cairn: três atributos e proteção — a ficha minimalista rende pouco, e o pouco sai certo',
    espera: {
      leitor: 'generico',
      nome: 'Otto Vidal',
      minimoDeCampos: 4,
      campos: [
        { label: 'FOR', value: '12' },
        { label: 'Proteção', value: '1' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('CAIRN', 770),
          linha('Nome: Otto Vidal', 745),
          linha('FOR: 12', 715),
          linha('DES: 9', 700),
          linha('VON: 14', 685),
          linha('PV: 5', 670),
          linha('Proteção: 1', 655)
        ]
      })
  }
]
