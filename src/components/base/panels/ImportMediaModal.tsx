/**
 * ImportMediaModal —— 可复用「导入媒体」弹窗（横切地基）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么是一个弹窗而不是两处各写一份（用户需求 2026-09-17）】
 * 两个入口共用本组件：
 *  · 入口 A：画布右键菜单「上传」（`canvasContextMenu.tsx`）
 *  · 入口 B：剪辑器素材面板「导入」（`videoEditor/.../assets/views/media.tsx`）
 * 界面**完全复用**（4 来源 tab + 卡片网格 + 底栏计数），差异只由宿主注入的 `onPick` 决定。
 *
 * 【样式复用（用户指定）】与 creative 创作库（风格/滤镜/运镜）**同一套视觉范式**：
 * 直接复用其 `creative-library.css` 的 `.cl-*` 类（顶栏文字 tab / 分类 pills / 卡片网格 /
 * 底栏计数）+ `panel-kit.css` 的 `.pk-*`。**不新造卡片组件**。
 *
 * 【分层（check-arch 规则 2）】本文件在 `base/panels/`，**只认 `MediaRef`**（base/media 形状），
 * 不 import 任何 `videoEditor` / `nodes` 等业务域。**"导入到哪"由宿主经 `onPick` 注入** ——
 * 画布注入"建 assetNode"，剪辑器注入 `linkMediaRefsToProject`。这样两边都合法且组件真复用。
 * ════════════════════════════════════════════════════════════════
 *
 * 【4 个来源分类（顺序由用户裁定 2026-09-17）】
 *  1. 本地导入 —— **写动作**（选文件/拖入），不是读来源 → 单独一条腿（不经 provider）
 *     · 交互（用户裁定 2026-09-17「方案 A：合成」）：点该 tab（**含已选中时再点**）直接拉起系统
 *       选择器；内容区本身是**投放区**（`.cl-drop`：点 = 选文件，拖入 = 同一交接处）。
 *       ⇒ 打开弹窗不再是空界面 · 取消系统框后可反复重试 · 补上"弹窗内原本不支持拖入"的缺口。
 *       ⚠️ 打开弹窗**不自动**弹框（默认 tab 就是本地导入，自动弹会打断"我要去素材库"的用户）。
 *     · 文件交接唯一处 `handleLocalFiles`：交宿主落地 + **关弹窗**（与「导入选中」同一语义）。
 *     · 视觉与同面板虚线卡 `.cl-card-item.is-folder` 共用同一套虚线语法（UI 一致：虚线 = 可投放只有一个样子）。
 *  2. 生成     —— `queryMediaRefs('generated')`（tasks 目录 = AI 产出）
 *  3. 素材库   —— `queryMediaRefs('library')`（用户目录）
 *  4. 画布     —— `queryMediaRefs('canvas')`（画布节点里的图/视频）
 *
 * 【第二层：来源内部的分类 + 文件夹拖拽归类（用户裁定 2026-09-17）】
 *  · 分类由 **provider 声明**（`categories()`），弹窗不硬编码（M3）；
 *  · 素材库「全部」= 精确 `migrated` 根（**尚未归类**的素材），其下子文件夹以**卡片**呈现；
 *  · 卡片是**目录条目**：**点 = 进入该目录**、**拖入 = 归类落点**（复用
 *    `useResourceMoveToFolder.folderDropProps`）。两条路径的目录都由卡片自身的 `folder/name` 派生
 *    —— **同一实现** `folderPathOf`（动态：磁盘有什么显示什么，非硬编码清单）。
 *    （2026-09-17 补：此前只有"拖入"，且拖入因漏传 `connected` 恒失败 ⇒ 用户体感"文件夹点不进去"。）
 *  · **卡片尺寸 = 图片卡同一 16:9 盒**（用户裁定 2026-09-17：「文件夹高度应该和图片一样高，一样大小」）：
 *    视觉类 `.cl-card-item.is-folder` —— 16:9 由 `.cl-card-item::before` 顶出（本档**不覆盖**）、
 *    **无 `min-height`**、图标**绝对居中**（流内元素会把盒撑高）。此前借用提示词面板遗留的 `.is-add`
 *    （`min-height:110px` + 掐掉 `::before`）⇒ 文件夹比图片矮一截；该遗留类在 `src/` 已无消费者，已正名删除。
 *  · **默认分类 = provider 声明的第一个分类**（素材库/生成 =「全部」）：进入 tab 即套用它的
 *    query 并高亮该 pill ⇒「进入素材库」与「点全部」是同一个界面。空着分类进 tab 会得到
 *    **无 folder 的递归全量**（另一个界面），这是 2026-09-17 用户报的第二个 bug，禁止回退。
 *
 * 【内容区结构铁律：一个浏览流（2026-09-17 重写 · 两次翻车后收敛）】
 *  内容区 = `.cl-col` 内**一个** `.cl-grid`（**一个滚动容器**）：目录条目在前、媒体条目在后，
 *  两者同盒高（16:9）⇒ 同列数、同行高、同一个滚动条。
 *  ⚠️ 禁止拆成「文件夹网格 + 素材网格」两个 `.cl-grid`：
 *    ① `.cl-main` 是 flex **row**（它给「左分类栏 + 右内容列」用）→ 两个网格各拿 50% 宽，
 *       文件夹只排得下 2 列且被锁在左半边（用户 2026-09-17 报的「一排 2 个、全部靠左」）；
 *    ② 两个 `.cl-grid` 各自 `overflow-y:auto` = **两个滚动容器** → 只能靠 `max-height` 护栏去压，
 *       而护栏必然裁掉正常内容（用户随即报「多了一条滚动条」）。**兜底掩盖结构缺陷 = 必复发**。
 *  「我在哪」= 弹窗持有的**单一下钻状态** `openFolder`（null = 分类视图；与分类 pill **互斥**）：
 *   · null → 分类 query（缺省 = provider 声明的默认分类）· 有值 → `{ folder }` **前缀**浏览
 *     （含更深子目录，与素材库面板同语义），分类 pill 不选中
 *   · 返回 = 副条左侧「← 返回 X」（父 = 素材库根 `UPLOAD_DIRS.migrated` 则回「全部」）
 *  唯一入口只有三个：`queryFor`（组装 query）· `load`（拉取 + 竞态守卫 + 诚实错误态）·
 *  `navigate`（跳位置）。新增任何拉取/跳转一律走这三个，禁再抄一份。
 *
 * 【浏览规则不属本文件（2026-09-17 用户裁定：与侧边栏收口到一个地方）】
 *  「目录位置 → 查询参数（根=精确 / 子目录=前缀）」「上钻一级」「根判定」三条规则住在
 *  `base/media/libraryBrowse.ts`（**唯一实现**），侧边栏素材库面板与本弹窗**共用同一份**；
 *  本文件只持有自己的打开态（`openFolder`/`catKey`）与渲染。
 *  ⚠️ 历史上本文件自写了一份 `queryFor` 的目录分支 ⇒ 与侧边栏两套规则各自演化，
 *  表现为「侧边栏能点进子目录、弹窗点不进去」。**禁止再把规则抄回本文件**。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UploadCloud, X, Search, FolderOpen, ChevronLeft } from 'lucide-react';
import '../creative/creative-library.css';
// 经唯一出口（`../media`）消费：它保证内置 provider 已自注册（漏走它会静默少来源）。
import { listMediaRefSources, queryMediaRefs } from '../media/index.ts';
import type {
  MediaRef,
  MediaRefEntry,
  MediaRefQuery,
  MediaRefSource,
} from '../media/mediaRefTypes.ts';
import { logger } from '../core/logger.ts';
import { toastError, toastSuccess } from '../core/toastStore.ts';
// 目录浏览规则（根/子目录 → 查询参数 · 上钻）：**与侧边栏素材库同一份实现**（见 libraryBrowse.ts）。
import { libraryBrowseArgs, libraryUpFolder } from '../media/libraryBrowse.ts';
// 本地引擎连接态：拖入归类需要它（hook 的 `connected` 是必填；漏传 = drop 恒失败的假交互）。
import { useLocalToolStatus } from '../../../hooks/useLocalToolStatus.ts';
import LazyImage from '../ui/LazyImage.tsx';
// 归类拖拽（唯一收敛点）+ 目录路径唯一实现（`folderPathOf`：点进入 / 拖落点共用）。
// ⚠️ 这是 base 层 import hooks 的**既有先例**（TaskCenter / GeneratedView 同样从 '../../../hooks' 取）。
import { useResourceMoveToFolder, folderPathOf } from '../../../hooks/useResourceMoveToFolder.ts';

/** 本地导入 tab 的伪来源 key（它不是 provider，是写动作）。 */
const LOCAL_TAB = 'local' as const;
type ImportTab = typeof LOCAL_TAB | MediaRefSource;

/**
 * 本地导入 tab 的显示名 —— **本弹窗唯一自己声明的展示项**（它是写动作，不是来源，provider 契约管不到）。
 *
 * ⚠️ 其余 tab 的**显示名与顺序一律取自来源声明**（`MediaRefProvider.label` / `.order`，经
 * `listMediaRefSources()` 派生），本文件**禁止**再写硬编码 tab 清单 —— 早先 `TAB_ORDER` 与 `TAB_LABEL`
 * 各硬编码一份，新增来源不会出现在这里，契约承诺的「消费方改 0 行」当场失效（TD-02-47 母体）。
 */
const LOCAL_TAB_LABEL = '本地导入';

/**
 * `onPick` 的结果契约（**宿主是生产端，弹窗是消费端**）。
 *
 * 【为什么必须有它（2026-09-17）】原契约是 `void | Promise<void>`：宿主只能用"抛没抛异常"
 * 表达失败，而"没抛错"被弹窗当成了**成功**（关弹窗）—— 于是「东西根本没落地」也照样关窗、
 * 用户以为成了（界面在撒谎）；宿主想在成功时说点什么也说不出口。
 * 现在：**成败与可展示文案都来自落地的那一层**（它才知道）；弹窗不判定、不加工、只转发。
 */
export type ImportPickOutcome =
  | {
      ok: true;
      /** 生产端给的用户可见文案；不给 = 结果本身已可见（不播报成功） */
      message?: string;
    }
  | {
      ok: false;
      /** 生产端给全的可展示失败信息（含原因）；消费者原样转发 */
      message: string;
    };

export interface ImportMediaModalProps {
  /** 关闭回调（宿主持有 open state）。 */
  onClose?: () => void;
  /** 当前画布项目 id（素材库/画布按项目过滤用）。 */
  projectId?: string;
  /**
   * 选中一批媒体后的落地动作（**宿主注入 = 生产端**）。
   * 画布入口：建 assetNode；剪辑器入口：`linkMediaRefsToProject`。
   * 消费方（本弹窗）只转发它给的结果与文案，**不自行判定成败、不宣告"已导入"**。
   */
  onPick: (items: MediaRef[]) => ImportPickOutcome | Promise<ImportPickOutcome>;
  /** 本地导入：选文件后的落地动作（宿主注入；不传则隐藏本地 tab 的行为）。 */
  onLocalFiles?: (files: FileList) => void | Promise<void>;
}

export default function ImportMediaModal({
  onClose,
  projectId,
  onPick,
  onLocalFiles,
}: ImportMediaModalProps) {
  // 默认 tab =「生成」（用户裁定 2026-09-17）：打开即见内容；「本地导入」是写动作 tab，
  // 点它才拉选择器，做默认会每次开弹窗都撞上"空界面/要不要自动弹"的两难。
  const [tab, setTab] = useState<ImportTab>('generated');
  const [q, setQ] = useState('');
  const [catKey, setCatKey] = useState<string | null>(null);
  /** 下钻位置（目录路径；null = 分类视图）。与 `catKey` **互斥**，见 navigate()。 */
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  // 列表条目 = 媒体 **或** 文件夹落点卡片（`MediaRefEntry`）；要当媒体用（onPick）须先窄化（见下方 mediaItems）
  const [items, setItems] = useState<MediaRefEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 本机文件投放区是否正被拖拽悬停（仅视觉，无逻辑分支）。 */
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 拉取竞态守卫：只认最后一次请求的落地（覆盖全部调用点，不只在切 tab 时）。
  const loadTokenRef = useRef(0);

  // 本地引擎连接态：拖入归类需要它（hook 的 `connected` 是必填）。缺它 = drop 恒失败 = 假交互。
  const { status } = useLocalToolStatus();

  // 已注册的 provider 来源（本地 tab 之外的那些）—— **已按各来源声明的展示顺序排好**（注册表负责排序）。
  const providerSources = useMemo(() => listMediaRefSources(), []);

  // Tab 序列（**唯一派生处**）= 本地伪来源 + 注册表；显示名与顺序全部来自声明（见 MediaRefProvider）。
  const tabs = useMemo(
    (): Array<{ key: ImportTab; label: string }> => [
      { key: LOCAL_TAB, label: LOCAL_TAB_LABEL },
      ...providerSources.map((p) => ({ key: p.source, label: p.label })),
    ],
    [providerSources],
  );

  // 当前 tab 对应的**可拉取来源**（`local` 是写动作、不是来源 ⇒ null）。
  // 唯一一处做这个换算：`load` 用它 + 类型收窄（本地 tab 想拉也拉不了），别在每处各判一次 tab。
  const source: MediaRefSource | null = tab === LOCAL_TAB ? null : tab;

  // 当前 tab 的分类（第二层筛选）—— 由 provider **声明**，弹窗不硬编码（M3 收口）。
  // 【TD-03-15】把**已拉到的条目**传进去：素材库的分类清单含"磁盘实有子目录"，
  // 只能从已拉到的 `type:'folder'` 条目发现（用户自建目录不在任何静态清单里）。
  // provider 只读它、不为此另发请求（契约见 MediaRefProvider.categories 注释）。
  // 依赖 `items` ⇒ 拉到数据后分类 pill 自动补齐；`[]` 时 provider 退回静态基底（首屏结构稳定）。
  const categories = useMemo(
    () =>
      tab === LOCAL_TAB
        ? []
        : (providerSources.find((p) => p.source === tab)?.categories?.(items) ?? []),
    [tab, providerSources, items],
  );

  // 【默认分类 = provider 声明的第一个分类】（素材库 =「全部」，生成 =「全部」，无分类来源 = null）
  //   ⚠️ 这必须是**唯一一条**“默认分类”解析：进入 tab / 点分类 / 归类后刷新 三处共用它。
  //   此前“进入 tab”走的是**无分类 query**（后端不传 folder ⇒ 整个用户目录**递归**全量），
  //   而点「全部」走的是 provider 声明的 `folderExact:'migrated'`（只含 migrated 根＝尚未归类）
  //   ⇒ 同一个 tab 里出现**两个不同界面**，且 pills 一个都没高亮（用户 2026-09-17 报：
  //   “点素材库显示是另外一个界面，而不是下面的全部”）。修法＝进入即套用默认分类。
  //   顺带删掉刷新里硬编码的 `?? 'all'`：弹窗不该知道 provider 的分类 key（M3）。
  const defaultCategory = categories[0] ?? null;
  const defaultCatKey = defaultCategory?.key ?? null;

  // 【唯一 query 组装处】下钻优先：在目录里只按目录（前缀，含更深子目录 —— 与素材库面板同语义）；
  // 否则按分类 query（未选分类 = 默认分类）。分类与下钻**互斥**（见 navigate）。
  const queryFor = useCallback(
    (folder: string | null, cat: string | null): MediaRefQuery => {
      // 目录位置 → 查询参数：**走共用的 libraryBrowseArgs**（根=精确 / 子目录=前缀），
      // 与侧边栏素材库面板同一份规则（此前弹窗自写一份 → 点不进去）。
      if (folder) return { ...libraryBrowseArgs(folder), projectId };
      const c = categories.find((x) => x.key === cat) ?? defaultCategory;
      return { ...(c?.query ?? {}), projectId };
    },
    [categories, defaultCategory, projectId],
  );

  // 【唯一拉取处】竞态守卫（只认最后一次）+ 诚实错误态。
  // silent = 后台刷新（归类落点触发）：不设 loading/error、不打断用户；失败只留开发者可见的 debug。
  const load = useCallback(
    (query: MediaRefQuery, opts?: { silent?: boolean }) => {
      if (!source) return; // 本地 tab = 写动作，无来源可拉（唯一判据，调用方不必各判一次）
      const token = ++loadTokenRef.current;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      queryMediaRefs(source, query)
        .then((list) => {
          if (token === loadTokenRef.current) setItems(list);
        })
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          if (token !== loadTokenRef.current) return;
          if (opts?.silent) {
            // 归类后的刷新失败不阻断（用户此刻不在等它，下次跳位置自然同步）；
            // **降级必留痕**：给开发者留 debug，不拿 toast 骗用户 ⇒ catch 体非空、无需豁免标记。
            logger.debug('mediaModal', '归类后刷新失败（不阻断）', { message });
            return;
          }
          // 诚实错误态：provider 失败**不返回空数组冒充"没有"**（docs/136 §5.3）。
          setItems([]);
          setError(message);
        })
        .finally(() => {
          if (!opts?.silent && token === loadTokenRef.current) setLoading(false);
        });
    },
    [source],
  );

  // 【唯一跳位置入口】分类与目录下钻互斥：跳分类 → openFolder=null；跳目录 → catKey=null。
  // 新增任何「切分类 / 进目录 / 返上级」都走这里，禁再各写一份 setState + queryMediaRefs。
  const navigate = useCallback(
    ({ folder, cat }: { folder: string | null; cat: string | null }) => {
      setSelected(new Set());
      setError(null);
      setCatKey(cat);
      setOpenFolder(folder);
      load(queryFor(folder, cat)); // 本地 tab 由 load 内部拦住（唯一判据，此处不再各判一次）
    },
    [load, queryFor],
  );

  // 切 tab：清空搜索/选择，回到该来源的**默认分类视图**（本地 tab 只清态）。
  useEffect(() => {
    setQ('');
    if (tab === LOCAL_TAB) {
      setCatKey(null);
      setOpenFolder(null);
      setSelected(new Set());
      setItems([]);
      setLoading(false);
      return;
    }
    navigate({ folder: null, cat: defaultCatKey });
  }, [tab, navigate, defaultCatKey]);

  // 上一级（仅下钻态有）：父 = 素材库根 ⇒ 退出下钻回「全部」。
  // 父路径与按钮文案**共用这一处解析**（禁两处各算一遍）。
  const upLevel = useMemo(() => {
    if (!openFolder) return null;
    // 上钻一级走共用 libraryUpFolder（到顶 → null ⇒ 回默认分类视图）。
    const parent = libraryUpFolder(openFolder);
    return { folder: parent, label: parent ? (parent.split('/').pop() ?? '') : '全部' };
  }, [openFolder]);
  const enterFolder = useCallback(
    (path: string) => {
      if (path) navigate({ folder: path, cat: null });
    },
    [navigate],
  );
  const goUp = useCallback(() => {
    if (upLevel) navigate({ folder: upLevel.folder, cat: upLevel.folder ? null : defaultCatKey });
  }, [upLevel, navigate, defaultCatKey]);

  // 关键词过滤（客户端；当前已加载页内 —— 与 provider 的诚实边界一致）。
  const visible = useMemo(() => {
    if (!q) return items;
    const k = q.toLowerCase();
    return items.filter((it) => it.name.toLowerCase().includes(k));
  }, [items, q]);

  // 目录条目（可点进入 / 可拖入）与媒体条目（可选中导入）：**同一个 grid** 里分两段渲染（同一滚动条）。
  const folderCards = useMemo(() => visible.filter((it) => it.isFolder), [visible]);
  const mediaItems = useMemo(() => visible.filter((it) => !it.isFolder), [visible]);

  // 「文件 → 目录条目」归类拖拽：复用唯一收敛点（不在此自写移动逻辑；落点路径 = `folderPathOf`）。
  // 归类后**静默**重拉当前浏览位置（该文件应离开「未归类」）。
  const refreshCurrent = useCallback(() => {
    load(queryFor(openFolder, catKey), { silent: true });
  }, [load, queryFor, openFolder, catKey]);
  const { sourceDragProps, folderDropProps } = useResourceMoveToFolder({
    connected: status.isConnected,
    onRefreshed: refreshCurrent,
  });

  const toggle = useCallback((ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    const picked = mediaItems.filter((it) => selected.has(it.ref));
    if (picked.length === 0) return;
    let outcome: ImportPickOutcome;
    try {
      outcome = await onPick(picked);
    } catch (e) {
      // 宿主在契约外抛错：只转发它的可展示信息 —— 消费者不自造文案、不替生产端下结论。
      logger.warn('导入弹窗', '宿主落地动作在契约外抛错', e);
      toastError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!outcome.ok) {
      // 失败判词由**生产端**给全，这里原样转发；失败不关弹窗（用户可重试）。
      toastError(outcome.message);
      return;
    }
    // 成功文案同样来自生产端；它没给 = 结果本身已可见（如画布上出现了节点），不替它播报。
    if (outcome.message) toastSuccess(outcome.message);
    onClose?.();
  };

  /**
   * 本机文件的**唯一交接处**（「点投放区 / 拖文件进来」两条入口都走它）。
   * · 交宿主落地（同 `onPick` 纪律：弹窗不自己处理文件 —— 画布 `createNodeFromFile` / 剪辑器 `processFiles`）；
   * · 交出后**关弹窗**：与「导入选中」一致（动作已完成，不该让用户再手动关一次）。
   */
  const handleLocalFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || !onLocalFiles) return;
      // 【2026-09-17 TD-16-34②】交接是异步的：旧实现 `void onLocalFiles(files)` 后**立即** onClose ——
      // 失败既不可见（unhandled），弹窗也已关（用户无处重试）。改为等它落定：成功才关，失败留痕 + 提示。
      Promise.resolve(onLocalFiles(files))
        .then(() => onClose?.())
        .catch((e: unknown) => {
          logger.warn('导入弹窗', '本机文件导入失败', e);
          toastError('导入失败，请重试');
        });
    },
    [onLocalFiles, onClose],
  );

  const isLocal = tab === LOCAL_TAB;

  return (
    <div className="cl-card">
      {/* 顶栏：来源文字 tab + 搜索 + 关闭（沿用 creative 创作库的 .cl-tabs 语言） */}
      <div className="pk-head">
        <div className="cl-tabs" role="tablist" aria-label="导入来源">
          {/* 每个 tab 都来自 `tabs`（本地伪来源 + **已注册**来源）⇒ 结构上不可能出现"未注册的来源 tab"，
              原先那条 `display:none` 守卫（为硬编码清单兜底的补偿）随之删除。 */}
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="cl-tab"
              onClick={() => {
                setTab(key);
                // 「本地导入」是**写动作**不是来源：点它（含已选中时再点）直接拉起系统选择器
                // —— 用户裁定 2026-09-17（方案 A：tab 即动作 + 内容区仍是投放区，两条入口都要活）。
                if (key === LOCAL_TAB && onLocalFiles) fileInputRef.current?.click();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="pk-head-spacer" />
        {!isLocal && (
          <label className="cl-search cl-search-top">
            <Search size={13} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索当前来源" />
          </label>
        )}
        <button type="button" className="cl-icon-btn" onClick={onClose} title="关闭（Esc）">
          <X size={14} />
        </button>
      </div>

      {/* 本机文件输入（**常驻挂载**）：不能只放在「本地导入」分支里 —— 点该 tab 的那一刻分支尚未渲染，
          `fileInputRef.current` 会是 null，选择器拉不起来。视觉上 display:none，零布局影响。 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleLocalFiles(e.target.files);
          e.target.value = ''; // 清空，同一个文件可再次选择
        }}
      />

      {/* 副条：来源内部的**分类**（由 provider 声明 · 复用 creative 的分类 pills 语言）
          + **目录下钻的返回入口**（仅下钻态出现）。
          无 categories 的来源（如「画布」）不显示本行。 */}
      {(categories.length > 0 || openFolder) && (
        <div className="cl-sub">
          <div className="cl-subrow">
            {openFolder && (
              <button
                type="button"
                className="cl-btn is-ghost"
                onClick={goUp}
                title={`返回「${upLevel?.label ?? '全部'}」`}
              >
                <ChevronLeft size={13} /> 返回「{upLevel?.label ?? '全部'}」
              </button>
            )}
            <div className="pk-pills">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="pk-pill"
                  aria-pressed={catKey === c.key}
                  // 点分类 = 跳回分类视图（与目录下钻互斥，见 navigate）。
                  onClick={() => navigate({ folder: null, cat: c.key })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 主体 */}
      <div className="cl-main">
        {isLocal ? (
          /* 本地导入 = **写动作**（不是读来源）：内容区本身就是投放区。
             用户裁定 2026-09-17（方案 A 合成）：点「本地导入」tab 直接拉选择器；内容区可点可拖
             ⇒ ① 打开弹窗不再看到空界面；② 取消系统框后可反复重试；③ 补上弹窗内**原本不支持拖入**的缺口。
             视觉与同面板虚线卡 `.cl-card-item.is-folder` 同一套虚线语法（见 creative-library.css）。 */
          <div className="cl-col">
            <div
              className={`cl-drop ${dragOver ? 'is-over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="选择或拖入本机文件"
              onClick={() => onLocalFiles && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onLocalFiles) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                // 阻止默认（否则浏览器会"打开文件"）+ 阻止冒泡（否则画布/剪辑器面板的 document 级
                // drop 监听会**再导入一次** ⇒ 同一批文件被导入两遍）。
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                // 掠过子元素也会触发 dragleave：只有真正离开投放区才取消高亮（否则闪烁）
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                handleLocalFiles(e.dataTransfer?.files ?? null);
              }}
            >
              <UploadCloud size={26} strokeWidth={1.4} className="text-muted" />
              <p>点击选择文件，或把文件拖到这里</p>
              {!onLocalFiles && <p className="cl-empty">当前入口不支持本地导入</p>}
            </div>
          </div>
        ) : error ? (
          /* 诚实错误态（不静默成空） */
          <div className="cl-grid">
            <p className="cl-empty">加载失败：{error}</p>
          </div>
        ) : loading ? (
          <div className="cl-grid">
            <p className="cl-empty">加载中…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="cl-grid">
            <p className="cl-empty">没有可导入的媒体</p>
          </div>
        ) : (
          /* 内容列 = **一个网格（一个滚动容器）**：目录条目在前、媒体条目在后，同网格 ⇒ 同列数、
             同 16:9 盒高、同一个滚动条。⚠️ 禁止拆两个 .cl-grid（详见文件头【内容区结构铁律】）。 */
          <div className="cl-col">
            <div className="cl-grid">
              {/* 目录条目（provider 从后端返回的 `type:'folder'` 条目 → **动态**：磁盘有什么显示什么）。
               **点 = 进入该目录**（路径 = folderPathOf 唯一实现）、**拖入 = 归类落点**。 */}
              {folderCards.map((it) => (
                <article
                  key={it.ref}
                  // `.is-folder` = 与图片卡同一 16:9 盒（16:9 由 .cl-card-item::before 顶出，
                  // 本档不覆盖、无 min-height；图标绝对居中）—— 用户裁定：文件夹必须与图片一样大小。
                  className="cl-card-item is-folder"
                  title={`进入「${it.name}」（也可把文件拖进来归类）`}
                  onClick={() => enterFolder(folderPathOf(it))}
                  {...folderDropProps(it)}
                >
                  <FolderOpen size={26} className="text-muted" strokeWidth={1.4} />
                  <div className="cl-name">
                    <p>{it.name}</p>
                  </div>
                </article>
              ))}
              {mediaItems.map((it) => (
                <article
                  key={it.ref}
                  className={`cl-card-item ${selected.has(it.ref) ? 'is-on' : ''}`}
                  title={it.name}
                  onClick={() => toggle(it.ref)}
                  // 可拖拽（拖到**目录条目**上即归类）；与"点击选中导入"互不冲突
                  // （dragstart 才写移动 payload，单击不触发）。
                  // ⚠️ `draggable` 的类型是 `boolean|string`（历史实现，见 hook 注释），
                  // JSX 只接受 Booleanish → 用 `!!` 收窄（运行时语义不变：真值即 true）。
                  {...(() => {
                    const p = sourceDragProps({
                      folder: it.folder,
                      name: it.name,
                      url: it.url,
                      source: it.source,
                      type: it.type,
                      contentId: it.contentId,
                    });
                    return { ...p, draggable: !!p.draggable };
                  })()}
                >
                  {it.type === 'video' ? (
                    <video src={it.url} muted loop playsInline preload="metadata" />
                  ) : (
                    <LazyImage
                      src={it.thumbnailUrl || it.url}
                      alt={it.name}
                      className="absolute inset-0"
                    />
                  )}
                  <div className="cl-name">
                    <p>{it.name}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底栏：计数 + 确认（非本地 tab） */}
      <div className="pk-list-foot">
        {isLocal ? (
          <span>从本机选择文件导入</span>
        ) : (
          <>
            <span>
              共 {mediaItems.length} 项 · 已选 {selected.size}
              {folderCards.length > 0 ? ` · 可拖入 ${folderCards.length} 个文件夹` : ''}
            </span>
            <button
              type="button"
              className="cl-btn is-primary"
              disabled={selected.size === 0}
              onClick={() => void handleConfirm()}
            >
              导入选中 {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
