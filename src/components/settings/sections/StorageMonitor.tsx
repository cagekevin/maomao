import React from 'react';
import { RefreshCw, HardDrive, Database, CircleAlert, Boxes, CopyX } from 'lucide-react';
import { formatBytes, formatBytesParts } from '@/components/base/core/utils';
import { showToast } from '@/components/base/core/event/toastStore';
import { estimateBrowserStorage, estimateStoragePressure } from '@/components/base/storage/index';
import { fetchStorageHealth, deleteStorageFile } from '@/components/base/api/localToolApi';

/**
 * 设置分区 · 存储健康（对齐外部 StorageHealthCenter 的操作模式）。
 *
 * ── 数据流（下个 AI 改这前必读）──
 *  挂载 → runScan() 并行两路：
 *   ├─ estimateBrowserStorage() → navigator.storage.estimate() → browser state（保留的浏览器配额卡）
 *   └─ fetchStorageHealth()     → localTool /api/admin/storage-health → report state
 *  report 是后端一次聚合成形的存储健康总报表（数据源在 localTool/src/routes/admin.ts）：
 *   ├─ byCategory  按文件类别（图片/视频/音频/文本/其他）占用 → 总览圆环图 DonutChart
 *   ├─ projects[]  各项目占用（画布 KV + 该画布引用的磁盘文件）→ 条状图 StackedBar + 项目卡片
 *   ├─ orphans[]   磁盘有、全库无引用的孤儿文件 → 可清理
 *   └─ duplicates[] 同 size+name 的重复文件组 → 仅未引用副本可清理
 *  可释放空间 reclaimableBytes = 孤儿 + 重复未引用副本。只读展示；删除走 deleteStorageFile。
 *
 * ── 为什么对齐后端而非浏览器存储 ──
 *  真实数据全在 localTool KV + uploads/ 磁盘（画布/任务/素材），Chrome 扩展存储非压力源。
 *  因此「已存占用估算 / 按功能分类画像」两张浏览器存储卡已被本健康报表取代；浏览器配额卡仅作完整性展示。
 *
 * ── 操作模式（照搬外部 StorageHealthCenter）──
 *  清理 = 按问题分类，不做整项目删除：孤儿 / 重复两个 tab 内「单条删除」+「全部清理」。
 *  重复组里标「在用」的副本（被画布/任务/素材引用）不提供删除，绝不误删。
 *
 * ── 红线 ──
 *  前端不直接碰磁盘；只调 /api/admin/delete-file（后端把关路径穿越 + 全库引用），
 *  删除后 runScan() 重扫刷新。清理是破坏性操作，前端在逻辑上已排除「在用」文件，但仍以
 *  后端 skipped:'referenced' 兜底 + showToast 二次可见。
 *
 * ── 样式（2026-09-23 设置页重写）──
 *  除图表外一律走 `settings.css` 的 `st-` 类；辅助色只用红（破坏性/失败）与绿（在用/通过）。
 *  **图表配色是本页唯一的例外**：CATEGORY_COLORS / PROJECT_COLORS 保留彩色（用户裁定
 *  「存储那里可以有蓝色，它不影响整体色彩」）。故圆环/占用条**不要**按辅助色纪律去色，
 *  用户可见的蓝色分段是有意保留的。
 */
/* ── 后端 /api/admin/storage-health 报表形状（对齐 localToolApi.fetchStorageHealth 返回）── */
interface StorageHealthReportData {
  totalBytes: number;
  fileCount: number;
  byCategory: Record<string, { count: number; size: number }>;
  projects: Array<{
    projectId: string;
    projectName: string;
    kvBytes: number;
    fileBytes: number;
    fileCount: number;
  }>;
  orphans: Array<{ path: string; name: string; size: number; category: string }>;
  duplicates: Array<{
    name: string;
    size: number;
    count: number;
    files: Array<{ path: string; size: number; referenced: boolean }>;
    reclaimable: number;
  }>;
  orphanBytes: number;
  reclaimableBytes: number;
  scannedAt: number;
}

export default function StorageMonitor() {
  const [browser, setBrowser] = React.useState<{
    usage: number;
    quota: number;
    ratio: number;
  } | null>(null);
  const [report, setReport] = React.useState<StorageHealthReportData | null>(null); // fetchStorageHealth().data
  const [scanning, setScanning] = React.useState(true);
  const [activeSection, setActiveSection] = React.useState('overview');
  const [deleting, setDeleting] = React.useState<Set<string>>(new Set()); // 正在删除的相对路径集

  const runScan = React.useCallback(async () => {
    setScanning(true);
    try {
      const [b, r] = await Promise.all([
        estimateBrowserStorage(),
        fetchStorageHealth().then((res) => res?.data ?? null),
      ]);
      setBrowser(b);
      setReport(r);
    } catch (e) {
      showToast('存储扫描失败：' + ((e as { message?: string })?.message || '未知错误'), {
        type: 'error',
      });
    } finally {
      setScanning(false);
    }
  }, []);

  React.useEffect(() => {
    runScan();
  }, [runScan]);

  const pressure = browser ? estimateStoragePressure(browser.ratio) : null;

  // ── 单文件删除（孤儿 / 重复副本共用）──
  const handleDeleteFile = React.useCallback(
    async (path: string, name: string) => {
      setDeleting((prev) => new Set(prev).add(path));
      try {
        const res = await deleteStorageFile(path);
        const d = res?.data;
        if (d?.ok) {
          showToast(`已删除：${name}`, { type: 'success' });
          await runScan();
        } else if (d?.skipped === 'referenced') {
          showToast(`${name} 正在使用，无法删除`, { type: 'warning' });
        } else {
          showToast('删除失败', { type: 'error' });
        }
      } catch (e) {
        showToast('删除失败：' + ((e as { message?: string })?.message || '未知错误'), {
          type: 'error',
        });
      } finally {
        setDeleting((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [runScan],
  );

  // ── 全部清理孤儿（逐个安全删除，后端逐一裁决引用）──
  const handleDeleteAllOrphans = React.useCallback(async () => {
    if (!report || report.orphans.length === 0) return;
    setScanning(true);
    try {
      let ok = 0;
      for (const o of report.orphans) {
        const d = (await deleteStorageFile(o.path))?.data;
        if (d?.ok) ok++;
      }
      await runScan();
      showToast(`已清理 ${ok} 个孤儿文件`, { type: 'success' });
    } catch {
      showToast('清理失败', { type: 'error' });
    } finally {
      setScanning(false);
    }
  }, [report, runScan]);

  // ── 全部清理重复（只清未引用副本）──
  const handleDeleteAllDuplicates = React.useCallback(async () => {
    if (!report) return;
    const targets = report.duplicates.flatMap((g) => g.files).filter((f) => !f.referenced);
    if (targets.length === 0) return;
    setScanning(true);
    try {
      let ok = 0;
      for (const f of targets) {
        const d = (await deleteStorageFile(f.path))?.data;
        if (d?.ok) ok++;
      }
      await runScan();
      showToast(`已清理 ${ok} 个重复文件`, { type: 'success' });
    } catch {
      showToast('清理失败', { type: 'error' });
    } finally {
      setScanning(false);
    }
  }, [report, runScan]);

  const d = report; // 后端总报表（data）
  const hasReport = !!d;

  return (
    <div className="st-section">
      {/* 顶部操作栏 */}
      <div className="st-page-head">
        <div>
          <h2 className="st-section-title">
            <HardDrive size={17} /> 存储健康中心
          </h2>
          <p className="st-section-sub">检测各项目的存储占用与可优化空间（localTool 本地引擎）</p>
        </div>
        <button className="st-btn" type="button" onClick={runScan} disabled={scanning}>
          <RefreshCw size={14} />
          {scanning ? '扫描中…' : '重新扫描'}
        </button>
      </div>

      {/* 浏览器存储配额卡片（保留作完整性展示） */}
      <BrowserQuotaCard data={browser} pressure={pressure} />

      {/* 扫描中骨架 */}
      {scanning && !report && (
        <div className="st-empty">
          <RefreshCw size={24} />
          <span>正在分析存储状况…</span>
        </div>
      )}

      {/* 报表主体 */}
      {hasReport && d && (
        <ReportView
          report={d}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          deleting={deleting}
          onDeleteFile={handleDeleteFile}
          onDeleteAllOrphans={handleDeleteAllOrphans}
          onDeleteAllDuplicates={handleDeleteAllDuplicates}
        />
      )}

      {/* 后端不可用降级（红：失败态） */}
      {!scanning && !hasReport && (
        <div className="st-notice st-notice--danger">
          无法连接本地引擎存储（localTool 未启动或 /api/admin/storage-health 不可用）
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   报表主体：总览圆环图 + 项目条状图 + 孤儿/重复两个清理 tab
   ──────────────────────────────────────────────────────────────── */

const CATEGORY_COLORS: Record<string, string> = {
  图片: '#34d399',
  视频: '#60a5fa',
  音频: '#fbbf24',
  文本: '#a78bfa',
  其他: '#94a3b8',
};
const PROJECT_COLORS = [
  '#6366f1',
  '#22d3ee',
  '#34d399',
  '#f472b6',
  '#fbbf24',
  '#a78bfa',
  '#fb923c',
  '#38bdf8',
  '#4ade80',
  '#facc15',
];

function formatShortPath(filePath: string, maxLen = 40): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.replace(/\\/g, '/').split('/');
  if (parts.length <= 2) return filePath;
  return `${parts.slice(0, 1).join('/')}/.../${parts[parts.length - 1]}`;
}

function ReportView({
  report,
  activeSection,
  setActiveSection,
  deleting,
  onDeleteFile,
  onDeleteAllOrphans,
  onDeleteAllDuplicates,
}: {
  report: StorageHealthReportData;
  activeSection: string;
  setActiveSection: (v: string) => void;
  deleting: Set<string>;
  onDeleteFile: (path: string, name: string) => void;
  onDeleteAllOrphans: () => void;
  onDeleteAllDuplicates: () => void;
}) {
  const categorySegments = Object.entries(report.byCategory || {})
    .map(([label, info]) => ({
      label,
      value: info.size,
      color: CATEGORY_COLORS[label] || '#94a3b8',
    }))
    .sort((a, b) => b.value - a.value);

  const projectSizes = (report.projects || []).map((p) => ({
    projectId: p.projectId,
    projectName: p.projectName,
    kvBytes: p.kvBytes || 0,
    fileBytes: p.fileBytes || 0,
    fileCount: p.fileCount || 0,
    total: (p.fileBytes || 0) + (p.kvBytes || 0),
  }));
  // 项目条状图只统计「画布引用」的磁盘文件，而总占用含素材库/任务产物等未归属文件。
  // 补一个「素材库/未归属」段，让条状图总和 = 总占用，与圆环图/总占用口径一致，避免对不上。
  const projFileTotal = projectSizes.reduce((s, p) => s + p.fileBytes, 0);
  const sharedBytes = Math.max(0, (report.totalBytes || 0) - projFileTotal);
  const barItems = [
    ...projectSizes.map((p, i) => ({
      label: p.projectName,
      value: p.fileBytes,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
    })),
    ...(sharedBytes > 0
      ? [{ label: '素材库 / 未归属', value: sharedBytes, color: '#64748b' }]
      : []),
  ].sort((a, b) => b.value - a.value);

  const issues = [
    {
      id: 'orphans',
      label: '孤儿文件',
      count: (report.orphans || []).length,
      size: report.orphanBytes || 0,
      color: '#f472b6',
    },
    {
      id: 'duplicates',
      label: '重复文件',
      count: (report.duplicates || []).length,
      size: (report.duplicates || []).reduce((s, g) => s + (g.reclaimable || 0), 0),
      color: '#fb923c',
    },
  ].filter((s) => s.count > 0);

  const totalProjects = (report.projects || []).length;

  return (
    <div className="st-stack">
      {/* 总览卡：左容量圆环 + 右统计格（一行多列） */}
      <div className="st-card">
        <div className="st-grid st-grid--auto st-grid--gap-lg">
          <DonutChart segments={categorySegments} total={report.totalBytes || 0} size={150} />
          <div className="st-stack st-stack--sm">
            <div className="st-stats">
              <Stat label="总占用空间" value={formatBytes(report.totalBytes || 0)} />
              <Stat label="可释放空间" value={formatBytes(report.reclaimableBytes || 0)} />
              <Stat label="文件数量" value={`${report.fileCount || 0} 个文件`} />
              <Stat label="项目数量" value={`${totalProjects} 个项目`} />
            </div>
            {issues.length > 0 && (
              <div className="st-cluster">
                {issues.map((s) => (
                  <button
                    key={s.id}
                    className="st-btn st-btn--sm"
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                  >
                    <span className="st-dot" style={{ backgroundColor: s.color }} />
                    {s.label}
                    <span className="st-hint">{s.count}</span>
                  </button>
                ))}
                {report.reclaimableBytes > 0 && (
                  <span className="st-chip st-chip--danger">
                    <CircleAlert size={11} /> 可清理 {formatBytes(report.reclaimableBytes)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 各项目占用：条状图 */}
      <div className="st-card">
        <h3 className="st-card-title st-inline">
          <Boxes size={15} /> 各项目占用空间
        </h3>
        {projectSizes.length === 0 ? (
          <div className="st-hint">暂无项目数据</div>
        ) : (
          <StackedBar items={barItems} />
        )}
      </div>

      {/* 详情 tab 切换 */}
      <div className="st-tabs">
        {[
          { id: 'overview', label: '概览' },
          {
            id: 'orphans',
            label: `孤儿文件${(report.orphans || []).length ? ` (${report.orphans.length})` : ''}`,
          },
          {
            id: 'duplicates',
            label: `重复文件${(report.duplicates || []).length ? ` (${report.duplicates.length})` : ''}`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`st-tab${activeSection === tab.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === 概览：项目明细 === */}
      {activeSection === 'overview' && (
        <div className="st-card st-card--rows st-divide">
          {projectSizes.map((p) => (
            <div key={p.projectId} className="st-row">
              <div className="st-row-text st-grow">
                <div className="st-kv">
                  <span className="st-row-title st-truncate">{p.projectName}</span>
                  <span className="st-row-title st-num">{formatBytes(p.total)}</span>
                </div>
                <div className="st-row-desc">
                  磁盘文件 {p.fileCount} 个 · {formatBytes(p.fileBytes)} · 画布数据{' '}
                  {formatBytes(p.kvBytes)}
                </div>
              </div>
            </div>
          ))}
          {projectSizes.length === 0 && <div className="st-empty">暂无项目</div>}
        </div>
      )}

      {/* === 孤儿文件 tab === */}
      {activeSection === 'orphans' && (
        <div className="st-stack st-stack--sm">
          {(report.orphans || []).length === 0 ? (
            <div className="st-empty">没有孤儿文件，所有文件均有引用</div>
          ) : (
            <>
              <div className="st-between">
                <span className="st-hint">
                  共 {(report.orphans || []).length} 个孤儿文件，可释放{' '}
                  {formatBytes(report.orphanBytes || 0)}
                </span>
                {/* 破坏性操作：红 */}
                <button
                  className="st-btn st-btn--sm st-btn--danger"
                  type="button"
                  onClick={onDeleteAllOrphans}
                >
                  全部清理
                </button>
              </div>
              <div className="st-card st-card--rows st-divide">
                {(report.orphans || []).map((o) => (
                  <div key={o.path} className="st-row">
                    <div className="st-row-text st-grow">
                      <div className="st-row-title st-truncate" title={o.path}>
                        {o.name}
                      </div>
                      <div className="st-row-desc">
                        {formatShortPath(o.path)} · {formatBytes(o.size)}
                      </div>
                    </div>
                    <button
                      className="st-btn st-btn--sm st-btn--danger"
                      type="button"
                      onClick={() => onDeleteFile(o.path, o.name)}
                      disabled={deleting.has(o.path)}
                    >
                      {deleting.has(o.path) ? '…' : '删除'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* === 重复文件 tab === */}
      {activeSection === 'duplicates' && (
        <div className="st-stack st-stack--sm">
          {(report.duplicates || []).length === 0 ? (
            <div className="st-empty">没有重复文件</div>
          ) : (
            <>
              <div className="st-between">
                <span className="st-hint">
                  重复文件共可释放{' '}
                  {formatBytes(
                    (report.duplicates || []).reduce((s, g) => s + (g.reclaimable || 0), 0),
                  )}
                </span>
                <button
                  className="st-btn st-btn--sm st-btn--danger"
                  type="button"
                  onClick={onDeleteAllDuplicates}
                >
                  <CopyX size={12} /> 全部清理
                </button>
              </div>
              <div className="st-card st-card--rows st-divide">
                {(report.duplicates || []).map((g, gi) => (
                  <div key={`${g.name}-${gi}`} className="st-row st-row--top">
                    <div className="st-row-text st-grow">
                      <div className="st-row-title st-truncate" title={g.name}>
                        {g.name}
                      </div>
                      <div className="st-row-desc">
                        {g.count} 份 · 可释放 {formatBytes(g.reclaimable || 0)}
                      </div>
                      <div className="st-stack st-stack--xs">
                        {g.files.map((f) => (
                          <div key={f.path} className="st-between">
                            {/* 「在用」是状态 ⇒ 跟路径同排；动作（删除）单独在右侧，不混在一行 */}
                            <span className="st-inline st-grow">
                              <span className="st-hint st-truncate" title={f.path}>
                                {formatShortPath(f.path)}
                              </span>
                              {f.referenced && <span className="st-chip st-chip--ok">在用</span>}
                            </span>
                            <span className="st-inline">
                              <span className="st-hint st-num">{formatBytes(f.size)}</span>
                              {!f.referenced ? (
                                <button
                                  className="st-btn st-btn--sm st-btn--danger"
                                  type="button"
                                  onClick={() => onDeleteFile(f.path, g.name)}
                                  disabled={deleting.has(f.path)}
                                >
                                  {deleting.has(f.path) ? '…' : '删除'}
                                </button>
                              ) : (
                                <span className="st-chip">在用作废</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 统计项 ── */
interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="st-stat">
      <div className="st-stat-label">{label}</div>
      <div className="st-stat-value">{value}</div>
    </div>
  );
}

/* ── ECharts 风格 SVG 圆环图（对外部 StorageHealthCenter 的 DonutChart 视觉对齐）── */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function buildDonutPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
  cr: number,
  gapDeg: number,
) {
  const sa = startAngle + gapDeg / 2;
  const ea = endAngle - gapDeg / 2;
  const sweep = ea - sa;
  if (sweep <= 0) return '';
  const largeArc = sweep > 180 ? 1 : 0;
  const rad = sweep * (Math.PI / 180);
  const cornerR = Math.min(cr, (outerR - innerR) / 2, (innerR * rad) / 2);
  const outDeg = (cornerR / outerR) * (180 / Math.PI);
  const inDeg = (cornerR / innerR) * (180 / Math.PI);
  const oStart = polarToCartesian(cx, cy, outerR, sa + outDeg);
  const oEnd = polarToCartesian(cx, cy, outerR, ea - outDeg);
  const oEndCorner = polarToCartesian(cx, cy, outerR, ea);
  const oEndSide = polarToCartesian(cx, cy, outerR - cornerR, ea);
  const iEndSide = polarToCartesian(cx, cy, innerR + cornerR, ea);
  const iEndCorner = polarToCartesian(cx, cy, innerR, ea);
  const iEnd = polarToCartesian(cx, cy, innerR, ea - inDeg);
  const iStart = polarToCartesian(cx, cy, innerR, sa + inDeg);
  const iStartCorner = polarToCartesian(cx, cy, innerR, sa);
  const iStartSide = polarToCartesian(cx, cy, innerR + cornerR, sa);
  const oStartSide = polarToCartesian(cx, cy, outerR - cornerR, sa);
  const oStartCorner = polarToCartesian(cx, cy, outerR, sa);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `Q ${oEndCorner.x} ${oEndCorner.y} ${oEndSide.x} ${oEndSide.y}`,
    `L ${iEndSide.x} ${iEndSide.y}`,
    `Q ${iEndCorner.x} ${iEndCorner.y} ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    `Q ${iStartCorner.x} ${iStartCorner.y} ${iStartSide.x} ${iStartSide.y}`,
    `L ${oStartSide.x} ${oStartSide.y}`,
    `Q ${oStartCorner.x} ${oStartCorner.y} ${oStart.x} ${oStart.y}`,
    'Z',
  ].join(' ');
}
interface DonutSegment {
  label: string;
  value: number;
  color: string;
  start?: number;
  sweep?: number;
  pct?: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  size?: number;
}

function DonutChart({ segments, total, size = 150 }: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.28;
  const outerR = size * 0.46;
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  // 【ADR-0004】「数字 / 单位」分两行渲染走**生产者的结构化出口**，不再从显示串 `.split(' ')` 反解析
  //   （那等于给 `formatBytes` 加一条未文档化的结构契约，且属三铁律③「消费者自造」）。
  const totalParts = formatBytesParts(total);
  if (!segments || segments.length === 0 || !total) {
    return (
      <div className="st-donut">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={outerR}
            strokeWidth={outerR - innerR}
            className="st-donut-ring-empty"
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            className="st-chart-value"
            fontSize="13"
            fontWeight="400"
          >
            0 B
          </text>
        </svg>
      </div>
    );
  }
  let cursor = 0;
  const slices = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const s = { ...seg, start: cursor, sweep, pct: (seg.value / total) * 100 };
    cursor += sweep;
    return s;
  });
  return (
    <div className="st-donut">
      <div className="st-legend">
        {slices.map((s, i) => (
          <div
            key={i}
            className="st-legend-item"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span className="st-legend-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={buildDonutPath(cx, cy, innerR, outerR, s.start, s.start + s.sweep, size * 0.02, 2)}
            fill={s.color}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              cursor: 'pointer',
              opacity: hoverIdx === null || hoverIdx === i ? 0.92 : 0.4,
              transition: 'opacity .2s ease',
            }}
          />
        ))}
        {hoverIdx !== null ? (
          <>
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              className="st-chart-value"
              fontSize="16"
              fontWeight="400"
            >
              {slices[hoverIdx].pct.toFixed(0)}%
            </text>
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              className="st-chart-label"
              fontSize="12"
              fontWeight="400"
            >
              {formatBytes(slices[hoverIdx].value)}
            </text>
          </>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              className="st-chart-value"
              fontSize="14"
              fontWeight="400"
            >
              {totalParts ? totalParts.value : '—'}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              className="st-chart-sub"
              fontSize="11"
            >
              / {totalParts ? totalParts.unit : 'B'}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/* ── SVG 条状图（各项目占用，对外部 StackedBar 对齐）── */
interface BarItem {
  label: string;
  value: number;
  color: string;
  pct?: number;
}

interface StackedBarProps {
  items: BarItem[];
}

function StackedBar({ items }: StackedBarProps) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (items.length === 0 || !total) {
    return <div className="st-hint">暂无数据</div>;
  }
  const segments = items.map((item) => ({ ...item, pct: (item.value / total) * 100 }));
  return (
    <div className="st-stack st-stack--sm">
      <div className="st-stack-bar">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="st-stack-bar-seg"
            style={{
              width: `${seg.pct}%`,
              backgroundColor: seg.color,
              opacity: 0.88,
              borderRadius:
                i === 0 ? '6px 0 0 6px' : i === segments.length - 1 ? '0 6px 6px 0' : undefined,
            }}
            title={`${seg.label}: ${formatBytes(seg.value)} (${seg.pct.toFixed(1)}%)`}
          />
        ))}
      </div>
      <div className="st-stack-legend">
        {segments.map((seg, i) => (
          <div key={i} className="st-stack-legend-item">
            <span className="st-legend-dot" style={{ backgroundColor: seg.color }} />
            <span className="st-truncate st-legend-name" title={seg.label}>
              {seg.label}
            </span>
            <span className="st-hint st-num">{seg.pct.toFixed(0)}%</span>
            <span className="st-hint st-num">{formatBytes(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 浏览器存储配额卡片（保留）：IndexedDB/Cache 配额 + 受压预警 ── */
interface BrowserQuotaCardProps {
  data: { usage: number; quota: number; ratio: number } | null;
  pressure: ReturnType<typeof estimateStoragePressure> | null;
}

function BrowserQuotaCard({ data, pressure }: BrowserQuotaCardProps) {
  const under = pressure?.underPressure;
  const idleIndexedDb = !!data && data.usage === 0;
  return (
    <div className={under ? 'st-card st-card--danger' : 'st-card'}>
      <div className="st-card-head">
        <Database size={16} className="st-row-icon" />
        <span className="st-card-title">浏览器存储配额（IndexedDB / Cache）</span>
        {under && <CircleAlert size={14} className="st-danger-text" />}
      </div>
      <p className="st-hint">
        {under
          ? '配额即将用尽，自动保存可能失败，建议清理下方可释放空间'
          : 'IndexedDB / Cache 的浏览器分配配额。maomao 主体业务数据存在 localTool／localStorage，但剪辑器的素材元数据仍写在 IndexedDB，故此处占用未必为 0'}
      </p>
      {data ? (
        <>
          <div className="st-inline">
            <span className="st-stat-value st-num">{formatBytes(data.usage)}</span>
            <span className="st-hint">
              / {formatBytes(data.quota)}（{(data.ratio * 100).toFixed(1)}%）
            </span>
          </div>
          {/* 进度条：宽度由数据驱动（内联 style）；受压才染红，正常为中性灰 */}
          <div className="st-bar st-bar--lg">
            <div
              className={`st-bar-fill${under ? ' is-danger' : ''}`}
              style={{ width: `${Math.min(100, data.ratio * 100)}%` }}
            />
          </div>
          {idleIndexedDb && (
            <p className="st-hint">
              浏览器报告的 IndexedDB 占用为 0（或极小）属常见；真正占用看上方存储健康报表
            </p>
          )}
        </>
      ) : (
        <div className="st-empty">浏览器未暴露存储统计（无法读取配额）</div>
      )}
    </div>
  );
}
