/**
 * 统一「本地预览 URL 生命周期」管理器 —— 预览 Blob 的 create / 引用计数 / revoke 唯一入口。
 *
 * 背景：此前 `URL.createObjectURL` 散落各节点（TextNode / FaceMosaic / VideoExtract / VideoProcess /
 * AgentPanel 等 ≥10 处），且多数只 create 不 revoke（配对率仅 40%），长期运行内存泄漏。
 *
 * 本模块收口「纯预览」语义：
 *  - create(blob) → url：创建预览 URL，并记 1 次引用；
 *  - release(url)：引用减 1，减到 0 才真正 revokeObjectURL（避免组件仍渲染时白图）；
 *  - clear()：清空全部（组件/面板卸载兜底）。
 *
 * 收敛边界（不做的事，见 spec/CONTEXT §二⑤）：
 *  - 下载（clipboard.downloadUrl/downloadBlob）是一次性，已自带 revoke，不归这里；
 *  - videoEngine.uploadResult 的临时 URL 是「持久化降级兜底」，刷新失效为已知行为，不归这里；
 *  - director3d 外部仓库不改。
 *
 * 依赖分类：In-process（纯浏览器内存态）。唯一外部依赖为全局 `URL`，经构造参数注入以便测试。
 * 测试用 fake urlFactory 记录 create/revoke 调用即可，无需 Adapter。
 *
 * 用法：
 *   const url = previewUrls.create(blob)
 *   ...渲染 <img src={url}/>
 *   卸载/替换素材时 previewUrls.release(url)
 *   （单例模块级导出，见文件底部 export；如需独立实例可调 createPreviewUrlManager）
 */

/** 依赖注入的 URL 工厂（默认 globalThis.URL；测试可传 fake 记录 create/revoke） */
export interface PreviewUrlFactory {
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

/** 预览 URL 生命周期管理器契约 */
export interface PreviewUrlManager {
  create(blob?: Blob | null): string | null
  release(url?: string | null): void
  clear(): void
  activeCount(): number
}

export function createPreviewUrlManager(urlFactory: PreviewUrlFactory = globalThis.URL): PreviewUrlManager {
  // key: url 字符串, value: { refCount }
  // 每次 create 都生成独立 url（真实 URL.createObjectURL 每次返回新地址），按 url 记账引用。
  // 方案 A 不做同 blob 去重（那是方案 C 的 WeakMap 语义），语义更简单直接。
  const registry = new Map<string, { refCount: number; blob: Blob }>()

  function create(blob?: Blob | null): string | null {
    if (!blob) return null
    const url = urlFactory.createObjectURL(blob)
    registry.set(url, { refCount: 1, blob })
    return url
  }

  function release(url?: string | null): void {
    if (!url) return
    const entry = registry.get(url)
    if (!entry) return // 已 revoke / 未登记 → 幂等，不抛
    entry.refCount -= 1
    if (entry.refCount <= 0) {
      registry.delete(url)
      urlFactory.revokeObjectURL(url)
    }
  }

  function clear(): void {
    for (const url of registry.keys()) {
      urlFactory.revokeObjectURL(url)
    }
    registry.clear()
  }

  /** 已登记（未释放到 0）的预览 URL 数量，供测试/调试。 */
  function activeCount(): number {
    return registry.size
  }

  return { create, release, clear, activeCount }
}

/** 模块级单例：全工程预览 URL 生命周期统一走它。 */
const previewUrls = createPreviewUrlManager()

export default previewUrls
