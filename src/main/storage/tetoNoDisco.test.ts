import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TETO_DE_PERSONAGENS_NO_DISCO, type Profile, type ProfilesState } from '@shared/types/profile'

/**
 * O TETO DE PERSONAGENS COBRADO NO DISCO, e não só no botão da tela.
 *
 * Este arquivo existe por causa de uma medição no app rodando: a interface parava em quinze e o
 * canal `profiles:save` aceitava o décimo sexto sem reclamar. É a diferença entre um limite e um
 * aviso — o canal grava o estado INTEIRO de uma vez, então qualquer caminho do renderer que monte
 * uma lista maior chega direto no arquivo.
 *
 * A regra é sobre CRESCER, não sobre o tamanho, e essa distinção é a parte que importa: uma lista
 * que já veio do disco com mais que o teto continua editável. Um teto que olhasse só o tamanho
 * travaria o app de quem tem mais, e a única saída seria editar JSON na mão.
 */

const userData = join(tmpdir(), `reroll-teste-teto-${process.pid}-${Date.now()}`)

vi.mock('electron', () => ({ app: { getPath: () => userData } }))

const { ProfilesRepository } = await import('./ProfilesRepository')

function perfil(n: number): Profile {
  return { id: `p${n}`, name: `Personagem ${n}`, system: '', photo: null, createdAt: n }
}

function lista(quantos: number): ProfilesState {
  return { profiles: Array.from({ length: quantos }, (_, i) => perfil(i + 1)), activeId: 'p1' }
}

async function gravarNoDisco(estado: ProfilesState): Promise<void> {
  await fs.writeFile(join(userData, 'profiles.json'), JSON.stringify(estado), 'utf-8')
}

describe('teto de personagens no repositório', () => {
  beforeEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
    await fs.mkdir(userData, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(userData, { recursive: true, force: true })
  })

  it(`grava até ${TETO_DE_PERSONAGENS_NO_DISCO} sem reclamar`, async () => {
    const repo = new ProfilesRepository()
    await repo.init()

    const salvo = await repo.save(lista(TETO_DE_PERSONAGENS_NO_DISCO))

    expect(salvo.profiles).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)
  })

  it('RECUSA a gravação que passaria do teto', async () => {
    const repo = new ProfilesRepository()
    await repo.init()

    await expect(repo.save(lista(TETO_DE_PERSONAGENS_NO_DISCO + 1))).rejects.toThrow(/[Ll]imite/)
  })

  it('a recusa não deixa o arquivo pela metade', async () => {
    // Tudo-ou-nada: uma gravação recusada não pode ter apagado a lista que já estava lá.
    const repo = new ProfilesRepository()
    await repo.init()
    await repo.save(lista(3))

    await expect(repo.save(lista(TETO_DE_PERSONAGENS_NO_DISCO + 1))).rejects.toThrow()

    expect((await repo.get()).profiles).toHaveLength(3)
    const noDisco = JSON.parse(
      await fs.readFile(join(userData, 'profiles.json'), 'utf-8')
    ) as ProfilesState
    expect(noDisco.profiles).toHaveLength(3)
  })

  it('lista que JÁ tinha mais que o teto continua sendo lida inteira', async () => {
    /**
     * Backup restaurado, ou arquivo escrito por uma versão em que o teto era outro. Cortar na
     * leitura seria perda de dado silenciosa — e a intenção seria boa, que é o que a torna perigosa.
     */
    const demais = TETO_DE_PERSONAGENS_NO_DISCO + 5
    await gravarNoDisco(lista(demais))

    const repo = new ProfilesRepository()
    const estado = await repo.init()

    expect(estado.profiles).toHaveLength(demais)
  })

  it('e continua EDITÁVEL: dá pra renomear e apagar mesmo acima do teto', async () => {
    /**
     * A consequência prática da regra ser sobre crescer. Se o teto olhasse só o tamanho, quem tem
     * vinte personagens não conseguiria nem apagar os cinco que sobram — o app recusaria a gravação
     * que resolveria o problema, e a saída seria editar JSON na mão.
     */
    const demais = TETO_DE_PERSONAGENS_NO_DISCO + 5
    await gravarNoDisco(lista(demais))
    const repo = new ProfilesRepository()
    const estado = await repo.init()

    // Renomear, sem mudar a quantidade.
    const renomeado = {
      ...estado,
      profiles: estado.profiles.map((p, i) => (i === 0 ? { ...p, name: 'Novo nome' } : p))
    }
    await expect(repo.save(renomeado)).resolves.toBeDefined()

    // Apagar, reduzindo — o caminho de volta pra dentro do teto.
    const menos = { ...estado, profiles: estado.profiles.slice(0, TETO_DE_PERSONAGENS_NO_DISCO), activeId: 'p1' }
    const depois = await repo.save(menos)
    expect(depois.profiles).toHaveLength(TETO_DE_PERSONAGENS_NO_DISCO)

    // E daqui em diante o teto volta a valer.
    await expect(repo.save(lista(TETO_DE_PERSONAGENS_NO_DISCO + 1))).rejects.toThrow()
  })
})
