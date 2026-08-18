import { mkdir, readdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
const iconsDir = join(buildDir, 'icons')

/**
 * O ícone do EXECUTÁVEL (e portanto do instalador) sai do desenho PRINCIPAL do app: o d20 vermelho
 * com o "R" — o mesmo `DEFAULT_APP_ICON_ID` de `src/shared/appIcons.ts`, que é o que a janela usa
 * pra quem nunca abriu as Preferências. Se o padrão mudar lá, muda aqui.
 *
 * Antes este script desenhava um d20 genérico em SVG aqui dentro, de uma versão anterior do app.
 * Os arquivos em `build/` já tinham sido substituídos à mão pelo desenho de verdade, então rodar
 * `npm run icon:generate` DESFAZIA o ícone bom e devolvia o placeholder — exatamente o problema que
 * este arquivo deveria resolver. Derivando da arte que o app já usa, os dois não têm como divergir.
 */
const SOURCE_ICON = join(iconsDir, 'base.png')

/**
 * Todos os tamanhos que o Windows pede em algum lugar: 16/24/32 na barra de tarefas e nas listas,
 * 48 no Explorer, 256 no cartão grande e no menu Iniciar. Um `.ico` sem os tamanhos pequenos força
 * o Windows a reduzir o de 256 na hora, e o resultado na barra de tarefas fica borrado.
 */
const SIZES = [16, 24, 32, 48, 64, 128, 256]

/** Converte um PNG em `.ico` multi-tamanho. */
async function pngToIcoBuffer(pngPath) {
  const pngBuffers = await Promise.all(
    SIZES.map((size) =>
      sharp(pngPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  )
  return { ico: await pngToIco(pngBuffers), largestPng: pngBuffers[pngBuffers.length - 1] }
}

async function main() {
  await mkdir(buildDir, { recursive: true })

  const { ico, largestPng } = await pngToIcoBuffer(SOURCE_ICON)
  await writeFile(join(buildDir, 'icon.png'), largestPng)
  await writeFile(join(buildDir, 'icon.ico'), ico)
  console.log(`build/icon.ico e build/icon.png (a partir de ${SOURCE_ICON})`)

  /**
   * Um `.ico` por cor, ao lado do `.png` de cada uma. O `.png` serve pro `nativeImage` da janela;
   * o `.ico` é pro ÍCONE DOS ATALHOS (`.lnk`), que é o que a barra de tarefas mostra quando o app
   * declara um AppUserModelID — ver `shortcutIcon.ts`. Atalho do Windows não aceita PNG: o campo
   * de ícone só entende `.ico`, `.exe` ou `.dll`.
   */
  const pngs = (await readdir(iconsDir)).filter((name) => name.endsWith('.png'))
  for (const png of pngs) {
    const { ico: colorIco } = await pngToIcoBuffer(join(iconsDir, png))
    await writeFile(join(iconsDir, png.replace(/\.png$/, '.ico')), colorIco)
  }
  console.log(`${pngs.length} ícones de atalho gerados em build/icons/*.ico`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
