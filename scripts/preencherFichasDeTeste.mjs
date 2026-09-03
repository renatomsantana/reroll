/**
 * PREENCHE os modelos oficiais em branco (Breu, Tenebra, Infaernum, Shadowdark) com um personagem
 * inventado cada, pra testar os leitores por POSIÇÃO (`readers/porPosicao.ts`) contra o arquivo
 * REAL, e não só contra a `PdfSheet` montada à mão no vitest.
 *
 *     node scripts/preencherFichasDeTeste.mjs
 *
 * Lê de `Fichas RPG/` (os modelos baixados em 02/09/2026, fora do git) e grava ao lado, com
 * "(preenchida)" no nome — que é o que a fase `fichas` do harness (`testarNoApp.mjs`) importa.
 * Shadowdark e Infaernum/Tenebra são preenchidos pelo NOME do campo; Breu pela POSIÇÃO, porque os
 * nomes são de máquina e os três modelos do pacote não os compartilham.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib'

const RAIZ = resolve(import.meta.dirname, '..')
const PASTA = join(RAIZ, 'Fichas RPG')

/** Página (1..n) de cada widget, pelo `ref` dele nas `Annots` da página. */
function paginasDosWidgets(doc) {
  const porRef = new Map()
  doc.getPages().forEach((page, i) => {
    const annots = page.node.Annots()
    if (!annots) return
    for (const ref of annots.asArray()) porRef.set(ref.toString(), i + 1)
  })
  return porRef
}

/** Os campos com o retângulo do primeiro widget e a página: `{ campo, page, x, y, w, h }`. */
function camposComPosicao(doc) {
  const form = doc.getForm()
  const paginas = paginasDosWidgets(doc)
  const lista = []
  for (const campo of form.getFields()) {
    const widgets = campo.acroField.getWidgets()
    if (widgets.length === 0) continue
    const widget = widgets[0]
    const rect = widget.getRectangle()
    const ref = doc.context.getObjectRef(widget.dict)
    lista.push({ campo, page: ref ? (paginas.get(ref.toString()) ?? 1) : 1, x: rect.x, y: rect.y, w: rect.width, h: rect.height })
  }
  return lista
}

function dentro(item, r, folga = 3) {
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  return item.page === r.page && cx >= r.x - folga && cx <= r.x + r.w + folga && cy >= r.y - folga && cy <= r.y + r.h + folga
}

function escrever(campo, valor) {
  try {
    if (campo.constructor.name === 'PDFTextField') campo.setText(valor)
    else if (campo.constructor.name === 'PDFCheckBox') {
      if (valor) campo.check()
    } else if (campo.constructor.name === 'PDFDropdown') campo.select(valor)
    else console.warn(`  (pulei ${campo.getName()}: ${campo.constructor.name})`)
  } catch (causa) {
    console.warn(`  (não deu pra preencher ${campo.getName()}: ${causa.message})`)
  }
}

async function preencherPorNome(entrada, saida, valores, marcadas = []) {
  const doc = await PDFDocument.load(readFileSync(join(PASTA, entrada)), { ignoreEncryption: true })
  const form = doc.getForm()
  for (const [nome, valor] of Object.entries(valores)) {
    try {
      escrever(form.getField(nome), valor)
    } catch (causa) {
      console.warn(`  (campo ${nome} não existe: ${causa.message})`)
    }
  }
  /**
   * "Marcar" tem dois jeitos: caixa de marcar de verdade (os Estragos de Tenebra, as Desgraças
   * de Infaernum) se marca; BOTÃO de imagem oculto (as gotas, feridas e óleo de Tenebra, que o
   * script da ficha mostra ou esconde) se MOSTRA, limpando a bandeira HIDDEN (2) e NOVIEW (32) do
   * widget. É exatamente o que o leitor lê depois (`acesosEm`).
   */
  for (const nome of marcadas) {
    try {
      const campo = form.getField(nome)
      if (campo.constructor.name === 'PDFCheckBox') {
        campo.check()
        continue
      }
      for (const widget of campo.acroField.getWidgets()) {
        const atual = widget.dict.get(PDFName.of('F'))
        const bandeiras = atual ? Number(atual.toString()) : 0
        widget.dict.set(PDFName.of('F'), PDFNumber.of((bandeiras & ~2 & ~32) | 4))
      }
    } catch (causa) {
      console.warn(`  (marca ${nome}: ${causa.message})`)
    }
  }
  return salvar(doc, saida)
}

async function preencherPorPosicao(entrada, saida, regioes) {
  const doc = await PDFDocument.load(readFileSync(join(PASTA, entrada)), { ignoreEncryption: true })
  const campos = camposComPosicao(doc)
  for (const regiao of regioes) {
    const alvo = campos.find((item) => dentro(item, regiao) && (regiao.caixa ? item.campo.constructor.name === 'PDFCheckBox' : item.campo.constructor.name !== 'PDFCheckBox'))
    if (!alvo) {
      console.warn(`  (nenhum campo em p${regiao.page} ${regiao.x},${regiao.y})`)
      continue
    }
    escrever(alvo.campo, regiao.valor ?? true)
  }
  salvar(doc, saida)
}

function salvar(doc, saida) {
  try {
    doc.getForm().updateFieldAppearances()
  } catch (causa) {
    console.warn(`  (aparências: ${causa.message})`)
  }
  const bytes = doc.save({ useObjectStreams: false })
  return bytes.then((b) => {
    writeFileSync(join(PASTA, saida), b)
    console.log(`gravado ${saida} (${Math.round(b.length / 1024)} KB)`)
  })
}

const r = (page, x, y, w, h, valor) => ({ page, x, y, w, h, valor })
const caixa = (page, x, y) => ({ page, x, y, w: 9, h: 9, caixa: true })

async function main() {
  if (existsSync(join(PASTA, 'ShadowDark - Character Sheet Fillable.pdf'))) {
    await preencherPorNome('ShadowDark - Character Sheet Fillable.pdf', 'Shadowdark - Thorn (preenchida).pdf', {
      Name: 'Thorn Vale', Race: 'Elf', Class: 'Thief', Level: '3', 'XP Current': '5', 'XP Target': '30', Title: 'Footpad',
      Alignment: 'Neutral', Background: 'Urchin', Deity: 'Ord',
      'Strength Total': '12', 'Strength Modifier': '+1', 'Dexterity Total': '16', 'Dexterity Modifier': '+3',
      'Constitution Total': '10', 'Constitution Modifier': '0', 'Intelligence Total': '13', 'Intelligence Modifier': '+1',
      'Wisdom Total': '9', 'Wisdom Modifier': '-1', 'Charisma Total': '14', 'Charisma Modifier': '+2',
      'Hit Points': '11', 'Armor Class': '13',
      Attacks: 'Dagger +3, 1d4\nShortbow +3 (1d4)',
      'Talents / Spells': 'Backstab: +1d6 damage when attacking an unaware target\nThievery: advantage on stealth',
      'Gold Pieces': '12', 'Silver Pieces': '0', 'Copper Pieces': '5',
      'Gear 1': 'Dagger', 'Gear 2': 'Shortbow', 'Gear 3': '20 arrows', 'Gear 4': 'Thieving tools', 'Free To Carry': '8'
    })
  }

  if (existsSync(join(PASTA, 'Infaernum - Ficha Editavel.pdf'))) {
    await preencherPorNome('Infaernum - Ficha Editavel.pdf', 'Infaernum - Irene (preenchida).pdf', {
      'Text Field 1': 'Irene Salgado\nEx-freira do interior',
      'Text Field 2': 'Fé inabalável',
      'Text Field 3': 'Perde tudo no jogo',
      'Text Field 4': 'Ouve os sinos da igreja que não existe mais',
      'Text Field 7': 'Nunca mais dormirá em paz',
      'Text Field 5': 'As portas se abrem para ela',
      'Text Field 6': 'Lanterna a querosene\nFaca de cozinha'
    }, ['Check Box 1', 'Check Box 4'])
  }

  if (existsSync(join(PASTA, 'Tenebra - Ficha Editavel.pdf'))) {
    await preencherPorNome('Tenebra - Ficha Editavel.pdf', 'Tenebra - Nadia (preenchida).pdf', {
      'Campo de Texto0': 'Nadia Kess\n(a Fuinha)', 'Campo de Texto1': 'A Fuinha', 'Campo de Texto2': 'Sucateira', 'Campo de Texto3': '2',
      'Campo de Texto4': 'Olho de vidro', 'Campo de Texto5': 'vê no escuro',
      'Campo de Texto12': 'Faca enferrujada\nRádio quebrado\n\nCorda',
      'Campo de Texto13': 'Bomba de fumaça',
      'Campo de Texto14': '3', 'Campo de Texto15': '1', 'Campo de Texto16': '0',
      'Campo de Texto17': 'Tia Zefa', 'Campo de Texto23': 'Vende óleo bom',
      'Campo de Texto29': 'Machadinha', 'Campo de Texto30': 'curta', 'Campo de Texto31': 'Quebra na segunda falha',
      'Campo de Texto38': 'Faro de sucata', 'Campo de Texto39': 'Acha peça útil em qualquer lixão.'
    }, ['fo0', 'fo1', 'fo2', 'fo5', 'fo6', 'fo15', 'fo16', 'fo17', 'fo18', 'fo19', 'fad0', 'fr0', 'fr1', 'tr6', 'Oil0', 'Oil1', 'Oil2', 'Oil3', 'Caixa de Seleção58', 'Caixa de Seleção59'])
  }

  const breu = join('Breu - Pack de Fichas', 'BREU_FichaDePersonagem', 'BREU_FichaDePersonagem_GeralComIlustra_EDITÁVEL.pdf')
  if (existsSync(join(PASTA, breu))) {
    await preencherPorPosicao(breu, 'Breu - Odete (preenchida).pdf', [
      r(1, 60, 682, 266, 17, 'Odete Brasa'), r(1, 356, 682, 131, 17, 'Combatente'), r(1, 499, 682, 56, 17, '120'),
      r(1, 88, 664, 152, 17, 'mercenária'), r(1, 281, 664, 274, 17, 'intimidar'), r(1, 88, 647, 468, 17, 'vingança'),
      r(1, 116, 629, 439, 17, 'Humana, cicatriz no rosto'),
      r(1, 45, 547, 40, 33, '16'), r(1, 49, 507, 31, 24, '+3'), caixa(1, 61, 534),
      r(1, 105, 548, 40, 32, '12'), r(1, 110, 507, 31, 24, '+1'),
      r(1, 166, 548, 40, 32, '14'), r(1, 170, 507, 31, 24, '+2'), caixa(1, 181, 534),
      r(1, 226, 548, 40, 32, '8'), r(1, 230, 507, 31, 24, '-1'),
      r(1, 286, 548, 40, 32, '10'), r(1, 291, 507, 31, 24, '0'),
      r(1, 347, 548, 40, 32, '11'), r(1, 351, 507, 31, 24, '0'),
      r(1, 100, 463, 28, 21, '2'), r(1, 181, 467, 24, 17, '11'), r(1, 208, 467, 24, 17, '14'), r(1, 304, 467, 87, 17, '9m'),
      r(1, 76, 429, 35, 17, '22'), r(1, 112, 429, 35, 17, '15'), r(1, 192, 429, 100, 17, '3d10'), r(1, 300, 429, 89, 17, '1'),
      r(1, 415, 430, 33, 17, '17'), r(1, 493, 430, 25, 17, '9'), r(1, 339, 387, 50, 17, '35'),
      r(1, 414, 567, 73, 17, 'Perna manca'), caixa(1, 488, 572), caixa(1, 499, 572),
      r(1, 49, 369, 350, 17, 'Ataque extra'), r(1, 49, 352, 350, 17, 'Segundo fôlego'),
      r(1, 38, 154, 128, 16, 'Machado grande'), r(1, 168, 154, 30, 16, '+5'), r(1, 199, 154, 45, 16, '1d12+3'), r(1, 246, 154, 145, 16, 'duas mãos'),
      r(1, 38, 64, 128, 16, 'Arco curto'), r(1, 168, 64, 30, 16, '+3'), r(1, 199, 64, 45, 16, '1d6+1'), r(1, 244, 64, 45, 16, '20'),
      r(1, 408, 314, 113, 17, 'Mochila de couro'), r(1, 523, 314, 16, 17, '2'), r(1, 542, 314, 16, 17, '6'),
      r(1, 408, 182, 113, 17, 'Corda'), r(1, 523, 182, 16, 17, '1'),
      r(2, 38, 529, 288, 17, 'Luz'), r(2, 328, 529, 30, 17, '1'), r(2, 361, 529, 31, 17, '88'),
      r(2, 142, 642, 40, 33, '+4'),
      r(2, 37, 16, 358, 262, 'Deve 10 pratas ao ferreiro.')
    ])
  }
}

main().catch((causa) => {
  console.error(causa)
  process.exit(1)
})
