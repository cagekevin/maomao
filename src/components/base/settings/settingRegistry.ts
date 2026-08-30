/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 设置声明表（静态数组 SETTING_DEFS + buildDefaults 派生），与 runModeRegistry.js（WORK_MODE_DEFS）、
 * contracts.js 各登记表（EVENTS/STORAGE_KEYS/NODE_TYPES/apiRegistry）同属「静态声明表」家族——兄弟。
 * 三者均为「声明式表 + 派生」，非运行时注册。新增此类先并入既有表，禁止另起新表。
 *
 * 统一设置注册表（应用设置的"单一事实来源"）。
 *
 * 【为什么收口】此前应用设置默认值散在 appSettings.js，设置页开关散在 OtherSettings.jsx，
 * 加一个开关要改两处且容易漏（默认值/开关/说明不一致或忘登记）。
 * 收口后：每项设置只在本表声明一次，自动派生三样东西——
 *  1. appSettings.js 的 DEFAULTS（默认值）
 *  2. 「其他设置」页的开关行（OtherSettings.jsx 遍历渲染，含 title/desc/icon/分组）
 *  3. 云同步：app_settings 整键已在 contracts.js 登记 backend:'local'，本表内所有项自动随键上传/下载
 *
 * 【如何新增一个开关】只在此表末尾加一个对象：
 *  { key, default, ui, group, icon, title, desc }
 *  其余（默认值注入、设置页渲染、云同步）全自动，无需再改别处。
 *
 * 【不在此表】非布尔/功能性偏好不进注册表，保持各自独立：
 *  - pinnedTools（固定工具数组，App.jsx 内部管理）——非布尔、无 UI 开关
 *  - yimao_node_prefs（节点参数记忆，nodePrefs.js）——功能性状态，非"设置开关"
 *  - provider/account/agentModel（独立 store）——敏感或后端不同，不走 app_settings 布尔偏好
 *  - 本项目已裁定不引入 webp，故无 webp 相关开关（见 docs/18）
 */
import { Zap, Map, Bot, Image, Bug, type LucideIcon } from 'lucide-react'

/** 设置开关定义（声明式表的一行；icon 为 lucide-react 图标组件） */
export interface SettingDef {
  key: string
  default: boolean
  ui: boolean
  group: string
  icon: LucideIcon
  title: string
  desc: string
}

/** 全部设置定义（顺序即「其他设置」页展示顺序） */
export const SETTING_DEFS: SettingDef[] = [
  {
    key: 'thumbnailOn',
    default: true,
    ui: true,
    group: '画布显示',
    icon: Image,
    title: '画布显示缩略图',
    desc: '开＝本地图片走按需小图（更快，拖拽更流畅）；关＝回原图（更清晰）。仅影响显示，不影响导出/发送。',
  },
  {
    key: 'minimapOn',
    default: false,
    ui: false, // 左下角已有小地图开关，不在设置页重复（保留注册表管默认值/云同步）
    group: '画布显示',
    icon: Map,
    title: '小地图',
    desc: '开＝画布角落显示总览小地图；关＝隐藏。节点非常多时开着更耗性能。',
  },
  {
    key: 'agentOpen',
    default: false,
    ui: false, // 画布已有 AI 助手面板打开入口，不在设置页重复（保留注册表管默认值/云同步）
    group: 'AI 助手',
    icon: Bot,
    title: 'AI 助手面板',
    desc: '开＝应用启动时默认展开 AI 助手面板；关＝收起，需要时再打开。',
  },
  {
    key: 'performanceMode',
    default: true,
    ui: false, // 左下角小菜单已有独立开关，不在设置页重复（保留注册表管默认值/云同步）
    group: '性能',
    icon: Zap,
    title: '性能模式',
    desc: '开＝缩放/平移时降低渲染开销（官方默认开）；关＝更细腻但更吃性能。',
  },
  {
    key: 'debugOn',
    default: false, // 默认关：debug 日志是排障噪音，日常保持安静
    ui: true,
    group: '调试',
    icon: Bug,
    title: '调试模式',
    desc: '开＝控制台(F12→Console)输出全部调试日志，排查 bug 用；关＝安静。可自己随时开关，不依赖 AI。',
  },
]

/** 供设置页渲染的行（仅 ui:true） */
export const UI_SETTING_ROWS: SettingDef[] = SETTING_DEFS.filter((s) => s.ui)

/** 由注册表派生 DEFAULTS（appSettings.js 用它做默认值）
 *  @returns {Record<string, unknown>} */
export function buildDefaults(): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  for (const s of SETTING_DEFS) d[s.key] = s.default
  return d
}