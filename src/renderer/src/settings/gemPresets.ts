export interface GemPreset {
  id: string
  label: string
  bodyColor: string
  numberColor: string
}

/**
 * Combinações prontas inspiradas nos sets de dados "gema"/marmorizados que o usuário trouxe em
 * `ideias/` (roxo, vermelho-e-preto, azul, azul-e-roxo, verde-escuro, magenta — todos com
 * números dourados). Mesmo padrão de `metalPresets.ts`, mas sem forçar acabamento metálico —
 * essas cores ficam melhor com `plastic` (o brilho de verniz lembra a superfície polida/
 * translúcida dos dados de resina reais) do que com `matte` ou `metallic`. Não tenta reproduzir
 * o efeito marmorizado/swirl em si (precisaria de uma textura por face gerada com ruído — fora
 * de escopo por ora), só a paleta de cor sólida + número dourado.
 */
export const GEM_PRESETS: GemPreset[] = [
  { id: 'amethyst', label: 'Ametista', bodyColor: '#5a2d82', numberColor: '#e8c977' },
  { id: 'garnet', label: 'Granada', bodyColor: '#3a0d10', numberColor: '#e8c977' },
  { id: 'sapphire', label: 'Safira', bodyColor: '#1c3f7a', numberColor: '#e8c977' },
  { id: 'amethyst-night', label: 'Ametista Noturna', bodyColor: '#2a1840', numberColor: '#c9a6ff' },
  { id: 'emerald', label: 'Esmeralda', bodyColor: '#0f3d2e', numberColor: '#e8c977' },
  { id: 'ruby-night', label: 'Rubi Noturno', bodyColor: '#3a0f2e', numberColor: '#e8c977' },
  { id: 'topaz', label: 'Topázio', bodyColor: '#8a4f10', numberColor: '#fff2d0' },
  { id: 'aquamarine', label: 'Água-marinha', bodyColor: '#1c6b6f', numberColor: '#e8f7f7' },
  { id: 'peridot', label: 'Peridoto', bodyColor: '#4d6b1a', numberColor: '#f2f7c9' },
  { id: 'onyx', label: 'Ônix', bodyColor: '#0c0c0e', numberColor: '#e8c977' },
  { id: 'opal', label: 'Opala', bodyColor: '#7d8fa0', numberColor: '#ffe8f5' },
  { id: 'citrine', label: 'Citrino', bodyColor: '#8f5a10', numberColor: '#fff0c9' },
  // Rosas (pedido do usuário). Seguem o padrão da família: corpo fundo e saturado, número claro —
  // gema clara demais perde a leitura de pedra e vira plástico.
  { id: 'ruby', label: 'Rubi', bodyColor: '#6e0f2a', numberColor: '#ffd9e2' },
  { id: 'pink-tourmaline', label: 'Turmalina Rosa', bodyColor: '#7d1f4d', numberColor: '#ffd9ec' },
  { id: 'rose-quartz', label: 'Quartzo Rosa', bodyColor: '#a35d76', numberColor: '#fff0f5' }
]
