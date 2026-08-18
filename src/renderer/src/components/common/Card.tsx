import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import './Card.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={`card ${className ?? ''}`} {...rest}>
      {children}
    </div>
  )
})
