import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  /**
   * Botão de alternância LIGADO (tipo de dado já na rolagem, modo ativo, acabamento escolhido).
   * Existe separado da `variant` porque "está marcado" e "é a ação principal da tela" são coisas
   * diferentes: no visual Windows 98 o marcado fica AFUNDADO com fundo xadrez, enquanto o
   * principal ganha a moldura preta de botão padrão. Antes os dois usavam `variant="primary"`, o
   * que dava o mesmo destaque pra sete botões de dado e pro "Rolar".
   */
  selected?: boolean
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  selected = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${selected ? 'btn-selected' : ''} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  )
}
