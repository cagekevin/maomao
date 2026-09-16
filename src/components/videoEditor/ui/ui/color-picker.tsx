import { forwardRef } from 'react';
import { cn } from '@/components/videoEditor/utils/ui';

interface ColorPickerProps {
  /**
   * 当前色。**契约：不带 `#` 的 6 位 hex**（如 `'ff3b30'`）—— 与 `onChange` 回传的格式一致。
   * 传入带 `#` 的值也会被**入口归一**（见 `normalizeHex`）：容错在组件里，不在每个调用方。
   */
  value?: string;
  /** 实时 onChange（点选预设 / 原生取色器改动时触发）。回调值同样不带 `#`。 */
  onChange?: (value: string) => void;
  /**
   * 一次改动的**收口**（原生取色器 change / 点击预设）。
   * 消费方靠它实现"撤销栈只记一条"，故 preset 与 input 都要成对调用 onChange + onChangeEnd。
   */
  onChangeEnd?: (value: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 色值归一 —— **唯一入口**：去掉 `#`、转小写、非 6 位 hex 回退到黑。
 */
function normalizeHex(raw: string): string {
  const hex = raw.replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : '000000';
}

/** 常用色预设 —— 一排圆点，点一下即取（用户自己选的预设，保持圆形）。 */
const PRESET_COLORS = ['ff3b30', 'facc15', '22c55e', '3b82f6', 'ffffff', '000000'] as const;

const swatchStyle = ({
  hex,
  isActive,
}: {
  hex: string;
  isActive: boolean;
}): React.CSSProperties => ({
  backgroundColor: `#${hex}`,
  ...(isActive
    ? { boxShadow: '0 0 0 2px rgb(var(--ve-bg)), 0 0 0 4px rgb(var(--ve-fg) / 0.75)' }
    : null),
});

/**
 * 颜色选择器 —— **预设圆点 + 原生取色器**，不再自造色轮弹窗。
 * 自定义颜色一律走浏览器原生 `<input type="color">`（用户要求：简单、无 bug、统一）。
 */
const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ className, value = 'FFFFFF', onChange, onChangeEnd, ...props }, ref) => {
    // 归一到契约格式（不带 `#`）—— 下游所有拼接/比较都用它。
    const color = normalizeHex(value);

    const commit = (hex: string) => {
      // 与预设点击一致：onChange 填 initial + 实时应用，onChangeEnd 收口提交。
      onChange?.(hex);
      onChangeEnd?.(hex);
    };

    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
        {PRESET_COLORS.map((preset) => {
          const isActive = color === preset;
          return (
            <button
              key={preset}
              type="button"
              title={`#${preset}`}
              aria-label={`颜色 #${preset}`}
              aria-pressed={isActive}
              onClick={() => commit(preset)}
              className="ve-swatch"
              style={swatchStyle({ hex: preset, isActive })}
            />
          );
        })}

        {/* 自定义颜色：原生取色器，纯方块，无描边无圆角 */}
        <input
          type="color"
          value={`#${color}`}
          title="自定义颜色"
          aria-label="自定义颜色"
          onChange={(e) => commit(normalizeHex(e.target.value))}
          className="mao-color-input w-[18px] h-[18px]"
        />
      </div>
    );
  },
);
ColorPicker.displayName = 'ColorPicker';

export { ColorPicker };
