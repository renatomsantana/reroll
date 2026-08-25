import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * IMPORTAR UMA FICHA cria um personagem inteiro de uma vez: o perfil, a ficha (blocos e seções) e os
 * presets, todos na pasta dele. É o caminho mais caro de errar do app — um defeito aqui grava a
 * ficha de alguém no compartimento errado — e não tinha teste nenhum.
 *
 * O handler é exercitado de verdade: os repositórios gravam num diretório temporário, e o teste
 * captura a função registrada no `ipcMain` em vez de reimplementar o que ela faz.
 */

const userData = join(tmpdir(), `reroll-teste-import-${process.pid}-${Date.now()}`)
const handlers = new Map<string, (evento: unknown, ...args: never[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  app: { getPath: () => userData },
  ipcMain: {
    handle: (canal: string, fn: (evento: unknown, ...args: never[]) => Promise<unknown>) => {
      handlers.set(canal, fn)
    }
  },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
}))

/**
 * O teto de CRIAÇÃO liberado até o do disco: este arquivo testa a IMPORTAÇÃO (o que ela grava, o
 * que ela mantém, o que ela pula), e cria vários personagens no mesmo `userData` pra isso. O teto de
 * três do beta (ver `MAX_PROFILES`) é assunto de `tetoDePersonagens.test.tsx` e do canal — aqui ele
 * só derrubaria o quarto caso sem dizer nada sobre importação.
 */
vi.mock('@shared/types/profile', async (original) => {
  const real = await original<typeof import('@shared/types/profile')>()
  return { ...real, MAX_PROFILES: real.TETO_DE_PERSONAGENS_NO_DISCO }
})

const { ProfilesRepository } = await import('../storage/ProfilesRepository')
const { NotesRepository } = await import('../storage/NotesRepository')
const { PresetsRepository } = await import('../storage/PresetsRepository')
const { registerSheetHandlers } = await import('./registerSheetHandlers')
const { IpcChannels } = await import('@shared/ipcChannels')

const profiles = new ProfilesRepository()
const notes = new NotesRepository(profiles)
const presets = new PresetsRepository(profiles)

/** O payload que a tela de conferência monta — blocos livres + seções do sistema + presets. */
function fichaDoMatais() {
  return {
    characterName: 'Matias',
    system: 'Ordem Paranormal',
    notes: {
      blocks: { inventory: 'Faca de mato', backstory: 'Agente de Saúde' },
      sections: [
        {
          title: 'Atributos',
          fields: [
            { label: 'Agilidade', value: '1' },
            { label: 'Força', value: '3' }
          ]
        },
        { title: 'Recursos', fields: [{ label: 'PV máximo', value: '45' }] }
      ]
    },
    presets: [
      { name: 'Faca (teste)', expression: { groups: [{ sides: 20, count: 2 }], modifiers: [] } },
      {
        name: 'Faca (dano)',
        expression: { groups: [{ sides: 6, count: 2 }], modifiers: [{ type: 'flat' as const, value: 1 }] }
      }
    ]
  }
}

describe('importar ficha cria o personagem inteiro', () => {
  beforeAll(async () => {
    await fs.mkdir(userData, { recursive: true })
    await profiles.init()
    registerSheetHandlers(profiles, notes, presets)
  })

  afterAll(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it('cria o perfil, grava ficha e presets, e deixa ele ABERTO', async () => {
    const aplicar = handlers.get(IpcChannels.sheetsApply)
    expect(aplicar).toBeDefined()

    const criado = (await aplicar!(null, fichaDoMatais() as never)) as { id: string; name: string; system: string }
    expect(criado.name).toBe('Matias')
    expect(criado.system).toBe('Ordem Paranormal')

    const estado = await profiles.get()
    // Importar TROCA pro personagem novo: é o que faz a ficha aparecer na tela logo depois.
    expect(estado.activeId).toBe(criado.id)

    const ficha = await notes.get()
    expect(ficha.characterName).toBe('Matias')
    expect(ficha.inventory).toBe('Faca de mato')
    expect(ficha.backstory).toBe('Agente de Saúde')
    expect(ficha.sections.map((s) => s.title)).toEqual(['Atributos', 'Recursos'])
    expect(ficha.sections[0].fields.map((f) => `${f.label}=${f.value}`)).toEqual(['Agilidade=1', 'Força=3'])
    // Cada campo e cada seção precisam de id próprio, senão editar um valor mexeria em outro.
    const ids = ficha.sections.flatMap((s) => [s.id, ...s.fields.map((f) => f.id)])
    expect(new Set(ids).size).toBe(ids.length)

    expect((await presets.getAll()).map((p) => p.name)).toEqual(['Faca (teste)', 'Faca (dano)'])
  })

  it('a importação que ESTOURA o teto das anotações não deixa personagem fantasma', async () => {
    /**
     * Achado da revisão de código: a conferência na porta garante a FORMA do payload, mas a
     * gravação das anotações ganhou um teto de tamanho, e `LIMITES_DA_FICHA` admite mais do que
     * ele. O perfil era criado e ativado, a ficha estourava, e a pessoa ficava num personagem novo e
     * vazio — o desfecho que a conferência existe pra impedir. Agora a falha desfaz o perfil.
     */
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const antes = await profiles.get()

    // Dentro de cada limite de campo, acima do teto total: 100 seções × 90 campos × 2000 chars.
    const valor = 'x'.repeat(2000)
    const gorda = {
      characterName: 'Fantasma',
      system: 'Teste',
      notes: {
        blocks: {},
        sections: Array.from({ length: 100 }, (_, s) => ({
          title: `Seção ${s}`,
          fields: Array.from({ length: 90 }, (_, f) => ({ label: `campo ${f}`, value: valor }))
        }))
      },
      presets: []
    }
    await expect(aplicar(null, gorda as never)).rejects.toThrow(/limite/)

    const depois = await profiles.get()
    expect(depois.profiles.map((p) => p.id)).toEqual(antes.profiles.map((p) => p.id))
    expect(depois.activeId).toBe(antes.activeId)
    expect(depois.profiles.some((p) => p.name === 'Fantasma')).toBe(false)
  })

  it('a segunda importação não encosta no personagem da primeira', async () => {
    /**
     * O risco real: os repositórios de anotações e presets escrevem na pasta do perfil ATIVO. Se a
     * ordem interna do handler estiver errada, a ficha nova cai por cima da anterior — irreversível
     * pra quem já tinha escrito nela.
     */
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const primeiro = (await profiles.get()).activeId

    const rodrigo = {
      characterName: 'Rodrigo Barreto',
      system: 'Oblivio',
      notes: {
        blocks: { inventory: 'Vestimenta leve' },
        sections: [{ title: 'Atributos', fields: [{ label: 'Carne', value: '2/10' }] }]
      },
      presets: [{ name: 'Estocada', expression: { groups: [{ sides: 6, count: 2 }], modifiers: [] } }]
    }
    const criado = (await aplicar(null, rodrigo as never)) as { id: string }

    const doNovo = await notes.get()
    expect(doNovo.characterName).toBe('Rodrigo Barreto')
    expect(doNovo.inventory).toBe('Vestimenta leve')
    expect((await presets.getAll()).map((p) => p.name)).toEqual(['Estocada'])

    // Volta pro primeiro: tudo dele intacto.
    const estado = await profiles.get()
    await profiles.save({ ...estado, activeId: primeiro })
    const doPrimeiro = await notes.get()
    expect(doPrimeiro.characterName).toBe('Matias')
    expect(doPrimeiro.inventory).toBe('Faca de mato')
    expect(doPrimeiro.sections.map((s) => s.title)).toEqual(['Atributos', 'Recursos'])
    expect((await presets.getAll()).map((p) => p.name)).toEqual(['Faca (teste)', 'Faca (dano)'])
    expect(criado.id).not.toBe(primeiro)
  })

  it('ficha sem nada aproveitável ainda cria o personagem, sem gravar ficha vazia por cima', async () => {
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const criado = (await aplicar(null, {
      characterName: 'Sem ficha',
      system: '',
      notes: { blocks: {}, sections: [] },
      presets: []
    } as never)) as { id: string; name: string }

    expect(criado.name).toBe('Sem ficha')
    const ficha = await notes.get()
    expect(ficha.sections).toEqual([])
    expect(ficha.inventory).toBe('')
    expect(await presets.getAll()).toEqual([])
  })
})

describe('preset torto vindo da ficha não contamina o personagem', () => {
  it('grava os válidos, pula o inválido e cria o personagem assim mesmo', async () => {
    /**
     * Este caminho gravava direto no repositório, sem a validação que o canal de presets usa. Hoje
     * os leitores não conseguem produzir um preset assim (`parseDiceExpression` já limita tipo e
     * quantidade), mas a garantia dependia de todo leitor futuro lembrar disso — e o estrago só
     * apareceria mais tarde, na cena 3D, longe de onde entrou.
     *
     * O que se exige: o preset torto some, os bons ficam, e o PERSONAGEM continua sendo criado —
     * perder a ficha inteira por causa de uma linha de ataque mal digitada seria pior.
     */
    const aplicar = handlers.get(IpcChannels.sheetsApply)
    expect(aplicar).toBeDefined()

    const payload = {
      characterName: 'Ficha Torta',
      system: 'Sistema Desconhecido',
      notes: { blocks: {}, sections: [] },
      presets: [
        { name: 'Bom', expression: { groups: [{ sides: 6, count: 2 }], modifiers: [] } },
        // Dado que o app não rola.
        { name: 'd30', expression: { groups: [{ sides: 30, count: 1 }], modifiers: [] } },
        // Dados demais pra cena — mais que `MAX_SIMULTANEOUS_DICE`.
        { name: 'Enxame', expression: { groups: [{ sides: 6, count: 99 }], modifiers: [] } },
        // Sem nome.
        { name: '   ', expression: { groups: [{ sides: 8, count: 1 }], modifiers: [] } },
        { name: 'Tambem bom', expression: { groups: [{ sides: 20, count: 1 }], modifiers: [] } }
      ]
    }

    const criado = (await aplicar!(null, payload as never)) as { id: string; name: string }
    expect(criado.name).toBe('Ficha Torta')
    expect((await profiles.get()).activeId).toBe(criado.id)
    expect((await presets.getAll()).map((p) => p.name)).toEqual(['Bom', 'Tambem bom'])
  })
})

describe('reimportar a ficha ATUALIZA o personagem em vez de criar outro', () => {
  /**
   * O caso que motiva o `targetProfileId`: subiu de nível, salvou o PDF, importou de novo. Antes
   * disto o app criava um SEGUNDO personagem com o mesmo nome, e juntar os dois significava apagar
   * um — levando junto o diário e as anotações, que não estão em PDF nenhum.
   *
   * O que se exige aqui é a divisão entre o que é DA FICHA e o que é DA PESSOA: as seções vêm do
   * PDF e são substituídas; o diário, o texto escrito à mão e os presets ajustados no editor ficam.
   */
  async function fichaNovaDoMatais() {
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const criado = (await aplicar(null, fichaDoMatais() as never)) as { id: string }
    return criado
  }

  it('mantém o personagem, o diário e os presets; troca as seções pelas do PDF', async () => {
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const antes = (await profiles.get()).profiles.length
    const criado = await fichaNovaDoMatais()

    // O que a PESSOA escreveu depois de importar: um dia de diário e um preset ajustado à mão.
    const comDiario = await notes.get()
    await notes.save({
      ...comDiario,
      backstory: `${comDiario.backstory}

Descobriu que o irmão está vivo.`,
      pages: [{ id: 'dia-1', title: 'Sessão 1', text: 'A casa na colina.', createdAt: 0 }]
    })
    await presets.create({ name: 'Grito', expression: { groups: [{ sides: 20, count: 1 }], modifiers: [] } })

    // A ficha do mesmo personagem, um nível acima.
    const subiuDeNivel = {
      ...fichaDoMatais(),
      targetProfileId: criado.id,
      notes: {
        blocks: { inventory: 'Faca de mato', backstory: 'Agente de Saúde' },
        sections: [
          {
            title: 'Atributos',
            fields: [
              { label: 'Agilidade', value: '2' },
              { label: 'Força', value: '4' }
            ]
          },
          { title: 'Recursos', fields: [{ label: 'PV máximo', value: '60' }] }
        ]
      }
    }
    const atualizado = (await aplicar(null, subiuDeNivel as never)) as { id: string; name: string }

    // NENHUM personagem novo, e o mesmo id de antes.
    expect(atualizado.id).toBe(criado.id)
    expect((await profiles.get()).profiles.length).toBe(antes + 1)

    const ficha = await notes.get()
    // As seções são as do PDF novo — uma só de cada, com os números novos.
    expect(ficha.sections.map((s) => s.title)).toEqual(['Atributos', 'Recursos'])
    expect(ficha.sections[0].fields.map((f) => `${f.label}=${f.value}`)).toEqual(['Agilidade=2', 'Força=4'])
    expect(ficha.sections[1].fields[0].value).toBe('60')

    // O DIÁRIO continua lá — é o que não existe em PDF nenhum.
    expect(ficha.pages.map((p) => p.text)).toEqual(['A casa na colina.'])
    // E o que a pessoa escreveu na história também, sem uma segunda cópia do texto importado.
    expect(ficha.backstory).toContain('Descobriu que o irmão está vivo.')
    expect(ficha.backstory.match(/Agente de Saúde/g)).toHaveLength(1)
    // O inventário veio idêntico ao da importação anterior: não duplica.
    expect(ficha.inventory).toBe('Faca de mato')

    // Os presets: os da ficha não são recriados, e o que a pessoa criou continua.
    const nomes = (await presets.getAll()).map((p) => p.name)
    expect(nomes).toEqual(['Faca (teste)', 'Faca (dano)', 'Grito'])
  })

  it('texto NOVO no bloco é acrescentado, e não jogado fora', async () => {
    // O contrário do caso acima: se o PDF mudou, o que mudou tem que aparecer — depois do que já
    // estava, nunca por cima.
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const criado = await fichaNovaDoMatais()
    await aplicar(null, {
      ...fichaDoMatais(),
      targetProfileId: criado.id,
      notes: { blocks: { inventory: 'Pistola .38' }, sections: [] }
    } as never)

    const ficha = await notes.get()
    expect(ficha.inventory).toContain('Faca de mato')
    expect(ficha.inventory).toContain('Pistola .38')
  })

  it('personagem que não existe mais cai no caminho de CRIAR, sem perder a importação', async () => {
    // Apagar o personagem com a janela de conferência aberta é raro e possível. Perder a ficha lida
    // por causa disso seria pior que criar um personagem a mais.
    const aplicar = handlers.get(IpcChannels.sheetsApply)!
    const antes = (await profiles.get()).profiles.length
    const criado = (await aplicar(null, {
      ...fichaDoMatais(),
      targetProfileId: 'esse-perfil-nao-existe'
    } as never)) as { id: string; name: string }

    expect(criado.name).toBe('Matias')
    expect(criado.id).not.toBe('esse-perfil-nao-existe')
    expect((await profiles.get()).profiles.length).toBe(antes + 1)
  })
})
