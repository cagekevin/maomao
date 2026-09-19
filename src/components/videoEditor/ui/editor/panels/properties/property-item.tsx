import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 属性面板原语 —— 视觉全部定义在 videoEditorTheme.css §8（.ve-pg-* / .ve-row-*）。
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
  /** 可选：语义化分组才需要标题（如导出弹层的「格式/质量」、文字的「样式」）。
   *  自解释型分组（变换/外观/速度…）不传 title，直接省掉整行标题，不再占一行。
   *  ⚠️ 一个组 = 一个折叠头。组内若还有若干并列段落，用**带顶边框的 `PropertyItem`** 作分隔行，
   *  不要再套 `PropertyGroup title` —— 那会让面板长出多个需要分别点开的折叠头。 */
  title?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  className?: string;
  /**
   * 是否在本组**上方画分隔线**。默认 **false** —— 横线只用于「主要分区」之间
   * （变换 / 外观 / 可选项），不是每个小组一条线。
   * 【为什么要改默认值】（2026-09-15 用户："有些多余的横线是可以不要的"）
   * 旧默认 `true` → 每个组都带一条边线，面板看起来像表格；
   * 且每条线自带上下留白，是"面板稀疏"的一大来源。
   */
  hasBorderTop?: boolean;
  /** 是否在本组**下方画分隔线**。默认 false（同上）。 */
  hasBorderBottom?: boolean;
  /**
   * **撑满剩余高度** —— 只给"整块占位"型分区用（空态 / 拖放区）。
   * 它把高度一路传给 `.ve-pg-body`，块内容自己用 `flex-1` 铺满。
   * 折叠分区不要用它：一个可折叠的组没有"必须占满"的理由。
   */
  grow?: boolean;
}

export function PropertyGroup({
  title,
  children,
  defaultExpanded = true,
  collapsible = true,
  className,
  hasBorderTop = false,
  hasBorderBottom = false,
  grow = false,
}: PropertyGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const showHeader = Boolean(title);

  // 【`defaultExpanded` 变化时同步】（2026-09-15 修）
  // 本组件**没有 key**，切选中元素时 React 复用同一实例 → `useState` 的初始值不会重算，
  // 于是「先选有描边的元素（展开），再选没描边的元素」会**仍显示展开** —— 与实际数据不符。
  // 这里在 `defaultExpanded` 变化时跟随一次（等价于"该分组按当前元素的真实状态走"）。
  // 用 ref 记上一次的值，避免把 `defaultExpanded` 变成每渲染都写的受控值
  // （那会让用户手动折叠后被下一帧强行掰回去）。
  const prevDefaultRef = useRef(defaultExpanded);
  useEffect(() => {
    if (prevDefaultRef.current !== defaultExpanded) {
      prevDefaultRef.current = defaultExpanded;
      setIsExpanded(defaultExpanded);
    }
  }, [defaultExpanded]);

  return (
    <div
      data-border-top={hasBorderTop || undefined}
      data-grow={grow || undefined}
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
            {/*
              【为什么是箭头，不是 ＋ / －】（2026-09-15 用户："最不和谐的就是那个折叠台"）
              旧版用 `MinusSignIcon` / `PlusSignIcon`，两个问题：
                · 形态上它们是"加一项 / 减一项"的语义（素材面板的加减号就是干这个的），
                  拿来当折叠标记，同一个图标在面板里有两个意思；
                · 方形实心笔画在这个 12px 小尺寸上非常重，紧贴同样 12px 的标题时像"又一个字"。
              折叠的标准形态是**箭头旋转**：收起 → 指右，展开 → 指下，靠方向表达状态，
              笔画轻、只占一小角，不跟标题抢注意力。两个图标都在 `.ve-pg-mark` 槽位里居中，
              于是"收起"和"展开"的图形中心完全重合 —— 切换时只有旋转感，没有跳动。
            */}
            <span className="ve-pg-mark">{isExpanded ? <ArrowDown /> : <ArrowRight />}</span>
          </button>
        ) : (
          <div className="ve-pg-static">
            <span className="ve-pg-title">{title}</span>
            <span className="ve-pg-mark" />
          </div>
        ))}
      {(showHeader && collapsible ? isExpanded : true) && (
        <div className="ve-pg-body">{children}</div>
      )}
    </div>
  );
}

// 【已删 · 退役留痕（2026-09-16）】原 `PropertySubsection`（组内小节标题，`.ve-pg-sub`）
// 已被"样式组首行带顶边框的 PropertyItem"取代 —— 背景/描边/阴影三段现在各自以一个
// `<PropertyItem className="border-t border-border/50 pt-2 mt-1">` 作分隔行（text-properties.tsx），
// 不再需要独立的小节标题组件。该组件零消费方 → 按 knip 死代码闸删除（勿恢复）。
