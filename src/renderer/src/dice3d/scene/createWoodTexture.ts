import * as THREE from 'three'

/**
 * Madeira procedural pra parede da bandeja e pra borda da mesa — pedido do usuário: "o hexágono
 * deixa mais rústico, algo como madeira".
 *
 * O mapa é QUASE BRANCO (um sussurro de quente), não castanho: ele modula o BRILHO — veio, juntas
 * e variação entre tábuas — e deixa a COR inteira por conta de quem usa (a escolha da aba Estilo).
 *
 * Já foi castanho de verdade, e isso foi um bug relatado pelo usuário: "as paredes não estão
 * mudando a cor direito". Medido na cena real, amostrando o pixel da parede da frente: pedindo
 * vermelho `#ff0000` saía `#ff966f`, pedindo azul `#0000ff` saía `#bb9698` e pedindo PRETO saía
 * `#bb966f` — ou seja, azul e preto davam praticamente o mesmo bege. Um mapa castanho multiplicando
 * a cor escolhida impõe o matiz dele; nenhuma escolha do usuário conseguia escapar do bege.
 *
 * A tentativa ANTERIOR a essa era um mapa cinza médio, e ela falhou pelo motivo oposto: multiplicar
 * `0.5` numa cor já escura apagava o veio. Por isso este está perto de 1.0 (base 0.94 de um branco
 * quase puro) e não no meio da escala — ele quase não escurece, só desenha.
 *
 * Desenhado em canvas, sem imagem externa, e com sorteio determinístico (seed fixa) pro veio não
 * mudar a cada remontagem da cena.
 */

const SIZE = 512
/** Tábuas por ladrilho: a parede hexagonal usa um ladrilho por lado (ver `WOOD_WALL_REPEAT`), então isto é "quantas tábuas por lado do hexágono". */
const PLANKS_PER_TILE = 3
const GRAIN_LINES = 260
const NORMAL_STRENGTH = 1.5

/** Quantas vezes o ladrilho se repete em volta da parede da bandeja — um por lado do hexágono, pras tábuas acompanharem as faces. */
export const WOOD_WALL_REPEAT = 6
/** Repetição na borda da mesa (circunferência bem maior que a da bandeja). */
export const WOOD_TABLE_REPEAT = 26

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/**
 * Tom da tábua, escalado por `value` (1 = claro cheio, <1 escurece). O sussurro de quente
 * (vermelho cheio, azul um pouco abaixo) é o que sobrou da madeira castanha: numa cor neutra
 * escolhida pelo usuário ele dá um calor de madeira encerada, e numa cor saturada some — bem
 * diferente do castanho de antes, que sequestrava o matiz.
 */
function woodFill(value: number, alpha = 1): string {
  const r = Math.round(Math.min(255, 255 * value))
  const g = Math.round(Math.min(255, 250 * value))
  const b = Math.round(Math.min(255, 240 * value))
  return `rgba(${r},${g},${b},${alpha})`
}

export interface WoodTextures {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
}

interface WoodCanvases {
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
}

/**
 * O DESENHO da madeira é sempre o mesmo (seed fixa, ver comentário do topo) — o que muda entre
 * chamadas é só `repeat`, que vive na `Texture`, não no canvas. Então os dois canvas são
 * desenhados UMA vez por sessão e reaproveitados.
 *
 * Isso importa de verdade: o normal map é um laço por pixel de 512×512 (262 mil iterações, cada
 * uma lendo quatro vizinhos), e ele era refeito do zero toda vez que a cena montava, que a prévia
 * da bandeja abria e — o pior caso — a cada troca de cor de parede/chão, porque o estojo era
 * reconstruído inteiro. Medido como a trava mais visível da aba Estilo.
 */
let cachedWoodCanvases: WoodCanvases | null = null

function drawWoodCanvases(): WoodCanvases {
  if (cachedWoodCanvases) return cachedWoodCanvases
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas para a madeira')

  const random = seededRandom(20260816)

  // Base clara: o mapa precisa ficar perto de 1.0 na média, senão ele não texturiza — escurece.
  ctx.fillStyle = woodFill(0.94)
  ctx.fillRect(0, 0, SIZE, SIZE)

  const plankHeight = SIZE / PLANKS_PER_TILE
  for (let plank = 0; plank < PLANKS_PER_TILE; plank++) {
    const top = plank * plankHeight
    // Cada tábua tem seu próprio tom: é a variação entre peças que faz ler como madeira montada,
    // e não como uma chapa única com riscos.
    ctx.fillStyle = woodFill(0.86 + random() * 0.16)
    ctx.fillRect(0, top, SIZE, plankHeight)

    // Veio: linhas horizontais onduladas, mais densas em algumas faixas (como os anéis de
    // crescimento aparecem quando a tábua é serrada).
    const linesInPlank = Math.round(GRAIN_LINES / PLANKS_PER_TILE)
    for (let i = 0; i < linesInPlank; i++) {
      const y = top + random() * plankHeight
      const dark = 0.62 + random() * 0.3
      const amplitude = 1 + random() * 4
      const wavelength = 90 + random() * 260
      const phase = random() * Math.PI * 2

      ctx.strokeStyle = woodFill(dark, 0.35 + random() * 0.4)
      ctx.lineWidth = 0.6 + random() * 1.8
      ctx.beginPath()
      for (let x = 0; x <= SIZE; x += 8) {
        const wave = y + Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude
        if (x === 0) ctx.moveTo(x, wave)
        else ctx.lineTo(x, wave)
      }
      ctx.stroke()
    }

    // Nós da madeira: o detalhe "rústico" por excelência. Poucos, senão vira estampa.
    if (random() > 0.45) {
      const knotX = 40 + random() * (SIZE - 80)
      const knotY = top + plankHeight * (0.3 + random() * 0.4)
      const radius = 5 + random() * 9
      for (let ring = 6; ring >= 1; ring--) {
        ctx.strokeStyle = woodFill(0.55 + ring * 0.05, 0.5)
        ctx.lineWidth = 1 + random()
        ctx.beginPath()
        ctx.ellipse(knotX, knotY, radius * ring * 0.34, radius * ring * 0.2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Junta entre tábuas: a linha escura que separa uma peça da outra.
    ctx.fillStyle = woodFill(0.42, 0.85)
    ctx.fillRect(0, top, SIZE, 2.5)
  }

  const colorData = ctx.getImageData(0, 0, SIZE, SIZE).data

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = SIZE
  normalCanvas.height = SIZE
  const normalCtx = normalCanvas.getContext('2d')
  if (!normalCtx) throw new Error('Não foi possível obter contexto 2D do canvas para o normal map da madeira')
  const normalImage = normalCtx.createImageData(SIZE, SIZE)

  const height = (x: number, y: number): number => {
    const cx = ((x % SIZE) + SIZE) % SIZE
    const cy = ((y % SIZE) + SIZE) % SIZE
    return colorData[(cy * SIZE + cx) * 4] / 255
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = (height(x - 1, y) - height(x + 1, y)) * NORMAL_STRENGTH
      const ny = (height(x, y - 1) - height(x, y + 1)) * NORMAL_STRENGTH
      const length = Math.sqrt(nx * nx + ny * ny + 1)
      const idx = (y * SIZE + x) * 4
      normalImage.data[idx] = Math.round(((nx / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255)
      normalImage.data[idx + 3] = 255
    }
  }
  normalCtx.putImageData(normalImage, 0, 0)

  cachedWoodCanvases = { color: canvas, normal: normalCanvas }
  return cachedWoodCanvases
}

/**
 * Cada chamador recebe as SUAS `CanvasTexture` (o `repeat` é por textura, e a bandeja, a borda da
 * mesa e o estojo usam repetições diferentes), mas todas apontam pro mesmo canvas já desenhado.
 * Envolver um canvas pronto numa textura é barato — o custo que valia a pena cortar era o desenho.
 */
export function createWoodTextures(repeatX: number, repeatY = 1): WoodTextures {
  const canvases = drawWoodCanvases()

  const map = new THREE.CanvasTexture(canvases.color)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = new THREE.CanvasTexture(canvases.normal)

  for (const texture of [map, normalMap]) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    // Mesma razão da grama: a parede é vista em ângulo, e sem anisotropia o veio vira borrão.
    texture.anisotropy = 8
  }

  return { map, normalMap }
}
