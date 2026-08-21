import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    /**
     * `.tsx` junto: os testes de COMPONENTE e de gancho de React precisam de JSX, e sem esta
     * extensão eles simplesmente não eram coletados — o arquivo existia e nada rodava.
     */
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    /**
     * O ambiente padrão continua sendo Node, porque a esmagadora maioria dos testes é de lógica pura
     * e o `jsdom` custa tempo de arranque em cada arquivo. Quem precisa de DOM pede pelo comentário
     * `// @vitest-environment jsdom` na primeira linha.
     */
    environment: 'node'
  }
})
