import { simbolosDaFace, type DadoAssimilacao } from './d12'
import { SYMBOL_ART } from './symbols'
import { layoutDaFace, SYMBOL_SAFE_RADIUS } from './faceLayout'

export function drawAssimilacaoFace(ctx: CanvasRenderingContext2D, value: number, size: number, color: string, sides: DadoAssimilacao = 12): void {
  const symbols = simbolosDaFace(value, sides)
  const layout = layoutDaFace(symbols.length, sides)
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * SYMBOL_SAFE_RADIUS, 0, Math.PI * 2)
  ctx.clip()
  symbols.forEach((symbol, i) => {
    const { x, y, iconSize } = layout[i]
    const art = SYMBOL_ART[symbol]
    ctx.save()
    ctx.translate((x - iconSize / 2) * size, (y - iconSize / 2) * size)
    ctx.scale(iconSize * size / 100, iconSize * size / 100)
    ctx.fillStyle = ctx.strokeStyle = color
    ctx.fill(new Path2D(art.fill), 'evenodd')
    if (art.stroke) {
      ctx.lineWidth = 4
      ctx.lineCap = ctx.lineJoin = 'round'
      ctx.stroke(new Path2D(art.stroke))
    }
    ctx.restore()
  })
  ctx.restore()
}
