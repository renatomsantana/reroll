/**
 * O sistema de arquivos virtual da versão web.
 *
 * A decisão de arquitetura da ponte web inteira está aqui: em vez de REESCREVER os repositórios e
 * handlers do processo principal pra IndexedDB (uma segunda implementação que ia divergir da
 * primeira a cada mudança), a versão web RODA os módulos do main como estão, e este arquivo
 * responde pelas chamadas de `fs` deles. A fila de gravação atômica do `JsonFileStore`, o
 * tudo-ou-nada da importação de ficha, os backups do §8.1/§9.1: tudo roda idêntico, porque é o
 * MESMO código.
 *
 * O "disco" é um armazém de chave-valor (`ArmazemDeArquivos`): IndexedDB no navegador (ver
 * `armazemDoNavegador.ts`), um Map em memória nos testes. Cada arquivo é uma chave
 * `arquivo:<caminho>` com os bytes; cada pasta é um marcador `pasta:<caminho>` (o marcador existe
 * porque pasta recém-criada e ainda vazia precisa responder a `readdir` — ver
 * `PaginasRepository.gravar`, que cria a pasta e lista antes de escrever).
 *
 * Só o que o código do main chama existe aqui (mesma régua dos outros shims): readFile, writeFile,
 * stat, access, mkdir, readdir, rename, rm e cp. As faltas conhecidas em relação ao Node: `rename`
 * e `cp` de pasta não são atômicos (movem chave a chave), o que não aparece na prática porque cada
 * arquivo tem um escritor só (a fila do `JsonFileStore`).
 */

export interface ArmazemDeArquivos {
  ler(chave: string): Promise<Uint8Array | undefined>
  gravar(chave: string, valor: Uint8Array): Promise<void>
  apagar(chave: string): Promise<void>
  chaves(): Promise<string[]>
}

let armazem: ArmazemDeArquivos | null = null

/** O bootstrap (ou o teste) escolhe onde os arquivos vivem ANTES de qualquer módulo do main rodar. */
export function configurarArmazemDeArquivos(novo: ArmazemDeArquivos): void {
  armazem = novo
}

export function criarArmazemEmMemoria(): ArmazemDeArquivos {
  const mapa = new Map<string, Uint8Array>()
  return {
    ler: (chave) => Promise.resolve(mapa.get(chave)),
    gravar: (chave, valor) => {
      mapa.set(chave, valor.slice())
      return Promise.resolve()
    },
    apagar: (chave) => {
      mapa.delete(chave)
      return Promise.resolve()
    },
    chaves: () => Promise.resolve([...mapa.keys()])
  }
}

function kv(): ArmazemDeArquivos {
  if (!armazem) throw new Error('Armazém de arquivos não configurado (ver bootstrap.ts).')
  return armazem
}

const ARQUIVO = 'arquivo:'
const PASTA = 'pasta:'
const NADA = new Uint8Array(0)

/** Toda entrada é normalizada: barra invertida vira `/` (os testes rodam no Windows) e `..` resolve. */
function normalizar(caminho: string): string {
  const partes: string[] = []
  for (const parte of caminho.replace(/\\/g, '/').split('/')) {
    if (parte === '' || parte === '.') continue
    if (parte === '..') {
      partes.pop()
      continue
    }
    partes.push(parte)
  }
  return '/' + partes.join('/')
}

/** O mesmo formato de erro do Node: quem trata (`JsonFileStore`, migrações) pergunta pelo `code`. */
function erro(codigo: string, caminho: string): Error & { code: string } {
  return Object.assign(new Error(`${codigo}: ${caminho}`), { code: codigo })
}

function pastaDe(caminho: string): string {
  const corte = caminho.lastIndexOf('/')
  return corte <= 0 ? '/' : caminho.slice(0, corte)
}

/** A chave pertence à subárvore do caminho (o próprio, ou algo dentro dele)? */
function pertenceA(chave: string, caminho: string): boolean {
  const dela = chave.startsWith(ARQUIVO) ? chave.slice(ARQUIVO.length) : chave.slice(PASTA.length)
  return dela === caminho || dela.startsWith(`${caminho}/`)
}

async function existePasta(caminho: string): Promise<boolean> {
  if (caminho === '/') return true
  const chaves = await kv().chaves()
  return chaves.some((chave) => pertenceA(chave, caminho))
}

/** Marcadores pro caminho e todos os ancestrais: `mkdir -p` de verdade. */
async function criarPastas(caminho: string): Promise<void> {
  let atual = ''
  for (const parte of caminho.split('/')) {
    if (parte === '') continue
    atual += `/${parte}`
    await kv().gravar(PASTA + atual, NADA)
  }
}

async function moverOuCopiarArvore(de: string, para: string, apagarOrigem: boolean): Promise<void> {
  const chaves = (await kv().chaves()).filter((chave) => pertenceA(chave, de))
  await criarPastas(para)
  for (const chave of chaves) {
    const tipo = chave.startsWith(ARQUIVO) ? ARQUIVO : PASTA
    const caminhoDaChave = chave.slice(tipo.length)
    const nova = tipo + para + caminhoDaChave.slice(de.length)
    const bytes = (await kv().ler(chave)) ?? NADA
    await kv().gravar(nova, bytes)
    if (apagarOrigem) await kv().apagar(chave)
  }
}

export const promises = {
  async readFile(caminho: string, codificacao?: string): Promise<string | Uint8Array> {
    const bytes = await kv().ler(ARQUIVO + normalizar(caminho))
    if (bytes === undefined) throw erro('ENOENT', caminho)
    if (codificacao) return new TextDecoder().decode(bytes)
    // O chamador faz `.toString('base64')` etc. no resultado — por isso volta como Buffer, não
    // Uint8Array crua. No navegador `Buffer` é o `BufferDoNavegador` pendurado pelo bootstrap.
    return Buffer.from(bytes)
  },

  async writeFile(caminho: string, dados: string | Uint8Array): Promise<void> {
    const alvo = normalizar(caminho)
    await criarPastas(pastaDe(alvo))
    const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados)
    await kv().gravar(ARQUIVO + alvo, bytes)
  },

  async stat(caminho: string): Promise<{ isFile(): boolean; isDirectory(): boolean; size: number }> {
    const alvo = normalizar(caminho)
    const bytes = await kv().ler(ARQUIVO + alvo)
    if (bytes !== undefined) return { isFile: () => true, isDirectory: () => false, size: bytes.length }
    if (await existePasta(alvo)) return { isFile: () => false, isDirectory: () => true, size: 0 }
    throw erro('ENOENT', caminho)
  },

  async access(caminho: string): Promise<void> {
    await promises.stat(caminho)
  },

  async mkdir(caminho: string, _opcoes?: { recursive?: boolean }): Promise<void> {
    await criarPastas(normalizar(caminho))
  },

  async readdir(
    caminho: string,
    opcoes?: { withFileTypes?: boolean }
  ): Promise<string[] | Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>> {
    const alvo = normalizar(caminho)
    const chaves = await kv().chaves()
    /** nome do filho direto → é pasta? */
    const filhos = new Map<string, boolean>()
    for (const chave of chaves) {
      const tipo = chave.startsWith(ARQUIVO) ? ARQUIVO : PASTA
      const dela = chave.slice(tipo.length)
      if (!dela.startsWith(`${alvo === '/' ? '' : alvo}/`)) continue
      const resto = dela.slice(alvo === '/' ? 1 : alvo.length + 1)
      const corte = resto.indexOf('/')
      const nome = corte === -1 ? resto : resto.slice(0, corte)
      if (nome === '') continue
      const ehPastaFilha = corte !== -1 || tipo === PASTA
      filhos.set(nome, (filhos.get(nome) ?? false) || ehPastaFilha)
    }
    if (filhos.size === 0 && !chaves.includes(PASTA + alvo) && alvo !== '/') throw erro('ENOENT', caminho)
    const nomes = [...filhos.keys()].sort()
    if (opcoes?.withFileTypes) {
      return nomes.map((nome) => ({
        name: nome,
        isFile: () => filhos.get(nome) !== true,
        isDirectory: () => filhos.get(nome) === true
      }))
    }
    return nomes
  },

  async rename(de: string, para: string): Promise<void> {
    const origem = normalizar(de)
    const destino = normalizar(para)
    const bytes = await kv().ler(ARQUIVO + origem)
    if (bytes !== undefined) {
      await promises.writeFile(destino, bytes)
      await kv().apagar(ARQUIVO + origem)
      return
    }
    if (!(await existePasta(origem))) throw erro('ENOENT', de)
    await moverOuCopiarArvore(origem, destino, true)
  },

  async rm(caminho: string, opcoes?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const alvo = normalizar(caminho)
    const afetadas = (await kv().chaves()).filter((chave) => pertenceA(chave, alvo))
    if (afetadas.length === 0) {
      if (opcoes?.force) return
      throw erro('ENOENT', caminho)
    }
    for (const chave of afetadas) await kv().apagar(chave)
  },

  async cp(de: string, para: string, _opcoes?: { recursive?: boolean }): Promise<void> {
    const origem = normalizar(de)
    const destino = normalizar(para)
    const bytes = await kv().ler(ARQUIVO + origem)
    if (bytes !== undefined) {
      await promises.writeFile(destino, bytes)
      return
    }
    if (!(await existePasta(origem))) throw erro('ENOENT', de)
    await moverOuCopiarArvore(origem, destino, false)
  }
}

export default { promises }
