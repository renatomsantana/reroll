/**
 * O Node 26 expõe um `localStorage` global experimental que fica `undefined` quando o processo não
 * recebe `--localstorage-file`. Ele encobre até o armazenamento do jsdom. Um armazenamento pequeno e
 * isolado por worker é mais fiel aos testes que compartilhar um arquivo entre todos os processos.
 */
if (typeof globalThis.document !== 'undefined') {
  const dados = new Map()
  const armazenamento = {
    clear: () => dados.clear(),
    getItem: (chave) => dados.get(String(chave)) ?? null,
    key: (indice) => [...dados.keys()][indice] ?? null,
    removeItem: (chave) => dados.delete(String(chave)),
    setItem: (chave, valor) => dados.set(String(chave), String(valor)),
    get length() {
      return dados.size
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: armazenamento
  })
}
