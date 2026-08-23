import { Table, type TableProps } from '@mantine/core'
import { cn } from '../utils/cn'

export type DesignTableProps = TableProps

export function DesignTable({ className, ...props }: DesignTableProps): JSX.Element {
  const rootClassName = cn('tc-design-table', 'w-full border-collapse font-nomi-sans text-nomi-ink', className)

  return <Table {...props} className={rootClassName} />
}
