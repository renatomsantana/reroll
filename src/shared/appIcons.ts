export interface AppIconOption {
  id: string
  label: string
}

/**
 * Ids válidos de ícone do app — únicos, compartilhados entre main (resolve `build/icons/<id>.png`
 * pro `nativeImage`, e valida qualquer id recebido por IPC contra esta lista antes de usar como
 * caminho de arquivo) e renderer (miniaturas nas Preferências, importadas de
 * `assets/icons/<id>.png`). Uma única fonte de verdade evita o main aceitar um id arbitrário
 * vindo do renderer e montar um caminho de arquivo fora de `build/icons/`.
 */
/** Ícone branco ('rbranco') removido a pedido do usuário — ficava ilegível/"sumido" na barra de tarefas do Windows (tema claro), então não pode mais existir como opção. */
/**
 * Quem desenhou os ícones — mostrado ao lado do rótulo nas Preferências.
 *
 * Vive AQUI, junto da lista, pelo mesmo motivo do crédito das fontes (ver `FONT_OPTIONS`): quem
 * acrescentar ou trocar ícone amanhã mexe neste arquivo, e crédito guardado longe é crédito que se
 * perde numa refatoração.
 *
 * É UM crédito pro conjunto, e não um por ícone: os sete são da mesma pessoa, e repetir "by @xuga"
 * sete vezes numa fileira de miniaturas viraria ruído em vez de atribuição.
 */
export const APP_ICONS_CREDIT = 'by @xuga'

export const APP_ICON_OPTIONS: AppIconOption[] = [
  { id: 'base', label: 'Clássico' },
  { id: 'azul', label: 'Azul' },
  { id: 'preto', label: 'Preto' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'roxo', label: 'Roxo' },
  { id: 'turquesa', label: 'Turquesa' },
  { id: 'verde', label: 'Verde' }
]

/**
 * O ícone PRINCIPAL do app: o d20 vermelho. É ele que o `.ico` do executável e do instalador
 * reproduzem (ver `scripts/generate-icon.mjs`), então é ele que aparece pra quem nunca abriu as
 * Preferências — no atalho, na barra de tarefas e na janela.
 *
 * Fica aqui, e não em cada lado, porque o padrão precisava valer igual em DOIS lugares que não se
 * enxergam: `SettingsRepository` (main, decide o ícone na criação da janela) e `SettingsContext`
 * (renderer, marca qual está selecionado). Duas constantes soltas com o mesmo valor é exatamente o
 * tipo de coisa que sai de sincronia na primeira troca.
 */
export const DEFAULT_APP_ICON_ID = 'base'

export const APP_ICON_IDS = APP_ICON_OPTIONS.map((option) => option.id)

export function isValidAppIconId(id: string): boolean {
  return APP_ICON_IDS.includes(id)
}
