import type { FichaDeTeste } from './corpusDePdfs'
import { pdfDeUmaPagina, pdfDeVariasPaginas, widget } from './pdfDeMentira'

/**
 * A NONA LEVA: "qualquer PDF" — os arquivos que gente de verdade vai arrastar pro importador SEM
 * ser ficha de RPG, agora que o beta vai pros testadores. Pedido do usuário: "que seja fácil e
 * qualquer pdf seja lido e colocado".
 *
 * O contrato aqui não é extrair personagem de recibo — é o app nunca travar, nunca inventar, e
 * sempre dizer a verdade: o que tem rótulo legível entra como campo (mesmo que seja "Total: R$
 * 1.234,56" — a pessoa vê na conferência e desmarca), número que PARECE dado não vira preset, e
 * nome de personagem nunca sai de uma frase nem de um título.
 */

function linha(texto: string, y: number, x = 72): { texto: string; x: number; y: number } {
  return { texto, x, y }
}

export const NONA_LEVA: FichaDeTeste[] = [
  {
    arquivo: '64-recibo-de-compra.pdf',
    proposito: 'um RECIBO arrastado por engano: os pares rótulo/valor entram honestos, dinheiro e data não viram rolagem',
    espera: {
      leitor: 'generico',
      minimoDeCampos: 3,
      campos: [
        { label: 'Total', value: 'R$ 1.234,56' },
        { label: 'Pedido', value: '48291' }
      ],
      proibidos: [/preset/i]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('ARMAZÉM DO ZÉ — COMPROVANTE', 770),
          linha('Pedido: 48291', 740),
          linha('Data: 12/08/2026', 725),
          linha('Cliente: Renato', 710),
          linha('2x Refrigerante lata — R$ 12,00', 680),
          linha('1x Pão de forma — R$ 8,50', 665),
          linha('Total: R$ 1.234,56', 635),
          linha('Obrigado pela preferência. Volte sempre.', 600)
        ]
      })
  },
  {
    arquivo: '65-curriculo.pdf',
    proposito: 'um CURRÍCULO: texto corrido com "Nome:" no meio — o nome entra (é o que está escrito), e nenhuma frase vira preset',
    espera: {
      leitor: 'generico',
      nome: 'Joana Ferrete',
      minimoDeCampos: 3,
      campos: [{ label: 'Telefone', value: '(11) 98888-7777' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('CURRICULUM VITAE', 770),
          linha('Nome: Joana Ferrete', 745),
          linha('Telefone: (11) 98888-7777', 730),
          linha('Cidade: Guarulhos', 715),
          linha('Experiência profissional', 685),
          linha('Analista de estoque no Armazém do Zé, de 2019 a 2024, responsável pelo', 665),
          linha('controle de entrada e saída de mercadorias e pela conferência semanal.', 650),
          linha('Formação: técnico em logística.', 620)
        ]
      })
  },
  {
    arquivo: '66-slides-de-apresentacao.pdf',
    proposito: 'SLIDES exportados: cinco páginas com meia dúzia de frases grandes — o TÍTULO não vira nome; sobra o palpite honesto do arquivo',
    /**
     * "RESULTADOS DO TRIMESTRE" era proposto como personagem; agora título em caixa alta de várias
     * palavras não é nome. O que sobra é o palpite pelo nome do ARQUIVO — o contrato do genérico
     * quando leu conteúdo: é o único indício, o campo é editável, e errar custa uma correção. E os "Meta 1: crescer 12%" são pares rótulo/valor DE VERDADE — entram na conferência (quatro campos) e a pessoa desmarca.
     */
    espera: { leitor: 'generico', nome: '66-slides-de-apresentacao', maximoDeCampos: 6 },
    bytes: () =>
      pdfDeVariasPaginas(
        Array.from({ length: 5 }, (_, i) => ({
          linhas:
            i === 0
              ? [linha('RESULTADOS DO TRIMESTRE', 500, 150), linha('Reunião de equipe', 460, 150)]
              : [linha(`Meta ${i}: crescer 12%`, 500, 150), linha('Discussão em grupo', 460, 150)]
        }))
      )
  },
  {
    arquivo: '67-formulario-de-inscricao.pdf',
    proposito: 'um FORMULÁRIO de outro assunto (inscrição de curso): os campos entram como estão — a conferência é onde a pessoa desiste',
    espera: {
      leitor: 'generico',
      nome: 'Célio Antunes',
      minimoDeCampos: 4,
      campos: [{ label: 'CURSO', value: 'Marcenaria básica' }]
    },
    bytes: () =>
      pdfDeUmaPagina({
        widgets: [
          widget('Nome', 'Célio Antunes', '[180 740 380 758]'),
          widget('CPF', '123.456.789-00', '[180 714 380 732]'),
          widget('Curso', 'Marcenaria básica', '[180 688 380 706]'),
          widget('Turno', 'Noite', '[180 662 380 680]')
        ],
        linhas: [
          linha('FICHA DE INSCRIÇÃO', 770, 100),
          linha('NOME', 743, 100),
          linha('CPF', 717, 100),
          linha('CURSO', 691, 100),
          linha('TURNO', 665, 100)
        ]
      })
  },
  {
    arquivo: '68-paginas-mistas.pdf',
    proposito: 'página de formulário + página digitalizada SEM texto no mesmo arquivo: o que dá pra ler entra, o resto não atrapalha',
    espera: {
      leitor: 'generico',
      nome: 'Dita',
      minimoDeCampos: 2,
      campos: [{ label: 'OFÍCIO', value: 'Ferreira' }]
    },
    bytes: () =>
      pdfDeVariasPaginas([
        {
          widgets: [widget('Nome', 'Dita', '[180 740 380 758]'), widget('Oficio', 'Ferreira', '[180 714 380 732]')],
          linhas: [linha('NOME', 743, 100), linha('OFÍCIO', 717, 100)]
        },
        // A "digitalização": página sem nenhum texto e sem nenhum campo.
        {}
      ])
  },
  {
    arquivo: '69-codigo-que-parece-dado.pdf',
    proposito: 'código de produto com cara de dado ("SKU 2d20-X"): a forma de arma exige o dado FECHANDO a linha — nada vira preset',
    espera: {
      leitor: 'generico',
      nome: 'Almoxarifado',
      minimoDeCampos: 2,
      // Nenhum preset: "2d20-X" tem sufixo colado no dado, e "5d4mm" é medida, não rolagem.
      maximoDeCampos: 6
    },
    bytes: () =>
      pdfDeUmaPagina({
        linhas: [
          linha('Nome: Almoxarifado', 760),
          linha('Prateleira: B-7', 740),
          linha('SKU 2d20-X — parafuso sextavado', 700),
          linha('Broca 5d4mm aço rápido', 680),
          linha('Etiqueta: 1d6/2026', 660)
        ]
      })
  }
]
