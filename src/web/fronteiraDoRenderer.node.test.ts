import { promises as fs } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

/**
 * O TESTE-GUARDIÃO da fronteira que torna a versão web (e a mobile) possível.
 *
 * O renderer inteiro fala com a plataforma por UMA porta só, o `window.api` — nenhum arquivo dele
 * importa `electron` nem módulo do Node. É essa disciplina que faz a migração pro navegador ser
 * "escrever outra implementação da ponte" (ver `src/web/api.ts`) em vez de uma reescrita. Ela se
 * perde fácil: basta um import de `fs` por conveniência num arquivo qualquer, e a fronteira fura
 * sem ninguém notar — o build do Electron continua passando, e só o build web quebra, semanas
 * depois, longe da causa.
 *
 * Os `*.node.test.ts` e as pastas `testes/` ficam de fora pela mesma regra do `tsconfig.web.json`:
 * são teste de integração e ferramenta de teste, e podem (devem) usar o disco de verdade.
 */

const PASTA_DO_RENDERER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'renderer', 'src')

const MODULOS_PROIBIDOS = [
  'electron',
  'fs',
  'path',
  'os',
  'crypto',
  'child_process',
  'net',
  'http',
  'https',
  'tls',
  'stream',
  'util',
  'worker_threads',
  'module',
  'v8',
  'vm',
  'zlib'
]

const IMPORT_PROIBIDO = new RegExp(
  `(from\\s*|require\\(\\s*|import\\(\\s*)['"](node:[^'"]*|${MODULOS_PROIBIDOS.join('|')})['"]`
)

async function arquivosDeCodigo(pasta: string): Promise<string[]> {
  const achados: string[] = []
  for (const entrada of await fs.readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === 'testes') continue
      achados.push(...(await arquivosDeCodigo(caminho)))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entrada.name)) continue
    if (entrada.name.includes('.node.test.')) continue
    achados.push(caminho)
  }
  return achados
}

describe('fronteira do renderer', () => {
  it('nenhum arquivo do renderer importa electron ou módulo do Node', async () => {
    const violacoes: string[] = []
    for (const arquivo of await arquivosDeCodigo(PASTA_DO_RENDERER)) {
      const conteudo = await fs.readFile(arquivo, 'utf-8')
      const casou = IMPORT_PROIBIDO.exec(conteudo)
      if (casou) violacoes.push(`${arquivo} importa '${casou[2]}'`)
    }
    expect(violacoes).toEqual([])
  })
})
