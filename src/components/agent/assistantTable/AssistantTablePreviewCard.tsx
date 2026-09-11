/**
 * AI 助手表格 —— 预览卡组件（渲染在对话消息流里）。
 *
 * 只显示「AI 这次发来的新内容」（整表或单行），不做旧→新内联 diff：
 * 用户左表 = 当前/旧态、右卡 = AI 新内容，天然左右对比（用户裁定，勿回退成 diff）。
 * 仅渲染 + 回调；确认/取消由上层执行真正的写回（预览与正式表两份状态）。
 * 多标签页（spec 3.3）：头的「写入到」下拉 = 所有 tab + 「＋ 新建标签页」，切换目标表下拉重算预览；
 * 卡片顶部 6px grip 可拖高（spec 3.2）。
 */
import { useRef, useState, type ReactNode } from 'react';
import type { AssistantTablePreview } from './assistantTable.ts';
import Icon from './icons.tsx';
import TabTargetMenu from './TabTargetMenu.tsx';

export interface AssistantTablePreviewCardProps extends AssistantTablePreview {
  sending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** 目标表名（预览要写入的表）；title 里标「（当前）」用 */
  targetTabName: string;
  /** 目标表列表（所有 tab，含「＋ 新建标签页」由 onNewTarget 承接） */
  targetTabs: Array<{ id: string; name: string }>;
  onSelectTarget: (tabId: string) => void;
  onNewTarget: () => void;
  /** 预览卡当前高度（px，null=CSS 默认 clamp） */
  previewHeight: number | null;
  onGripPointerDown: (e: React.PointerEvent, cardEl: HTMLElement | null) => void;
}

/** 折叠摘要文案：某行未在本次写回中被改动 → 收起，聚焦改动行 */
export default function AssistantTablePreviewCard(props: AssistantTablePreviewCardProps) {
  const {
    sending = false,
    onConfirm,
    onCancel,
    targetTabName,
    targetTabs,
    onSelectTarget,
    onNewTarget,
    previewHeight,
    onGripPointerDown,
  } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  // 本次「确认后会写回变化」的行（下标集合）；空/缺省 → 不做折叠，全部展开
  const changedIndexes = props.changedIndexes ?? [];
  const changedSet = new Set(changedIndexes);
  const foldable = changedIndexes.length > 0 && changedIndexes.length < props.rows.length;
  const [folded, setFolded] = useState(true);
  const opLabel =
    props.opKind === 'update'
      ? props.updatedCount && props.updatedCount > 0
        ? `更新 ${props.updatedCount} 行`
        : '更新选中行'
      : props.opKind === 'append'
        ? `追加 ${props.appendedCount ?? props.rows.length} 行`
        : '重建表格';
  const confirmLabel =
    props.opKind === 'update'
      ? '确认更新选中行'
      : props.opKind === 'append'
        ? '确认追加'
        : '确认写入表格';

  // 【TD-11-11 F6 修正】rows 为位置式 string[][]（与 columns 等长对齐），按列序索引 r[ci]，
  // 杜绝原 Record<列名,值> 在「同名列」场景下静默覆盖的隐藏 bug。
  const cellOf = (r: string[]) => props.columns.map((c, ci) => <td key={ci}>{r[ci] ?? ''}</td>);
  const rowOf = (r: string[], ri: number) => (
    <tr key={ri} className={changedSet.has(ri) ? 'atw-pv-ai' : undefined}>
      {cellOf(r)}
    </tr>
  );
  const foldSummary = (count: number, key: string) => (
    <tr key={key} className="atw-pv-fold" onClick={() => setFolded(false)}>
      <td colSpan={props.columns.length || 1}>
        <span className="atw-pv-fold-hint">其余 {count} 行未改动 · 点击展开查看全部</span>
      </td>
    </tr>
  );
  function renderRows(): ReactNode {
    const total = props.rows.length;
    if (!foldable || !folded) return props.rows.map((r, ri) => rowOf(r, ri));
    const nodes: ReactNode[] = [];
    let i = 0;
    while (i < total) {
      if (changedSet.has(i)) {
        nodes.push(rowOf(props.rows[i], i));
        i += 1;
      } else {
        let j = i;
        while (j < total && !changedSet.has(j)) j += 1;
        nodes.push(foldSummary(j - i, `fold-${i}`));
        i = j;
      }
    }
    return nodes;
  }

  // ⚠️ 运行态高度必须同时把 CSS 的 max-height 顶掉：.atw-pv 自带 clamp(150px,28vh,300px)，
  // 只给 height 会被它反向截断（拖到 400px 实际只渲染 300px，且回读存进去的是截断值）。
  const cardStyle =
    previewHeight != null ? { height: `${previewHeight}px`, maxHeight: 'none' } : undefined;

  return (
    <div ref={cardRef} className="atw-pv" style={cardStyle}>
      {/* 拖动拉高手柄（spec 3.2）：顶部 6px 横向 grip */}
      <div
        className="atw-pv-grip"
        title="拖动调整预览高度"
        onPointerDown={(e) => onGripPointerDown(e, cardRef.current)}
      />
      <div className="atw-pv-hd">
        <span className="badge">
          {props.rowIndex != null ? `第 ${props.rowIndex} 行` : opLabel}
        </span>
        <span>AI 生成 · 未写入</span>
        <span className="spacer" />
        {/* 写入到哪张表下拉（spec 3.3；与行尾「复制到：」共用 TabTargetMenu） */}
        <TabTargetMenu
          tabs={targetTabs}
          currentName={targetTabName}
          label="写入到："
          title="预览确认后将写入该表"
          onPick={onSelectTarget}
          onNew={onNewTarget}
        />
        <span className="rows">
          {props.rowIndex != null
            ? '单行'
            : foldable
              ? `改动 ${changedIndexes.length} 行 · 其余 ${props.rows.length - changedIndexes.length} 行已折叠`
              : `共 ${props.rows.length} 行`}
        </span>
      </div>
      {props.globalStyle && (
        <div className="atw-style-line">
          <b>全局：</b>
          <span>{props.globalStyle}</span>
        </div>
      )}
      <div className="atw-pv-body">
        <table>
          {props.columns.length > 0 && (
            <thead>
              <tr>
                {props.columns.map((c, i) => (
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
          {props.rowIndex != null ? `确认写回第 ${props.rowIndex} 行` : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
