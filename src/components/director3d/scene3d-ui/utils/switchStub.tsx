import React from 'react'

// Switch 临时 stub：兼容 Nomi 的 onCheckedChange + id 用法。之后换成你的风格。
export function Switch({
  checked,
  onChange,
  onCheckedChange,
  label,
  title,
  disabled,
  id,
}: {
  checked?: boolean
  onChange?: (checked: boolean) => void
  onCheckedChange?: (checked: boolean) => void
  label?: string
  title?: string
  disabled?: boolean
  id?: string
}): React.ReactElement {
  return (
    <label
      className="scene3d-switch"
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked ?? false}
        disabled={disabled}
        onChange={(e) => {
          onChange?.(e.target.checked)
          onCheckedChange?.(e.target.checked)
        }}
        style={{ accentColor: 'rgb(var(--accent-rgb))' }}
      />
      {label ? <span>{label}</span> : null}
    </label>
  )
}
