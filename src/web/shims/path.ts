/**
 * O pedaço de `path` que o código do processo principal usa (`join`, `dirname`, `basename`,
 * `extname`), em estilo POSIX: no navegador todo caminho é virtual e vive como chave no
 * armazenamento (ver `fs.ts`), então a barra é sempre `/` e não existe letra de unidade.
 *
 * Não é o `path` inteiro de propósito — mesma régua do `buffer.ts`: cada função a mais seria uma
 * promessa de compatibilidade que ninguém está cobrando.
 */

export function join(...partes: string[]): string {
  const juntas = partes.filter((parte) => parte !== '').join('/')
  return normalizar(juntas)
}

export function dirname(caminho: string): string {
  const limpo = normalizar(caminho)
  const corte = limpo.lastIndexOf('/')
  if (corte === -1) return '.'
  if (corte === 0) return '/'
  return limpo.slice(0, corte)
}

export function basename(caminho: string): string {
  const limpo = normalizar(caminho)
  return limpo.slice(limpo.lastIndexOf('/') + 1)
}

export function extname(caminho: string): string {
  const nome = basename(caminho)
  const ponto = nome.lastIndexOf('.')
  // Mesma regra do Node: sem ponto, ou começando por ele (`.gitignore`), não há extensão.
  return ponto <= 0 ? '' : nome.slice(ponto)
}

/** Barra dupla e `.`/`..` resolvidos; a barra do começo, quando houver, fica. */
function normalizar(caminho: string): string {
  const absoluto = caminho.startsWith('/') || caminho.startsWith('\\')
  const partes: string[] = []
  for (const parte of caminho.replace(/\\/g, '/').split('/')) {
    if (parte === '' || parte === '.') continue
    if (parte === '..') {
      partes.pop()
      continue
    }
    partes.push(parte)
  }
  return (absoluto ? '/' : '') + partes.join('/')
}

export default { join, dirname, basename, extname }
