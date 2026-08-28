/**
 * O pedaço de `Buffer` que o código do processo principal usa, reescrito pro navegador.
 *
 * A versão web NÃO duplica a lógica do main: ela roda os módulos dele (repositórios, handlers,
 * backups) em cima de shims — ver `vite.web.config.ts`. Esses módulos tocam `Buffer` em quatro
 * pontos: `toString('base64'/'latin1')` (páginas do PDF, imagens, assinatura `%PDF-`),
 * `Buffer.from(base64/bytes)` e `Buffer.byteLength` (teto das anotações). É só isso que existe
 * aqui; método que o app não chama fica de fora de propósito, porque cada método a mais é uma
 * promessa a mais de compatibilidade com o Node que ninguém está cobrando.
 *
 * Os estáticos entram por `Object.assign`, e não como `static` da classe: o `from` daqui tem outra
 * assinatura que o de `Uint8Array`, e como `static` o TypeScript recusa a sobrescrita (TS2417).
 *
 * O `bootstrap.ts` pendura isto em `globalThis.Buffer` antes de importar qualquer módulo do main.
 * Nos testes em Node o `Buffer` de verdade já existe e este arquivo nem entra.
 */
class BufferBase extends Uint8Array {
  toString(codificacao = 'utf-8'): string {
    if (codificacao === 'base64') return btoa(paraLatin1(this))
    if (codificacao === 'latin1' || codificacao === 'binary') return paraLatin1(this)
    return new TextDecoder().decode(this)
  }
}

export const BufferDoNavegador = Object.assign(BufferBase, {
  from(dados: string | Uint8Array | ArrayBuffer, codificacao = 'utf-8'): BufferBase {
    if (typeof dados === 'string') return new BufferBase(bytesDoTexto(dados, codificacao))
    if (dados instanceof ArrayBuffer) return new BufferBase(new Uint8Array(dados))
    return new BufferBase(dados)
  },
  byteLength(texto: string): number {
    return new TextEncoder().encode(texto).length
  },
  isBuffer(valor: unknown): boolean {
    return valor instanceof BufferBase
  }
})

function bytesDoTexto(texto: string, codificacao: string): Uint8Array {
  if (codificacao === 'base64') {
    const binario = atob(texto)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    return bytes
  }
  if (codificacao === 'latin1' || codificacao === 'binary') {
    const bytes = new Uint8Array(texto.length)
    for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i) & 0xff
    return bytes
  }
  return new TextEncoder().encode(texto)
}

/**
 * Em pedaços de 32 KB: `String.fromCharCode(...bytes)` de uma vez estoura a pilha de argumentos
 * com uma página de PDF de verdade (megabytes), e é exatamente esse o dado que passa por aqui.
 */
function paraLatin1(bytes: Uint8Array): string {
  const pedacos: string[] = []
  for (let i = 0; i < bytes.length; i += 0x8000) {
    pedacos.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)))
  }
  return pedacos.join('')
}
