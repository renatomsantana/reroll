import { describe, expect, it } from 'vitest'
import {
  MAXIMO_DE_RECURSOS,
  corDoPreenchimento,
  criarRecurso,
  estadoDoRecurso,
  recursoSobePorPadrao,
  fundirRecursos,
  lerEntradaDeRecurso,
  normalizarRecursos,
  prenderAtual
} from './recursoVital'

/**
 * O modelo da BARRA DE RECURSO (spec §3.4), na parte que falha calada: o que sai do disco torto, e o
 * que a pessoa digita no número da barra no meio de um combate.
 */
describe('normalizarRecursos', () => {
  it('lista que não é lista vira vazia — arquivo de versão anterior, sem o campo', () => {
    expect(normalizarRecursos(undefined)).toEqual([])
    expect(normalizarRecursos('PV')).toEqual([])
  })

  it('descarta item sem nome e corrige número torto, sem derrubar o resto', () => {
    const lidos = normalizarRecursos([
      { id: 'a', nome: 'PV', atual: 19, maximo: 45 },
      { id: 'b', nome: '', atual: 1, maximo: 2 },
      { id: 'c', nome: 'PE', atual: 'muitos', maximo: 1e308 },
      null,
      'texto'
    ])
    expect(lidos).toEqual([
      { id: 'a', nome: 'PV', atual: 19, maximo: 45 },
      // Máximo absurdo vira o teto; atual ilegível vira o máximo (barra cheia, e não vazia).
      { id: 'c', nome: 'PE', atual: 999_999, maximo: 999_999 }
    ])
  })

  it('atual acima do máximo é preso ao máximo, e negativo vira zero', () => {
    const [recurso] = normalizarRecursos([{ id: 'a', nome: 'PV', atual: 60, maximo: 45 }])
    expect(recurso.atual).toBe(45)
    const [outro] = normalizarRecursos([{ id: 'a', nome: 'PV', atual: -3, maximo: 45 }])
    expect(outro.atual).toBe(0)
  })

  it('id repetido ganha um novo — dois recursos com o mesmo id mexeriam juntos', () => {
    const lidos = normalizarRecursos([
      { id: 'x', nome: 'PV', atual: 1, maximo: 1 },
      { id: 'x', nome: 'PE', atual: 1, maximo: 1 }
    ])
    expect(lidos[0].id).toBe('x')
    expect(lidos[1].id).not.toBe('x')
  })

  it('cor só entra no formato #rrggbb, em minúsculas', () => {
    const lidos = normalizarRecursos([
      { id: 'a', nome: 'PV', atual: 1, maximo: 1, cor: '#FF0000' },
      { id: 'b', nome: 'PE', atual: 1, maximo: 1, cor: 'red' },
      { id: 'c', nome: 'SAN', atual: 1, maximo: 1, cor: 'javascript:alert(1)' }
    ])
    expect(lidos[0].cor).toBe('#ff0000')
    expect(lidos[1].cor).toBeUndefined()
    expect(lidos[2].cor).toBeUndefined()
  })

  it('corta no teto de recursos, mantendo os primeiros', () => {
    const muitos = Array.from({ length: MAXIMO_DE_RECURSOS + 5 }, (_, i) => ({
      id: String(i),
      nome: `R${i}`,
      atual: 1,
      maximo: 1
    }))
    const lidos = normalizarRecursos(muitos)
    expect(lidos).toHaveLength(MAXIMO_DE_RECURSOS)
    expect(lidos[0].nome).toBe('R0')
  })
})

describe('criarRecurso e prenderAtual', () => {
  it('nasce cheio quando não se diz o atual', () => {
    const recurso = criarRecurso('  Sanidade  ', 40)
    expect(recurso.nome).toBe('Sanidade')
    expect(recurso.atual).toBe(40)
    expect(recurso.maximo).toBe(40)
    expect(recurso.id).toBeTruthy()
  })

  it('prende ao intervalo [0, máximo] e trunca fração', () => {
    expect(prenderAtual(50, 45)).toBe(45)
    expect(prenderAtual(-1, 45)).toBe(0)
    expect(prenderAtual(7.9, 45)).toBe(7)
  })
})

describe('fundirRecursos — reimportar a ficha', () => {
  it('mesmo nome (sem diferenciar maiúsculas) é a MESMA barra: mantém id e cor, atualiza os números', () => {
    const atuais = [{ id: 'pv', nome: 'PV', atual: 10, maximo: 30, cor: '#ff0000' }]
    const fundidos = fundirRecursos(atuais, [{ nome: 'pv', atual: 35, maximo: 45 }])
    expect(fundidos).toEqual([{ id: 'pv', nome: 'PV', atual: 35, maximo: 45, cor: '#ff0000' }])
  })

  it('barra nova é acrescentada; barra criada à mão que a ficha não menciona fica', () => {
    const atuais = [{ id: 'sorte', nome: 'Sorte', atual: 3, maximo: 5 }]
    const fundidos = fundirRecursos(atuais, [{ nome: 'PV', atual: 19, maximo: 45 }])
    expect(fundidos).toHaveLength(2)
    expect(fundidos[0]).toEqual(atuais[0])
    expect(fundidos[1]).toMatchObject({ nome: 'PV', atual: 19, maximo: 45 })
  })

  it('respeita o teto de barras', () => {
    const atuais = Array.from({ length: MAXIMO_DE_RECURSOS }, (_, i) => ({ id: String(i), nome: `R${i}`, atual: 1, maximo: 1 }))
    expect(fundirRecursos(atuais, [{ nome: 'Extra', atual: 1, maximo: 1 }])).toHaveLength(MAXIMO_DE_RECURSOS)
  })
})

describe('estadoDoRecurso', () => {
  it('barra que desce: nos 40% avisa, nos 15% é perigo, máximo zero é normal', () => {
    expect(estadoDoRecurso({ atual: 45, maximo: 45 })).toBe('normal')
    expect(estadoDoRecurso({ atual: 41, maximo: 100 })).toBe('normal')
    expect(estadoDoRecurso({ atual: 40, maximo: 100 })).toBe('aviso')
    expect(estadoDoRecurso({ atual: 16, maximo: 100 })).toBe('aviso')
    expect(estadoDoRecurso({ atual: 15, maximo: 100 })).toBe('perigo')
    expect(estadoDoRecurso({ atual: 0, maximo: 45 })).toBe('perigo')
    expect(estadoDoRecurso({ atual: 0, maximo: 0 })).toBe('normal')
  })

  it('barra que SOBE: o espelho, aviso nos 60% e perigo nos 85%, vazia é o normal', () => {
    expect(estadoDoRecurso({ atual: 0, maximo: 5, sobe: true })).toBe('normal')
    expect(estadoDoRecurso({ atual: 2, maximo: 5, sobe: true })).toBe('normal')
    expect(estadoDoRecurso({ atual: 3, maximo: 5, sobe: true })).toBe('aviso')
    expect(estadoDoRecurso({ atual: 5, maximo: 5, sobe: true })).toBe('perigo')
  })
})

describe('a barra que sobe (estresse, dano por região)', () => {
  it('é decidida pelo nome: as regiões de Oblívio, estresse, dano, carga; PV e PE não', () => {
    for (const nome of ['Torso', 'Braço Direito', 'Perna Esquerda', 'Estresse', 'Stress', 'Dano', 'Carga', 'Fadiga', 'Corrupção']) {
      expect(recursoSobePorPadrao(nome), nome).toBe(true)
    }
    for (const nome of ['PV', 'PE', 'Sanidade', 'Mana', 'HP', 'Determinação']) {
      expect(recursoSobePorPadrao(nome), nome).toBe(false)
    }
    expect(criarRecurso('Torso', 5, 0).sobe).toBe(true)
    expect(criarRecurso('PV', 45).sobe).toBeUndefined()
  })

  it('do disco: sem o campo decide o nome; um `false` gravado é a pessoa desmarcando, e fica', () => {
    const lidos = normalizarRecursos([
      { id: 'a', nome: 'Torso', atual: 2, maximo: 5 },
      { id: 'b', nome: 'Torso', atual: 2, maximo: 5, sobe: false },
      { id: 'c', nome: 'PV', atual: 2, maximo: 5, sobe: true }
    ])
    expect(lidos.map((r) => r.sobe)).toEqual([true, false, true])
  })

  it('o preenchimento sobe do amarelo ao vermelho, um degrau por ponto: 1 amarelo, 3 laranja, 5 vermelho', () => {
    const torso = (atual: number) => corDoPreenchimento({ nome: 'Torso', atual, maximo: 5, sobe: true })
    expect(torso(1)).toBe('#ffff00')
    expect(torso(2)).toBe('#ffbf00')
    expect(torso(3)).toBe('#ff8000')
    expect(torso(4)).toBe('#ff4000')
    expect(torso(5)).toBe('#ff0000')
    // Vazia ainda é amarela (não aparece: largura zero), e mais níveis dão mais degraus.
    expect(torso(0)).toBe('#ffff00')
    expect(corDoPreenchimento({ nome: 'Estresse', atual: 15, maximo: 30, sobe: true })).toBe('#ff8400')
  })

  it('a barra que desce mantém a cor dela cheia, amarela nos 40% e vermelha nos 15%', () => {
    expect(corDoPreenchimento({ nome: 'PV', atual: 45, maximo: 45 })).toBe('#800000')
    expect(corDoPreenchimento({ nome: 'PV', atual: 41, maximo: 100 })).toBe('#800000')
    expect(corDoPreenchimento({ nome: 'PV', atual: 40, maximo: 100 })).toBe('#ffff00')
    expect(corDoPreenchimento({ nome: 'PV', atual: 15, maximo: 100 })).toBe('#ff0000')
    // A cor escolhida é a de cheia; o estado continua mandando embaixo dos 40%.
    expect(corDoPreenchimento({ nome: 'PV', cor: '#0000ff', atual: 90, maximo: 100 })).toBe('#0000ff')
    expect(corDoPreenchimento({ nome: 'PV', cor: '#0000ff', atual: 10, maximo: 100 })).toBe('#ff0000')
  })
})

describe('lerEntradaDeRecurso — o que se digita no número da barra', () => {
  const pv = { atual: 30, maximo: 45 }

  it('"-7" e "+3" são conta em cima do atual — o gesto "tomei 7"', () => {
    expect(lerEntradaDeRecurso('-7', pv)).toEqual({ atual: 23, maximo: 45 })
    expect(lerEntradaDeRecurso('+3', pv)).toEqual({ atual: 33, maximo: 45 })
    expect(lerEntradaDeRecurso(' - 7 ', pv)).toEqual({ atual: 23, maximo: 45 })
  })

  it('número sozinho é valor exato', () => {
    expect(lerEntradaDeRecurso('12', pv)).toEqual({ atual: 12, maximo: 45 })
  })

  it('"12/40" grava os dois de uma vez', () => {
    expect(lerEntradaDeRecurso('12/40', pv)).toEqual({ atual: 12, maximo: 40 })
    expect(lerEntradaDeRecurso('50 / 40', pv)).toEqual({ atual: 40, maximo: 40 })
  })

  it('tudo volta preso ao intervalo: -50 num PV 30 é zero, não -20', () => {
    expect(lerEntradaDeRecurso('-50', pv)).toEqual({ atual: 0, maximo: 45 })
    expect(lerEntradaDeRecurso('+50', pv)).toEqual({ atual: 45, maximo: 45 })
    expect(lerEntradaDeRecurso('999', pv)).toEqual({ atual: 45, maximo: 45 })
  })

  it('o que não lê é null — e quem chama não muda nada', () => {
    expect(lerEntradaDeRecurso('', pv)).toBeNull()
    expect(lerEntradaDeRecurso('muito', pv)).toBeNull()
    expect(lerEntradaDeRecurso('1e9', pv)).toBeNull()
    expect(lerEntradaDeRecurso('12345678', pv)).toBeNull()
  })
})
