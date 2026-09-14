import { useState } from 'react';
import { cn } from '@videoEditor/utils/ui';
import { HugeiconsIcon } from '@hugeicons/react';
import { MinusSignIcon, PlusSignIcon } from '@hugeicons/core-free-icons';

/**
 * 属性面板原语 —— 视觉全部定义在 ve-theme.css §8（.ve-pg-* / .ve-row-*）。
 * 组件里只保留结构类；开关状态通过 aria-expanded 交给 CSS。
 */

interface PropertyItemProps {
  direction?: 'row' | 'column';
  children: React.ReactNode;
  className?: string;
}

export function PropertyItem({ direction = 'row', children, className }: PropertyItemProps) {
  return (
    <div className={cn('ve-row', direction === 'column' && 've-row-col', className)}>
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
  return <span className={cn('ve-row-label', className)}>{children}</span>;
}

export function PropertyItemValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('ve-row-value', className)}>{children}</div>;
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
      data-border-top={hasBorderTop || undefined}
      className={cn('ve-pg', hasBorderBottom && 'last:border-b', className)}
    >
      {showHeader &&
        (collapsible ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            className="ve-pg-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="ve-pg-title">{title}</span>
            <HugeiconsIcon icon={isExpanded ? MinusSignIcon : PlusSignIcon} />
          </button>
        ) : (
          <div className="ve-pg-static">
            <span className="ve-pg-title">{title}</span>
          </div>
        ))}
      {(showHeader && collapsible ? isExpanded : true) && (
        <div className="ve-pg-body">{children}</div>
      )}
    </div>
  );
}
