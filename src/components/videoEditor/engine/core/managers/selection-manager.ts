import type { EditorCore } from '@videoEditor/engine/core';

type ElementRef = { trackId: string; elementId: string };

/** 两个选择集合是否指向同一批元素（按内容比较，不看引用）。 */
function isSameRefs(a: ElementRef[], b: ElementRef[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (ref, index) => ref.trackId === b[index].trackId && ref.elementId === b[index].elementId,
  );
}

/**
 * 时间轴元素选择。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么读取侧要过滤】选择是 `{trackId, elementId}` **引用**集合，它的有效性完全由
 * 当前场景的 tracks 决定。此前这件事被当成**调用方的责任**：UI 的 `delete-selected`
 * 记得清，而「素材连带删除」（`RemoveMediaAssetCommand` → `deleteElements`）、
 * 「删轨道」「删场景」三条路径都忘了 —— 幽灵选择漏进属性面板（白板），且同一件事
 * 有几个入口就有几份判据，必然漏（TD-22-26）。
 *
 * 本类把「**选择必须指向存在的元素**」做成**不变量**而非守卫：
 * 读取即与 tracks 求交 ⇒ 任何删除路径自动失效；撤销后元素回来，选择**自动恢复**
 * （无需命令去捕获 / 还原 `previousSelection`）；调用方不必记得任何清理动作。
 * ════════════════════════════════════════════════════════════════
 * 【引用必须稳定】UI 经 `useSyncExternalStore` 读它（`selection-overlay` /
 * `use-preview-interaction` / `use-element-selection` 三处），该 API 要求
 * `getSnapshot()` 在状态未变时返回**同一个引用** —— 否则 React 判定"每次都变了"、
 * 无限重渲染。故派生结果缓存在 `visibleElements`，**只在内容真变时**才换引用。
 */
export class SelectionManager {
  /** 选择意图（可能含已不存在的元素，读取侧负责过滤）。 */
  private selectedElements: ElementRef[] = [];
  /** 与 tracks 求交后的可见选择；**引用稳定**（见类注释）。 */
  private visibleElements: ElementRef[] = [];
  private listeners = new Set<() => void>();

  constructor(private editor: EditorCore) {
    // 时间轴 / 场景变化 ⇒ 选择的有效性可能变化（元素被删 / 整轨被删 / 切场景）。
    // 订阅后重算并（真变了才）通知，UI 才会立刻丢掉幽灵选择。
    this.editor.timeline.subscribe(this.refreshValidity);
    this.editor.scenes.subscribe(this.refreshValidity);
  }

  getSelectedElements(): ElementRef[] {
    return this.visibleElements;
  }

  setSelectedElements({ elements }: { elements: ElementRef[] }): void {
    this.selectedElements = elements;
    this.refreshValidity();
    this.notify();
  }

  clearSelection(): void {
    this.selectedElements = [];
    this.refreshValidity();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 重算可见选择；内容有变才替换引用并广播（保 `useSyncExternalStore` 契约）。 */
  private refreshValidity = (): void => {
    const next = this.computeVisibleElements();
    if (isSameRefs(next, this.visibleElements)) return;

    this.visibleElements = next;
    this.notify();
  };

  private computeVisibleElements(): ElementRef[] {
    const tracks = this.editor.scenes.getActiveSceneOrNull()?.tracks ?? [];
    if (this.selectedElements.length === 0 || tracks.length === 0) {
      return [];
    }

    const existing = new Set<string>();
    for (const track of tracks) {
      for (const element of track.elements) {
        existing.add(`${track.id}:${element.id}`);
      }
    }

    return this.selectedElements.filter((ref) => existing.has(`${ref.trackId}:${ref.elementId}`));
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
