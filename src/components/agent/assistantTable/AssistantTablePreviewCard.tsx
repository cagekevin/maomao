/**
 * AI 助手表格 —— 预览卡组件（渲染在对话消息流里）。
 *
 * 只显示「AI 这次发来的新内容」（整表或单行），不做旧→新内联 diff：
 * 用户左表 = 当前/旧态、右卡 = AI 新内容，天然左右对比（用户裁定，勿回退成 diff）。
 * 仅渲染 + 回调；确认/取消由上层（AgentPanel）执行真正的写回（预览与正式表两份状态）。
 */
import { useState, type ReactNode } from 'react';
import type { AssistantTablePreview } from './assistantTable.ts';
import Icon from './icons.tsx';

export interface AssistantTablePreviewCardProps {
  preview: AssistantTablePreview;
  sending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 折叠摘要文案：某行未在本次写回中被改动 → 收起，聚焦改动行 */
export default function AssistantTablePreviewCard({
  preview,
  sending = false,
  onConfirm,
  onCancel,
}: AssistantTablePreviewCardProps) {
  // 本次「确认后会写回变化」的行（下标集合）；空/缺省 → 不做折叠，全部展开
  const changedIndexes = preview.changedIndexes ?? [];
  const changedSet = new Set(changedIndexes);
  const foldable = changedIndexes.length > 0 && changedIndexes.length < preview.rows.length;
  // 折叠态：默认把「未改动行」收起，只展开改动行（点击摘要可展开看全部）
  const [folded, setFolded] = useState(true);
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

  // 表体行渲染：折叠时把「本次未被改动的行」合成一条摘要（点击展开），只完整展开改动行。
  const cellOf = (r: Record<string, string>) =>
    preview.columns.map((c, ci) => <td key={ci}>{r[c] ?? ''}</td>);
  const rowOf = (r: Record<string, string>, ri: number) => (
    <tr key={ri} className={changedSet.has(ri) ? 'atw-pv-ai' : undefined}>
      {cellOf(r)}
    </tr>
  );
  const foldSummary = (count: number, key: string) => (
    <tr key={key} className="atw-pv-fold" onClick={() => setFolded(false)}>
      <td colSpan={preview.columns.length || 1}>
        <span className="atw-pv-fold-hint">其余 {count} 行未改动 · 点击展开查看全部</span>
      </td>
    </tr>
  );
  function renderRows(): ReactNode {
    const total = preview.rows.length;
    if (!foldable || !folded) {
      // 无折叠价值（changed 空/全量）或已展开 → 全展开；仍给改动行高亮
      return preview.rows.map((r, ri) => rowOf(r, ri));
    }
    // 折叠态：改动行完整展开，未改动行按连续段折叠成摘要（保相对顺序）
    const nodes: ReactNode[] = [];
    let i = 0;
    while (i < total) {
      if (changedSet.has(i)) {
        nodes.push(rowOf(preview.rows[i], i));
        i += 1;
      } else {
        // 一段连续的「未改动行」
        let j = i;
        while (j < total && !changedSet.has(j)) j += 1;
        nodes.push(foldSummary(j - i, `fold-${i}`));
        i = j;
      }
    }
    return nodes;
  }

  return (
    <div className="atw-pv">
      <div className="atw-pv-hd">
        <span className="badge">
          {preview.rowIndex != null ? `第 ${preview.rowIndex} 行` : opLabel}
        </span>
        <span>AI 生成 · 未写入</span>
        <span className="spacer" />
        <span className="rows">
          {preview.rowIndex != null
            ? '单行'
            : foldable
              ? `改动 ${changedIndexes.length} 行 · 其余 ${preview.rows.length - changedIndexes.length} 行已折叠`
              : `共 ${preview.rows.length} 行`}
        </span>
      </div>
      {preview.globalStyle && (
        <div className="atw-style-line">
          <b>全局：</b>
          <span>{preview.globalStyle}</span>
        </div>
      )}
      <div className="atw-pv-body">
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
          <tbody>{renderRows()}</tbody>
        </table>
      </div>
      <div className="atw-pv-ft">
        <button type="button" className="btn btn-ok" onClick={onConfirm} disabled={sending}>
          <Icon name="check" size={12} strokeWidth={2.5} />
          {preview.rowIndex != null ? `确认写回第 ${preview.rowIndex} 行` : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
