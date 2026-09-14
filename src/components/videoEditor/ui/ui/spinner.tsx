import { Loader2, type LucideProps } from 'lucide-react';
import { cn } from '@videoEditor/utils/ui';

function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
