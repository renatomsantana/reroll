import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { montarFicha } from '@shared/types/montarFicha'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'

/**
 * O importador contra as FICHAS DE VERDADE.
 *
 * Todo o resto da suíte monta a `PdfSheet` à mão, o que é bom (leitor é função pura) e insuficiente:
 * uma régua calibrada em fixture inventada passa no teste e erra no arquivo. Foi exatamente o que
 * aconteceu duas vezes — os cinco atributos de Ordem Paranormal sumindo por nomes de campo
 * repetidos, e "Limite de Estresse = 6. /" entrando como atributo de Oblivio. Nenhum dos dois
 * apareceria sem abrir o PDF.
 *
 * As fichas estão no `.gitignore` (são material dos sistemas, não do repositório), então este
 * arquivo PULA sozinho quando elas não existem. Quem tem os arquivos ganha a verificação de ponta a
 * ponta; quem não tem continua com a suíte passando.
 */

const PASTA = join(process.cwd(), 'Fichas RPG')
const ORDEM = join(PASTA, 'Ordem Paranormal - Ficha de Personagem Editável Matais.pdf')
const OBLIVIO = join(PASTA, 'Ficha Oblívio - Preenchida.pdf')
const KIDS = join(PASTA, 'Ficha Kids on Bikes - Preenchida.pdf')
const KIDS_BRANCA = join(PASTA, 'Ficha Kids on Bikes.pdf')


/**
 * A ficha EM BRANCO de Kids on Bikes — o caso que a varredura de fechamento do Alfa encontrou.
 *
 * Ela é uma ARTE achatada: zero campos de formulário e zero rótulos impressos (medido — 41
 * fragmentos de texto solto na preenchida, nenhum par rótulo/valor na vazia). Não há sistema de
 * leitura que a resolva, e não é isso que este teste cobra: cobra que, não tendo lido NADA, o app
 * não proponha criar um personagem chamado "Ficha Kids on Bikes". Era o que ele fazia.
 */
describe.skipIf(!existsSync(KIDS_BRANCA))('ficha real em branco de Kids on Bikes', () => {
  it('não rende campo nenhum, e por isso não propõe nome de personagem', async () => {
    const lido = readSheet(await abrirPdfNoNode(KIDS_BRANCA))

    expect(lido.readerId).toBe('generico')
    expect(lido.fields).toEqual([])
    expect(lido.presets).toEqual([])
    expect(lido.characterName).toBe('')
  })
})

describe.skipIf(!existsSync(ORDEM))('ficha real de Ordem Paranormal', () => {
  it('lê identificação, atributos, recursos e ataques — e nenhum campo de perícia cru', async () => {
    const lido = readSheet(await abrirPdfNoNode(ORDEM))

    expect(lido.readerId).toBe('ordem-paranormal')
    expect(lido.system).toBe('Ordem Paranormal')
    expect(lido.characterName).toBeTruthy()

    /**
     * OS PARES ATUAL/MÁXIMO VÊM INTEIROS, mesmo com metade em branco no arquivo.
     *
     * Nesta ficha só os máximos estão preenchidos (PV 45, PE 12, Sanidade 15) — o jogador nunca
     * anotou quanto tem AGORA. A importação trazia só essa metade, e a ficha no app ficava sem
     * lugar pra escrever o número que muda toda sessão. Foi o que o usuário reportou: "ficou
     * faltando, coloca o máximo e atuais de tudo".
     */
    const recursos = new Map(lido.fields.filter((c) => c.group === 'Recursos').map((c) => [c.label, c.value]))
    expect(recursos.get('PV máximo')).toBe('45')
    expect(recursos.get('PE máximo')).toBe('12')
    expect(recursos.get('Sanidade máxima')).toBe('15')
    expect(recursos.has('PV atual')).toBe(true)
    expect(recursos.has('PE atual')).toBe(true)
    expect(recursos.has('Sanidade atual')).toBe(true)
    expect(recursos.get('PV atual')).toBe('')

    /**
     * O ESQUELETO INTEIRO da ficha, com as lacunas vazias — pedido do usuário: "coloca lacunas para
     * TUDO que é preenchível, porque às vezes precisamos preencher no app também mesmo que não
     * tenha, porque é um item novo na sessão".
     *
     * As 29 perícias vêm com o NOME de cada uma (o nome é texto impresso, casado por posição — ver
     * `nomeDaPericia`), os 20 espaços de ritual e os 22 de item vêm numerados. Nesta ficha todos
     * estão em branco: o Matias não tem perícia treinada, ritual nem item anotado.
     */
    const porGrupo = (nome: string): typeof lido.fields => lido.fields.filter((c) => c.group === nome)
    expect(porGrupo('Perícias')).toHaveLength(29)
    expect(porGrupo('Perícias').map((c) => c.label)).toContain('Acrobacia')
    expect(porGrupo('Perícias').map((c) => c.label)).toContain('Sobrevivência')
    expect(porGrupo('Rituais')).toHaveLength(20)
    expect(porGrupo('Itens')).toHaveLength(22)
    // Vazias de verdade: lacuna é espaço pra escrever, e "0" seria uma afirmação que ninguém fez.
    expect(porGrupo('Perícias').every((c) => c.value === '')).toBe(true)

    // Os cinco atributos, que já sumiram uma vez por nome de campo repetido.
    const atributos = lido.fields.filter((c) => c.group === 'Atributos').map((c) => c.label)
    expect(atributos).toEqual(['Agilidade', 'Força', 'Intelecto', 'Presença', 'Vigor'])

    // Nenhuma linha rotulada com a posição na grade: `Pericias.4.1` na tela não diz nada a ninguém.
    expect(lido.fields.some((c) => /^Pericias\./.test(c.label))).toBe(false)
    expect(lido.fields.some((c) => /^Atq/.test(c.label))).toBe(false)

    /**
     * Os cinco atributos ROLAM, com a regra do sistema: Força 3 é "role 3d20 e fique com o maior".
     * É o que transforma a ficha importada de formulário inerte em ficha de uso (ver `sheetRoll.ts`).
     */
    expect(lido.fields.filter((c) => c.group === 'Atributos').every((c) => c.roll === 'pool-d20')).toBe(true)
    // E o que NÃO é rolagem não ganha botão: defesa e deslocamento são números de consulta.
    expect(lido.fields.find((c) => c.label === 'Defesa')?.roll).toBeUndefined()

    /**
     * O NEX legível. O menu da ficha guarda dois números na mesma string ("5         1"), e a
     * importação trazia um campo "NEX = 5 1", que não quer dizer nada em lugar nenhum.
     */
    expect(lido.fields.find((c) => c.label === 'NEX')?.value).toBe('5% · 1 PE/turno')

    /**
     * E nada da grade de BÔNUS das perícias, que é o resto da mesma tabela. A célula `Bns1.0` fica
     * embaixo do cabeçalho impresso "TREINO" e vinha como "Treino = 0", com cara de atributo do
     * personagem — é a primeira casa de uma tabela vazia.
     */
    expect(lido.fields.some((c) => c.label === 'Treino')).toBe(false)
    // Nem uma seção "Outros" na ficha montada: era só onde esse par de ruídos ia parar.
    expect(montarFicha(lido.fields).sections.map((s) => s.title)).not.toContain('Outros')

    // Esta ficha não tem perícia treinada: as 29 linhas valem "0" e viram lacuna vazia (ver acima).
    expect(lido.fields.filter((c) => c.group === 'Perícias').every((c) => c.value === '')).toBe(true)
    // E o aviso de "perícias não são importadas" não existe mais: o único que resta é o da regra
    // do maior dado, conferido logo abaixo.
    expect(lido.warnings).toEqual(['ordem-maior-dado'])

    /**
     * A coluna TESTE desta ficha veio como "2d20", que em Ordem Paranormal quer dizer "role dois e
     * use o MAIOR". O preset é criado assim mesmo — os dados que caem na mesa são os certos —, mas o
     * total somado não é o do sistema, e o usuário precisa saber disso na hora de importar.
     */
    const teste = lido.presets.find((p) => p.name === 'Ataque com Faca (teste)')
    expect(teste).toBeDefined()
    expect(teste!.expression.keep).toEqual({ mode: 'highest', count: 1 })
    expect(lido.warnings).toContain('ordem-maior-dado')

    // O DANO soma, e continua somando: a regra do maior é do teste, não do dado de dano.
    expect(lido.presets.find((p) => p.name === 'Ataque com Faca (dano)')!.expression.keep).toBeUndefined()
  }, 60_000)
})

describe.skipIf(!existsSync(OBLIVIO))('ficha real de Oblivio', () => {
  it('separa ATRIBUTOS de ASPECTOS, e lê as partes do corpo sem a regra impressa junto', async () => {
    const lido = readSheet(await abrirPdfNoNode(OBLIVIO))

    expect(lido.readerId).toBe('oblivio')
    expect(lido.system).toBe('Oblivio')

    /**
     * Os cinco de cada, como a PÁGINA separa — ela tem os dois títulos, e cada aspecto diz de quais
     * atributos é derivado ("Coragem … é derivada de Determinação e Mente"). Os dez num grupo só
     * mostravam um quadro de dez atributos que Oblivio não tem: cinco deles são conta, não escolha.
     */
    const atributos = lido.fields.filter((c) => c.group === 'Atributos').map((c) => c.label)
    expect(atributos).toEqual(['Carne', 'Força', 'Prontidão', 'Determinação', 'Mente'])

    const aspectos = lido.fields.filter((c) => c.group === 'Aspectos').map((c) => c.label)
    expect(aspectos).toEqual(['Coragem', 'Dor', 'Fôlego', 'Proteção', 'Velocidade'])

    /**
     * O EQUIPAMENTO CARREGADO, que este leitor perdia inteiro — e é a arma do personagem.
     *
     * A página escreve "○ Torso:" e o item nas linhas de baixo, então nenhum par "Rótulo: valor" da
     * mesma linha existia pra achar; e o rótulo ainda colidia com a região de dano do corpo
     * ("Torso: 0/5"), que vem antes. Ficava tudo de fora: a vestimenta, a lâmina e o dano dela.
     */
    const equipamento = lido.fields.filter((c) => c.group === 'Equipamento')
    expect(equipamento.map((c) => c.label)).toEqual(['Torso', 'Braço Esquerdo'])
    expect(equipamento[0].value).toContain('Vestimenta Leve')
    expect(equipamento[1].value).toContain('Lâmina Curta')
    // As regiões VAZIAS não viram linha: o personagem não carrega nada nos braços direito e pernas.
    expect(equipamento).toHaveLength(2)

    /** E a arma que diz o próprio dano vira preset, com o nome curto que cabe num botão. */
    const arma = lido.presets?.find((p) => /Lâmina Curta/.test(p.name))
    expect(arma?.name).toBe('Lâmina Curta (dano)')
    expect(arma?.kind).toBe('damage')
    expect(arma?.expression.groups).toEqual([{ count: 1, sides: 4 }])
    expect(lido.fields.filter((c) => c.group === 'Corpo')).toHaveLength(5)

    /**
     * O ruído que motivou `PEDACO_DE_FRASE`: a página de equipamento escreve as regras no mesmo
     * formato de um campo preenchido ("Limite de Estresse: 6. / Dano: 1D4 PE."), e elas entravam na
     * ficha como se fossem valores do personagem.
     */
    const rotulos = lido.fields.map((c) => c.label)
    expect(rotulos).not.toContain('Limite de Estresse')
    expect(rotulos).not.toContain('Dano')
    expect(rotulos).not.toContain('Alcance')
    expect(lido.fields.some((c) => /\.\s*$|\.\s/.test(c.value) && c.value.length < 20)).toBe(false)
    // Fórmula não é nome de campo: "Limite de Estresse (5 + Carne): 0/7" dava a linha "(5 + Carne)".
    expect(rotulos.some((r) => r.startsWith('('))).toBe(false)

    // Os talentos escolhidos vão pro bloco de habilidades, e não pra pilha de campos sem grupo.
    const habilidades = lido.fields.filter((c) => c.group === 'Habilidades').map((c) => c.label)
    expect(habilidades).toContain('Voracidade')
    expect(habilidades).toContain('Estocada')

    /**
     * E nenhum preset que seja só a notação, ou pedaço de regra: a página de equipamento produzia
     * "1D4" e "1D4 PE. /" como rolagens do personagem.
     */
    expect(lido.presets.map((p) => p.name)).not.toContain('1D4')
    expect(lido.presets.some((p) => /\.\s*$|\.\s/.test(p.name))).toBe(false)
    /**
     * "RESULTADO 1D6" é o cabeçalho da primeira coluna da TABELA DE FARDOS, que vem impressa nas
     * regras. Passava por todos os filtros — curto, com notação, com palavra — e era o único preset
     * que esta ficha produzia: um botão que não é rolagem de personagem nenhum.
     */
    expect(lido.presets.map((p) => p.name)).not.toContain('RESULTADO 1D6')

    /**
     * O parágrafo INTEIRO, e não a primeira linha dele. O extrator devolve a descrição picada em
     * cinco fragmentos e a habilidade em quatro; antes disto a ficha importava "…curto dos lados e"
     * e "…(se movimentando", que é pior que não importar, porque parece completo.
     */
    const porRotulo = new Map(lido.fields.map((c) => [c.label, c.value]))
    expect(porRotulo.get('Descrição')).toContain('não visível por causa do moletom.')
    // A habilidade tem indentação pendente: a continuação começa 80 pontos à ESQUERDA da primeira.
    expect(porRotulo.get('Estocada')).toContain('cause dano extra igual ao número de casas')

    /**
     * O ESPAÇO LIVRE da página de habilidades — o jogador digitou as habilidades GERAIS dele ali
     * (no modelo em branco a área é vazia, conferido nos dois PDFs), e nada disso chegava. Regra
     * do usuário: "qualquer anotação de player no pdf precisamos trazer".
     */
    expect(lido.rawText).toContain('Aprimoramento de Estresse')
    // E a instrução impressa da segunda área não vem junto — é do modelo, não do jogador.
    expect(lido.rawText ?? '').not.toContain('Use esse espaço')
  }, 60_000)
})

describe.skipIf(!existsSync(KIDS))('ficha real de Kids on Bikes — arte com anotação por cima', () => {
  /**
   * O terceiro tipo de ficha, e o mais difícil: a arte inteira é imagem, inclusive os nomes dos
   * campos, e o que existe de texto no arquivo é só o que a pessoa digitou por cima. São 41
   * fragmentos em 2 páginas, contra os 68 POR PÁGINA da de Oblivio — é essa diferença de densidade
   * que separa os dois caminhos de leitura.
   *
   * Antes disto, a ficha caía no caminho de "PDF de texto" e importava três pedaços de frase, sem
   * nome de personagem, com um aviso que dizia algo falso sobre o arquivo. Todo o resto se perdia.
   */
  it('remonta o que foi escrito, propõe o nome e não finge saber o que é cada valor', async () => {
    const lido = readSheet(await abrirPdfNoNode(KIDS))

    expect(lido.readerId).toBe('generico')
    // O nome sai do primeiro texto da página, e não do arquivo ("Ficha Kids on Bikes - Preenchida").
    expect(lido.characterName).toBe('rodrigo barreto')
    expect(lido.warnings).toContain('arte-com-anotacao')

    /**
     * As vantagens que a pessoa nomeou ela mesma, com o parágrafo INTEIRO. O extrator devolve isto
     * picado em quatro fragmentos ("Heróico: Você não precisa da" / "permissão do Mestre para" / …),
     * e a primeira leitura importava só o primeiro pedaço.
     */
    const porRotulo = new Map(lido.fields.map((c) => [c.label, c.value]))
    expect(porRotulo.get('Heróico')).toBe(
      'Você não precisa da permissão do Mestre para gastar Fichas de Adversidade para ignorar Medos.'
    )
    expect(porRotulo.get('Durão')).toContain('adicione +3 ao número negativo')

    /**
     * "Você ganha +1 em testes de Luta." está escrito nas duas páginas, uma vez como "preta intensa"
     * e outra como "bike preta intensa" — na página 1 a palavra "bike" é parte do desenho. É a mesma
     * anotação, e vinha duas vezes.
     */
    const luta = lido.fields.filter((c) => c.value === 'Você ganha +1 em testes de Luta.')
    expect(luta.map((c) => c.label)).toEqual(['bike preta intensa'])

    // O texto que não tem rótulo nenhum não é jogado fora — vai inteiro pro bloco de história.
    const solto = lido.rawText ?? ''
    for (const escrito of ['11', 'Novo Aluno Misterioso', 'supersticioso', 'd20', 'd12', '1 - Dinamite']) {
      expect(solto).toContain(escrito)
    }
    /**
     * Cada dado numa linha própria. Eles ficam lado a lado na arte, em corpo 26, e a régua de
     * "mesma linha" chegou a grudar dois atributos diferentes num "d8 d4" só.
     */
    expect(solto.split('\n')).toContain('d20')
    expect(solto).not.toContain('d8 d4')

    // O parágrafo da coluna da direita não foi intercalado com o da esquerda.
    expect(solto).toContain('Pegs Apoio nas rodas Você pode levar um passageiro em pé.')

    // E nenhum preset chamado "d20": o app já tem esse botão, e o atributo dele é desenho.
    expect(lido.presets.map((p) => p.name)).not.toContain('d20')
  }, 60_000)
})

describe.skipIf(!existsSync(KIDS_BRANCA))('ficha real de Kids on Bikes em branco', () => {
  it('continua sendo reconhecida como imagem pura, sem inventar conteúdo', async () => {
    // 1,4 MB, duas páginas, UM fragmento de texto. Não há o que importar, e dizer isso é o certo.
    const lido = readSheet(await abrirPdfNoNode(KIDS_BRANCA))
    expect(lido.fields).toEqual([])
    expect(lido.presets).toEqual([])
    expect(lido.rawText ?? '').toBe('')
    expect(lido.warnings).toContain('pdf-sem-texto')
  }, 60_000)
})

const OBLIVIO_BRANCA = join(PASTA, 'Ficha Oblivio - Colorida.pdf')
const ORDEM_BRANCA = join(PASTA, 'Ordem Paranormal - Ficha de Personagem Editável.pdf')

/**
 * Os MODELOS EM BRANCO dos dois sistemas — os arquivos que se baixa do site antes de preencher.
 *
 * É o caso mais comum de importação errada: a pessoa baixa a ficha oficial, importa por engano antes
 * de preencher, e o app tem que dizer isso em vez de criar um personagem de mentira. Estes dois
 * arquivos estavam na pasta e não tinham teste nenhum.
 *
 * O defeito que estas asserções travam: o app propunha o NOME DO ARQUIVO como nome do personagem, ou
 * seja, oferecia criar alguém chamado "Ordem Paranormal - Ficha de Personagem Editável". Quando um
 * leitor dedicado reconhece o sistema e não acha nome nenhum escrito, o arquivo é o título da ficha,
 * não uma pessoa — e vazio é melhor que isso, porque a tela de conferência não deixa confirmar sem
 * nome e a pessoa digita o dela.
 */
describe.skipIf(!existsSync(OBLIVIO_BRANCA) || !existsSync(ORDEM_BRANCA))('modelos em branco', () => {
  it('Oblivio em branco: reconhece o sistema, avisa que está vazia e NÃO propõe nome', async () => {
    const lido = readSheet(await abrirPdfNoNode(OBLIVIO_BRANCA))

    expect(lido.readerId).toBe('oblivio')
    expect(lido.system).toBe('Oblivio')
    expect(lido.characterName).toBe('')
    expect(lido.presets).toEqual([])
    // O aviso é o que separa "importou vazio" de "o app não funcionou".
    expect(lido.warnings).toContain('sem-nome-nem-rolagem')
    // Os atributos zerados ainda são lidos: quem quiser importar a ficha vazia e preencher no app pode.
    expect(lido.fields.some((c) => c.group === 'Atributos')).toBe(true)
  })

  it('Ordem Paranormal em branco: mesma coisa, sem inventar personagem', async () => {
    const lido = readSheet(await abrirPdfNoNode(ORDEM_BRANCA))

    expect(lido.readerId).toBe('ordem-paranormal')
    expect(lido.characterName).toBe('')
    expect(lido.presets).toEqual([])
    expect(lido.warnings).toContain('sem-nome-nem-rolagem')
  })
})

/**
 * O MODELO EM BRANCO não ganha o esqueleto de recursos.
 *
 * O par atual/máximo entra vazio porque numa ficha DE ALGUÉM ele é espaço pra anotar. Num modelo
 * baixado do site seriam seis linhas vazias a mais na tela de quem só quer ver o que o arquivo
 * tinha — e a ficha em branco de Ordem Paranormal já vem com 76 campos preenchidos de fábrica,
 * então o corte é o NOME do personagem, que ninguém preenche numa ficha que não vai usar.
 */
describe.skipIf(!existsSync(ORDEM_BRANCA))('modelo em branco de Ordem Paranormal', () => {
  it('não inventa linhas vazias de recurso', async () => {
    const lido = readSheet(await abrirPdfNoNode(ORDEM_BRANCA))
    const rotulos = lido.fields.map((c) => c.label)

    expect(lido.characterName).toBe('')
    expect(rotulos).not.toContain('PV atual')
    expect(rotulos).not.toContain('Sanidade atual')
    // Nem as lacunas numeradas: num modelo em branco elas seriam 71 linhas vazias.
    expect(rotulos).not.toContain('Ritual 1')
    expect(rotulos).not.toContain('Item 1')
    expect(lido.fields.filter((c) => c.group === 'Perícias')).toEqual([])
    // O que ele traz continua sendo só o que está escrito de fábrica no arquivo.
    expect(rotulos).toContain('Defesa')
  })
})

/**
 * A FICHA DA COMUNIDADE de Ordem Paranormal — a do Vincenzo, que ensinou o segundo modelo do
 * sistema ao leitor (ver `extrairFichaDaComunidade`). O que se cobra é o que foi MEDIDO no
 * arquivo: o total de perícia refeito dos componentes (medicina 10+5=15), a lista traduzindo
 * índice pra rótulo (classe "2" = Especialista) e a grade de armas virando preset.
 */
const VINCENZO = join(PASTA, 'ficha vincenzo.pdf')

describe.skipIf(!existsSync(VINCENZO))('ficha real da comunidade de Ordem Paranormal', () => {
  it('identidade traduzida, perícias refeitas, armas em preset e itens numerados', async () => {
    const lido = readSheet(await abrirPdfNoNode(VINCENZO))

    expect(lido.readerId).toBe('ordem-paranormal')
    expect(lido.characterName).toBe('Vincenzo Moretti')
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'NEX', value: '65%' }))
    // A LISTA guarda o índice ("2"); o rótulo vem das opções do próprio campo.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Classe', value: 'Especialista' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Origem', value: 'Agente de Saúde' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Trilha', value: 'Médico de Combate' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Proteção', value: 'Leve' }))

    // b_medicina não está gravado no arquivo: 15 = treino 10 + outros 5, conferido no PDF.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Medicina', value: '15', group: 'Perícias' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'PV atual', value: '51' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Carga', value: '18/30' }))

    expect(lido.presets.map((p) => p.name)).toContain('pistola molto poggers (dano)')
    expect(lido.presets.map((p) => p.name)).toContain('martello (dano)')

    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Item 4', value: 'kit médico', group: 'Itens' }))
    // Nada da grade de perícias vaza com nome cru de campo.
    const rotulos = lido.fields.map((c) => c.label)
    expect(rotulos.some((r) => /^[tbo]_|^atq_|^dano_arma/.test(r))).toBe(false)
  }, 60_000)
})

/**
 * A ficha de D&D 5e TRADUZIDA (a do Go): o modelo mantém os nomes de campo oficiais, então o
 * leitor de D&D a reconhece — e é isso que o teste segura no lugar.
 */
const GO = join(PASTA, 'ficha Go.pdf')

describe.skipIf(!existsSync(GO))('ficha real de D&D 5e traduzida', () => {
  it('é reconhecida pelo leitor de D&D, com atributos e perícias', async () => {
    const lido = readSheet(await abrirPdfNoNode(GO))
    expect(lido.readerId).toBe('dnd5e')
    expect(lido.characterName).toBe('Go')
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Destreza', value: '16', group: 'Atributos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Furtividade', value: '+3', group: 'Perícias' }))
  }, 60_000)
})

/**
 * A ficha de ASSIMILAÇÃO (a do Kieran): sistema que ninguém cadastrou, formulário com nomes de
 * campo escritos pelo autor. O genérico tem que render o nome e os campos legíveis — com o
 * underscore do editor virando espaço no rótulo.
 */
const KIERAN = (() => {
  try {
    const nome = readdirSync(PASTA).find((n) => n.startsWith('Assimila') && n.endsWith('.pdf'))
    return nome ? join(PASTA, nome) : ''
  } catch {
    return ''
  }
})()

describe.skipIf(!KIERAN || !existsSync(KIERAN))('ficha real de Assimilação', () => {
  it('o leitor dedicado organiza: identificação, recursos, e as caixinhas viram números', async () => {
    const lido = readSheet(await abrirPdfNoNode(KIERAN))
    expect(lido.readerId).toBe('assimilacao')
    expect(lido.system).toBe('Assimilação')
    expect(lido.characterName).toBe('Kieran Saad')
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Geração', value: 'Pós-Maresia' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Saúde', value: '18', group: 'Recursos' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Determinação', value: '8' }))
    // As caixinhas do arquivo real: três instintos e sete aptidões marcados.
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Instintos marcados', value: '5, 21, 22' }))
    expect(lido.fields).toContainEqual(expect.objectContaining({ label: 'Aptidões marcadas', value: '1, 6, 7, 16, 17, 40, 50' }))
    expect(lido.fields.some((c) => /^(Instinto_|Aptidao\d)/.test(c.label))).toBe(false)
  }, 60_000)
})
