/**
 * Importar um `.glb` devolve a URL do arquivo, como qualquer outro asset — o `vite/client` já declara
 * isso pra imagem, áudio e fonte, mas não pra modelo 3D. Sem esta declaração o TypeScript recusa o
 * import em `createTowerModel.ts`, mesmo o empacotador resolvendo certo.
 */
declare module '*.glb' {
  const src: string
  export default src
}
