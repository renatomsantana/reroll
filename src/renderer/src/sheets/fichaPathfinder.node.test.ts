import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { readSheet } from './readers/index'
import { abrirPdfNoNode } from './testes/abrirPdfNoNode'

/**
 * As fichas REAIS de Pathfinder 2e que o usuário pôs em `Fichas RPG/` — moram fora do repositório,
 * e os testes pulam sozinhos onde a pasta não existe.
 *
 * Quatro arquivos, quatro respostas diferentes do importador, e é isso que se cobra:
 * - a ficha preenchida (Rilver) é reconhecida e sai inteira;
 * - o modelo em branco da mesma família é reconhecido, sem nome e sem lacuna;
 * - a ficha oficial da Paizo tem campos sem nome (`text_15gujr`) — fica no genérico, e em branco
 *   avisa que está em branco;
 * - o livro de regras (338 páginas) é livro, e nada é lido dele.
 */

const PASTA = join(process.cwd(), 'Fichas RPG')
const RILVER = join(PASTA, 'ficha Rilver - pf2e.pdf')
const EM_BRANCO = join(PASTA, 'fichaeditavelcomcalculos.pdf')
const OFICIAL = join(PASTA, 'RemasterPlayerCoreCharacterSheet Form Fillable.pdf')
const LIVRO = join(PASTA, 'Pathfinder 2e - GM Core Remaster.pdf')

describe.skipIf(!existsSync(RILVER))('Pathfinder 2e — a ficha do Rilver', () => {
  it('sai inteira: nome, perícias com total refeito, ataques como presets', async () => {
    const lido = readSheet(await abrirPdfNoNode(RILVER))
    expect(lido.readerId).toBe('pathfinder2e')
    expect(lido.characterName).toBe('Rilver')
    expect(lido.system).toBe('Pathfinder 2e')
    const valor = (label: string) => lido.fields.find((c) => c.label === label)?.value
    expect(valor('Classe')).toBe('Monge')
    expect(valor('Furtividade')).toBe('+7')
    // Total vazio no arquivo (calculado por JavaScript): refeito de Destreza 4 + proficiência 3.
    expect(valor('Acrobacia')).toBe('+7')
    expect(valor('Fortitude')).toBe('+8')
    expect(valor('Vontade')).toBe('+5')
    expect(valor('CA')).toBe('19')
    expect(valor('PV máximo')).toBe('21')
    expect(valor('PV atual')).toBe('')
    const presets = lido.presets.map((p) => p.name)
    expect(presets).toEqual(expect.arrayContaining(['fist (ataque)', 'fist (dano)', 'Shortbow (ataque)', 'Shortbow (dano)']))
    expect(lido.fields.length).toBeGreaterThanOrEqual(50)
    // Nada de rótulo cru do modelo ("Cla", "D", "Aumento Parcial") — era o que o genérico produzia.
    expect(lido.fields.some((c) => /^(Cla|D|A|V|E|d|Aumento Parcial)$/.test(c.label))).toBe(false)
  })
})

describe.skipIf(!existsSync(EM_BRANCO))('Pathfinder 2e — o modelo em branco da mesma família', () => {
  it('é reconhecido, sem nome e sem lacuna', async () => {
    const lido = readSheet(await abrirPdfNoNode(EM_BRANCO))
    expect(lido.readerId).toBe('pathfinder2e')
    expect(lido.characterName).toBe('')
    expect(lido.warnings).toContain('sem-nome-nem-rolagem')
    expect(lido.fields.every((c) => c.value !== '')).toBe(true)
    expect(lido.presets).toEqual([])
  })
})

describe.skipIf(!existsSync(OFICIAL))('a ficha oficial da Paizo, em branco', () => {
  it('tem campos sem nome: fica no genérico e avisa que está em branco', async () => {
    const lido = readSheet(await abrirPdfNoNode(OFICIAL))
    expect(lido.readerId).toBe('generico')
    expect(lido.characterName).toBe('')
    expect(lido.warnings).toContain('formulario-vazio')
    expect(lido.fields).toEqual([])
  })
})

describe.skipIf(!existsSync(LIVRO))('o livro de regras', () => {
  it('é livro, não ficha: avisa e não lê nada', async () => {
    const lido = readSheet(await abrirPdfNoNode(LIVRO))
    expect(lido.warnings).toEqual(['paginas-demais'])
    expect(lido.characterName).toBe('')
    expect(lido.fields).toEqual([])
    expect(lido.presets).toEqual([])
  })
})
