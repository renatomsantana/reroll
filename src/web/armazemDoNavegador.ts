/**
 * O `ArmazemDeArquivos` de verdade do navegador: IndexedDB, banco `reroll-web`, um object store
 * (`arquivos`) com os bytes por chave.
 *
 * IndexedDB e não `localStorage` porque as páginas do PDF da ficha são megabytes em base64 — a
 * cota do `localStorage` (uns 5 MB) morreria na primeira ficha importada. O `localStorage`
 * continua sendo usado pelo RENDERER pras preferências visuais, como no app; aqui é só o que no
 * desktop seria a pasta `userData`.
 *
 * Cada operação abre a própria transação: as gravações já chegam serializadas por arquivo (a fila
 * do `JsonFileStore`), então não há o que coordenar entre transações.
 */
import type { ArmazemDeArquivos } from './shims/fs'

/**
 * Pede ao navegador que trate os dados do Reroll como persistentes. Sem isso, IndexedDB continua
 * guardando tudo normalmente, mas o browser pode apagar dados de sites pouco usados quando falta
 * espaço no dispositivo. A permissão é uma sugestão: alguns navegadores a concedem de imediato,
 * outros decidem pela frequência de uso, e a recusa nunca impede o app de abrir.
 */
export async function pedirPersistenciaDoNavegador(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Privacidade do navegador não pode impedir a rolagem nem o acesso aos dados já existentes.
  }
}

export function criarArmazemDoNavegador(nomeDoBanco = 'reroll-web'): ArmazemDeArquivos {
  let aberto: Promise<IDBDatabase> | null = null

  const abrir = (): Promise<IDBDatabase> => {
    aberto ??= new Promise((resolve, reject) => {
      const pedido = indexedDB.open(nomeDoBanco, 1)
      pedido.onupgradeneeded = () => pedido.result.createObjectStore('arquivos')
      pedido.onsuccess = () => resolve(pedido.result)
      pedido.onerror = () => reject(pedido.error ?? new Error('O IndexedDB não abriu.'))
    })
    return aberto
  }

  const operacao = async <T>(
    modo: IDBTransactionMode,
    acao: (loja: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const banco = await abrir()
    return new Promise<T>((resolve, reject) => {
      const pedido = acao(banco.transaction('arquivos', modo).objectStore('arquivos'))
      pedido.onsuccess = () => resolve(pedido.result)
      pedido.onerror = () => reject(pedido.error ?? new Error('Falha no IndexedDB.'))
    })
  }

  return {
    ler: (chave) => operacao('readonly', (loja) => loja.get(chave) as IDBRequest<Uint8Array | undefined>),
    gravar: (chave, valor) => operacao('readwrite', (loja) => loja.put(valor, chave)).then(() => undefined),
    apagar: (chave) => operacao('readwrite', (loja) => loja.delete(chave)).then(() => undefined),
    chaves: () => operacao('readonly', (loja) => loja.getAllKeys()).then((chaves) => chaves.map(String))
  }
}
