import { describe, expect, it } from 'vitest'
import { escolherDestino, nomeDoArquivo } from './destinoDaImportacao'

/**
 * A importação sem janela (02/09/2026) decide sozinha o nome e o destino. Estas são as regras, uma a
 * uma — e a ordem entre elas, que é o que importa quando duas valem ao mesmo tempo.
 */
const PERFIS = [
  { id: 'a', name: 'Kieran Vance' },
  { id: 'b', name: 'Matias' },
  { id: 'novo', name: '' }
]

describe('o destino da ficha importada', () => {
  it('a ficha do personagem aberto está vazia: preenche ele, com o nome que o PDF trouxe', () => {
    const destino = escolherDestino({ nomeLido: 'Aurora', fileName: 'ficha.pdf', perfis: PERFIS, ativo: PERFIS[2], fichaDoAtivoVazia: true })
    expect(destino).toEqual({ targetProfileId: 'novo', characterName: 'Aurora', atualizou: false })
  })

  it('ficha vazia, personagem sem nome e PDF sem nome: o nome do arquivo entra', () => {
    const destino = escolherDestino({ nomeLido: '  ', fileName: 'Ficha_Oblivio - Colorida.pdf', perfis: PERFIS, ativo: PERFIS[2], fichaDoAtivoVazia: true })
    expect(destino.characterName).toBe('Ficha Oblivio - Colorida')
    expect(destino.targetProfileId).toBe('novo')
  })

  it('ficha vazia num personagem que JÁ tem nome e PDF sem nome: o nome dele fica', () => {
    const destino = escolherDestino({ nomeLido: '', fileName: 'x.pdf', perfis: PERFIS, ativo: PERFIS[1], fichaDoAtivoVazia: true })
    expect(destino).toEqual({ targetProfileId: 'b', characterName: 'Matias', atualizou: false })
  })

  it('a ficha vazia ganha do nome repetido: preencher o aberto, e não atualizar o homônimo', () => {
    // Quem clicou em importar na ficha vazia quer ELA preenchida; o Kieran de antes fica como está.
    const destino = escolherDestino({ nomeLido: 'kieran vance', fileName: 'x.pdf', perfis: PERFIS, ativo: PERFIS[2], fichaDoAtivoVazia: true })
    expect(destino.targetProfileId).toBe('novo')
  })

  it('mesmo nome que um personagem existente (sem diferenciar maiúsculas): atualiza esse', () => {
    const destino = escolherDestino({ nomeLido: 'KIERAN VANCE ', fileName: 'x.pdf', perfis: PERFIS, ativo: PERFIS[1], fichaDoAtivoVazia: false })
    expect(destino).toEqual({ targetProfileId: 'a', characterName: 'KIERAN VANCE', atualizou: true })
  })

  it('nome novo com o aberto já preenchido: personagem novo', () => {
    const destino = escolherDestino({ nomeLido: 'Vincenzo', fileName: 'x.pdf', perfis: PERFIS, ativo: PERFIS[1], fichaDoAtivoVazia: false })
    expect(destino).toEqual({ characterName: 'Vincenzo', atualizou: false })
  })

  it('sem nome e sem ficha vazia: novo, com o nome do arquivo (nunca um personagem sem nome)', () => {
    const destino = escolherDestino({ nomeLido: '', fileName: 'ficha vincenzo.pdf', perfis: PERFIS, ativo: PERFIS[1], fichaDoAtivoVazia: false })
    expect(destino).toEqual({ characterName: 'ficha vincenzo', atualizou: false })
  })
})

describe('o nome do arquivo como nome', () => {
  it('tira a extensão e os sublinhados; espaços repetidos viram um', () => {
    expect(nomeDoArquivo('Ordem_Paranormal__Matais.PDF')).toBe('Ordem Paranormal Matais')
    expect(nomeDoArquivo('  ficha   Go.pdf ')).toBe('ficha Go')
  })
})
