import { describe, expect, it } from 'vitest'
import { sanearPreferencias } from './sanearSettings'
import { TRAY_SHAPE_SIDES, trayApothem, traySafeHalfExtent } from '@renderer/dice3d/geometry/trayShape'
import { computeSpawnSlots } from '@renderer/dice3d/physics/computeSpawnSlots'

/**
 * As preferências vêm do `localStorage`, que é texto — e a leitura era um `as Settings`, que é uma
 * promessa ao compilador que ninguém confere ao rodar.
 *
 * O caso que motiva isto está no primeiro teste: uma FORMA DE BANDEJA desconhecida não dá erro
 * nenhum, vira NaN na geometria e leva as posições de nascimento dos dados a `null`. A página de
 * rolagem morre e não existe botão no app que conserte — a pessoa teria que limpar o `localStorage`
 * por fora. É o tipo de defeito que chega junto com uma ATUALIZAÇÃO, em quem já usava o app.
 */

describe('o estrago que um valor desconhecido causa', () => {
  it('forma de bandeja inválida derruba a cena inteira em NaN', () => {
    /**
     * Não é suposição — é o que foi medido antes de escrever a higiene. Este teste existe pra que a
     * régua nunca seja afrouxada sem que alguém veja o tamanho do buraco que ela tapa.
     */
    const desconhecida = 'pentagon' as never
    expect(TRAY_SHAPE_SIDES[desconhecida]).toBeUndefined()
    expect(trayApothem(TRAY_SHAPE_SIDES[desconhecida])).toBeNaN()

    const slots = computeSpawnSlots(3, traySafeHalfExtent(TRAY_SHAPE_SIDES[desconhecida], 5))
    // Dados nascendo em lugar nenhum: a física recebe NaN e a bandeja fica vazia pra sempre.
    expect(slots.every((s) => !Number.isFinite(s.x) || !Number.isFinite(s.z))).toBe(true)
  })
})

describe('sanearPreferencias', () => {
  it('tira a forma de bandeja desconhecida, pra ela cair no padrão', () => {
    expect(sanearPreferencias({ trayShape: 'pentagon' })).toEqual({})
    expect(sanearPreferencias({ trayShape: 'hexagon' })).toEqual({ trayShape: 'hexagon' })
    // As quatro formas que existem hoje passam — a lista sai de `TRAY_SHAPES`, não de uma cópia.
    for (const forma of ['triangle', 'square', 'hexagon', 'circle']) {
      expect(sanearPreferencias({ trayShape: forma })).toEqual({ trayShape: forma })
    }
  })

  it('vale pros outros campos de valor fechado', () => {
    expect(sanearPreferencias({ theme: 'night' })).toEqual({ theme: 'night' })
    expect(sanearPreferencias({ theme: 'sepia' })).toEqual({})
    expect(sanearPreferencias({ launchMode: 'tower' })).toEqual({ launchMode: 'tower' })
    expect(sanearPreferencias({ launchMode: 'catapulta' })).toEqual({})
    expect(sanearPreferencias({ cameraMode: 'free' })).toEqual({ cameraMode: 'free' })
    expect(sanearPreferencias({ cameraMode: 'orbital' })).toEqual({})
    expect(sanearPreferencias({ diceMaterial: 'glass' })).toEqual({ diceMaterial: 'glass' })
    expect(sanearPreferencias({ diceMaterial: 'madeira' })).toEqual({})
    expect(sanearPreferencias({ language: 'en-US' })).toEqual({ language: 'en-US' })
    expect(sanearPreferencias({ language: 'fr-FR' })).toEqual({})
  })

  it('não é do tipo certo é o mesmo que não valer — número, nulo, objeto', () => {
    for (const lixo of [3, null, undefined, {}, [], true]) {
      expect(sanearPreferencias({ trayShape: lixo })).toEqual({})
    }
  })

  it('COR, TEXTO e BOOLEANO passam direto — errar neles é feio, não é fatal', () => {
    /**
     * A régua é de propósito estreita. Uma cor inválida deixa a parede preta; um `trayShape`
     * inválido mata a página. Filtrar tudo transformaria qualquer campo novo num campo que some
     * sozinho quando alguém esquecer de cadastrá-lo aqui.
     */
    const preferencias = {
      wallColor: 'não é cor',
      diceBodyColor: '#f2ead6',
      soundEnabled: false,
      backgroundImage: null,
      diceColorOverrides: { 20: { bodyColor: '#fff', numberColor: '#000' } },
      palettesVisible: true
    }
    expect(sanearPreferencias(preferencias)).toEqual(preferencias)
  })

  it('campo AUSENTE continua ausente — não inventa valor', () => {
    /**
     * Importa porque quem chama mescla isto por cima do padrão (ou do estado atual). Se a higiene
     * devolvesse `trayShape: undefined`, ela apagaria o valor bom que estava embaixo — trocar de
     * personagem jogaria a bandeja de todo mundo pro padrão.
     */
    const limpo = sanearPreferencias({ wallColor: '#000' })
    expect('trayShape' in limpo).toBe(false)
    expect({ trayShape: 'circle', ...limpo }).toEqual({ trayShape: 'circle', wallColor: '#000' })
  })

  it('não mexe no objeto que recebeu', () => {
    const original = { trayShape: 'pentagon', theme: 'day' }
    sanearPreferencias(original)
    expect(original).toEqual({ trayShape: 'pentagon', theme: 'day' })
  })
})
