import React from 'react';
import { RefreshCw, HardDrive, Database, CircleAlert, Boxes } from 'lucide-react';
import { formatBytes } from '../../core/utils.ts';
import { isChromeExtension } from '@/components/base/storage/index.ts';
import {
  estimateBrowserStorage,
  estimateChromeStorage,
  estimateStoragePressure,
  analyzeStorageByKeys,
} from '@/components/base/storage/index.ts';

/**
 * 设置分区 · 存储监控（「更多设置」折叠组内）。
 *
 * ── 数据流（下个 AI 改这前必读）──
 *  挂载 → runScan() 三路并行（Promise.all，互不阻断）：
 *   ├─ estimateBrowserStorage() → navigator.storage.estimate()  → browser state（IndexedDB/Cache 配额）
 *   ├─ estimateChromeStorage()  → enumerateLocalEntries() 估算  → chrome state（已存内容总字节/键数）
 *   └─ analyzeStorageByKeys()   → 按键画像                    → domains state（各功能域占用条）
 *  三个 state 任一为 null 都各自降级展示降级文案，不互相阻断。
 *  数据源实现在 src/components/base/storageQuota.ts，本文件只做渲染与交互。
 *
 * 【一期】两个独立维度展示（maomao 为 Chrome 扩展，无 Tauri 磁盘扫描，只做这两类浏览器存储）：
 *   1. 浏览器存储配额（navigator.storage）—— IndexedDB + Cache Storage 用量。
 *   2. 已存占用估算（chrome.storage.local 扩展 / localStorage Web）—— 项目画布/设置等业务数据落盘占用。
 *   两者是「两笔账」，口径不同（navigator.storage 是浏览器分配；chrome.storage 是扩展存储已用内容估算），分开展示。
 *
 * 【为何 IndexedDB 卡可能显示 0】maomao 业务数据全存 chrome.storage.local / localStorage（storageAdapter 的
 *   yimao: 前缀键），不写 IndexedDB，故 navigator.storage.estimate().usage 通常为 0、quota 为浏览器默认(如 10GB)。
 *   对用户而言真实压力在下方「已存占用」卡，IndexedDB 卡仅作完整性展示，文案已说明这一点。
 *
 * 【环境感知】用 isChromeExtension() 区分：扩展环境 → 展示 chrome.storage.local；Web 环境（npm run dev）
 *   → 展示 localStorage。标签随环境切换，避免「浏览器打开却显示扩展存储」的误导。
 *
 * 【预警】浏览器配额 ratio ≥ STORAGE_PRESSURE_RATIO(0.85) 时卡片变琥珀色并提示「自动保存可能失败」。
 *
 * 【二期】扩展存储占用画像（按 STORAGE_KEYS 各 domain 统计实际存储键占用）走 analyzeStorageByKeys()，
 *   纯只读展示各功能域占用条 + 键数；不含清理（清理留后续）。
 *
 * 【红线】本面板只读存储；若后续做清理，必须走 contentStore 唯一入口 + 二次确认，
 *   只删缓存/可重建类键（详见 storageQuota.ts 文件头的「清理建议」）。
 */
export default function StorageMonitor() {
  const [browser, setBrowser] = React.useState(null); // { usage, quota, ratio } | null
  const [chrome, setChrome] = React.useState(null); // { bytes, keys } | null
  const [domains, setDomains] = React.useState(null); // analyzeStorageByKeys 结果 | null
  const [scanning, setScanning] = React.useState(true); // 首次自动扫描中
  // 环境感知：扩展环境读 chrome.storage.local；Web（npm run dev）读 localStorage
  const isExt = isChromeExtension();

  const runScan = React.useCallback(async () => {
    setScanning(true);
    // 三路独立并行；任一路失败/不可用都各自降级为 null，不互相阻断（失败可见：UI 展示降级文案而非静默）
    // 注：AI 会话键已迁 KV（见 docs/AI助手会话存储迁移-KV收口事实记录.md），不再占本地存储，故移除其键级预警。
    const [b, c, d] = await Promise.all([
      estimateBrowserStorage(),
      estimateChromeStorage(),
      analyzeStorageByKeys(),
    ]);
    setBrowser(b);
    setChrome(c);
    setDomains(d);
    setScanning(false);
  }, []);

  React.useEffect(() => {
    runScan();
  }, [runScan]);

  const pressure = browser ? estimateStoragePressure(browser.ratio) : null;
  const storeLabel = isExt ? '扩展存储（chrome.storage.local）' : '浏览器本地存储（localStorage）';

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部操作栏 */}
      <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="settings-page-title flex items-center gap-2">
            <HardDrive size={17} className="text-secondary" /> 存储监控
          </h2>
          <p className="text-xs text-muted mt-1">
            查看浏览器与{isExt ? '扩展' : '本地'}存储占用，配额用尽会导致自动保存失败
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

      {/* 浏览器存储配额卡片 */}
      <BrowserQuotaCard data={browser} pressure={pressure} storeLabel={storeLabel} />

      {/* 已存占用估算卡片 */}
      <div className="bg-surface border border-edge-subtle rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-secondary" />
          <span className="text-sm text-body">已存占用（业务数据落盘）</span>
        </div>
        <p className="text-xs text-muted mt-1">
          maomao 项目/设置/素材等数据存放在 {storeLabel}，这是实际占用与压力来源
        </p>
        <div className="mt-4 flex items-end gap-2">
          {scanning ? (
            <span className="text-2xl text-muted">…</span>
          ) : chrome ? (
            <>
              <span className="text-2xl text-strong">{formatBytes(chrome.bytes)}</span>
              <span className="text-xs text-muted mb-1">共 {chrome.keys} 个存储键</span>
            </>
          ) : (
            <span className="text-sm text-muted">存储读取不可用（隐私模式/权限受限）</span>
          )}
        </div>
        {/* 注：AI 会话键已迁 KV，不再是本地存储配额压力源；原「AI 会话接近体积预算」预警随迁 KV 一并移除
             （见 docs/AI助手会话存储迁移-KV收口事实记录.md）。会话体积仍有 L3 预算降级兜底，与本地配额无关。 */}
      </div>

      {/* 按功能分类的存储画像 */}
      <div className="bg-surface border border-edge-subtle rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Boxes size={16} className="text-secondary" />
          <span className="text-sm text-body">按功能分类的存储画像</span>
          {scanning && (
            <span className="text-[10px] text-muted bg-surface-1 px-1.5 py-0.5 rounded-md">
              扫描中
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1">按功能域统计实际存储键的占用（只读，不含清理）</p>
        {scanning ? (
          <div className="mt-3 text-xs text-muted bg-surface-1 rounded-lg px-3 py-2.5">扫描中…</div>
        ) : domains && domains.domains.length > 0 ? (
          <>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-xl text-strong">{formatBytes(domains.totalBytes)}</span>
              <span className="text-xs text-muted mb-1">共 {domains.totalKeys} 个存储键</span>
            </div>
            <div className="mt-4 space-y-3">
              {domains.domains.map((g) => (
                <DomainRow key={g.domain} g={g} totalBytes={domains.totalBytes} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 text-xs text-muted bg-surface-1 rounded-lg px-3 py-2.5">
            存储读取不可用（隐私模式/权限受限）
          </div>
        )}
      </div>
    </div>
  );
}

/** 浏览器存储配额卡片：进度条 + 预警（IndexedDB/Cache 维度） */
function BrowserQuotaCard({ data, pressure, storeLabel }) {
  const under = pressure?.underPressure;
  // maomao 数据存于 chrome.storage.local / localStorage，不写 IndexedDB → usage 为 0 是正常的
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
        {under ? (
          '配额即将用尽，自动保存可能失败，建议清理下方无用数据或导出并删除旧项目'
        ) : (
          <>
            IndexedDB / Cache 的浏览器分配配额。maomao 数据存于下方 {storeLabel}，不使用
            IndexedDB，故此处占用通常为 0
          </>
        )}
      </p>
      {data ? (
        <>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-2xl text-strong">{formatBytes(data.usage)}</span>
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
              当前未使用 IndexedDB，占用为 0 属正常；真正占用看下方 {storeLabel}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 text-sm text-muted">浏览器未暴露存储统计（无法读取配额）</div>
      )}
    </div>
  );
}

/** 单个功能域的占用行：标签 + 占用 + 占比条 + 键数 */
function DomainRow({ g, totalBytes }) {
  const ratio = totalBytes > 0 ? g.bytes / totalBytes : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-body">{g.label}</span>
        <span className="text-muted">
          {formatBytes(g.bytes)} · {g.keys} 键
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-surface-1 overflow-hidden">
        <div
          className="h-full bg-cyan-400/70 transition-all"
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
