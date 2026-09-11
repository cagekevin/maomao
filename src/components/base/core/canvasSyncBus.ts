/**
 * 画布跨窗口同步总线（BroadcastChannel 单点）—— docs/118 §五 C2b/C4 的「广播不能丢」落点。
 *
 * 【为什么存在】画布落盘调度收口进 `projectStore`（scheduleCanvasSave/flushCanvasSave）后，
 * 原来的「落盘后广播 CANVAS_SAVED」必须跟着搬——否则同源其它窗口不再被即时提示冲突
 * （BroadcastChannel 是唯一同源 <1s 通道）。但 tabId 原由 `useCanvasSync` 持有、App 透传，
 * store 拿不到；故把「tabId + 频道名 + 广播」收成这一个小模块，广播侧与监听侧共用，
 * 同时消掉 App 与 useCanvasSync 各写一份裸频道名字面量的重复。
 *
 * 【边界】BroadcastChannel **不跨 origin / 不跨浏览器 / 不跨打包进程**
 *   （打包版 127.0.0.1:18080 ↔ 开发口 localhost:5180 = 恒不连通）。
 *   这些场景由 `useCanvasSync` 的 3s 服务端版本轮询兜底（docs/118 §五 C4）。
 */
import { generateId } from './idGen.ts';
import { logger } from './logger.ts';

/** BroadcastChannel 频道名（广播侧与监听侧唯一来源，禁止再写裸字面量） */
export const CANVAS_SYNC_CHANNEL = 'yimao_canvas_sync';

/**
 * 本窗口唯一 tabId（模块级生成一次）。
 * 广播侧带它、监听侧用它过滤「自己发的消息」——两边必须是同一个 id，
 * 否则自己保存后会被自己广播的消息当成别人的保存 → 误弹冲突红条。
 */
const tabId = generateId('tab');

export function getCanvasTabId(): string {
  return tabId;
}

/** CANVAS_SAVED 消息形状（广播侧与监听侧共用契约） */
export interface CanvasSavedMessage {
  type: 'CANVAS_SAVED';
  projectId: string;
  tabId: string;
}

/**
 * 落盘成功后广播「本窗口已保存该画布」。
 * fire-and-forget：广播失败不影响保存主链路（跨源场景本就不依赖它）。
 */
export function broadcastCanvasSaved(projectId: string): void {
  if (!projectId) return;
  try {
    const channel = new BroadcastChannel(CANVAS_SYNC_CHANNEL);
    const msg: CanvasSavedMessage = { type: 'CANVAS_SAVED', projectId, tabId };
    channel.postMessage(msg);
    channel.close();
  } catch (err) {
    logger.warn('Canvas', '广播画布同步失败', err?.message);
  }
}
