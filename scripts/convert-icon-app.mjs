import { writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildDir = join(__dirname, '..', 'build')
const sourcePng = join(__dirname, '..', 'png', 'logo 512x512 azul.png')

async function main() {
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(sourcePng).resize(size, size).png().toBuffer())
  )

  await writeFile(join(buildDir, 'icon.png'), pngBuffers[pngBuffers.length - 1])

  const icoBuffer = await pngToIco(pngBuffers)
  await writeFile(join(buildDir, 'icon.ico'), icoBuffer)

  console.log('Ícone gerado em build/icon.ico e build/icon.png a partir de png/logo 512x512 azul.png')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
