/**
 * 可引用媒体源 · 统一形状与契约（横切地基 · 零 React / 零 store 依赖）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么这层存在（docs/136 · 母体 M4「可引用内容没有统一视图」）】
 * 每个消费方各自去"能拿到的地方"捞数据：
 *   · 剪辑器（videoEditor，在 ReactFlowProvider 之外）结构上拿不到画布节点 → 引用不了画布；
 *   · 「画布节点 → 媒体」的真源是 `base/canvas/nodeMedia.ts`，但它只认 `Node`，不知道素材库；
 *   · 「素材库 → 资源」的真源是 `base/store/resourceStore.ts` / `base/api/localToolApi.ts`，
 *     但它只认 `Resource`，不知道画布。
 * 全库没有任何地方回答「一共有哪些东西可以被引用」—— 这正是那个**缺席的层**。
 *
 * 本层**只做映射，不重实现**：所有数据仍取自既有真源（见 providers/）。
 * ════════════════════════════════════════════════════════════════
 *
 * 【三条契约铁律】
 * 1. `url` **恒为绝对 URL**（provider 内已过 `toAbsoluteFileUrl`）。
 *    消费方可能在非 React / 非画布环境（剪辑器在 `ve-scope` 里），不该各自补前缀。
 * 2. `ref` 前缀是**跨模块契约** —— 消费方**禁止**自己拼 `${source}:${id}`，
 *    必须用 `makeMediaRef()` / `parseMediaRef()`（成对提供）。
 *    （教训同 `contracts.ts` 的 `shotHandleId`/`parseShotHandle`：写侧改前缀而读侧没改，失败是静默的。）
 * 3. `meta` 是**出口，不是契约** —— 消费方依赖 `meta` 里的字段 = 自建第二份耦合。
 * ════════════════════════════════════════════════════════════════
 */

/** 媒体类型（消费方只吃这三类；text/未知不收录）。 */
export type MediaRefType = 'image' | 'video' | 'audio';

/**
 * 来源枚举 —— 新增来源只在这里加一项 + 注册一个 provider（见 providers/index.ts）。
 *
 * ⚠️ 【若将来要进持久化】（如把 `@canvas:xxx` 存进会话历史/工程）——
 * 它就成了**持久化格式**，来源改名 = 格式变更，必须走迁移并登记。
 * 当前**不进任何存储**，故本轮零风险（docs/136 §五 / P2-5）。
 */
export type MediaRefSource = 'canvas' | 'library' | 'generated';

/**
 * 一条「可引用媒体」——所有来源归一后的唯一形状。
 * 消费方只认它，不关心它从哪来。
 */
export interface MediaRef {
  /** 全局唯一标识：`${source}:${id}`。用于去重 / React key / 芯片序列化。**用 makeMediaRef 生成，勿手拼**。 */
  ref: string;
  /** 来源标识（决定它从哪来；消费方一般不需要关心） */
  source: MediaRefSource;
  /** 显示名（用户看到的） */
  name: string;
  /** 媒体类型 */
  type: MediaRefType;
  /** 可渲染地址（**已归一为绝对 URL**，可直接给 <img>/<video>） */
  url: string;
  /** 缩略图（可选；消费方缺省回退 url） */
  thumbnailUrl?: string;
  /**
   * 稳定内容身份（文件型才有；与后端 resources.sha1 同源，形如 `sha1:<hex>`）。
   * 用途：导入剪辑器时**避免重复上传** / 去重。
   * ⚠️ **缺失是常态**（画布上很多图没有 contentId）→ 去重必须双轨（见 docs/136 P0-3）。
   */
  contentId?: string;
  /** 归属项目（legacy 无归属 = 全项目可见，沿用 resourcesOfProject 语义） */
  projectId?: string;
  /**
   * 该条目的落盘目录（素材库来源才有；`/files/` 相对语境，如 `migrated`、`migrated/人物`）。
   * 用途：**文件夹卡片**的拖拽归类（落点目录由此派生）+ 移动源的真源定位。
   */
  folder?: string;
  /**
   * 是否「文件夹条目」（素材库 rescan 会把磁盘子目录也录成条目，`type:'folder'`）。
   * `true` 时：它不是可导入的媒体，而是**可拖入的落点卡片**（消费方据此分支渲染）。
   */
  isFolder?: boolean;
  /** 来源私有附加信息（尺寸/时长/目录/分页等）。**不进核心契约**，消费方不该依赖。 */
  meta?: Record<string, unknown>;
}

/** 查询条件（各 provider 按需消费，不必全用）。 */
export interface MediaRefQuery {
  /** 项目 id（素材库按项目隔离用） */
  projectId?: string;
  /** 关键词（按 name 模糊匹配；空则不过滤） */
  keyword?: string;
  /** 只要这些类型 */
  types?: MediaRefType[];
  /**
   * 素材库目录**前缀**（`library` 与 `generated` 两来源共用：后者固定传 `tasks`；空 = 不过滤）。
   * 【为什么放这里而不是各写一个 provider】素材库与「生成」都是 `fetchResources` 的不同目录
   * （生成 = 硬编码 `tasks`，见 GeneratedView.tsx:176；素材库 = 用户目录）。
   * 二者是**同一读取路径的参数差异**，不是两种来源实现 —— 用一个 `folder` 参数表达，
   * 避免把 `fetchResources` 的映射逻辑抄两份（M3 母体）。
   * 更新(2026-09-17 注释改正)：原写「仅 `library` provider 消费」不实 —— `generatedSource.list`
   * 也把 `folder` 透传给 `librarySourceProvider.list`（TD-02-52）。
   */
  folder?: string;
  /**
   * 素材库目录**精确匹配**（只要该目录本身，**不含子目录**；与 `folder` 互补，勿混用）。
   * 典型用途：`migrated` 根 = 「尚未归类」的素材 + 其下子文件夹卡片（用户裁定 2026-09-17）。
   */
  folderExact?: string;
}

/**
 * 来源内部的**分类**（第二层筛选：素材库的「人物/场景/道具」、生成源的「图片/视频/文本」）。
 *
 * 【为什么这一层要进契约（2026-09-17 用户指出）】此前各面板各自硬编码分类 pill：
 * `ResourceLibrary.FOLDER_PILLS` 与 `resourceStore.FOLDERS` 是**同一件事的两份**（M3 第二份），
 * 且新消费方（导入弹窗）**完全拿不到分类**（因为契约里没有这一层）。
 * 收口后：各 provider 声明自己的分类，消费方 0 行接入。
 *
 * ⚠️ 各来源的**分类维度可以不同**（素材库按目录、生成按类型）—— 本层只搬运，
 * **不解释语义**（`query` 是 provider 自定义的查询参数）。
 */
export interface MediaRefCategory {
  /** 稳定标识（用于选中态；同来源内唯一）。 */
  key: string;
  /** 显示名（消费方直接用，不自己写映射）。 */
  label: string;
  /**
   * 该分类对应的查询覆盖（provider 自定义消费）。
   * 例：素材库 `{ folder:'migrated/人物' }`；生成 `{ types:['image'] }`。
   * 合并规则 = `{ ...列表级 query, ...category.query }`（分类覆盖列表级）。
   */
  query?: Partial<MediaRefQuery>;
}

/**
 * 一个来源：能列出条目。**异步**（素材库要请求后端）。
 */
export interface MediaRefProvider {
  source: MediaRefSource;
  /** Tab 显示名（消费方直接用，不自己写映射） */
  label: string;
  /**
   * 声明本来源的分类（**可选**；不声明 = 该来源无第二层筛选，如「画布」）。
   * 消费方据此渲染第二排 pill；**禁止**消费方自己硬编码分类清单（M3）。
   */
  categories?: () => MediaRefCategory[];
  /**
   * 列出条目。
   * 契约：
   *  - 必须**自己处理失败**：失败时**抛错**（不返回空数组冒充"没有"）。
   *  - 返回的 `url` 必须**已是绝对 URL**。
   *  - 必须**已按 query 过滤**（注册表不做二次过滤）。
   */
  list: (query?: MediaRefQuery) => Promise<MediaRef[]>;
}

/**
 * 跨来源搜索的结果信封。
 *
 * 【为什么 searchMediaRefs 单独一个返回形状】它是**唯一**跨来源的操作，
 * 而跨来源必然面对"部分失败"。把它塞进 `MediaRef[]` 就会掩盖失败（= 静默吞）。
 * 单来源的 `queryMediaRefs` **不加**这个信封 —— 单来源失败了就该抛，
 * 包一层 `{items, failures}` 反而让消费方多写一次判空（形态要匹配语义，不是统一就好）。
 */
export interface MediaRefSearchResult {
  items: MediaRef[];
  /** 失败的来源与原因（消费方可显示"素材库暂时不可用"） */
  failures: Array<{ source: MediaRefSource; message: string }>;
}

const REF_SEP = ':';

/** 全部合法来源（parseMediaRef 的合法性判据真源；新增来源只改这里 + 上面类型）。 */
const KNOWN_SOURCES: readonly MediaRefSource[] = ['canvas', 'library', 'generated'];

/**
 * 生成全局 ref（**唯一写入口**，消费方禁止手拼）。
 * 边界：id 不含 `:`（nodeId 由 generateId 生成只用 `_`；resource id 为后端 id）；
 * 若 id 意外含 `:`，parseMediaRef 取**第一个** sep 之前为 source、其后**全部**为 id（不丢信息）。
 */
export function makeMediaRef(source: MediaRefSource, id: string): string {
  return `${source}${REF_SEP}${id}`;
}

/**
 * 解析 ref（**唯一读入口**，与 makeMediaRef 成对）。
 * 返回 null 表示非法 ref（无分隔符 / source 非已知枚举）—— 调用方应显式处理，不静默兜底。
 */
export function parseMediaRef(ref: string): { source: MediaRefSource; id: string } | null {
  if (!ref || typeof ref !== 'string') return null;
  const idx = ref.indexOf(REF_SEP);
  if (idx <= 0) return null;
  const source = ref.slice(0, idx);
  const id = ref.slice(idx + 1);
  if (!id) return null;
  if (!KNOWN_SOURCES.includes(source as MediaRefSource)) return null;
  return { source: source as MediaRefSource, id };
}
