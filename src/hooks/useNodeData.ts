import { useCallback, useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { debounce } from '../components/base/core/utils.ts';
import { NODE_PATCH_DEBOUNCE_MS } from '../components/base/core/config.ts';
import { normalizeChipFieldWrite } from '../components/creative';
import type { CreativePresetEntry } from '../components/creative';

/**
 * 节点级字段不可变写回纯函数（通用：覆盖 node.data 与 node 本体字段 width/height/style/selected/...）。
 * 语义：把 patch 浅合并进 id 节点；patch.data 单独与 n.data 浅合并（不覆盖整个 data 对象）。
 * 节点不存在时原样返回，天然安全。这是 useNodeResize / App 批量命令 / 各节点写回的统一底层，
 * 与 patchNodeDataById 共用同一不可变不变式（见 TD-04-16，2026-09-12）。
 *
 * 【用法】
 *   patchNodeById(setNodes, id, { width, height, style })   // node 本体字段
 *   patchNodeById(setNodes, id, { data: { label } })        // 等价于 patchNodeDataById
 */
type NodeFieldPatch = Partial<Node> & { data?: Record<string, unknown> };

/** computePatchNodeById：纯函数版（返回新数组，不触发 setNodes），供需先拿到结果再 record 历史的调用方复用 */
export function computePatchNodeById(nodes: Node[], id: string, patch: NodeFieldPatch): Node[] {
  if (!nodes || !id || !patch) return nodes;
  const { data, ...rest } = patch;
  return nodes.map((n) =>
    n.id === id ? { ...n, ...rest, data: data ? { ...n.data, ...data } : n.data } : n,
  );
}

/** computePatchNodesById：批量版（predicate 命中即写回，用于「按类型/条件」批量命令，如展开面板） */
export function computePatchNodesById(
  nodes: Node[],
  predicate: (n: Node) => boolean,
  patch: NodeFieldPatch,
): Node[] {
  if (!nodes || !predicate || !patch) return nodes;
  const { data, ...rest } = patch;
  return nodes.map((n) =>
    predicate(n) ? { ...n, ...rest, data: data ? { ...n.data, ...data } : n.data } : n,
  );
}

export function patchNodeById(
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  id: string,
  patch: NodeFieldPatch,
): void {
  if (!setNodes || !id || !patch) return;
  setNodes((ns) => computePatchNodeById(ns, id, patch));
}

/**
 * 节点 data 不可变写回纯函数（节点 data 写回唯一入口，useNodeData.patchData 与宿主通用写回共用）。
 * 语义：把 patch 合并进 id 节点的 data（不可变更新）；节点不存在（如已删除）时原样返回，天然安全。
 * 底层复用通用 patchNodeById（见上），保持既有签名向后兼容。
 * setNodes 用 reactflow Node[] 泛型（与 useReactFlow().setNodes 及 App.jsx 传入的 setNodes 一致）。
 */
export function patchNodeDataById(
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  id: string,
  patch: Record<string, unknown>,
): void {
  if (!setNodes || !id || !patch) return;
  patchNodeById(setNodes, id, { data: patch });
}

/** patch 载荷（节点 data 局部字段合并对象） */
type Patch = Record<string, unknown>;
/** useNodeData.patchDebounced 返回形态（utils.debounce 的结构化子集，仅本模块用，就地定义） */
type PatchDebouncedFn = {
  (patch: Patch): void;
  cancel(): void;
  flush(): void;
};

/**
 * 节点 data 统一写回 hook（P0-2 收口）。
 *
 * 【为什么要有它】此前每个节点手写同一份「不可变局部更新 node.data」样板
 *   const patchData = useCallback((patch) => setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), [id])
 *   + 同款 debouncedPatch（debounce(patchData, 200)）。实测 6+ 处逐字重复
 *   （TextGenerate / VideoGenerate / ImageGenerate / TemplateNode / LoopNode / ImageBoxNode）。
 * 本 hook 统一收口，节点只需 `const { patchData, patchDebounced } = useNodeData(id)`。
 *
 * 【用法】
 *   const { patchData, patchDebounced } = useNodeData(id)
 *   patchData({ assetUrl: r.url })                 // 立即写回（成功/确认回填等关键路径）
 *   patchDebounced({ prompt })                      // 防抖写回（编辑器高频输入用）
 *
 * 【说明】
 *  - patchData 稳定性：setNodes（reactflow）与 id 均为稳定引用 → patchData 引用稳定，
 *    一次 useMemo 构造的防抖即可复用，无需每次渲染重建。
 *  - patchDebounced 卸载时自动 flush：把窗口内最后一次待提交写出，避免丢数据。
 *  - 必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setNodes），节点天然满足。
 *  - 纯逻辑不写 UI，可覆盖单测（patchData 不可变更新 / patchDebounced 防抖 + flush）。
 *  - **字典 GC（TD-05-13 · I1）**：patchData 写 `prompt`/`text` 时，会原子地把
 *    `data.creativePresets` 裁剪为「仍被胶囊引用」的子集（见 `gcCreativePresets`）。
 *    调用方无需关心——只要 prompt 经 patchData/patchDebounced 写回，孤儿字典项就不会落盘。
 *    这使「写字段」与「清孤儿」成为**同一个不可分动作**，避免两处各写一半导致的不一致。
 */
export function useNodeData(id: string): {
  patchData: (patch: Patch) => void;
  patchDebounced: PatchDebouncedFn;
  /**
   * 往 `data.creativePresets` 字典里**原子合并一条**（创作库预设用）。
   *
   * 【为什么不直接用 patchData + 展开旧值】调用方写
   * `patchData({ creativePresets: { ...data.creativePresets, [id]: entry } })`
   * 时，`data` 是**本次渲染的闭包快照**。创作库是「点一张卡插一枚胶囊」的高频连续操作：
   * 第一张卡写入后组件立刻重渲，若第二次点击发生在重渲提交前（或与 prompt 的防抖写回竞争），
   * 第二次的 `data.creativePresets` 仍是旧快照 → 把第一张的键**覆盖掉**。
   * 后果不是报错而是静默丢数据：生成时字典查不到 → 红日志「预设未命中置空」，
   * 用户看到的是「胶囊插了但生成时被吞」（2026-09-15 实测）。
   *
   * 本函数用 setNodes 的函数式更新，**在 updater 内读最新 n.data**，从结构上消除竞态：
   * 每次调用都基于「当前真正的 data」合并，连续点 N 张 = N 个键都在。
   *
   * entry 形态真源 = `CreativePresetsDict` 的值（`CreativePresetEntry`，TD-05-12 母体收口）：
   * 调用方一律经 `toDictEntry(preset)` 生产，禁在节点侧手抄字面量。
   */
  addCreativePreset: (presetId: string, entry: CreativePresetEntry) => void;
} {
  const { setNodes } = useReactFlow();
  // patchData 在通用原语之外补一步「字典归一化」（normalizeChipFieldWrite）：写 prompt/text 时
  // 原子裁剪孤儿 creativePresets。走 setNodes 函数式更新（updater 内读最新 n.data），与
  // addCreativePreset 同一竞态防护；对无字典的节点是零成本 no-op。
  const patchData = useCallback<(patch: Patch) => void>(
    (patch) => {
      if (!setNodes || !id || !patch) return;
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = (n.data ?? {}) as Record<string, unknown>;
          return { ...n, data: normalizeChipFieldWrite({ ...d, ...patch }, patch) };
        }),
      );
    },
    [id, setNodes],
  );
  const patchDebounced = useMemo(() => debounce(patchData, NODE_PATCH_DEBOUNCE_MS), [patchData]);

  const addCreativePreset = useCallback(
    (presetId: string, entry: CreativePresetEntry) => {
      if (!setNodes || !id || !presetId) return;
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const d = (n.data ?? {}) as Record<string, unknown>;
          const dict = (d.creativePresets ?? {}) as Record<string, unknown>;
          return { ...n, data: { ...d, creativePresets: { ...dict, [presetId]: entry } } };
        }),
      );
    },
    [id, setNodes],
  );

  useEffect(() => () => patchDebounced.flush(), [patchDebounced]);
  return { patchData, patchDebounced, addCreativePreset };
}
