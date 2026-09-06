/**
 * AI 助手表格 —— 预览卡组件（渲染在对话消息流里）。
 *
 * 只显示「AI 这次发来的新内容」（整表或单行），不做旧→新内联 diff：
 * 用户左表 = 当前/旧态、右卡 = AI 新内容，天然左右对比（用户裁定，勿回退成 diff）。
 * 仅渲染 + 回调；确认/取消由上层（AgentPanel）执行真正的写回（预览与正式表两份状态）。
 */
import type { AssistantTablePreview } from './assistantTable.ts';

export interface AssistantTablePreviewCardProps {
  preview: AssistantTablePreview;
  sending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AssistantTablePreviewCard({
  preview,
  sending = false,
  onConfirm,
  onCancel,
}: AssistantTablePreviewCardProps) {
  // 操作类别文案（预览=确认：卡内展示的就是确认要写回的结果）
  const opLabel =
    preview.opKind === 'update'
      ? preview.updatedCount && preview.updatedCount > 0
        ? `更新 ${preview.updatedCount} 行`
        : '更新选中行'
      : preview.opKind === 'append'
        ? `追加 ${preview.appendedCount ?? preview.rows.length} 行`
        : '重建表格';
  const confirmLabel =
    preview.opKind === 'update'
      ? '确认更新选中行'
      : preview.opKind === 'append'
        ? '确认追加'
        : '确认写入表格';
  return (
    <div className="pv">
      <div className="pv-hd">
        <span className="badge">
          {preview.rowIndex != null ? `第 ${preview.rowIndex} 行` : opLabel}
        </span>
        <span>AI 生成 · 未写入</span>
        <span className="spacer" />
        <span className="rows">
          {preview.rowIndex != null ? '单行' : `共 ${preview.rows.length} 行`}
        </span>
      </div>
      {preview.globalStyle && (
        <div className="gs-line">
          <b>全局：</b>
          <span>{preview.globalStyle}</span>
        </div>
      )}
      <div className="pv-body">
        <table>
          {preview.columns.length > 0 && (
            <thead>
              <tr>
                {preview.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {preview.rows.map((r, ri) => (
              <tr key={ri}>
                {preview.columns.map((c, ci) => (
                  <td key={ci}>{r[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pv-ft">
        <button type="button" className="btn btn-ok" onClick={onConfirm} disabled={sending}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {preview.rowIndex != null ? `确认写回第 ${preview.rowIndex} 行` : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
