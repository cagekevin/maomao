import React from 'react';
import { RefreshCw, HardDrive, Database, CircleAlert, Boxes, CopyX } from 'lucide-react';
import { formatBytes } from '../../core/utils.ts';
import { showToast } from '../../core/toastStore.ts';
import {
  estimateBrowserStorage,
  estimateStoragePressure,
} from '@/components/base/storage/index.ts';
import { fetchStorageHealth, deleteStorageFile } from '@/components/base/api/localToolApi.ts';

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
      showToast('存储扫描失败：' + (e?.message || '未知错误'), { type: 'error' });
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
        showToast('删除失败：' + (e?.message || '未知错误'), { type: 'error' });
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
    <div className="flex flex-col gap-4">
      {/* 顶部操作栏 */}
      <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="settings-page-title flex items-center gap-2">
            <HardDrive size={17} className="text-secondary" /> 存储健康中心
          </h2>
          <p className="text-xs text-muted mt-1">
            检测各项目的存储占用与可优化空间（localTool 本地引擎）
          </p>
        </div>
        <button
          type="button"
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-medium bg-white text-black rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          {scanning ? '扫描中…' : '重新扫描'}
        </button>
      </div>

      {/* 浏览器存储配额卡片（保留作完整性展示） */}
      <BrowserQuotaCard data={browser} pressure={pressure} />

      {/* 扫描中骨架 */}
      {scanning && !report && (
        <div className="bg-surface border border-edge-subtle rounded-xl p-6 flex flex-col items-center justify-center py-10 gap-3 text-muted">
          <RefreshCw size={24} className="animate-spin text-secondary" />
          <span className="text-xs text-muted">正在分析存储状况…</span>
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

      {/* 后端不可用降级 */}
      {!scanning && !hasReport && (
        <div className="bg-surface border border-edge-subtle rounded-xl p-6 text-center text-muted text-xs">
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
    <div className="flex flex-col gap-4">
      {/* 总览卡：总占用 / 可释放 / 项目·文件数 + 问题标签 */}
      <div className="bg-surface border border-edge-subtle rounded-xl p-5">
        <div className="flex items-center gap-6 flex-wrap">
          <DonutChart segments={categorySegments} total={report.totalBytes || 0} size={150} />
          <div className="flex-1 min-w-[180px] space-y-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Stat label="总占用空间" value={formatBytes(report.totalBytes || 0)} big />
              <Stat
                label="可释放空间"
                value={formatBytes(report.reclaimableBytes || 0)}
                big
                accent={report.reclaimableBytes > 0}
              />
              <Stat label="文件数量" value={`${report.fileCount || 0} 个文件`} />
              <Stat label="项目数量" value={`${totalProjects} 个项目`} />
            </div>
            {issues.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {issues.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface-1 text-body hover:text-primary transition-colors"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.label}
                    <span className="text-muted">{s.count}</span>
                  </button>
                ))}
                {report.reclaimableBytes > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-emerald-400 bg-emerald-400/10">
                    <CircleAlert size={11} /> 可清理 {formatBytes(report.reclaimableBytes)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 各项目占用：条状图 */}
      <div className="bg-surface border border-edge-subtle rounded-xl p-5">
        <h3 className="text-sm text-body font-medium mb-3 flex items-center gap-2">
          <Boxes size={15} className="text-secondary" /> 各项目占用空间
        </h3>
        {projectSizes.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted">暂无项目数据</div>
        ) : (
          <StackedBar items={barItems} />
        )}
      </div>

      {/* 详情 tab 切换 */}
      <div className="flex gap-1.5 border-b border-edge-subtle pb-1">
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
            type="button"
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeSection === tab.id
                ? 'bg-surface-1 text-primary font-medium'
                : 'text-secondary hover:text-body hover:bg-surface-1/60'
            }`}
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === 概览：项目明细 === */}
      {activeSection === 'overview' && (
        <div className="space-y-2">
          {projectSizes.map((p) => (
            <div
              key={p.projectId}
              className="bg-surface-1 border border-edge-subtle rounded-lg px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-body font-medium">{p.projectName}</span>
                <span className="text-[11px] tabular-nums text-secondary">
                  {formatBytes(p.total)}
                </span>
              </div>
              <div className="text-[10px] text-muted mt-0.5">
                磁盘文件 {p.fileCount} 个 · {formatBytes(p.fileBytes)} · 画布数据{' '}
                {formatBytes(p.kvBytes)}
              </div>
            </div>
          ))}
          {projectSizes.length === 0 && (
            <div className="text-center text-xs text-muted py-4">暂无项目</div>
          )}
        </div>
      )}

      {/* === 孤儿文件 tab === */}
      {activeSection === 'orphans' && (
        <div className="space-y-2">
          {(report.orphans || []).length === 0 ? (
            <div className="text-center py-5 text-xs text-muted">
              没有孤儿文件，所有文件均有引用
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  共 {(report.orphans || []).length} 个孤儿文件，可释放{' '}
                  {formatBytes(report.orphanBytes || 0)}
                </span>
                <button
                  type="button"
                  onClick={onDeleteAllOrphans}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-400/10 transition-colors"
                >
                  全部清理
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto space-y-1.5">
                {(report.orphans || []).map((o) => (
                  <div
                    key={o.path}
                    className="flex items-center justify-between bg-surface-1 border border-edge-subtle rounded-lg px-3 py-2 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-body truncate" title={o.path}>
                        {o.name}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {formatShortPath(o.path)} · {formatBytes(o.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFile(o.path, o.name)}
                      disabled={deleting.has(o.path)}
                      className="shrink-0 ml-2 text-[11px] text-secondary hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/10 transition-colors disabled:opacity-40"
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
        <div className="space-y-2">
          {(report.duplicates || []).length === 0 ? (
            <div className="text-center py-5 text-xs text-muted">没有重复文件</div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  重复文件共可释放{' '}
                  {formatBytes(
                    (report.duplicates || []).reduce((s, g) => s + (g.reclaimable || 0), 0),
                  )}
                </span>
                <button
                  type="button"
                  onClick={onDeleteAllDuplicates}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-400/10 transition-colors"
                >
                  <CopyX size={12} /> 全部清理
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-2">
                {(report.duplicates || []).map((g, gi) => (
                  <div
                    key={`${g.name}-${gi}`}
                    className="bg-surface-1 border border-edge-subtle rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="text-[11px] text-body font-medium truncate max-w-[240px]"
                        title={g.name}
                      >
                        {g.name}
                      </div>
                      <span className="text-[10px] text-orange-400 shrink-0 ml-2">
                        {g.count} 份 · 可释放 {formatBytes(g.reclaimable || 0)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {g.files.map((f) => (
                        <div
                          key={f.path}
                          className="flex items-center justify-between text-[10px] pl-2 border-l-2 border-edge-subtle"
                        >
                          <span className="text-secondary truncate min-w-0 flex-1" title={f.path}>
                            {formatShortPath(f.path)}
                            {f.referenced && <span className="ml-1.5 text-emerald-400">在用</span>}
                          </span>
                          <span className="text-muted shrink-0 ml-2 tabular-nums">
                            {formatBytes(f.size)}
                          </span>
                          {!f.referenced ? (
                            <button
                              type="button"
                              onClick={() => onDeleteFile(f.path, g.name)}
                              disabled={deleting.has(f.path)}
                              className="shrink-0 ml-2 text-[10px] text-secondary hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition-colors disabled:opacity-40"
                            >
                              {deleting.has(f.path) ? '…' : '删除'}
                            </button>
                          ) : (
                            <span className="shrink-0 ml-2 text-[10px] text-muted opacity-60">
                              在用作废
                            </span>
                          )}
                        </div>
                      ))}
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
  big?: boolean;
  accent?: boolean;
}

function Stat({ label, value, big = false, accent = false }: StatProps) {
  return (
    <div>
      <div className="text-[11px] text-muted mb-0.5">{label}</div>
      <div
        className={`${big ? 'text-lg' : 'text-sm'} font-medium tabular-nums ${accent ? 'text-emerald-400' : 'text-strong'}`}
      >
        {value}
      </div>
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
  const [hoverIdx, setHoverIdx] = React.useState(null);
  if (!segments || segments.length === 0 || !total) {
    return (
      <div className="flex flex-col items-center gap-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={outerR}
            fill="none"
            stroke="#1a1a26"
            strokeWidth={outerR - innerR}
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            className="fill-current text-strong"
            fontSize="13"
            fontWeight="600"
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
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[220px]">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] cursor-default text-secondary"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
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
              className="fill-current text-strong"
              fontSize="18"
              fontWeight="bold"
            >
              {slices[hoverIdx].pct.toFixed(0)}%
            </text>
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              className="fill-current text-secondary"
              fontSize="12"
              fontWeight="600"
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
              className="fill-current text-strong"
              fontSize="14"
              fontWeight="600"
            >
              {formatBytes(total).split(' ')[0]}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-current text-muted"
              fontSize="11"
            >
              / {formatBytes(total).split(' ')[1] || 'B'}
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
    return <div className="py-4 text-center text-xs text-muted">暂无数据</div>;
  }
  const segments = items.map((item) => ({ ...item, pct: (item.value / total) * 100 }));
  return (
    <div className="space-y-2.5">
      <div className="flex h-6 rounded-lg overflow-hidden bg-surface-1 border border-edge-subtle">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="h-full transition-[width] duration-500 ease-out relative group min-w-[3px]"
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
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-secondary truncate max-w-[110px]" title={seg.label}>
              {seg.label}
            </span>
            <span className="text-muted tabular-nums">{seg.pct.toFixed(0)}%</span>
            <span className="text-muted tabular-nums">{formatBytes(seg.value)}</span>
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
    <div
      className={`rounded-xl p-5 border ${under ? 'border-amber-500/40 bg-amber-500/10' : 'border-edge-subtle bg-surface'}`}
    >
      <div className="flex items-center gap-2">
        <Database size={16} className="text-secondary" />
        <span className="text-sm text-body">浏览器存储配额（IndexedDB / Cache）</span>
        {under && <CircleAlert size={14} className="text-amber-400" />}
      </div>
      <p className="text-xs text-muted mt-1">
        {under
          ? '配额即将用尽，自动保存可能失败，建议清理下方可释放空间'
          : 'IndexedDB / Cache 的浏览器分配配额；maomao 业务数据存在 localTool，不使用 IndexedDB，故此处占用通常为 0'}
      </p>
      {data ? (
        <>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-2xl text-strong tabular-nums">{formatBytes(data.usage)}</span>
            <span className="text-xs text-muted mb-1">
              / {formatBytes(data.quota)}（{(data.ratio * 100).toFixed(1)}%）
            </span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-surface-1 overflow-hidden">
            <div
              className={`h-full transition-all ${under ? 'bg-amber-400' : 'bg-cyan-400'}`}
              style={{ width: `${Math.min(100, data.ratio * 100)}%` }}
            />
          </div>
          {idleIndexedDb && (
            <p className="text-xs text-muted mt-2">
              当前未使用 IndexedDB，占用为 0 属正常；真正占用看上方存储健康报表
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 text-sm text-muted">浏览器未暴露存储统计（无法读取配额）</div>
      )}
    </div>
  );
}
