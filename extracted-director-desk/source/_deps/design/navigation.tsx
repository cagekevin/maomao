import { Pagination, type PaginationProps } from '@mantine/core'
import { cn } from '../utils/cn'

export type DesignPaginationProps = PaginationProps

export function DesignPagination({ className, radius = 'sm', ...props }: DesignPaginationProps): JSX.Element {
  const rootClassName = cn('tc-design-pagination', 'flex items-center gap-1', className)

  return <Pagination {...props} className={rootClassName} radius={radius} />
}
