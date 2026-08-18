export interface MattePreset {
  id: string
  label: string
  bodyColor: string
  numberColor: string
}

/**
 * Combinações prontas pensadas pro acabamento fosco (`matte`) — cores mais dessaturadas/foscas
 * de propósito (diferente do brilho de `metalPresets.ts`/`gemPresets.ts`), já que um tom muito
 * saturado ou claro perde o "jeito de pedra/madeira" que o fosco tenta passar. Mesmo padrão dos
 * outros presets de cor: clicar seta corpo + número + o acabamento correspondente de uma vez.
 */
export const MATTE_PRESETS: MattePreset[] = [
  { id: 'slate', label: 'Ardósia', bodyColor: '#4a5058', numberColor: '#f0f0f0' },
  { id: 'sand', label: 'Areia', bodyColor: '#c9b896', numberColor: '#2a2114' },
  { id: 'forest', label: 'Floresta', bodyColor: '#3d5a3f', numberColor: '#f0ead6' },
  { id: 'terracotta', label: 'Terracota', bodyColor: '#a5563a', numberColor: '#f5ece0' },
  { id: 'charcoal', label: 'Carvão', bodyColor: '#262626', numberColor: '#e0e0e0' },
  { id: 'bone', label: 'Osso', bodyColor: '#e8e0cc', numberColor: '#2a2418' },
  // Rosas (pedido do usuário) — foscos, então tons quebrados em vez de rosa puro, que no fosco
  // lê como plástico e não como pintura sem brilho.
  { id: 'dusty-rose', label: 'Rosa Antigo', bodyColor: '#b5808c', numberColor: '#2b1218' },
  { id: 'blush', label: 'Blush', bodyColor: '#dcaeb4', numberColor: '#2b1a1d' }
]
