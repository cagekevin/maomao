// app-shell 窗口条 stub（仅 win32 自绘标题栏）。web 环境返回 null。
import React from 'react'

export function WindowControls({ className }: { className?: string }): React.ReactElement | null {
  void className
  return null
}

export function handleWindowTitlebarDoubleClick(): void {
  /* noop */
}
