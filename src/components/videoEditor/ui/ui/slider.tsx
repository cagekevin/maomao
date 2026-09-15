'use client';

import * as React from 'react';

import { cn } from '@videoEditor/utils/ui';

/**
 * 滑杆 —— **原生 `<input type="range">`，无依赖**（原 `radix-ui` 的 `Slider.Root/Track/Range/Thumb`）。
 *
 * 【为什么用原生 range 而不是自研 div 拖拽】
 * 拖拽、键盘（←/→/Home/End/PageUp）、`min/max/step` 吸附、`aria-valuenow`、
 * 触摸/笔输入 —— 原生控件**全部自带且行为正确**。手写指针拖拽的每一行，
 * 都是在重新实现浏览器已经做对的事（且 a11y 必丢）。视觉由 `.ve-slider`（ve-theme.css §7）
 * 用 `::-webkit-slider-*` / `::-moz-range-*` 接管，不需要额外 DOM。
 *
 * 【API 兼容】沿用 Radix 的**数组形态**（`value: number[]` / `onValueChange: (v: number[]) => void`）——
 * 现有 13 个调用点全部写 `value={[n]}` + `onValueChange={([v]) => …}`，零改动。
 * 仅支持单拇指（全库无多拇指用法）；需要双拇指时再扩，不到时不留空接口。
 *
 * 【填充色】原生 range 没有"已填充段"的独立伪元素（Firefox 的 `::-moz-range-progress` 除外），
 * 故用一条 `linear-gradient` + `--ve-slider-fill` 百分比表达 —— 由本组件按当前值算出。
 */
interface SliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step' | 'type'
> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  /** 一次交互"落定"时的值（指针抬起 / 键盘抬起）—— 消费方用它拍撤销快照。 */
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value,
      defaultValue,
      onValueChange,
      onValueCommit,
      min = 0,
      max = 100,
      step = 1,
      style,
      disabled,
      onPointerUp,
      onKeyUp,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const current = (isControlled ? value?.[0] : defaultValue?.[0]) ?? min;
    const span = max - min;
    const fillPercent = span > 0 ? ((current - min) / span) * 100 : 0;

    /** 提交口径：交互结束（指针抬起 / 键盘抬起）时把**元素当前值**报出去，
     *  不依赖 state 是否已回流 —— 拖拽中连续 `onValueChange`，落定时一次 `onValueCommit`。 */
    const commit = (element: HTMLInputElement) => onValueCommit?.([Number(element.value)]);

    return (
      <input
        ref={ref}
        type="range"
        className={cn('ve-slider', className)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={isControlled ? current : undefined}
        defaultValue={isControlled ? undefined : defaultValue?.[0]}
        onChange={(event) => onValueChange?.([Number(event.target.value)])}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          commit(event.currentTarget);
        }}
        onKeyUp={(event) => {
          onKeyUp?.(event);
          commit(event.currentTarget);
        }}
        /* `--ve-slider-fill` 给 CSS 画"已填充段"；放在 `...style` 之前 → 调用点仍可覆盖。 */
        style={{ ...style, ['--ve-slider-fill' as string]: `${fillPercent}%` }}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
