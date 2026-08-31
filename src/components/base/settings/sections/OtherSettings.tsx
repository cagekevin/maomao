import React from 'react'
import { useAppSettings, setSetting } from '../../appSettings.ts'
import { UI_SETTING_ROWS } from '../settingRegistry.ts'
import { Toggle } from '../Toggle'

/** 单项设置行：标题 + 说明 + 右侧开关 */
function SettingRow({ icon: Icon, title, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon size={18} className="text-secondary shrink-0" />}
        <div className="min-w-0">
          <div className="settings-page-title">{title}</div>
          {desc && <div className="text-xs text-muted mt-0.5">{desc}</div>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

/**
 * 其他设置（应用设置统一收口，见 docs/18）。
 *
 * 开关由 settings/settingRegistry.js 的 UI_SETTING_ROWS 驱动——新增开关只需在注册表加一项，
 * 这里自动渲染。切换经 appSettings 持久化，且 app_settings 整键随云端同步（见 contracts.js）。
 */
export default function OtherSettings() {
  const settings = useAppSettings()

  // 按 group 分组渲染（注册表顺序即组内顺序）
  const groups = []
  for (const row of UI_SETTING_ROWS) {
    let g = groups.find((x) => x.name === row.group)
    if (!g) { g = { name: row.group, rows: [] }; groups.push(g) }
    g.rows.push(row)
  }

  return (
    <section>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.name} className="bg-surface border border-edge-subtle rounded-xl p-4">
            <div className="text-xs font-medium text-secondary mb-1">{g.name}</div>
            <div className="divide-y divide-edge-subtle/60">
              {g.rows.map((row) => {
                const checked = settings[row.key] !== undefined
                  ? Boolean(settings[row.key])
                  : Boolean(row.default)
                return (
                  <SettingRow
                    key={row.key}
                    icon={row.icon}
                    title={row.title}
                    desc={row.desc}
                    checked={checked}
                    onChange={(v) => setSetting(row.key, v)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}