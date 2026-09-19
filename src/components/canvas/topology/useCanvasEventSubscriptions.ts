/**
 * 画布级独立事件订阅 hook（薄组合：原内联在 App.tsx 的多个互不依赖的全局订阅 effect 收拢至此）。
 *
 * 【定位】每个 hook 都只依赖「注入的 handler / setState」，互不耦合、不复用状态——
 *        因此可按需独立挂载。App 只负责把画布真实的 getNodes/setNodes 注入。
 *
 * 覆盖：
 *  - useProjectBackupIO()       project:import / project:export —— 完整工作流备份导入导出（自包含）。
 *
 * 【原 usePersistFailureToast 已删（2026-09-17 · TD-24-4 阶段 2）】`persist:failed` 全局总线退役后，
 * 该 hook（唯一消费者）+ `persistFailureBus` 工厂一并删除；持久化失败改由各站点 `confirmPersist` 自确认。
 *
 * 名称注释：from/to 登记见 contracts.ts 的 EVENTS 表，届时 subscribe 位置更新须同步 from 基线。
 */
import { useEffect } from 'react';
import { subscribe } from '@/components/base/core/event/eventBus';

import { showToast } from '@/components/base/core/event/toastStore';
import { logger } from '@/components/base/core/log/logger';
import { importAll, exportAll, backupToBlob } from '@/components/base/store/backupStore';
import { downloadBlob } from '@/components/base/utils/net/clipboard';

/** 完整工作流备份导入导出（对齐官方 yimao 工作流备份）：承接 project:import / project:export 事件 */
export function useProjectBackupIO(): void {
  useEffect(() => {
    const handleExport = async (): Promise<void> => {
      try {
        const backup = await exportAll();
        const blob = backupToBlob(backup);
        const filename = `yimao-workflow-backup-${new Date().toISOString().split('T')[0]}.json`;
        await downloadBlob(blob, filename);
        showToast('工作流备份导出成功', { type: 'success' });
      } catch (e) {
        logger.error('App', '导出失败', e);
        showToast('导出失败：' + ((e as Error)?.message || '未知错误'), { type: 'error' });
      }
    };
    const handleImport = (): void => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const backup = JSON.parse(String(ev.target?.result));
            const res = await importAll(backup);
            // 【TD-15-3】部分失败：数据已部分写回 → 明确告知失败项，**仍刷新**（否则停在半导入态）
            if (!res.ok && res.failed.length > 0) {
              logger.error('App', '导入部分失败', { failed: res.failed });
              showToast(
                `导入完成但有 ${res.failed.length} 项失败（${res.failed
                  .map((f) => f.projectId)
                  .join('、')}），即将刷新`,
                { type: 'warning' },
              );
              setTimeout(() => window.location.reload(), 2500);
              return;
            }
            // 非对象/非 yimao 备份/版本过高：预检拒绝，未写入任何数据 → 不刷新
            if (!res.ok) throw new Error(res.error || '导入失败');
            showToast(`导入成功（${res.ls} 配置 + ${res.canvas} 画布），即将刷新应用`, {
              type: 'success',
            });
            setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
            logger.error('App', '导入失败', err);
            // 不再一律归因"文件格式不正确"——诚实透传真实原因（版本不符 / 文件不可解析等）
            showToast(`导入失败：${(err as Error)?.message || '未知错误'}`, { type: 'error' });
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };
    const offImport = subscribe('project:import', handleImport);
    const offExport = subscribe('project:export', handleExport);
    return () => {
      offImport();
      offExport();
    };
  }, []);
}
