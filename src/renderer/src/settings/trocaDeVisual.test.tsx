// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfilesState } from '@shared/types/profile'
import { ProfilesProvider, useProfiles } from './ProfilesContext'
import { SettingsProvider, useSettings } from './SettingsContext'

/**
 * TROCAR E DESTROCAR DE PERSONAGEM MANTÉM O VISUAL DE CADA UM — pergunta do usuário, ao pé da
 * letra: "troca e destroca mantém os mesmos designs? as trocas funcionam?".
 *
 * A aparência da mesa (cor dos dados, da bandeja, da torre, modo de lançamento…) é POR PERSONAGEM
 * (`PROFILE_LOOK_KEYS` em `SettingsContext.tsx`), guardada numa chave de `localStorage` por perfil
 * e trocada por um efeito quando o `activeId` muda. Os testes de isolamento existentes cobrem
 * anotações, presets e ficha (que moram em ARQUIVO, no processo principal); o visual mora em outro
 * lugar e por outro mecanismo, e não tinha teste de ida e volta nenhum — uma regressão no efeito de
 * troca passaria calada, e é o tipo de defeito que a pessoa descreve como "as cores do Rodrigo
 * vazaram pro Matais".
 *
 * O fluxo é o da pergunta: pinta A, troca pra B, pinta B, DESTROCA pra A — as cores de A têm que
 * estar lá; troca de novo pra B — as de B também.
 */

const DOIS: ProfilesState = {
  profiles: [
    { id: 'aaaa-1111', name: 'Matais', system: 'Ordem Paranormal', photo: null, createdAt: 1 },
    { id: 'bbbb-2222', name: 'Rodrigo', system: 'D&D 5e', photo: null, createdAt: 2 }
  ],
  activeId: 'aaaa-1111'
}

function apiFalsa() {
  return {
    profiles: {
      get: vi.fn(() => Promise.resolve(structuredClone(DOIS))),
      save: vi.fn((estado: ProfilesState) => Promise.resolve(estado)),
      pickPhoto: vi.fn(() => Promise.resolve(null))
    },
    windowControls: { setAppIcon: vi.fn(() => Promise.resolve()) }
  }
}

type Controles = { perfis: ReturnType<typeof useProfiles>; visual: ReturnType<typeof useSettings> }
let controles: Controles | null = null

function Sonda() {
  const perfis = useProfiles()
  const visual = useSettings()
  controles = { perfis, visual }
  return (
    <div>
      <span data-testid="ativo">{perfis.activeId}</span>
      <span data-testid="cor">{visual.diceBodyColor}</span>
      <span data-testid="modo">{visual.launchMode}</span>
    </div>
  )
}

async function montar() {
  ;(globalThis as unknown as { api: unknown }).api = apiFalsa()
  render(
    <ProfilesProvider>
      <SettingsProvider>
        <Sonda />
      </SettingsProvider>
    </ProfilesProvider>
  )
  await waitFor(() => expect(screen.getByTestId('ativo').textContent).toBe('aaaa-1111'))
}

async function trocarPara(id: string) {
  await act(async () => {
    controles!.perfis.select(id)
  })
  await waitFor(() => expect(screen.getByTestId('ativo').textContent).toBe(id))
}

beforeEach(() => {
  localStorage.clear()
  controles = null
})

afterEach(cleanup)

describe('o visual de cada personagem sobrevive à troca e à destroca', () => {
  it('pinta A, troca pra B, pinta B, volta pra A: cada um com as próprias cores', async () => {
    await montar()

    act(() => controles!.visual.setDiceBodyColor('#111111'))
    expect(screen.getByTestId('cor').textContent).toBe('#111111')

    await trocarPara('bbbb-2222')
    // Perfil que nunca foi pintado HERDA o visual que estava valendo — de propósito: criar ou
    // abrir um personagem novo não joga a cena pro padrão de fábrica (ver `loadLook`).
    expect(screen.getByTestId('cor').textContent).toBe('#111111')

    act(() => controles!.visual.setDiceBodyColor('#222222'))
    expect(screen.getByTestId('cor').textContent).toBe('#222222')

    // A DESTROCA: voltar pra A tem que devolver a cor de A, não a última pintada.
    await trocarPara('aaaa-1111')
    expect(screen.getByTestId('cor').textContent).toBe('#111111')

    // E trocar de novo devolve a de B — as duas direções, quantas vezes for.
    await trocarPara('bbbb-2222')
    expect(screen.getByTestId('cor').textContent).toBe('#222222')
    await trocarPara('aaaa-1111')
    expect(screen.getByTestId('cor').textContent).toBe('#111111')
  })

  it('o resto do visual viaja junto — modo de lançamento incluído', async () => {
    await montar()

    act(() => controles!.visual.setLaunchMode('tower'))
    await trocarPara('bbbb-2222')
    act(() => controles!.visual.setLaunchMode('tray'))
    await trocarPara('aaaa-1111')
    expect(screen.getByTestId('modo').textContent).toBe('tower')
    await trocarPara('bbbb-2222')
    expect(screen.getByTestId('modo').textContent).toBe('tray')
  })

  it('o visual gravado sobrevive a fechar e reabrir o app (remontagem do provedor)', async () => {
    await montar()
    act(() => controles!.visual.setDiceBodyColor('#333333'))
    await trocarPara('bbbb-2222')
    act(() => controles!.visual.setDiceBodyColor('#444444'))
    // A troca é o que grava o visual de quem SAI; voltar pra A grava o de B do mesmo jeito.
    await trocarPara('aaaa-1111')

    // "Fecha o app": desmonta tudo e monta de novo, com o mesmo localStorage.
    cleanup()
    controles = null
    await montar()
    expect(screen.getByTestId('cor').textContent).toBe('#333333')
    await trocarPara('bbbb-2222')
    expect(screen.getByTestId('cor').textContent).toBe('#444444')
  })
})

describe('fechar o app sem "salvar" não perde a cor — não existe botão de salvar', () => {
  /**
   * Pedido do usuário, ao pé da letra: "testa fechar o app, abrir de novo e trocar as cores,
   * esquecer de salvar, fechar o app novamente". No Reroll ninguém salva preferência — a gravação
   * é automática, por dois caminhos que estes testes seguram no lugar:
   *
   * 1. o DEBOUNCE de 300ms (`PERSIST_DEBOUNCE_MS`): mexeu e continuou usando, grava sozinho;
   * 2. o `pagehide`: mexeu e fechou NA HORA, antes dos 300ms — o fechamento da janela dispara a
   *    gravação síncrona que o timer cancelado nunca fez. Sem ele, a última cor escolhida segundos
   *    antes de fechar se perdia, e é exatamente o "esquecer de salvar" da pergunta.
   */
  it('trocar a cor e fechar NA HORA (antes do debounce): o pagehide grava', async () => {
    await montar()
    act(() => controles!.visual.setDiceBodyColor('#123456'))
    // Fecha imediatamente: nenhum timer de 300ms teve tempo de rodar.
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    cleanup()
    controles = null

    // "Abrir de novo": o que ficou no localStorage é o que a janela nova lê.
    await montar()
    expect(screen.getByTestId('cor').textContent).toBe('#123456')
  })

  it('trocar a cor, usar por um instante e fechar: o debounce já gravou sozinho', async () => {
    await montar()
    act(() => controles!.visual.setDiceBodyColor('#654321'))
    // 300ms de debounce + folga — o uso normal de quem mexe na cor e continua jogando.
    await new Promise((r) => setTimeout(r, 450))
    // Fecha SEM pagehide (como um processo morto): a gravação já tinha acontecido.
    cleanup()
    controles = null

    await montar()
    expect(screen.getByTestId('cor').textContent).toBe('#654321')
  })

  it('o ciclo inteiro da pergunta: fecha, abre, troca, "esquece de salvar", fecha de novo', async () => {
    // Primeira sessão: pinta e fecha direito.
    await montar()
    act(() => controles!.visual.setDiceBodyColor('#111111'))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    cleanup()
    controles = null

    // Segunda sessão: abre com a cor da primeira, troca, e fecha NA HORA de novo.
    await montar()
    expect(screen.getByTestId('cor').textContent).toBe('#111111')
    act(() => controles!.visual.setDiceBodyColor('#222222'))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    cleanup()
    controles = null

    // Terceira sessão: a troca "esquecida" está lá.
    await montar()
    expect(screen.getByTestId('cor').textContent).toBe('#222222')
  })
})
