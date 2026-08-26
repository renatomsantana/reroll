/**
 * O RECORTE da foto do personagem — "quero algo que seja zoom no rosto" (pedido do usuário).
 *
 * A foto vira um QUADRADO gravado no perfil (avatar, como na Steam), e é a pessoa quem diz onde o
 * rosto está: arrasta a imagem dentro do quadro e dá zoom. Nenhuma adivinhação de rosto — o app
 * não tem detector de rosto, e um recorte automático errado cortaria a cabeça de metade dos
 * retratos, que foi exatamente o motivo de a foto já ter deixado de ser quadrada uma vez.
 *
 * A matemática mora aqui, PURA e testada: o mesmo recorte que a pessoa vê no quadro é o que o
 * canvas grava, porque os dois usam esta função. O quadro tem `LADO_DO_QUADRO` px na tela; o
 * arquivo gravado tem `LADO_DA_SAIDA` (o crachá maior do app é 112px; 384 dá folga pra tela
 * de alta densidade sem engordar o `profiles.json`).
 */
export const LADO_DO_QUADRO = 256
export const LADO_DA_SAIDA = 384
export const ZOOM_MAXIMO = 4

export interface Recorte {
  /** Pixels da imagem por pixel do quadro — 1 = tamanho natural. */
  escala: number
  /** Deslocamento do centro da IMAGEM em relação ao centro do quadro, em px do quadro. */
  x: number
  y: number
}

export interface TamanhoDaImagem {
  largura: number
  altura: number
}

/** A escala em que a imagem COBRE o quadro inteiro — abaixo dela sobra fundo, e avatar não tem fundo. */
export function escalaMinima(imagem: TamanhoDaImagem): number {
  if (imagem.largura <= 0 || imagem.altura <= 0) return 1
  return Math.max(LADO_DO_QUADRO / imagem.largura, LADO_DO_QUADRO / imagem.altura)
}

/**
 * O recorte de partida: um pouco de zoom (15%) e a imagem puxada pra BAIXO no quadro, ou seja, o
 * quadro olhando pra parte de CIMA dela — onde o rosto está em quase todo retrato. É o "zoom no
 * rosto" sem detector: um chute bom, que a pessoa ajusta arrastando se não for.
 */
export function recorteInicial(imagem: TamanhoDaImagem): Recorte {
  const escala = escalaMinima(imagem) * 1.15
  const sobraVertical = Math.max(0, imagem.altura * escala - LADO_DO_QUADRO)
  return limitar({ escala, x: 0, y: sobraVertical * 0.3 }, imagem)
}

/** Dentro do que faz sentido: nunca menor que cobrir o quadro, nunca mais que o zoom máximo, e a imagem sempre cobrindo o quadro. */
export function limitar(recorte: Recorte, imagem: TamanhoDaImagem): Recorte {
  const minima = escalaMinima(imagem)
  const escala = Math.min(Math.max(recorte.escala, minima), Math.max(minima, minima * ZOOM_MAXIMO))
  const sobraX = Math.max(0, (imagem.largura * escala - LADO_DO_QUADRO) / 2)
  const sobraY = Math.max(0, (imagem.altura * escala - LADO_DO_QUADRO) / 2)
  return {
    escala,
    x: Math.min(Math.max(recorte.x, -sobraX), sobraX),
    y: Math.min(Math.max(recorte.y, -sobraY), sobraY)
  }
}

/** O retângulo da IMAGEM (em px dela) que aparece no quadro — o que o canvas copia pro arquivo. */
export function janelaNaImagem(recorte: Recorte, imagem: TamanhoDaImagem): { sx: number; sy: number; sw: number; sh: number } {
  const lado = LADO_DO_QUADRO / recorte.escala
  const centroX = imagem.largura / 2 - recorte.x / recorte.escala
  const centroY = imagem.altura / 2 - recorte.y / recorte.escala
  return { sx: centroX - lado / 2, sy: centroY - lado / 2, sw: lado, sh: lado }
}

/** O `transform` da imagem no quadro da tela — a mesma conta de `janelaNaImagem`, vista do outro lado. */
export function transformDaPrevia(recorte: Recorte): string {
  return `translate(calc(-50% + ${recorte.x}px), calc(-50% + ${recorte.y}px)) scale(${recorte.escala})`
}

/**
 * Grava o recorte num quadrado de `LADO_DA_SAIDA` como JPEG. É a ÚNICA parte com canvas — separada
 * pra a geometria acima poder ser testada no Node, onde não há canvas.
 */
export function gravarRecorte(imagem: HTMLImageElement, recorte: Recorte): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = LADO_DA_SAIDA
  canvas.height = LADO_DA_SAIDA
  const contexto = canvas.getContext('2d')
  if (!contexto) return null
  const { sx, sy, sw, sh } = janelaNaImagem(recorte, { largura: imagem.naturalWidth, altura: imagem.naturalHeight })
  contexto.drawImage(imagem, sx, sy, sw, sh, 0, 0, LADO_DA_SAIDA, LADO_DA_SAIDA)
  return canvas.toDataURL('image/jpeg', 0.9)
}
