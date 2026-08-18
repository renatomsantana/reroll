export interface MetalPreset {
  id: string
  label: string
  bodyColor: string
  numberColor: string
}

/**
 * Combinações prontas de cor pensadas pra ficarem boas com o acabamento metálico ligado
 * (`diceMetallic`) — número sempre com contraste alto contra o corpo, já que o multiply de
 * textura foi removido (ver `createNumberTexture.ts`), então qualquer par de cores aqui sai
 * exatamente como escrito, sem surpresa.
 */
export const METAL_PRESETS: MetalPreset[] = [
  { id: 'gold', label: 'Ouro', bodyColor: '#d4af37', numberColor: '#2b1d00' },
  { id: 'silver', label: 'Prata', bodyColor: '#c8c9cb', numberColor: '#1a1a1a' },
  { id: 'bronze', label: 'Bronze', bodyColor: '#a0623d', numberColor: '#2b1704' },
  { id: 'copper', label: 'Cobre', bodyColor: '#b56a3a', numberColor: '#1c0d02' },
  { id: 'gunmetal', label: 'Chumbo', bodyColor: '#4a4e57', numberColor: '#f0f0f0' },
  { id: 'obsidian', label: 'Obsidiana', bodyColor: '#15161a', numberColor: '#e6c86e' },
  { id: 'rose-gold', label: 'Ouro Rosé', bodyColor: '#b76e79', numberColor: '#2b1004' },
  { id: 'platinum', label: 'Platina', bodyColor: '#e5e4e2', numberColor: '#2a2a2a' },
  { id: 'brass', label: 'Latão', bodyColor: '#c8a94b', numberColor: '#241c04' },
  { id: 'titanium', label: 'Titânio', bodyColor: '#6b7278', numberColor: '#e8e8e8' },
  { id: 'iron', label: 'Ferro', bodyColor: '#3f3f3f', numberColor: '#d8d8d8' },
  { id: 'verdigris', label: 'Zinabre', bodyColor: '#4f8f78', numberColor: '#1a1a1a' },
  // Rosas (pedido do usuário) — o metálico já tinha só o Ouro Rosé.
  { id: 'pink-pearl', label: 'Pérola Rosa', bodyColor: '#e3b3c4', numberColor: '#3a1424' },
  { id: 'magenta-chrome', label: 'Cromo Magenta', bodyColor: '#b83a75', numberColor: '#ffe8f2' }
]
