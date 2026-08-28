import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * O build da VERSÃO WEB — um site estático em `out/web/`, totalmente à parte do build do Electron
 * (`electron.vite.config.ts` continua intocado; o instalador não muda um byte por causa deste
 * arquivo).
 *
 * O truque que evita reescrever o app: os módulos do processo principal são empacotados JUNTO do
 * renderer, e os aliases abaixo trocam as portas de plataforma deles (`fs`, `path`, `crypto`,
 * `electron`) pelos shims de `src/web/shims/` — IndexedDB no lugar do disco, seletor de arquivo do
 * navegador no lugar do diálogo nativo. Ver o cabeçalho de `src/web/shims/fs.ts`.
 */

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  version: string
}

export default defineConfig({
  root: 'src/web',
  base: './',
  publicDir: 'public',
  // O `.glb` da torre é asset, não código — mesmo motivo do `electron.vite.config.ts`.
  assetsInclude: ['**/*.glb'],
  define: {
    __VERSAO_DO_APP__: JSON.stringify(version)
  },
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared'),
      electron: resolve(__dirname, 'src/web/shims/electron.ts'),
      fs: resolve(__dirname, 'src/web/shims/fs.ts'),
      path: resolve(__dirname, 'src/web/shims/path.ts'),
      crypto: resolve(__dirname, 'src/web/shims/crypto.ts')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'out/web'),
    emptyOutDir: true,
    // Pelo await de topo do bootstrap.ts; todo navegador que roda o resto do app aceita.
    target: 'es2022'
  }
})
