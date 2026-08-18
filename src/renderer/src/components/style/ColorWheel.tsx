import { useEffect, useRef, useState } from 'react'
import './ColorWheel.css'

/**
 * Disco de cor + barra de brilho, desenhados em canvas. Serve pra escolher QUALQUER cor na hora,
 * sem passar pelo diálogo nativo do Windows (que é o que o `input[type=color]` abre): o dado da
 * prévia acompanha o arrasto, então dá pra procurar o tom olhando o resultado em vez de olhando
 * um quadradinho.
 *
 * O par disco-redondo + barra-de-brilho ao lado é o mesmo desenho do "Definir cores
 * personalizadas" do Windows 98 (lá o campo é retangular, mas a ideia é a mesma: matiz e saturação
 * num plano, luminosidade numa régua separada) — por isso a moldura afundada de 2px em volta de
 * cada um, que é o que amarra a peça ao resto da janela.
 */

/**
 * O disco ocupa a largura que a coluna der, entre estes dois limites. Tamanho fixo não serve: ele
 * mora numa das colunas da grade de opções, que tem de 232px a ~300px conforme a janela — fixo no
 * maior ele vazaria da caixa na janela estreita, e fixo no menor desperdiçaria a folga da janela
 * larga, que é justamente onde o pedido era "a paletona, a roda gigante".
 */
const MIN_WHEEL_SIZE = 140
const MAX_WHEEL_SIZE = 300
const BAR_WIDTH = 26
/** Espaço entre disco e barra + as molduras de 2px dos dois. */
const ROW_EXTRAS = 8 + 8
const MARKER_RADIUS = 7
/** Passo do teclado — o disco é focável, então setas mexem matiz (←/→) e saturação (↑/↓). */
const KEY_HUE_STEP = 3
const KEY_UNIT_STEP = 0.02

interface Hsv {
  /** 0–360, com 0 (vermelho) no topo do disco. */
  h: number
  /** 0 no centro, 1 na borda. */
  s: number
  v: number
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.replace('#', ''), 16)
  if (Number.isNaN(value)) return { r: 0, g: 0, b: 0 }
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max / 255 }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255)
  }
}

function hsvToHex({ h, s, v }: Hsv): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsv(r, g, b)
}

/** Teto de 1.5 igual ao das prévias 3D (ver `previewLoop.ts`): o disco é redesenhado pixel a pixel em JavaScript a cada mudança de brilho, e a 2× isso é o dobro de trabalho sem diferença visível. */
function pixelRatio(): number {
  return Math.min(window.devicePixelRatio, 1.5)
}

/** Ângulo do disco → matiz. O `+90` põe o vermelho em cima (no eixo do canvas, `-90°` aponta pra cima). */
function angleToHue(dx: number, dy: number): number {
  const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  return hue < 0 ? hue + 360 : hue
}

/**
 * Desenha o disco inteiro pro brilho dado e devolve a imagem pronta. Fica guardada num ref porque
 * o marcador é redesenhado a cada movimento do mouse: repintar 216×216 pixels em JavaScript a cada
 * evento de arraste derrubaria a taxa de quadros: só o `putImageData` da cópia é barato.
 */
function paintWheel(ctx: CanvasRenderingContext2D, size: number, v: number): ImageData {
  const image = ctx.createImageData(size, size)
  const data = image.data
  const radius = size / 2
  for (let y = 0; y < size; y++) {
    const dy = y - radius + 0.5
    for (let x = 0; x < size; x++) {
      const dx = x - radius + 0.5
      const distance = Math.sqrt(dx * dx + dy * dy) / radius
      const index = (y * size + x) * 4
      if (distance > 1) continue
      const { r, g, b } = hsvToRgb(angleToHue(dx, dy), distance, v)
      data[index] = r
      data[index + 1] = g
      data[index + 2] = b
      // Serrilhado da borda: a última fatia de pixel desbota em vez de cortar seco.
      data[index + 3] = Math.round(255 * clamp01((1 - distance) * radius + 0.5))
    }
  }
  return image
}

function strokeMarker(ctx: CanvasRenderingContext2D, path: () => void): void {
  ctx.lineWidth = 3
  ctx.strokeStyle = '#000000'
  path()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  path()
}

interface ColorWheelProps {
  color: string
  onChange: (hex: string) => void
  /** Rótulo do disco pra leitor de tela — quem usa não vê "que cor de quê" está sendo editada. */
  label: string
  hexLabel: string
  brightnessLabel: string
}

export function ColorWheel({ color, onChange, label, hexLabel, brightnessLabel }: ColorWheelProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLCanvasElement>(null)
  const wheelImageRef = useRef<ImageData | null>(null)
  const draggingRef = useRef<'wheel' | 'bar' | null>(null)
  /**
   * HSV é o estado de trabalho, não a cor de fora. Preto e branco não têm matiz nenhum em RGB
   * (`#000000` e `#ffffff` dão o mesmo `h = 0`), então derivar o ângulo da cor recebida a cada
   * render jogaria o marcador pro vermelho assim que o brilho chegasse a zero — e a barra de
   * brilho deixaria de conseguir voltar pra cor de onde saiu.
   */
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color))
  /** Último hex EMITIDO por aqui: distingue "a cor mudou porque eu arrastei" de "mudou porque clicaram numa paleta / trocaram de dado", que é quando o HSV precisa ser refeito de fora. */
  const emittedRef = useRef(color)
  const [hexDraft, setHexDraft] = useState(color)
  const [wheelSize, setWheelSize] = useState(MIN_WHEEL_SIZE)

  /**
   * Mede a LINHA (que é `width: 100%` da caixa de grupo), não o canvas — o canvas tira o tamanho
   * daqui, então medi-lo seria um laço. A largura da linha vem da coluna da grade, que não depende
   * do conteúdo, então a medida se estabiliza no primeiro quadro.
   */
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    function measure(width: number): void {
      const available = width - BAR_WIDTH - ROW_EXTRAS
      setWheelSize(Math.round(Math.max(MIN_WHEEL_SIZE, Math.min(MAX_WHEEL_SIZE, available))))
    }
    measure(row.clientWidth)
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (color.toLowerCase() === emittedRef.current.toLowerCase()) return
    emittedRef.current = color
    setHsv(hexToHsv(color))
    setHexDraft(color)
  }, [color])

  function emit(next: Hsv): void {
    setHsv(next)
    const hex = hsvToHex(next)
    emittedRef.current = hex
    setHexDraft(hex)
    onChange(hex)
  }

  // Repinta o disco só quando o BRILHO muda — matiz e saturação só movem o marcador.
  useEffect(() => {
    const canvas = wheelRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const size = Math.round(wheelSize * pixelRatio())
    canvas.width = size
    canvas.height = size
    wheelImageRef.current = paintWheel(ctx, size, hsv.v)
  }, [hsv.v, wheelSize])

  // Marcador do disco. Roda depois do efeito acima (ordem de declaração), então na troca de brilho
  // o disco recém-pintado já está no canvas quando o marcador é desenhado por cima.
  useEffect(() => {
    const canvas = wheelRef.current
    const ctx = canvas?.getContext('2d')
    const image = wheelImageRef.current
    if (!canvas || !ctx || !image) return
    ctx.putImageData(image, 0, 0)

    const ratio = pixelRatio()
    ctx.save()
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const radius = wheelSize / 2
    const angle = ((hsv.h - 90) * Math.PI) / 180
    const x = radius + Math.cos(angle) * hsv.s * radius
    const y = radius + Math.sin(angle) * hsv.s * radius
    strokeMarker(ctx, () => {
      ctx.beginPath()
      ctx.arc(x, y, MARKER_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
    })
    ctx.restore()
  }, [hsv, wheelSize])

  // Barra de brilho: do tom cheio (em cima) até o preto (embaixo), sempre no matiz/saturação atuais.
  useEffect(() => {
    const canvas = barRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const ratio = pixelRatio()
    canvas.width = Math.round(BAR_WIDTH * ratio)
    canvas.height = Math.round(wheelSize * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    const gradient = ctx.createLinearGradient(0, 0, 0, wheelSize)
    gradient.addColorStop(0, hsvToHex({ h: hsv.h, s: hsv.s, v: 1 }))
    gradient.addColorStop(1, '#000000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, BAR_WIDTH, wheelSize)

    const y = (1 - hsv.v) * wheelSize
    strokeMarker(ctx, () => {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(BAR_WIDTH, y)
      ctx.stroke()
    })
  }, [hsv, wheelSize])

  function pickFromWheel(clientX: number, clientY: number): void {
    const canvas = wheelRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const radius = rect.width / 2
    const dx = clientX - rect.left - radius
    const dy = clientY - rect.top - radius
    const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / radius)
    // Sair do preto ao tocar no disco: com `v = 0` toda escolha de matiz continuaria preta, e
    // pareceria que o disco parou de funcionar.
    emit({ h: angleToHue(dx, dy), s: distance, v: hsv.v === 0 ? 1 : hsv.v })
  }

  function pickFromBar(clientY: number): void {
    const canvas = barRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    emit({ ...hsv, v: clamp01(1 - (clientY - rect.top) / rect.height) })
  }

  function handlePointerDown(target: 'wheel' | 'bar', e: React.PointerEvent<HTMLCanvasElement>): void {
    draggingRef.current = target
    // A cor é aplicada ANTES de pedir a captura: o clique tem que valer mesmo que a captura falhe
    // (é ela quem faz o arraste continuar valendo fora do canvas, não o clique em si).
    if (target === 'wheel') pickFromWheel(e.clientX, e.clientY)
    else pickFromBar(e.clientY)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(target: 'wheel' | 'bar', e: React.PointerEvent<HTMLCanvasElement>): void {
    if (draggingRef.current !== target) return
    if (target === 'wheel') pickFromWheel(e.clientX, e.clientY)
    else pickFromBar(e.clientY)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>): void {
    draggingRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function handleWheelKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>): void {
    const step = e.shiftKey ? 4 : 1
    if (e.key === 'ArrowLeft') emit({ ...hsv, h: (hsv.h - KEY_HUE_STEP * step + 360) % 360 })
    else if (e.key === 'ArrowRight') emit({ ...hsv, h: (hsv.h + KEY_HUE_STEP * step) % 360 })
    else if (e.key === 'ArrowUp') emit({ ...hsv, s: clamp01(hsv.s + KEY_UNIT_STEP * step) })
    else if (e.key === 'ArrowDown') emit({ ...hsv, s: clamp01(hsv.s - KEY_UNIT_STEP * step) })
    else return
    e.preventDefault()
  }

  function handleBarKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>): void {
    const step = e.shiftKey ? 4 : 1
    if (e.key === 'ArrowUp') emit({ ...hsv, v: clamp01(hsv.v + KEY_UNIT_STEP * step) })
    else if (e.key === 'ArrowDown') emit({ ...hsv, v: clamp01(hsv.v - KEY_UNIT_STEP * step) })
    else return
    e.preventDefault()
  }

  /** O campo aceita o que estiver sendo digitado e só aplica quando vira um hex completo — senão apagar um dígito pra corrigir já mandaria uma cor errada pro dado. */
  function handleHexChange(value: string): void {
    const draft = value.startsWith('#') ? value : `#${value}`
    setHexDraft(draft)
    if (!/^#[0-9a-f]{6}$/i.test(draft)) return
    emittedRef.current = draft
    setHsv(hexToHsv(draft))
    onChange(draft)
  }

  return (
    <div className="color-wheel">
      <div className="color-wheel-row" ref={rowRef}>
        <div className="color-wheel-frame">
          <canvas
            ref={wheelRef}
            className="color-wheel-disc"
            style={{ width: wheelSize, height: wheelSize }}
            tabIndex={0}
            role="img"
            aria-label={label}
            onPointerDown={(e) => handlePointerDown('wheel', e)}
            onPointerMove={(e) => handlePointerMove('wheel', e)}
            onPointerUp={handlePointerUp}
            onKeyDown={handleWheelKeyDown}
          />
        </div>
        <div className="color-wheel-frame">
          <canvas
            ref={barRef}
            className="color-wheel-bar"
            style={{ width: BAR_WIDTH, height: wheelSize }}
            tabIndex={0}
            role="img"
            aria-label={brightnessLabel}
            onPointerDown={(e) => handlePointerDown('bar', e)}
            onPointerMove={(e) => handlePointerMove('bar', e)}
            onPointerUp={handlePointerUp}
            onKeyDown={handleBarKeyDown}
          />
        </div>
      </div>

      <label className="color-wheel-hex">
        <span>{hexLabel}</span>
        <input
          type="text"
          spellCheck={false}
          maxLength={7}
          value={hexDraft}
          onChange={(e) => handleHexChange(e.target.value)}
        />
        <span className="color-wheel-chip" style={{ background: color }} />
      </label>
    </div>
  )
}
