import sans from './sans.png'
import papyrus from './papyrus.png'

/**
 * Easter egg das fontes: as duas fontes que dão nome aos irmãos esqueletos de Undertale ganham a
 * cabecinha deles do lado do nome (ver `FontMascot.tsx`). As artes são as que o usuário deixou em
 * `png/`, reduzidas pra 48px de altura — não são desenhadas em código: uma primeira versão foi, e
 * ele reprovou ("não ficou muito parecido, eu coloquei exemplos").
 */
export const FONT_MASCOTS: Record<string, string> = {
  'comic-sans': sans,
  papyrus
}
