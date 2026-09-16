import { useEffect, useRef, useState } from 'react';
import { FONT_OPTIONS, type FontFamily } from '@/components/videoEditor/constants/font-constants';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/components/videoEditor/utils/ui';

interface FontPickerProps {
  /** 当前字体（受控：显示值恒等于数据，切换元素/撤销后面板显示不会停在旧值）。 */
  value?: FontFamily;
  onValueChange?: (value: FontFamily) => void;
  className?: string;
}

/**
 * 字体选择器 —— **面板流内展开**，不是飞出去的弹层。
 *
 * ══════════════════════════════════════════════════════════════
 * 【为什么不用 Radix Select / 任何 Portal 弹层】（2026-09-15 用户三次反馈
 * "字体不能选择 / 下拉面板还是没有显示 / 根本就没显示出来"）
 *
 * 属性面板里所有控件 —— 滑杆、输入框、开关、色块排、折叠组 —— 都**在面板流里**；
 * 唯独这个选择器把列表 Portal 到 `document.body` 去渲染。而编辑器根当时用
 * `z-ceiling`（int32 顶格），Portal 弹层比不过它 ——
 * **弹层弹出即在编辑器之下，被自家面板整层盖住**，一个像素都看不见。
 * （后来编辑器根归位 `z-modal`、弹层归位 `z-modal-raise`，Portal 弹层能显示了；
 * 但本组件维持面板流内展开 —— 窄面板里 4 项的列表就该在原位展开，弹层形态本就是错配。）
 *
 * 【正确形态】它该像邻居一样：点开就在**原位展开**（绝对定位、把面板流压下去靠面板自身滚动），
 * 选完收起。不 Portal → 天然继承 `.ve-scope` 的全部规格（底色/边框/字号/薄纱 hover），
 * 不需要任何"给 body 上的弹层补样式"的特例。
 *
 * 【与 ColorPicker 的差异是判据不同，不是不一致】色轮是真弹窗（大画布、需要盖住其它面板），
 * 字体列表是面板的一部分（4 项、窄面板）—— 各自选对各自的空间形态。
 * ══════════════════════════════════════════════════════════════
 */
export function FontPicker({ value, onValueChange, className }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 点击容器外收起（与面板里其它"展开态"一致的口径；列表在容器内，点它不触发）。
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {/*
        触发器 —— 24px 主控件档（`.ve-num` 同规格：透明底 + 发丝边 + 4px 圆角）。
        当前字体名用它自己的字体渲染：这格同时是"当前值"的显示位。
      */}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        className="flex h-6 w-full cursor-pointer items-center justify-between gap-1 rounded border px-2 text-left"
      >
        <span className="truncate" style={{ fontFamily: value }}>
          {value || '选择字体'}
        </span>
        {open ? (
          <ArrowUp className="size-3 shrink-0 opacity-50" />
        ) : (
          <ArrowDown className="size-3 shrink-0 opacity-50" />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-10 mt-1 w-full rounded-md border p-1 shadow-lg"
          style={{ backgroundColor: 'rgb(var(--ve-bg))' }}
        >
          {FONT_OPTIONS.map((font) => {
            const isActive = font.value === value;
            return (
              <button
                key={font.value}
                type="button"
                role="option"
                aria-selected={isActive}
                data-active={isActive || undefined}
                style={{ fontFamily: font.value }}
                onClick={() => {
                  onValueChange?.(font.value);
                  setOpen(false);
                }}
                className="ve-pick-item"
              >
                {font.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
