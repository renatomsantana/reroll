import { beforeAll, describe, expect, it } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicalDiceSides } from '@shared/types/dice3d'
import { ensureRapierReady } from './rapierContext'
import { createPhysicsWorld } from './createPhysicsWorld'
import { createBoundaryColliders } from './createBoundaryColliders'
import { createSettleTracker, type SettleTracker } from './createSettleTracker'
import { applyNudge } from './applyNudge'
import { tossDie } from './tossDie'
import { tossDieFromMouth, MOUTH_RELEASE_INTERVAL_MS } from './tossDieFromMouth'
import {
  diceEnteringCollisionGroups,
  parkedCollisionGroups,
  restoreWallCollisionIfInside
} from './collisionGroups'
import { clampLinearVelocity } from './clampVelocity'
import { computeSpawnSlots } from './computeSpawnSlots'
import { readTopFace } from '../faceReading/readTopFace'
import {
  MAX_SIMULTANEOUS_DICE,
  SPAWN_CONFIG,
  TRAY_CONFIG,
  WORLD_CONFIG,
  resolveAmbiguousMargin
} from '../config/physicsConfig'
import { DICE_REGISTRY, AVAILABLE_DICE_TYPES } from '../dice-defs/registry'

/**
 * O RESULTADO continua honesto com a BANDEJA CHEIA?
 *
 * `d6.statistical.test.ts` mede viés de UM dado sozinho numa bandeja vazia — ali o que está sob
 * julgamento é a geometria do dado. Aqui a pergunta é outra, e é a que interessa a quem joga: com
 * vinte dados caindo juntos, metade deles assenta APOIADA em outro dado, encostada na parede ou
 * empilhada numa quina. Repouso apoiado é o candidato natural a viés — se uma face for mais
 * "estável" nesse tipo de apoio, ela sai mais vezes, e nenhum teste de dado solto veria isso.
 *
 * Os dois lançamentos entram, porque partem de situações opostas: pela bandeja os vinte caem ao
 * mesmo tempo de ângulos diferentes; pela boca da torre saem em fila, todos do MESMO ponto e na
 * MESMA direção. Se algum dos dois enviesa, é o da boca — e era exatamente o que precisava ser
 * medido, não suposto.
 *
 * ALEATORIEDADE INTACTA: nada semeado, nada preso. É uma amostra de física real, com a variância
 * que ela tem — por isso o corte é frouxo de propósito (ver `CRITICO`).
 */

/**
 * O CORTE do qui-quadrado: seis desvios-padrão acima da média DA PRÓPRIA distribuição qui-quadrado
 * (média = graus de liberdade, variância = 2 × graus). Sem tabela de alpha, e por um motivo medido.
 *
 * A primeira versão usava a tabela de alpha = 0,001 (16,3 pro d4, 148,2 pro d100), o mesmo corte do
 * teste de d6 sozinho que já existia. Com quatorze casos por rodada, isso dá 1,4% de chance de um
 * vermelho por rodada mesmo com todo dado honesto — e foi o que apareceu: o d4 falhou em uma de
 * quatro rodadas.
 *
 * Antes de afrouxar o corte, medi o d4, que é o que separa "corte apertado" de "dado torto de
 * verdade": 6 mil amostras deram qui 9,5; TRINTA mil deram qui 10,1. Viés fixo faz o qui-quadrado
 * crescer proporcional à amostra — de 9,5 com 6 mil, trinta mil dariam uns 47. Ele não cresceu, e a
 * face "favorecida" mudou de uma medição pra outra. Ou seja: o dado é honesto e o corte é que estava
 * curto. (O d4 sozinho, 6 mil rolagens: qui 1,1.)
 *
 * Seis sigmas deixam o falso vermelho em uma parte por milhão por caso, e continuam pegando com
 * folga o que este teste existe pra pegar: o d100 antigo dava 590 contra um corte de 183.
 */
function corteDoQuiQuadrado(graus: number): number {
  return graus + 6 * Math.sqrt(2 * graus)
}

/**
 * Rolagens de vinte dados por caso. Trinta dão 600 amostras, o que deixa ao menos 6 esperados por
 * face até no d100 (100 faces) — o mínimo pro qui-quadrado significar alguma coisa. Nos dados de
 * poucas faces sobra muito mais: 100 esperados por face no d6.
 */
const ROLAGENS = 30
const MAX_STEPS = 20000

type Lancamento = 'bandeja' | 'torre'

interface Dado {
  body: RAPIER.RigidBody
  tracker: SettleTracker
  slot: { x: number; z: number }
  passoDeLargada: number
  liberado: boolean
  assentado: boolean
  entrandoMs: number
  valor: number | null
}

/**
 * Uma rolagem completa dos vinte, devolvendo a FACE LIDA de cada um — o mesmo laço da produção,
 * inclusive a releitura de face ambígua com cutucada, que é parte de como o valor nasce.
 */
function rolarELer(world: RAPIER.World, dados: Dado[], sides: PhysicalDiceSides, lancamento: Lancamento): number[] {
  const definicao = DICE_REGISTRY[sides].definition
  const raio = definicao.scale * definicao.boundingRadius
  const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
  let assentados = 0

  for (const [indice, dado] of dados.entries()) {
    dado.assentado = false
    dado.liberado = false
    dado.entrandoMs = 0
    dado.valor = null
    if (lancamento === 'torre') {
      if (dado.body.numColliders() > 0) dado.body.collider(0).setCollisionGroups(parkedCollisionGroups())
      dado.body.setTranslation({ x: indice * 2, y: -40, z: 0 }, true)
      dado.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      dado.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
  }

  for (let passo = 0; passo < MAX_STEPS && assentados < dados.length; passo++) {
    for (const dado of dados) {
      const largada = lancamento === 'torre' ? dado.passoDeLargada : 0
      if (dado.liberado || passo < largada) continue
      if (lancamento === 'torre') tossDieFromMouth(dado.body, { target: dado.slot, radius: raio })
      else tossDie(dado.body, { target: dado.slot })
      dado.tracker.reset()
      dado.liberado = true
    }

    world.step()

    for (const dado of dados) {
      if (!dado.liberado || dado.assentado) continue
      clampLinearVelocity(dado.body, WORLD_CONFIG.maxLinearSpeed)
      const entrando =
        dado.body.numColliders() > 0 &&
        dado.body.collider(0).collisionGroups() === diceEnteringCollisionGroups()
      if (entrando) dado.entrandoMs += dtMs
      restoreWallCollisionIfInside(dado.body, dado.entrandoMs)
      if (!entrando) dado.entrandoMs = 0

      const estado = dado.tracker.update(dado.body, dtMs)
      if (estado === 'settled') {
        const leitura = readTopFace(definicao, dado.body.rotation(), resolveAmbiguousMargin(definicao))
        if (leitura.isAmbiguous) {
          applyNudge(dado.body)
          dado.tracker.reset()
        } else {
          dado.assentado = true
          dado.valor = leitura.value
          assentados++
        }
      } else if (estado === 'stuck') {
        applyNudge(dado.body)
        dado.tracker.reset()
      }
    }
  }

  // Se algum não assentou, o caso não vira amostra silenciosamente: a contenção é assunto de
  // `matrizDeRolagens.test.ts`, e uma amostra incompleta aqui esconderia o problema de lá.
  expect(assentados, `só ${assentados} de ${dados.length} assentaram — amostra incompleta`).toBe(dados.length)
  return dados.map((dado) => dado.valor as number)
}

describe(`distribuição com a bandeja cheia (${MAX_SIMULTANEOUS_DICE} dados, ${ROLAGENS} rolagens)`, () => {
  beforeAll(async () => {
    await ensureRapierReady()
  })

  const combinacoes = (['bandeja', 'torre'] as const).flatMap((lancamento) =>
    AVAILABLE_DICE_TYPES.map((sides) => [lancamento, sides] as const)
  )

  it.each(combinacoes)(
    'pela %s — o d%i não mostra viés grosseiro',
    (lancamento: Lancamento, sides: PhysicalDiceSides) => {
      const world = createPhysicsWorld()
      createBoundaryColliders(world)
      const dtMs = (1 / WORLD_CONFIG.physicsStepsPerSecond) * 1000
      const passosEntreSaidas = Math.round(MOUTH_RELEASE_INTERVAL_MS / dtMs)
      const slots = computeSpawnSlots(MAX_SIMULTANEOUS_DICE, SPAWN_CONFIG.slotSafeHalfExtent)
      const dados: Dado[] = slots.map((slot, indice) => ({
        body: DICE_REGISTRY[sides].createBody(world),
        tracker: createSettleTracker(),
        slot,
        passoDeLargada: indice * passosEntreSaidas,
        liberado: false,
        assentado: false,
        entrandoMs: 0,
        valor: null
      }))

      const contagem = new Map<number, number>()
      const valores = DICE_REGISTRY[sides].definition.faces.map((face) => face.value)
      for (const valor of valores) contagem.set(valor, 0)

      let total = 0
      for (let rolagem = 0; rolagem < ROLAGENS; rolagem++) {
        for (const lido of rolarELer(world, dados, sides, lancamento)) {
          expect(contagem.has(lido), `leu face ${lido}, que não existe no d${sides}`).toBe(true)
          contagem.set(lido, (contagem.get(lido) as number) + 1)
          total++
        }
      }

      const esperado = total / contagem.size
      let qui = 0
      for (const observado of contagem.values()) qui += ((observado - esperado) ** 2) / esperado
      const graus = contagem.size - 1
      const critico = corteDoQuiQuadrado(graus)

      const extremos = [...contagem.entries()].sort((a, b) => b[1] - a[1])
      const resumo =
        `d${sides} pela ${lancamento}: ${total} amostras, esperado ${esperado.toFixed(1)} por face, ` +
        `qui-quadrado ${qui.toFixed(1)} contra ${critico.toFixed(1)} — ` +
        `mais saiu: ${extremos[0][0]} (${extremos[0][1]}x), menos saiu: ${extremos[extremos.length - 1][0]} (${extremos[extremos.length - 1][1]}x)`
      expect(qui, resumo).toBeLessThan(critico)

      // Nenhum dado ficou empoleirado acima da parede na última rolagem — a leitura de face só vale
      // se o dado estiver deitado na bandeja, e não de canto sobre a borda.
      for (const dado of dados) {
        expect(dado.body.translation().y).toBeLessThan(TRAY_CONFIG.wallHeight + 1)
      }

      world.free()
    },
    180000
  )
})

/**
 * O D100 JÁ FOI ENVIESADO, e este bloco guarda a medição — é o histórico que explica por que a
 * geometria dele é do jeito que é (ver `d100Sphere.ts` e `antipodalDirections.ts`).
 *
 * ANTES (casco convexo de 52 pontos de Fibonacci com jitter — 3000 rolagens de física real):
 * qui-quadrado 2887 contra 148,2 de corte; TREZE das cem faces nunca saíram uma única vez; a face
 * mais comum saía 4,13%, quatro vezes o 1% esperado; 367 cutucadas por leitura ambígua.
 *
 * DEPOIS (50 pares antipodais relaxados, faces construídas pelas normais — mesma medição):
 * qui-quadrado 122, ZERO faces zeradas, 55 cutucadas, e o dado assentando em 530 passos em vez de
 * ficar rolando.
 *
 * O que consertou não foi igualar as áreas — foi a SIMETRIA. Com as áreas já ótimas (0,94x a 1,06x)
 * mas sem pares antipodais, só 92 das 100 faces eram alcançáveis pelo mapa "face de apoio → face
 * lida", e a física confirmava com 12 zeradas. O raciocínio inteiro está em `antipodalDirections.ts`.
 *
 * O d100 agora corre junto com os outros seis no bloco de cima. Este comentário fica porque a
 * próxima pessoa que mexer na geometria dele precisa saber o que já custou caro.
 */
