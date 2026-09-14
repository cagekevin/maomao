import { useState } from 'react';
import { cn } from '@videoEditor/utils/ui';
import { HugeiconsIcon } from '@hugeicons/react';
import { MinusSignIcon, PlusSignIcon } from '@hugeicons/core-free-icons';

interface PropertyItemProps {
  direction?: 'row' | 'column';
  children: React.ReactNode;
  className?: string;
}

export function PropertyItem({ direction = 'row', children, className }: PropertyItemProps) {
  return (
    <div
      className={cn(
        'flex gap-2',
        direction === 'row' ? 'items-center justify-between gap-6' : 'flex-col gap-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PropertyItemLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('text-muted-foreground text-xs', className)}>{children}</span>;
}

export function PropertyItemValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex-1 text-sm', className)}>{children}</div>;
}

interface PropertyGroupProps {
  /** 可选：语义化分组才需要标题（如导出弹层的「格式/质量」、文字的「背景/描边/阴影」）。
   *  自解释型分组（变换/外观/速度…）不传 title，直接省掉整行标题，不再占一行。 */
  title?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  className?: string;
  hasBorderTop?: boolean;
  hasBorderBottom?: boolean;
}

export function PropertyGroup({
  title,
  children,
  defaultExpanded = true,
  collapsible = true,
  className,
  hasBorderTop = true,
  hasBorderBottom = true,
}: PropertyGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const showHeader = Boolean(title);

  return (
    <div
      className={cn(
        'flex flex-col',
        hasBorderTop && 'border-t',
        hasBorderBottom && 'last:border-b',
        className,
      )}
    >
      {showHeader &&
        (collapsible ? (
          <button
            type="button"
            className="flex items-center justify-between p-3.5 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <PropertyGroupTitle isExpanded={isExpanded}>{title}</PropertyGroupTitle>
            <HugeiconsIcon
              icon={isExpanded ? MinusSignIcon : PlusSignIcon}
              className={cn('size-3', isExpanded ? 'text-foreground' : 'text-muted-foreground')}
            />
          </button>
        ) : (
          <div className="flex items-center justify-between p-4">
            <PropertyGroupTitle isExpanded>{title}</PropertyGroupTitle>
          </div>
        ))}
      {(showHeader && collapsible ? isExpanded : true) && (
        <div className={cn(showHeader ? 'p-3 pt-0' : 'p-3')}>{children}</div>
      )}
    </div>
  );
}

function PropertyGroupTitle({
  children,
  isExpanded = false,
}: {
  children: React.ReactNode;
  isExpanded?: boolean;
}) {
  return (
    <span
      className={cn(
        'text-xs font-medium',
        isExpanded ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}
