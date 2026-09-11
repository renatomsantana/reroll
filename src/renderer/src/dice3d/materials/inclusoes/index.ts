import florRosaComRaiz from './flor-rosa-com-raiz.png'
import papoulaComRaiz from './papoula-com-raiz.png'
import agriaoComRaiz from './agriao-com-raiz.png'
import avencaDeSementes from './avenca-de-sementes.png'
import saxifragaComRaiz from './saxifraga-com-raiz.png'
import avencaComFlor from './avenca-com-flor.png'
import samambaia from './samambaia.png'
import samambaiaPequena from './samambaia-pequena.png'
import cauleComRaiz from './caule-com-raiz.png'

/**
 * AS PLANTAS DE VERDADE que vão dentro do dado de resina: recortes de fichas de herbário (planta
 * prensada com flor, caule e raiz) em domínio público, com o papel trocado por transparência. A
 * origem de cada uma e a licença estão em `CREDITOS.txt` ao lado.
 *
 * Elas substituíram os desenhos de canvas da primeira versão, que ele achou falsos ("queria algo
 * mais igual à imagem, tipo uma flor com raízes, parece vários PNGs", 11/09/2026).
 */
export const FLORES = {
  'flor-rosa-com-raiz': florRosaComRaiz,
  'papoula-com-raiz': papoulaComRaiz,
  'agriao-com-raiz': agriaoComRaiz,
  'avenca-de-sementes': avencaDeSementes,
  'saxifraga-com-raiz': saxifragaComRaiz,
  'avenca-com-flor': avencaComFlor
} as const

export const FOLHAS = {
  samambaia,
  'samambaia-pequena': samambaiaPequena,
  'caule-com-raiz': cauleComRaiz
} as const

export type TipoDeInclusao = keyof typeof FLORES | keyof typeof FOLHAS

export const IMAGENS: Record<TipoDeInclusao, string> = { ...FLORES, ...FOLHAS }
