/**
 * 内联资源外置（base64 → 本地 URL）—— 纯函数编排。
 *
 * 【职责】深度遍历节点 data 树，把所有 `data:` 前缀的内联字段逐个通过注入的
 * `save(dataUrl)` 落盘为本地 URL（幂等去重），返回新 data + 成功/失败计数。
 *
 * 【设计】把「遍历 + 替换」的纯逻辑从 App.jsx 抽离：
 *  - `save` 由调用方注入（真实链路注入 filesApi.saveInlineToLocal），保持本模块
 *    与网络/落盘解耦、可单测（注入 mock）。
 *  - 落盘失败（save 返回 null/原值）→ 字段保留原 base64（failed++），绝不删图。
 *  - 只返回计算结果，写回 nodes / history.record 由调用方（App）编排。
 *
 * 【语义对齐】原 App.jsx handleClearCache 内 externalizeNodeData：不可变更新，
 * 数组/对象逐层递归，`data:` 前缀才算内联资源。
 */

/** 落盘结果（**判别联合** · 本模块对注入依赖的**最小契约**）。
 *
 *  【2026-09-17 判据】原契约 `Promise<string | null>` 用 `null` 兼表失败 —— **原因当场丢失**。
 *  现改为携带生产者 `message` 的判别联合；本模块是**编排层，只转发不加工**。
 *
 *  ⚠️ 刻意**不 import** `filesApi` 的 `UploadOutcome`：本模块要与网络/落盘解耦（可注入 mock 单测），
 *  只要求**结构等价**（`filesApi.saveInlineToLocal` 的返回值天然满足）。 */
export interface SaveInlineResult {
  ok: boolean;
  /** `ok:true` → 落盘后的 URL；`ok:false` → 该字段无值。 */
  url?: string;
  /** 失败原因（**生产者给的判词**，本层只搬运）。 */
  message?: string;
}
/** 注入依赖：save 返回**判别联合**；失败时字段保留原 base64（failed++），绝不删图。 */
interface ExternalizeDeps {
  save: (dataUrl: string) => Promise<SaveInlineResult>;
}

/**
 * 把单个节点 data 树中所有内联 dataURL 外置为本地 URL。
 * @param {object} nodeData 节点 data（可含嵌套数组/对象）
 * @param {{ save: (dataUrl: string) => Promise<string|null> }} deps
 *   注入依赖：save 返回落盘后的 URL；返回 null（或原值）表示失败，保留原 base64。
 * @returns {Promise<{ data: object, converted: number, failed: number }>}
 */
export async function externalizeInlineData(
  nodeData: Record<string, unknown>,
  { save }: ExternalizeDeps,
): Promise<{
  data: Record<string, unknown>;
  converted: number;
  failed: number;
  failures: Array<{ key: string; message: string }>;
}> {
  if (!save || typeof save !== 'function') {
    throw new Error('externalizeInlineData: 缺少注入的 save 依赖');
  }
  let converted = 0;
  let failed = 0;
  /** 【2026-09-17】失败明细（字段 + 生产者判词）—— 带出去让调用方可见，不再只剩一个 `failed` 数字。 */
  const failures: Array<{ key: string; message: string }> = [];

  const walk = async (obj: unknown): Promise<unknown> => {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map((it) => (it && typeof it === 'object' ? walk(it) : it)));
    }
    if (!obj || typeof obj !== 'object') return obj;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as Record<string, unknown>)[key];
      if (typeof val === 'string' && val.startsWith('data:')) {
        const r = await save(val);
        if (r.ok && r.url && r.url !== val) {
          out[key] = r.url;
          converted++;
        } else {
          // 【2026-09-17】落盘失败保留原图（**真兜底**，不丢图）—— 但**原因不吞**：
          // 收进 `failures` 由调用方（App）决定怎么呈现，本层**只搬运**。
          out[key] = val;
          failed++;
          failures.push({ key, message: r.message || '落盘失败（未给出原因）' });
        }
      } else if (val && typeof val === 'object') {
        out[key] = await walk(val);
      } else {
        out[key] = val;
      }
    }
    return out;
  };

  return {
    data: (await walk(nodeData)) as Record<string, unknown>,
    converted,
    failed,
    failures,
  };
}
