import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/* 动画编辑面板专用控件库（anim-ed-* 前缀，与通用 Inspector 完全隔离）    */
/* ------------------------------------------------------------------ */

export type AnimTabItem = {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
};

/** 分段式 tab 栏：品牌渐变激活 + 底部指示条 */
export function AnimTabBar({ tabs }: { tabs: AnimTabItem[] }) {
  return (
    <div className="anim-ed-tabbar" role="tablist" aria-label="动画面板分页">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={tab.active}
          className={`anim-ed-tab${tab.active ? " is-active" : ""}`}
          onClick={tab.onClick}
        >
          <span className="anim-ed-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

/** 分组卡片：带标题与可选描述 */
export function AnimSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="anim-ed-section">
      <header className="anim-ed-section-head">
        <h3 className="anim-ed-section-title">{title}</h3>
        {hint ? <p className="anim-ed-section-hint">{hint}</p> : null}
      </header>
      <div className="anim-ed-section-body">{children}</div>
    </section>
  );
}

/** 标签 + 控件 行 */
export function AnimField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="anim-ed-field">
      <span className="anim-ed-field-label">{label}</span>
      <div className="anim-ed-field-ctrl">{children}</div>
    </label>
  );
}

/** 数字输入：带步进按钮 */
export function AnimNumberInput({
  value,
  onChange,
  onBlur,
  step = 1,
  min,
  max,
  ariaLabel,
  disabled = false,
}: {
  value: number | string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const stepRef = useRef(step);
  stepRef.current = step;

  const clamp = useCallback((next: number) => {
    let v = next;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  }, [min, max]);

  const applyDelta = useCallback((delta: number) => {
    const current = Number(value);
    if (!Number.isFinite(current)) return;
    const next = clamp(current + delta * stepRef.current);
    onChange(Number(next.toFixed(4)).toString());
  }, [value, clamp, onChange]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      applyDelta(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      applyDelta(-1);
    }
  }

  return (
    <div className="anim-ed-number">
      <button
        type="button"
        className="anim-ed-number-step"
        aria-label={`${ariaLabel} 减小`}
        tabIndex={-1}
        disabled={disabled || undefined}
        onClick={() => applyDelta(-1)}
      >
        −
      </button>
      <input
        className="anim-ed-number-input"
        aria-label={ariaLabel}
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled || undefined}
        onBlur={(event) => onBlur?.(event.currentTarget.value)}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="anim-ed-number-step"
        aria-label={`${ariaLabel} 增大`}
        tabIndex={-1}
        disabled={disabled || undefined}
        onClick={() => applyDelta(1)}
      >
        +
      </button>
    </div>
  );
}

/** 滑杆 + 数字 组合 */
export function AnimSliderField({
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  step = 1,
  rangeAriaLabel,
  numberAriaLabel,
}: {
  label: string;
  value: number | string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  min: number | string;
  max: number | string;
  step?: number | string;
  rangeAriaLabel: string;
  numberAriaLabel: string;
}) {
  return (
    <div className="anim-ed-slider">
      <span className="anim-ed-slider-label">{label}</span>
      <input
        className="anim-ed-slider-range"
        type="range"
        aria-label={rangeAriaLabel}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <input
        className="anim-ed-slider-num"
        type="number"
        aria-label={numberAriaLabel}
        value={value}
        min={min}
        max={max}
        step={step}
        onBlur={(event) => onBlur?.(event.currentTarget.value)}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

/** 下拉选择 */
export function AnimSelectField({
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  ariaLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function select(option: { value: string; label: string; disabled?: boolean }) {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  }

  return (
    <div className="anim-ed-select-row" ref={rootRef}>
      <span className="anim-ed-select-label">{label}</span>
      <div className="anim-ed-select">
        <button
          type="button"
          className="anim-ed-select-trigger"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="anim-ed-select-value">{selected?.label ?? "请选择"}</span>
          <ChevronDown aria-hidden="true" className="anim-ed-select-chevron" size={14} strokeWidth={2} />
        </button>
        {isOpen ? (
          <div className="anim-ed-select-menu" role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  role="option"
                  type="button"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  className={`anim-ed-select-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => select(option)}
                >
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 按钮 */
export function AnimButton({
  children,
  onClick,
  disabled,
  variant = "default",
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost" | "danger";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`anim-ed-btn is-${variant}${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** 提示文字 */
export function AnimHint({ children }: { children: ReactNode }) {
  return <p className="anim-ed-hint">{children}</p>;
}

/** 空状态 */
export function AnimEmpty({ children }: { children: ReactNode }) {
  return <p className="anim-ed-empty">{children}</p>;
}
