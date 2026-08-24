import type { FichaDeTeste } from './corpusDePdfs'
import { montarPdf, pdfDeUmaPagina, widget, type ObjetoPdf } from './pdfDeMentira'

/**
 * A SEXTA LEVA: oito PDFs fabricados, cobrindo o que as cinco levas anteriores não cobrem —
 * continuação dos testes de scraping pedida pelo usuário.
 *
 * O buraco maior era o leitor de PATHFINDER 2e: ele nasceu das quatro fichas reais da pasta (que
 * moram fora do repositório) e não tinha NENHUM caso fabricado — quem clonasse o projeto rodava o
 * leitor só contra `PdfSheet` montada à mão, nunca contra um PDF de verdade atravessando
 * `pdfjs → sheetFromPdfDocument → readSheet`. Os três primeiros casos fecham isso: a família
 * "Ficha Editável com Cálculos" preenchida (com a numeração torta da grade à distância, o total
 * vazio refeito dos componentes, o atributo negativo, os pontos de herói em caixa), o modelo em
 * branco, e a ficha estilo-oficial da Paizo, cujos nomes de campo (`text_15gujr`) não significam
 * nada e caem no genérico.
 *
 * Os outros cinco são estrutura de PDF que ficha real usa e nenhuma leva exercitava: rótulo
 * impresso na posição que NÃO rotula (abaixo-direita, e longe demais), campo OCULTO de cálculo
 * interno junto de um botão de imprimir, valor gravado em UTF-16 com BOM (como o Acrobat grava
 * acento), valor herdado do campo PAI (`/Parent`, a hierarquia normal de AcroForm), e uma ficha de
 * Kids on Bikes datilografada — o sistema cuja ficha real é arte sem texto, aqui na forma que RENDE:
 * o dado de cada atributo escrito ("Músculos: d12") virando campo e preset.
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/**
 * Grade de widgets pro modelo de PF2e: cada campo numa célula própria, três colunas, descendo a
 * página — posição de verdade, porque o leitor genérico (a base do dedicado) casa rótulo por
 * distância e widgets empilhados no mesmo lugar roubariam rótulo uns dos outros.
 */
function gradeDeCampos(campos: [string, string][]): string[] {
  return campos.map(([nome, valor], i) => {
    const x = 60 + (i % 3) * 180
    const y = 740 - Math.floor(i / 3) * 24
    return widget(nome, valor, `[${x} ${y} ${x + 160} ${y + 18}]`)
  })
}

/** Caixa de marcação com nome e estado — o formato que o modelo de PF2e usa aos montes. */
function caixa(nome: string, marcada: boolean, i: number): string {
  const y = 200 - i * 22
  const estado = marcada ? '/On' : '/Off'
  return `<< /Type /Annot /Subtype /Widget /FT /Btn /T (${nome}) /V ${estado} /AS ${estado} /Rect [60 ${y} 76 ${y + 16}] >>`
}

/** Texto em UTF-16BE com BOM, como string hexadecimal de PDF — é assim que o Acrobat grava acento. */
function hexUtf16(texto: string): string {
  let hex = 'FEFF'
  for (const ch of texto) hex += ch.codePointAt(0)!.toString(16).padStart(4, '0')
  return `<${hex.toUpperCase()}>`
}

export const SEXTA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '31-pf2e-editavel-preenchida.pdf',
    proposito:
      'Pathfinder 2e "Editável com Cálculos" preenchida: totais vazios refeitos dos componentes, atributo negativo, a grade à distância torta, pontos de herói e moedas',
    espera: {
      leitor: 'pathfinder2e',
      nome: 'Rilma',
      minimoDeCampos: 20,
      // Longsword e Shortbow em ataque+dano, fist nas DUAS grades (a segunda ganha "à distância").
      minimoDePresets: 6,
      campos: [
        { label: 'Força', value: '+4', group: 'Atributos' },
        { label: 'Carisma', value: '-1', group: 'Atributos' },
        // FORTITUDE vazio no arquivo: refeito de CONSTITUTION (1) + PROFICIENCY (5).
        { label: 'Fortitude', value: '+6', group: 'Salvaguardas' },
        // REFLEX escrito vale por si, mesmo com componentes presentes.
        { label: 'Reflexos', value: '+7', group: 'Salvaguardas' },
        { label: 'Furtividade', value: '+7', group: 'Perícias' },
        // ACROBATICS vazio: 2 + 5. THIEVERY idem, com o DUPLO ESPAÇO do modelo no nome do componente.
        { label: 'Acrobacia', value: '+7', group: 'Perícias' },
        { label: 'Ladinagem', value: '+5', group: 'Perícias' },
        // A categoria vem do campo com o ERRO DE DIGITAÇÃO do modelo ("LORE CATAGORY 1").
        { label: 'Conhecimento (Warfare)', value: '+7', group: 'Perícias' },
        { label: 'Percepção', value: '+6', group: 'Combate' },
        { label: 'PV máximo', value: '44', group: 'Combate' },
        // O modelo não tem campo de PV atual — a lacuna existe pra anotar na mesa.
        { label: 'PV atual', value: '', group: 'Combate' },
        { label: 'Deslocamento', value: '25', group: 'Combate' },
        { label: 'Pontos de herói', value: '2', group: 'Combate' },
        // O grau mais ALTO marcado vence: Treinado e Perito marcados viram só "Perito".
        { label: 'Armas simples', value: 'Perito', group: 'Proficiências' },
        { label: 'Moedas', value: '12 ouro, 3 prata', group: 'Inventário' },
        { label: 'Longsword', valueMatches: /\+11 · 1d8\+4 — versatile P/, group: 'Ataques' }
      ],
      semRotulo: /^(MELEE|RANGED) STRIKE/
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          ...gradeDeCampos([
            ['CHARACTER NAME', 'Rilma'],
            ['PLAYER NAME', 'Kauan'],
            ['ANCESTRY', 'Human'],
            ['BACKGROUND', 'Guard'],
            ['CLASS', 'Fighter'],
            ['LEVEL', '3'],
            ['KEY ATTRIBUTE', 'STR'],
            ['LANGUAGES', 'Common'],
            ['STRENGTH STAT', '+4'],
            ['DEXTERITY STAT', '+2'],
            ['CONSTITUTION STAT', '+1'],
            ['INTELLIGENCE STAT', '0'],
            ['WISDOM STAT', '+1'],
            ['CHARISMA STAT', '-1'],
            // Fortitude em branco, componentes presentes; Reflexos escrito por cima dos componentes.
            ['FORTITUDE', ''],
            ['CONSTITUTION', '1'],
            ['PROFICIENCY', '5'],
            ['REFLEX', '+7'],
            ['DEXTERITY', '2'],
            ['PROFICIENCY2', '3'],
            ['WILL', ''],
            ['WISDOM', '1'],
            ['PROFICIENCY3', '3'],
            ['STEALTH', '7'],
            ['ACROBATICS', ''],
            ['ACROBATICS DEXTERITY', '2'],
            ['ACROBATICS PROFICIENCY', '5'],
            ['THIEVERY', ''],
            ['THIEVERY DEXTERITY', '2'],
            ['THIEVERY  PROFICIENCY', '3'],
            ['LORE CATAGORY 1', 'Warfare'],
            ['LORE1', '7'],
            ['PERCEPTION', ''],
            ['PERCEPTION WISDOM', '1'],
            ['PERCEPTION PROFICIENCY', '5'],
            ['AC', '19'],
            ['CLASS DC', '17'],
            ['MAXIMUM HIT POINTS', '44'],
            ['SPEED', '25 feet'],
            ['MELEE STRIKE 1', 'Longsword'],
            ['MELEE STRIKE 1 ATTACK BONUS', '+11'],
            ['MELEE STRIKE 1 DAMAGE', '1d8+4'],
            ['MELEE STRIKE 1 TRAITS AND NOTES', 'versatile P'],
            ['MELEE STRIKE 2', 'fist'],
            ['MELEE STRIKE 2 ATTACK BONUS', '+9'],
            ['MELEE STRIKE 2 DAMAGE', '1d4+4'],
            // A numeração TORTA do modelo: nome e dano em RANGED STRIKE 4/5, o bônus em 1/2.
            ['RANGED STRIKE 4', 'Shortbow'],
            ['RANGED STRIKE 1 ATTACK BONUS', '+9'],
            ['RANGED STRIKE 4 DAMAGE', '1d6'],
            ['RANGED STRIKE 4 TRAITS AND NOTES', '60 ft.'],
            ['RANGED STRIKE 5', 'fist'],
            ['RANGED STRIKE 2 ATTACK BONUS', '+7'],
            ['RANGED STRIKE 5 DAMAGE', '1d4'],
            ['HELD1', 'Longsword'],
            ['HELD BULK 1', '1'],
            ['HELD 2', 'Backpack'],
            ['HELD BULK 2', 'L'],
            ['GOLD', '12'],
            ['SILVER', '3'],
            ['COPPER', '0'],
            ['ANCESTRY FEAT', 'Natural Ambition'],
            ['NOTES', 'Deve 5 po ao armeiro do bairro']
          ]),
          caixa('HERO POINT 1', true, 0),
          caixa('HERO POINT 2', true, 1),
          caixa('HERO POINT 3', false, 2),
          caixa('SIMPLE WEAPONS TRAINED', true, 3),
          caixa('SIMPLE WEAPONS EXPERT', true, 4),
          caixa('MARTIAL WEAPONS TRAINED', true, 5)
        ]
      })
  },
  {
    arquivo: '32-pf2e-editavel-em-branco.pdf',
    proposito: 'o modelo de PF2e em branco: reconhecido, sem nome, sem lacuna — os componentes "0" de fábrica não viram perícia calculada',
    espera: {
      leitor: 'pathfinder2e',
      nome: '',
      maximoDeCampos: 0,
      avisos: ['sem-nome-nem-rolagem']
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          ...gradeDeCampos([
            ['CHARACTER NAME', ''],
            ['ANCESTRY', ''],
            ['KEY ATTRIBUTE', ''],
            ['CLASS DC', ''],
            ['STRENGTH STAT', ''],
            ['DEXTERITY STAT', ''],
            ['FORTITUDE', ''],
            ['CONSTITUTION', '0'],
            ['PROFICIENCY', '0'],
            ['REFLEX', ''],
            ['DEXTERITY', '0'],
            ['PROFICIENCY2', '0'],
            ['ACROBATICS', ''],
            ['ACROBATICS DEXTERITY', '0'],
            ['ACROBATICS PROFICIENCY', '0'],
            ['MELEE STRIKE 1', ''],
            ['MELEE STRIKE 1 ATTACK BONUS', ''],
            ['MELEE STRIKE 1 DAMAGE', '']
          ]),
          caixa('HERO POINT 1', false, 0)
        ]
      })
  },
  {
    arquivo: '33-pf2e-oficial-nomes-sem-significado.pdf',
    proposito: 'a ficha estilo-oficial da Paizo: nomes de campo tipo "text_15gujr" não significam nada — o rótulo impresso manda, e campo sem rótulo fica de fora',
    espera: {
      leitor: 'generico',
      nome: 'Valeria',
      minimoDeCampos: 3,
      maximoDeCampos: 3,
      campos: [
        { label: 'NAME', value: 'Valeria' },
        { label: 'PERCEPTION', value: '+7' },
        { label: 'SHIELD', value: 'sim' }
      ],
      // O nome cru do exportador nunca pode virar rótulo: "text_4r5t = 13" na conferência é pior
      // que campo nenhum — não informa e tira a confiança do resto.
      semRotulo: /^(text|checkbox)_/i,
      proibidos: [/^13$/]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('text_15gujr', 'Valeria', '[140 756 300 776]'),
          widget('text_9k2fh', '+7', '[140 716 200 736]'),
          `<< /Type /Annot /Subtype /Widget /FT /Btn /T (checkbox_5xofc) /V /On /AS /On /Rect [140 676 156 692] >>`,
          // Preenchido, e SEM rótulo impresso em alcance nenhum (o mais perto está a 200pt).
          widget('text_4r5t', '13', '[400 400 460 420]'),
          // Vazios do modelo, que nunca entram de qualquer forma.
          widget('text_2abcd', '', '[140 636 300 656]'),
          widget('text_7wxyz', '', '[140 596 300 616]')
        ],
        linhas: [
          linha('NAME', 760, 80),
          linha('PERCEPTION', 720, 60),
          linha('SHIELD', 680, 80),
          linha('Pathfinder Character Sheet', 200, 60)
        ]
      })
  },
  {
    arquivo: '34-rotulo-na-posicao-proibida.pdf',
    proposito: 'texto impresso abaixo-direita e texto longe demais não rotulam: o campo fica com o próprio nome, nunca com o rótulo do vizinho errado',
    espera: {
      leitor: 'generico',
      nome: 'Ondina',
      campos: [
        // "FAMA" está ABAIXO e À DIREITA da caixa — posição que rótulo de ficha não usa.
        { label: 'Reputacao', value: '3' },
        // "CICATRIZES" está a mais de 70pt — longe demais pra ser o rótulo desta caixa.
        { label: 'Marcas', value: 'duas no braço' }
      ],
      semRotulo: /^(FAMA|CICATRIZES)$/
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Ondina', '[100 760 300 780]'),
          widget('Reputacao', '3', '[100 700 160 720]'),
          widget('Marcas', 'duas no braço', '[350 700 490 720]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          // Abaixo (y menor) e à direita (x maior) da caixa de Reputação — e LONGE da de Marcas.
          linha('FAMA', 670, 200),
          // Abaixo-direita da caixa de Marcas: a posição que rótulo de ficha não usa.
          linha('CICATRIZES', 644, 450)
        ]
      })
  },
  {
    arquivo: '35-campo-oculto-e-botao-de-imprimir.pdf',
    proposito: 'campo OCULTO de cálculo interno e botão de imprimir não são ficha de ninguém: só o que a pessoa vê entra',
    espera: {
      leitor: 'generico',
      nome: 'Petra',
      maximoDeCampos: 1,
      campos: [{ label: 'NOME', value: 'Petra' }],
      // O total interno do JavaScript do modelo (999) nunca pode aparecer na conferência.
      proibidos: [/999|TOTAL_INTERNO|Imprimir/]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Petra', '[100 760 300 780]'),
          // /F 2 é a bandeira HIDDEN: o campo existe pro cálculo, não pros olhos.
          `<< /Type /Annot /Subtype /Widget /FT /Tx /F 2 /T (TOTAL_INTERNO) /V (999) /Rect [100 700 200 720] >>`,
          // Botão de ação (push button, /Ff 65536): dispara impressão, não guarda valor.
          `<< /Type /Annot /Subtype /Widget /FT /Btn /Ff 65536 /T (Imprimir) /Rect [100 660 180 680] >>`
        ],
        linhas: [linha('NOME', 764, 100)]
      })
  },
  {
    arquivo: '36-valor-em-utf16-com-bom.pdf',
    proposito: 'valor gravado em UTF-16 com BOM (como o Acrobat grava acento) atravessa e vira o texto certo',
    espera: {
      leitor: 'generico',
      nome: 'José Ândrade',
      campos: [
        { label: 'NOME', value: 'José Ândrade' },
        { label: 'LEMA', value: 'Coragem é hábito' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          `<< /Type /Annot /Subtype /Widget /FT /Tx /T (Nome) /V ${hexUtf16('José Ândrade')} /Rect [100 760 300 780] >>`,
          `<< /Type /Annot /Subtype /Widget /FT /Tx /T (Lema) /V ${hexUtf16('Coragem é hábito')} /Rect [100 720 300 740] >>`
        ],
        linhas: [linha('NOME', 764, 100), linha('LEMA', 724, 100)]
      })
  },
  {
    arquivo: '37-valor-no-campo-pai.pdf',
    proposito: 'hierarquia de AcroForm: o widget filho sem /V herda o valor do campo PAI — a estrutura normal de formulário feito no Acrobat',
    espera: {
      leitor: 'generico',
      nome: 'Cátia',
      campos: [
        { label: 'NOME', value: 'Cátia' },
        { label: 'PERÍCIA', value: 'Atletismo 5' }
      ]
    },
    bytes: () => {
      // Numeração à mão: 1 catálogo, 2 páginas, 3 página, 4 conteúdo, 5 fonte,
      // 6 campo PAI (sem widget), 7 widget FILHO (sem /T nem /V), 8 campo de nome comum.
      const linhas = [linha('NOME', 764, 100), linha('PERÍCIA', 704, 100)]
      const corpoDoTexto = linhas
        .map((l) => `BT /F1 12 Tf ${l.x} ${l.y} Td (${l.texto.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj ET`)
        .join('\n')
      const objetos: ObjetoPdf[] = [
        { corpo: '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [6 0 R 8 0 R] >> >>' },
        { corpo: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        {
          corpo:
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
            '/Resources << /Font << /F1 5 0 R >> >> /Annots [7 0 R 8 0 R] >>'
        },
        { corpo: `<< /Length ${Buffer.byteLength(corpoDoTexto, 'latin1')} >>\nstream\n${corpoDoTexto}\nendstream` },
        { corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
        { corpo: '<< /FT /Tx /T (Pericia) /V (Atletismo 5) /Kids [7 0 R] >>' },
        { corpo: '<< /Type /Annot /Subtype /Widget /Parent 6 0 R /Rect [100 700 300 720] >>' },
        { corpo: '<< /Type /Annot /Subtype /Widget /FT /Tx /T (Nome) /V (Cátia) /Rect [100 760 300 780] >>' }
      ]
      return montarPdf(objetos)
    }
  },
  {
    arquivo: '38-kids-on-bikes-datilografada.pdf',
    proposito: 'Kids on Bikes datilografada: o dado de cada atributo escrito ("Músculos: d12") vira campo E preset — a ficha real deste sistema é arte sem texto, esta é a forma que rende',
    espera: {
      leitor: 'generico',
      nome: 'Duda Martins',
      minimoDeCampos: 8,
      minimoDePresets: 4,
      campos: [
        { label: 'Músculos', value: 'd12' },
        { label: 'Cérebro', value: 'd8' },
        { label: 'Idade', value: '12' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('FICHA — KIDS ON BIKES', 770),
          linha('Nome: Duda Martins', 745),
          linha('Idade: 12', 730),
          linha('Estilo: Exploradora corajosa', 715),
          linha('Músculos: d12', 690),
          linha('Cérebro: d8', 675),
          linha('Charme: d10', 660),
          linha('Luta: d6', 645),
          linha('Fuga: d20', 630),
          linha('Garra: d4', 615),
          linha('Defeito: age antes de pensar', 590),
          linha('Medo: escuro do porão da escola', 575),
          linha('Lanche favorito: pastel de queijo', 560),
          linha('Fichas de adversidade: 3', 545),
          linha('Duda conhece cada atalho da cidade e já quebrou o braço duas vezes', 515),
          linha('provando que conhecia mais um.', 500)
        ]
      })
  }
]
