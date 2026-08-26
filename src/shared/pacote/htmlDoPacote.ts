import type { Language } from '../types/idioma'
import { expressaoParaFormula } from '../dice/formulaParaExpressao'
import { ID_DO_BLOCO_JSON, serializarPacote, type PacoteDePersonagem } from './pacoteDePersonagem'

/**
 * O HTML do pacote: a ficha desenhada pra quem abre o arquivo no navegador (o mestre, o próprio
 * jogador no celular), com o JSON do personagem embutido no fim pro Reroll importar de volta.
 *
 * É uma página SEM NADA de fora — sem script, sem fonte da web, sem imagem por URL. Ela vai por
 * WhatsApp e por pendrive e tem que abrir igual em qualquer lugar, offline; e um arquivo que roda
 * script ao ser aberto é exatamente o que ninguém quer receber de um colega de mesa. A foto vai
 * embutida (já é data URL no perfil), e o resto é texto.
 *
 * TUDO o que vem do personagem passa por `escapar`: nome, valores de campo, texto do diário. O
 * conteúdo é da própria pessoa, mas uma anotação com `<b>` dentro não pode virar negrito — nem uma
 * com `<img onerror>` virar outra coisa.
 *
 * O visual é o do app: cinza 98, caixa com borda chanfrada, Tahoma. É a ficha que a pessoa vê no
 * Reroll, no papel.
 */
const ROTULOS = {
  'pt-BR': {
    sistema: 'Sistema',
    recursos: 'Recursos',
    atributos: 'Atributos',
    habilidades: 'Habilidades',
    inventario: 'Inventário',
    aparencia: 'Aparência',
    historia: 'História',
    diario: 'Diário',
    dia: 'Dia',
    presets: 'Presets de rolagem',
    favorito: 'favorito',
    condicoes: 'Condições',
    exportado: 'Exportado do Reroll',
    abrirNoApp: 'Este arquivo também abre no Reroll: Ficha → Importar personagem Reroll.',
    fichaOriginal: 'Ficha original (PDF)',
    semNome: 'Personagem'
  },
  'en-US': {
    sistema: 'System',
    recursos: 'Resources',
    atributos: 'Attributes',
    habilidades: 'Abilities',
    inventario: 'Inventory',
    aparencia: 'Appearance',
    historia: 'Backstory',
    diario: 'Journal',
    dia: 'Day',
    presets: 'Roll presets',
    favorito: 'favorite',
    condicoes: 'Conditions',
    exportado: 'Exported from Reroll',
    abrirNoApp: 'This file also opens in Reroll: Sheet → Import Reroll character.',
    fichaOriginal: 'Original sheet (PDF)',
    semNome: 'Character'
  }
} as const satisfies Record<Language, Record<string, string>>

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Texto de bloco: escapado, com as quebras de linha preservadas pelo CSS (`white-space: pre-wrap`). */
function bloco(titulo: string, texto: string): string {
  if (!texto.trim()) return ''
  return `<section class="caixa"><h2>${escapar(titulo)}</h2><p class="texto">${escapar(texto)}</p></section>`
}

export function htmlDoPacote(pacote: PacoteDePersonagem, idioma: Language): string {
  const r = ROTULOS[idioma] ?? ROTULOS['pt-BR']
  const { personagem, ficha, presets } = pacote
  const nome = personagem.name.trim() || ficha.characterName.trim() || r.semNome

  const foto = personagem.photo ? `<img class="foto" src="${escapar(personagem.photo)}" alt="">` : ''

  const recursos = ficha.recursos.length
    ? `<section class="caixa"><h2>${r.recursos}</h2><ul class="barras">${ficha.recursos
        .map(
          (b) =>
            `<li><span>${escapar(b.nome)}</span><b>${b.atual} / ${b.maximo}</b></li>`
        )
        .join('')}</ul></section>`
    : ''

  const condicoes = ficha.condicoes.filter((c) => c.ativa)
  const chips = condicoes.length
    ? `<p class="condicoes"><span>${r.condicoes}:</span> ${condicoes.map((c) => `<em>${escapar(c.nome)}</em>`).join(' ')}</p>`
    : ''

  const secoes = ficha.sections
    .map(
      (secao) =>
        `<section class="caixa"><h2>${escapar(secao.title)}</h2><dl>${secao.fields
          .map((campo) => `<div><dt>${escapar(campo.label)}</dt><dd>${escapar(campo.value)}</dd></div>`)
          .join('')}</dl></section>`
    )
    .join('')

  const blocos = [
    bloco(r.atributos, ficha.attributes),
    bloco(r.habilidades, ficha.abilities),
    bloco(r.inventario, ficha.inventory),
    bloco(r.aparencia, ficha.appearance),
    bloco(r.historia, ficha.backstory)
  ].join('')

  const paginas = ficha.pages.filter((p) => p.text.trim() || p.title.trim())
  const diario = paginas.length
    ? `<section class="caixa"><h2>${r.diario}</h2>${paginas
        .map((p, i) => {
          const titulo = p.title.trim() || `${r.dia} ${i + 1}`
          const data = p.createdAt > 0 ? ` <small>${new Date(p.createdAt).toLocaleDateString(idioma)}</small>` : ''
          return `<h3>${escapar(titulo)}${data}</h3><p class="texto">${escapar(p.text)}</p>`
        })
        .join('')}</section>`
    : ''

  const listaDePresets = presets.length
    ? `<section class="caixa"><h2>${r.presets}</h2><ul class="presets">${presets
        .map((p) => {
          const formula = p.formula ?? (p.expression ? expressaoParaFormula(p.expression) : null) ?? ''
          const estrela = p.favorito !== undefined ? ` <span class="estrela" title="${r.favorito}">★</span>` : ''
          return `<li>${p.icon ? `<span class="icone">${escapar(p.icon)}</span> ` : ''}<span>${escapar(p.name)}</span>${estrela}<code>${escapar(formula)}</code></li>`
        })
        .join('')}</ul></section>`
    : ''

  // A FICHA ORIGINAL: as páginas do PDF, uma embaixo da outra. É o que o mestre quer olhar.
  const fichaOriginal = pacote.paginas.length
    ? `<section class="caixa"><h2>${r.fichaOriginal}</h2><div class="paginas">${pacote.paginas
        .map((p) => `<img src="${escapar(p)}" alt="">`)
        .join('')}</div></section>`
    : ''

  const quando = pacote.exportadoEm ? new Date(pacote.exportadoEm).toLocaleString(idioma) : ''

  return `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(nome)} - Reroll</title>
<style>
  body { margin: 0; background: #c0c0c0; color: #000; font: 14px Tahoma, 'MS Sans Serif', Geneva, sans-serif; }
  main { max-width: 820px; margin: 24px auto; padding: 0 12px; }
  .cabecalho { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
  .foto { width: 96px; height: 96px; object-fit: cover; border: 2px solid; border-color: #fff #404040 #404040 #fff; background: #808080; }
  h1 { margin: 0; font-size: 22px; }
  .sistema { margin: 4px 0 0; color: #333; }
  .condicoes { margin: 6px 0 0; } .condicoes em { font-style: normal; border: 1px solid #000; padding: 0 6px; background: #fff; margin-right: 4px; }
  .caixa { background: #c0c0c0; border: 2px solid; border-color: #fff #404040 #404040 #fff; padding: 8px 12px; margin: 0 0 10px; box-shadow: 1px 1px 0 #000; }
  h2 { margin: 0 0 6px; font-size: 14px; background: #000080; color: #fff; padding: 2px 6px; }
  h3 { margin: 10px 0 2px; font-size: 13px; } h3 small { font-weight: normal; color: #333; }
  dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 12px; margin: 0; }
  dl div { display: flex; gap: 6px; border-bottom: 1px dotted #808080; } dt { color: #333; } dd { margin: 0 0 0 auto; font-weight: bold; text-align: right; }
  .texto { margin: 0; white-space: pre-wrap; background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; padding: 6px; }
  ul { list-style: none; margin: 0; padding: 0; }
  .barras li, .presets li { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; }
  .barras b, .presets code { margin-left: auto; } .estrela { color: #806000; }
  .paginas { display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 8px; background: #808080; border: 2px solid; border-color: #808080 #fff #fff #808080; }
  .paginas img { display: block; width: 100%; max-width: 780px; height: auto; background: #fff; box-shadow: 2px 2px 0 #000; }
  footer { color: #333; font-size: 12px; margin-top: 16px; }
  @media print { body { background: #fff; } .caixa { box-shadow: none; } }
</style>
</head>
<body>
<main>
  <header class="cabecalho">${foto}<div><h1>${escapar(nome)}</h1>${
    personagem.system ? `<p class="sistema">${r.sistema}: ${escapar(personagem.system)}</p>` : ''
  }${chips}</div></header>
  ${recursos}
  ${secoes}
  ${blocos}
  ${listaDePresets}
  ${diario}
  ${fichaOriginal}
  <footer>${r.exportado}${pacote.app ? ` ${escapar(pacote.app)}` : ''}${quando ? ` · ${escapar(quando)}` : ''}<br>${r.abrirNoApp}</footer>
</main>
<script id="${ID_DO_BLOCO_JSON}" type="application/json">${serializarPacote(pacote)}</script>
</body>
</html>
`
}
