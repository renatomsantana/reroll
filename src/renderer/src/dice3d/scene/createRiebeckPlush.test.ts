import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { PART_NAMES, createRiebeckPlush } from './createRiebeckPlush'

/**
 * A pelúcia é decorativa: não tem colisor, não entra na física e nenhum resultado de rolagem
 * depende dela. O que ela TEM é um monte de peça posicionada por conta em relação às outras — e
 * foi exatamente aí que ela quebrou duas vezes, das duas só visível abrindo o app e olhando:
 *
 * 1. o tanque de oxigênio subiu até a altura da cabeça e as duas calotas claras apareceram uma de
 *    cada lado da cúpula amarela, dando ORELHAS ao boneco;
 * 2. a lanterna nasceu com o vidro aceso inteiramente DENTRO do próprio corpo dela, invisível de
 *    qualquer ângulo.
 *
 * Nenhuma das duas é pegável por typecheck nem por "renderizou sem erro": as duas versões
 * montavam a cena perfeitamente. São relações geométricas entre peças, e é isso que este arquivo
 * fixa — em vez de deixar a conferência dependendo de alguém lembrar de ampliar um print.
 */

/**
 * O código do boneco desenha textura em canvas 2D, e os testes rodam em Node (ver
 * `vitest.config.ts`, sem `environment`). O dublê abaixo aceita as chamadas de desenho e devolve
 * pixels zerados: nada aqui depende do CONTEÚDO da textura, só de onde as peças ficam. Um jsdom
 * com canvas de verdade resolveria igual, custando uma dependência nativa pesada pra conferir
 * posição de esfera.
 */
function installCanvasStub(): void {
  const context2d = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    clip: () => {},
    rotate: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4)
    }),
    putImageData: () => {}
  }

  ;(globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`dublê de document só sabe criar canvas, pediram ${tag}`)
      return { width: 0, height: 0, getContext: () => context2d }
    }
  }
}

/** Caixa envolvente EM COORDENADAS DO GRUPO de todas as peças com um dado nome. */
function boxOfParts(root: THREE.Object3D, name: string): THREE.Box3 {
  const box = new THREE.Box3()
  let found = 0
  root.updateWorldMatrix(true, true)
  root.traverse(object => {
    if (object.name !== name || !(object instanceof THREE.Mesh)) return
    found++
    box.expandByObject(object)
  })
  if (found === 0) throw new Error(`nenhuma peça chamada "${name}" no boneco`)
  return box
}

describe('createRiebeckPlush', () => {
  let plush: THREE.Group
  let bounds: THREE.Box3

  beforeAll(() => {
    installCanvasStub()
    plush = createRiebeckPlush()
    plush.updateWorldMatrix(true, true)
    bounds = new THREE.Box3().setFromObject(plush)
  })

  it('apoia o boneco no chão, sem vão embaixo das botas', () => {
    /**
     * A regressão que gerou este caso: o corpo é uma esfera achatada cuja barriga termina em 0.085,
     * e só as duas botas (pequenas, lá na frente) chegavam ao chão. De qualquer ângulo que não
     * fosse bem de frente, a bola do corpo aparecia PAIRANDO com um vão embaixo — o usuário
     * reportou como "o plush está flutuando" três vezes, e as duas primeiras tentativas de conserto
     * (altura do grupo, sombra de contato) erraram o alvo porque o problema não era onde o grupo
     * estava, era o boneco não encostar no chão DENTRO do próprio grupo.
     *
     * O que este caso exigia ANTES: que a BARRIGA afundasse (`body.min.y < 0`), via `SIT_DEPTH`
     * 0.14. Isso deixou de valer porque o usuário pediu explicitamente pra subir o boneco, e a
     * barriga enterrada era justamente todo o curso disponível — ver `SIT_DEPTH`, hoje em 0. A
     * escolha foi dele, com o motivo na mão; se o "flutuando" voltar, é aqui e lá que se desfaz.
     *
     * O que continua garantido, e é o que impede a regressão de verdade: as BOTAS encostam no
     * chão. Um boneco apoiado nos pés não tem vão embaixo — o defeito original era o grupo inteiro
     * pairando, não a barriga sem contato.
     */
    const boots = boxOfParts(plush, PART_NAMES.boot)
    expect(boots.min.y).toBeLessThanOrEqual(0)
    expect(boots.min.y).toBeGreaterThan(-0.1)
  })

  it('não enterra o boneco no chão', () => {
    // O contrapeso do caso acima: afundar até assentar não pode virar "sumir com o boneco". A
    // cabeça e o corpo precisam continuar bem acima da linha do chão.
    expect(bounds.min.y).toBeGreaterThan(-0.3)
    expect(bounds.max.y).toBeGreaterThan(1.2)
  })

  it('cabe na altura que `PLUSH_SCALE` assume', () => {
    // O comentário de `PLUSH_SCALE` dimensiona a pelúcia na cena a partir de "~1.5 até a cabeça,
    // ~1.8 com a antena". Se alguma peça crescer muito além disso, a escala da cena mente.
    const height = bounds.max.y - bounds.min.y
    expect(height).toBeGreaterThan(1.4)
    expect(height).toBeLessThan(1.95)
  })

  it('mantém o tanque de oxigênio ATRÁS do corpo', () => {
    // É uma mochila: se ela deixar de passar das costas, vira um caroço dentro da barriga.
    const tank = boxOfParts(plush, PART_NAMES.tank)
    expect(tank.max.z).toBeLessThan(-0.3)
  })

  it('não deixa o tanque subir até virar orelha ao lado da cabeça', () => {
    /**
     * A regressão real: com o topo do tanque na altura da cúpula, as calotas claras apareciam uma
     * de cada lado dela. A faixa de tricô é a linha de corte natural — abaixo dela o tanque está
     * atrás dos ombros, acima ele disputa silhueta com a cabeça.
     *
     * Contra o CENTRO da faixa, não contra o topo da caixa dela: a cabeça é montada inclinada
     * pra trás, e um anel inclinado tem a quina de trás quase 0.2 acima do próprio plano — a
     * caixa envolvente da faixa termina lá em cima, bem longe da linha onde o tricô de fato
     * cruza a cabeça. Medido contra essa caixa, o teste passava até com o tanque de volta na
     * altura que causou as orelhas, ou seja, não testava nada.
     */
    const tank = boxOfParts(plush, PART_NAMES.tank)
    const brim = boxOfParts(plush, PART_NAMES.brim)
    const brimLine = (brim.max.y + brim.min.y) / 2
    expect(tank.max.y).toBeLessThan(brimLine)
  })

  it('mantém o vidro da lanterna na PONTA DA FRENTE, iluminando pra fora', () => {
    /**
     * A outra regressão real: o vidro aceso nasceu com raio MENOR que o corpo da lanterna e ficou
     * lacrado dentro dele, invisível de qualquer ângulo.
     *
     * A versão anterior deste caso comparava RAIOS, porque a lanterna era um cilindro EM PÉ com o
     * vidro numa faixa no meio — lá, aparecer significava ser mais largo que o casco. Essa forma
     * era um lampião, e o usuário mandou trocar por uma lanterna deitada apontada pra frente. Na
     * forma nova o vidro é a TAMPA DA FRENTE, e o que garante que ele apareça deixou de ser
     * largura e passou a ser posição: ele tem que estar à frente de todas as peças do casco.
     *
     * Medido no eixo Z do próprio grupo da lanterna e não do boneco: ela é montada inclinada de
     * propósito (acompanha a curva do ombro), e no espaço do boneco "a frente" deixa de ser um
     * eixo só.
     */
    const localZ = (name: string): number[] => {
      const values: number[] = []
      plush.traverse(object => {
        if (object.name !== name || !(object instanceof THREE.Mesh)) return
        values.push(object.position.z)
      })
      return values
    }

    const [glassZ] = localZ(PART_NAMES.lanternGlass)
    const shellZ = localZ(PART_NAMES.lanternShell)
    expect(shellZ.length).toBeGreaterThan(1)
    for (const z of shellZ) {
      expect(glassZ).toBeGreaterThan(z)
    }
  })

  it('deita a lanterna no eixo da frente, em vez de deixá-la em pé como lampião', () => {
    /**
     * O que o usuário reportou: "a lanterna é um lampião ou lamparina, está errado". Em pé, com
     * alça em cima, a silhueta é de lamparina de mão; deitada apontando pra frente, é de lanterna
     * presa ao traje.
     *
     * O cilindro do three nasce ao longo do Y, então "deitada" é exatamente `rotation.x = π/2` em
     * cada peça. Testar o ângulo é o jeito de travar a FORMA — as posições sozinhas passariam
     * igual com as peças em pé, empilhadas na vertical.
     */
    const glass = plush.getObjectByName(PART_NAMES.lanternGlass)
    expect(glass).toBeDefined()
    expect(glass!.rotation.x).toBeCloseTo(Math.PI / 2, 5)
  })

  it('põe o emblema por FORA da barriga, não afundado nela', () => {
    /**
     * O emblema é um plano chapado colado numa esfera. Meio milímetro pra dentro e ele desaparece
     * dentro do corpo; coplanar, ele pisca conforme a câmera gira (o mesmo empate de profundidade
     * que já derrubou os ornamentos do estojo, ver `DiceCanvasMulti.tsx`). O z dele foi resolvido
     * pela equação da elipsoide do corpo justamente por isso, e este caso é o que impede alguém
     * de "arredondar" esse número depois.
     */
    const patch = boxOfParts(plush, PART_NAMES.patch)
    const body = boxOfParts(plush, PART_NAMES.body)
    expect(patch.min.z).toBeGreaterThan(0)
    expect(patch.max.z).toBeGreaterThan(body.max.z * 0.75)
  })

  it('não tem colisor nenhum: é decoração, não entra na física', () => {
    // Mesma convenção da prateleira e do estojo. Um dado que batesse na pelúcia mudaria o
    // resultado de uma rolagem por causa de um enfeite.
    let meshes = 0
    plush.traverse(object => {
      if (object instanceof THREE.Mesh) meshes++
      expect((object.userData as { collider?: unknown }).collider).toBeUndefined()
    })
    expect(meshes).toBeGreaterThan(20)
  })
})
