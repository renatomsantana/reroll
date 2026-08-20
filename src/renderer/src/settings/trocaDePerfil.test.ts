import { describe, expect, it, vi } from 'vitest'
import { createProfile, normalizeProfiles, type ProfilesState } from '@shared/types/profile'
import { trocarPerfil } from './trocaDePerfil'

/**
 * A SEQUÊNCIA de trocar de personagem, que é onde moraram os dois bugs que o usuário mais sentiu:
 * "quando troquei de Matais para Rodrigo todas as informações sumiram" e "a criação de perfis está
 * bem bugada ainda".
 *
 * Os dois eram a mesma coisa: a tela trocava antes de o processo principal saber da troca, e o que
 * aparecia era a ficha do personagem ANTERIOR — que a primeira tecla digitada gravava por cima do
 * novo. É defeito de ORDEM, e ordem não se vê lendo o código; por isso a regra saiu de dentro do
 * componente pra cá.
 */

function estadoCom(...nomes: string[]): ProfilesState {
  const profiles = nomes.map((name) => ({ ...createProfile(), name }))
  return normalizeProfiles({ profiles, activeId: profiles[0].id })
}

describe('trocarPerfil', () => {
  it('grava ANTES de devolver o estado novo', async () => {
    /**
     * O coração da coisa. Se `salvar` for chamado depois — ou nem for esperado —, os efeitos que
     * leem anotações e presets disparam com o processo principal ainda apontando pra pasta antiga.
     */
    const inicial = estadoCom('Matias', 'Rodrigo')
    const ordem: string[] = []
    const salvar = vi.fn(async (estado: ProfilesState) => {
      ordem.push(`salvou:${estado.activeId}`)
    })

    const alvo = inicial.profiles[1].id
    const { estado, trocou } = await trocarPerfil(inicial, (p) => ({ ...p, activeId: alvo }), salvar)
    ordem.push(`tela:${estado.activeId}`)

    expect(trocou).toBe(true)
    expect(ordem).toEqual([`salvou:${alvo}`, `tela:${alvo}`])
    expect(salvar).toHaveBeenCalledTimes(1)
  })

  it('gravação FALHOU: a tela fica no personagem antigo', async () => {
    /**
     * Este era o furo, e ele reabria a corrida por outra porta: a versão anterior avisava no console
     * e trocava assim mesmo. A tela passava a mostrar o personagem B enquanto o principal ainda lia
     * a pasta do A — e a primeira tecla gravava a ficha do B por cima da do A. Irreversível.
     */
    const inicial = estadoCom('Matias', 'Rodrigo')
    const alvo = inicial.profiles[1].id
    const salvar = vi.fn(async () => {
      throw new Error('disco cheio')
    })

    const { estado, trocou, erro } = await trocarPerfil(inicial, (p) => ({ ...p, activeId: alvo }), salvar)

    expect(trocou).toBe(false)
    expect(estado).toBe(inicial)
    expect(estado.activeId).toBe(inicial.profiles[0].id)
    expect((erro as Error).message).toBe('disco cheio')
  })

  it('CRIAR também passa por aqui — criar muda quem está aberto', async () => {
    // Era exatamente por isso que criar vinha bugado: a tela abria o novo antes de o principal saber.
    const inicial = estadoCom('Matias')
    const salvos: ProfilesState[] = []
    const { estado, trocou } = await trocarPerfil(
      inicial,
      (p) => {
        const novo = createProfile()
        return { profiles: [...p.profiles, novo], activeId: novo.id }
      },
      async (e) => void salvos.push(e)
    )

    expect(trocou).toBe(true)
    expect(estado.profiles).toHaveLength(2)
    expect(estado.activeId).toBe(estado.profiles[1].id)
    // O que foi gravado é EXATAMENTE o que a tela passou a mostrar.
    expect(salvos[0]).toEqual(estado)
  })

  it('APAGAR o personagem aberto abre outro, e grava isso antes', async () => {
    const inicial = estadoCom('Matias', 'Rodrigo')
    const aberto = inicial.activeId
    let gravado: ProfilesState | null = null

    const { estado } = await trocarPerfil(
      inicial,
      (p) => {
        const restantes = p.profiles.filter((x) => x.id !== aberto)
        return { profiles: restantes, activeId: restantes[0].id }
      },
      async (e) => {
        gravado = e
      }
    )

    expect(estado.profiles.map((p) => p.name)).toEqual(['Rodrigo'])
    expect(estado.activeId).toBe(estado.profiles[0].id)
    expect(gravado).toEqual(estado)
  })

  it('o estado devolvido passou pelo NORMALIZADOR', async () => {
    /**
     * Importa porque a mudança vem de quem chamou, e nada garante que ela seja coerente. Um
     * `activeId` apontando pra um personagem que acabou de ser apagado deixaria a ficha vazia sem
     * explicação; o normalizador cai no primeiro da lista.
     */
    const inicial = estadoCom('Matias', 'Rodrigo')
    const { estado } = await trocarPerfil(
      inicial,
      (p) => ({ ...p, activeId: 'personagem-que-nao-existe' }),
      async () => {}
    )
    expect(estado.activeId).toBe(estado.profiles[0].id)
  })

  it('o que foi GRAVADO é o mesmo que a tela mostra — nunca dois estados diferentes', async () => {
    // Se divergirem, o disco e a tela discordam sobre quem está aberto, que é o pior dos dois mundos.
    const inicial = estadoCom('Matias', 'Rodrigo', 'Ada')
    let gravado: ProfilesState | null = null
    const { estado } = await trocarPerfil(
      inicial,
      (p) => ({ ...p, activeId: p.profiles[2].id }),
      async (e) => {
        gravado = e
      }
    )
    expect(gravado).toEqual(estado)
  })
})
