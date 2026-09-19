/**
 * 视频剪辑器「这一刻是否展开」的**会话态**（不持久化、不同步云端）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么不做成 appSettings 设置项】（真实缺陷，2026-09-15）
 * 它原先登记在 `settingRegistry` 的 `app_settings` 里 —— 而那个键**整键持久化 + 随云端同步**
 * （见 `contracts.ts` 的 `app_settings` 条目）。后果：
 *   ① 用户打开过一次编辑器 → 存成 `true` → **刷新后又自动打开**（用户报障：
 *      "现在默认我打开画布，Video editor 就打开了；我要点按钮才能打开"）；
 *   ② 它还会**同步到其他设备**，在新设备上凭空弹出编辑器。
 *
 * 【判据：什么该进设置、什么该是会话态】
 *   · **用户偏好**（`minimapOn` / `performanceMode` / `debugOn` / `thumbnailOn` …）
 *     —— 用户**主动选择的一种长期状态**，"刷新后仍生效"正是它该有的行为 → 持久化 ✅
 *   · **界面开没开**（本模块）—— 一次**开合动作**的即时结果，用户从没表达过
 *     "我要它永远开着" → 持久化 ❌（持久化只会让"上次不小心留着"变成"永远弹"）
 *   对照实例：整个 `modalLayer`（全屏模态层）从设计起就是纯会话态，从不持久化 ——
 *   同一个道理，剪辑器的开合同样属于"层开合"。
 *
 * 【与 modalLayer 的关系】更新(2026-09-15)：**判据已合并，状态仍独立**。
 *   · **判据**：剪辑器自 2026-09-14 起挂载 cutia 版 `EditorShell`，形态是**全屏层**
 *     （`App` 里 `fixed inset-0 z-modal` 盖住画布）—— 形态变了判据就得跟着变，
 *     故已接入 `modalLayer.isCanvasSuppressed()`（在那一处 `||` 本模块的布尔）。
 *     旧的「只让 Delete / undo / redo 三个键」（`editorKeyAction`）是给**底部常驻基座**的，
 *     基座形态已不存在 —— 它会放行 Q/W/E、⌘A/D/G/L 落到被盖住的画布，已随形态一并删除。
 *   · **状态**：仍**不共用登记表**。登记表的语义是"组件挂载期登记、卸载注销"，
 *     而剪辑器开合由一个布尔驱动条件渲染；走登记表等于把同一事实记两遍
 *     （布尔 + 登记项）= 第二份真相。
 *   · 本模块只承载"剪辑器展开与否"这一个布尔，机制与 `modalLayer` 同构
 *     （模块级状态 + 查询式读 + 订阅式通知）。
 * ════════════════════════════════════════════════════════════════
 */

/** 剪辑器是否展开。**模块级会话态**：刷新即回到默认（关）。 */
let editorOpen = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** 查询式读（与 `hasModalLayer()` 同款）——供快捷键在执行前问一次。 */
export function isEditorSessionOpen(): boolean {
  return editorOpen;
}

/**
 * 订阅式读 —— 供把"开关本身"声明成 props 的宿主使用。
 * 典型：`App` 的 React Flow `deleteKeyCode`（它在内部自挂 window 监听、绕过 useCanvasShortcuts，
 * 没有机会查询，只能靠订阅在开合时把值换掉）。
 */
export function subscribeEditorSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 开 / 关剪辑器（唯一写入口）。 */
export function setEditorSessionOpen(open: boolean): void {
  if (editorOpen === open) return;
  editorOpen = open;
  notify();
}
