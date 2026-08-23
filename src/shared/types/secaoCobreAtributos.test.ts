import { describe, expect, it } from 'vitest'
import { secaoCobreAtributos, blockForGroup } from './sheetBlocks'
// @ts-expect-error — o gerador dos quinze personagens é JS puro (roda também pela linha de comando).
import { QUINZE_PERFIS } from '../../../scripts/quinzePerfis.mjs'

/**
 * QUANDO O BLOCO LIVRE DE ATRIBUTOS SOBRA — e quando ele é a segunda caixa pedindo a mesma coisa.
 *
 * A ficha desenha os atributos importados como quadro de valores (número em caixa, que é como ficha
 * de RPG mostra atributo) e, embaixo, os blocos livres de texto. Se a seção importada JÁ é o quadro
 * de atributos, o bloco livre não aparece — senão a tela tem dois lugares chamados a mesma coisa e
 * ninguém sabe onde escrever.
 *
 * A regra reconhecia só a palavra "atributo". Medido com as quinze fichas de quinze sistemas
 * (`scripts/quinzePerfis.mjs`): cinco delas chamam a mesma coisa de "Características" (Call of
 * Cthulhu, 3D&T, Star Wars FFG) ou "Estatísticas" (Cyberpunk RED, Kids on Bikes), e mostravam o
 * quadro certo com um "Atributos" vazio logo abaixo.
 */
describe('a seção já é o quadro de atributos?', () => {
  it('reconhece as palavras que os sistemas usam pra dizer atributo', () => {
    for (const titulo of [
      'Atributos',
      'Attributes',
      'Características',
      'Caracteristicas',
      'Characteristics',
      'Estatísticas',
      'Estatisticas',
      'Stats',
      'Stat'
    ]) {
      expect(secaoCobreAtributos(titulo), titulo).toBe(true)
    }
  })

  it('NÃO reconhece seção que é outra coisa', () => {
    for (const titulo of [
      'Identificação',
      'Recursos',
      'Corpo',
      'Perícias',
      'Proficiências',
      'Inventário',
      'Aspectos',
      'Rituais',
      'Vitae',
      'Equipamento',
      // "Características de classe" em D&D são HABILIDADES, e vão pro bloco delas — mas o nome
      // sozinho é ambíguo, e aqui a decisão é do título inteiro. Este caso fica documentado como o
      // preço aceito: uma ficha que chame as habilidades de "Características" perde o bloco livre
      // de atributos, e continua com o de habilidades, que é onde elas caem.
      'Defesa',
      'Combate'
    ]) {
      expect(secaoCobreAtributos(titulo), titulo).toBe(false)
    }
  })

  /**
   * O teste que só existe porque o material existe: percorre as quinze fichas e cobra que TODA seção
   * que faz papel de atributo seja reconhecida. Se alguém acrescentar um décimo sexto sistema com
   * outra palavra, é aqui que aparece.
   */
  it('cobre o quadro de atributos das quinze fichas de teste', () => {
    const perfis = QUINZE_PERFIS as { name: string; notes: { sections: { title: string; fields: unknown[] }[] } }[]
    /** A seção que tem cara de atributo: valores curtos, muitos campos, e é a segunda ou terceira. */
    const semCobertura: string[] = []

    for (const perfil of perfis) {
      const secoes = perfil.notes.sections ?? []
      const quadro = secoes.find((s) =>
        /atributo|caracter[íi]stica|estat[íi]stica|stats?/i.test(s.title)
      )
      if (!quadro) continue
      if (!secaoCobreAtributos(quadro.title)) semCobertura.push(`${perfil.name}: ${quadro.title}`)
    }

    expect(semCobertura).toEqual([])
  })

  it('não atrapalha o mapeamento de bloco das outras seções', () => {
    // `secaoCobreAtributos` decide só sobre o bloco de atributos; quem manda no resto continua sendo
    // `blockForGroup`, e atributo continua NÃO tendo bloco de texto (ele é quadro de valores).
    expect(blockForGroup('Atributos')).toBeNull()
    expect(blockForGroup('Características')).toBeNull()
    expect(blockForGroup('Habilidades')).toBe('abilities')
    expect(blockForGroup('Inventário')).toBe('inventory')
  })
})
