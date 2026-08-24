import { pdfDeUmaPagina, pdfDeVariasPaginas, widget } from './pdfDeMentira'

/**
 * QUINZE FICHAS DE TESTE, fabricadas byte a byte.
 *
 * As três fichas reais (`Fichas RPG/`) cobrem o caminho feliz de três sistemas e moram fora do
 * repositório — quem clonar o projeto não as tem. O que falta, e é o que este corpus dá: os
 * arquivos que a pessoa do outro lado vai arrastar pra dentro do app, incluindo os que ninguém
 * pediria emprestado. Ficha de sistema que ninguém cadastrou, digitalização sem texto, modelo em
 * branco cheio de instrução, campo com um romance dentro, rótulo repetido doze vezes.
 *
 * Cada entrada diz o que ESPERA do importador, e é isso que o teste cobra. A lista dobra como
 * material pra usar à mão: `ESCREVER_PDFS=1 npx vitest run corpusDePdfs` escreve os quinze em
 * `Fichas RPG/testes/`, que já é ignorado pelo git, pra arrastar pro app e ver na tela.
 */

export interface FichaDeTeste {
  arquivo: string
  /** O que este arquivo existe pra provar. Vira o nome do caso no teste. */
  proposito: string
  bytes: () => Uint8Array
  espera: {
    leitor: 'ordem-paranormal' | 'oblivio' | 'dnd5e' | 'generico'
    /** Nome do personagem, quando o arquivo permite deduzir um. */
    nome?: string
    /** Piso de campos importados — o teste cobra "pelo menos isso". */
    minimoDeCampos?: number
    /** Teto de campos, pro caso em que importar demais É o defeito. */
    maximoDeCampos?: number
    minimoDePresets?: number
    avisos?: string[]
    /** Campos que PRECISAM estar lá — por rótulo, e opcionalmente com o valor e o grupo exatos. */
    campos?: { label: string; value?: string; valueMatches?: RegExp; group?: string }[]
    /** Nenhum rótulo pode casar com isto — é como se cobra que o nome cru do campo não vazou. */
    semRotulo?: RegExp
    /** Nada (rótulo ou valor) pode casar com isto — o que estava fora do teto da varredura. */
    proibidos?: RegExp[]
    /**
     * O arquivo pode não abrir (cortado no meio): aí o que se cobra é que a recusa seja LIMPA — uma
     * rejeição, e não um travamento. Se abrir, valem as demais expectativas.
     */
    podeNaoAbrir?: boolean
  }
}

/** Uma linha impressa na página, na altura pedida. */
function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/** Os cinco atributos de Ordem Paranormal como campos de formulário, com o rótulo impresso ao lado. */
function atributosDeOrdem(valores: [string, string][]): { widgets: string[]; linhas: ReturnType<typeof linha>[] } {
  const widgets: string[] = []
  const linhas: ReturnType<typeof linha>[] = []
  valores.forEach(([nome, valor], i) => {
    const y = 700 - i * 30
    widgets.push(widget(nome, valor, `[200 ${y} 240 ${y + 20}]`))
    linhas.push(linha(nomeImpressoDoAtributo(nome), y + 4))
  })
  return { widgets, linhas }
}

function nomeImpressoDoAtributo(sigla: string): string {
  const nomes: Record<string, string> = {
    AGI: 'AGILIDADE',
    FOR: 'FORÇA',
    INT: 'INTELECTO',
    PRE: 'PRESENÇA',
    VIG: 'VIGOR'
  }
  return nomes[sigla] ?? sigla
}

export const CORPUS: FichaDeTeste[] = [
  {
    arquivo: '01-ordem-preenchida.pdf',
    proposito: 'ficha de formulário reconhecida, com atributos, recursos e ataque',
    espera: { leitor: 'ordem-paranormal', nome: 'Célia Prates', minimoDeCampos: 12, minimoDePresets: 2 },
    bytes: () => {
      const atributos = atributosDeOrdem([
        ['AGI', '2'],
        ['FOR', '1'],
        ['INT', '4'],
        ['PRE', '3'],
        ['VIG', '2']
      ])
      return pdfDeUmaPagina({
        widgets: [
          widget('Personagem', 'Célia Prates', '[100 760 300 780]'),
          widget('Jogador', 'Rita', '[320 760 500 780]'),
          ...atributos.widgets,
          widget('PV', '32', '[400 700 440 720]'),
          widget('pvat', '19', '[450 700 490 720]'),
          widget('PE', '9', '[400 670 440 690]'),
          widget('SAN', '14', '[400 640 440 660]'),
          widget('Def', '13', '[400 610 440 630]'),
          widget('Atq1.0.0.0.0', 'Cano de ferro', '[100 500 250 520]'),
          widget('Atq1.0.0.0.1', '3d20', '[260 500 320 520]'),
          widget('Atq1.0.0.0.2', '1d8+2', '[330 500 400 520]')
        ],
        linhas: [linha('PERSONAGEM', 764, 100), ...atributos.linhas]
      })
    }
  },
  {
    arquivo: '02-ordem-em-branco.pdf',
    proposito: 'modelo em branco: não propõe nome nem enche a tela de lacuna',
    /**
     * Seis campos, e nenhum deles é lacuna: são os cinco atributos escritos "0" e a defesa "10" que
     * o modelo já traz de fábrica. Valor que ESTÁ no arquivo entra, mesmo sendo zero — o que não
     * entra é o esqueleto de lacunas, que só aparece em ficha com dono (ver `sempre` no leitor).
     */
    espera: { leitor: 'ordem-paranormal', nome: '', maximoDeCampos: 6 },
    bytes: () => {
      const atributos = atributosDeOrdem([
        ['AGI', '0'],
        ['FOR', '0'],
        ['INT', '0'],
        ['PRE', '0'],
        ['VIG', '0']
      ])
      return pdfDeUmaPagina({
        widgets: [
          widget('Personagem', '', '[100 760 300 780]'),
          ...atributos.widgets,
          widget('Classe', 'Escolha uma Classe', '[100 730 300 750]'),
          widget('Def', '10', '[400 610 440 630]')
        ],
        linhas: [linha('PERSONAGEM', 764, 100), ...atributos.linhas]
      })
    }
  },
  {
    arquivo: '03-oblivio-texto.pdf',
    proposito: 'ficha SEM formulário, lida do texto impresso, com equipamento carregado',
    espera: { leitor: 'oblivio', nome: 'Iara Bastos', minimoDeCampos: 12, minimoDePresets: 1 },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('Nome: Iara Bastos', 760),
          linha('Papel: Quem Sabe', 740),
          linha('Motivação: Descobrir', 720),
          linha('Carne:', 690),
          linha('3/10', 690, 140),
          linha('Força:', 670),
          linha('2/10', 670, 140),
          linha('Prontidão:', 650),
          linha('4/10', 650, 160),
          linha('Determinação:', 630),
          linha('2/10', 630, 180),
          linha('Mente:', 610),
          linha('5/10', 610, 140),
          linha('Coragem:', 590),
          linha('3/10', 590, 150),
          linha('Dor:', 570),
          linha('1/10', 570, 120),
          linha('Fôlego:', 550),
          linha('2/10', 550, 140),
          linha('Proteção:', 530),
          linha('2/10', 530, 150),
          linha('Velocidade:', 510),
          linha('3/10', 510, 160),
          linha('Equipamentos Carregados:', 460),
          linha('○', 440, 126),
          linha('Braço Direito:', 440, 144),
          linha('Machadinha', 420),
          linha('Espaços de Inventário', 400),
          linha(': 2. /', 400, 201),
          linha('Dano:', 400, 240),
          linha('1D6 PE.', 400, 280),
          linha('Equipamentos Guardados:', 360)
        ]
      })
  },
  {
    arquivo: '04-dnd5e-formulario.pdf',
    proposito: 'ficha de D&D 5e reconhecida pelos nomes de campo do modelo oficial',
    espera: { leitor: 'dnd5e', nome: 'Bramble', minimoDeCampos: 6 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('CharacterName', 'Bramble', '[100 760 300 780]'),
          widget('ClassLevel', 'Ranger 4', '[320 760 460 780]'),
          widget('Background', 'Outlander', '[100 730 300 750]'),
          widget('Race ', 'Halfling', '[320 730 460 750]'),
          widget('STR', '10', '[100 700 140 720]'),
          widget('DEX', '17', '[100 670 140 690]'),
          widget('CON', '14', '[100 640 140 660]'),
          widget('INT', '11', '[100 610 140 630]'),
          widget('WIS', '15', '[100 580 140 600]'),
          widget('CHA', '9', '[100 550 140 570]'),
          widget('AC', '15', '[300 700 340 720]'),
          widget('HPMax', '31', '[300 670 340 690]')
        ]
      })
  },
  {
    arquivo: '05-datilografada.pdf',
    proposito: 'documento de texto sem formulário: pares "Rótulo: valor" viram campos',
    espera: { leitor: 'generico', nome: 'Otávio Lins', minimoDeCampos: 4, minimoDePresets: 1 },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('FICHA DE INVESTIGADOR', 760),
          linha('Nome: Otávio Lins', 730),
          linha('Ocupacao: Fotógrafo', 710),
          linha('Idade: 29', 690),
          linha('Sanidade: 58', 670),
          linha('Armas', 640),
          linha('Revolver .32  dano 1d8', 620),
          linha('Notas: dorme com a luz acesa desde a viagem.', 590)
        ]
      })
  },
  {
    arquivo: '06-arte-achatada.pdf',
    proposito: 'arte com um rabisco só: não rende campo e não propõe nome de arquivo',
    espera: { leitor: 'generico', nome: '', maximoDeCampos: 0, avisos: ['pdf-sem-texto'] },
    bytes: () => pdfDeUmaPagina({ linhas: [linha('X', 400, 300)] })
  },
  {
    arquivo: '07-sem-texto-nenhum.pdf',
    proposito: 'digitalização sem camada de texto: avisa em vez de fingir que leu',
    espera: { leitor: 'generico', nome: '', maximoDeCampos: 0, avisos: ['pdf-sem-texto'] },
    bytes: () => pdfDeUmaPagina({})
  },
  {
    arquivo: '08-rotulos-repetidos.pdf',
    proposito: 'doze campos com o mesmo nome: o rótulo impresso é quem desempata',
    espera: { leitor: 'generico', minimoDeCampos: 1 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: Array.from({ length: 12 }, (_, i) =>
          widget('VALOR', String(i + 1), `[200 ${700 - i * 30} 240 ${720 - i * 30}]`)
        ),
        linhas: Array.from({ length: 12 }, (_, i) => linha(`LINHA ${i + 1}`, 704 - i * 30))
      })
  },
  {
    arquivo: '09-muitas-paginas.pdf',
    proposito: 'ficha de doze páginas: a varredura para no limite sem perder o começo',
    espera: { leitor: 'generico', nome: 'Wanda Reis', minimoDeCampos: 2 },
    bytes: () =>
      pdfDeVariasPaginas(
        Array.from({ length: 12 }, (_, pagina) => ({
          linhas:
            pagina === 0
              ? [linha('Nome: Wanda Reis', 760), linha('Sistema: Caseiro', 740)]
              : [linha(`Anotações da página ${pagina + 1}`, 760)]
        }))
      )
  },
  {
    arquivo: '10-acentos-e-emoji.pdf',
    proposito: 'acento, cedilha e emoji atravessam sem virar lixo',
    espera: { leitor: 'generico', nome: 'Mônica Gonçalves', minimoDeCampos: 3 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Mônica Gonçalves', '[100 760 300 780]'),
          widget('Descricao', 'Coração partido, ânimo 100%', '[100 730 400 750]'),
          widget('Titulo', 'A Fúria de Açaí', '[100 700 400 720]')
        ],
        linhas: [linha('NOME', 764, 100), linha('DESCRIÇÃO', 734, 100), linha('TÍTULO', 704, 100)]
      })
  },
  {
    arquivo: '11-campo-gigante.pdf',
    proposito: 'campo com um romance dentro: entra cortado, e não trava nem entra inteiro',
    espera: { leitor: 'generico', minimoDeCampos: 1 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Bento', '[100 760 300 780]'),
          widget('Historia', 'A '.repeat(3000).trim(), '[100 400 500 700]')
        ],
        linhas: [linha('NOME', 764, 100), linha('HISTÓRIA', 700, 100)]
      })
  },
  {
    arquivo: '12-notacao-de-dado.pdf',
    proposito: 'campos com notação de dado viram presets, sem conhecer o sistema',
    espera: { leitor: 'generico', minimoDeCampos: 3, minimoDePresets: 3 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Sétimo', '[100 760 300 780]'),
          widget('Espada', '1d8+3', '[200 700 300 720]'),
          widget('Arco', '2d6', '[200 670 300 690]'),
          widget('Magia', '4d4+1', '[200 640 300 660]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          linha('ESPADA', 704, 100),
          linha('ARCO', 674, 100),
          linha('MAGIA', 644, 100)
        ]
      })
  },
  {
    arquivo: '13-instrucoes-do-modelo.pdf',
    proposito: 'o texto que o modelo traz dentro do campo não é resposta de ninguém',
    espera: { leitor: 'generico', maximoDeCampos: 1 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Digite seu nome', '[100 760 300 780]'),
          widget('Classe', 'Escolha uma Classe', '[100 730 300 750]'),
          widget('Origem', 'Selecione a origem', '[100 700 300 720]'),
          widget('Anotacao', 'Preencha aqui', '[100 670 300 690]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          linha('CLASSE', 734, 100),
          linha('ORIGEM', 704, 100),
          linha('ANOTAÇÃO', 674, 100)
        ]
      })
  },
  {
    arquivo: '14-caixas-de-marcacao.pdf',
    proposito: 'caixa desmarcada (Off) não vira campo; marcada vira "sim"',
    espera: { leitor: 'generico', minimoDeCampos: 1, maximoDeCampos: 3 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Ísis', '[100 760 300 780]'),
          `<< /Type /Annot /Subtype /Widget /FT /Btn /T (Treinado) /V /On /Rect [200 700 220 720] >>`,
          `<< /Type /Annot /Subtype /Widget /FT /Btn /T (Veterano) /V /Off /Rect [200 670 220 690] >>`,
          `<< /Type /Annot /Subtype /Widget /FT /Btn /T (Aposentado) /V /Off /Rect [200 640 220 660] >>`
        ],
        linhas: [
          linha('NOME', 764, 100),
          linha('TREINADO', 704, 100),
          linha('VETERANO', 674, 100),
          linha('APOSENTADO', 644, 100)
        ]
      })
  },
  {
    arquivo: '15-mista-com-regras.pdf',
    proposito: 'formulário + texto impresso + REGRA do sistema na mesma página',
    espera: { leitor: 'generico', nome: 'Aurélio', minimoDeCampos: 2, maximoDeCampos: 6 },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Aurélio', '[100 760 300 780]'),
          widget('Ocupacao', 'Relojoeiro', '[100 730 300 750]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          linha('OCUPAÇÃO', 734, 100),
          linha('Regra: ao falhar num teste, o Mestre pode oferecer 1d6 de complicação.', 690),
          linha('Regra: dano de queda é 1d6 por 3 metros, até 20d6.', 670),
          linha('Nota do jogador: comprei corda e lampião no armazém.', 640)
        ]
      })
  }
]
