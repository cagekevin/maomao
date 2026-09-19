/**
 * 应用设置（对齐官方 `app_settings`，前端 localStorage）。
 *
 * 官方（18-KV存储键读写面梳理.md §3.4）：app_settings 属前端 localStorage（Ar 枚举，走 Wr 层），
 * 用于持久化画布默认值、性能模式开关、AI 助手开关、小地图开关等 UI 偏好，刷新不丢。
 *
 * 本模块提供统一的 read/write + React hook，App 层用它初始化各 state 并在变化时写回。
 */
import { useSyncExternalStore } from 'react';
import { contentGet, contentSet } from '../core/contentStore.ts';
import { confirmPersist } from '../core/degrade.ts';
import { onStorageReady } from '../storage/index.ts';
import {
  buildDefaults,
  type SettingKey,
  type SettingState,
  type SettingValue,
} from '@/components/settings/settingRegistry';

const KEY: string = 'app_settings';

// 默认应用设置：单一事实来源在 settings/settingRegistry.js（新增开关只改注册表）
const DEFAULTS: SettingState = buildDefaults();

let settings: SettingState = load();

/**
 * 读设置真源。
 * 【职责边界 · 2026-09-17】`contentGet` 的失败语义由 contentStore（**真相源**）定义：它只对
 * **契约违约**（键未登记 / 值不可 stringify）抛错，且该错必须 fail-fast 暴露。
 * 本模块是**消费者**，无权把「读失败」重定义成「用默认值」——旧 `catch { return {...DEFAULTS} }`
 * 正是这种越权，且掩盖契约违约（键已登记时该 catch 不可达，纯属给读者「读可能失败」的假象）。
 */
function load(): SettingState {
  const parsed = contentGet(KEY);
  return {
    ...DEFAULTS,
    ...(parsed && typeof parsed === 'object' ? (parsed as Partial<SettingState>) : {}),
  };
}

// 订阅（供 useAppSettings）
const listeners = new Set<() => void>();
function save(): void {
  // 【2026-09-17 TD-24-4 阶段1】自确认：设置未落盘必须留痕（旧注释说的"内部留痕"是全局总线，
  // 本路径不保证被它覆盖；且"留痕"不等于"这一站确认过了"）。
  confirmPersist(contentSet(KEY, settings), { layer: 'appSettings', key: KEY });
}
function notify(): void {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): SettingState {
  return settings;
}

/** 读取某个设置（默认值兜底）。key 受 SettingKey 约束，值类型由注册表 type 派生；拼错键编译期即红 */
export function getSetting<K extends SettingKey>(key: K): SettingValue<K> {
  // 注：TS 泛型索引 settingState[K] 无法直接塌缩为 SettingValue<K>（联合索引交集问题），此处显式收窄，诚实反映形状
  return (settings[key] !== undefined ? settings[key] : DEFAULTS[key]) as SettingValue<K>;
}

/** 写入一个设置（更新内存 + 持久化 + 通知）。value 类型随 key 收窄 */
export function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): void {
  settings = { ...settings, [key]: value } as SettingState;
  save();
  notify();
  // 调试总开关桥接：同步写 window.__DEBUG_ALL，让 isDebugModuleOn（config.js）实时读到并全开 debug。
  // 这样用户在「其他设置→调试模式」一键开/关，不依赖 AI 敲 window.__DEBUG_*。
  if (key === 'debugOn') syncDebugAll(!!value);
}

/**
 * 云同步「下载云端」成功后精准重水合（TD-13 修复落地）：重读 contentStore 并通知订阅者。
 * 背景：app_settings 是模块级缓存（只在本模块 load() 时读一次），cloudSync.restoreLocal 直写
 * contentStore 后内存态会过期；此前手动路径靠 window.location.reload() 兜底（冲画布、体验差）。
 * 调用本函数即可让 UI 当轮一致，且不动画布/项目（它们不在同步清单）。
 */
export function reloadAppSettings(): void {
  settings = load();
  syncDebugAll(!!getSetting('debugOn'));
  notify();
}

/** 扩展 window 上的调试总开关（config.js isDebugModuleOn 运行时读取源；非标准窗口属性需显式声明） */
type DebugWindow = Window & { __DEBUG_ALL: boolean };

/** 把调试总开关状态同步到 window.__DEBUG_ALL（isDebugModuleOn 的实时读取源） */
function syncDebugAll(v: boolean): void {
  if (typeof window !== 'undefined') (window as unknown as DebugWindow).__DEBUG_ALL = !!v;
}

// 应用加载初始化：若已持久化的调试总开关为开（云同步/刷新恢复），启动即同步 window.__DEBUG_ALL，
// 否则刷新后 debug 会因 window 为新的而丢失开启状态。
syncDebugAll(!!getSetting('debugOn'));

/**
 * 【TD-02-2】存储预填就绪后重读一次：扩展环境下 ESM 求值早于 main.tsx 的 `initStorage()`，
 * 模块级 `let settings = load()` 只能拿到默认值 → 整会话「设置全变默认」。
 * 与 cloudSync 的 `reloadAppSettings()` 同款动作（重读 + notify），差别只在触发时机。
 */
onStorageReady(() => {
  settings = load();
  syncDebugAll(!!getSetting('debugOn'));
  notify();
});

/** React hook：订阅 app_settings */
export function useAppSettings(): SettingState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
