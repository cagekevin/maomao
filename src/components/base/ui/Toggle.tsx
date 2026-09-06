import React from 'react';

/**
 * 小型开关组件（对齐整体 zinc 风格，开启为青蓝色）。
 * 抽公共：OtherSettings / SkillSettings 原本各定义一份逐字相同的 Toggle（download/REPORT P2 重复代码）。
 * 归到 settings/ 根，sections 内复用。
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors border-none
        ${checked ? 'bg-cyan-400' : 'bg-surface-2'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm
          ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
}
