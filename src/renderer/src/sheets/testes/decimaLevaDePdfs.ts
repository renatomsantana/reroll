import type { FichaDeTeste } from './corpusDePdfs'
import { fluxoDeTexto, montarPdf, pdfDeUmaPagina, widget, type ObjetoPdf } from './pdfDeMentira'

/**
 * A DÉCIMA LEVA: "preparar pra qualquer ficha" — pedido do usuário depois de as barras de recurso
 * entrarem. O que muda de ficha pra ficha não é só o sistema: é COMO se escreve "quanto tem, de
 * quanto". Cada caso aqui é uma grafia que uma ficha caseira ou traduzida usa, e o que se cobra é
 * a lista EXATA de barras que a conferência vai propor (`espera.barras`).
 *
 * O último caso é a FOTO: uma ficha preenchível com o retrato num campo de formulário (a
 * aparência de um botão de imagem, que é como o Acrobat guarda "clique pra inserir foto") e um
 * LOGO maior desenhado na própria página. O corpus do vitest não decodifica imagem (não há canvas
 * no Node); quem prova que a foto vence o logo é o harness no app (`scripts/testarNoApp.mjs`,
 * fase `fabricados`), que abre este mesmo arquivo pela tela de conferência.
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

/** Uma imagem RGB crua (sem filtro) como objeto de PDF, com os pixels que a função pintar. */
function imagemRgb(largura: number, altura: number, pixel: (x: number, y: number) => [number, number, number]): string {
  let dados = ''
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const [r, g, b] = pixel(x, y)
      dados += String.fromCharCode(r & 255, g & 255, b & 255)
    }
  }
  return `<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${dados.length} >>\nstream\n${dados}\nendstream`
}

/**
 * A ficha com a foto no campo. Numeração à mão porque `pdfDeUmaPagina` não sabe de XObject:
 * 1 catálogo, 2 páginas, 3 página, 4 conteúdo, 5 fonte, 6 o logo (imagem grande de DUAS cores),
 * 7 a foto (imagem menor, "fotográfica": cores variando pixel a pixel), 8 a aparência do botão de
 * imagem (um Form XObject que desenha a foto), 9 o botão em si, 10 o campo do nome.
 */
function fichaComFotoNoCampo(): Uint8Array {
  // Só RÓTULOS impressos: numa ficha preenchível os valores moram nos campos, e o leitor genérico
  // trata o texto de uma ficha com formulário como diagramação — que é o certo pra ficha real.
  const conteudo = [
    linha('FICHA DE PERSONAGEM — QUALQUER SISTEMA', 778),
    linha('Nome', 730, 150),
    linha('PV atual', 700, 150),
    linha('PV máximo', 680, 150),
    linha('Mana', 660, 150)
  ]
  const textos = fluxoDeTexto(conteudo)
  // O conteúdo da página desenha o LOGO (300×300 em pontos, canto de baixo) além do texto.
  const corpoDoConteudo = textos.replace(/<< \/Length \d+ >>\nstream\n([\s\S]*)\nendstream/, (_tudo, miolo: string) => {
    const novo = `${miolo}\nq 300 0 0 300 280 60 cm /Logo Do Q`
    return `<< /Length ${Buffer.byteLength(novo, 'latin1')} >>\nstream\n${novo}\nendstream`
  })
  const aparencia = 'q 120 0 0 160 0 0 cm /Foto Do Q'
  const objetos: ObjetoPdf[] = [
    { corpo: '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [9 0 R 10 0 R 11 0 R 12 0 R 13 0 R] >> >>' },
    { corpo: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      corpo:
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
        '/Resources << /Font << /F1 5 0 R >> /XObject << /Logo 6 0 R >> >> /Annots [9 0 R 10 0 R 11 0 R 12 0 R 13 0 R] >>'
    },
    { corpo: corpoDoConteudo },
    { corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
    // O logo: um triângulo vermelho sobre preto — duas cores, como o da ficha de Assimilação.
    { corpo: imagemRgb(200, 200, (x, y) => (x > y ? [200, 0, 0] : [0, 0, 0])) },
    // A "foto": 96×128 com cores variando pixel a pixel — o que uma fotografia tem e um logo não.
    { corpo: imagemRgb(96, 128, (x, y) => [(x * 7 + y * 3) & 255, (x * 5 + y * 11) & 255, (x * 13 + y * 2) & 255]) },
    {
      corpo:
        `<< /Type /XObject /Subtype /Form /BBox [0 0 120 160] /Resources << /XObject << /Foto 7 0 R >> >> ` +
        `/Length ${Buffer.byteLength(aparencia, 'latin1')} >>\nstream\n${aparencia}\nendstream`
    },
    // O botão de imagem: campo de botão (Ff 65536 = pushbutton) cuja aparência normal é a foto.
    { corpo: '<< /Type /Annot /Subtype /Widget /FT /Btn /Ff 65536 /T (Foto) /Rect [72 480 192 640] /AP << /N 8 0 R >> >>' },
    { corpo: widget('Nome', 'Ada Ferreira', '[220 725 500 745]') },
    { corpo: widget('PV atual', '18', '[220 695 280 715]') },
    { corpo: widget('PV máximo', '24', '[220 675 280 695]') },
    { corpo: widget('Mana', '5 (12)', '[220 655 300 675]') }
  ]
  return montarPdf(objetos)
}

export const DECIMA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '70-hp-mp-em-ingles.pdf',
    proposito: 'HP/MP com barra e Sanity com o máximo entre parênteses: três barras, e só elas',
    espera: {
      leitor: 'generico',
      nome: 'Mara Voss',
      minimoDeCampos: 4,
      barras: ['HP 27/31', 'MP 12/20', 'Sanity 45/60']
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('CHARACTER SHEET', 770),
          linha('Name: Mara Voss', 745),
          linha('HP: 27/31', 720),
          linha('MP: 12/20', 705),
          linha('Sanity: 45 (60)', 690),
          linha('Level: 4', 675)
        ]
      })
  },
  {
    arquivo: '71-vida-de-quarenta.pdf',
    proposito: '"12 de 40", "Atual"/"Máx" abreviados, e um número solto com nome vital — quatro barras',
    espera: {
      leitor: 'generico',
      nome: 'Tomás Rocha',
      minimoDeCampos: 5,
      barras: ['Vida 12/40', 'Energia 3/10', 'Sanidade 30/40', 'Fôlego 6/6']
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('FICHA CASEIRA', 770),
          linha('Nome: Tomás Rocha', 745),
          linha('Vida: 12 de 40', 720),
          linha('Energia: 3 de 10', 705),
          linha('Sanidade Atual: 30', 690),
          linha('Sanidade Máx: 40', 675),
          linha('Fôlego: 6', 660),
          linha('Defesa: 14', 645)
        ]
      })
  },
  {
    arquivo: '72-campos-hp-current-max.pdf',
    proposito: 'campos de formulário "HP Current"/"HP Max" em inglês, com o rótulo no nome do campo',
    espera: {
      leitor: 'generico',
      minimoDeCampos: 2,
      barras: ['HP 9/14']
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [linha('HP Current', 705, 72), linha('HP Max', 675, 72)],
        widgets: [widget('HP Current', '9', '[200 700 260 720]'), widget('HP Max', '14', '[200 670 260 690]')]
      })
  },
  {
    arquivo: '73-foto-no-campo.pdf',
    proposito: 'a FOTO num botão de imagem e um logo maior na página: as barras saem dos campos; o retrato é assunto do harness',
    espera: {
      leitor: 'generico',
      nome: 'Ada Ferreira',
      minimoDeCampos: 3,
      barras: ['PV 18/24', 'Mana 5/12']
    },
    bytes: fichaComFotoNoCampo
  }
]
