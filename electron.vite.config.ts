import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    /**
     * O `.glb` da torre (`assets/models/torre.glb`) é ASSET, não código.
     *
     * A lista de assets conhecidos do Vite cobre imagem, áudio, fonte e wasm, mas não modelo 3D —
     * sem isto ele tenta ler o arquivo binário como JavaScript e o build morre com "the content
     * contains invalid JS syntax". O `tsc` não pega isso (a declaração de tipo em
     * `types/assets.d.ts` resolve o import pro TypeScript), então só aparece na hora de empacotar.
     */
    assetsInclude: ['**/*.glb'],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
