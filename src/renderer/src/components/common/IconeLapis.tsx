/**
 * O lápis de "editar", desenhado em SVG — pelo mesmo motivo da engrenagem (`IconeEngrenagem.tsx`):
 * o ✏️ era um bitmap colorido do Segoe UI Emoji, e o ✎ de texto sai como um risco fino de 11px.
 * `currentColor` faz ele acompanhar a cor do botão, no modo dia e no modo noite.
 */
export function IconeLapis({ tamanho = 12 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11.5 1.5 14.5 4.5 5.5 13.5 2 14 2.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 3.5 12.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
