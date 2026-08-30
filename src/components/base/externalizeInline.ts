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

/** 注入依赖：save 返回落盘后的 URL；返回 null（或原值）表示失败，保留原 base64。 */
interface ExternalizeDeps {
  save: (dataUrl: string) => Promise<string | null>
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
  { save }: ExternalizeDeps
): Promise<{ data: Record<string, unknown>; converted: number; failed: number }> {
  if (!save || typeof save !== 'function') {
    throw new Error('externalizeInlineData: 缺少注入的 save 依赖')
  }
  let converted = 0
  let failed = 0

  const walk = async (obj: unknown): Promise<unknown> => {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map((it) => (it && typeof it === 'object' ? walk(it) : it)))
    }
    if (!obj || typeof obj !== 'object') return obj
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      const val = (obj as Record<string, unknown>)[key]
      if (typeof val === 'string' && val.startsWith('data:')) {
        const url = await save(val)
        if (url && url !== val) {
          out[key] = url
          converted++
        } else {
          out[key] = val // 落盘失败保留原图，不丢
          failed++
        }
      } else if (val && typeof val === 'object') {
        out[key] = await walk(val)
      } else {
        out[key] = val
      }
    }
    return out
  }

  return { data: (await walk(nodeData)) as Record<string, unknown>, converted, failed }
}