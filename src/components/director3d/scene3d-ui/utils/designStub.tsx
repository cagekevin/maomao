import React from 'react'

// NomiBrand 临时 stub：品牌 mark（logo）。简单占位。
export function NomiBrand({ markSize = 18, wordSize = 14 }: { markSize?: number; wordSize?: number }): React.ReactElement {
  void wordSize
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nomi-ink)' }}>
      <span
        style={{
          width: markSize,
          height: markSize,
          borderRadius: 4,
          background: 'var(--nomi-logo-ground, #222)',
          display: 'inline-block',
        }}
      />
    </span>
  )
}

// NomiSelect 临时 stub：支持 options / placeholder / children。之后换成你自己的 Select。
export function NomiSelect({
  ariaLabel,
  className,
  disabled,
  value,
  onChange,
  placeholder,
  options,
  children,
}: {
  ariaLabel?: string
  className?: string
  disabled?: boolean
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <select
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid rgb(var(--border-rgb))', background: 'rgb(var(--field-rgb))', color: 'rgb(var(--text-rgb))' }}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {children}
    </select>
  )
}
