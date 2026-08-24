import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ATRIBUTO_DND, POOL, BONUS, campo, secao, pagina, preset, escreverEmDisco } from './quinzePerfis.mjs'

/**
 * A QUARTA LEVA — quinze personagens COMPLETOS, com FOTO.
 *
 * Cada leva testa um eixo. A primeira: isolamento no teto. A segunda: lacuna sobrevivendo ao disco.
 * A terceira: volume e sessões. Esta: a ficha PREENCHIDA INTEIRA — nenhum campo vazio, foto em todo
 * personagem, presets, sessões — que é o personagem no meio da campanha, com tudo em dia.
 *
 * A FOTO é o que as outras três não tinham, e é o que a revisão de segurança acabou de cercar: o
 * campo vai como data URL pra um `<img src>` e passa por `normalizeProfiles`, que agora só aceita
 * PNG, JPEG e WebP embutidos até 17 MB. As quinze fotos aqui vêm nos três formatos de propósito
 * (`avatares.json`, gerado com `sharp`: retângulo de cor com a inicial), pra provar que os três
 * atravessam a fronteira — e que aparecem no seletor de personagem em vez de "sem foto".
 *
 * `node scripts/quartaLeva.mjs <pasta>` escreve os quinze no formato do `userData`.
 */
const AVATARES = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'avatares.json'), 'utf-8'))

/** Uma ficha genérica completa — nenhum campo vazio — pros sistemas que não têm leitor próprio. */
function fichaCompleta(nome, sistema, papel, lugar, dados) {
  return {
    characterName: nome,
    sections: [
      secao('Identificação', [
        campo('Personagem', nome),
        campo('Sistema', sistema),
        campo('Papel', papel),
        campo('Origem', lugar),
        campo('Nível', String(dados.nivel)),
        campo('Experiência', String(dados.nivel * 300))
      ]),
      secao('Atributos', [
        campo('Corpo', String(dados.corpo)),
        campo('Mente', String(dados.mente)),
        campo('Reflexo', String(dados.reflexo)),
        campo('Vontade', String(dados.vontade)),
        campo('Presença', String(dados.presenca))
      ]),
      secao('Recursos', [
        campo('Vida atual', String(dados.vida - 3)),
        campo('Vida máxima', String(dados.vida)),
        campo('Energia atual', String(dados.energia - 1)),
        campo('Energia máxima', String(dados.energia)),
        campo('Defesa', String(10 + dados.reflexo)),
        campo('Deslocamento', '9m')
      ]),
      secao('Perícias', [
        campo(dados.pericias[0], '+5', BONUS),
        campo(dados.pericias[1], '+3', BONUS),
        campo(dados.pericias[2], '+2', BONUS),
        campo('Idiomas', 'comum e mais dois')
      ]),
      secao('Equipamento', [
        campo('Arma', dados.arma),
        campo('Proteção', dados.protecao),
        campo('Dinheiro', String(dados.nivel * 45) + ' moedas')
      ])
    ],
    abilities: `${dados.talento}: ${dados.talentoTexto}`,
    inventory: `${dados.arma}; ${dados.protecao}; corda de 15 m; lamparina; três rações; kit de reparo; ${dados.item}.`,
    appearance: dados.aparencia,
    backstory: dados.historia,
    pages: [
      pagina('p1', 2, `${lugar} — chegada`, `Chegamos a ${lugar} ao anoitecer. ${dados.talento} foi útil na primeira hora.`),
      pagina('p2', 4, 'O pedido', 'Alguém pagou adiantado por um serviço que ninguém explicou direito. Aceitamos.'),
      pagina('p3', 6, 'Complicação', `O ${dados.arma.toLowerCase()} resolveu metade do problema. A outra metade fugiu pelo telhado.`)
    ]
  }
}

const MOLDES = [
  { id: 'aurora-ordem', name: 'Aurora', system: 'Ordem Paranormal', papel: 'Ocultista', lugar: 'Curitiba' },
  { id: 'baltazar-dnd', name: 'Baltazar', system: 'D&D 5e', papel: 'Paladino 6', lugar: 'Porto Cinza' },
  { id: 'cecilia-cthulhu', name: 'Cecília', system: 'Call of Cthulhu', papel: 'Bibliotecária', lugar: 'Arkham' },
  { id: 'dimas-tormenta', name: 'Dimas', system: 'Tormenta20', papel: 'Ladino 4', lugar: 'Valkaria' },
  { id: 'esther-vampiro', name: 'Esther', system: 'Vampiro: A Máscara', papel: 'Tremere', lugar: 'Capela' },
  { id: 'florencio-kids', name: 'Florêncio', system: 'Kids on Bikes', papel: 'Cientista Mirim', lugar: 'Vale Verde' },
  { id: 'gaia-cyberpunk', name: 'Gaia', system: 'Cyberpunk RED', papel: 'Mídia', lugar: 'Westbrook' },
  { id: 'heitor-pathfinder', name: 'Heitor', system: 'Pathfinder 2e', papel: 'Campeão 5', lugar: 'Absalom' },
  { id: 'ivone-fate', name: 'Ivone', system: 'Fate Core', papel: 'Piloto de teste', lugar: 'Hangar 4' },
  { id: 'jonas-gurps', name: 'Jonas', system: 'GURPS', papel: 'Guia de montanha', lugar: 'Serra Alta' },
  { id: 'kali-3det', name: 'Kali', system: '3D&T Alpha', papel: 'Lutadora', lugar: 'Ginásio Central' },
  { id: 'lorenzo-starwars', name: 'Lorenzo', system: 'Star Wars FFG', papel: 'Piloto', lugar: 'Coruscant' },
  { id: 'maira-oblivio', name: 'Maíra', system: 'Oblivio', papel: 'Quem Sente', lugar: 'Beira-mar' },
  { id: 'nestor-ordem2', name: 'Nestor', system: 'Ordem Paranormal', papel: 'Combatente', lugar: 'Recife' },
  { id: 'odete-dnd2', name: 'Odete', system: 'D&D 5e', papel: 'Druida 3', lugar: 'Bosque Velho' }
]

const PERICIAS_POR_SISTEMA = {
  'Ordem Paranormal': ['Ocultismo', 'Investigação', 'Vontade'],
  'D&D 5e': ['Religião', 'Persuasão', 'Atletismo'],
  'Call of Cthulhu': ['Biblioteca', 'História', 'Psicologia'],
  Tormenta20: ['Ladinagem', 'Furtividade', 'Acrobacia'],
  'Vampiro: A Máscara': ['Ocultismo', 'Erudição', 'Subterfúgio'],
  'Kids on Bikes': ['Cérebro', 'Charme', 'Coragem'],
  'Cyberpunk RED': ['Persuasão', 'Percepção', 'Informática'],
  'Pathfinder 2e': ['Religião', 'Diplomacia', 'Intimidação'],
  'Fate Core': ['Pilotar', 'Ofícios', 'Vontade'],
  GURPS: ['Sobrevivência', 'Navegação', 'Escalada'],
  '3D&T Alpha': ['Luta', 'Esquiva', 'Intimidação'],
  'Star Wars FFG': ['Pilotagem', 'Astrogação', 'Frieza'],
  Oblivio: ['Emocional', 'Rastro', 'Mundo']
}

export const QUARTA_LEVA = MOLDES.map((molde, i) => {
  const dados = {
    nivel: 3 + (i % 5),
    corpo: 1 + (i % 4),
    mente: 1 + ((i + 2) % 4),
    reflexo: 1 + ((i + 1) % 4),
    vontade: 2 + (i % 3),
    presenca: 1 + ((i + 3) % 4),
    vida: 18 + i * 2,
    energia: 6 + (i % 5),
    pericias: PERICIAS_POR_SISTEMA[molde.system],
    arma: ['Bastão', 'Espada longa', 'Revólver', 'Adaga', 'Bengala-espada', 'Estilingue', 'Pistola', 'Maça', 'Chave inglesa', 'Rifle', 'Punhos', 'Blaster', 'Faca', 'Escopeta', 'Cajado'][i],
    protecao: ['Casaco grosso', 'Cota de malha', 'Sobretudo', 'Couro batido', 'Terno', 'Jaqueta', 'Blindagem leve', 'Placas', 'Macacão', 'Parka', 'Faixas', 'Colete', 'Moletom', 'Colete tático', 'Túnica'][i],
    item: ['sal grosso', 'símbolo sagrado', 'lupa', 'gazua', 'ampulheta', 'walkie-talkie', 'deck', 'estandarte', 'chave de fenda', 'bússola', 'fita de boxe', 'holocomunicador', 'lanterna', 'algemas', 'ervas'][i],
    talento: ['Presságio', 'Golpe Divino', 'Leitura rápida', 'Ataque furtivo', 'Taumaturgia', 'Invenção', 'Contato', 'Reação', 'Improviso', 'Rastreio', 'Contragolpe', 'Manobra', 'Empatia', 'Tiro certeiro', 'Forma selvagem'][i],
    talentoTexto: 'uma vez por sessão, resolve a situação sem rolar — e a conta chega depois.',
    aparencia: `${molde.name} tem a cara de quem dormiu pouco e não vai admitir. Roupa boa, gasta; olhar que conta os presentes na sala antes de sentar.`,
    historia: `Nascido em ${molde.lugar}, ${molde.name} aprendeu o ofício de ${molde.papel.toLowerCase()} do jeito difícil e nunca contou a ninguém o que custou. Está no grupo há dois meses. Confia em duas pessoas, e uma delas é o cachorro.`
  }

  return {
    id: molde.id,
    name: molde.name,
    system: molde.system,
    /** A foto — é o que esta leva existe pra testar. */
    photo: AVATARES[molde.name],
    notes: fichaCompleta(molde.name, molde.system, molde.papel, molde.lugar, dados),
    presets: [
      preset(`${molde.id}-ataque`, `${dados.arma} (ataque)`, '⚔️', [{ count: 1, sides: 20 }], dados.reflexo + 2),
      preset(`${molde.id}-dano`, `${dados.arma} (dano)`, '💥', [{ count: 1, sides: 8 }], dados.corpo),
      preset(`${molde.id}-pericia`, dados.pericias[0], '🎯', [{ count: 1, sides: 20 }], 5)
    ]
  }
})

// Marca os dois de Ordem e os dois de D&D com a rolagem certa dos atributos deles.
for (const perfil of QUARTA_LEVA) {
  const atributos = perfil.notes.sections.find((s) => s.title === 'Atributos')
  if (!atributos) continue
  const tipo = perfil.system === 'Ordem Paranormal' ? POOL : perfil.system === 'D&D 5e' ? ATRIBUTO_DND : null
  if (tipo) for (const c of atributos.fields) c.roll = tipo
}

if (process.argv[1] && process.argv[1].endsWith('quartaLeva.mjs')) {
  const destino = process.argv[2]
  if (!destino) {
    console.error('uso: node scripts/quartaLeva.mjs <pasta de destino>')
    process.exit(1)
  }
  escreverEmDisco(destino, QUARTA_LEVA).then(({ pasta, quantos }) => {
    console.log(`${quantos} personagens escritos em ${pasta}`)
  })
}
