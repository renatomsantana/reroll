import { describe, expect, it } from 'vitest'
import { MAXIMO_DE_PRESETS_POR_PERSONAGEM } from '../diceRegistry'
import { normalizeNotes } from '../types/notes'
import { sanearAparencia } from '../types/aparencia'
import { htmlDoPacote } from './htmlDoPacote'
import {
  FORMATO_DO_PACOTE,
  VERSAO_DO_PACOTE,
  extrairPacoteDoTexto,
  lerPacote,
  montarPacote,
  nomeDoArquivoDoPacote,
  serializarPacote
} from './pacoteDePersonagem'

/**
 * O PACOTE DE PERSONAGEM vai e volta inteiro: o que sai no HTML é o que entra de novo — ficha,
 * presets com a estrela, foto, aparência. E o HTML é uma página inerte: o que vem do personagem é
 * texto nela, nunca marcação.
 */
const FOTO = 'data:image/png;base64,iVBORw0KGgo='

function pacoteDoMatias() {
  return montarPacote({
    perfil: { name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: FOTO },
    ficha: normalizeNotes({
      characterName: 'Matias Oliveira',
      inventory: 'Faca de mato\nLanterna',
      sections: [{ id: 's1', title: 'Atributos', fields: [{ id: 'c1', label: 'Agilidade', value: '3', roll: 'd20' }] }],
      recursos: [{ id: 'r1', nome: 'PV', atual: 12, maximo: 40 }],
      pages: [{ id: 'd1', title: '', text: 'Primeira missão', createdAt: 1_700_000_000_000 }],
      condicoes: [{ id: 'k1', nome: 'Machucado', ativa: true }]
    }),
    presets: [
      { name: 'Faca', expression: { groups: [{ sides: 20, count: 2 }], modifiers: [{ type: 'flat', value: 5 }] }, favorito: 0 },
      { name: 'Ritual', formula: '3d6 + 2', icon: '🔮' }
    ],
    aparencia: { diceBodyColor: '#ff0000', trayShape: 'circle', backgroundImage: null, diceColorOverrides: { 20: { bodyColor: '#000', numberColor: '#fff' } } },
    versaoDoApp: '1.1.0-beta.4',
    agora: new Date('2026-08-25T12:00:00Z')
  })
}

describe('o pacote de personagem', () => {
  it('vai e volta inteiro pelo HTML', () => {
    const original = pacoteDoMatias()
    const html = htmlDoPacote(original, 'pt-BR')
    const lido = lerPacote(extrairPacoteDoTexto(html))

    expect(lido.formato).toBe(FORMATO_DO_PACOTE)
    expect(lido.versao).toBe(VERSAO_DO_PACOTE)
    expect(lido.app).toBe('1.1.0-beta.4')
    expect(lido.personagem).toEqual({ name: 'Matias Oliveira', system: 'Ordem Paranormal', photo: FOTO })
    expect(lido.ficha).toEqual(original.ficha)
    // A estrela vai junto — é a mesma pessoa levando o personagem dela.
    expect(lido.presets).toEqual(original.presets)
    expect(lido.presets[0].favorito).toBe(0)
    expect(lido.aparencia).toEqual(original.aparencia)
  })

  it('escreve um exemplo pra olhar no navegador (ESCREVER_PACOTE=1)', async () => {
    // Mesmo esquema de `ESCREVER_PDFS`: o arquivo só nasce quando se pede, e vai pra pasta de testes.
    if (process.env.ESCREVER_PACOTE !== '1') return
    const { promises: fs } = await import('fs')
    const { join } = await import('path')
    const pasta = join(process.cwd(), 'Fichas RPG', 'testes')
    await fs.mkdir(pasta, { recursive: true })
    await fs.writeFile(join(pasta, 'Matias Oliveira - Reroll.html'), htmlDoPacote(pacoteDoMatias(), 'pt-BR'), 'utf-8')
  })

  it('o JSON puro também abre (alguém salvou só o bloco)', () => {
    const original = pacoteDoMatias()
    const lido = lerPacote(extrairPacoteDoTexto(`  ${JSON.stringify(original)}`))
    expect(lido.personagem.name).toBe('Matias Oliveira')
  })

  it('o HTML mostra a ficha e não roda nada', () => {
    const html = htmlDoPacote(pacoteDoMatias(), 'pt-BR')
    expect(html).toContain('<h1>Matias Oliveira</h1>')
    expect(html).toContain('Sistema: Ordem Paranormal')
    expect(html).toContain('<dt>Agilidade</dt><dd>3</dd>')
    expect(html).toContain('<span>PV</span><b>12 / 40</b>')
    expect(html).toContain('Faca de mato\nLanterna')
    expect(html).toContain('Primeira missão')
    expect(html).toContain('<em>Machucado</em>')
    // Presets: a fórmula escrita, e a estrela no favorito.
    expect(html).toContain('<code>2d20 + 5</code>')
    expect(html).toContain('<code>3d6 + 2</code>')
    expect(html).toContain('★')
    expect(html).toContain(`src="${FOTO}"`)
    // Inglês troca os rótulos, não o conteúdo.
    expect(htmlDoPacote(pacoteDoMatias(), 'en-US')).toContain('System: Ordem Paranormal')
    // Só UM script, o do JSON, e nada de fora.
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html).toContain('<script id="reroll-personagem" type="application/json">')
    expect(html).not.toMatch(/<script src|<link |https?:\/\//)
  })

  it('texto do personagem vira texto na página, nunca marcação', () => {
    const pacote = pacoteDoMatias()
    pacote.personagem.name = '<img src=x onerror="alert(1)">'
    pacote.ficha.backstory = 'Ele disse: <b>"nunca"</b> & foi'
    pacote.presets[0].name = 'Ataque</script><script>alert(2)</script>'
    const html = htmlDoPacote(pacote, 'pt-BR')

    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('&lt;b&gt;&quot;nunca&quot;&lt;/b&gt; &amp; foi')
    // O `</script>` dentro do JSON embutido não fecha o bloco: o JSON escapa o `<`.
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(serializarPacote(pacote)).not.toContain('</script>')
    // E ainda assim volta igual.
    expect(lerPacote(extrairPacoteDoTexto(html)).presets[0].name).toBe('Ataque</script><script>alert(2)</script>')
    expect(lerPacote(extrairPacoteDoTexto(html)).personagem.name).toBe('<img src=x onerror="alert(1)">')
  })

  it('recusa o que não é pacote, com o motivo', () => {
    expect(() => extrairPacoteDoTexto('<html><body>oi</body></html>')).toThrow(/não é um personagem exportado/)
    expect(() => lerPacote(null)).toThrow(/não é um personagem exportado/)
    expect(() => lerPacote([1, 2])).toThrow(/não é um personagem exportado/)
    expect(() => lerPacote({ formato: 'outra-coisa', versao: 1 })).toThrow(/não é um personagem exportado/)
    expect(() => lerPacote({ formato: FORMATO_DO_PACOTE, versao: 'x' })).toThrow(/não é um personagem exportado/)
    expect(() => lerPacote({ formato: FORMATO_DO_PACOTE, versao: VERSAO_DO_PACOTE + 1, ficha: {} })).toThrow(/versão mais nova/)
    expect(() => lerPacote({ formato: FORMATO_DO_PACOTE, versao: 1 })).toThrow(/sem a ficha/)
    expect(() =>
      lerPacote({ formato: FORMATO_DO_PACOTE, versao: 1, ficha: {}, presets: Array.from({ length: MAXIMO_DE_PRESETS_POR_PERSONAGEM + 1 }, () => ({ name: 'x' })) })
    ).toThrow(new RegExp(`${MAXIMO_DE_PRESETS_POR_PERSONAGEM + 1} presets`))
  })

  it('campo solto torto é corrigido, não recusado', () => {
    const lido = lerPacote({
      formato: FORMATO_DO_PACOTE,
      versao: 1,
      personagem: { name: 42, system: 'x'.repeat(300), photo: 'https://fora.com/foto.png' },
      ficha: { characterName: 'Sem sobrenome', pages: 'não é lista', recursos: [{ nome: 'PV', atual: 'a', maximo: 10 }] },
      presets: [7, { name: 'Ok', formula: '1d20', favorito: 'primeiro' }, { name: 'Estrela', formula: '1d4', favorito: 2 }],
      aparencia: { diceBodyColor: '#fff', trayShape: 42, cor: 'não existe', backgroundImage: 'https://fora.com/x.png' }
    })
    expect(lido.personagem).toEqual({ name: '', system: 'x'.repeat(200), photo: null })
    expect(lido.ficha.characterName).toBe('Sem sobrenome')
    expect(lido.ficha.pages).toHaveLength(1)
    expect(lido.ficha.recursos.map((r) => [r.nome, r.atual, r.maximo])).toEqual([['PV', 10, 10]])
    expect(lido.presets).toEqual([{ name: 'Ok', formula: '1d20' }, { name: 'Estrela', formula: '1d4', favorito: 2 }])
    expect(lido.aparencia).toEqual({ diceBodyColor: '#fff' })
  })

  it('a aparência: só as chaves da lista, cada uma na forma certa', () => {
    expect(sanearAparencia(null)).toBeNull()
    expect(sanearAparencia({ language: 'en-US', fontId: 'impact' })).toBeNull()
    expect(sanearAparencia({ diceBodyColor: 'x'.repeat(65) })).toBeNull()
    expect(
      sanearAparencia({
        wallColor: '#6b4a2a',
        backgroundImage: 'data:image/png;base64,AAAA',
        diceColorOverrides: { 20: { bodyColor: '#000', numberColor: '#fff' }, abc: { bodyColor: '#1', numberColor: '#2' }, 6: { bodyColor: 1 } },
        launchMode: 'tower'
      })
    ).toEqual({
      wallColor: '#6b4a2a',
      backgroundImage: 'data:image/png;base64,AAAA',
      diceColorOverrides: { 20: { bodyColor: '#000', numberColor: '#fff' } },
      launchMode: 'tower'
    })
  })

  it('o nome do arquivo é o nome do personagem, limpo', () => {
    expect(nomeDoArquivoDoPacote('Matias Oliveira')).toBe('Matias Oliveira - Reroll.html')
    expect(nomeDoArquivoDoPacote('  Dr. "Who"?: a/b\\c  ')).toBe('Dr. Who a b c - Reroll.html')
    expect(nomeDoArquivoDoPacote('')).toBe('Personagem - Reroll.html')
    expect(nomeDoArquivoDoPacote('x'.repeat(200))).toHaveLength(80 + ' - Reroll.html'.length)
  })
})
