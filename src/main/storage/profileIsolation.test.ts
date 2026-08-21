import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Cada personagem é um COMPARTIMENTO: anotações, presets e ficha moram na pasta dele, e trocar de
 * personagem tem que trocar tudo de uma vez — e trazer tudo de volta ao voltar, inclusive dias
 * depois, num processo novo.
 *
 * Este teste existe porque o usuário relatou o pior sintoma possível: "quando troquei de matais para
 * rodrigo todas as informações sumiram". Perda de dado não se investiga por leitura de código; se
 * reproduz. Ele exercita os repositórios de verdade, gravando em disco num diretório temporário, e
 * o passo final joga fora TODAS as instâncias e cria repositórios novos sobre os mesmos arquivos —
 * que é o que acontece quando a pessoa fecha o app e abre no dia seguinte.
 */

const userData = join(tmpdir(), `reroll-teste-perfis-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}))

const { ProfilesRepository } = await import('./ProfilesRepository')
const { NotesRepository } = await import('./NotesRepository')
const { PresetsRepository } = await import('./PresetsRepository')

const MATAIS = 'perfil-matais'
const RODRIGO = 'perfil-rodrigo'

function perfil(id: string, name: string, system: string) {
  return { id, name, system, photo: null, createdAt: 1 }
}

function secao(title: string, label: string, value: string) {
  return { id: `${title}-${label}`, title, fields: [{ id: label, label, value }] }
}

/**
 * Apaga as pastas de personagem, sem tocar no `profiles.json`.
 *
 * Os testes deste arquivo compartilham um `userData` só, e os de baixo montam um `profiles.json`
 * à mão esperando uma lista EXATA. As pastas deixadas pelos testes de cima seriam personagens
 * órfãos legítimos aos olhos da recuperação (ver `ProfilesRepository.recuperarPerfisOrfaos`) e
 * voltariam pra lista — o teste falharia por causa da própria bagunça, não do código.
 *
 * Chamar isto é o teste dizendo em voz alta de que disco ele está partindo.
 */
async function limparPastasDePerfil(): Promise<void> {
  await fs.rm(join(userData, 'profiles'), { recursive: true, force: true })
}

/** Um trio de repositórios novos sobre a MESMA pasta — o equivalente a abrir o app de novo. */
async function abrirApp() {
  const profiles = new ProfilesRepository()
  await profiles.init()
  return { profiles, notes: new NotesRepository(profiles), presets: new PresetsRepository(profiles) }
}

describe('cada personagem guarda o que é dele', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('trocar de personagem troca ficha, anotações e presets — e voltar traz os de volta', async () => {
    const app = await abrirApp()

    // --- Matais: ficha importada, um dia de diário e dois presets.
    await app.profiles.save({
      profiles: [perfil(MATAIS, 'Matias', 'Ordem Paranormal')],
      activeId: MATAIS
    })
    await app.notes.save({
      ...(await app.notes.get()),
      characterName: 'Matias',
      sections: [secao('Atributos', 'Agilidade', '1')],
      inventory: 'Faca de mato',
      backstory: 'Agente de saúde',
      pages: [{ id: 'd1', title: 'Sessão 1', text: 'O hospital estava vazio.' }]
    })
    await app.presets.create({
      name: 'Faca (dano)',
      expression: { groups: [{ sides: 4, count: 1 }], modifiers: [] }
    })

    // --- Rodrigo: outro sistema, outra ficha, outro preset.
    await app.profiles.save({
      profiles: [perfil(MATAIS, 'Matias', 'Ordem Paranormal'), perfil(RODRIGO, 'Rodrigo Barreto', 'Oblivio')],
      activeId: RODRIGO
    })
    /**
     * A ficha do Rodrigo começa VAZIA, e é isso que o usuário viu como "sumiu tudo": ao trocar, a
     * tela mostra o compartimento do outro personagem, que de fato não tem nada ainda. O que não
     * pode acontecer é o contrário — a de Matais aparecer aqui, ou ser sobrescrita.
     */
    const rodrigoAntes = await app.notes.get()
    expect(rodrigoAntes.sections).toEqual([])
    expect(rodrigoAntes.inventory).toBe('')
    expect(await app.presets.getAll()).toEqual([])

    await app.notes.save({
      ...rodrigoAntes,
      characterName: 'Rodrigo Barreto',
      sections: [secao('Atributos', 'Carne', '2/10')],
      inventory: 'Vestimenta leve',
      pages: [{ id: 'd2', title: 'Noite 1', text: 'A cidade não dormia.' }]
    })
    await app.presets.create({
      name: 'Estocada',
      expression: { groups: [{ sides: 6, count: 2 }], modifiers: [] }
    })

    // --- Volta pro Matais: tudo dele tem que estar lá, intacto.
    await app.profiles.save({
      profiles: [perfil(MATAIS, 'Matias', 'Ordem Paranormal'), perfil(RODRIGO, 'Rodrigo Barreto', 'Oblivio')],
      activeId: MATAIS
    })
    const matais = await app.notes.get()
    expect(matais.characterName).toBe('Matias')
    expect(matais.sections[0].fields[0]).toMatchObject({ label: 'Agilidade', value: '1' })
    expect(matais.inventory).toBe('Faca de mato')
    expect(matais.backstory).toBe('Agente de saúde')
    expect(matais.pages[0].text).toBe('O hospital estava vazio.')
    expect((await app.presets.getAll()).map((p) => p.name)).toEqual(['Faca (dano)'])
  })

  it('abrir o app noutro dia encontra tudo onde ficou', async () => {
    /**
     * Instâncias NOVAS sobre os mesmos arquivos. É o passo que separa "guardou em memória" de
     * "gravou em disco" — e o `JsonFileStore` enfileira gravações, então este teste também cobre a
     * fila ter terminado antes de o app fechar.
     */
    const outroDia = await abrirApp()
    const estado = await outroDia.profiles.get()
    expect(estado.activeId).toBe(MATAIS)
    expect(estado.profiles.map((p) => p.name)).toEqual(['Matias', 'Rodrigo Barreto'])

    const matais = await outroDia.notes.get()
    expect(matais.inventory).toBe('Faca de mato')
    expect(matais.sections[0].title).toBe('Atributos')
    expect((await outroDia.presets.getAll()).map((p) => p.name)).toEqual(['Faca (dano)'])

    await outroDia.profiles.save({ ...estado, activeId: RODRIGO })
    const rodrigo = await outroDia.notes.get()
    expect(rodrigo.characterName).toBe('Rodrigo Barreto')
    expect(rodrigo.inventory).toBe('Vestimenta leve')
    expect(rodrigo.sections[0].fields[0]).toMatchObject({ label: 'Carne', value: '2/10' })
    expect(rodrigo.pages[0].text).toBe('A cidade não dormia.')
    expect((await outroDia.presets.getAll()).map((p) => p.name)).toEqual(['Estocada'])
  })
})

/**
 * As trocas que o teste acima não cobre, e que são justamente as que o usuário pediu pra garantir
 * ("a troca de perfil também"): nome repetido, apagar quem está aberto, e arquivo com id repetido.
 *
 * Vem depois de propósito — reaproveita a mesma pasta temporária e os personagens já gravados, e as
 * asserções do bloco anterior já rodaram.
 */
describe('trocas que não podem perder dado', () => {
  it('dois personagens com o MESMO NOME não dividem compartimento', async () => {
    /**
     * Acontece de verdade: duas campanhas com o mesmo personagem, ou duas versões da mesma ficha. O
     * que separa os dois é o ID, não o nome — e este teste é o que prova que o app não usa o nome
     * como chave em algum canto.
     */
    const app = await abrirApp()
    const XARA_A = 'perfil-xara-a'
    const XARA_B = 'perfil-xara-b'
    const anteriores = (await app.profiles.get()).profiles

    await app.profiles.save({
      profiles: [...anteriores, perfil(XARA_A, 'Rodrigo Barreto', 'Oblivio')],
      activeId: XARA_A
    })
    await app.notes.save({ ...(await app.notes.get()), inventory: 'Lanterna sem pilha' })

    await app.profiles.save({
      profiles: [...anteriores, perfil(XARA_A, 'Rodrigo Barreto', 'Oblivio'), perfil(XARA_B, 'Rodrigo Barreto', 'Oblivio')],
      activeId: XARA_B
    })
    expect((await app.notes.get()).inventory).toBe('')

    await app.notes.save({ ...(await app.notes.get()), inventory: 'Revólver enferrujado' })

    await app.profiles.save({
      profiles: [...anteriores, perfil(XARA_A, 'Rodrigo Barreto', 'Oblivio'), perfil(XARA_B, 'Rodrigo Barreto', 'Oblivio')],
      activeId: XARA_A
    })
    expect((await app.notes.get()).inventory).toBe('Lanterna sem pilha')
  })

  it('apagar o personagem aberto abre outro, e os dados DELE é que aparecem', async () => {
    const app = await abrirApp()
    const DESCARTAVEL = 'perfil-descartavel'
    const anteriores = (await app.profiles.get()).profiles.filter((p) => p.id !== DESCARTAVEL)

    await app.profiles.save({
      profiles: [...anteriores, perfil(DESCARTAVEL, 'Errado', 'Ordem Paranormal')],
      activeId: DESCARTAVEL
    })
    await app.notes.save({ ...(await app.notes.get()), inventory: 'nada que importe' })

    // Apagar = tirar da lista e abrir o primeiro que sobrou (ver `remove` em `ProfilesContext`).
    const restantes = anteriores
    await app.profiles.save({ profiles: restantes, activeId: restantes[0].id })

    const aberto = await app.profiles.get()
    expect(aberto.profiles.some((p) => p.id === DESCARTAVEL)).toBe(false)
    expect(aberto.activeId).toBe(restantes[0].id)
    // O compartimento que aparece é o do personagem que ficou, não o do apagado.
    expect((await app.notes.get()).inventory).not.toBe('nada que importe')
  })

  it('profiles.json com IDS REPETIDOS separa os compartimentos, e o conserto sobrevive a reabrir', async () => {
    /**
     * O pior caso silencioso: dois personagens apontando pra MESMA pasta. Um sobrescreve as
     * anotações do outro a cada tecla, e da tela isso lê como "troquei e sumiu tudo".
     *
     * O teste também confere a parte que quase passou batida: o id novo tem que ser GRAVADO. Sem
     * isso o remendo vale só pra sessão atual, e cada abertura manda o personagem pra uma pasta
     * nova e vazia — um defeito pior que o original, porque perde dado toda vez em vez de uma.
     */
    await limparPastasDePerfil()
    await fs.writeFile(
      join(userData, 'profiles.json'),
      JSON.stringify({
        profiles: [
          { id: 'colidido', name: 'Primeiro', system: 'Ordem', photo: null, createdAt: 1 },
          { id: 'colidido', name: 'Segundo', system: 'Oblivio', photo: null, createdAt: 2 }
        ],
        activeId: 'colidido'
      }),
      'utf8'
    )

    const app = await abrirApp()
    const estado = await app.profiles.get()
    expect(estado.profiles.map((p) => p.name)).toEqual(['Primeiro', 'Segundo'])
    const [primeiro, segundo] = estado.profiles
    expect(primeiro.id).toBe('colidido')
    expect(segundo.id).not.toBe('colidido')

    await app.profiles.save({ ...estado, activeId: segundo.id })
    await app.notes.save({ ...(await app.notes.get()), inventory: 'só do Segundo' })

    await app.profiles.save({ ...estado, activeId: primeiro.id })
    expect((await app.notes.get()).inventory).not.toBe('só do Segundo')

    // Reabrir o app: o id remendado tem que ser o MESMO, senão o Segundo perde tudo de novo.
    const outroDia = await abrirApp()
    const relido = await outroDia.profiles.get()
    expect(relido.profiles.map((p) => p.id)).toEqual([primeiro.id, segundo.id])

    await outroDia.profiles.save({ ...relido, activeId: segundo.id })
    expect((await outroDia.notes.get()).inventory).toBe('só do Segundo')
  })
})

describe('o remendo de id tem que ir pro disco', () => {
  it('abrir e FECHAR sem editar nada já deixa o arquivo consertado', async () => {
    /**
     * O caso que os outros testes mascaram: lá, um `profiles.save()` explícito acaba gravando os
     * ids consertados por tabela. Aqui ninguém salva nada — a pessoa abriu o app, olhou e fechou.
     *
     * Sem a gravação em `ProfilesRepository.init()`, o arquivo continuaria com o id repetido e a
     * abertura SEGUINTE sortearia outro id pro segundo personagem: pasta nova, vazia, e tudo o que
     * ele escreveu na sessão anterior órfão. O remendo instável perde dado toda vez, em vez de uma.
     */
    await fs.writeFile(
      join(userData, 'profiles.json'),
      JSON.stringify({
        profiles: [
          { id: 'gemeo', name: 'Um', system: '', photo: null, createdAt: 1 },
          { id: 'gemeo', name: 'Dois', system: '', photo: null, createdAt: 2 }
        ],
        activeId: 'gemeo'
      }),
      'utf8'
    )

    const primeiraAbertura = await abrirApp()
    const idsDaPrimeira = (await primeiraAbertura.profiles.get()).profiles.map((p) => p.id)
    expect(idsDaPrimeira[0]).not.toBe(idsDaPrimeira[1])

    // Nada de `save()` aqui — é exatamente esse o ponto.
    const segundaAbertura = await abrirApp()
    const idsDaSegunda = (await segundaAbertura.profiles.get()).profiles.map((p) => p.id)
    expect(idsDaSegunda).toEqual(idsDaPrimeira)
  })

  it('arquivo já saudável NÃO é reescrito à toa na abertura', async () => {
    await limparPastasDePerfil()
    const caminho = join(userData, 'profiles.json')
    await fs.writeFile(
      caminho,
      JSON.stringify({
        profiles: [{ id: 'certinho', name: 'Ok', system: '', photo: null, createdAt: 1 }],
        activeId: 'certinho'
      }),
      'utf8'
    )
    const antes = (await fs.stat(caminho)).mtimeMs

    await abrirApp()

    // `mtime` idêntico: abrir o app não pode mexer no arquivo de quem está com tudo em ordem.
    expect((await fs.stat(caminho)).mtimeMs).toBe(antes)
  })
})
