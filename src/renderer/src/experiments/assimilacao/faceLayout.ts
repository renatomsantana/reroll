// O d12 usa círculo UV de 0.38; a pipa do d10 precisa de um grupo menor.
// O ajuste conserva o desenho inteiro dentro da própria face (faceLayout.test.ts).
export const SYMBOL_SAFE_RADIUS = 0.35

export function layoutDaFace(count: number, sides: 6 | 10 | 12 = 12): { x: number; y: number; iconSize: number }[] {
  const scale = sides === 10 ? 0.5 : 1
  const cols = count <= 1 ? 1 : 2
  const rows = Math.ceil(count / cols)
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const inRow = Math.min(cols, count - row * cols)
    return {
      x: 0.5 + (i % cols - (inRow - 1) / 2) * 0.25 * scale,
      y: 0.5 + (row - (rows - 1) / 2) * 0.25 * scale,
      iconSize: (count === 1 ? 0.48 : 0.22) * scale
    }
  })
}
