/**
 * 画布级独立事件订阅 hook（薄组合：原内联在 App.tsx 的多个互不依赖的全局订阅 effect 收拢至此）。
 *
 * 【定位】每个 hook 都只依赖「注入的 handler / setState」，互不耦合、不复用状态——
 *        因此可按需独立挂载。App 只负责把画布真实的 getNodes/setNodes 注入。
 *
 * 覆盖：
 *  - useProjectBackupIO()       project:import / project:export —— 完整工作流备份导入导出（自包含）。
 *  - useAssetUrlRewrite(g,s)    resource:renamed —— 素材改名/移动后同步画布/脚本箱节点 url 引用。
 *  - usePersistFailureToast()   persist:failed —— 持久化失败统一上报（同 key 5s 节流 / 逐 key 透传）。
 *
 * 名称注释：from/to 登记见 contracts.ts 的 EVENTS 表，届时 subscribe 位置更新须同步 from 基线。
 */
import { useEffect } from 'react'
import type { Node } from '@xyflow/react'
import { subscribe } from '../core/eventBus.ts'
import { buildUrlRewritePairs, replaceUrlDeep } from '../utils/imageUrl.ts'
import { createThrottledPersistHandler } from '../storage'
import { showToast } from '../core/toastStore.ts'
import { logger } from '../core/logger.ts'
import { importAll, exportAll, backupToBlob } from '../store/backupStore.ts'
import { downloadBlob } from '../utils/clipboard.ts'

/** setNodes 窄接口：只允许直接写回，不暴露 Dispatch 细节（useNodesState 的 setNodes 是其超集，可传入） */
type SetNodesValue = (next: Node[]) => void

/** 完整工作流备份导入导出（对齐官方 yimao 工作流备份）：承接 project:import / project:export 事件 */
export function useProjectBackupIO(): void {
  useEffect(() => {
    const handleExport = async (): Promise<void> => {
      try {
        const backup = await exportAll()
        const blob = backupToBlob(backup)
        const filename = `yimao-workflow-backup-${new Date().toISOString().split('T')[0]}.json`
        await downloadBlob(blob, filename)
        showToast('工作流备份导出成功', { type: 'success' })
      } catch (e) {
        logger.error('App', '导出失败', e)
        showToast('导出失败：' + ((e as Error)?.message || '未知错误'), { type: 'error' })
      }
    }
    const handleImport = (): void => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
          try {
            const backup = JSON.parse(String(ev.target?.result))
            const res = await importAll(backup)
            if (!res.ok) throw new Error(res.error || '导入失败')
            showToast(`导入成功（${res.ls} 配置 + ${res.canvas} 画布），即将刷新应用`, { type: 'success' })
            setTimeout(() => window.location.reload(), 1500)
          } catch (err) {
            logger.error('App', '导入失败', err)
            showToast('导入失败：文件格式不正确', { type: 'error' })
          }
        }
        reader.readAsText(file)
      }
      input.click()
    }
    const offImport = subscribe('project:import', handleImport)
    const offExport = subscribe('project:export', handleExport)
    return () => { offImport(); offExport() }
  }, [])
}

/**
 * 素材 url 变更（改名/移动）后同步画布/脚本箱节点引用（resource:renamed 由素材面板/移动 hook 广播）：
 * 把节点 data 里引用旧 url 的字段改写为新 url，setNodes 触发自动持久化（防下游图生图 404）。
 * 与后端 rewriteUrlReferences 配套：后端改库，这里改「当前打开页面内存里的节点」。
 */
export function useAssetUrlRewrite(getNodes: () => Node[], setNodes: SetNodesValue): void {
  useEffect(() => {
    const off = subscribe('resource:renamed', ({ oldUrl, newUrl }) => {
      if (!oldUrl || !newUrl || oldUrl === newUrl) return
      const pairs = buildUrlRewritePairs(oldUrl, newUrl) // 原样/编码 × 绝对/相对，与后端一致
      const nodes = getNodes()
      let changed = false
      const next = nodes.map((n) => {
        let data: Record<string, unknown> = (n.data ?? ({} as Record<string, unknown>))
        for (const [from, to] of pairs) {
          const d = replaceUrlDeep(data, from, to)
          if (d !== data) { data = d as Record<string, unknown>; changed = true }
        }
        return data === n.data ? n : { ...n, data }
      })
      if (changed) setNodes(next) // setNodes → [nodes] 自动保存 effect 落盘
    })
    return off
  }, [getNodes, setNodes])
}

/** 持久化失败统一上报：storageAdapter 的 sSet/sRemove 失败会 publish('persist:failed')，逐 key 原样透传提示 */
export function usePersistFailureToast(): void {
  useEffect(() => {
    // 节流/透传逻辑收敛到 persistFailureBus 工厂（可单测）；这里只注入 showToast 与 logger。
    const off = subscribe('persist:failed', createThrottledPersistHandler({
      onLog: (key, error, suppressed) => logger.warn('存储', 'persist:failed', { key, error: error || '', toastSuppressed: suppressed }),
      onToast: (key, error) => showToast(`数据保存失败 [${key}]${error ? `：${error}` : ''}，请检查浏览器存储空间/权限`, { type: 'error' }),
    }))
    return off
  }, [])
}