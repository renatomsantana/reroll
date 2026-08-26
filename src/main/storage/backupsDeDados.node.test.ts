import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BACKUPS_DE_VERSAO_A_MANTER, carimboDeData, fazerBackupSeMudouDeVersao, guardarPersonagemApagado } from './backupsDeDados'

/**
 * Os backups da pasta de dados (spec §8.1): a primeira abertura de uma versão nova copia tudo antes
 * de ler; só os três últimos ficam; personagem apagado vai pra pasta de backup. Com disco de verdade.
 */
const raiz = join(tmpdir(), `reroll-teste-backups-${process.pid}-${Date.now()}`)

async function pastaDeDados(nome: string): Promise<string> {
  const userData = join(raiz, nome)
  await fs.mkdir(join(userData, 'profiles', 'p1'), { recursive: true })
  await fs.writeFile(join(userData, 'profiles.json'), '{"profiles":[{"id":"p1","name":"Matias"}],"activeId":"p1"}')
  await fs.writeFile(join(userData, 'profiles', 'p1', 'notes.json'), '{"characterName":"Matias"}')
  await fs.writeFile(join(userData, 'settings.json'), '{"appIconId":"r"}')
  // O que NÃO é dado: o cache do Chromium fica de fora.
  await fs.mkdir(join(userData, 'Cache'), { recursive: true })
  await fs.writeFile(join(userData, 'Cache', 'grande.bin'), 'x'.repeat(1000))
  return userData
}

describe('o backup antes de abrir uma versão nova', () => {
  beforeAll(() => fs.mkdir(raiz, { recursive: true }))
  afterAll(() => fs.rm(raiz, { recursive: true, force: true }))

  it('copia os dados na primeira abertura da versão, e só eles', async () => {
    const userData = await pastaDeDados('a')
    const destino = await fazerBackupSeMudouDeVersao(userData, '1.1.0-beta.5', new Date(2026, 7, 26, 0, 42, 12))
    expect(destino).toBe(join(userData, 'backups', 'pre-1.1.0-beta.5-20260826-004212'))

    expect(await fs.readFile(join(destino!, 'profiles.json'), 'utf-8')).toContain('Matias')
    expect(await fs.readFile(join(destino!, 'profiles', 'p1', 'notes.json'), 'utf-8')).toContain('Matias')
    expect(await fs.readFile(join(destino!, 'settings.json'), 'utf-8')).toContain('appIconId')
    expect(await fs.readFile(join(destino!, 'LEIA-ME.txt'), 'utf-8')).toContain('1.1.0-beta.5')
    await expect(fs.access(join(destino!, 'Cache'))).rejects.toThrow()

    // Os originais continuam onde estavam: é CÓPIA.
    expect(await fs.readFile(join(userData, 'profiles.json'), 'utf-8')).toContain('Matias')
    // A versão ficou anotada, então a próxima abertura da mesma versão não copia de novo.
    expect(await fazerBackupSeMudouDeVersao(userData, '1.1.0-beta.5')).toBeNull()
    // Outra versão copia de novo, e o LEIA-ME diz de qual veio.
    const segundo = await fazerBackupSeMudouDeVersao(userData, '1.1.0-beta.6', new Date(2026, 7, 27, 9, 0, 0))
    expect(await fs.readFile(join(segundo!, 'LEIA-ME.txt'), 'utf-8')).toContain('a versão anterior era 1.1.0-beta.5')
  })

  it('instalação nova, sem dado nenhum, só anota a versão', async () => {
    const userData = join(raiz, 'vazia')
    expect(await fazerBackupSeMudouDeVersao(userData, '1.1.0')).toBeNull()
    expect(JSON.parse(await fs.readFile(join(userData, 'versao.json'), 'utf-8'))).toEqual({ versao: '1.1.0' })
    await expect(fs.access(join(userData, 'backups'))).rejects.toThrow()
  })

  it('ficam só os três últimos backups de versão; os de personagem apagado não entram na conta', async () => {
    const userData = await pastaDeDados('c')
    await guardarPersonagemApagado(userData, 'p1', new Date(2026, 0, 1))
    await fs.mkdir(join(userData, 'profiles', 'p1'), { recursive: true })
    for (let i = 1; i <= BACKUPS_DE_VERSAO_A_MANTER + 2; i++) {
      await fazerBackupSeMudouDeVersao(userData, `2.0.${i}`, new Date(2026, 7, i, 12, 0, 0))
    }
    const pastas = (await fs.readdir(join(userData, 'backups'))).sort()
    expect(pastas.filter((p) => p.startsWith('pre-'))).toEqual([
      'pre-2.0.3-20260803-120000',
      'pre-2.0.4-20260804-120000',
      'pre-2.0.5-20260805-120000'
    ])
    expect(pastas).toContain('personagens-apagados')
  })
})

describe('o personagem apagado', () => {
  it('a pasta dele vai pra backups/personagens-apagados, e some de profiles/', async () => {
    const userData = await pastaDeDados('d')
    const destino = await guardarPersonagemApagado(userData, 'p1', new Date(2026, 7, 26, 1, 2, 3))
    expect(destino).toBe(join(userData, 'backups', 'personagens-apagados', 'p1-20260826-010203'))
    expect(await fs.readFile(join(destino!, 'notes.json'), 'utf-8')).toContain('Matias')
    await expect(fs.access(join(userData, 'profiles', 'p1'))).rejects.toThrow()
  })

  it('personagem que nunca escreveu nada não tem pasta, e não é erro', async () => {
    const userData = await pastaDeDados('e')
    expect(await guardarPersonagemApagado(userData, 'nunca-existiu')).toBeNull()
  })

  it('o carimbo ordena como o tempo', () => {
    expect(carimboDeData(new Date(2026, 7, 26, 0, 42, 12))).toBe('20260826-004212')
    expect(carimboDeData(new Date(2026, 11, 5, 23, 5, 9))).toBe('20261205-230509')
  })
})
