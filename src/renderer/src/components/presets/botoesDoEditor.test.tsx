// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Preset } from '@shared/types/preset'
import { MAX_SIMULTANEOUS_DICE } from '@shared/diceRegistry'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { PresetEditorModal } from './PresetEditorModal'

/**
 * OS BOTÕES DO EDITOR DE PRESET, um por um — pedido do usuário ("os botões dos presets têm uns
 * bugs, checa todos").
 *
 * Cada teste aqui aperta um botão e confere o que APARECE NA TELA depois, e não o estado interno:
 * os dois defeitos que este arquivo encontrou eram exatamente disso — o número mostrado e o número
 * guardado tinham se separado, e só a tela conta pra quem está usando.
 */

/**
 * O editor lê as traduções, que vêm das Preferências, que por sua vez vivem dentro do personagem
 * ativo — daí a pilha de dois provedores. O preload não existe aqui, então o `window.api` é um
 * dublê com um personagem só; nada nestes testes toca em disco.
 */
const apiFalsa = {
  profiles: {
    get: vi.fn(() =>
      Promise.resolve({ profiles: [{ id: 'p1', name: 'Teste', system: '', photo: null, createdAt: 1 }], activeId: 'p1' })
    ),
    save: vi.fn((estado: unknown) => Promise.resolve(estado)),
    pickPhoto: vi.fn(() => Promise.resolve(null))
  },
  windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
}

function comProvedor(no: React.ReactNode) {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa
  return render(
    <ProfilesProvider>
      <SettingsProvider>{no}</SettingsProvider>
    </ProfilesProvider>
  )
}

function presetDe(groups: { count: number; sides: number }[], keep?: { mode: 'highest' | 'lowest'; count: number }): Preset {
  return {
    id: 'p1',
    name: 'Bola de fogo',
    icon: '🔥',
    expression: { groups, modifiers: [], keep },
    createdAt: 1,
    updatedAt: 1
  } satisfies Preset
}

/** O par de botões "-"/"+" de um bloco (quantidade de dados ou "quantos contam"). */
function contador(rotulo: string) {
  const caixa = screen.getByLabelText(rotulo)
  return {
    menos: within(caixa).getByLabelText('-'),
    mais: within(caixa).getByLabelText('+'),
    valor: () => (caixa.textContent ?? '').replace(/[^0-9]/g, '')
  }
}

/** O ESLint reclama de `as HTMLButtonElement` solto; o TypeScript precisa do estreitamento. */
function comoBotao(elemento: Element): HTMLButtonElement {
  return elemento as HTMLButtonElement
}

function comoCampo(elemento: Element): HTMLInputElement {
  return elemento as HTMLInputElement
}

function comoSelecao(elemento: Element): HTMLSelectElement {
  return elemento as HTMLSelectElement
}

afterEach(cleanup)

describe('botões do editor de preset', () => {
  it('o "+" da quantidade PARA no teto de dados do app', () => {
    comProvedor(<PresetEditorModal preset={presetDe([{ count: 1, sides: 20 }])} onSave={vi.fn()} onCancel={vi.fn()} />)
    const quantidade = contador('Quantidade de dados')

    /**
     * O defeito: o "+" ia até 100 por grupo enquanto o app inteiro só rola 20 dados
     * (`MAX_SIMULTANEOUS_DICE`). Dava pra subir até 100 clicando, ver o aviso vermelho aparecer no
     * meio do caminho e só então descobrir que o Salvar tinha desligado — trabalho jogado fora, e
     * nenhum outro contador do app se comporta assim (o do rolador para no teto).
     */
    for (let i = 0; i < MAX_SIMULTANEOUS_DICE + 10; i++) fireEvent.click(quantidade.mais)

    expect(quantidade.valor()).toBe(String(MAX_SIMULTANEOUS_DICE))
    expect(comoBotao(quantidade.mais).disabled).toBe(true)
    // E o Salvar continua vivo: nunca se chega a um estado inválido só de apertar o "+".
    expect(comoBotao(screen.getByText('Salvar')).disabled).toBe(false)
  })

  it('o "-" de "quantos contam" mexe no número que está NA TELA', () => {
    /**
     * O defeito, e o mais escondido dos dois: "quantos contam" era mostrado com um limite
     * (`Math.min(keepCount, total - 1)`) mas guardado sem ele. Um preset de 6 dados guardando "os 5
     * maiores", reduzido pra 2 dados, mostrava 1 na tela e continuava com 5 na memória — e aí os
     * três primeiros cliques no "-" (5 → 4 → 3 → 2) não mudavam nada do que se vê.
     *
     * Botão que não faz nada visível é indistinguível de botão quebrado, e é assim que ele é
     * relatado.
     */
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 6, sides: 6 }], { mode: 'highest', count: 5 })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const quantidade = contador('Quantidade de dados')
    for (let i = 0; i < 4; i++) fireEvent.click(quantidade.menos)
    expect(quantidade.valor()).toBe('2')

    const contam = contador('Quantos dados contam')
    expect(contam.valor()).toBe('1')
    // Com 2 dados, "quantos contam" só pode ser 1: não há o que diminuir, e o botão diz isso.
    expect((contam.menos as HTMLButtonElement).disabled).toBe(true)
  })

  it('salvar depois de reduzir os dados grava a regra que está na tela', () => {
    const onSave = vi.fn()
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 6, sides: 6 }], { mode: 'highest', count: 5 })}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )

    const quantidade = contador('Quantidade de dados')
    for (let i = 0; i < 3; i++) fireEvent.click(quantidade.menos)
    const naTela = contador('Quantos dados contam').valor()

    fireEvent.click(screen.getByText('Salvar'))

    /**
     * A invariante que o defeito quebrava: O QUE ESTÁ NA TELA É O QUE É GRAVADO. Antes, a tela dizia
     * "os maiores, 2" e o disco recebia um preset SEM REGRA NENHUMA — o preset passava a somar os
     * três dados calado.
     */
    expect(onSave).toHaveBeenCalledTimes(1)
    const gravado = onSave.mock.calls[0][0]
    expect(gravado.expression.groups).toEqual([{ count: 3, sides: 6 }])
    expect(gravado.expression.keep).toEqual({ mode: 'highest', count: Number(naTela) })
  })

  it('o "✕" some quando sobra um grupo só, e some da linha certa', () => {
    comProvedor(
      <PresetEditorModal
        preset={presetDe([
          { count: 1, sides: 20 },
          { count: 2, sides: 6 }
        ])}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const remover = screen.getAllByLabelText('✕')
    expect(remover).toHaveLength(2)
    // Tira o PRIMEIRO grupo: quem tem que sobrar é o 2d6, e não o 1d20.
    fireEvent.click(remover[0])
    expect(screen.getAllByLabelText('Tipo de dado')).toHaveLength(1)
    expect(comoSelecao(screen.getByLabelText('Tipo de dado')).value).toBe('6')
    expect(screen.queryAllByLabelText('✕')).toHaveLength(0)
  })

  it('Salvar fica desligado sem nome, e liga quando o nome chega', () => {
    comProvedor(<PresetEditorModal preset={null} onSave={vi.fn()} onCancel={vi.fn()} />)
    const salvar = screen.getByText('Salvar')
    expect((salvar as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('Ex: Ataque Espada'), { target: { value: 'Espada' } })
    expect((salvar as HTMLButtonElement).disabled).toBe(false)
  })

  it('o modificador aceita negativo, e os botões andam de um em um', () => {
    comProvedor(<PresetEditorModal preset={null} onSave={vi.fn()} onCancel={vi.fn()} />)
    const campo = comoCampo(screen.getByLabelText('Modificador (+/-)'))
    fireEvent.click(screen.getByLabelText('Diminuir o modificador'))
    expect(campo.value).toBe('-1')
    fireEvent.click(screen.getByLabelText('Aumentar o modificador'))
    fireEvent.click(screen.getByLabelText('Aumentar o modificador'))
    expect(campo.value).toBe('1')
  })

  it('Cancelar avisa quem abriu, e clicar DENTRO do cartão não fecha', () => {
    const onCancel = vi.fn()
    const { container } = comProvedor(<PresetEditorModal preset={null} onSave={vi.fn()} onCancel={onCancel} />)

    fireEvent.click(container.querySelector('.preset-editor') as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

/**
 * Achado da revisão de código: uma regra de manter SEM EFEITO ("usar os 3 maiores" de 3 dados,
 * ou `count` zero de um `presets.json` editado à mão) virava regra de verdade só de abrir e salvar
 * o preset pra renomear — porque o mostrador prende o valor em `total − 1` e o que está na tela é o
 * que se grava. Prender é certo; o erro era a regra inerte chegar ao mostrador como escolha.
 */
describe('regra de manter que não faz nada', () => {
  it('abre como "todos os dados", e salvar não inventa uma regra', () => {
    const onSave = vi.fn()
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 3, sides: 6 }], { mode: 'highest', count: 3 })}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )
    expect(comoSelecao(screen.getByLabelText('No total, usar')).value).toBe('all')

    fireEvent.click(screen.getByText('Salvar'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].expression.keep).toBeUndefined()
  })

  it('count zero de um arquivo editado à mão também abre como "todos"', () => {
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 3, sides: 6 }], { mode: 'lowest', count: 0 })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(comoSelecao(screen.getByLabelText('No total, usar')).value).toBe('all')
  })

  it('a regra COM efeito continua abrindo como estava', () => {
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 3, sides: 6 }], { mode: 'highest', count: 2 })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(comoSelecao(screen.getByLabelText('No total, usar')).value).toBe('highest')
    expect(contador('Quantos dados contam').valor()).toBe('2')
  })
})

/**
 * O CAMPO DE FÓRMULA — a gramática de rolagem dentro do editor. O texto e os botões descrevem o
 * mesmo preset, então cada teste mexe num lado e confere o outro.
 */
describe('o campo de fórmula', () => {
  it('escrever a fórmula preenche os botões, e o campo mostra a forma canônica', () => {
    comProvedor(<PresetEditorModal preset={presetDe([{ count: 1, sides: 20 }])} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '4d6kh3+2' } })
    expect(contador('Quantidade de dados').valor()).toBe('4')
    expect(comoSelecao(screen.getByLabelText('Tipo de dado')).value).toBe('6')
    expect(comoSelecao(screen.getByLabelText('No total, usar')).value).toBe('highest')
    expect(contador('Quantos dados contam').valor()).toBe('3')
    expect(comoCampo(screen.getByLabelText('Modificador (+/-)')).value).toBe('2')
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('4d6kh3 + 2')
  })

  it('os botões reescrevem a fórmula', () => {
    comProvedor(
      <PresetEditorModal
        preset={presetDe([{ count: 2, sides: 20 }], { mode: 'highest', count: 1 })}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('2d20kh1')
    fireEvent.click(contador('Quantidade de dados').mais)
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('3d20kh1')
    fireEvent.click(screen.getByLabelText('Aumentar o modificador'))
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('3d20kh1 + 1')
    fireEvent.click(screen.getByLabelText('Dados explosivos'))
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('3d20kh1! + 1')
  })

  it('o que a bandeja não rola fica escrito com o motivo, e os botões não mudam', () => {
    comProvedor(<PresetEditorModal preset={presetDe([{ count: 1, sides: 20 }])} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '1d3' } })
    expect(screen.getByText(/não tem d3/)).toBeTruthy()
    expect(contador('Quantidade de dados').valor()).toBe('1')
    expect(comoSelecao(screen.getByLabelText('Tipo de dado')).value).toBe('20')
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('1d3')

    // Reroll deixou de ser recusa: vira MODO FÓRMULA — o aviso troca e os controles saem de cena.
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d6r<2' } })
    expect(screen.getByText(/rola pelo texto da fórmula/)).toBeTruthy()
    expect(screen.queryByLabelText('Tipo de dado')).toBeNull()
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '1d20+@STR.mod' } })
    expect(screen.getByText(/valor da ficha/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '1d' } })
    expect(screen.getByText(/sem número de lados/)).toBeTruthy()

    // Corrigir apaga o aviso e preenche.
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d6' } })
    expect(screen.queryByText(/sem número de lados/)).toBeNull()
    expect(contador('Quantidade de dados').valor()).toBe('2')
    expect(comoSelecao(screen.getByLabelText('Tipo de dado')).value).toBe('6')
  })

  it('salvar grava o que a fórmula disse', () => {
    const onSave = vi.fn()
    comProvedor(<PresetEditorModal preset={presetDe([{ count: 1, sides: 20 }])} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d20kl1 - 1' } })
    fireEvent.click(screen.getByText('Salvar'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].expression).toEqual({
      groups: [{ sides: 20, count: 2 }],
      modifiers: [{ type: 'flat', value: -1 }],
      keep: { mode: 'lowest', count: 1 },
      explode: undefined
    })
  })
})

/**
 * O MODO FÓRMULA — o preset que só a gramática descreve (ver `formulaPropria` no editor e
 * `formula` em `preset.ts`): reroll, contagem, alvo, multiplicação, manter por grupo deixaram de
 * ser recusa e viraram preset de verdade, rolado por etapas na cena.
 */
describe('o modo fórmula do editor', () => {
  it('salvar no modo fórmula grava a fórmula canônica, sem expressão', () => {
    const onSave = vi.fn()
    comProvedor(<PresetEditorModal preset={null} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Rajada' } })
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '6d6#>=5' } })
    fireEvent.click(screen.getByText('Salvar'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0].formula).toBe('6d6#>=5')
    expect(onSave.mock.calls[0][0].expression).toBeUndefined()
  })

  it('o alvo no fim também é modo fórmula, e a forma gravada é a canônica', () => {
    const onSave = vi.fn()
    comProvedor(<PresetEditorModal preset={null} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Teste' } })
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '1d20+5>=15' } })
    expect(screen.getByText(/rola pelo texto da fórmula/)).toBeTruthy()
    fireEvent.click(screen.getByText('Salvar'))
    expect(onSave.mock.calls[0][0].formula).toBe('1d20 + 5 >= 15')
  })

  it('editar um preset de fórmula abre no modo fórmula, e voltar pra expressão apaga a fórmula', () => {
    const onSave = vi.fn()
    comProvedor(
      <PresetEditorModal
        preset={{ id: 'p1', name: 'Sorte', formula: '2d6r<2', createdAt: 0, updatedAt: 0 }}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )
    expect(comoCampo(screen.getByLabelText('Fórmula')).value).toBe('2d6r<2')
    expect(screen.getByText(/rola pelo texto da fórmula/)).toBeTruthy()
    expect(screen.queryByLabelText('Tipo de dado')).toBeNull()

    // O texto que a expressão SABE dizer devolve os controles — e o salvar grava expressão.
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d6+1' } })
    expect(screen.queryByText(/rola pelo texto da fórmula/)).toBeNull()
    expect(comoSelecao(screen.getByLabelText('Tipo de dado')).value).toBe('6')
    fireEvent.click(screen.getByText('Salvar'))
    expect(onSave.mock.calls[0][0].formula).toBeUndefined()
    expect(onSave.mock.calls[0][0].expression).toEqual({
      groups: [{ sides: 6, count: 2 }],
      modifiers: [{ type: 'flat', value: 1 }],
      keep: undefined,
      explode: undefined
    })
  })

  it('fórmula com erro no meio da digitação desliga o Salvar; a última aceita fica guardada', () => {
    const onSave = vi.fn()
    comProvedor(<PresetEditorModal preset={null} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d6r<2' } })
    fireEvent.change(screen.getByLabelText('Fórmula'), { target: { value: '2d6r<' } })
    const salvar = comoBotao(screen.getByText('Salvar'))
    expect(salvar.disabled).toBe(true)
  })
})
