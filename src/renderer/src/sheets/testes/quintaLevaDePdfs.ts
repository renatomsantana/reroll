import type { FichaDeTeste } from './corpusDePdfs'
import { pdfDeUmaPagina, pdfDeVariasPaginas, widget } from './pdfDeMentira'

/**
 * A QUINTA LEVA: mais quinze PDFs fabricados, cobrindo o que o corpus dos quinze primeiros não
 * cobre — pedido do usuário ("continua os testes, manda mais novos 15 pdfs").
 *
 * O primeiro corpus provou os caminhos (formulário, texto, arte, modelo em branco, tetos de texto).
 * Este prova o que o beta acrescentou e o que o spec de importação cobra como adversarial:
 * ficha de Ordem em DUAS páginas com ritual e item preenchidos (a lacuna e o valor no mesmo campo),
 * só os valores ATUAIS preenchidos, D&D de nível alto com duas armas e conjuração, D&D em branco,
 * Oblívio com dois equipamentos, sistemas que ninguém cadastrou (Cthulhu, Tormenta), campos de
 * escolha e de rádio, valor com espaço e quebra de linha, 101 páginas, 5.001 campos, JavaScript
 * embutido, `xref` apontando pro lugar errado e arquivo cortado no meio do download.
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/** Os cinco atributos de Ordem Paranormal, com o rótulo impresso ao lado (igual ao corpus). */
function atributosDeOrdem(valores: [string, string][]): { widgets: string[]; linhas: ReturnType<typeof linha>[] } {
  const nomes: Record<string, string> = { AGI: 'AGILIDADE', FOR: 'FORÇA', INT: 'INTELECTO', PRE: 'PRESENÇA', VIG: 'VIGOR' }
  const widgets: string[] = []
  const linhas: ReturnType<typeof linha>[] = []
  valores.forEach(([nome, valor], i) => {
    const y = 700 - i * 30
    widgets.push(widget(nome, valor, `[200 ${y} 240 ${y + 20}]`))
    linhas.push(linha(nomes[nome] ?? nome, y + 4))
  })
  return { widgets, linhas }
}

/** Um widget de TEXTO numa grade simples: linha `i` da coluna `x`. */
function campoNaGrade(nome: string, valor: string, i: number, x = 200): string {
  const y = 700 - i * 22
  return widget(nome, valor, `[${x} ${y} ${x + 120} ${y + 18}]`)
}

/** Troca o `startxref` por um deslocamento errado — a tabela fica onde não está. */
function comXrefErrado(bytes: Uint8Array): Uint8Array {
  const texto = Buffer.from(bytes).toString('latin1')
  const quebrado = texto.replace(/startxref\n\d+\n/, 'startxref\n12\n')
  return new Uint8Array(Buffer.from(quebrado, 'latin1'))
}

export const QUINTA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '16-ordem-duas-paginas-rituais-e-itens.pdf',
    proposito: 'Ordem em duas páginas: ritual e item preenchidos entram UMA vez, com o nome da lacuna, e a numeração dos itens continua na página 2',
    espera: {
      leitor: 'ordem-paranormal',
      nome: 'Dorival Antunes',
      minimoDeCampos: 16,
      minimoDePresets: 1,
      campos: [
        { label: 'PV atual', value: '19' },
        { label: 'PV máximo', value: '32' },
        { label: 'PE atual', value: '4' },
        { label: 'Sanidade máxima', value: '20' },
        { label: 'Ritual 1', value: 'Enfeitiçar', group: 'Rituais' },
        { label: 'Ritual 2', value: '', group: 'Rituais' },
        { label: 'Item 1', value: 'Lanterna', group: 'Itens' },
        { label: 'Item 3', value: '', group: 'Itens' },
        { label: 'Item 4', value: 'Corda', group: 'Itens' }
      ],
      semRotulo: /^(RITUAIS|ITEM) /
    },
    bytes: () => {
      const atributos = atributosDeOrdem([
        ['AGI', '3'],
        ['FOR', '1'],
        ['INT', '2'],
        ['PRE', '2'],
        ['VIG', '2']
      ])
      return pdfDeVariasPaginas([
        {
          widgets: [
            widget('Personagem', 'Dorival Antunes', '[100 760 300 780]'),
            widget('Jogador', 'Nádia', '[320 760 500 780]'),
            ...atributos.widgets,
            widget('PV', '32', '[400 700 440 720]'),
            widget('pvat', '19', '[450 700 490 720]'),
            widget('PE', '9', '[400 670 440 690]'),
            widget('peat', '4', '[450 670 490 690]'),
            widget('SAN', '20', '[400 640 440 660]'),
            widget('sanat', '12', '[450 640 490 660]'),
            widget('Def', '14', '[400 610 440 630]'),
            widget('Atq1.0.0.0.0', 'Pistola', '[100 500 250 520]'),
            widget('Atq1.0.0.0.1', '3d20', '[260 500 320 520]'),
            widget('Atq1.0.0.0.2', '2d8', '[330 500 400 520]'),
            widget('RITUAIS 1', 'Enfeitiçar', '[100 440 300 460]'),
            widget('RITUAIS 2', '', '[100 415 300 435]'),
            widget('RITUAIS 3', '', '[100 390 300 410]'),
            widget('ITEM 1', 'Lanterna', '[350 440 500 460]'),
            widget('ITEM 2', 'Kit médico', '[350 415 500 435]'),
            widget('ITEM 3', '', '[350 390 500 410]')
          ],
          linhas: [linha('PERSONAGEM', 764, 100), ...atributos.linhas, linha('RITUAIS', 470, 100), linha('INVENTÁRIO', 470, 350)]
        },
        {
          widgets: [widget('ITEM 1_2', 'Corda', '[100 700 250 720]'), widget('ITEM 2_2', '', '[100 675 250 695]')],
          linhas: [linha('INVENTÁRIO (continuação)', 740, 100)]
        }
      ])
    }
  },
  {
    arquivo: '17-ordem-so-os-atuais.pdf',
    proposito: 'só os valores ATUAIS preenchidos: os seis campos de recurso entram, os máximos como lacuna',
    espera: {
      leitor: 'ordem-paranormal',
      nome: 'Selma Rocha',
      campos: [
        { label: 'PV atual', value: '11' },
        { label: 'PV máximo', value: '' },
        { label: 'PE atual', value: '3' },
        { label: 'PE máximo', value: '' },
        { label: 'Sanidade atual', value: '7' },
        { label: 'Sanidade máxima', value: '' }
      ]
    },
    bytes: () => {
      const atributos = atributosDeOrdem([
        ['AGI', '1'],
        ['FOR', '2'],
        ['INT', '1'],
        ['PRE', '3'],
        ['VIG', '1']
      ])
      return pdfDeUmaPagina({
        widgets: [
          widget('Personagem', 'Selma Rocha', '[100 760 300 780]'),
          ...atributos.widgets,
          widget('PV', '', '[400 700 440 720]'),
          widget('pvat', '11', '[450 700 490 720]'),
          widget('PE', '', '[400 670 440 690]'),
          widget('peat', '3', '[450 670 490 690]'),
          widget('SAN', '', '[400 640 440 660]'),
          widget('sanat', '7', '[450 640 490 660]')
        ],
        linhas: [linha('PERSONAGEM', 764, 100), ...atributos.linhas]
      })
    }
  },
  {
    arquivo: '18-dnd5e-nivel-alto-duas-armas-e-magia.pdf',
    proposito: 'D&D de nível alto: duas armas viram presets, a conjuração entra, as perícias vazias viram lacuna',
    espera: {
      leitor: 'dnd5e',
      nome: 'Sir Ulric',
      minimoDeCampos: 30,
      // Duas armas, cada uma em duas partes (ataque e dano), e o ataque mágico.
      minimoDePresets: 5,
      campos: [
        { label: 'PV atual', value: '23', group: 'Combate' },
        { label: 'PV máximo', value: '44', group: 'Combate' },
        { label: 'Percepção', value: '+5', group: 'Perícias' },
        { label: 'Furtividade', value: '', group: 'Perícias' },
        { label: 'Força', value: '18', group: 'Atributos' },
        { label: 'Força', value: '+7', group: 'Salvaguardas' },
        { label: 'CD das magias', value: '14', group: 'Magia' },
        { label: 'Classe conjuradora', value: 'Sorcerer', group: 'Magia' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('CharacterName', 'Sir Ulric', '[100 760 300 780]'),
          widget('ClassLevel', 'Paladin 5 / Sorcerer 2', '[320 760 500 780]'),
          widget('Background', 'Noble', '[100 735 300 755]'),
          widget('Race ', 'Human', '[320 735 500 755]'),
          widget('Alignment', 'Lawful Good', '[100 710 300 730]'),
          widget('XP', '23000', '[320 710 500 730]'),
          campoNaGrade('STR', '18', 0, 60),
          campoNaGrade('DEX', '10', 1, 60),
          campoNaGrade('CON', '14', 2, 60),
          campoNaGrade('INT', '8', 3, 60),
          campoNaGrade('WIS', '12', 4, 60),
          campoNaGrade('CHA', '16', 5, 60),
          campoNaGrade('ST Strength', '+7', 0, 200),
          campoNaGrade('ST Dexterity', '+0', 1, 200),
          campoNaGrade('ST Constitution', '+2', 2, 200),
          campoNaGrade('ST Intelligence', '-1', 3, 200),
          campoNaGrade('ST Wisdom', '+4', 4, 200),
          campoNaGrade('ST Charisma', '+6', 5, 200),
          campoNaGrade('Acrobatics', '+0', 6, 200),
          campoNaGrade('Athletics', '+7', 7, 200),
          campoNaGrade('Perception', '+5', 8, 200),
          campoNaGrade('Persuasion', '+6', 9, 200),
          campoNaGrade('Religion', '+2', 10, 200),
          campoNaGrade('Stealth', '', 11, 200),
          campoNaGrade('AC', '18', 0, 340),
          campoNaGrade('Initiative', '+0', 1, 340),
          campoNaGrade('Speed', '30', 2, 340),
          campoNaGrade('HPMax', '44', 3, 340),
          campoNaGrade('HPCurrent', '23', 4, 340),
          campoNaGrade('HPTemp', '5', 5, 340),
          campoNaGrade('HDTotal', '5d10+2d6', 6, 340),
          campoNaGrade('ProfBonus', '+3', 7, 340),
          campoNaGrade('Passive', '15', 8, 340),
          campoNaGrade('Wpn Name', 'Longsword', 0, 470),
          campoNaGrade('Wpn1 AtkBonus', '+7', 1, 470),
          campoNaGrade('Wpn1 Damage', '1d8+4', 2, 470),
          campoNaGrade('Wpn Name 2', 'Javelin', 3, 470),
          campoNaGrade('Wpn2 AtkBonus ', '+7', 4, 470),
          campoNaGrade('Wpn2 Damage ', '1d6+4', 5, 470),
          campoNaGrade('Spellcasting Class 2', 'Sorcerer', 6, 470),
          campoNaGrade('SpellcastingAbility 2', 'Charisma', 7, 470),
          campoNaGrade('SpellSaveDC  2', '14', 8, 470),
          campoNaGrade('SpellAtkBonus 2', '+6', 9, 470)
        ]
      })
  },
  {
    arquivo: '19-dnd5e-modelo-em-branco.pdf',
    proposito: 'o modelo oficial de D&D em branco: reconhecido, sem nome, sem lacuna e com o aviso',
    espera: { leitor: 'dnd5e', nome: '', maximoDeCampos: 0, avisos: ['dnd5e-modelo-em-branco'] },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('CharacterName', '', '[100 760 300 780]'),
          widget('ClassLevel', '', '[320 760 500 780]'),
          ...['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((nome, i) => campoNaGrade(nome, '', i, 60)),
          ...['Acrobatics', 'Athletics', 'Perception', 'Stealth'].map((nome, i) => campoNaGrade(nome, '', i, 200)),
          campoNaGrade('AC', '', 0, 340),
          campoNaGrade('HPMax', '', 1, 340),
          campoNaGrade('ProfBonus', '', 2, 340),
          campoNaGrade('Wpn Name', '', 0, 470),
          campoNaGrade('Wpn1 AtkBonus', '', 1, 470),
          campoNaGrade('Wpn1 Damage', '', 2, 470)
        ]
      })
  },
  {
    arquivo: '20-oblivio-dois-equipamentos.pdf',
    proposito: 'Oblívio com Aspectos separados dos Atributos e DOIS equipamentos carregados, cada um com dano',
    espera: {
      leitor: 'oblivio',
      nome: 'Tadeu Ferraz',
      minimoDeCampos: 12,
      minimoDePresets: 2,
      campos: [
        { label: 'Coragem', group: 'Aspectos' },
        { label: 'Velocidade', group: 'Aspectos' },
        { label: 'Carne', group: 'Atributos' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('Nome: Tadeu Ferraz', 760),
          linha('Papel: Quem Luta', 740),
          linha('Motivação: Proteger', 720),
          linha('Carne:', 690),
          linha('4/10', 690, 140),
          linha('Força:', 670),
          linha('4/10', 670, 140),
          linha('Prontidão:', 650),
          linha('2/10', 650, 160),
          linha('Determinação:', 630),
          linha('3/10', 630, 180),
          linha('Mente:', 610),
          linha('2/10', 610, 140),
          linha('Coragem:', 590),
          linha('5/10', 590, 150),
          linha('Dor:', 570),
          linha('2/10', 570, 120),
          linha('Fôlego:', 550),
          linha('3/10', 550, 140),
          linha('Proteção:', 530),
          linha('4/10', 530, 150),
          linha('Velocidade:', 510),
          linha('1/10', 510, 160),
          linha('Equipamentos Carregados:', 460),
          linha('○', 440, 126),
          linha('Braço Direito:', 440, 144),
          linha('Facão', 420),
          linha('Espaços de Inventário', 400),
          linha(': 2. /', 400, 201),
          linha('Dano:', 400, 240),
          linha('1D6 PE.', 400, 280),
          linha('○', 380, 126),
          linha('Braço Esquerdo:', 380, 144),
          linha('Revólver', 360),
          linha('Espaços de Inventário', 340),
          linha(': 1. /', 340, 201),
          linha('Dano:', 340, 240),
          linha('2D6 PE.', 340, 280),
          linha('Equipamentos Guardados:', 300),
          linha('Corda, lampião, duas latas de comida', 280)
        ]
      })
  },
  {
    arquivo: '21-kids-on-bikes-arte-com-titulo.pdf',
    proposito: 'arte achatada com o TÍTULO impresso: tem letras, mas nenhum campo — não pode inventar ficha nem nome',
    // O título da ficha ("KIDS ON BIKES CHARACTER SHEET") chegou a ser proposto como nome do
    // personagem na importação pela tela. Vazio: a tela pede o nome, e é isso que se quer.
    espera: { leitor: 'generico', nome: '', maximoDeCampos: 0 },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [linha('KIDS ON BIKES', 760, 200), linha('CHARACTER SHEET', 740, 200), linha('X', 500, 120), linha('/', 480, 300)]
      })
  },
  {
    arquivo: '22-cthulhu-datilografada-longa.pdf',
    proposito: 'Chamado de Cthulhu datilografado, com vinte pares rótulo: valor, duas armas e três parágrafos',
    espera: {
      leitor: 'generico',
      nome: 'Helena Prado',
      minimoDeCampos: 15,
      minimoDePresets: 2,
      campos: [
        { label: 'Ocupação', value: 'Bibliotecária' },
        { label: 'Sanidade', value: '62' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('FICHA DE INVESTIGADOR — CHAMADO DE CTHULHU', 770),
          linha('Nome: Helena Prado', 745),
          linha('Ocupação: Bibliotecária', 730),
          linha('Idade: 34', 715),
          linha('Residência: Boston', 700),
          linha('Local de nascimento: Providence', 685),
          linha('FOR: 45', 665),
          linha('CON: 60', 650),
          linha('TAM: 55', 635),
          linha('DES: 50', 620),
          linha('APA: 65', 605),
          linha('INT: 80', 590),
          linha('POD: 70', 575),
          linha('EDU: 85', 560),
          linha('Sanidade: 62', 540),
          linha('Pontos de vida: 11', 525),
          linha('Sorte: 55', 510),
          linha('Pontos de magia: 14', 495),
          linha('Movimento: 8', 480),
          linha('Bônus de dano: 0', 465),
          linha('Armas:', 440),
          linha('Faca de cozinha  dano 1d4+2', 425),
          linha('Espingarda calibre 12  dano 2d6+4', 410),
          linha('Helena cresceu entre as estantes da biblioteca pública de Providence, onde a mãe', 380),
          linha('trabalhava. Aprendeu a ler antes de aprender a andar de bicicleta, e nunca perdoou', 365),
          linha('o mundo por ter mais livros do que uma vida comporta.', 350)
        ]
      })
  },
  {
    arquivo: '23-tormenta20-formulario-em-portugues.pdf',
    proposito: 'sistema que ninguém cadastrou (Tormenta20), formulário com nomes em português e acento',
    espera: {
      leitor: 'generico',
      nome: 'Kaori',
      minimoDeCampos: 10,
      minimoDePresets: 1,
      campos: [{ label: 'Constituição', value: '14' }]
    },
    bytes: () => {
      const campos: [string, string][] = [
        ['Nome', 'Kaori'],
        ['Raça', 'Qareen'],
        ['Classe', 'Arcanista'],
        ['Nível', '5'],
        ['Força', '10'],
        ['Destreza', '14'],
        ['Constituição', '14'],
        ['Inteligência', '18'],
        ['Sabedoria', '12'],
        ['Carisma', '16'],
        ['PV', '38'],
        ['PM', '25'],
        ['Defesa', '15'],
        ['Ataque', 'Adaga 1d4+2']
      ]
      return pdfDeUmaPagina({
        widgets: campos.map(([nome, valor], i) => campoNaGrade(nome, valor, i, 220)),
        linhas: campos.map(([nome], i) => linha(nome.toUpperCase(), 704 - i * 22, 100))
      })
    }
  },
  {
    arquivo: '24-escolha-e-radio.pdf',
    proposito: 'campo de lista (combo) e grupo de rádio: o valor escolhido entra, e nada vira "Off"',
    espera: { leitor: 'generico', nome: 'Zilda', minimoDeCampos: 2 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Zilda', '[100 760 300 780]'),
          `<< /Type /Annot /Subtype /Widget /FT /Ch /Ff 131072 /T (Classe) /V (Guerreira) /Opt [(Maga) (Guerreira) (Ladina)] /Rect [200 700 320 720] >>`,
          `<< /Type /Annot /Subtype /Widget /FT /Btn /Ff 32768 /T (Porte) /V /Alto /AS /Alto /Rect [200 670 220 690] >>`,
          `<< /Type /Annot /Subtype /Widget /FT /Btn /Ff 32768 /T (Porte) /V /Alto /AS /Off /Rect [230 670 250 690] >>`
        ],
        linhas: [linha('NOME', 764, 100), linha('CLASSE', 704, 100), linha('PORTE', 674, 100)]
      })
  },
  {
    arquivo: '25-valor-com-espaco-e-quebra-de-linha.pdf',
    proposito: 'valor com espaço nas pontas e quebra de linha dentro: o nome sai limpo, o texto não perde a segunda linha',
    espera: {
      leitor: 'generico',
      nome: 'Bia',
      minimoDeCampos: 2,
      // O rótulo impresso entra COMO IMPRESSO ("NOME", "HISTÓRIA") — o app não inventa caixa.
      campos: [{ label: 'NOME', value: 'Bia' }, { label: 'HISTÓRIA', valueMatches: /Primeira linha\s+Segunda linha/ }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', '   Bia   ', '[100 760 300 780]'),
          widget('Historia', 'Primeira linha\\nSegunda linha', '[100 560 400 700]'),
          widget('Apelido', '\\t', '[320 760 500 780]')
        ],
        // O rótulo da caixa alta fica colado nela (4pt) e longe do campo de cima (60pt): é assim
        // que uma ficha diagramada de verdade separa as coisas.
        linhas: [linha('NOME', 764, 100), linha('HISTÓRIA', 704, 100), linha('APELIDO', 764, 320)]
      })
  },
  {
    arquivo: '26-cento-e-uma-paginas.pdf',
    proposito: 'cento e uma páginas: a varredura para no teto de cem, e o que está na página 101 não entra',
    espera: { leitor: 'generico', nome: 'Leocádia', minimoDeCampos: 1, proibidos: [/Impostor/] },
    bytes: () =>
      pdfDeVariasPaginas(
        Array.from({ length: 101 }, (_, pagina) => ({
          linhas:
            pagina === 0
              ? [linha('Nome: Leocádia', 760), linha('Sistema: caseiro, cem páginas de regras', 740)]
              : pagina === 100
                ? [linha('Nome: Impostor', 760)]
                : [linha(`Capítulo ${pagina + 1}`, 760)]
        }))
      )
  },
  {
    arquivo: '27-cinco-mil-e-um-campos.pdf',
    proposito: 'cinco mil e um campos: a varredura para no teto e o app não trava',
    espera: { leitor: 'generico', minimoDeCampos: 1000, maximoDeCampos: 5000 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Multidão', '[100 760 300 780]'),
          ...Array.from({ length: 5000 }, (_, i) => widget(`campo${i}`, `v${i}`, `[${(i % 5) * 100} ${700 - Math.floor(i / 5) % 30 * 20} ${(i % 5) * 100 + 80} ${716 - Math.floor(i / 5) % 30 * 20}]`))
        ],
        linhas: [linha('NOME', 764, 100)]
      })
  },
  {
    arquivo: '28-javascript-embutido.pdf',
    proposito: 'PDF com JavaScript de abertura e ação de impressão: nada roda, e os campos entram normalmente',
    espera: { leitor: 'generico', nome: 'Nico', minimoDeCampos: 2, campos: [{ label: 'NOME', value: 'Nico' }] },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [widget('Nome', 'Nico', '[100 760 300 780]'), widget('Origem', 'Porto', '[100 730 300 750]')],
        linhas: [linha('NOME', 764, 100), linha('ORIGEM', 734, 100)],
        catalogoExtra:
          "/OpenAction << /S /JavaScript /JS (app.alert\\('lido'\\); this.print\\(\\);) >> " +
          '/Names << /JavaScript << /Names [(init) << /S /JavaScript /JS (app.launchURL\\("http://exemplo.invalido"\\)) >>] >> >>'
      })
  },
  {
    arquivo: '29-xref-apontando-pro-lugar-errado.pdf',
    proposito: 'tabela xref no deslocamento errado: o pdf.js reconstrói varrendo, e a ficha sai inteira',
    espera: { leitor: 'generico', nome: 'Rui', minimoDeCampos: 2 },
    bytes: () =>
      comXrefErrado(
        pdfDeUmaPagina({
          widgets: [widget('Nome', 'Rui', '[100 760 300 780]'), widget('Profissao', 'Estivador', '[100 730 300 750]')],
          linhas: [linha('NOME', 764, 100), linha('PROFISSÃO', 734, 100)]
        })
      )
  },
  {
    arquivo: '30-cortado-no-meio-do-download.pdf',
    proposito: 'arquivo cortado em 60%: ou abre com o que sobrou, ou recusa limpo — nunca trava',
    espera: { leitor: 'generico', podeNaoAbrir: true },
    bytes: () => {
      const inteiro = pdfDeUmaPagina({
        widgets: [widget('Nome', 'Truncado', '[100 760 300 780]')],
        linhas: [linha('NOME', 764, 100), linha('Um texto longo o bastante pra sobrar alguma coisa depois do corte.', 700)]
      })
      return inteiro.subarray(0, Math.floor(inteiro.length * 0.6))
    }
  }
]
