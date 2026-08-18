import * as THREE from 'three'

export interface NumberTextureOptions {
  numberColor?: string
  /** Cor do CORPO do dado, em CSS (ex.: '#f2ead6') — ver comentário grande abaixo sobre por que isso é desenhado no canvas em vez de aplicado via `material.color`. */
  bodyColor?: string
  size?: number
  /** Altura do número como fração da altura do canvas. Ver `DEFAULT_NUMBER_FONT_HEIGHT_FRACTION`. */
  fontHeightFraction?: number
  /** Texto a desenhar, se for diferente do número em si (ex.: "00" na face de valor 0 do dado de dezenas do d100). */
  label?: string
}

/** `0xf2ead6` (numérico, formato THREE.Color) -> `'#f2ead6'` (CSS, formato canvas 2D). */
export function numericColorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Fração padrão usada quando o chamador não pede um tamanho específico. Os
 * dados com uma face quadrada/retangular (d6) e o d4 (números pequenos, 3
 * por face) definem o próprio valor explicitamente — só os poliedros
 * genéricos (d8/d10/d12/d20, ver `buildPolyhedronGeometry.ts`) usam este
 * padrão, então ajustar um não muda o outro.
 */
export const DEFAULT_NUMBER_FONT_HEIGHT_FRACTION = 0.55

/**
 * Desenha um número num canvas 2D com o fundo na cor REAL do corpo do dado e
 * devolve como `CanvasTexture`. O material que usa esta textura deve manter
 * `material.color` NEUTRO (branco, `0xffffff`) — nunca a cor do corpo.
 *
 * Antes o fundo era sempre branco puro e a cor do corpo vinha de
 * `material.color` multiplicando a textura inteira (branco × cor = cor, sem
 * precisar regerar textura ao trocar a cor). O problema: isso multiplica
 * IGUALMENTE os pixels do NÚMERO, não só o fundo — um número branco
 * (`numberColor: '#ffffff'`) virava invisível (branco × corDoCorpo =
 * corDoCorpo, exatamente igual ao fundo já multiplicado), e qualquer outra
 * cor de número saía tingida pela cor do corpo em vez de sair na cor exata
 * escolhida. Desenhar o fundo já na cor certa (e manter `material.color`
 * neutro) faz o número sair sempre na cor exata pedida, custando regerar a
 * textura quando a cor muda — aceitável porque a troca de cor já força
 * recriar a cena inteira de qualquer forma (ver `DiceRoller3D.tsx`).
 */
/**
 * Desenha só o NÚMERO, num quadrado de lado `size` a partir da origem atual do contexto (sem
 * pintar fundo nenhum). Extraído de `createNumberTexture` pra que o atlas
 * (`createNumberAtlas.ts`) desenhe cada célula exatamente com a mesma tipografia/centralização
 * de sempre, em vez de reimplementar (e divergir com o tempo).
 */
export function drawNumberGlyph(
  ctx: CanvasRenderingContext2D,
  value: number,
  size: number,
  options: { numberColor?: string; fontHeightFraction?: number; label?: string } = {}
): void {
  const numberColor = options.numberColor ?? '#1a1a1a'
  const label = options.label ?? String(value)
  // Números de 2 dígitos (10-20) são bem mais LARGOS que os de 1 dígito na mesma altura de
  // fonte — ver comentário original em `createNumberTexture`.
  const digitCountFactor = label.length >= 2 ? 0.78 : 1
  const fontHeightFraction =
    (options.fontHeightFraction ?? DEFAULT_NUMBER_FONT_HEIGHT_FRACTION) * digitCountFactor

  ctx.fillStyle = numberColor
  ctx.font = `bold ${Math.round(size * fontHeightFraction)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, size / 2, size / 2 + size * 0.03)
}

export function createNumberTexture(
  value: number,
  options: NumberTextureOptions = {}
): THREE.CanvasTexture {
  const size = options.size ?? 256
  const numberColor = options.numberColor ?? '#1a1a1a'
  const bodyColor = options.bodyColor ?? '#f2ead6'
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível obter contexto 2D do canvas para desenhar o número do dado')
  }

  ctx.fillStyle = bodyColor
  ctx.fillRect(0, 0, size, size)
  drawNumberGlyph(ctx, value, size, {
    numberColor,
    fontHeightFraction: options.fontHeightFraction,
    label: options.label
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
