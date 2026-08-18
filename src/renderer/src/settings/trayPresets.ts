export interface TrayPreset {
  id: string
  label: string
  wallColor: string
  floorColor: string
}

/**
 * Combinações prontas de cor pra parede+chão da bandeja, mesmo padrão de `metalPresets.ts` —
 * primeira entrada inspirada na referência que o usuário trouxe (`ideias/`): bandeja de couro
 * preto com forro de feltro amarelo-mostarda.
 *
 * As outras cinco seguem a mesma lógica de par: parede num tom de madeira/couro (é a superfície
 * que a textura de veio usa como tintura) e chão num tom de feltro/tecido. Sozinha, a de couro
 * não justificava uma seção própria na aba Estilo — uma amostra só não é uma paleta.
 */
export const TRAY_PRESETS: TrayPreset[] = [
  { id: 'leather', label: 'Couro', wallColor: '#241a12', floorColor: '#c9962f' },
  { id: 'greenFelt', label: 'Feltro verde', wallColor: '#3a2718', floorColor: '#1e5c3c' },
  { id: 'velvet', label: 'Veludo real', wallColor: '#241a2e', floorColor: '#4b2a6b' },
  { id: 'tavern', label: 'Taverna', wallColor: '#5a3a1e', floorColor: '#8a3a2a' },
  { id: 'midnight', label: 'Meia-noite', wallColor: '#14161c', floorColor: '#243b6b' },
  { id: 'parchment', label: 'Pergaminho', wallColor: '#6b4a2a', floorColor: '#d8c69a' },
  /**
   * Rosas (pedido do usuário). A parede continua sendo tom de MADEIRA mesmo nestes: ela não é uma
   * cor chapada, é a tintura da textura de veio (ver `woodTint` em `createScene.ts`), e uma parede
   * rosa-pura apaga o veio e vira um bloco de plástico em volta da bandeja. O rosa entra no CHÃO,
   * que é feltro/veludo e aceita cor saturada — e a parede acompanha num tom amadeirado que puxa
   * pro rosado (mogno, cerejeira, um cinza-rosado pro pastel).
   */
  { id: 'roseVelvet', label: 'Veludo rosa', wallColor: '#3a1c24', floorColor: '#a83a6b' },
  { id: 'blushFelt', label: 'Feltro blush', wallColor: '#6b4a44', floorColor: '#d98aa5' },
  { id: 'magentaSuede', label: 'Camurça magenta', wallColor: '#2e1620', floorColor: '#7d1f4d' }
]
