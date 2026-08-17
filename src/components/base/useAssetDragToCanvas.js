import { httpRequest } from './httpClient.js'

/**
 * 素材拖拽到画布的【唯一发起端】公共 hook（对齐官方 H_.jsx onDrop 的素材通道）。
 *
 * 【为什么收敛到这里】
 * 此前「把图片/视频/音频/文字素材拖到画布」的 onDragStart 在多个面板各写一遍：
 *  - AssetLibrary.jsx / GeneratedView.jsx（用 application/x-yimao-asset）
 *  - TaskCenter.jsx（用 text/plain，格式与前者不一致）
 * 接收端统一是 useAssetDropPaste.onDrop（画布侧）。这里把发起端收敛成一份：
 *  - 统一格式：全部写 application/x-yimao-asset（带 url/name/type/text，比 text/plain 信息更全）
 *  - 统一 textCache/fetchText：文字素材异步补全内容，面板间共享缓存
 * 任何面板（素材库/生成素材/任务中心/未来新面板）要支持「拖图到画布」，只用 assetDragProps(asset) 即可。
 *
 * 【用法】
 *  const { assetDragProps } = useAssetDragToCanvas()
 *  <img {...assetDragProps({ url, name, type })} />
 *
 * 【与内部排序拖拽的区别】
 * 本 hook 只负责「拖到画布新建节点」（copy 语义）。画布内部节点/图层重排（move 语义，
 * 如 ImageBox/GridMerge/OverlayEditor 的自定义 MIME）是另一回事，不要混用。
 */

// 文字素材内容缓存（模块级，面板间共享）：url → text。避免每次拖拽都重新 fetch。
const textCache = new Map()
function fetchText(url) {
  if (textCache.has(url)) return Promise.resolve(textCache.get(url))
  return httpRequest(url, { timeoutMs: 5000, retries: 0, parseJson: false })
    .then((r) => (r.ok ? r.text() : ''))
    .then((t) => {
      textCache.set(url, t)
      return t
    })
    .catch(() => '')
}

/** 素材的完整拖拽格式（统一信封） */
function assetPayload(asset, text) {
  return JSON.stringify({ url: asset.url, name: asset.name, type: asset.type, text })
}

/**
 * 生成统一拖拽属性的【纯函数】（不依赖 React，非 hook 组件如 TaskCard 也可直接用）。
 * @param {{url:string, name?:string, type?:string}} asset
 * @param {{disable?:boolean}} [opts] opts.disable 为 true 时不启用拖拽（如文件夹）
 * @returns {{ draggable:boolean, onDragStart:(e)=>void }}
 */
export function makeAssetDragProps(asset, opts = {}) {
  const dragEnabled = !opts.disable && asset && asset.url
  return {
    draggable: dragEnabled,
    onDragStart: (e) => {
      if (!dragEnabled) return
      const text = textCache.get(asset.url)
      e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, text))
      e.dataTransfer.effectAllowed = 'copy'
      // 文字内容异步补全（dataTransfer 在拖拽期间可多次 setData）
      if (asset.type === 'text' && !text) {
        fetchText(asset.url).then((t) => {
          if (t) e.dataTransfer.setData('application/x-yimao-asset', assetPayload(asset, t))
        })
      }
    },
  }
}

/** hook 版：与 makeAssetDragProps 等价，供 React 组件内取引用一致的版本 */
export function useAssetDragToCanvas() {
  return { assetDragProps: makeAssetDragProps }
}

// 供非 hook 场景（如纯函数封装）复用；面板一律走 useAssetDragToCanvas()/makeAssetDragProps()
// fetchText/textCache 从本模块统一导出，替代各面板各自的副本（AssetLibrary/GeneratedView）
export { textCache, fetchText }
