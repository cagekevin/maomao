/**
 * 画布 Agent 工具的取用辅助 —— 处理 `CanvasAgentTools = Record<string, Fn>` 的索引签名。
 *
 * 【为什么需要它】
 * 工具表是按注册表动态装配的（`buildCanvasAgentTools` 遍历 `AGENT_TOOLS` 写入 `map[name]`），
 * 类型只能是 `Record<string, (args) => ToolResult>`。`noUncheckedIndexedAccess` 下
 * `t.create_node` 因此是 `Fn | undefined`，直接 `t.create_node({...})` 报 TS2722。
 *
 * 【为什么不在生产侧改成精确键】
 * `AGENT_TOOLS` 是 IIFE 返回的**运行态数组**，`typeof AGENT_TOOLS[number]['name']` 只能得到 `string`，
 * 派生不出字面量联合；手工维护 60+ 工具名会与注册表双向漂移。故把「键必然存在」的断言
 * 放在**测试取值这一处**，缺失即 throw（工具没注册 = fixture 或注册表坏了，不是可忽略分支）。
 *
 * 【禁止】`t.create_node!()`：`!` 会让"工具未注册"退化成运行时的 `undefined is not a function`，
 * 且失败信息里没有工具名。本辅助抛出的错误带工具名与现有键。
 */
import type { CanvasAgentTools } from '../../src/components/agent/canvas/useCanvasAgentTools.ts';

type AgentToolFn = CanvasAgentTools[string];

/** 取工具函数；未注册 ⇒ 抛（带工具名与已注册键，便于定位注册表漂移）。 */
export function toolOf(tools: CanvasAgentTools, name: string): AgentToolFn {
  const fn = tools[name];
  if (fn === undefined) {
    const available = Object.keys(tools).sort().join('、');
    throw new Error(`toolOf(): 工具未注册：${name}（已注册：${available || '空'}）`);
  }
  return fn;
}
