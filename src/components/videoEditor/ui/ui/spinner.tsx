import { Loader2, type LucideProps } from 'lucide-react';
import { cn } from '@/components/videoEditor/utils/ui';

function Spinner({ className, ...props }: LucideProps) {
  return (
    <Loader2
      role="status"
      aria-label="加载中"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
