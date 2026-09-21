/**
 * 列表底部翻页栏 —— **唯一实现**（素材库面板 / 生成面板共用）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独一件（2026-09-21 · 用户裁定「和生成一样，下面弄个同款翻页」）】
 * 素材库面板原用**无限滚动**（`onScroll` 触底追加）：第 1 页 20 条，若这 20 条撑不满容器
 * ⇒ **没有滚动条 ⇒ scroll 事件永不发生 ⇒ 加载更多永不触发**（死锁），且界面零提示
 * （「已全部加载」只在 `hasMore === false` 时显示）⇒ 用户实测「完全不会动，新多一个最早的消失」。
 * 根因是**触发条件（滚动）与内容高度互为前提**，与滚动容器怎么写无关 ——
 * 故唯一正确的修法是让触发**不依赖滚动**：点击翻页（本组件）。
 * 抽成唯一实现而非在素材库再抄一份同款 JSX（那是 SSOT 第二份，改一处必漂移）。
 *
 * 【职责边界（三铁律）】
 *  · 本组件只负责**呈现 + 禁用判据**（`page <= 1` / `page >= totalPages`）—— 判据的真相是
 *    `page / totalPages`，两个消费方给的是同一份，故可收口到此处（一归）。
 *  · **「当前第几页 / 何时重拉」一律不上收** —— 素材库挂着 folder / pill / `resource:sent`，
 *    生成面板挂着 typeFilter / `agent:task-completed`，那是各域的宿主判据，收上来即越权。
 *  · 失败原因 `error` **原样转发**（生产者判词），本组件不翻译、不加工、不重分类。
 *
 * 【消费方】`resource/ResourceLibrary.tsx` · `generate/GeneratedView.tsx`
 * （各自持有页状态并调 `base/api/pagedList.ts` 读取）
 * ════════════════════════════════════════════════════════════════
 */

export interface PagedFooterProps {
  /** 左侧标题（渲染为 `${label} (${total})`）。 */
  label: string;
  /** 满足当前查询条件的总条数（后端 COUNT；生产者判词，本组件只转发）。 */
  total: number;
  /** 当前页（1-based）。 */
  page: number;
  /** 总页数（后端决定；`<= 1` 时不渲染翻页按钮）。 */
  totalPages: number;
  /** 是否正在加载（禁用翻页按钮 + 显示加载提示）。 */
  loading: boolean;
  /** 翻到目标页（1-based）。越界值由本组件的禁用判据拦在按钮层。 */
  onPage: (next: number) => void;
  /**
   * 翻页失败原因（**生产者判词，原样转发**）；空 = 无失败。
   * 未提供 = 该消费方不呈现翻页失败（可选字段的真空语义，见 Step 4 生产者给全清单）。
   */
  error?: string | null;
  /** 失败后的重试动作；与 `error` 成对提供，缺省则不渲染重试入口。 */
  onRetry?: () => void;
}

function PagedFooter({
  label,
  total,
  page,
  totalPages,
  loading,
  onPage,
  error,
  onRetry,
}: PagedFooterProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-edge bg-canvas flex-shrink-0">
      <span className="text-sm font-bold text-body">
        {label} ({total})
      </span>
      {totalPages > 1 ? (
        <div className="flex justify-center items-center gap-3 flex-1">
          <button
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
            className="px-3 py-1 bg-surface-hover text-secondary rounded text-xs hover:bg-surface-hover-strong disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            上一页
          </button>
          <span className="text-xs text-muted">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => onPage(page + 1)}
            className="px-3 py-1 bg-surface-hover text-secondary rounded text-xs hover:bg-surface-hover-strong disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            下一页
          </button>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {/* 失败态优先于加载态：失败后 `loading` 已归 false，此处只是把"没有更多了"与"加载失败"分开 */}
      {error && onRetry ? (
        <button
          className="text-caption text-red-400 hover:text-red-300 whitespace-nowrap cursor-pointer border-none bg-transparent"
          title={error}
          onClick={onRetry}
        >
          翻页失败 · 点击重试
        </button>
      ) : loading ? (
        <span className="text-caption text-faint whitespace-nowrap mr-1">加载中...</span>
      ) : null}
    </div>
  );
}

export default PagedFooter;
