import { useAppSettings, setSetting } from '@/components/base/store/appSettings';
import { UI_SETTING_ROWS, type UISettingDef } from '@/components/settings/settingRegistry';
import { Toggle } from '@/components/base/ui/form/Toggle';

/** 单项设置行：标题 + 说明 + 右侧开关 */
interface SettingRowProps {
  icon: UISettingDef['icon'];
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function SettingRow({ icon: Icon, title, desc, checked, onChange }: SettingRowProps) {
  return (
    <div className="st-row">
      <div className="st-row-main">
        {Icon && <Icon size={18} className="st-row-icon" />}
        <div className="st-row-text">
          <div className="st-row-title">{title}</div>
          {desc && <div className="st-row-desc">{desc}</div>}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/**
 * 其他设置（应用设置统一收口，见 docs/18）。
 *
 * 开关由 settings/settingRegistry.ts 的 UI_SETTING_ROWS 驱动——新增开关只需在注册表加一项，
 * 这里自动渲染。切换经 appSettings 持久化到 `app_settings` 整键 —— 该键**留本机、不进云同步**
 * （`contracts.ts` 登记 `backend:'local'` 且缺 `sync:true`；原文写"整键随云端同步"与事实**矛盾**，
 * 已于 2026-09-22 订正 —— 见判据登记表 §七 #13）。
 */
export default function OtherSettings() {
  const settings = useAppSettings();

  // 按 group 分组渲染（注册表顺序即组内顺序）
  interface SettingsGroup {
    name: string;
    rows: UISettingDef[];
  }
  const groups: SettingsGroup[] = [];
  for (const row of UI_SETTING_ROWS) {
    let g = groups.find((x) => x.name === row.group);
    if (!g) {
      g = { name: row.group, rows: [] };
      groups.push(g);
    }
    g.rows.push(row);
  }

  return (
    <section className="st-section">
      <div className="st-stack">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="st-group-name">{g.name}</div>
            <div className="st-card st-card--rows st-divide">
              {g.rows.map((row) => {
                const checked =
                  settings[row.key as keyof typeof settings] !== undefined
                    ? Boolean(settings[row.key as keyof typeof settings])
                    : Boolean(row.default);
                return (
                  <SettingRow
                    key={row.key}
                    icon={row.icon}
                    title={row.title}
                    desc={row.desc}
                    checked={checked}
                    onChange={(v) => setSetting(row.key as keyof typeof settings, v)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
