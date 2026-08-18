import { describe, expect, it, vi } from 'vitest'
import type RAPIER from '@dimforge/rapier3d-compat'
import { createPhysicsStepper } from './createPhysicsStepper'
import { WORLD_CONFIG } from '../config/physicsConfig'

function fakeWorld() {
  return { step: vi.fn() } as unknown as RAPIER.World
}

describe('createPhysicsStepper', () => {
  const fixedDt = 1 / WORLD_CONFIG.physicsStepsPerSecond
  const maxStepSeconds = WORLD_CONFIG.maxStepsPerFrame * fixedDt

  it('nunca simula mais que maxStepsPerFrame passos num único frame', () => {
    const world = fakeWorld()
    const step = createPhysicsStepper(world)

    const simulated = step(10) // frame gigante (ex.: janela acabou de voltar do segundo plano)

    expect(world.step).toHaveBeenCalledTimes(WORLD_CONFIG.maxStepsPerFrame)
    expect(simulated).toBeCloseTo(maxStepSeconds, 10)
  })

  it('não acumula atraso represado entre frames — sem "avanço rápido" depois de um frame gigante', () => {
    const world = fakeWorld()
    const step = createPhysicsStepper(world)

    step(10) // um frame gigante (ex.: app estava minimizado)
    vi.mocked(world.step).mockClear()

    // O próximo frame, normal, não deve estar carregando nenhum atraso represado do
    // frame gigante anterior — ele só processa o próprio deltaSeconds, nada mais.
    const simulated = step(fixedDt)

    expect(world.step).toHaveBeenCalledTimes(1)
    expect(simulated).toBeCloseTo(fixedDt, 10)
  })

  it('devolve os segundos de física realmente simulados, não o deltaSeconds bruto', () => {
    const world = fakeWorld()
    const step = createPhysicsStepper(world)

    const simulated = step(fixedDt * 2.5)

    expect(world.step).toHaveBeenCalledTimes(2)
    expect(simulated).toBeCloseTo(fixedDt * 2, 10)
  })
})
