import { describe, expect, it } from 'vitest'
import type { PdfSheet, PdfText } from '@shared/types/sheetImport'
import { camposDoTexto } from './camposDoTexto'

/**
 * As duas formas testadas aqui foram MEDIDAS na ficha de Oblivio, comparando a versão em branco com
 * a preenchida do mesmo documento — o que existe só na segunda é, por definição, o que o jogador
 * escreveu. Os textos e as coordenadas abaixo saíram de lá.
 */

function texto(text: string, x: number, y: number, width = text.length * 5): PdfText {
  return { text, page: 1, x, y, width, height: 10 }
}

function ficha(texts: PdfText[]): PdfSheet {
  return { fileName: 'ficha.pdf', pageCount: 1, fields: [], texts }
}

describe('campos tirados do texto impresso — a ficha sem formulário', () => {
  it('lê "Rótulo: valor" quando os dois vêm no mesmo fragmento', () => {
    // Como uma ficha do Google Docs preenchida por quem digita dentro do documento.
    const campos = camposDoTexto(ficha([texto('Nome: Rodrigo Barreto', 108, 680), texto('Papel: Quem Age', 108, 653)]))
    expect(campos).toEqual([
      { label: 'Nome', value: 'Rodrigo Barreto' },
      { label: 'Papel', value: 'Quem Age' }
    ])
  })

  it('lê o valor que está na MESMA LINHA, à direita do rótulo', () => {
    /**
     * O caso que obriga a regra a ser "mesma linha", e não "mais próximo".
     *
     * Na ficha real, "2/10" tem "Representa a" a 12 pontos (o começo da explicação na linha DE CIMA)
     * e "Carne:" a 25 (o rótulo certo, mesma altura). Ganhar por distância pura daria o rótulo
     * errado em todos os dez atributos.
     */
    const campos = camposDoTexto(
      ficha([
        texto('Representa a', 108, 321),
        texto('Carne:', 108, 304, 30),
        texto('2/10', 153, 304)
      ])
    )
    expect(campos).toEqual([{ label: 'Carne', value: '2/10' }])
  })

  it('não inventa valor a partir de palavra solta', () => {
    // O extrator quebra parágrafo em pedaços de uma palavra; sem exigir dígito, cada pedaço viraria
    // o "valor" do rótulo mais próximo.
    const campos = camposDoTexto(ficha([texto('Torso:', 108, 300, 30), texto('habilidade', 150, 300)]))
    expect(campos).toEqual([])
  })

  it('não transforma REGRA impressa em campo', () => {
    /**
     * A ficha de Oblivio traz as regras do sistema junto, e regra usa dois-pontos o tempo todo. O
     * corte é o tamanho do RÓTULO: nome de campo tem poucas palavras, começo de parágrafo não.
     */
    const campos = camposDoTexto(
      ficha([texto('Ao adquirir essa habilidade, escolha um Conhecimento: qualquer um serve', 72, 185)])
    )
    expect(campos).toEqual([])
  })

  it('não devolve o mesmo par duas vezes', () => {
    const campos = camposDoTexto(ficha([texto('Nome: Ada', 10, 100), texto('Nome: Ada', 10, 50)]))
    expect(campos).toHaveLength(1)
  })
})
