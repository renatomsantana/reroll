export interface PlasticPreset {
  id: string
  label: string
  bodyColor: string
  numberColor: string
}

/**
 * Combinações prontas pensadas pro acabamento plástico (`plastic`) — cores bem saturadas/vivas
 * de propósito (diferente do fosco/metal), o "dado de resina colorido" clássico de mesa de RPG.
 * Mesmo padrão dos outros presets de cor: clicar seta corpo + número + o acabamento
 * correspondente de uma vez.
 */
export const PLASTIC_PRESETS: PlasticPreset[] = [
  { id: 'candy-red', label: 'Vermelho Candy', bodyColor: '#d1233c', numberColor: '#fff6e8' },
  { id: 'electric-blue', label: 'Azul Elétrico', bodyColor: '#1560d8', numberColor: '#ffffff' },
  { id: 'lime', label: 'Limão', bodyColor: '#8fd12b', numberColor: '#1a2b04' },
  { id: 'tangerine', label: 'Tangerina', bodyColor: '#f2871f', numberColor: '#2b1400' },
  { id: 'bubblegum', label: 'Chiclete', bodyColor: '#ef6fb0', numberColor: '#2b0016' },
  { id: 'violet', label: 'Violeta', bodyColor: '#8a3fd1', numberColor: '#f5ecff' },
  // Rosas (pedido do usuário) — no plástico eles podem ser puros e berrantes, que é a graça da
  // família; o Chiclete já existia e ficava sozinho.
  { id: 'neon-pink', label: 'Rosa Neon', bodyColor: '#ff3d99', numberColor: '#2b0016' },
  { id: 'pastel-pink', label: 'Rosa Pastel', bodyColor: '#f9bcd6', numberColor: '#40182a' }
]
