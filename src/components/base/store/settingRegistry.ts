/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 设置声明表（静态数组 SETTING_DEFS + buildDefaults 派生），与 runModeRegistry.js（WORK_MODE_DEFS）、
 * contracts.ts 各登记表（EVENTS/STORAGE_KEYS/NODE_TYPES/apiRegistry）同属「静态声明表」家族——兄弟。
 * 三者均为「声明式表 + 派生」，非运行时注册。新增此类先并入既有表，禁止另起新表。
 *
 * 统一设置注册表（应用设置的"单一事实来源"）。
 *
 * 【为什么收口】此前应用设置默认值散在 appSettings.js，设置页开关散在 OtherSettings.jsx，
 * 加一个开关要改两处且容易漏（默认值/开关/说明不一致或忘登记）。
 * 收口后：每项设置只在本表声明一次，自动派生三样东西——
 *  1. appSettings.js 的 DEFAULTS（默认值）
 *  2. 「其他设置」页的开关行（OtherSettings.jsx 遍历渲染，含 title/desc/icon/分组）
 *  3. 云同步：app_settings 整键已在 contracts.ts 登记 backend:'local'，本表内所有项自动随键上传/下载
 *
 * 【如何新增一个开关】只在此表末尾加一个对象：
 *  { key, type, default, ui, group, icon, title, desc }
 *  其余（默认值注入、设置页渲染、云同步）全自动，无需再改别处。
 *  type: 'boolean' → 设置页开关行；type: 'string[]' → 功能性数组偏好（无 UI 开关行，默认值/类型/云同步由本表管）。
 *
 * 【不在此表】功能性偏好/敏感项不进注册表，保持各自独立：
 *  - yimao_node_prefs（节点参数记忆，nodePrefs.js）——功能性状态，非"设置开关"
 *  - provider/account/agentModel（独立 store）——敏感或后端不同，不走 app_settings 布尔偏好
 *  - 本项目已裁定不引入 webp，故无 webp 相关开关（见 docs/18）
 *
 * 更新(2026-09-04)：推翻「pinnedTools 非布尔不进门」的旧裁定，将其纳入本表（type:'string[]'，ui:false）。
 * 原因：原裁定导致 pinnedTools 类型卡在 unknown、默认值硬编码在 App.tsx，属设置域 Seam 泄漏（接口宽如实现、
 * 默认值双真源）。注册表现支持 string[] 型项。余下 3 项（node_prefs/provider/account/agentModel）维持不进门。
 */
import { Zap, Map, Bot, Image, Bug, Pin, type LucideIcon } from 'lucide-react'

/** 设置项定义（声明式表的一行；icon 为 lucide-react 图标组件）。
 *  type 判别字段：'boolean' 为设置页开关；'string[]' 为功能性数组偏好（无 UI 开关行）。
 *  由 type + key 派生 SettingKey 联合 / 每键值类型 SettingValue，读写口子据此收窄（见 appSettings.ts）。 */
export type SettingDef =
  | {
      key: string
      type: 'boolean'
      default: boolean
      ui: boolean
      group: string
      icon: LucideIcon
      title: string
      desc: string
    }
  | {
      key: string
      type: 'string[]'
      default: string[]
      ui: boolean
      group: string
      icon: LucideIcon
      title: string
      desc: string
    }

/** 全部设置定义（顺序即「其他设置」页展示顺序） */
export const SETTING_DEFS = [
  {
    key: 'thumbnailOn',
    type: 'boolean',
    default: true,
    ui: true,
    group: '画布显示',
    icon: Image,
    title: '画布显示缩略图',
    desc: '开＝本地图片走按需小图（更快，拖拽更流畅）；关＝回原图（更清晰）。仅影响显示，不影响导出/发送。',
  },
  {
    key: 'minimapOn',
    type: 'boolean',
    default: false,
    ui: false, // 左下角已有小地图开关，不在设置页重复（保留注册表管默认值/云同步）
    group: '画布显示',
    icon: Map,
    title: '小地图',
    desc: '开＝画布角落显示总览小地图；关＝隐藏。节点非常多时开着更耗性能。',
  },
  {
    key: 'agentOpen',
    type: 'boolean',
    default: false,
    ui: false, // 画布已有 AI 助手面板打开入口，不在设置页重复（保留注册表管默认值/云同步）
    group: 'AI 助手',
    icon: Bot,
    title: 'AI 助手面板',
    desc: '开＝应用启动时默认展开 AI 助手面板；关＝收起，需要时再打开。',
  },
  {
    key: 'performanceMode',
    type: 'boolean',
    default: true,
    ui: false, // 左下角小菜单已有独立开关，不在设置页重复（保留注册表管默认值/云同步）
    group: '性能',
    icon: Zap,
    title: '性能模式',
    desc: '开＝缩放/平移时降低渲染开销（官方默认开）；关＝更细腻但更吃性能。',
  },
  {
    key: 'debugOn',
    type: 'boolean',
    default: false, // 默认关：debug 日志是排障噪音，日常保持安静
    ui: true,
    group: '调试',
    icon: Bug,
    title: '调试模式',
    desc: '开＝控制台(F12→Console)输出全部调试日志，排查 bug 用；关＝安静。可自己随时开关，不依赖 AI。',
  },
  {
    key: 'pinnedTools',
    type: 'string[]',
    default: ['imageBoxNode', 'gridSplitNode', 'panoramaNode'], // 固定到右键菜单第一层的节点；默认 3 个常用（复刻官方 H_.jsx pt）
    ui: false, // 无 UI 开关行：由各节点右键菜单图钉动作 toggle（App.tsx togglePinTool）。本表管默认值/类型/云同步三者
    group: '画布显示',
    icon: Pin,
    title: '固定工具栏',
    desc: '固定到右键菜单第一层的节点集合（图钉管理），持久化到 app_settings.pinnedTools。',
  },
] as const

/** 元素类型（as-const 字面量联合；含每键的 `key`/`type`/`default` 等细化类型） */
type SettingDefAny = (typeof SETTING_DEFS)[number]

/** 合法设置键联合（读写口子据此收窄；拼错键编译期即红） */
export type SettingKey = SettingDefAny['key']

/** 每键类型映射（key → 具体条目） */
type SettingDefByKey = { [D in SettingDefAny as D['key']]: D }

/** type → 运行时值类型 */
type SettingValueOf = { boolean: boolean; 'string[]': string[] }

/** 某键的值类型（由注册表 type 字段派生） */
export type SettingValue<K extends SettingKey> = SettingValueOf[SettingDefByKey[K]['type']]

/** 全量设置状态（useAppSettings / getSnapshot 返回值） */
export type SettingState = { [K in SettingKey]: SettingValue<K> }

/** 设置页可渲染的行（仅 ui:true 的 boolean 行）。从 as-const 元素类型提取 boolean 子集，
 *  免得 OtherSettings 遍历时行 key 混入 string[]（setSetting 按 key 收窄会类型断裂）。 */
export type UISettingDef = Extract<SettingDefAny, { type: 'boolean' }>

/** 供设置页渲染的行（仅 ui:true） */
export const UI_SETTING_ROWS: UISettingDef[] = SETTING_DEFS.filter(
  (s): s is UISettingDef => s.ui
)

/** 由注册表派生 DEFAULTS（appSettings.js 用它做默认值）。
 *  用 Record<string,unknown> 桥接逐键赋值，规避 TS 对按 key 推导在联合索引时塌缩成交集的问题。 */
export function buildDefaults(): SettingState {
  const d = {} as SettingState
  for (const s of SETTING_DEFS) (d as Record<string, unknown>)[s.key] = s.default
  return d
}