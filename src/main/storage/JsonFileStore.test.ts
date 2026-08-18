import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JsonFileStore } from './JsonFileStore'

/**
 * Usa um diretório temporário real do SO (não mock de `fs`) — isto é
 * exatamente o código de I/O de produção, e o requisito que estamos
 * validando (tolerar arquivo ausente/corrompido, escrita atômica) só
 * significa alguma coisa contra um filesystem de verdade.
 */
describe('JsonFileStore', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'rolador-json-store-'))
    filePath = join(dir, 'nested', 'data.json')
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('devolve o valor padrão quando o arquivo ainda não existe', async () => {
    const store = new JsonFileStore(filePath, { items: [] as string[] })
    expect(await store.read()).toEqual({ items: [] })
  })

  it('escreve e lê de volta o mesmo valor (round-trip)', async () => {
    const store = new JsonFileStore<{ items: string[] }>(filePath, { items: [] })
    await store.write({ items: ['a', 'b', 'c'] })
    expect(await store.read()).toEqual({ items: ['a', 'b', 'c'] })
  })

  it('cria os diretórios pais que faltarem ao escrever', async () => {
    const store = new JsonFileStore(filePath, { items: [] as string[] })
    await store.write({ items: ['x'] })
    const stat = await fs.stat(filePath)
    expect(stat.isFile()).toBe(true)
  })

  it('não deixa o arquivo .tmp da escrita atômica para trás', async () => {
    const store = new JsonFileStore(filePath, { items: [] as string[] })
    await store.write({ items: ['x'] })
    await expect(fs.stat(`${filePath}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('cai no valor padrão em vez de propagar erro quando o conteúdo do arquivo está corrompido', async () => {
    await fs.mkdir(join(dir, 'nested'), { recursive: true })
    await fs.writeFile(filePath, '{ isto não é json válido', 'utf-8')

    const store = new JsonFileStore(filePath, { items: ['padrão'] as string[] })
    await expect(store.read()).resolves.toEqual({ items: ['padrão'] })
  })

  it('serializa gravações concorrentes — a última chamada sempre vence, nunca uma mais antiga por cima', async () => {
    const store = new JsonFileStore(filePath, { items: [] as string[] })
    // Dispara todas ao mesmo tempo (sem `await` entre elas) — sem a fila interna de `write()`,
    // a ordem de CONCLUSÃO no filesystem não é garantida seguir a ordem de CHAMADA, então o
    // arquivo final podia acabar com um valor do MEIO da sequência, não o último.
    const writes = Array.from({ length: 20 }, (_, i) => store.write({ items: [`v${i}`] }))
    await Promise.all(writes)
    expect(await store.read()).toEqual({ items: ['v19'] })
  })

  it('ainda propaga erros de filesystem que não são "arquivo ausente" ou "JSON inválido"', async () => {
    // Aponta o "arquivo" pra um caminho que na verdade é um diretório — fs.readFile
    // falha com EISDIR, um erro real de storage que não deve ser mascarado como
    // "arquivo ausente" nem "conteúdo corrompido".
    const store = new JsonFileStore(dir, { items: [] as string[] })
    await expect(store.read()).rejects.toMatchObject({ code: 'EISDIR' })
  })
})
