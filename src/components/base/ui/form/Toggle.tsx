/**
 * 小型开关组件（中性黑白：开启 = 反色实心）。
 *
 * 抽公共：OtherSettings / SkillSettings 原本各定义一份逐字相同的 Toggle（download/REPORT P2 重复代码）。
 * 归到 settings/ 根，sections 内复用（现存消费者仅 OtherSettings / SkillSettings 两处，同属设置页）。
 * 更新(2026-09-23)：原「对齐整体 zinc 风格，**开启为青蓝色**（bg-cyan-400）」已废弃 ——
 *   用户裁定设置页辅助色只允许红与绿、不准出现蓝色；开关是高频控件，一旦上色即属"滥用"。
 *   改为**反色承担强调**：开 = 近白轨道 + 深色圆点；关 = 深灰轨道 + 白点。两态均为中性灰阶。
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
        ${checked ? 'bg-inverse' : 'bg-surface-2'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform shadow-sm
          ${checked ? 'translate-x-5 bg-inverse-strong' : 'translate-x-1 bg-white'}`}
      />
    </button>
  );
}
