// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampoDeCaderno } from './CampoDeCaderno'

/**
 * CLICAR NUMA PAUTA VAZIA leva o cursor pra ela (pedido dele: "clicar com o mouse onde quiser
 * digitar, não precisar apenas com Enter"), nas anotações e nas caixas da ficha.
 *
 * O jsdom não tem layout, então a geometria é simulada como o Chrome mediria: pauta de 24px, o
 * campo começa no y=100 da janela, sem preenchimento, e o conteúdo ocupa `linhas × 24px` (o
 * `scrollHeight` do campo encolhido). Quem calcula por cima disso é `cliqueNaLinha.ts`.
 */
const PAUTA = 24
const TOPO = 100

function simularGeometria(linhasOcupadas: number, preenchimentoTopo = 0) {
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () => ({ lineHeight: `${PAUTA}px`, paddingTop: `${preenchimentoTopo}px`, paddingBottom: '0px' }) as CSSStyleDeclaration
  )
  vi.spyOn(HTMLTextAreaElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: TOPO } as DOMRect)
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(linhasOcupadas * PAUTA + preenchimentoTopo)
}

function Caderno({ inicial, limitar }: { inicial: string; limitar?: (texto: string) => string }) {
  const [texto, setTexto] = useState(inicial)
  return <CampoDeCaderno aria-label="Caderno" value={texto} onChangeText={(novo) => setTexto(limitar ? limitar(novo) : novo)} />
}

const campo = () => screen.getByLabelText<HTMLTextAreaElement>('Caderno')

/** Clique no MEIO da pauta `linha` (contando do zero), já somado o topo do campo. */
const clicarNaPauta = (linha: number, preenchimentoTopo = 0) =>
  fireEvent.click(campo(), { clientY: TOPO + preenchimentoTopo + linha * PAUTA + PAUTA / 2 })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('clicar numa pauta do caderno', () => {
  it('abaixo do texto: acrescenta as quebras até a pauta e põe o cursor lá, com foco', () => {
    render(<Caderno inicial={'primeira linha\nsegunda linha'} />)
    simularGeometria(2)
    clicarNaPauta(5)
    expect(campo().value).toBe('primeira linha\nsegunda linha\n\n\n\n')
    expect(document.activeElement).toBe(campo())
    expect(campo().selectionStart).toBe(campo().value.length)
  })

  it('em cima de texto que existe: não mexe no texto', () => {
    render(<Caderno inicial={'primeira linha\nsegunda linha'} />)
    simularGeometria(2)
    clicarNaPauta(1)
    expect(campo().value).toBe('primeira linha\nsegunda linha')
  })

  it('caixa vazia: clicar na terceira pauta deixa duas quebras', () => {
    render(<Caderno inicial="" />)
    simularGeometria(1)
    clicarNaPauta(2)
    expect(campo().value).toBe('\n\n')
  })

  it('o preenchimento de cima da caixa (as da ficha têm 6px) entra na conta da pauta', () => {
    render(<Caderno inicial="Nasceu em Cascavel." />)
    simularGeometria(1, 6)
    clicarNaPauta(4, 6)
    expect(campo().value).toBe('Nasceu em Cascavel.\n\n\n\n')
  })

  it('uma linha comprida que quebra na largura conta como duas pautas: clicar na segunda não acrescenta nada', () => {
    render(<Caderno inicial="uma linha comprida que o navegador quebra em duas" />)
    simularGeometria(2)
    clicarNaPauta(1)
    expect(campo().value).toBe('uma linha comprida que o navegador quebra em duas')
  })

  it('se o dono do texto recusa a mudança (teto), o campo fica como estava', () => {
    render(<Caderno inicial="cheio" limitar={() => 'cheio'} />)
    simularGeometria(1)
    clicarNaPauta(3)
    expect(campo().value).toBe('cheio')
  })

  it('digitar continua passando pelo dono do texto', () => {
    render(<Caderno inicial="" />)
    fireEvent.change(campo(), { target: { value: 'oi' } })
    expect(campo().value).toBe('oi')
  })
})
