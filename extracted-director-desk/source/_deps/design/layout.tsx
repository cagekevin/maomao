import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export type DesignPageShellProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode
}

export function DesignPageShell({ children, className, ...props }: DesignPageShellProps): JSX.Element {
  const rootClassName = cn('tc-design-page-shell', 'min-h-screen bg-nomi-bg font-nomi-sans text-nomi-ink', className)

  return (
    <div {...props} className={rootClassName}>
      {children}
    </div>
  )
}
