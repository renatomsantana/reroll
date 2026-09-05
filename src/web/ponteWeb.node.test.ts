import { describe, expect, it, vi } from 'vitest'
import type { AparenciaDoPersonagem } from '@shared/types/aparencia'
import type { SheetApplyPayload } from '@shared/types/sheetImport'

/**
 * A PONTE WEB de ponta a ponta: o `window.api` do navegador rodando os handlers REAIS do processo
 * principal sobre o fs virtual (ver o cabeçalho de `shims/fs.ts`).
 *
 * O que está em teste aqui não é a regra de negócio — ela tem os testes dela em `src/main` — e sim
 * a PROMESSA da versão web: que os módulos do main rodam inteiros em cima dos shims, com a mesma
 * semântica. Por isso os cenários atravessam tudo: importação de ficha (o canal que grava três
 * coisas em ordem), troca de personagem (o dado de um não vazar pro outro), personagem apagado indo
 * pro backup (§9.1), exportação virando download e importação vindo do seletor.
 *
 * Os módulos do main enxergam os shims pelos `vi.mock` abaixo — a mesma troca que os aliases de
 * `vite.web.config.ts` fazem no build de verdade.
 */
vi.mock('electron', () => import('./shims/electron'))
vi.mock('fs', () => import('./shims/fs'))

const { configurarArmazemDeArquivos, criarArmazemEmMemoria, promises: fsVirtual } = await import('./shims/fs')
const { configurarPlataformaDeArquivos, configurarVersaoDoApp } = await import('./shims/electron')

/** O que o seletor "escolheria" na próxima abertura; `null` é a pessoa desistindo. */
let proximoArquivo: { nome: string; bytes: Uint8Array } | null = null
const downloads: Array<{ nome: string; conteudo: Uint8Array }> = []

configurarArmazemDeArquivos(criarArmazemEmMemoria())
configurarPlataformaDeArquivos({
  abrirArquivo: async () => proximoArquivo,
  baixarArquivo: (nome, conteudo) => {
    downloads.push({ nome, conteudo })
  }
})
configurarVersaoDoApp('1.1.0-teste-web')

const { montarApiWeb } = await import('./api')
const api = await montarApiWeb()

const texto = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

function fichaDe(nome: string, valorDeForca: string, nomeDoPreset: string): SheetApplyPayload {
  return {
    characterName: nome,
    system: 'D&D 5e',
    notes: {
      blocks: { inventory: `Corda de ${nome}` },
      sections: [{ title: 'Atributos', fields: [{ label: 'Força', value: valorDeForca }] }]
    },
    presets: [{ name: nomeDoPreset, expression: { groups: [{ sides: 20, count: 1 }], modifiers: [] } }],
    recursos: []
  }
}

describe('a ponte web roda os handlers do main sobre o fs virtual', () => {
  it('importa uma ficha: personagem criado, seções e presets na pasta dele', async () => {
    const perfil = await api.sheets.apply(fichaDe('Matias', '16', 'Ataque de faca'))
    expect(perfil.name).toBe('Matias')

    const ficha = await api.notes.get()
    expect(ficha.characterName).toBe('Matias')
    expect(ficha.inventory).toContain('Corda de Matias')
    expect(ficha.sections.map((secao) => secao.title)).toContain('Atributos')

    const presets = await api.presets.getAll()
    expect(presets.map((preset) => preset.name)).toEqual(['Ataque de faca'])
  })

  it('trocar de personagem troca a ficha e os presets, sem vazar nada', async () => {
    await api.sheets.apply(fichaDe('Aurora', '9', 'Raio arcano'))
    expect((await api.notes.get()).inventory).toContain('Corda de Aurora')
    expect((await api.presets.getAll()).map((preset) => preset.name)).toEqual(['Raio arcano'])

    const estado = await api.profiles.get()
    const matias = estado.profiles.find((perfil) => perfil.name === 'Matias')
    await api.profiles.save({ profiles: estado.profiles, activeId: matias!.id })

    expect((await api.notes.get()).inventory).toContain('Corda de Matias')
    expect((await api.presets.getAll()).map((preset) => preset.name)).toEqual(['Ataque de faca'])
  })

  it('a estrela de favorito atravessa a ponte', async () => {
    const [preset] = await api.presets.getAll()
    const comEstrela = await api.presets.setFavorite(preset.id, true)
    expect(comEstrela.find((cada) => cada.id === preset.id)?.favorito).toBe(0)
  })

  it('exportar presets vira um download com o JSON deles', async () => {
    const caminho = await api.presets.exportToFile()
    expect(caminho).toBe('/downloads/presets-reroll.json')
    const download = downloads.at(-1)
    expect(download?.nome).toBe('presets-reroll.json')
    const lista = JSON.parse(texto(download!.conteudo)) as Array<{ name: string }>
    expect(lista.map((cada) => cada.name)).toEqual(['Ataque de faca'])
  })

  it('importar presets lê o arquivo do seletor e passa pela validação de sempre', async () => {
    const download = downloads.at(-1)!
    proximoArquivo = { nome: 'presets-reroll.json', bytes: download.conteudo }
    const depois = await api.presets.importFromFile()
    expect(depois?.map((cada) => cada.name)).toEqual(['Ataque de faca', 'Ataque de faca'])
    // Desfaz a duplicata pro resto do arquivo não depender dela.
    await api.presets.delete(depois!.at(-1)!.id)
  })

  it('escolher um PDF devolve os bytes; um não-PDF é recusado com motivo; desistir é cancelado', async () => {
    proximoArquivo = { nome: 'ficha.pdf', bytes: new TextEncoder().encode('%PDF-1.7 conteudo') }
    const escolhido = await api.sheets.pickPdf()
    // O nome ganha um contador na frente (dois arquivos de mesmo nome não podem se sobrescrever).
    expect(escolhido).toMatchObject({ ok: true, fileName: expect.stringMatching(/ficha\.pdf$/) })

    // O motivo é o do main desde "arquivo errado diz o botão certo": sem a assinatura %PDF-, o
    // arquivo é recusado como 'nao-e-pdf' (antes era 'ilegivel', e este teste ficou pra trás).
    proximoArquivo = { nome: 'video.pdf', bytes: new TextEncoder().encode('nada de pdf aqui') }
    expect(await api.sheets.pickPdf()).toMatchObject({ ok: false, motivo: 'nao-e-pdf' })

    proximoArquivo = null
    expect(await api.sheets.pickPdf()).toEqual({ ok: false, motivo: 'cancelado' })
  })

  it('exportar o personagem vira um download .html, e importar o arquivo restaura o que ele guardava', async () => {
    const caminho = await api.pacote.exportar({
      aparencia: null as unknown as AparenciaDoPersonagem,
      idioma: 'pt-BR'
    })
    expect(caminho).toMatch(/^\/downloads\/.+\.html$/)
    const pacote = downloads.at(-1)!
    expect(pacote.nome).toMatch(/\.html$/)

    const antes = await api.notes.get()
    await api.notes.save({ ...antes, inventory: 'Inventário rabiscado depois da exportação' })

    proximoArquivo = { nome: pacote.nome, bytes: pacote.conteudo }
    const importado = await api.pacote.importar()
    expect(importado?.substituiu).toBe(true)
    expect(importado?.perfil.name).toBe('Matias')
    expect((await api.notes.get()).inventory).toContain('Corda de Matias')
  })

  it('personagem apagado vai pro backup em vez de sumir (§9.1)', async () => {
    const estado = await api.profiles.get()
    const aurora = estado.profiles.find((perfil) => perfil.name === 'Aurora')
    await api.profiles.save({
      profiles: estado.profiles.filter((perfil) => perfil.id !== aurora!.id),
      activeId: estado.activeId
    })

    const guardados = (await fsVirtual.readdir('/dados/backups/personagens-apagados')) as string[]
    expect(guardados.some((nome) => nome.startsWith(aurora!.id))).toBe(true)
    // O perfil PADRÃO (nome vazio, criado na primeira abertura) fica — como no desktop.
    const nomes = (await api.profiles.get()).profiles.map((perfil) => perfil.name)
    expect(nomes).toContain('Matias')
    expect(nomes).not.toContain('Aurora')
  })

  it('o que não existe na web responde sem quebrar: janela, atualização, área de transferência', async () => {
    await expect(api.windowControls.minimize()).resolves.toBeUndefined()
    await expect(api.update.getVersion()).resolves.toBe('1.1.0-teste-web')
    await expect(api.update.getStatus()).resolves.toEqual({ state: 'idle' })
    expect(typeof api.update.onStatus(() => {})).toBe('function')
    // Sem `navigator.clipboard` no Node: a resposta é `false` (a tela avisa), nunca uma exceção.
    await expect(api.clipboard.writeText('1d20')).resolves.toBe(false)
  })
})
