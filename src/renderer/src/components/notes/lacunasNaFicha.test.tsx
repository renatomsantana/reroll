// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesData } from '@shared/types/notes'
import type { ProfilesState } from '@shared/types/profile'
import type { DiceExpression } from '@shared/types/dice'
import { ProfilesProvider } from '@renderer/settings/ProfilesContext'
import { SettingsProvider } from '@renderer/settings/SettingsContext'
import { NotesProvider } from '@renderer/hooks/useNotes'
import { SheetTab } from './SheetTab'

/**
 * AS LACUNAS DA FICHA, na tela — pedido do usuário: "vendo os espaços de lacunas… ficha deixando
 * completamente funcionando".
 *
 * A lacuna é o campo que a importação traz VAZIO de propósito (toda perícia, todo par
 * atual/máximo — ver `sempre` nos leitores), porque é nela que se escreve no meio da sessão: o PV
 * que desceu, a perícia que passou a ser treinada. O contrato que este arquivo segura:
 *
 * 1. a lacuna aparece como campo EDITÁVEL, e vazia não ganha botão de rolar — um dado ao lado de
 *    um vazio rolaria o quê?;
 * 2. o que se digita na lacuna é GRAVADO (o `notes.save` recebe o valor novo);
 * 3. quando o número chega numa lacuna que É rolagem no sistema (`roll`), o botão de dado NASCE
 *    na hora — e rola a regra do sistema (Agilidade 3 em Ordem = 3d20 usando o maior).
 */

const PERFIS: ProfilesState = {
  profiles: [{ id: 'p1', name: 'Matais', system: 'Ordem Paranormal', photo: null, createdAt: 1 }],
  activeId: 'p1'
}

/** A ficha importada com LACUNAS: Agilidade vazia (rola pool-d20) e PV atual vazio (não rola). */
function fichaComLacunas(): NotesData {
  return {
    characterName: 'Matais',
    attributes: '',
    abilities: '',
    inventory: '',
    appearance: '',
    backstory: '',
    bold: false,
    italic: false,
    underline: false,
    font: '',
    color: '',
    pages: [{ id: 'dia-1', title: '', text: '', createdAt: 1 }],
    currentPage: 0,
    sections: [
      {
        id: 'atributos',
        title: 'Atributos',
        fields: [
          { id: 'agi', label: 'Agilidade', value: '', roll: 'pool-d20' },
          { id: 'for', label: 'Força', value: '2', roll: 'pool-d20' }
        ]
      },
      {
        id: 'recursos',
        title: 'Recursos',
        fields: [{ id: 'pv-atual', label: 'PV atual', value: '' }]
      }
    ]
  } as unknown as NotesData
}

const gravacoes: NotesData[] = []

function apiFalsa() {
  return {
    profiles: {
      get: vi.fn(() => Promise.resolve(structuredClone(PERFIS))),
      save: vi.fn((estado: ProfilesState) => Promise.resolve(estado)),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    },
    windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) },
    notes: {
      get: vi.fn(() => Promise.resolve(fichaComLacunas())),
      save: vi.fn((dados: NotesData) => {
        gravacoes.push(structuredClone(dados))
        return Promise.resolve(dados)
      })
    },
    sheets: { pickPdf: vi.fn(), apply: vi.fn() }
  }
}

const rolagens: { expression: DiceExpression; name: string }[] = []

async function montar() {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <NotesProvider>
          <SheetTab onRoll={(expression, name) => rolagens.push({ expression, name })} />
        </NotesProvider>
      </SettingsProvider>
    </ProfilesProvider>
  )
  // A ficha carregada: a seção importada está na tela.
  await waitFor(() => expect(screen.getByDisplayValue('2')).toBeTruthy())
}

beforeEach(() => {
  localStorage.clear()
  gravacoes.length = 0
  rolagens.length = 0
})

afterEach(cleanup)

/**
 * Digita e ESPERA a gravação acontecer. Existe por uma corrida real do app, não do teste: o
 * `useNotes` descarta digitação enquanto `loadedFor !== activeId` (a janela entre a lista de
 * personagens inventada do primeiro render e a de verdade — ver `prontoRef`), e é o comportamento
 * CERTO: melhor perder uma tecla que gravar a ficha errada. No teste, essa janela fazia a primeira
 * tecla sumir de vez em quando (2 falhas em 4 rodadas). Repetir o change até o save chegar é o que
 * uma pessoa faz sem perceber — a tecla que não pegou é digitada de novo — e o valor é idempotente.
 */
async function digitar(el: Element, valor: string): Promise<void> {
  const antes = gravacoes.length
  await waitFor(() => {
    fireEvent.change(el, { target: { value: valor } })
    expect(gravacoes.length).toBeGreaterThan(antes)
  })
}

describe('as lacunas da ficha importada', () => {
  it('lacuna vazia é editável e NÃO tem botão de rolar; a preenchida do lado tem', async () => {
    await montar()

    // Força (2) rola; Agilidade (vazia) ainda não tem o quê rolar.
    expect(screen.getByLabelText('Rolar Força')).toBeTruthy()
    expect(screen.queryByLabelText('Rolar Agilidade')).toBeNull()
    // PV atual vazio: editável, e nunca ganha dado (não é rolagem no sistema).
    expect(screen.queryByLabelText('Rolar PV atual')).toBeNull()
  })

  it('digitar na lacuna GRAVA, e o botão de rolar NASCE quando o número chega', async () => {
    await montar()

    // A lacuna da Agilidade é o único campo vazio da seção de atributos.
    const campos = screen.getAllByDisplayValue('')
    const agilidade = campos.find((c) => (c as HTMLInputElement).closest('label')?.textContent?.includes('Agilidade'))
    expect(agilidade).toBeTruthy()

    await digitar(agilidade!, '3')

    // Gravou o valor novo na seção certa.
    const ultima = gravacoes[gravacoes.length - 1]
    const secaoAtributos = ultima.sections.find((s) => s.title === 'Atributos')!
    expect(secaoAtributos.fields.find((c) => c.label === 'Agilidade')?.value).toBe('3')
    // E o `roll` atravessou a gravação — sem ele o botão morre na primeira releitura.
    expect(secaoAtributos.fields.find((c) => c.label === 'Agilidade')?.roll).toBe('pool-d20')

    // O botão nasceu na hora.
    expect(await screen.findByLabelText('Rolar Agilidade')).toBeTruthy()
  })

  it('o botão da lacuna preenchida rola a REGRA do sistema — Agilidade 3 é 3d20 usando o maior', async () => {
    await montar()

    const campos = screen.getAllByDisplayValue('')
    const agilidade = campos.find((c) => (c as HTMLInputElement).closest('label')?.textContent?.includes('Agilidade'))
    await digitar(agilidade!, '3')

    fireEvent.click(await screen.findByLabelText('Rolar Agilidade'))
    expect(rolagens).toHaveLength(1)
    expect(rolagens[0].name).toBe('Agilidade (Atributos)')
    expect(rolagens[0].expression).toEqual({
      groups: [{ sides: 20, count: 3 }],
      modifiers: [],
      keep: { mode: 'highest', count: 1 }
    })
  })

  it('lacuna sem tipo de rolagem grava normal e continua sem dado — PV atual é anotação, não rolagem', async () => {
    await montar()

    const campos = screen.getAllByDisplayValue('')
    const pvAtual = campos.find((c) => (c as HTMLInputElement).closest('label')?.textContent?.includes('PV atual'))
    await digitar(pvAtual!, '19')

    const ultima = gravacoes[gravacoes.length - 1]
    expect(ultima.sections.find((s) => s.title === 'Recursos')?.fields[0].value).toBe('19')
    expect(screen.queryByLabelText('Rolar PV atual')).toBeNull()
  })
})
