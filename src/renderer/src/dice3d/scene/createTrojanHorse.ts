import * as THREE from 'three'
import { createWoodTextures } from './createWoodTexture'

/**
 * CAVALO DE TROIA — um BRINQUEDO DE MADEIRA RECORTADO sobre plataforma com rodas.
 *
 * SEGUNDA versão, e de outro partido. A primeira tentou o bicho anatômico: tronco, pescoço, cabeça
 * e quatro pernas como peças separadas encaixadas, do jeito que a torre de castelo é feita. O
 * veredito do usuário foi "ta horroroso refaz", e ele estava certo — o problema não era acabamento,
 * era o método. Primitiva é ótima pra ARQUITETURA (uma torre É cilindro, cone e caixa) e péssima
 * pra BICHO: cada peça encaixada lê como peça encaixada, e nenhuma quantidade de ajuste conserta
 * isso.
 *
 * O partido novo assume o material em vez de brigar com ele. O bicho é UMA SILHUETA recortada de
 * tábua grossa, como brinquedo de pular ou cavalinho de puxar: corpo, pernas, pescoço, cabeça,
 * CRINA e CAUDA saem todos do mesmo contorno (ver `PERFIL`). Nada é colado — e é justamente o
 * colado que denunciava a versão anterior, com a cauda boiando atrás e a crina em escadinha.
 *
 * Continua vindo das fotos que o usuário deixou em `torre 3D/`: a plataforma com rodas e as
 * proporções são de `troia2.jpg`, as amarrações de corda são de `troia.jpg`. O que mudou é que
 * agora ele não tenta IMITAR as fotos, ele lê como o mesmo objeto feito de um jeito mais simples.
 *
 * Decorativo, como a pelúcia do Riebeck: nunca ganha corpo físico nem collider.
 */

/**
 * ESCALA E ORÇAMENTO DE DETALHE.
 *
 * Na câmera padrão (`CAMERA_CONFIG`, fov 45 em (0, 13, 14.65)) o assento fica a ~23.5, onde o quadro
 * tem 19.5 unidades de altura: numa janela de ~700px, 1 unidade ≈ 36px. Daí sai o que existe aqui —
 * roda (40px), corda (5px), olho (7px) — e o que não existe: nada abaixo de 0.1 de tamanho, que
 * viraria ruído cinza.
 */
const ALTURA_TOTAL = 4.3

/**
 * As três medidas de partida, TIRADAS DA FOTO por varredura de pixel, não estimadas no olho.
 *
 * O harness separa o bicho do fundo por saturação (fundo cinza, madeira marrom), acha a linha do
 * tampo do carrinho — a única faixa que atravessa a foto inteira — e mede tudo a partir dela. Deu:
 * tampo a 33,7% da altura total, bicho ocupando os 66,3% de cima, e o carrinho 1,052 de comprimento
 * por altura.
 *
 * Isso é o conserto da terceira versão. Nas duas primeiras eu estimei proporção olhando, e errei o
 * essencial pelo mesmo lado nas duas: a foto tem PERNA LONGA (o vão da barriga fica a 30% da altura
 * do bicho) e corpo raso, e eu fiz perna curta com corpo fundo — que é o que faz um cavalo virar
 * bassê.
 */
const TAMPO_Y = ALTURA_TOTAL * 0.337
/** Altura do bicho sozinho, do tampo ao alto da orelha — a unidade em que o `PERFIL` é escrito. */
const ALTURA_BICHO = ALTURA_TOTAL * 0.663
/** Raio da roda — diâmetro ~21% da altura na foto. */
const RAIO_RODA = ALTURA_TOTAL * 0.105
/**
 * Espessura do costado.
 *
 * Passeou por 0.86 → 0.99 → 1.4 → 1.05 conforme o usuário pediu "mais gordo" e depois voltou atrás
 * ("diminui o torso entao e mostra as pernas"). O 1.4 era a SAIA, larga o bastante pra esconder a
 * perna de quem olha de frente; com a perna à mostra de novo, ela não precisa mais disso, mas
 * continua acima da medida original porque é a espessura que dá volume ao bicho.
 */
const ESPESSURA_CORPO = 1.05
/** Espessura de cada tábua de perna, pregada nos dois flancos. */
const ESPESSURA_PERNA = 0.2
/**
 * Bisel do corpo — e ele é PEQUENO por uma razão de geometria, não de gosto.
 *
 * O bisel arredonda o costado, mas ele engorda o contorno pra fora e encolhe em direção às faces: um
 * bisel maior que METADE da peça mais fina engole essa peça. A perna tem 0.29 de largura (0.145 de
 * meia), então com os 0.34 de antes ela simplesmente desaparecia do recorte — foi por isso que as
 * pernas viraram cilindros soltos, e por isso que elas liam como peça separada.
 *
 * Com 0.12 a perna sobrevive ao arredondamento e volta a ser o MESMO pedaço de madeira que o tronco,
 * que é o que o usuário pediu ("perna conectada ao tronco, sem se dividirem"). O volume do corpo
 * perde um pouco de barriga arredondada, e é um preço que vale: emenda aparente incomoda mais que
 * quina suave.
 */
const BISEL_CORPO = 0.12
const PLATAFORMA_LARGURA = ESPESSURA_CORPO + ESPESSURA_PERNA * 2 + 0.5

/**
 * O CONTORNO do bicho, LIDO DA FOTO por varredura de pixel — não desenhado à mão.
 *
 * Cada número aqui é medida: o harness separou o cavalo do fundo, cortou o carrinho fora, e andou
 * coluna a coluna anotando onde a silhueta começa e termina. O resultado passou por Douglas-Peucker
 * (tolerância 0.012) pra virar 36 pontos em vez de 146 — o que se joga fora nessa simplificação é
 * ruído de borda de JPEG, não desenho.
 *
 * Unidade: ALTURA DO BICHO = 1, com zero no tampo do carrinho e o focinho no +Z (a foto tem a cabeça
 * à esquerda; o espelhamento foi feito na geração). Multiplicar por `ALTURA_BICHO` na hora de
 * recortar é o que traz pra escala da cena.
 *
 * O traço fechado traz tudo: peito, pescoço, cabeça, orelha, os dentes da crina, dorso, garupa,
 * cauda, as duas pernas de perto e a barriga entre elas. Nada é colado — e era o colado que
 * denunciava as versões anteriores.
 */
const PERFIL: [number, number][] = [
  [-0.715, 0.432],
  [-0.653, 0.677],
  [-0.594, 0.725],
  [-0.516, 0.752],
  [-0.416, 0.758],
  [-0.1, 0.702],
  [0.199, 0.818],
  [0.219, 0.86],
  [0.297, 0.922],
  [0.475, 0.994],
  [0.516, 0.995],
  [0.535, 0.933],
  [0.576, 0.963],
  [0.594, 0.868],
  [0.654, 0.804],
  [0.715, 0.672],
  [0.715, 0.58],
  [0.654, 0.545],
  [0.594, 0.57],
  [0.576, 0.621],
  [0.475, 0.689],
  [0.416, 0.675],
  [0.297, 0.549],
  [0.199, 0.279],
  [0.179, 0.002],
  [0.078, 0.002],
  [0.039, 0.317],
  [-0.039, 0.295],
  [-0.158, 0.296],
  [-0.297, 0.303],
  [-0.416, 0.336],
  [-0.436, 0.002],
  [-0.635, 0.002],
  [-0.653, 0.395],
  [-0.674, 0.336],
  [-0.715, 0.346]
]

/**
 * As duas pernas DE FORA, na mesma unidade, tiradas dos mesmos trechos medidos: onde o casco encosta
 * no tampo, a coluna vira perna.
 *
 * O TOPO das duas é mais baixo que o medido de propósito. Elas ficam por fora do tronco, então tudo
 * o que passar da barriga aparece — e a traseira, com o 0.57 medido, espetava acima da linha da
 * barriga como um bico atrás do bicho (visto na renderização). Parando pouco acima do vão, elas
 * entram no corpo e somem.
 */
const PERNA_DIANTEIRA: [number, number][] = [
  [0.078, 0],
  [0.078, 0.36],
  [0.128, 0.44],
  [0.179, 0.36],
  [0.179, 0]
]
const PERNA_TRASEIRA: [number, number][] = [
  [-0.635, 0],
  [-0.635, 0.4],
  [-0.535, 0.44],
  [-0.436, 0.4],
  [-0.436, 0]
]

/**
 * O TRONCO: o contorno medido, sem os recortes das pernas (a linha da barriga passa reto por cima
 * dos dois vãos) e crescido pra virar a SAIA que esconde as pernas.
 *
 * As pernas saíram do recorte porque o corpo é um volume arredondado (ver `criarCorpo`), e um bisel
 * grande o bastante pra arredondar o costado é MAIOR que a largura de uma perna: ela desapareceria,
 * ou pior, a geometria se autointersectaria. Elas viraram peças redondas próprias.
 *
 * O crescimento tem DOIS EIXOS, e misturá-los num número só foi erro meu — esticando os dois juntos
 * o bicho ficou comprido e deitado, e o usuário corrigiu ("nao vc deitou o torsto eu quero ele maior
 * pra esquerda e direita, tipo uma saia que esconda as pernas"):
 *
 * - COMPRIMENTO fica o MEDIDO na foto (1.0). Foi esticá-lo que deu o ar de dachshund.
 * - ALTURA cresce pra baixo, ANCORADA NO TOPO (`1 - (1 - y) * escala`), o que mantém dorso, cabeça
 *   e orelha exatamente onde a foto os pôs e derruba só a barriga.
 *
 * Onde está hoje: 1.05, quase o contorno medido, com a perna à MOSTRA — o usuário pediu a saia,
 * viu, e voltou atrás ("cara diminui o torso entao e mostra as pernas deixa elas conectadas").
 *
 * Fica registrado onde é o limite, que foi calculado e não tentado: a barriga medida está em 0.279,
 * e com o crescimento ancorado no topo ela ENCOSTA no carrinho quando a escala passa de
 * `1 / (1 - 0.279)`, ou seja 1.387. Acima disso não sobra perna nenhuma à vista, e o
 * `Math.max(0, ...)` existe pra esse caso: sem ele a barriga atravessaria a tábua e apareceria por
 * baixo do carro.
 */
const CORPO_ESCALA_Z = 1.0
const CORPO_ESCALA_Y = 1.0

/**
 * As pernas continuam sendo criadas de propósito, ainda que hoje não apareçam por baixo da saia:
 * são elas que seguram o bicho se `CORPO_ESCALA_Y` diminuir um dia. Sem elas, baixar aquele número
 * deixaria um cavalo boiando.
 */
const TRONCO: [number, number][] = PERFIL.map(([z, y]) => [
  z * CORPO_ESCALA_Z,
  Math.max(0, 1 - (1 - y) * CORPO_ESCALA_Y)
])

/**
 * O CARRINHO acompanha o bicho, em vez de ter comprimento próprio.
 *
 * Na foto ele mede 1.052 da altura total, e era esse o número aqui. Só que o tronco cresceu 45% no
 * comprimento (ver `CORPO_ESCALA`) e passou das duas pontas da tábua — o bicho ficava pendurado no
 * ar atrás e na frente do carro. Agora o carro é o maior entre a medida da foto e o próprio bicho
 * com uma folga de 0.3, então crescer o cavalo cresce o carro junto e essa classe de erro não volta.
 */
const COMPRIMENTO_DO_TRONCO =
  (Math.max(...TRONCO.map(([z]) => z)) - Math.min(...TRONCO.map(([z]) => z))) * ALTURA_BICHO
const PLATAFORMA_COMPRIMENTO = Math.max(ALTURA_TOTAL * 1.052, COMPRIMENTO_DO_TRONCO + 0.3)

/**
 * LARGURA ao longo do corpo, em fração da espessura máxima — a curva que transforma a tábua num
 * bicho.
 *
 * A foto é de perfil e não mede largura nenhuma; estes números são de anatomia, não de medição, e
 * está anotado de propósito: barril cheio no meio, garupa quase igual, e tudo o que é pescoço,
 * cabeça e cauda bem mais fino. É essa variação que separa "cavalo" de "recorte de madeira" — sem
 * ela, focinho e barriga têm a mesma grossura e o bicho lê como placa.
 */
const LARGURA_POR_Z: [number, number][] = [
  [-0.72, 0.3], // ponta da cauda
  [-0.62, 0.55],
  /**
   * GARUPA e BARRIL passam de 1, ou seja, ficam mais largos que a espessura de referência — pedido
   * do usuário ("eu quero q apenas o tronco seja mais largo").
   *
   * É esta curva que torna isso possível sem engordar o resto: ela é aplicada vértice a vértice pelo
   * Z, então inchar aqui não encosta em pescoço, cabeça nem cauda, que continuam com os números que
   * já tinham. Aumentar `ESPESSURA_CORPO` faria o contrário — engordaria tudo junto, inclusive o
   * focinho.
   */
  [-0.45, 1.15], // garupa
  [-0.1, 1.32], // barril
  [0.2, 1.0], // cernelha
  [0.35, 0.62], // pescoço — o mais fino do bicho, como em cavalo
  [0.5, 0.68], // ganacha: a cabeça ALARGA de volta depois do pescoço
  [0.62, 0.72], // crânio, a parte mais cheia da cabeça
  [0.68, 0.58],
  [0.72, 0.44] // focinho, que afina de novo
]

/** Interpola a curva de largura. Fora das pontas, segura no valor da ponta. */
function larguraEm(z: number): number {
  const primeiro = LARGURA_POR_Z[0]
  const ultimo = LARGURA_POR_Z[LARGURA_POR_Z.length - 1]
  if (z <= primeiro[0]) return primeiro[1]
  if (z >= ultimo[0]) return ultimo[1]
  for (let i = 1; i < LARGURA_POR_Z.length; i++) {
    const [z1, w1] = LARGURA_POR_Z[i - 1]
    const [z2, w2] = LARGURA_POR_Z[i]
    if (z <= z2) return w1 + ((w2 - w1) * (z - z1)) / (z2 - z1)
  }
  return ultimo[1]
}

/** Da unidade do perfil (altura do bicho = 1) pras unidades da cena. */
function emCena(contorno: [number, number][]): [number, number][] {
  return contorno.map(([z, y]) => [z * ALTURA_BICHO, y * ALTURA_BICHO])
}

/**
 * Cores JÁ DESCONTANDO a luz da cena (ambiente 0.55 + direcional 1.3 + `environment`), que
 * multiplica a cor por ~2.7 e satura perto do teto — a lição medida na pelúcia do Riebeck, onde
 * tirar 20% de uma cor clara não movia o pixel renderizado.
 *
 * Família quente, a da bandeja e do estojo, e não o cinza lavado de `troia.jpg`: a torre de castelo
 * ao lado é pedra cinza, e um cavalo cinza encostado nela viraria uma mancha só com ela.
 */
const COLORS = {
  /**
   * O MARROM CLARO, e ele agora vale pro bicho inteiro — corpo, pernas e carrinho — a pedido do
   * usuário ("deixa algo da mesma cor a cor marrom clara antiga").
   *
   * O corpo era este tom, o carrinho era 0x55401f e as peças pequenas 0x624527: três madeiras
   * diferentes, que é o que se faz quando as peças precisam se separar à vista. Com o corpo cobrindo
   * as pernas, o que sobra são duas peças grandes, e aí a diferença de tom lia como remendo em vez
   * de marcenaria.
   */
  madeira: 0x7d5a33,
  /** Mantidas como o MESMO tom por enquanto — ver o comentário acima. */
  madeiraEscura: 0x7d5a33,
  carro: 0x7d5a33,
  /** Olho: furo escuro, não bolinha — ver `criarOlho`. */
  olho: 0x241a10,
  /**
   * Tingimento do corpo QUANDO a foto está aplicada. Não é branco: a luz da cena multiplica a cor
   * por ~2.7 e satura perto do teto (a mesma medição da pelúcia do Riebeck), então uma foto em
   * branco puro sairia estourada, sem o desenho da madeira. Escurecer o tingimento é o que traz o
   * pixel de volta pra faixa em que a imagem ainda tem contraste.
   */
  fotoTingimento: 0x6f6f6f
}

/** Nomes das peças que o teste procura no grupo pronto. */
export const PART_NAMES = {
  plataforma: 'plataforma',
  roda: 'roda',
  perna: 'perna',
  corpo: 'corpo',
  olho: 'olho'
} as const

/**
 * Tamanho do bicho pronto, pra quem posiciona não precisar medir de novo — e pra versão TORRE saber
 * onde a boca pode ficar sem sondar a cena.
 */
export const TROJAN_HORSE_SIZE = {
  altura: ALTURA_TOTAL,
  comprimento: PLATAFORMA_COMPRIMENTO,
  largura: PLATAFORMA_LARGURA,
  /** Altura do tampo da plataforma: é dali que o corpo começa. */
  tampoY: TAMPO_Y
} as const

interface Materiais {
  /** Só do CORPO: é o único que recebe a foto, e por isso não pode ser o mesmo das outras peças. */
  corpo: THREE.MeshStandardMaterial
  madeira: THREE.MeshStandardMaterial
  madeiraEscura: THREE.MeshStandardMaterial
  carro: THREE.MeshStandardMaterial
  olho: THREE.MeshStandardMaterial
}

/**
 * As texturas de madeira são as MESMAS da bandeja e do estojo (`createWoodTexture.ts`), com
 * `repeat` alto: as peças aqui têm 1 ou 2 unidades, e no `repeat` da bandeja um tile só cobriria a
 * tábua inteira — o veio viraria mancha lisa em vez de fibra.
 */
function criarMateriais(): Materiais {
  function madeira(cor: number, repeticao: number): THREE.MeshStandardMaterial {
    const textura = createWoodTextures(repeticao, repeticao)
    return new THREE.MeshStandardMaterial({
      color: cor,
      map: textura.map,
      normalMap: textura.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.85,
      metalness: 0
    })
  }
  /**
   * O material do CORPO nasce igual ao da madeira e recebe a foto quando ela carregar — carregamento
   * é assíncrono, e não vale a pena segurar a montagem da cena por causa de um enfeite: sem a
   * imagem, ou antes dela chegar, o bicho aparece na madeira lisa e troca sozinho depois.
   *
   * `color` vai pra branco junto com a foto, e isso é obrigatório: o `color` MULTIPLICA o `map`, e
   * o marrom escuro da madeira apagaria a imagem inteira. Sem textura, ele fica no marrom de sempre.
   */
  const corpo = madeira(COLORS.madeira, 3)
  if (USAR_FOTO_COMO_TEXTURA && FOTO_DO_CAVALO) aplicarFotoDeReferencia(corpo, FOTO_DO_CAVALO)

  return {
    corpo,
    madeira: madeira(COLORS.madeira, 3),
    madeiraEscura: madeira(COLORS.madeiraEscura, 3),
    carro: madeira(COLORS.carro, 2),
    olho: new THREE.MeshStandardMaterial({ color: COLORS.olho, roughness: 1, metalness: 0 })
  }
}

/**
 * Põe a foto de referência num material, TROCANDO O FUNDO DO ESTÚDIO POR MADEIRA antes de usar.
 *
 * A limpeza do fundo é o miolo daqui, e ela existe por um defeito visto renderizado: a silhueta do
 * modelo não é idêntica à da foto — o bisel engorda o contorno e o corpo cresceu um pouco —, então a
 * borda do bicho amostra pixel de FORA do cavalo na imagem, que é o cinza claro do estúdio. O
 * resultado era uma auréola cinza em volta do lombo, da garupa e da cabeça.
 *
 * Apertar a UV pra dentro reduzia a auréola e distorcia a imagem, sem eliminar: em alguns trechos a
 * diferença de contorno passa de 10%. Pintar o fundo de madeira resolve na origem — a borda continua
 * amostrando "fora do cavalo", só que agora fora do cavalo também é madeira.
 *
 * O teste de fundo é o MESMO da medição que gerou o perfil (saturação baixa = estúdio, saturação
 * alta = madeira), o que mantém as duas coisas coerentes: o que a medição considerou "bicho" é
 * exatamente o que sobrevive aqui.
 */
export function aplicarFotoDeReferencia(
  material: THREE.MeshStandardMaterial,
  url: string
): void {
  const imagem = new Image()
  imagem.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = imagem.width
    canvas.height = imagem.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(imagem, 0, 0)

    const quadro = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const px = quadro.data
    const fundo = new THREE.Color(COLORS.madeira)
    const fr = Math.round(fundo.r * 255)
    const fg = Math.round(fundo.g * 255)
    const fb = Math.round(fundo.b * 255)
    for (let i = 0; i < px.length; i += 4) {
      const max = Math.max(px[i], px[i + 1], px[i + 2])
      const min = Math.min(px[i], px[i + 1], px[i + 2])
      const luz = (max + min) / 2
      const saturacao = max === min ? 0 : (max - min) / (max + min > 255 ? 510 - max - min : max + min)
      if (saturacao > 0.14 && luz < 235) continue
      px[i] = fr
      px[i + 1] = fg
      px[i + 2] = fb
    }
    ctx.putImageData(quadro, 0, 0)

    const textura = new THREE.CanvasTexture(canvas)
    textura.colorSpace = THREE.SRGBColorSpace
    // A foto JÁ traz veio e sombra pintados; o normal map da madeira por cima vira ruído.
    material.normalMap = null
    material.map = textura
    material.color.set(COLORS.fotoTingimento)
    material.needsUpdate = true
  }
  imagem.src = url
}

function peca(
  geometria: THREE.BufferGeometry,
  material: THREE.Material,
  nome: string,
  posicao: [number, number, number] = [0, 0, 0]
): THREE.Mesh {
  const malha = new THREE.Mesh(geometria, material)
  malha.name = nome
  malha.position.set(...posicao)
  malha.castShadow = true
  malha.receiveShadow = true
  return malha
}

/**
 * Recorta um contorno em tábua de `espessura`, deitado no plano YZ (o perfil foi desenhado de lado)
 * e centrado em X.
 *
 * O BISEL é o que faz a peça ler como madeira cortada e lixada em vez de recorte de papel: ele
 * arredonda o canto vivo do corte, que é onde a luz pega. Sem ele a silhueta fica chapada de
 * qualquer ângulo que não seja o perfil exato.
 */
function recortar(
  contorno: [number, number][],
  espessura: number,
  deslocamentoY: number,
  biselPedido?: number
): THREE.ExtrudeGeometry {
  const forma = new THREE.Shape()
  forma.moveTo(contorno[0][0], contorno[0][1] + deslocamentoY)
  for (const [z, y] of contorno.slice(1)) forma.lineTo(z, y + deslocamentoY)
  forma.closePath()

  const bisel = biselPedido ?? Math.min(0.07, espessura * 0.22)
  const geometria = new THREE.ExtrudeGeometry(forma, {
    depth: espessura - bisel * 2,
    bevelEnabled: true,
    bevelThickness: bisel,
    bevelSize: bisel,
    // Mais segmentos quando o bisel é grande: com 2, um bisel de 0.4 vira dois chanfros retos e o
    // corpo fica com cara de caixa lapidada em vez de abaulado.
    bevelSegments: bisel > 0.15 ? 6 : 2,
    curveSegments: 1
  })
  /**
   * `ExtrudeGeometry` empurra pro +Z do próprio espaço, então a tábua nasce deitada: as duas linhas
   * põem ela em pé no plano YZ, que é onde o perfil foi desenhado.
   *
   * O sinal do giro importa e custou uma renderização: `rotateY(+90°)` leva `(x, y, z)` pra
   * `(z, y, -x)`, ou seja ESPELHA o perfil — o bicho nascia olhando pro -Z enquanto o olho e as
   * cordas, posicionados em +Z, ficavam boiando no ar do lado de trás. Com -90° o `x` da forma (que
   * é o meu z) cai no +z do mundo, e tudo assenta no mesmo lugar.
   */
  geometria.rotateY(-Math.PI / 2)
  geometria.translate(espessura / 2 - bisel, 0, 0)
  return geometria
}

/**
 * A FOTO DE REFERÊNCIA como textura do corpo — escolha do usuário depois de sete versões em que o
 * acabamento não chegava lá.
 *
 * O encaixe é exato, e não por sorte: a silhueta do modelo FOI MEDIDA nesta mesma foto (ver
 * `PERFIL`), então projetá-la de lado põe cada ripa, cada sombra e cada junta em cima do desenho que
 * já saiu dela. É o que nenhuma quantidade de geometria em primitiva ia dar.
 *
 * `import.meta.glob` em vez de `import` direto, e este é o ponto principal do bloco: a imagem é um
 * render de banco de modelo, arquivo de TERCEIRO, e por isso mora numa pasta ignorada pelo git (ver
 * `.gitignore`). Com `import` estático, quem clonasse o repositório não conseguiria nem COMPILAR —
 * o Vite resolve asset em tempo de build e quebraria no arquivo que não veio junto. Com `glob`, a
 * lista vem vazia, `url` fica `undefined` e o cavalo cai na madeira lisa: feio pra quem clona, e
 * publicável.
 */
/**
 * A FOTO como textura ficou DESLIGADA a pedido do usuário: ele viu, e preferiu de volta o marrom
 * claro chapado ("deixa algo da mesma cor a cor marrom clara antiga").
 *
 * O caminho todo fica de pé atrás deste interruptor porque ele não é código morto por acaso — é a
 * única forma que existe aqui de o bicho ter madeira de verdade, e a decisão de não usar é de gosto,
 * não técnica. Lembrando que, ligada, ela também não poderia ser publicada: a imagem é de terceiro
 * (ver `.gitignore`).
 */
const USAR_FOTO_COMO_TEXTURA = false

const FOTOS_LOCAIS: Record<string, string> = (() => {
  try {
    return import.meta.glob('../../assets/local/cavalo-troia.ts', {
      eager: true,
      import: 'default'
    }) as Record<string, string>
  } catch {
    /**
     * `import.meta.glob` é do Vite. O harness de conferência empacota este arquivo com ESBUILD, que
     * não conhece a função e deixa a chamada de pé — em `iife`, `import.meta` vira `{}` e a chamada
     * estoura. Sem este `catch`, conferir o cavalo isolado quebraria por causa de uma textura que a
     * conferência nem usa.
     */
    return {}
  }
})()
const FOTO_DO_CAVALO: string | undefined = Object.values(FOTOS_LOCAIS)[0]

/**
 * Como desfazer a medição na hora de mapear a UV: `u = A + B·z` e `v = V0 + B·y`, com z e y nas
 * unidades do perfil (altura do bicho = 1).
 *
 * Os três números saem da mesma varredura que produziu o contorno: a foto é 1200×1200, o bicho vai
 * do pixel 122 (alto da orelha) ao 750 (o corte logo acima do carrinho), e o fator é o MESMO nos
 * dois eixos porque os dois foram normalizados pela mesma altura. O sinal negativo em B é o
 * espelhamento — na foto a cabeça está à esquerda, no modelo ela olha pro +Z.
 */
const FOTO_UV = { A: 0.45713, B: -0.52333, V0: 0.375 } as const

/**
 * Aperto da UV em direção ao centro do bicho, e ele existe por uma razão medida.
 *
 * A silhueta do MODELO é um tico maior que a do bicho na foto: o bisel do `ExtrudeGeometry` engorda
 * o contorno 0.34 pra fora e o corpo ainda cresceu 5% pra baixo. Com a UV crua, essa sobra de borda
 * cai FORA do cavalo na imagem e amostra o fundo cinza do estúdio — o bicho ganhava uma auréola
 * cinza em volta do lombo, da garupa e da cabeça, visível na primeira renderização com textura.
 *
 * Encolhendo 7% em torno do centro, a borda do modelo passa a amostrar pixel de DENTRO do cavalo.
 * A imagem fica 7% comprimida, o que a esse tamanho ninguém enxerga; a auréola, todo mundo enxergava.
 */
const FOTO_APERTO = 0.98
const FOTO_CENTRO_U = FOTO_UV.A
const FOTO_CENTRO_V = FOTO_UV.V0 - FOTO_UV.B * 0.5

/**
 * O CORPO: um volume arredondado, não mais uma tábua.
 *
 * Duas coisas fazem o volume, e as duas são baratas:
 *
 * 1. BISEL GRANDE na extrusão. O bisel do `ExtrudeGeometry` deixa o meio da peça na largura cheia e
 *    encolhe o contorno em direção às duas faces — o que é, na prática, um corpo abaulado: de lado a
 *    silhueta continua sendo exatamente a medida na foto, e de frente ele deixou de ser uma placa
 *    com quina viva. Foi a quina viva que fez as três primeiras versões lerem como recorte.
 * 2. AFINAMENTO POR Z, aplicado vértice a vértice depois de extrudar (ver `LARGURA_POR_Z`): o
 *    barril fica cheio, pescoço, cabeça e cauda ficam finos. Sem isto o focinho tem a grossura da
 *    barriga, e nenhum bisel salva isso.
 *
 * As duas juntas custam uma extrusão e um laço sobre os vértices — nada de malha nova, nada de
 * biblioteca. E o contorno continua sendo o medido na foto: o que mudou é a terceira dimensão, que
 * a foto não tinha como dar.
 */
function criarCorpo(materiais: Materiais, grupo: THREE.Group): void {
  const geometria = recortar(emCena(TRONCO), ESPESSURA_CORPO, TAMPO_Y, BISEL_CORPO)

  const posicoes = geometria.attributes.position
  for (let i = 0; i < posicoes.count; i++) {
    const z = posicoes.getZ(i) / ALTURA_BICHO
    posicoes.setX(i, posicoes.getX(i) * larguraEm(z))
  }
  posicoes.needsUpdate = true
  // A luz precisa saber que a superfície mudou de inclinação, senão o afinamento não sombreia.
  geometria.computeVertexNormals()

  /**
   * UV por PROJEÇÃO LATERAL: cada vértice recebe a coordenada do pixel da foto que está atrás dele,
   * olhando de lado. Não é desenrolar a malha — é encostar a foto no bicho e deixar ela escorrer
   * pelo costado, que é exatamente o que faz o desenho bater com a silhueta.
   *
   * O `y` é DESESTICADO antes de virar UV (`1 - (1 - y) / CORPO_ESCALA_Y`): o corpo cresceu pra
   * baixo em cima do contorno medido, e sem desfazer isso a imagem esticaria junto — a barriga da
   * foto apareceria alongada e a linha do dorso sairia do lugar.
   */
  const uvs = new Float32Array(posicoes.count * 2)
  for (let i = 0; i < posicoes.count; i++) {
    const z = posicoes.getZ(i) / (ALTURA_BICHO * CORPO_ESCALA_Z)
    const yEsticado = (posicoes.getY(i) - TAMPO_Y) / ALTURA_BICHO
    const y = 1 - (1 - yEsticado) / CORPO_ESCALA_Y
    const u = FOTO_UV.A + FOTO_UV.B * z
    const v = FOTO_UV.V0 + -FOTO_UV.B * y
    uvs[i * 2] = FOTO_CENTRO_U + (u - FOTO_CENTRO_U) * FOTO_APERTO
    uvs[i * 2 + 1] = FOTO_CENTRO_V + (v - FOTO_CENTRO_V) * FOTO_APERTO
  }
  geometria.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

  grupo.add(peca(geometria, materiais.corpo, PART_NAMES.corpo))
}

/**
 * O SEGUNDO PAR DE PERNAS, pregado por fora dos dois flancos.
 *
 * A tábua do corpo já traz um par (o corte entre dianteira e traseira faz parte do contorno). Um
 * cavalo com dois pés só lê como recorte de papel de qualquer ângulo que não seja o perfil exato —
 * este par resolve isso pelo mesmo meio que o brinquedo de verdade: mais tábua, pregada por cima.
 *
 * As pernas de fora ficam ADIANTADAS (dianteira) e ATRASADAS (traseira) em relação às de dentro. É
 * o passo do cavalo, e é também o que separa as duas de cada lado quando se olha de frente: coladas
 * na mesma posição elas viravam uma perna grossa só.
 */
function criarPernasDeFora(materiais: Materiais, grupo: THREE.Group): void {
  /**
   * O SEGUNDO PAR, pregado nos dois flancos, recortado com o MESMO contorno das pernas do tronco.
   *
   * De perfil o recorte já entrega duas pernas; de frente, sem este par, o bicho teria duas pernas
   * só e leria como recorte de papel. Elas são tábua, e não cilindro, pelo mesmo motivo de o tronco
   * ser tábua: peça de outro feitio, colada ao lado, é exatamente o que denuncia montagem.
   *
   * Ficam ADIANTADAS e ATRASADAS em relação às de dentro — é o passo do cavalo, e é o que separa as
   * duas de cada lado quando se olha de frente.
   */
  for (const lado of [-1, 1]) {
    for (const [contorno, avanco] of [
      [emCena(PERNA_DIANTEIRA), 0.14],
      [emCena(PERNA_TRASEIRA), -0.14]
    ] as [[number, number][], number][]) {
      const deslocada = contorno.map(([z, y]) => [z + avanco, y] as [number, number])
      grupo.add(
        peca(
          recortar(deslocada, ESPESSURA_PERNA, TAMPO_Y, 0.05),
          materiais.madeira,
          PART_NAMES.perna,
          [lado * (ESPESSURA_CORPO * 0.5 - ESPESSURA_PERNA * 0.35), 0, 0]
        )
      )
    }
  }
}

/**
 * O OLHO é um FURO, não uma bolinha: um cilindro escuro afundado na tábua.
 *
 * Bolinha 3D de olho vira borrão cinza no tamanho em que o bicho aparece (a mesma lição que fez o
 * rosto do Riebeck virar textura), e um furo é o que um brinquedo de madeira teria de verdade — o
 * mesmo furo por onde passa o eixo da roda.
 */
function criarOlho(materiais: Materiais, grupo: THREE.Group): void {
  /**
   * DOIS olhos, um em cada face da cabeça, e SALIENTES em vez de furados — pedido do usuário
   * ("coloca olhos tb").
   *
   * Antes era um furo só, atravessando de lado a lado. Ele funcionava quando a cabeça era uma tábua
   * fina, mas ela ganhou volume (ver `LARGURA_POR_Z`) e o furo passou a morrer lá dentro: de fora
   * não se via olho nenhum. Uma meia-esfera pousada em cada bochecha resolve os dois problemas — ela
   * aparece de qualquer ângulo e não depende da espessura da cabeça.
   *
   * A posição sai do PERFIL, não de números soltos: a cabeça vai de z 0.45 a 0.72 e do alto (0.99)
   * ao queixo (0.57), então o olho fica a 62% do comprimento e 86% da altura — alto e adiante, como
   * em cavalo. O X é a meia-largura LOCAL da cabeça, pra ele pousar na superfície e não flutuar.
   */
  const z = 0.6 * ALTURA_BICHO
  const y = TAMPO_Y + 0.86 * ALTURA_BICHO
  const meiaLargura = (ESPESSURA_CORPO * larguraEm(0.6)) / 2

  const olho = new THREE.SphereGeometry(0.075, 10, 8)
  for (const lado of [-1, 1]) {
    // Afundado 30% do próprio raio: pousado por cima ele vira bolinha colada, afundado vira olho.
    grupo.add(peca(olho, materiais.olho, PART_NAMES.olho, [lado * (meiaLargura - 0.02), y, z]))
  }
}

/**
 * As AMARRAÇÕES de corda de `troia.jpg` foram MODELADAS E REMOVIDAS.
 *
 * Dois aros abraçando a tábua, na barriga e no pescoço. Renderizados, eles não leem como corda: no
 * tamanho em que o bicho aparece são dois riscos amarelos de 5px atravessando a madeira, e de
 * três-quartos parecem defeito. Corda funciona na foto porque lá ela tem volta, sombra e fio; aqui
 * ela só tem largura.
 *
 * Fica registrado pra não voltar por engano: o partido de brinquedo recortado não pede amarração,
 * porque brinquedo recortado não é feito de gravetos amarrados.
 */

/**
 * PLATAFORMA COM RODAS — o que carimba "de Troia" no bicho, e o pedestal que a versão torre vai
 * herdar: o tampo já está acima da parede da bandeja, que é a condição pro dado sair sem bater na
 * borda por fora.
 */
function criarPlataforma(materiais: Materiais, grupo: THREE.Group): void {
  const tabuas = 7
  const espessura = 0.16

  /** Tampo em tábuas separadas, e não uma caixa só: a junta entre elas é visível de cima. */
  const deck = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PLATAFORMA_LARGURA, espessura, PLATAFORMA_COMPRIMENTO / tabuas - 0.03),
    materiais.carro,
    tabuas
  )
  deck.name = PART_NAMES.plataforma
  deck.castShadow = true
  deck.receiveShadow = true
  const matriz = new THREE.Matrix4()
  for (let i = 0; i < tabuas; i++) {
    const z = -PLATAFORMA_COMPRIMENTO / 2 + ((i + 0.5) * PLATAFORMA_COMPRIMENTO) / tabuas
    matriz.makeTranslation(0, TAMPO_Y - espessura / 2, z)
    deck.setMatrixAt(i, matriz)
  }
  grupo.add(deck)

  // Longarinas laterais, que dão altura ao carro e escondem os eixos.
  for (const lado of [-1, 1]) {
    grupo.add(
      peca(
        new THREE.BoxGeometry(0.12, 0.3, PLATAFORMA_COMPRIMENTO * 0.94),
        materiais.carro,
        PART_NAMES.plataforma,
        [(lado * PLATAFORMA_LARGURA) / 2 - lado * 0.06, TAMPO_Y - espessura - 0.13, 0]
      )
    )
  }

  /** Quatro rodas de disco maciço com cubo saliente — roda de raios seria detalhe de 3px. */
  const disco = new THREE.CylinderGeometry(RAIO_RODA, RAIO_RODA, 0.14, 16)
  disco.rotateZ(Math.PI / 2)
  const cubo = new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8)
  cubo.rotateZ(Math.PI / 2)
  for (const lado of [-1, 1]) {
    for (const frente of [-1, 1]) {
      const x = (lado * PLATAFORMA_LARGURA) / 2 + lado * 0.04
      const z = frente * (PLATAFORMA_COMPRIMENTO / 2 - RAIO_RODA - 0.12)
      grupo.add(peca(disco, materiais.carro, PART_NAMES.roda, [x, RAIO_RODA, z]))
      grupo.add(peca(cubo, materiais.madeiraEscura, PART_NAMES.roda, [x + lado * 0.06, RAIO_RODA, z]))
    }
  }
}

/**
 * Devolve o cavalo com a origem no CHÃO (y=0, embaixo das rodas) e olhando pro seu +Z local — mesma
 * convenção da pelúcia, pra quem posiciona só precisar da altura da superfície e de um giro em Y.
 */
export function createTrojanHorse(): THREE.Group {
  const grupo = new THREE.Group()
  grupo.name = 'cavalo-de-troia'
  const materiais = criarMateriais()

  criarPlataforma(materiais, grupo)

  /**
   * O BICHO vive num subgrupo próprio, deslocado em Z pra ficar centrado na plataforma — pedido do
   * usuário ("deixa o cavalo no meio da plataforma").
   *
   * Ele não nascia centrado, e a razão é a foto: o contorno medido é simétrico em torno do meio do
   * CORPO, mas os pés dele não são — a dianteira cai em +0.13 e a traseira em -0.54 (unidades da
   * altura do bicho), porque o pescoço e a cabeça avançam muito à frente do peito. O ponto médio dos
   * pés fica 0.20 atrás do meio do corpo, e era isso que fazia ele pisar na traseira do carrinho.
   *
   * Deslocar pelo MEIO DOS PÉS, e não pelo meio do corpo, é o que centra o que se apoia: quem olha
   * vê os quatro cascos igualmente distantes das duas pontas do carro.
   */
  const centroDosPes =
    ((PERNA_DIANTEIRA[0][0] + PERNA_DIANTEIRA[PERNA_DIANTEIRA.length - 1][0]) / 2 +
      (PERNA_TRASEIRA[0][0] + PERNA_TRASEIRA[PERNA_TRASEIRA.length - 1][0]) / 2) /
    2

  const bicho = new THREE.Group()
  bicho.name = 'bicho'
  criarCorpo(materiais, bicho)
  /**
   * NÃO existe mais peça de perna: as duas de perto saem do próprio recorte do tronco (ver `PERFIL`
   * e `BISEL_CORPO`), que é o que faz elas serem o mesmo pedaço de madeira que o corpo.
   *
   * O par de FORA continua sendo pregado por cima, porque de frente um recorte só teria duas pernas.
   */
  criarPernasDeFora(materiais, bicho)
  criarOlho(materiais, bicho)
  bicho.position.z = -centroDosPes * ALTURA_BICHO
  grupo.add(bicho)

  return grupo
}
