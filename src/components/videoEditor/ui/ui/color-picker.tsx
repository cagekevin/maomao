import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@videoEditor/utils/ui';

interface ColorPickerProps {
  /**
   * 当前色。**契约：不带 `#` 的 6 位 hex**（如 `'ff3b30'`）—— 与 `onChange` 回传的格式一致。
   * 传入带 `#` 的值也会被**入口归一**（见 `normalizeHex`）：容错在组件里，不在每个调用方。
   */
  value?: string;
  /** 实时 onChange（拖动色轮时高频触发）。回调值同样不带 `#`。 */
  onChange?: (value: string) => void;
  /**
   * 一次改动的**收口**（拖拽松手 / 点击预设）。
   * 【消费方约定】属性面板靠这一对实现"撤销栈只记一条"：
   * `onChange` = 记下改动前的值 + 实时应用；`onChangeEnd` = 回滚到改动前 + 以 pushHistory:true 提交最终值。
   * ⚠️ `onChangeEnd` 的实现在消费方有 `if (initial !== null)` 守卫 → **它依赖 `onChange` 先跑过一次**。
   */
  onChangeEnd?: (value: string) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 色值归一 —— **唯一入口**：去掉 `#`、转小写、非 6 位 hex 回退到黑。
 *
 * 【为什么要有它】消费方传参格式曾有两种（`'#000000'` 与 `'000000'`）——
 * 同一真相两种格式，下游任何拼接（如 `style={{ backgroundColor: '#' + value }}`）
 * 都会在带 `#` 那一路变成 `##000000`。契约（不带 `#`）由本组件定义，
 * **容错也由本组件承担**，调用方不必各写一次 `.replace`。
 */
function normalizeHex(raw: string): string {
  const hex = raw.replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : '000000';
}

/**
 * 常用色预设 —— **一排色块，点一下即取**。
 *
 * 【为什么是这一组】与 `base/editors/ImageEditor.tsx` 的标注色保持一致
 * （红/黄/绿/蓝/白/黑）—— 两个域用同一组"基本色"，用户在不同面板里见到的是同一套。
 * 【纪律】不要再往这里加"品牌色 / 主题色"这类语义色：它是**通用基本色**，
 * 需要的自定义色由色轮弹窗承担（见组件底部）。
 */
const PRESET_COLORS = ['ff3b30', 'facc15', '22c55e', '3b82f6', 'ffffff', '000000'] as const;

/**
 * 色块样式 = **只有颜色 + 选中态**，尺寸/形状/边框交给 `.ve-swatch`（ve-theme.css §7 控件规格）。
 *
 * 【为什么这里不写宽度/圆角】
 * "面板里的点选控件多大、什么形状"是**面板级规格**，不是这个组件的事 ——
 * 一处分在 JS 里、一处分在 CSS 里，就会出现"改了主题这排还是旧尺寸"。
 * 组件只负责给出**这一格是什么颜色**（数据），以及**是否是当前值**（状态）。
 *
 * 【当前色不在预设里时】额外给它是"选中"的语义：它此刻就是面板上唯一显示当前色的地方，
 * 不能让它看起来和旁边 6 个未选中的预设色块一样。
 */
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

const hexToHsv = (hex: string) => {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / diff) % 6;
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
  }

  h = (h * 60 + 360) % 360;
  if (Number.isNaN(h)) h = 0;

  return [h, s, v];
};

const hsvToHex = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
};

const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
  ({ className, value = 'FFFFFF', onChange, onChangeEnd, containerRef, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isDragging, setIsDragging] = useState<'saturation' | 'hue' | null>(null);
    const [pickerPosition, setPickerPosition] = useState({
      right: 0,
      bottom: 0,
    });
    const [internalHue, setInternalHue] = useState(0);

    const pickerRef = useRef<HTMLDivElement>(null);
    const saturationRef = useRef<HTMLButtonElement>(null);
    const hueRef = useRef<HTMLButtonElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const latestDragColorRef = useRef<string | null>(null);

    // 归一到契约格式（不带 `#`）—— 下游所有拼接/比较都用它，不再直接用 `value`。
    const color = normalizeHex(value);
    // "当前色是否就在预设里"：决定**自定义色块要不要顶替它显示当前色**（不在预设里时它是唯一显示位）。
    const isPresetColor = (PRESET_COLORS as readonly string[]).includes(color);

    const [h, s, v] = hexToHsv(color);
    const displayHue = s > 0 ? h : internalHue;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
      return undefined;
    }, [isOpen]);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        if (isDragging === 'saturation' && saturationRef.current) {
          const rect = saturationRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          latestDragColorRef.current = hsvToHex(displayHue, x, 1 - y);
          onChange?.(latestDragColorRef.current);
        }

        if (isDragging === 'hue' && hueRef.current) {
          const rect = hueRef.current.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const newH = x * 360;
          // 与 `applyHue` 同语义（含"灰度上色"）：拖拽路径也要走同一条，不能两处各判一次 `s > 0`。
          setInternalHue(newH);
          latestDragColorRef.current = s > 0 ? hsvToHex(newH, s, v) : hsvToHex(newH, 1, 1);
          onChange?.(latestDragColorRef.current);
        }
      };

      const handleMouseUp = () => {
        if (latestDragColorRef.current !== null && onChangeEnd) {
          onChangeEnd(latestDragColorRef.current);
          latestDragColorRef.current = null;
        }
        setIsDragging(null);
      };

      if (isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }
      return undefined;
    }, [isDragging, displayHue, s, v, onChange]);

    const handleSaturationMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const saturationElement = saturationRef.current;
      if (!saturationElement) return;
      setIsDragging('saturation');
      const rect = saturationElement.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      latestDragColorRef.current = hsvToHex(displayHue, x, 1 - y);
      onChange?.(latestDragColorRef.current);
    };

    const applyHue = ({ newH }: { newH: number }) => {
      setInternalHue(newH);
      // 【为什么灰度也要上色】（2026-09-15 修）
      // 原实现在 `s === 0`（白/灰/黑）时**只改内部 hue、不上报** → 用户拖色相条，
      // 色轮手柄动了、画面却一动不动，看起来像"坏掉了"。正确语义：在灰度上定色相 =
      // "给这个灰度上色"，即用完整饱和度的该色相替换当前值 —— 这也是各家的通行行为。
      const newHex = s > 0 ? hsvToHex(newH, s, v) : hsvToHex(newH, 1, 1);
      latestDragColorRef.current = newHex;
      onChange?.(newHex);
    };

    const handleHueMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      const hueElement = hueRef.current;
      if (!hueElement) return;
      setIsDragging('hue');
      const rect = hueElement.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      applyHue({ newH: x * 360 });
    };

    const saturationStyle = {
      background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${displayHue}, 100%, 50%))`,
    };

    const hueStyle = {
      background:
        'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
    };

    return (
      <div className="relative flex-1">
        {/*
          【为什么不再有 hex 输入框】（2026-09-15 用户："颜色色值居然要让用户自己输"）
          旧实现把一个裸的 hex 文本框摆在一排里 —— 用户得自己敲 `FF0000`。
          正确形态照 `base/editors/ImageEditor.tsx` 的标注取色：
            · 一排**预设色块**（点一下即取，最常用）；
            · 一个**自定义色块**（点开弹色轮弹窗，取任意色）。
          **不再暴露任何色值文本** —— 颜色是"选"的，不是"输"的。
          自定义色块当前色即 `value`：用户一眼能看到现在是什么色、并能直接拖色轮微调。
        */}
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
                onClick={() => {
                  // ⚠️ **两个都必须调，顺序不能反，也不能"优化"掉任一个**：
                  // 消费方（属性面板）的约定是 —— `onChange` = "记下改动前的值 + 实时应用"；
                  // `onChangeEnd` = "回滚到改动前 + 以 pushHistory:true 提交最终值"（撤销栈只一条）。
                  // 而 `onChangeEnd` 内部有 `if (initial !== null)` 守卫 → **不先调 onChange 它会直接空跑**。
                  // 故：onChange 负责"填 initial"，onChangeEnd 负责"收口提交"。
                  onChange?.(preset);
                  onChangeEnd?.(preset);
                }}
                className="ve-swatch"
                style={swatchStyle({ hex: preset, isActive })}
              />
            );
          })}

          {/*
            自定义色块 —— **它同时是"当前色"的显示位**（用户 2026-09-15：
            "一个颜色是默认色，你还要同时留一个方框，让用户可以自己选自定义的…那个选色卡"）。
            · 底色 = 当前色：不在预设里时，用户靠**这一格**知道现在是什么色；
            · 点了开色轮弹窗（保留原有 HSV 面板，它是这个组件里做对的部分）；
            · 与预设色块区分：这格带一个"调色"缺口标记（见内层 span），一眼看出"它可以展开"。
          */}
          <button
            ref={triggerRef}
            type="button"
            title={'自定义颜色'}
            aria-label={'自定义颜色'}
            aria-expanded={isOpen}
            className="ve-swatch relative"
            style={swatchStyle({ hex: color, isActive: !isPresetColor })}
            onClick={() => {
              if (!isOpen && triggerRef.current && containerRef?.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                setPickerPosition({
                  right: window.innerWidth - containerRect.left - 8,
                  bottom: window.innerHeight - containerRect.bottom,
                });
              }
              setIsOpen(!isOpen);
            }}
          >
            {/* 右下角一个"调色"小三角缺口：纯色块 vs 可展开的色块，形状上就分得开。 */}
            <span
              className="pointer-events-none absolute right-0 bottom-0"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderBottom: '6px solid rgb(var(--ve-fg, 40 40 40) / 0.75)',
              }}
            />
          </button>
        </div>

        {/*
          色轮弹窗 —— 用 **ve token** 而不是画布 token。
          【为什么】它 `createPortal` 到 `document.body`，**已经不在 `.ve-scope` 里** ——
          `bg-popover` / `border-border` 在编辑器外层拿到的是宿主画布色（深色），
          在亮色编辑器里就是一块格格不入的深色浮片。故这里的颜色全部显式取 `--ve-*`
          （带宿主回落值，见 `ve-tailwind-colors.ts` 的约定）。
        */}
        {isOpen &&
          createPortal(
            <div
              ref={pickerRef}
              className="fixed z-modal-raise rounded-xl border p-3 shadow-xl select-none"
              style={{
                right: pickerPosition.right,
                bottom: pickerPosition.bottom,
                backgroundColor: 'rgb(var(--ve-bg, 255 255 255))',
                borderColor: 'rgb(var(--ve-border, 200 200 200))',
                boxShadow: '0 12px 32px rgb(0 0 0 / 0.24)',
              }}
            >
              <button
                ref={saturationRef}
                className="relative mb-3 h-32 w-48 cursor-crosshair appearance-none rounded-lg border-0 bg-transparent p-0"
                style={saturationStyle}
                type="button"
                onMouseDown={handleSaturationMouseDown}
              >
                <ColorCircle
                  size="sm"
                  position={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
                  color={`#${color}`}
                />
              </button>

              <button
                ref={hueRef}
                className="relative h-4 w-48 cursor-pointer rounded-lg appearance-none border-0 bg-transparent p-0"
                style={hueStyle}
                type="button"
                onMouseDown={handleHueMouseDown}
              >
                <ColorCircle
                  size="md"
                  position={{
                    left: `${(displayHue / 360) * 100}%`,
                    top: '50%',
                  }}
                  color={`#${hsvToHex(displayHue, 1, 1)}`}
                />
              </button>
            </div>,
            document.body,
          )}
      </div>
    );
  },
);
ColorPicker.displayName = 'ColorPicker';

const ColorCircle = ({
  size,
  position,
  color,
}: {
  size: 'sm' | 'md';
  position: { left: string; top: string };
  color: string;
}) => (
  <div
    className={`pointer-events-none absolute rounded-full border-3 border-white shadow-lg ${
      size === 'sm' ? 'size-3' : 'size-4'
    }`}
    style={{
      left: position.left,
      top: position.top,
      transform: 'translate(-50%, -50%)',
      backgroundColor: color,
    }}
  />
);

export { ColorPicker };
