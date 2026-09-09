/**
 * OS ÍCONES DO APP DE ANDROID, tirados da MESMA arte do ícone do executável — o d20 vermelho com o
 * "R" (`build/icons/base.png`, o `DEFAULT_APP_ICON_ID` de `src/shared/appIcons.ts`).
 *
 *     node scripts/iconesDoAndroid.mjs
 *
 * Existe pelo mesmo motivo do `generate-icon.mjs`: o `npx cap add android` deixa o ícone genérico do
 * Capacitor, e trocar cinco tamanhos à mão é o tipo de coisa que se faz uma vez e nunca mais — aí o
 * dia em que o desenho mudar, o app de Android fica com o antigo e ninguém percebe.
 *
 * São DOIS formatos, e o segundo é o que quase todo mundo vê:
 *
 * - `ic_launcher.png` / `ic_launcher_round.png`: o ícone tradicional, um por densidade de tela;
 * - `ic_launcher_foreground.png`: a CAMADA DA FRENTE do ícone adaptativo (Android 8 pra cá), que é o
 *   que o sistema recorta em círculo, quadrado ou bolha conforme o aparelho.
 *
 * O ícone adaptativo tem uma regra que não dá pra ignorar: dos 108dp da camada, só os 72dp do meio
 * são garantidos — o resto pode ser cortado por qualquer máscara. Por isso a arte entra em 66% do
 * quadro, centralizada, com a folga em volta. Desenho encostando na borda sai com o canto comido.
 */
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEM = join(RAIZ, 'build', 'icons', 'base.png')
const RES = join(RAIZ, 'android', 'app', 'src', 'main', 'res')

/** Os cinco baldes de densidade do Android, com o lado do ícone em pixels em cada um. */
const DENSIDADES = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192]
]

/** O lado da camada da frente do adaptativo em cada densidade: 108dp contra os 48dp do tradicional. */
const LADO_ADAPTATIVO = 108 / 48
/** Quanto do quadro a arte ocupa. Ver a regra dos 72dp de área segura no cabeçalho. */
const AREA_SEGURA = 0.66

async function gerar() {
  for (const [pasta, lado] of DENSIDADES) {
    const destino = join(RES, pasta)
    await mkdir(destino, { recursive: true })

    const quadrado = await sharp(ORIGEM).resize(lado, lado, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    await writeFile(join(destino, 'ic_launcher.png'), quadrado)
    // O "round" é o mesmo desenho: quem recorta em círculo é o launcher, e a arte já é um d20 que
    // cabe na máscara. Um arquivo separado com outro desenho seria mais uma coisa pra divergir.
    await writeFile(join(destino, 'ic_launcher_round.png'), quadrado)

    const ladoDaFrente = Math.round(lado * LADO_ADAPTATIVO)
    const ladoDaArte = Math.round(ladoDaFrente * AREA_SEGURA)
    const arte = await sharp(ORIGEM).resize(ladoDaArte, ladoDaArte, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    const frente = await sharp({
      create: { width: ladoDaFrente, height: ladoDaFrente, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: arte, gravity: 'centre' }])
      .png()
      .toBuffer()
    await writeFile(join(destino, 'ic_launcher_foreground.png'), frente)
  }

  /*
   * O ícone de 512 que a FICHA DA LOJA pede (é upload separado, não entra no apk). Fica em
   * `build/` junto dos outros, e não em `android/`, porque não é recurso do app.
   */
  await sharp(ORIGEM).resize(512, 512).png().toFile(join(RAIZ, 'build', 'icone-play-store-512.png'))

  console.log('ícones do Android gerados a partir de', ORIGEM)
}

gerar().catch((causa) => {
  console.error('não deu pra gerar os ícones:', causa)
  process.exit(1)
})
