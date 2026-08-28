import { describe, expect, it } from 'vitest'
import type { PdfField, PdfSheet, PdfText } from '@shared/types/sheetImport'
import { readSheet, SHEET_READERS } from './index'
import { ordemParanormalReader } from './ordemParanormal'
import { genericReader } from './generic'
import { oblivioReader } from './oblivio'

/**
 * As fichas de referência (`Fichas RPG/`) estão no `.gitignore` e não existem no repositório, então
 * estes testes montam a `PdfSheet` à mão — que é justamente o que o desenho do importador permite:
 * leitor é função pura do que se extraiu do PDF, e não de um arquivo.
 *
 * Os valores usados aqui não são inventados: os nomes de campo (`Personagem`, `AGI`, `Atq1.0.0.0.1`)
 * e os rótulos impressos ("PERSONAGEM", "TESTE", "DANO") foram lidos do PDF de Ordem Paranormal
 * numa sondagem antes de o leitor existir.
 */

function campo(name: string, value: string, rect: [number, number, number, number] = [0, 0, 10, 10]): PdfField {
  return { name, type: 'text', value, page: 1, rect }
}

function texto(text: string, x: number, y: number, width = text.length * 5): PdfText {
  return { text, page: 1, x, y, width, height: 8 }
}

function ficha(fields: PdfField[], texts: PdfText[] = [], fileName = 'ficha.pdf'): PdfSheet {
  return { fileName, pageCount: 1, fields, texts }
}

/** Uma linha da grade de ataques: nome, teste, dano, crítico. */
function ataque(linha: number, nome: string, teste: string, dano: string): PdfField[] {
  return [
    campo(`Atq1.0.0.${linha}.0`, nome),
    campo(`Atq1.0.0.${linha}.1`, teste),
    campo(`Atq1.0.0.${linha}.2`, dano),
    campo(`Atq1.0.0.${linha}.3`, '')
  ]
}

const ATRIBUTOS = [campo('AGI', '2'), campo('FOR', '1'), campo('INT', '3'), campo('PRE', '2'), campo('VIG', '1')]

describe('escolha do leitor', () => {
  it('a ficha de Ordem Paranormal é reconhecida pela ESTRUTURA, não pelo texto', () => {
    const sheet = ficha([campo('Personagem', 'Riebeck'), ...ATRIBUTOS, ...ataque(0, 'Faca', '+7', '1d4+2')])
    expect(ordemParanormalReader.detect(sheet)).toBeGreaterThan(0.9)
    expect(readSheet(sheet).readerId).toBe('ordem-paranormal')
  })

  it('ficha de outro sistema não é confundida com Ordem Paranormal', () => {
    // Campos preenchíveis, mas nenhuma das marcas: cai no genérico, não numa leitura errada.
    const sheet = ficha([campo('nome_do_heroi', 'Ada'), campo('vigor_corporal', '12')])
    expect(ordemParanormalReader.detect(sheet)).toBe(0)
    expect(readSheet(sheet).readerId).toBe('generico')
  })

  it('sempre existe um vencedor — ficha vazia não trava a tela', () => {
    expect(readSheet(ficha([])).readerId).toBe('generico')
    // O genérico é o piso do registro: nunca ganha de um leitor dedicado, nunca perde pra nada.
    expect(genericReader.detect(ficha([]))).toBeLessThan(ordemParanormalReader.detect(ficha([...ATRIBUTOS])))
    expect(SHEET_READERS[SHEET_READERS.length - 1]).toBe(genericReader)
  })
})

describe('leitor genérico — a ficha que ninguém previu', () => {
  it('usa o RÓTULO IMPRESSO ao lado do campo, e não o nome dele', () => {
    /**
     * O caso que motiva a peça inteira: o campo se chama `19` porque o exportador nomeou sozinho, e
     * o que dá sentido ao valor é a palavra impressa à esquerda dele.
     */
    // A distância aqui é a MEDIDA na ficha real: o campo `Personagem` fica a 55 do rótulo
    // "PERSONAGEM" no PDF de Ordem Paranormal.
    const sheet = ficha([campo('19', 'Ada Lovelace', [100, 700, 200, 712])], [texto('PERSONAGEM', 70, 702)])
    const lido = readSheet(sheet)
    expect(lido.fields).toEqual([
      { label: 'PERSONAGEM', value: 'Ada Lovelace', fieldName: '19' }
    ])
  })

  it('campo sem rótulo não vira linha, mas o valor NÃO se perde — vai pro texto sem rótulo', () => {
    /**
     * Uma linha "1_2 → 7" na conferência não informa nada e faz duvidar do resto da leitura — por
     * isso não vira campo. Mas descartar o VALOR era perder anotação de jogador, e a regra do
     * usuário é: "qualquer anotação de player no pdf precisamos trazer", mesmo a que parece inútil.
     * O valor vai pro `rawText`, que a conferência mostra e manda pro bloco de história.
     */
    const lido = readSheet(ficha([campo('1_2', '7'), campo('text_9xk2f', 'Deve 50 moedas ao ferreiro')]))
    expect(lido.fields).toEqual([])
    expect(lido.rawText).toContain('7')
    expect(lido.rawText).toContain('Deve 50 moedas ao ferreiro')
  })

  it('caixa marcada sem rótulo não vai nem pro texto — um "sim" solto não diz o que foi marcado', () => {
    const sheet = ficha([{ ...campo('checkbox_a1b2c', 'On'), type: 'checkbox' }])
    expect(readSheet(sheet).rawText ?? '').toBe('')
  })

  it('não importa caixa de seleção desmarcada', () => {
    // `Off` é o estado desmarcado no PDF; sem isso, uma ficha em branco importa 200 linhas "Off".
    const sheet = ficha([{ ...campo('Pesadas', 'Off'), type: 'checkbox' }], [texto('PESADAS', 0, 5)])
    expect(readSheet(sheet).fields).toEqual([])
  })

  it('tira preset de qualquer campo com notação de dado, sem saber o sistema', () => {
    const sheet = ficha([campo('golpe_1', '2d6+3', [100, 500, 200, 512])], [texto('ATAQUE', 85, 502)])
    const lido = readSheet(sheet)
    expect(lido.presets).toHaveLength(1)
    expect(lido.presets[0]).toMatchObject({
      name: 'ATAQUE',
      // Sem conhecer o sistema não dá pra afirmar se é acerto ou dano — `other` é a resposta honesta.
      kind: 'other',
      source: '2d6+3'
    })
    expect(lido.presets[0].expression.groups).toEqual([{ sides: 6, count: 2 }])
  })

  it('avisa quando a ficha não tem formulário, mas tem texto', () => {
    /**
     * O caso da ficha de Oblivio: PDF do Google Docs, só texto e imagem. O usuário PRECISA saber que
     * a leitura foi parcial — silêncio aqui vira "o app importou errado".
     *
     * As 60 linhas não são enchimento à toa: é a DENSIDADE que separa um documento de texto de uma
     * arte com anotação por cima (ver `anotacoesSobreImagem.ts`), e a ficha de Oblivio de verdade
     * tem 68 fragmentos por página. Um fixture de 25 linhas representaria mal o que diz representar,
     * e cairia do outro lado da régua.
     */
    const muitoTexto = Array.from({ length: 60 }, (_, i) => texto(`linha ${i}`, 50, 700 - i * 11))
    const sheet = ficha([], [...muitoTexto, texto('Espada 1d8+2', 50, 20)])
    const lido = readSheet(sheet)
    expect(lido.warnings).toContain('sem-formulario')
    // Mesmo assim entrega o que dá: rolagem escrita numa célula ainda é rolagem.
    expect(lido.presets[0].expression.groups).toEqual([{ sides: 8, count: 1 }])
  })

  describe('a ficha que é ARTE com anotação por cima', () => {
    /**
     * O terceiro tipo de ficha, e o que o usuário trouxe em Kids on Bikes: o desenho inteiro é
     * imagem, inclusive os nomes dos campos, e quem preenche digita por cima num anotador de PDF.
     *
     * Não existe rótulo pra casar — "Força" é pixel —, então a leitura aqui não é "campo = valor" e
     * sim recuperar o que foi escrito sem inventar nome pra nada. Os números (densidade, posições)
     * saíram do arquivo real.
     */
    /**
     * A ALTURA da fonte é 12 e não o padrão do `texto()` daqui, e isso é o que faz o fixture valer:
     * a remontagem de parágrafo mede o espaço entre linhas em múltiplos da altura da fonte, e o
     * arquivo real tem corpo 12,2 com 16 pontos de entrelinha. Com uma altura inventada menor, duas
     * linhas do mesmo parágrafo pareceriam distantes e o teste passaria a testar outra coisa.
     */
    function arteAnotada(itens: [string, number, number][], paginas = 2) {
      const texts: PdfText[] = itens.map(([t, x, y]) => ({
        text: t,
        page: 1,
        x,
        y,
        width: t.length * 6,
        height: 12
      }))
      return readSheet({ fileName: 'arte.pdf', pageCount: paginas, fields: [], texts })
    }

    it('remonta o parágrafo picado pelo extrator, em vez de importar pedaço de frase', () => {
      // As três linhas são fragmentos do arquivo real; sozinhas, cada uma vira uma frase truncada.
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['Durão: Se você perder uma', 101, 207],
        ['rolagem de combate, adicione +3', 101, 191],
        ['ao número negativo.', 101, 174]
      ])
      /**
       * Vai pro grupo HABILIDADES: parágrafo que a própria pessoa nomeou, numa arte anotada, é a
       * vantagem que ela escolheu. Sem grupo, esses campos caíam numa seção genérica — e foi o que
       * o usuário viu na tela como uma seção chamada só "FICHA".
       */
      expect(lido.fields).toEqual([
        {
          label: 'Durão',
          value: 'Se você perder uma rolagem de combate, adicione +3 ao número negativo.',
          group: 'Habilidades'
        }
      ])
    })

    /**
     * Quando NADA foi lido, não se propõe nome nenhum — nem o do arquivo.
     *
     * O palpite pelo nome do arquivo existe e continua valendo ("Elias - ficha.pdf" é indício de
     * verdade), mas ele pressupõe que exista uma ficha atrás dele. Medido na varredura das fichas
     * reais: a ficha EM BRANCO de Kids on Bikes é uma arte achatada — zero campos de formulário e
     * zero rótulos impressos —, e o app propunha criar um personagem chamado "Ficha Kids on Bikes"
     * com a ficha vazia. Quem confirmasse sem ler a tela ficava com um personagem-título.
     *
     * Sem nome proposto, a tela de conferência não deixa confirmar, e ela é quem diz que não veio
     * nada. É a mesma regra que os leitores dedicados já seguiam.
     */
    it('ficha que não rendeu NADA não propõe o nome do arquivo como personagem', () => {
      const lido = readSheet({
        fileName: 'Ficha Kids on Bikes.pdf',
        pageCount: 2,
        fields: [],
        /**
         * É o conteúdo REAL do arquivo, medido: um fragmento de texto na página inteira, a letra
         * "X" de uma caixinha marcada. O resto da ficha é desenho.
         */
        texts: [{ text: 'X', page: 1, x: 300, y: 400, width: 6, height: 10 }]
      })

      expect(lido.readerId).toBe('generico')
      expect(lido.fields).toEqual([])
      expect(lido.presets).toEqual([])
      expect(lido.characterName).toBe('')
    })

    it('mas com ALGUMA coisa lida, o nome do arquivo continua sendo o palpite', () => {
      const lido = arteAnotada([
        ['Elias Ramos', 81, 739],
        ['Durão: Se você perder uma rolagem.', 101, 207]
      ])
      // Aqui o nome sai do próprio texto; o que importa é que o caminho do palpite não foi cortado.
      expect(lido.characterName).toBeTruthy()
    })

    it('não intercala as DUAS COLUNAS da página', () => {
      /**
       * Página de duas colunas com as mesmas alturas. Agrupar por altura só produzia "Heróico: Você
       * não precisa da Pegs Apoio nas rodas Você pode permissão do Mestre para levar um passageiro" —
       * uma frase que não existe em lugar nenhum do arquivo.
       */
      const lido = arteAnotada([
        ['Heróico: Você não precisa da', 101, 284],
        ['Pegs Apoio nas rodas', 302, 284],
        ['permissão do Mestre.', 101, 267],
        ['Você leva um passageiro.', 302, 267]
      ])
      expect(lido.fields).toEqual([
        { label: 'Heróico', value: 'Você não precisa da permissão do Mestre.', group: 'Habilidades' }
      ])
      expect(lido.rawText).toBe('Pegs Apoio nas rodas Você leva um passageiro.')
    })

    it('propõe o primeiro texto da página como nome, e não o nome do arquivo', () => {
      // O que existia era cair no arquivo, que dava "Ficha Kids on Bikes - Preenchida" de personagem.
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['11', 292, 739],
        ['Novo Aluno Misterioso', 136, 714]
      ])
      expect(lido.characterName).toBe('rodrigo barreto')
      // A idade está longe demais na horizontal pra ser a mesma frase que o nome.
      expect(lido.rawText).toContain('11')
      expect(lido.rawText).not.toContain('rodrigo barreto 11')
    })

    it('diz que a ficha é imagem — e não que "é um PDF de texto", que era falso', () => {
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['supersticioso', 128, 620],
        ['d20', 415, 689]
      ])
      expect(lido.warnings).toEqual(['arte-com-anotacao'])
      // E não o aviso de "é um PDF de texto", que era falso sobre este arquivo.
      expect(lido.warnings).not.toContain('sem-formulario')
    })

    it('não repete a mesma anotação escrita em duas páginas da arte', () => {
      /**
       * Na ficha real, "Você ganha +1 em testes de Luta." está escrito duas vezes: na página 1 como
       * "preta intensa" e na 2 como "bike preta intensa". A palavra "bike" faz parte do DESENHO na
       * primeira, e por isso o mesmo texto chega com dois rótulos.
       */
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['preta intensa : Você ganha +1 em testes de Luta.', 115, 511],
        ['bike preta intensa: Você ganha +1 em testes de Luta.', 306, 181]
      ])
      // Fica o rótulo mais completo — o que não perdeu uma palavra pro desenho.
      expect(lido.fields).toEqual([
        { label: 'bike preta intensa', value: 'Você ganha +1 em testes de Luta.', group: 'Habilidades' }
      ])
      /**
       * E a versão descartada NÃO volta pelo texto solto. Sem isto ela reaparecia ali, como se nunca
       * tivesse sido tratada — o mesmo conteúdo duas vezes na ficha, com dois nomes diferentes.
       */
      expect(lido.rawText ?? '').not.toContain('testes de Luta')
    })

    it('mantém os dois quando os rótulos são nomes diferentes de verdade', () => {
      // Sem esta ressalva, duas vantagens com a mesma descrição curta virariam uma só.
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['Heróico: ganha +1 na rolagem.', 101, 284],
        ['Durão: ganha +1 na rolagem.', 101, 191]
      ])
      expect(lido.fields.map((c) => c.label)).toEqual(['Heróico', 'Durão'])
    })

    it('não cria preset pro dado solto, mas cria pro que tem nome', () => {
      /**
       * Esta ficha tem "d20", "d12", "d10" escritos, um por atributo. Viram botões chamados "d20" —
       * que o app já tem — e nomeá-los direito exigiria saber de qual atributo cada um é, que é
       * exatamente o que não dá pra saber numa arte. Já "Adaga 1d4" se nomeia sozinho.
       */
      const lido = arteAnotada([
        ['rodrigo barreto', 81, 739],
        ['d20', 415, 689],
        ['Adaga 1d4', 45, 613]
      ])
      expect(lido.presets.map((p) => p.name)).toEqual(['Adaga 1d4'])
    })
  })

  it('não transforma REGRA impressa em preset', () => {
    /**
     * A ficha de Oblivio de verdade traz as regras do sistema impressas junto, e regra de RPG fala de
     * dado o tempo todo. Sem o corte por comprimento saíam presets chamados "permanentemente reduzido
     * em 1D4 pontos (" — os textos abaixo são exatamente os que ela produziu.
     */
    const enchimento = Array.from({ length: 25 }, (_, i) => texto(`linha ${i}`, 50, 500 - i * 12))
    const sheet = ficha([], [
      ...enchimento,
      texto('permanentemente reduzido em 1D4 pontos (', 50, 200),
      texto(': Adiciona 1d6 de dano ao “Bônus de Dano', 50, 180),
      texto('Adaga 1d4', 50, 160)
    ])
    const nomes = readSheet(sheet).presets.map((p) => p.name)
    expect(nomes).toEqual(['Adaga 1d4'])
  })

  it('avisa que o PDF é só IMAGEM quando não há texto pra ler', () => {
    // A ficha de Kids on Bikes que o usuário trouxe: 1,4 MB, duas páginas, UM fragmento de texto.
    // Sem este aviso, "não importei nada" pareceria defeito do app.
    const lido = readSheet(ficha([], [texto('Kids on Bikes', 50, 700)]))
    expect(lido.warnings).toContain('pdf-sem-texto')
    expect(lido.presets).toEqual([])
  })

  it('caixa marcada vira "sim", não "On"', () => {
    // Na ficha do Matais saíam linhas "Simples = On", que é o estado interno do PDF, não informação.
    const sheet = ficha(
      [{ ...campo('Simples', 'On', [100, 500, 140, 512]), type: 'checkbox' }],
      [texto('SIMPLES', 60, 502)]
    )
    expect(readSheet(sheet).fields).toEqual([{ label: 'SIMPLES', value: 'sim', fieldName: 'Simples' }])
  })

  it('avisa quando a ficha é o modelo em branco', () => {
    const lido = readSheet(ficha([campo('Personagem', ''), campo('AGI', '')]))
    expect(lido.warnings).toContain('formulario-vazio')
  })

  it('cai no nome do arquivo quando a ficha não diz o nome do personagem', () => {
    const lido = readSheet(ficha([campo('x1', '3')], [], 'Riebeck.pdf'))
    expect(lido.characterName).toBe('Riebeck')
  })
})

describe('leitor de Ordem Paranormal', () => {
  const sheet = ficha(
    [
      campo('Personagem', 'Riebeck'),
      campo('Classe', 'Especialista'),
      campo('peat', '9'),
      ...ATRIBUTOS,
      ...ataque(0, 'Faca', '+7', '1d4+2'),
      ...ataque(1, 'Pistola', '+5', '2d6'),
      ...ataque(2, '', '+3', '1d6')
    ],
    [texto('DE ESFORÇO', 200, 300)]
  )
  const lido = readSheet(sheet)

  it('cada ataque vira DOIS presets: teste e dano', () => {
    expect(lido.presets.filter((p) => p.kind === 'test').map((p) => p.name)).toEqual([
      'Faca (teste)',
      'Pistola (teste)'
    ])
    expect(lido.presets.filter((p) => p.kind === 'damage').map((p) => p.name)).toEqual([
      'Faca (dano)',
      'Pistola (dano)'
    ])
  })

  it('a coluna TESTE traz só o bônus, e vira 1d20 + bônus', () => {
    const teste = lido.presets.find((p) => p.name === 'Faca (teste)')
    expect(teste?.expression).toEqual({
      groups: [{ sides: 20, count: 1 }],
      modifiers: [{ type: 'flat', value: 7 }]
    })
  })

  it('linha sem nome não vira preset', () => {
    // A grade tem seis linhas e ninguém preenche todas — importar "linha 3" seria preset fantasma.
    expect(lido.presets.some((p) => p.name.startsWith(' ') || p.name.startsWith('('))).toBe(false)
    expect(lido.presets.filter((p) => p.kind === 'test' || p.kind === 'damage')).toHaveLength(4)
  })

  it('rotula os campos conhecidos por conta própria, corrigindo o genérico', () => {
    /**
     * `peat` (PE atual) tem "DE ESFORÇO" como texto impresso mais próximo, porque o rótulo de
     * verdade está diagramado longe. O leitor dedicado sabe o que é o campo e não depende disso.
     */
    expect(lido.fields).toContainEqual({ label: 'PE atual', value: '9', group: 'Recursos' })
    expect(lido.fields.some((campo) => campo.label === 'DE ESFORÇO')).toBe(false)
  })

  it('não repete o ataque como anotação, já que ele virou preset', () => {
    expect(lido.fields.some((campo) => campo.value === '1d4+2')).toBe(false)
  })

  it('acha o ATRIBUTO entre vários campos de mesmo nome, pelo rótulo impresso', () => {
    /**
     * O bug mais caro do importador até agora, e invisível na ficha em branco.
     *
     * No PDF real de Ordem Paranormal os nomes de campo se REPETEM: `INT` aparece 11 vezes, `PRE`
     * 10, `AGI` 8. A primeira é o atributo; as outras são a coluna de atributo de cada perícia, que
     * a ficha batizou igual. Um índice por nome fica com a ÚLTIMA, que é sempre uma perícia — e o
     * sintoma não foi um valor errado, foi os cinco atributos SUMIREM da importação.
     *
     * Só apareceu ao testar com valores preenchidos: em branco todos valiam "0" e tanto fazia qual
     * fosse lido.
     */
    const comRepetidos = ficha(
      [
        campo('Personagem', 'Riebeck', [100, 700, 200, 712]),
        // O atributo: rótulo impresso com a palavra inteira.
        campo('AGI', '3', [100, 600, 140, 612]),
        // A coluna de atributo de uma perícia: mesmo nome, rótulo abreviado, valor diferente.
        campo('AGI', '9', [400, 500, 440, 512]),
        campo('FOR', '1'),
        campo('INT', '2'),
        campo('PRE', '2'),
        campo('VIG', '1'),
        ...ataque(0, 'Faca', '+7', '1d4+2')
      ],
      [texto('AGILIDADE', 60, 602), texto('AGI', 365, 502), texto('PERSONAGEM', 70, 702)]
    )
    const comRepetidosLido = readSheet(comRepetidos)
    // `roll` junto: o atributo lido é o que vira botão de dado na ficha, com a regra de Ordem
    // Paranormal (3 de Agilidade = role 3d20 e fique com o maior). Ver `sheetRoll.ts`.
    expect(comRepetidosLido.fields).toContainEqual({
      label: 'Agilidade',
      value: '3',
      group: 'Atributos',
      roll: 'pool-d20'
    })
    // E a ocorrência da perícia não entra como linha solta: sem nome de perícia ao lado, é ruído.
    expect(comRepetidosLido.fields.some((c) => c.value === '9')).toBe(false)
  })

  it('o teste com MAIS DE UM dado vira "role e use o maior"', () => {
    /**
     * A regra de Ordem Paranormal: teste com atributo 2 é "role 2d20 e fique com o melhor", não a
     * soma dos dois. Somar dá em média 21 onde a regra dá 13,8 — e era o que o preset importado
     * fazia, com um aviso pedindo que a pessoa corrigisse de cabeça.
     */
    const sheet = ficha([...ATRIBUTOS, ...ataque(0, 'Faca', '2d20', '1d4+2')])
    const lido = readSheet(sheet)
    const teste = lido.presets.find((p) => p.name === 'Faca (teste)')
    expect(teste!.expression.keep).toEqual({ mode: 'highest', count: 1 })
    // Dano soma, sempre.
    expect(lido.presets.find((p) => p.name === 'Faca (dano)')!.expression.keep).toBeUndefined()
  })

  it('teste de UM dado só não ganha regra nenhuma', () => {
    // Com um dado não há o que escolher, e a regra só encheria o rótulo do preset.
    const sheet = ficha([...ATRIBUTOS, ...ataque(0, 'Faca', '+7', '1d4+2')])
    const teste = readSheet(sheet).presets.find((p) => p.name === 'Faca (teste)')
    expect(teste!.expression.groups).toEqual([{ sides: 20, count: 1 }])
    expect(teste!.expression.keep).toBeUndefined()
  })

  it('não repete a célula de dano como preset genérico', () => {
    // A coluna DANO tem rótulo impresso, então o genérico também a pescava: cada ataque saía duas
    // vezes, uma como "Faca (dano)" e outra como "DANO".
    expect(lido.presets.filter((p) => p.name === 'DANO')).toHaveLength(0)
  })

  /**
   * A grade de PERÍCIAS, que é o pedaço da ficha que mais quase deu errado.
   *
   * O nome de cada perícia não é campo — é texto impresso —, e o vizinho mais próximo do campo é a
   * abreviação do atributo ("AGI"), não o nome ("ACROBACIA"). A primeira versão do importador
   * produzia por isso quarenta linhas "PRE = 0", e as perícias acabaram ficando de fora com um aviso
   * na tela até dar pra medir o arquivo real.
   *
   * As coordenadas daqui são as MEDIDAS do PDF de Ordem Paranormal: nome em x≈349, abreviação em
   * x≈447, campo em x≈476. É o que faz este teste valer alguma coisa — com números inventados ele
   * passaria sem provar que a régua serve pra ficha de verdade.
   */
  function periciaNaGrade(linha: number, nome: string, valor: string, y: number): {
    fields: PdfField[]
    texts: PdfText[]
  } {
    return {
      fields: [
        campo(`Pericias.${linha}.1`, valor, [476, y, 500, y + 12]),
        campo(`Pericias.${linha}.3`, '', [520, y, 544, y + 12])
      ],
      texts: [texto(nome, 349, y), texto('AGI', 447, y, 15)]
    }
  }

  function fichaComPericias(linhas: [string, string][]): PdfSheet {
    const grade = linhas.map(([nome, valor], i) => periciaNaGrade(i, nome, valor, 664 - i * 18))
    return ficha(
      [campo('Personagem', 'Riebeck'), ...ATRIBUTOS, ...ataque(0, 'Faca', '+7', '1d4+2'), ...grade.flatMap((g) => g.fields)],
      grade.flatMap((g) => g.texts)
    )
  }

  it('importa a perícia com o NOME impresso, não com a abreviação do atributo ao lado', () => {
    const lidoComPericias = readSheet(
      fichaComPericias([
        ['ACROBACIA', '5'],
        ['LUTA', '10'],
        ['SOBREVIVÊNCIA', '2']
      ])
    )
    const pericias = lidoComPericias.fields.filter((c) => c.group === 'Perícias')
    expect(pericias.map((c) => `${c.label}=${c.value}`)).toEqual([
      'Acrobacia=5',
      'Luta=10',
      'Sobrevivência=2'
    ])
    // O acento sobrevive ao caixa-baixa: `toLocaleLowerCase('pt-BR')`, não o do sistema.
    expect(pericias.some((c) => c.label === 'AGI')).toBe(false)
  })

  it('a perícia NÃO treinada vem como LACUNA — a linha existe, o zero não', () => {
    /**
     * Esta regra já foi o contrário, e as duas versões vieram do usuário.
     *
     * Antes, perícia zerada ficava de fora: a ficha tem 29 linhas, quem não treinou nada fica com 29
     * zeros, e ele tinha reclamado que a importação "fica uma bagunça, não dá para entender". Zero
     * ali não é informação, é a ausência dela.
     *
     * Depois veio o outro lado, e é de mesa: "coloca lacunas para TUDO que é preenchível, porque às
     * vezes precisamos preencher no app também mesmo que não tenha, porque é um item novo na
     * sessão". Perícia que ninguém treinou passa a estar treinada no meio da sessão, e sem a linha
     * não há onde escrever.
     *
     * O que reconcilia os dois é o VALOR: a linha vem, o zero não. Lacuna é espaço pra preencher;
     * "0" escrito seria uma afirmação que ninguém fez.
     */
    const lidoComZeros = readSheet(
      fichaComPericias([
        ['ACROBACIA', '0'],
        ['LUTA', '5'],
        ['MEDICINA', '0']
      ])
    )
    const pericias = lidoComZeros.fields.filter((c) => c.group === 'Perícias')
    expect(pericias.map((c) => `${c.label}=${c.value}`)).toEqual(['Acrobacia=', 'Luta=5', 'Medicina='])
    // E nenhum aviso sobrando dizendo que perícias não são importadas — elas são.
    expect(lidoComZeros.warnings).toEqual([])
  })

  it('tira a lacuna de preencher à mão do nome — "PROFISSÃO* (__________)" vira "Profissão"', () => {
    const lidoComProfissao = readSheet(fichaComPericias([['PROFISSÃO* (__________)', '3']]))
    expect(lidoComProfissao.fields.filter((c) => c.group === 'Perícias')).toEqual([
      { label: 'Profissão', value: '3', group: 'Perícias', fieldName: 'Pericias.0.1' }
    ])
  })

  it('diz o sistema e o nome do personagem', () => {
    expect(lido.system).toBe('Ordem Paranormal')
    expect(lido.characterName).toBe('Riebeck')
  })
})

describe('leitor de Oblivio — ficha SEM formulário', () => {
  /**
   * A ficha de Oblivio não tem campo preenchível nenhum: é documento do Google Docs exportado, e
   * quem preenche digita dentro dele. Os textos abaixo são do arquivo de verdade.
   */
  const oblivio = ficha(
    [],
    [
      texto('Nome: Rodrigo Barreto', 108, 680),
      texto('Papel: Quem Age', 108, 653),
      texto('Carne:', 108, 304, 30),
      texto('2/10', 153, 304),
      texto('Força:', 108, 242, 30),
      texto('1/10', 150, 242),
      texto('Prontidão:', 108, 164, 50),
      texto('4/10', 178, 164),
      texto('Determinação:', 108, 100, 60),
      texto('1/10', 190, 100),
      texto('Mente:', 108, 86, 30),
      texto('2/10', 150, 86),
      texto('Coragem:', 300, 304, 45),
      texto('1/10', 360, 304),
      texto('Dor:', 300, 242, 20),
      texto('2/10', 330, 242),
      texto('Fôlego:', 300, 164, 35),
      texto('1/10', 345, 164),
      texto('Proteção:', 300, 100, 45),
      texto('3/10', 360, 100),
      texto('Velocidade:', 300, 86, 55),
      texto('2/10', 370, 86),
      texto('Torso:', 500, 304, 30),
      texto('0/5', 545, 304)
    ]
  )

  it('é reconhecida pelos dez atributos, e não pelo nome do sistema', () => {
    // "Oblivio" não aparece escrito em lugar nenhum do arquivo — conferido nas duas versões.
    expect(oblivioReader.detect(oblivio)).toBeGreaterThan(0.8)
    expect(readSheet(oblivio).readerId).toBe('oblivio')
  })

  it('não reclama de ficha COM formulário', () => {
    // Um PDF com campos preenchíveis é outra coisa, mesmo que por acaso tenha rótulos parecidos.
    expect(oblivioReader.detect(ficha([campo('Carne', '2')]))).toBe(0)
  })

  it('lê o personagem e agrupa atributos e corpo', () => {
    const lido = readSheet(oblivio)
    expect(lido.system).toBe('Oblivio')
    expect(lido.characterName).toBe('Rodrigo Barreto')
    expect(lido.fields).toContainEqual({ label: 'Nome', value: 'Rodrigo Barreto', group: 'Identificação' })
    expect(lido.fields).toContainEqual({ label: 'Carne', value: '2/10', group: 'Atributos' })
    expect(lido.fields).toContainEqual({ label: 'Torso', value: '0/5', group: 'Corpo' })
  })
})

/**
 * O EQUIPAMENTO CARREGADO da ficha de Oblivio, sem depender do PDF (ele está no `.gitignore`).
 *
 * Os fragmentos abaixo são os do arquivo real, medidos: o extrator quebra a linha em pedaços
 * ("Espaços de Inventário", ": 1. /", "Limite de Estresse:"), e a região vem em duas partes — o
 * marcador "○" e o rótulo "Torso:". Reproduzir esse picotado é o ponto: um fixture "arrumado"
 * passaria sem provar que o leitor aguenta o formato de verdade.
 */
describe('equipamento carregado (Oblivio)', () => {
  function linha(text: string, y: number): PdfText {
    return { text, page: 1, x: 100, y, width: text.length * 6, height: 12 }
  }

  /** Os dez rótulos que fazem o leitor de Oblivio reconhecer a ficha (ver o `detect` dele). */
  const IMPRESSAO_DIGITAL = [
    'Carne:',
    'Força:',
    'Prontidão:',
    'Determinação:',
    'Mente:',
    'Coragem:',
    'Dor:',
    'Fôlego:',
    'Proteção:',
    'Velocidade:'
  ].map((texto, i) => linha(texto, 700 - i * 20))

  const EQUIPAMENTO: [string, number][] = [
    ['Equipamentos Carregados:', 400],
    ['○', 380],
    ['Torso:', 380],
    ['Vestimenta Leve', 360],
    ['Espaços de Inventário', 340],
    [': 1. /', 340],
    ['Limite de Estresse:', 340],
    ['6. /', 340],
    ['Bônus de Proteção:', 340],
    ['+1.', 340],
    ['○', 320],
    ['Braço Direito:', 320],
    ['○', 300],
    ['Braço Esquerdo:', 300],
    ['Lâmina Curta (Adaga, Faca, Punhal…)', 280],
    ['Espaços de Inventário', 260],
    [': 2. /', 260],
    ['Limite de Estresse:', 260],
    ['3. /', 260],
    ['Dano:', 260],
    ['1D4 PE. /', 260],
    ['Alcance:', 260],
    ['1.', 260],
    ['Equipamentos Guardados:', 200],
    ['○', 180],
    ['Perna Direita:', 180]
  ]

  function fichaCom(linhas: [string, number][]): PdfSheet {
    return {
      fileName: 'oblivio.pdf',
      pageCount: 9,
      fields: [],
      texts: [...IMPRESSAO_DIGITAL, ...linhas.map(([t, y]) => linha(t, y))]
    }
  }

  it('lê o item de cada região, e ignora as regiões vazias', () => {
    const lido = readSheet(fichaCom(EQUIPAMENTO))
    const equipamento = lido.fields.filter((c) => c.group === 'Equipamento')

    expect(equipamento.map((c) => c.label)).toEqual(['Torso', 'Braço Esquerdo'])
    expect(equipamento[0].value).toContain('Vestimenta Leve')
    expect(equipamento[1].value).toContain('Lâmina Curta')
  })

  it('para em "Equipamentos Guardados" — o que está guardado não está em uso', () => {
    const lido = readSheet(fichaCom(EQUIPAMENTO))
    expect(lido.fields.filter((c) => c.group === 'Equipamento').map((c) => c.label)).not.toContain('Perna Direita')
  })

  it('a arma que diz o próprio dano vira preset, com nome curto', () => {
    const lido = readSheet(fichaCom(EQUIPAMENTO))
    const arma = lido.presets?.find((p) => /Lâmina/.test(p.name))

    expect(arma?.name).toBe('Lâmina Curta (dano)')
    expect(arma?.expression.groups).toEqual([{ count: 1, sides: 4 }])
    // A vestimenta NÃO vira preset: ela não tem dano, tem bônus de proteção.
    expect(lido.presets?.some((p) => /Vestimenta/.test(p.name))).toBe(false)
  })

  it('ficha sem a seção de equipamento não ganha campo nenhum a mais', () => {
    const lido = readSheet(fichaCom([['Mazelas', 400]]))
    expect(lido.fields.filter((c) => c.group === 'Equipamento')).toEqual([])
  })

  /**
   * O INVENTÁRIO GUARDADO — reporte de tester: os itens digitados em "Equipamentos Guardados"
   * não eram importados (a seção só servia de marcador de fim dos carregados). Ali não há regiões
   * do corpo: é lista livre do Google Docs, um item por marcador, e o "● Mod:" aninhado pertence
   * ao item de cima (mesmo formato visto nos carregados da ficha real).
   */
  const GUARDADOS: [string, number][] = [
    ['Equipamentos Guardados:', 200],
    ['○', 180],
    ['Corda de Escalada', 180],
    ['Espaços de Inventário', 176],
    [': 1.', 176],
    ['○', 160],
    ['Besta de Mão (Pistola, Garrucha…)', 160],
    ['Dano:', 156],
    ['1D6 PE. /', 156],
    ['●', 150],
    ['Mod:', 150],
    ['Mortal: Adiciona 1d6 de dano.', 150],
    ['Espaço Livre', 100]
  ]

  it('lê os itens guardados, um por marcador, com o Mod colado no item de cima', () => {
    // `slice(0, -3)` tira o "Equipamentos Guardados: ○ Perna Direita:" do fixture de cima — o
    // título vem do fixture de GUARDADOS, senão a seção apareceria duas vezes.
    const lido = readSheet(fichaCom([...EQUIPAMENTO.slice(0, -3), ...GUARDADOS]))
    const guardados = lido.fields.filter((c) => c.group === 'Inventário')

    expect(guardados.map((c) => c.label)).toEqual(['Corda de Escalada', 'Besta de Mão'])
    expect(guardados[1].value).toContain('Mod: Mortal')
  })

  it('arma guardada que diz o próprio dano também vira preset', () => {
    const lido = readSheet(fichaCom([...EQUIPAMENTO.slice(0, -3), ...GUARDADOS]))
    const besta = lido.presets?.find((p) => /Besta/.test(p.name))

    expect(besta?.name).toBe('Besta de Mão (dano)')
    expect(besta?.expression.groups).toEqual([{ count: 1, sides: 6 }])
    // A corda não vira preset: não tem dano.
    expect(lido.presets?.some((p) => /Corda/.test(p.name))).toBe(false)
  })

  it('guardados sem marcador nenhum entram como um item só — importar em bloco é melhor que perder', () => {
    const lido = readSheet(
      fichaCom([
        ['Equipamentos Guardados:', 200],
        ['Lanterna, corda e três tochas', 180],
        ['Espaço Livre', 100]
      ])
    )
    const guardados = lido.fields.filter((c) => c.group === 'Inventário')
    expect(guardados).toHaveLength(1)
    expect(guardados[0].value).toBe('Lanterna, corda e três tochas')
  })

  /**
   * GOLPE COM TESTE — reporte de tester: o golpe entra como habilidade (parágrafo rotulado com o
   * nome), tinha o dado do teste escrito dentro, e nenhum preset nascia. A âncora na palavra
   * Teste/Dano é o que deixa criar preset de prosa aqui sem repetir o lixo que proibiu isso no
   * genérico ("permanentemente reduzido em 1D4 pontos" não tem âncora e continua de fora).
   */
  it('golpe com o dado do teste no texto vira preset com o nome do golpe', () => {
    const lido = readSheet(
      fichaCom([['Corte Cruel: Realize um Teste de Combate com 2D6+1 contra o alvo à sua frente', 400]])
    )
    const golpe = lido.presets?.find((p) => p.name === 'Corte Cruel')

    expect(golpe?.kind).toBe('test')
    expect(golpe?.expression.groups).toEqual([{ count: 2, sides: 6 }])
    expect(golpe?.expression.modifiers).toEqual([{ type: 'flat', value: 1 }])
  })

  /**
   * O ESPAÇO LIVRE — regra do usuário: "qualquer anotação de player no pdf precisamos trazer". No
   * modelo em branco a área é vazia (conferido nos dois PDFs), então tudo que aparece ali é
   * digitado pelo jogador — na ficha real eram as habilidades GERAIS dele, perdidas inteiras.
   */
  it('o que o jogador digitou no Espaço Livre chega, e área vazia não rende nada', () => {
    const lido = readSheet(
      fichaCom([
        ['Espaço Livre', 400],
        ['Aprimoramento de Estresse (Efeito Passivo)', 380],
        ['Aumente seu limite máximo de Estresse em +3.', 376],
        ['Inventário', 300],
        ['Espaço Livre', 200],
        ['Use esse espaço para fazer anotações, caso necessário.', 180],
        ['Mazelas', 100]
      ])
    )

    // A primeira área veio inteira; a segunda, só com a instrução impressa, não rende nada.
    expect(lido.rawText).toContain('Aprimoramento de Estresse')
    expect(lido.rawText).toContain('Aumente seu limite máximo')
    expect(lido.rawText).not.toContain('Use esse espaço')
    expect(lido.rawText).not.toContain('Inventário')
  })

  it('ficha sem nada digitado nos espaços livres fica sem texto solto', () => {
    const lido = readSheet(
      fichaCom([
        ['Espaço Livre', 400],
        ['Inventário', 300]
      ])
    )
    expect(lido.rawText ?? '').toBe('')
  })

  it('o item que já virou preset pelo leitor não ganha um segundo botão pela região do corpo', () => {
    // A "Lâmina Curta" no braço esquerdo diz "Dano: 1D4": o leitor faz "Lâmina Curta (dano)", e a
    // leitura em prosa (que agora vale pra toda ficha) NÃO pode fazer "Braço Esquerdo (dano)" em cima.
    const lido = readSheet(fichaCom(EQUIPAMENTO))
    const nomes = lido.presets.map((p) => p.name)
    expect(nomes).toContain('Lâmina Curta (dano)')
    expect(nomes.some((n) => /Braço|Torso/.test(n))).toBe(false)
    expect(lido.presets.filter((p) => p.kind === 'damage')).toHaveLength(1)
  })

  it('os fragmentos da mesma linha do Espaço Livre viram uma linha só, e não uma palavra por linha', () => {
    const lido = readSheet(
      fichaCom([
        ['Espaço Livre', 400],
        ['Cão Velho (Efeito Passivo)', 380],
        ['Náusea', 360],
        ['ou', 360],
        ['Sem', 360],
        ['Fôlego', 360],
        ['.', 360],
        ['Inventário', 300]
      ])
    )
    expect(lido.rawText).toBe('Cão Velho (Efeito Passivo)\nNáusea ou Sem Fôlego.')
  })

  it('golpe que também diz o dano ganha o segundo preset, e prosa sem âncora não ganha nenhum', () => {
    const lido = readSheet(
      fichaCom([
        ['Investida Feroz: Teste de Prontidão com 1D20 e, ao acertar, Dano: 2D4+2 na região atingida', 400],
        ['Fardo Sombrio: seu atributo é permanentemente reduzido em 1D4 pontos ao usar esta técnica', 380]
      ])
    )

    expect(lido.presets?.find((p) => p.name === 'Investida Feroz')?.kind).toBe('test')
    expect(lido.presets?.find((p) => p.name === 'Investida Feroz (dano)')?.expression.groups).toEqual([
      { count: 2, sides: 4 }
    ])
    expect(lido.presets?.some((p) => /Fardo Sombrio/.test(p.name))).toBe(false)
  })
})

/**
 * Dois achados da revisão de código sobre as LACUNAS, cada um com o cenário que escapou dos testes
 * de então — que só cobriam a ficha em branco.
 */
describe('lacunas — os achados da revisão', () => {
  it('ritual e item PREENCHIDOS entram uma vez só, com o nome da lacuna', () => {
    /**
     * O genérico achava "RITUAIS 1" pelo nome do campo e `lacunasNumeradas` acrescentava "Ritual 1"
     * por cima: o mesmo ritual, duas linhas, dois rótulos. Passava porque o teste da ficha real só
     * conferia o caso vazio (`not.toContain('Ritual 1')`).
     */
    const lido = readSheet(
      ficha([
        campo('Personagem', 'Riebeck'),
        ...ATRIBUTOS,
        campo('RITUAIS 1', 'Enfeitiçar'),
        campo('ITEM 3', 'Lanterna'),
        campo('ITEM 2_2', 'Corda')
      ])
    )
    const rituais = lido.fields.filter((c) => c.group === 'Rituais' && c.value)
    expect(rituais).toEqual([{ label: 'Ritual 1', value: 'Enfeitiçar', group: 'Rituais', fieldName: 'RITUAIS 1' }])
    expect(lido.fields.some((c) => /^RITUAIS|^ITEM/.test(c.label))).toBe(false)

    const itens = lido.fields
      .filter((c) => c.group === 'Itens' && c.value)
      .map((c) => `${c.label}=${c.value} (${c.fieldName})`)
    // A numeração é pela POSIÇÃO na ordem numérica dos campos, primeira página e depois a segunda:
    // na ficha real, que tem todos os campos, isso coincide com o número impresso.
    expect(itens).toEqual(['Item 1=Lanterna (ITEM 3)', 'Item 2=Corda (ITEM 2_2)'])
  })

  it('formulário em branco, SEM texto impresso, não ganha o nome do arquivo como personagem', () => {
    /**
     * A regra anterior exigia "nenhum campo de formulário" pra chamar o arquivo de vazio — e um
     * modelo preenchível em branco tem cinquenta campos, todos vazios, e nenhuma letra na página.
     * Ele passava pelo buraco e propunha "Ficha Kids on Bikes" como nome do personagem.
     */
    const vazios = Array.from({ length: 50 }, (_, i) => campo(`campo_${i}`, ''))
    const lido = readSheet(ficha(vazios, [], 'Ficha Kids on Bikes.pdf'))
    expect(lido.readerId).toBe('generico')
    expect(lido.fields).toEqual([])
    expect(lido.characterName).toBe('')
    expect(lido.warnings).toContain('formulario-vazio')
  })
})

/**
 * O TAMANHO de um nome de rolagem no texto impresso — achado da quinta leva de PDFs de teste.
 */
describe('preset do texto — linha de arma mais longa que 28 caracteres', () => {
  it('a arma com o dado no FIM da linha passa; a regra em corrido, com palavras depois do dado, não', () => {
    const lido = readSheet(
      ficha(
        [],
        [
          texto('Faca de cozinha  dano 1d4+2', 72, 425),
          texto('Espingarda calibre 12  dano 2d6+4', 72, 410),
          texto('dano de queda é 1d6 por 3 metros e mais', 72, 395),
          texto('Um parágrafo inteiro de regra que termina com um dado de 20d6', 72, 380)
        ]
      )
    )
    const nomes = (lido.presets ?? []).map((p) => p.name)
    expect(nomes).toContain('Faca de cozinha  dano 1d4+2')
    expect(nomes).toContain('Espingarda calibre 12  dano 2d6+4')
    expect(nomes.some((n) => n.includes('queda'))).toBe(false)
    expect(nomes.some((n) => n.includes('parágrafo'))).toBe(false)
  })
})

/**
 * O TÍTULO da ficha não é nome de personagem — achado da quinta leva, na importação pela tela.
 */
describe('nome pela posição — o título impresso da ficha fica de fora', () => {
  it('arte achatada com "KIDS ON BIKES / CHARACTER SHEET" no alto não propõe nome', () => {
    const lido = readSheet(
      ficha([], [texto('KIDS ON BIKES', 200, 760), texto('CHARACTER SHEET', 200, 740), texto('X', 120, 500)])
    )
    expect(lido.characterName).toBe('')
    expect(lido.fields).toEqual([])
  })

  it('"FICHA DE PERSONAGEM" e "Investigator" também não', () => {
    for (const titulo of ['FICHA DE PERSONAGEM', 'Investigator', 'Personagem']) {
      const lido = readSheet(ficha([], [texto(titulo, 200, 760), texto('X', 120, 500)]))
      expect(lido.characterName, titulo).toBe('')
    }
  })
})

/**
 * O que os três LIVROS DE REGRAS de Pathfinder 2e (322 a 466 páginas) ensinaram ao importador,
 * quando o usuário os pôs na pasta de fichas.
 */
describe('livro não é ficha', () => {
  it('acima do teto de páginas: só o aviso, sem nome, sem campo, sem preset', () => {
    const livro: PdfSheet = {
      fileName: 'Pathfinder 2e - GM Core Remaster.pdf',
      pageCount: 338,
      fields: [],
      texts: [texto('Nome: Impostor', 72, 700), texto('Você sofre 5d6 de dano', 72, 680)]
    }
    const lido = readSheet(livro)
    expect(lido.warnings).toEqual(['paginas-demais'])
    expect(lido.characterName).toBe('')
    expect(lido.fields).toEqual([])
    expect(lido.presets).toEqual([])
  })

  it('o campo "Character Sheet" com uma frase inteira não é nome de personagem', () => {
    const lido = readSheet(
      ficha(
        [],
        [
          texto('Character Sheet: Each player will need a character sheet to create their character and to record what happens.', 72, 700),
          texto('Dice: The players and GM will need at least one set of polyhedral dice.', 72, 680),
          texto('Adventure: Every table needs an adventure to play.', 72, 660)
        ]
      )
    )
    // A frase não vira nome. (O que pode sobrar é o palpite pelo nome do ARQUIVO, que é outra regra.)
    expect(lido.characterName).not.toMatch(/Each player/)
    expect(lido.characterName.length).toBeLessThanOrEqual(60)
  })

  it('nome que é frase (com ponto) não é nome', () => {
    const lido = readSheet(ficha([campo('Nome', 'Ele chegou. E ficou por lá')]))
    expect(lido.characterName).not.toContain('Ele chegou')
    const curto = readSheet(ficha([campo('Nome', 'Rilver')]))
    expect(curto.characterName).toBe('Rilver')
  })

  it('preset do texto precisa da FORMA de arma: nome antes do dado, no máximo uma palavra depois', () => {
    const lido = readSheet(
      ficha(
        [],
        [
          texto('Espada longa 1d8 cortante', 72, 700),
          texto('Shortbow 1d8 P', 72, 685),
          texto('2d6 bludgeoning', 72, 670),
          texto('You take 5d6 damage of the', 72, 655),
          texto('every 1d20 minutes (1 day)', 72, 640),
          texto('enfeebled 4 (1 day);', 72, 625)
        ]
      )
    )
    const nomes = (lido.presets ?? []).map((p) => p.name)
    expect(nomes).toEqual(['Espada longa 1d8 cortante', 'Shortbow 1d8 P'])
  })
})

describe('leitor de Ordem Paranormal — a ficha da comunidade', () => {
  /**
   * O SEGUNDO modelo do mesmo sistema, chegado na ficha real do Vincenzo: atributos `atr_*`,
   * perícias em três campos (t_/o_/b_, com o total calculado por JavaScript), grade de armas
   * `atq_name/dano_arma`, e Classe/Origem como lista (o índice vira rótulo na varredura).
   */
  const sheet = ficha([
    campo('Nome do Personagem', 'Vincenzo Moretti'),
    campo('Nome', 'Guga'),
    campo('atr_agi', '1'),
    campo('atr_for', '1'),
    campo('atr_int', '5'),
    campo('atr_pre', '3'),
    campo('atr_vig', '1'),
    campo('NivelExposicao', '65'),
    campo('classe', 'Especialista'),
    campo('origem', 'Agente de Saúde'),
    campo('PV', '65'),
    campo('pv_atual', '51'),
    campo('t_medicina', '10'),
    campo('o_medicina', '5'),
    campo('b_diplomacia', '10'),
    campo('t_luta', '0'),
    campo('atq_name0', 'pistola molto poggers'),
    campo('dano_arma0', '1d12'),
    campo('critico_arma0', '18'),
    campo('atq_name1', 'martello'),
    campo('dano_arma1', '1d6'),
    campo('Habilidade_1', 'Conhecimento Aplicado'),
    campo('HABILIDADES  RITUAIS 1.0.0', 'Velocità Mortale'),
    campo('Custo 1.0.0', '3PE'),
    campo('Página 1.0.0', '150'),
    campo('ITEM 1', 'kit médico'),
    campo('morte', '10'),
    campo('corte', '0')
  ])
  const lido = readSheet(sheet)

  it('é reconhecida como Ordem Paranormal, com o nome do agente', () => {
    expect(lido.readerId).toBe('ordem-paranormal')
    expect(lido.system).toBe('Ordem Paranormal')
    expect(lido.characterName).toBe('Vincenzo Moretti')
  })

  it('atributos rolam a regra do sistema, e o NEX sai legível', () => {
    expect(lido.fields).toContainEqual(
      expect.objectContaining({ label: 'Intelecto', value: '5', group: 'Atributos', roll: 'pool-d20' })
    )
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'NEX', value: '65%' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Classe', value: 'Especialista' }))
  })

  it('perícia usa o total calculado; total vazio refaz treino + outros; zero vira lacuna', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Diplomacia', value: '10', group: 'Perícias' }))
    // b_medicina não está gravado: 15 = t_medicina 10 + o_medicina 5, a conta que o PDF faria.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Medicina', value: '15' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Luta', value: '' }))
  })

  it('cada arma vira resumo e preset de dano, e nada da grade vaza cru', () => {
    expect(lido.presets.map((p) => p.name)).toContain('martello (dano)')
    expect(lido.presets.map((p) => p.name)).toContain('pistola molto poggers (dano)')
    expect(lido.fields).toContainEqual(
      expect.objectContaining({ label: 'pistola molto poggers', value: '1d12 · crítico 18', group: 'Ataques' })
    )
    expect(lido.fields.some((c) => /^(t|b|o)_|^atq_|^dano_/.test(c.label))).toBe(false)
  })

  it('habilidades, ritual com custo e página, itens e só as resistências não-zero', () => {
    expect(lido.fields).toContainEqual(
      expect.objectContaining({ label: 'Velocità Mortale', value: 'custo 3PE · pág. 150' })
    )
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Item 1', value: 'kit médico', group: 'Itens' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Morte', value: '10', group: 'Resistências' }))
    expect(lido.fields.some((c) => c.label === 'Corte')).toBe(false)
  })

  it('a ficha OFICIAL continua no caminho de sempre — os dois modelos convivem', () => {
    const oficial = ficha([campo('Personagem', 'Riebeck'), ...ATRIBUTOS, ...ataque(0, 'Faca', '+7', '1d4+2')])
    const lidoOficial = readSheet(oficial)
    expect(lidoOficial.readerId).toBe('ordem-paranormal')
    expect(lidoOficial.fields).toContainEqual(expect.objectContaining({ label: 'Agilidade', value: '2' }))
  })
})

describe('leitor de Assimilação', () => {
  /**
   * A ficha real (a do Kieran) é ARTE digitalizada com formulário por cima — zero texto impresso,
   * sondado página a página. A organização inteira sai dos NOMES DE CAMPO, e os números das
   * caixinhas marcadas entram como números: o nome de cada uma é pixel, e dizer mais seria
   * inventar.
   */
  const sheet = ficha([
    campo('Nome', 'Kieran Saad'),
    campo('Ocupacao', 'Antropólogo'),
    campo('geracao', 'Pós-Maresia'),
    campo('Evento', 'Escolher a pesquisa'),
    campo('Propositos_Pessoais', 'Descobrir sobre a Era Perdida'),
    campo('Propositos_Pessoais1', 'Reencontrar Fer'),
    campo('Proposito_Coletivo', ''),
    campo('Saude', '18'),
    campo('Det', '8'),
    campo('Ass', '2'),
    { name: 'Instinto_5', type: 'checkbox', value: 'Yes', page: 1, rect: [0, 0, 10, 10] },
    { name: 'Instinto_21', type: 'checkbox', value: 'Yes', page: 1, rect: [0, 0, 10, 10] },
    { name: 'Instinto_2', type: 'checkbox', value: 'Off', page: 1, rect: [0, 0, 10, 10] },
    { name: 'Aptidao40', type: 'checkbox', value: 'Yes', page: 1, rect: [0, 0, 10, 10] },
    { name: 'Aptidao6', type: 'checkbox', value: 'Yes', page: 1, rect: [0, 0, 10, 10] },
    { name: 'ptSaude12', type: 'checkbox', value: 'Off', page: 1, rect: [0, 0, 10, 10] },
    { name: 'Invent3', type: 'checkbox', value: 'Off', page: 2, rect: [0, 0, 10, 10] },
    campo('Car_1', 'Viajado (1pt) Todas as jogadas...'),
    campo('Assimilacao1', 'Consciência Mantenha um dado adicional...'),
    campo('Notas', 'Relógio de pulso da CASSIA.')
  ])
  const lido = readSheet(sheet)

  it('é reconhecida pela estrutura dos nomes de campo — a página nem tem texto', () => {
    expect(lido.readerId).toBe('assimilacao')
    expect(lido.system).toBe('Assimilação')
    expect(lido.characterName).toBe('Kieran Saad')
  })

  it('identificação e os três recursos, com os nomes por extenso', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Geração', value: 'Pós-Maresia', group: 'Identificação' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Propósito pessoal 2', value: 'Reencontrar Fer' }))
    // Lacuna com dono: o propósito coletivo em branco fica como espaço pra escrever.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Propósito coletivo', value: '' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Saúde', value: '18', group: 'Recursos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Determinação', value: '8' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Assimilação', value: '2' }))
  })

  it('as caixinhas marcadas viram UMA linha de números por grade — sem inventar nome de pixel', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Instintos marcados', value: '5, 21' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Aptidões marcadas', value: '6, 40' }))
    // Nenhuma caixa avulsa sobra como "Aptidao40 = sim", e as trilhas de recurso ficam de fora.
    expect(lido.fields.some((c) => /^(Instinto_|Aptidao\d|ptSaude|Invent)/.test(c.label))).toBe(false)
  })

  it('características e mutações vão pro bloco de Habilidades; Notas pra História', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Característica 1', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Assimilação 1', group: 'Habilidades' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Notas', group: 'História' }))
  })
})

/**
 * O JEITO DO OBLÍVIO, PRA TODA FICHA — pedido do usuário: "esse jeito do Oblívio, vamos deixar pra
 * TODAS as fichas". O golpe escrito em prosa com Teste/Dano e o dado na mesma frase vira preset
 * (`presetsDeProsa`, no `readSheet`), e a ficha de texto sem formulário não joga fora o que não
 * virou campo. Os testes de Oblívio acima continuam valendo: são o mesmo código.
 */
describe('golpe em prosa vira preset — em qualquer ficha', () => {
  it('formulário genérico: o "Nome:" que abre a frase nomeia o preset, e Teste/Dano dizem o tipo', () => {
    const lido = readSheet(
      ficha([
        campo(
          'Habilidades',
          'Corte Cruel: Realize um Teste de Combate com 2D6+1 contra o alvo. Investida Feroz: Teste de Prontidão com 1D20 e, ao acertar, Dano: 2D4+2 na região atingida.'
        )
      ])
    )
    expect(lido.readerId).toBe('generico')
    const golpes = lido.presets.filter((p) => /Corte Cruel|Investida Feroz/.test(p.name))
    expect(golpes.map((p) => `${p.kind} ${p.name}`)).toEqual([
      'test Corte Cruel',
      'test Investida Feroz',
      'damage Investida Feroz (dano)'
    ])
    expect(golpes[0].expression.groups).toEqual([{ count: 2, sides: 6 }])
    expect(golpes[0].expression.modifiers).toEqual([{ type: 'flat', value: 1 }])
    expect(golpes[2].expression.groups).toEqual([{ count: 2, sides: 4 }])
  })

  it('"ataque furtivo: 1d6" (a ficha de D&D do Go): a âncora dentro do nome ainda vale, e o tipo fica em aberto', () => {
    const lido = readSheet(ficha([campo('Características', '(ladino) ataque furtivo: 1d6')]))
    const furtivo = lido.presets.find((p) => /ataque furtivo/.test(p.name))
    expect(furtivo?.kind).toBe('other')
    expect(furtivo?.expression.groups).toEqual([{ count: 1, sides: 6 }])
    // "Teste: 2D6" e "Dano: 1d8" não são nome de golpe: quem nomeia é o campo.
    const semNome = readSheet(ficha([campo('Golpe especial', 'Teste: 2D6')]))
    expect(semNome.presets.some((p) => p.name === 'Golpe especial' && p.kind === 'test')).toBe(true)
    expect(semNome.presets.some((p) => p.name === 'Teste')).toBe(false)
  })

  it('o que vem DEPOIS do dado desempata: "3d6 extra damage" é dano, mesmo com "Attack" antes', () => {
    const lido = readSheet(ficha([campo('Features', 'Sneak Attack: deals 3d6 extra damage.')]))
    const furtivo = lido.presets.find((p) => /Sneak Attack/.test(p.name))
    expect(furtivo?.kind).toBe('damage')
    expect(furtivo?.name).toBe('Sneak Attack (dano)')
  })

  it('sem "Nome:" quem nomeia é o campo, e a segunda rolagem do mesmo bloco leva o dado no nome', () => {
    const lido = readSheet(ficha([campo('Features', 'attack roll 1d20 to hit; attack roll 1d8 to hit')]))
    const doBloco = lido.presets.filter((p) => p.kind === 'test')
    expect(doBloco.map((p) => p.name)).toEqual(['Features', 'Features 1d8'])
  })

  it('prosa de regra sem âncora continua não virando preset', () => {
    const lido = readSheet(
      ficha([campo('Habilidades', 'Fardo Sombrio: seu atributo é permanentemente reduzido em 1D4 pontos ao usar esta técnica')])
    )
    expect(lido.presets.some((p) => /Fardo Sombrio/.test(p.name))).toBe(false)
  })

  it('vale pros leitores dedicados também: uma habilidade escrita na ficha de Ordem vira o preset do golpe', () => {
    const lido = readSheet(
      ficha([
        campo('Personagem', 'Riebeck'),
        ...ATRIBUTOS,
        ...ataque(0, 'Faca', '+7', '1d4+2'),
        campo('Habilidades', 'Golpe Certeiro: Teste de Luta com 1d20+5 e Dano: 2d6 no alvo.')
      ])
    )
    expect(lido.readerId).toBe('ordem-paranormal')
    const nomes = lido.presets.map((p) => p.name)
    expect(nomes).toContain('Golpe Certeiro')
    expect(nomes).toContain('Golpe Certeiro (dano)')
    // E os presets que o leitor já fazia continuam lá, sem repetir.
    expect(nomes.filter((n) => /Faca/.test(n))).toHaveLength(2)
  })

  it('ficha de TEXTO sem formulário: o que não virou campo vai pro texto da ficha, sem o título nem o rótulo vazio', () => {
    const muitoTexto = Array.from({ length: 60 }, (_, i) => texto(`linha ${i}`, 50, 700 - i * 11))
    const lido = readSheet(
      ficha(
        [],
        [
          texto('FICHA DE PERSONAGEM', 50, 780),
          texto('Nome: Elias Ramos', 50, 760),
          texto('Ocupação:', 50, 740),
          texto('Deve 50 moedas ao ferreiro', 50, 720),
          ...muitoTexto
        ]
      )
    )
    expect(lido.readerId).toBe('generico')
    expect(lido.fields.find((c) => c.label === 'Nome')?.value).toBe('Elias Ramos')
    expect(lido.rawText).toContain('Deve 50 moedas ao ferreiro')
    expect(lido.rawText).toContain('linha 7')
    expect(lido.rawText).not.toContain('FICHA DE PERSONAGEM')
    expect(lido.rawText).not.toContain('Ocupação:')
    expect(lido.rawText).not.toContain('Elias Ramos')
  })
})

/**
 * O JEITO ESPECÍFICO das duas fichas de Ordem Paranormal — pedido do usuário: cada sistema raspado
 * "igual o de Oblívio, cada um com seu jeito específico dependendo do PDF". Medido nas fichas reais
 * do Vincenzo (comunidade) e do Matias (oficial) com a ferramenta de cobertura.
 */
describe('Ordem Paranormal — o que a ficha da comunidade ainda perdia', () => {
  const lido = readSheet(
    ficha([
      campo('Nome do Personagem', 'Vincenzo Moretti'),
      campo('atr_agi', '1'),
      campo('atr_for', '1'),
      campo('atr_int', '5'),
      campo('atr_pre', '3'),
      campo('atr_vig', '1'),
      campo('NivelExposicao', '65'),
      // O treinamento é um MENU na ficha ("TREINADO"/"VETERANO"/"EXPERT"), não um número.
      campo('t_medicina', 'VETERANO'),
      campo('o_medicina', '5'),
      campo('b_crime', '5'),
      campo('t_crime', 'TREINADO'),
      campo('Habilidade_1', 'Conhecimento Aplicado'),
      campo('Pagina_Hab_1', '37'),
      campo('san_extra', '-8'),
      campo('limite_1', '3'),
      campo('limite_2', '2'),
      campo('limite_3', '1'),
      campo('LIMITE DE', 'Médio'),
      campo('mod_extra', '25')
    ])
  )
  const valorDe = (label: string) => lido.fields.find((c) => c.label === label)?.value

  it('o grau de treino vai junto do total, e o total sem b_ é refeito pelo bônus do grau', () => {
    expect(valorDe('Medicina')).toBe('15 (Veterano)')
    expect(valorDe('Crime')).toBe('5 (Treinado)')
  })

  it('a página do livro anotada ao lado da habilidade vai junto', () => {
    expect(valorDe('Habilidade 1')).toBe('Conhecimento Aplicado (pág. 37)')
  })

  it('os "extra" dos recursos e os limites do inventário chegam com o rótulo impresso', () => {
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Sanidade extra', value: '-8', group: 'Recursos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Limite', value: 'I: 3 · II: 2 · III: 1', group: 'Inventário' }))
    expect(valorDe('Limite de')).toBe('Médio')
    expect(valorDe('Mod. extra')).toBe('25')
  })
})

describe('Ordem Paranormal — a quarta coluna da grade de ataques da ficha oficial', () => {
  it('"18/2" (crítico) vai na fonte do preset de dano, que é onde a arma aparece', () => {
    const lido = readSheet(
      ficha([
        campo('Personagem', 'Matias'),
        ...ATRIBUTOS,
        campo('Atq1.0.0.0.0', 'Ataque com Faca'),
        campo('Atq1.0.0.0.1', '2d20'),
        campo('Atq1.0.0.0.2', '2d6'),
        campo('Atq1.0.0.0.3', '18/2')
      ])
    )
    const dano = lido.presets.find((p) => p.name === 'Ataque com Faca (dano)')
    expect(dano?.source).toBe('2d6 · 18/2')
    // Sem a quarta coluna, a fonte continua sendo só o dano.
    const semExtra = readSheet(ficha([campo('Personagem', 'Matias'), ...ATRIBUTOS, ...ataque(0, 'Faca', '+7', '1d4+2')]))
    expect(semExtra.presets.find((p) => p.name === 'Faca (dano)')?.source).toBe('1d4+2')
  })
})
