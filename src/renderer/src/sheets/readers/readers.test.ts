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

  it('ignora campo sem rótulo impresso E com nome sem significado', () => {
    // Uma linha "1_2 → 7" na conferência não informa nada e faz duvidar do resto da leitura.
    const lido = readSheet(ficha([campo('1_2', '7')]))
    expect(lido.fields).toEqual([])
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

  it('deixa de fora a perícia NÃO treinada, em vez de despejar 29 zeros na ficha', () => {
    /**
     * A ficha tem 29 linhas e quem não treinou nada fica com 29 zeros — foi o caso do arquivo real
     * usado pra calibrar isto. Importar tudo seria repetir a reclamação que o usuário já fez uma vez
     * ("fica uma bagunça, não dá para entender"): zero aqui não é informação, é a ausência dela.
     */
    const lidoComZeros = readSheet(
      fichaComPericias([
        ['ACROBACIA', '0'],
        ['LUTA', '5'],
        ['MEDICINA', '0']
      ])
    )
    expect(lidoComZeros.fields.filter((c) => c.group === 'Perícias').map((c) => c.label)).toEqual(['Luta'])
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
})
