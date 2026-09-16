'use client';

import { Button } from '@/components/videoEditor/ui/ui/button';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { ArrowLeft, Search } from 'lucide-react';

/**
 * 带返回键的搜索行。
 *
 * 【为什么重写】旧实现把返回键做成**绝对定位浮层**（`motion.div` + 运行时用
 * `getBoundingClientRect().left` 算出 `buttonOffset` 把它推到容器外，靠 `x` 平移"藏起来"）：
 *   · 它浮在搜索框的图层之上，隐藏与显示都靠位移 —— 两个元素**互相遮挡**；
 *   · 偏移量依赖挂载时刻的布局位置，面板被拖动改宽 / 换 tab 后就不再对；
 *   · 父容器没有 `overflow-hidden`，"藏起来"的按钮其实还在可点区域里。
 *
 * 正确形态：**"是否进入某一层"是行内布局的一部分** —— 返回键是搜索行的兄弟节点，
 * 出现时把搜索框挤窄（flex 自然消化），消失时不占位、不可点。无需任何像素计算。
 */
interface InputWithBackProps {
  /** 是否处于"已进入某一层"（如已进到某个图标集合里）—— 为真时左侧出现返回键。 */
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function InputWithBack({
  isExpanded,
  setIsExpanded,
  placeholder = 'Search anything',
  value,
  onChange,
}: InputWithBackProps) {
  return (
    <div className="flex items-center gap-2">
      {isExpanded && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="返回"
          onClick={() => setIsExpanded(false)}
          className="shrink-0"
        >
          <ArrowLeft />
        </Button>
      )}
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder={placeholder}
          className="w-full pl-9"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}
