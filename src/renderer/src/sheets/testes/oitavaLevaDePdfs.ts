import { deflateSync } from 'zlib'
import type { FichaDeTeste } from './corpusDePdfs'
import { montarPdf, pdfDeUmaPagina, pdfDeVariasPaginas, widget, type ObjetoPdf } from './pdfDeMentira'

/**
 * A OITAVA LEVA: estrutura de PDF que TODO arquivo real tem e que nenhuma leva exercitava.
 *
 * O corpus inteiro até aqui escreve fluxos de conteúdo SEM compressão, porque é assim que se
 * fabrica PDF legível a olho — mas nenhum PDF de verdade é assim: exportador comprime tudo com
 * FlateDecode. O caso 56 fecha esse buraco. Os outros são vizinhos do mesmo bairro: campo de
 * ASSINATURA DIGITAL (que não é texto de ninguém), arquivo ANEXADO dentro do PDF (que o spec manda
 * ignorar), texto desenhado LETRA POR LETRA (que não pode virar rótulo de uma letra só), a ficha
 * de D&D TRADUZIDA (nomes de campo em português caem no genérico com os rótulos impressos), valor
 * com tab e CRLF, duas fichas no mesmo arquivo e os números que PARECEM rolagem e não são
 * (dinheiro, data, peso).
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

function escapar(texto: string): string {
  return texto.replace(/[()\\]/g, (c) => `\\${c}`)
}

/** O mesmo desenho de texto de `fluxoDeTexto`, comprimido como todo exportador real comprime. */
function fluxoComprimido(linhas: { texto: string; x: number; y: number }[]): string {
  const corpo = linhas
    .map((l) => `BT /F1 12 Tf ${l.x} ${l.y} Td (${escapar(l.texto)}) Tj ET`)
    .join('\n')
  const comprimido = deflateSync(Buffer.from(corpo, 'latin1')).toString('latin1')
  return `<< /Length ${comprimido.length} /Filter /FlateDecode >>\nstream\n${comprimido}\nendstream`
}

export const OITAVA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '56-conteudo-comprimido.pdf',
    proposito: 'fluxo de conteúdo com FlateDecode — como TODO PDF real é gravado; o corpus inteiro era sem compressão',
    espera: {
      leitor: 'generico',
      nome: 'Zilá Furtado',
      minimoDeCampos: 2,
      campos: [
        { label: 'NOME', value: 'Zilá Furtado' },
        { label: 'PROFISSÃO', value: 'Cartógrafa' }
      ]
    },
    bytes: () => {
      const linhas = [linha('NOME', 764, 100), linha('PROFISSÃO', 734, 100)]
      const objetos: ObjetoPdf[] = [
        { corpo: '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [6 0 R 7 0 R] >> >>' },
        { corpo: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        {
          corpo:
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
            '/Resources << /Font << /F1 5 0 R >> >> /Annots [6 0 R 7 0 R] >>'
        },
        { corpo: fluxoComprimido(linhas) },
        { corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
        { corpo: widget('Nome', 'Zilá Furtado', '[100 760 300 780]') },
        { corpo: widget('Profissao', 'Cartógrafa', '[100 730 300 750]') }
      ]
      return montarPdf(objetos)
    }
  },
  {
    arquivo: '57-texto-letra-por-letra.pdf',
    proposito: 'rótulo desenhado LETRA POR LETRA: o extrator remonta ("F O R Ç A") e é ELE que rotula — nunca uma letra solta',
    /**
     * Diagramador que "espaça" o título desenha cada letra num comando próprio. MEDIDO com o dump:
     * o pdf.js remonta os cinco comandos da mesma linha num fragmento só, "F O R Ç A" com os
     * espaços — e esse fragmento, legível, é o rótulo do campo. O que o teste cobra é a fronteira:
     * o rótulo é o texto remontado como está impresso, e nenhuma letra AVULSA vira rótulo de nada
     * (a guarda de uma letra em `ehRotulo`).
     */
    espera: {
      leitor: 'generico',
      nome: 'Baltazar',
      campos: [{ label: 'F O R Ç A', value: '3' }],
      semRotulo: /^[A-ZÇ]$/
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Baltazar', '[100 760 300 780]'),
          widget('Forca', '3', '[100 700 140 720]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          // "FORÇA" espaçado: F O R Ç A, cada letra um fragmento próprio.
          ...['F', 'O', 'R', 'Ç', 'A'].map((letra, i) => linha(letra, 704, 44 + i * 11))
        ]
      })
  },
  {
    arquivo: '58-dnd5e-traduzida.pdf',
    proposito: 'a ficha de D&D TRADUZIDA: nomes de campo em português não são os do modelo oficial — cai no genérico, com os rótulos impressos e o preset do dano',
    espera: {
      leitor: 'generico',
      nome: 'Aldemira',
      minimoDeCampos: 6,
      minimoDePresets: 1,
      campos: [
        { label: 'FOR', value: '16' },
        { label: 'CA', value: '17' }
      ]
    },
    bytes: () => {
      const campos: [string, string][] = [
        ['Nome do Personagem', 'Aldemira'],
        ['Classe e Nível', 'Guerreira 3'],
        ['FOR', '16'],
        ['DES', '12'],
        ['CA', '17'],
        ['PV Máximo', '28'],
        ['Arma 1', 'Machado grande'],
        ['Arma 1 Dano', '1d12+3']
      ]
      return pdfDeUmaPagina({
        widgets: campos.map(([nome, valor], i) => {
          const y = 740 - i * 26
          return widget(nome, valor, `[180 ${y} 340 ${y + 18}]`)
        }),
        linhas: campos.map(([nome], i) => linha(nome.toUpperCase(), 743 - i * 26, 100))
      })
    }
  },
  {
    arquivo: '59-assinatura-digital.pdf',
    proposito: 'campo de ASSINATURA DIGITAL não é texto de ninguém: não entra como campo nem vira lixo',
    espera: {
      leitor: 'generico',
      nome: 'Petronila',
      maximoDeCampos: 1,
      campos: [{ label: 'NOME', value: 'Petronila' }],
      proibidos: [/Assinatura|\[object/i]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Petronila', '[100 760 300 780]'),
          // O /V de assinatura é um DICIONÁRIO, não texto — é isso que não pode atravessar.
          `<< /Type /Annot /Subtype /Widget /FT /Sig /T (Assinatura do Mestre) /V << /Type /Sig /Name (Mestre) >> /Rect [100 700 300 740] >>`
        ],
        linhas: [linha('NOME', 764, 100)]
      })
  },
  {
    arquivo: '60-anexo-embutido.pdf',
    proposito: 'PDF com arquivo ANEXADO dentro: o anexo é ignorado (Stage 0 do spec) e a ficha é lida normalmente',
    espera: {
      leitor: 'generico',
      nome: 'Gervásio',
      minimoDeCampos: 1,
      campos: [{ label: 'NOME', value: 'Gervásio' }],
      proibidos: [/anexo\.txt|conteudo do anexo/i]
    },
    bytes: () => {
      const anexo = 'conteudo do anexo que nunca deve virar ficha'
      const linhas = [linha('NOME', 764, 100)]
      const corpo = linhas
        .map((l) => `BT /F1 12 Tf ${l.x} ${l.y} Td (${escapar(l.texto)}) Tj ET`)
        .join('\n')
      const objetos: ObjetoPdf[] = [
        {
          corpo:
            '<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [6 0 R] >> ' +
            '/Names << /EmbeddedFiles << /Names [(anexo.txt) 7 0 R] >> >> >>'
        },
        { corpo: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
        {
          corpo:
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
            '/Resources << /Font << /F1 5 0 R >> >> /Annots [6 0 R] >>'
        },
        { corpo: `<< /Length ${Buffer.byteLength(corpo, 'latin1')} >>\nstream\n${corpo}\nendstream` },
        { corpo: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
        { corpo: widget('Nome', 'Gervásio', '[100 760 300 780]') },
        { corpo: `<< /Type /Filespec /F (anexo.txt) /EF << /F 8 0 R >> >>` },
        { corpo: `<< /Type /EmbeddedFile /Length ${anexo.length} >>\nstream\n${anexo}\nendstream` }
      ]
      return montarPdf(objetos)
    }
  },
  {
    arquivo: '61-valor-com-tab-e-crlf.pdf',
    proposito: 'valor com CRLF e tab dentro: o espaço interno colapsa e o texto chega numa linha limpa',
    espera: {
      leitor: 'generico',
      nome: 'Firmino',
      campos: [{ label: 'NOTAS', value: 'primeira linha segunda linha fim' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Firmino', '[100 760 300 780]'),
          widget('Notas', 'primeira linha\\r\\nsegunda linha\\tfim', '[100 700 400 740]')
        ],
        linhas: [linha('NOME', 764, 100), linha('NOTAS', 742, 100)]
      })
  },
  {
    arquivo: '62-duas-fichas-no-mesmo-pdf.pdf',
    proposito: 'DUAS fichas no mesmo arquivo (frente e verso de dupla): os campos das duas entram, e o nome proposto é o da primeira',
    espera: {
      leitor: 'generico',
      nome: 'Irena',
      minimoDeCampos: 4,
      campos: [
        { label: 'PROFISSÃO', value: 'Vidente' },
        { label: 'OFÍCIO', value: 'Coveiro' }
      ]
    },
    bytes: () =>
      pdfDeVariasPaginas([
        {
          widgets: [
            widget('Nome', 'Irena', '[100 760 300 780]'),
            widget('Profissao', 'Vidente', '[100 730 300 750]')
          ],
          linhas: [linha('NOME', 764, 100), linha('PROFISSÃO', 734, 100)]
        },
        {
          widgets: [
            widget('Nome_2', 'Otto', '[100 760 300 780]'),
            widget('Oficio', 'Coveiro', '[100 730 300 750]')
          ],
          linhas: [linha('NOME', 764, 100), linha('OFÍCIO', 734, 100)]
        }
      ])
  },
  {
    arquivo: '63-dinheiro-datas-e-medidas.pdf',
    proposito: 'número que PARECE rolagem e não é: dinheiro, data e peso entram como campos, e preset nenhum nasce deles',
    espera: {
      leitor: 'generico',
      nome: 'Leontina',
      minimoDeCampos: 4,
      maximoDeCampos: 5,
      campos: [
        { label: 'FORTUNA', value: '3.000 T$' },
        { label: 'NASCIMENTO', value: '12/03/1899' }
      ]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Leontina', '[100 760 300 780]'),
          widget('Fortuna', '3.000 T$', '[100 730 300 750]'),
          widget('Nascimento', '12/03/1899', '[100 700 300 720]'),
          widget('Carga', '12,5 kg', '[100 670 300 690]'),
          widget('Altura', '1,68 m', '[100 640 300 660]')
        ],
        linhas: [
          linha('NOME', 764, 100),
          linha('FORTUNA', 734, 100),
          linha('NASCIMENTO', 704, 100),
          linha('CARGA', 674, 100),
          linha('ALTURA', 644, 100)
        ]
      })
  }
]
