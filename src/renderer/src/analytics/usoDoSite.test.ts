import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const plataforma = vi.hoisted(() => ({ web: true }))
vi.mock('@shared/buildTarget', () => ({ get REROLL_WEB() { return plataforma.web } }))

let uso: typeof import('./usoDoSite')
let track: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  plataforma.web = true
  vi.stubEnv('PROD', true)
  track = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', { location: { hostname: 'reroll.com.br' }, umami: { track } })
  vi.stubGlobal('navigator', { doNotTrack: null })
  uso = await import('./usoDoSite')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('contadores de uso do site', () => {
  it('conta cada resultado concluído uma vez, mesmo passando pelos dois callbacks', () => {
    uso.contarRolagemConcluida('resultado-1')
    uso.contarRolagemConcluida('resultado-1')
    uso.contarRolagemConcluida('resultado-2')
    expect(track.mock.calls).toEqual([['rolagem-concluida', { modo: 'sem-torre', sistema: 'padrao' }], ['rolagem-concluida', { modo: 'sem-torre', sistema: 'padrao' }]])
  })

  it.each([
    ['tray', 'sem-torre'], ['tower', 'pela-torre'], ['towerDecor', 'torre-enfeite']
  ] as const)('registra o modo real %s sem duplicar o callback do App', (modo, esperado) => {
    uso.contarRolagemConcluida('resultado', modo)
    uso.contarRolagemConcluida('resultado')
    expect(track.mock.calls).toEqual([['rolagem-concluida', { modo: esperado, sistema: 'padrao' }]])
  })

  it('conta personalização e abertura uma vez por página, sem contar cada movimento da roda', () => {
    for (let i = 0; i < 50; i++) {
      uso.contarTabuleiroAberto()
      uso.contarPersonalizacaoDosDados()
    }
    expect(track.mock.calls).toEqual([['tabuleiro-aberto'], ['dados-personalizados']])
  })

  it.each(['127.0.0.1', 'localhost', 'renatomsantana.github.io'])('não envia em %s', (hostname) => {
    window.location.hostname = hostname
    uso.contarRolagemConcluida('1')
    uso.contarPersonalizacaoDosDados()
    uso.contarTabuleiroAberto()
    expect(track).not.toHaveBeenCalled()
  })

  it('não envia durante desenvolvimento, mesmo com domínio de produção', () => {
    vi.stubEnv('PROD', false)
    uso.contarRolagemConcluida('1')
    expect(track).not.toHaveBeenCalled()
  })

  it('não envia no app Electron', () => {
    plataforma.web = false
    uso.contarRolagemConcluida('1')
    expect(track).not.toHaveBeenCalled()
  })

  it('respeita Do Not Track', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    uso.contarRolagemConcluida('1')
    expect(track).not.toHaveBeenCalled()
  })

  it('continua funcionando sem o script ou quando o envio falha', async () => {
    vi.stubGlobal('window', { location: { hostname: 'reroll.com.br' } })
    expect(() => uso.contarRolagemConcluida('1')).not.toThrow()
    vi.stubGlobal('window', { location: { hostname: 'reroll.com.br' }, umami: { track } })
    track.mockImplementationOnce(() => { throw new Error('bloqueado') })
    expect(() => uso.contarRolagemConcluida('2')).not.toThrow()
    track.mockRejectedValueOnce(new Error('sem rede'))
    uso.contarRolagemConcluida('3')
    await Promise.resolve()
  })

  it('aceita www e envia só modo e sistema, sem ID ou conteúdo dos dados', () => {
    window.location.hostname = 'www.reroll.com.br'
    uso.contarRolagemConcluida('id-privado')
    expect(track).toHaveBeenCalledWith('rolagem-concluida', { modo: 'sem-torre', sistema: 'padrao' })
    expect(track.mock.calls[0]).toHaveLength(2)
  })

  it('distingue um perfil personalizado salvo de uma edição feita agora', () => {
    uso.definirDadosPersonalizados(true)
    uso.contarTabuleiroAberto()
    uso.contarRolagemConcluida('1')
    expect(track.mock.calls).toEqual([
      ['tabuleiro-aberto'], ['perfil-personalizado-em-uso'], ['rolagem-concluida', { modo: 'sem-torre', sistema: 'padrao' }]
    ])
    uso.contarPersonalizacaoDosDados()
    uso.contarRolagemConcluida('2')
    uso.contarRolagemConcluida('3')
    expect(track.mock.calls.filter(([evento]) => evento === 'personalizou-e-rolou')).toHaveLength(1)
  })

  it('detecta o perfil personalizado mesmo se as preferências carregarem depois do tabuleiro', () => {
    uso.contarTabuleiroAberto()
    uso.definirDadosPersonalizados(true)
    uso.definirDadosPersonalizados(true)
    expect(track.mock.calls).toEqual([['tabuleiro-aberto'], ['perfil-personalizado-em-uso']])
  })
})


describe('tipos de dado e sistemas', () => {
  it('agrupa termos iguais e conta quantidades sem duplicar os callbacks', () => {
    const detalhes = { sistema: 'assimilacao' as const, resultado: { groups: [
      { sides: 6, rolls: [1, 2], subtotal: 3 },
      { sides: 10, rolls: [8], subtotal: 8 },
      { sides: 6, rolls: [3], subtotal: 3 }
    ] } }
    uso.contarRolagemConcluida('teste-local', 'tray', detalhes)
    uso.contarRolagemConcluida('teste-local', 'tray', detalhes)
    expect(track.mock.calls).toEqual([
      ['rolagem-concluida', { modo: 'sem-torre', sistema: 'assimilacao' }],
      ['dados-rolados', { modo: 'sem-torre', sistema: 'assimilacao', dado: 'd6', quantidade: 3 }],
      ['dados-rolados', { modo: 'sem-torre', sistema: 'assimilacao', dado: 'd10', quantidade: 1 }]
    ])
  })

  it('conta os dois dados da vantagem, inclusive a tentativa descartada', () => {
    uso.contarRolagemConcluida('vantagem', 'tower', { resultado: {
      groups: [{ sides: 20, rolls: [18], subtotal: 18 }],
      descartados: [{ sides: 20, rolls: [4], subtotal: 4 }]
    } })
    expect(track).toHaveBeenLastCalledWith('dados-rolados', {
      modo: 'pela-torre', sistema: 'padrao', dado: 'd20', quantidade: 2
    })
  })

  it('conta explosões e a face rerolada sem transmitir valores', () => {
    uso.contarRolagemConcluida('explosao', 'towerDecor', { resultado: {
      groups: [{ sides: 6, rolls: [14, 3], subtotal: 17, chains: [[6, 6, 2], [3]] }],
      rerolados: [[1, null]]
    } })
    expect(track).toHaveBeenLastCalledWith('dados-rolados', {
      modo: 'torre-enfeite', sistema: 'padrao', dado: 'd6', quantidade: 5
    })
  })

  it('um monte de dados não vira um monte de eventos', () => {
    uso.contarRolagemConcluida('cem-dados', 'tray', { resultado: {
      groups: [{ sides: 6, rolls: Array(100).fill(3), subtotal: 300 }]
    } })
    expect(track).toHaveBeenCalledTimes(2)
    expect(track.mock.calls[1][1].quantidade).toBe(100)
  })

  it('não envia estatísticas de sistemas experimentais no ambiente local', () => {
    window.location.hostname = '127.0.0.1'
    uso.contarRolagemConcluida('local', 'tray', { sistema: 'assimilacao', resultado: {
      groups: [{ sides: 12, rolls: [2], subtotal: 2 }]
    } })
    expect(track).not.toHaveBeenCalled()
  })
})
