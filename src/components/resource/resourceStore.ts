/**
 * 素材库 store（模拟 + 本地存储 + 事件订阅）。
 *
 * 素材按「目录」分类，目录对齐 loctool 的 folder 落盘结构：
 *  - tasks             AI生成结果
 *  - migrated          剪贴板
 *  - migrated/人物      剧本角色资产
 *  - migrated/场景      剧本场景资产
 *  - migrated/道具      剧本道具资产
 *  - migrated           素材库（通用，上传默认落此）
 *
 * 素材字段：{ id, folder, type, url, name, size, ts }
 *  type: 'image' | 'video' | 'audio'
 *
 * 接真系统：本 store 是前端本地缓存（localStorage），后端 `resources` 表才是落盘真相
 * （素材库面板读 /api/resources，画布 asset 经 contentId → 本 store 解析）。
 * 「发送到素材库」（sendToResourceLibrary）三段顺序 —— 缺一段即用户报障「点了却库里没有」：
 *   ① 落盘 URL → uploads（判据唯一在 `filesApi.persistUrlToUploads`；已在 uploads 的不重传）
 *   ② 归位：把 resource 行认到目标目录（context-only，复用 filesApi.moveFile）
 *   ③ 广播 `resource:sent` → 面板 rescan 拉取（此刻文件/行/目录三件齐备）
 */
import { contentGet, contentSet, createDebouncedPersist } from '../base/core/contentStore.ts';
import { KEY_YIMAO_ASSET_LIBRARY } from '../base/core/contracts.ts';
import { isStorageReady, onStorageReady } from '../base/storage/index.ts';
import { generateId } from '../base/core/idGen.ts';
import '../base/core/config.ts';
import { rescanResources } from '../base/api/localToolApi.ts';
import type { ResourceItem } from '../base/api/localToolApi.ts';
// 分页读取的唯一实现（本 store 自刷镜像用；不抄上限数字）
import { fetchAllResourcePages } from '../base/api/pagedList.ts';
import {
  persistUrlToUploads,
  moveFile,
  resolveMovePaths,
  relativePathFromUrl,
} from '../base/api/filesApi.ts';
import type { PersistOutcome } from '../base/api/filesApi.ts';
import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts';
import { fileNameFromUrl } from '../base/core/utils.ts';
import { detectFileType } from '../base/utils/assetType.ts';
import { logger } from '../base/core/logger.ts';
import { confirmPersist } from '../base/core/degrade.ts';
import { publish, subscribe } from '../base/core/eventBus.ts';
import { getCurrentProject } from '../base/store/projectStore.ts';
import type { AssetType } from '@/types';

/** 落盘结果契约由**拥有真相的那一层**（文件域 filesApi）定义，本 store 只转出（消费方零改动）。 */
export type { PersistOutcome };

/** 素材记录 */
export interface Resource {
  id: string;
  /** 落盘目录，对齐 loctool 的 folder 结构（tasks / migrated / migrated/人物 …） */
  folder: string;
  type: AssetType;
  name: string;
  url: string;
  size: number;
  ts: number;
  /** docs/122 #4：稳定 contentId（= 后端 resources.sha1，<alg>:<hex>）；文件型 asset 持此身份解析 url */
  contentId?: string;
  /**
   * 项目隔离标识（后端 resources.project_id 的镜像）。
   * legacy（undefined/null）= 无项目归属 → `resourcesOfProject` 判为全项目可见。
   * 【TD-12-5】此前未显式声明、靠 `[key:string]:unknown` 兜底 → `buildResourceRecord` 静默丢字段时类型层不可见。
   */
  projectId?: string;
  [key: string]: unknown;
}

/** 目录 pill 配置 */
export interface FolderPill {
  key: string;
  label: string;
  /** null = 全部（不过滤） */
  folder: string | null;
}

/** resourceDetectAssetType 的入参最小契约：只需 name / type 两个字段（既有调用传字面量，非真 File） */
export interface TypeProbe {
  name?: string;
  type?: string;
}

// TD-13-4：键名唯一真源 = contracts.ts 的 KEY_YIMAO_ASSET_LIBRARY（不再本地复刻字面量）。
const STORAGE_KEY = KEY_YIMAO_ASSET_LIBRARY;

// 预置演示素材（首次使用/本地为空时 seed，方便直观看到目录效果）
const DEFAULT_RESOURCES: Resource[] = [
  {
    id: 'a_gen_1',
    folder: 'tasks',
    type: 'image',
    name: '赛博朋克夜景.png',
    url: 'https://picsum.photos/seed/cyberasset/200/200',
    size: 1024 * 320,
    ts: 0,
  },
  {
    id: 'a_gen_2',
    folder: 'tasks',
    type: 'video',
    name: '花园小猫.mp4',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    size: 1024 * 2100,
    ts: 0,
  },
  {
    id: 'a_mig_1',
    folder: 'migrated/人物',
    type: 'image',
    name: '主角立绘.png',
    url: 'https://picsum.photos/seed/char/200/200',
    size: 1024 * 280,
    ts: 0,
  },
  {
    id: 'a_mig_2',
    folder: 'migrated/场景',
    type: 'image',
    name: '雨夜街道.png',
    url: 'https://picsum.photos/seed/scene/200/200',
    size: 1024 * 250,
    ts: 0,
  },
  {
    id: 'a_mig_3',
    folder: 'migrated/道具',
    type: 'image',
    name: '魔法书.png',
    url: 'https://picsum.photos/seed/prop/200/200',
    size: 1024 * 210,
    ts: 0,
  },
  {
    id: 'a_mat_1',
    folder: 'migrated',
    type: 'audio',
    name: '背景音效.mp3',
    url: '',
    size: 1024 * 1500,
    ts: 0,
  },
];

function load(): Resource[] {
  // contentGet 返回 unknown（存储值不可信）：先 Array.isArray 判「确实是数组」，再按 Resource[]
  // 收窄（外层有运行时守卫才诚实，F9），不要在断言后才补守卫。
  const raw = contentGet(STORAGE_KEY);
  if (Array.isArray(raw) && raw.length > 0) return raw as Resource[];
  // 首次：seed 演示素材
  const seeded = DEFAULT_RESOURCES.map((a) => ({ ...a, ts: Date.now() }));
  // 【未就绪不回写（2026-09-12 / TD-02-2）】预填完成前读到的是「还不知道」，回写种子会覆盖真实素材库
  if (isStorageReady()) {
    // 演示种子属 best-effort：失败留痕即可（confirmPersist 按 landed 如实记）
    confirmPersist(contentSet(STORAGE_KEY, seeded), { layer: 'resourceStore', key: STORAGE_KEY });
  }
  return seeded;
}

// 初始化素材列表（必须在 DEFAULT_RESOURCES 与 load 定义之后）
let resources = load();

// 目录 pill 配置（含 folder 前缀匹配）
// 【根目录不写死字面量（2026-09-17 收口）】根 = `UPLOAD_DIRS.migrated`（uploads 目录中央表）
// —— 此前 `'migrated'` 在本文件/ResourceLibrary/librarySource/导入弹窗各写一份（4 份），
// 改一处必漂移；现全部派生自真源（TD-02-54）。
export const FOLDERS: FolderPill[] = [
  { key: 'all', label: '全部', folder: null },
  { key: 'generated', label: 'AI生成', folder: UPLOAD_DIRS.tasks },
  { key: 'character', label: '人物', folder: `${UPLOAD_DIRS.migrated}/人物` },
  { key: 'scene', label: '场景', folder: `${UPLOAD_DIRS.migrated}/场景` },
  { key: 'prop', label: '道具', folder: `${UPLOAD_DIRS.migrated}/道具` },
  { key: 'migrated', label: '素材库', folder: UPLOAD_DIRS.migrated },
];

/**
 * 「面向用户素材」的**静态基底**白名单 —— 哪些 FOLDERS 项无条件算**素材库来源**的分类。
 * 【为什么住这里】FOLDERS 的拥有者就是本文件 ⇒ 这条判据归真源拥有者。
 * 【收口(2026-09-17)】此前 `base/media/providers/librarySource.ts` 与 `panels/ResourceLibrary.tsx`
 * **各抄一份同名同值数组**（M3 第二份，靠注释同步）⇒ 改一处必漂移。现仅此一份，两处 import 复用。
 * 注：`tasks` 归「生成」来源承载，故不在白名单（不重复出一个 tab）。
 *
 * 【TD-03-15 · 2026-09-18 静态清单的隐含假设过期】
 * 本白名单原为**静态 4 项**，假设「素材都经用户手动导入到 migrated 的那几个固定分类下」。
 * 但磁盘实况是：用户在 `migrated` 下**自建目录**（实测 `颜色`／`HKH其他产品`）不在名单里
 * ⇒ 侧边栏与导入弹窗都**没有对应 pill**，而唯一进口「全部」用的是 `folderExact:'migrated'`
 * （只显示根目录本身，实测 0 文件）⇒ **用户永远点不进自己建的目录**。
 * 【修法】清单由「静态基底 **∪** 磁盘实有子目录」派生（见 `libraryFoldersOf`）——
 * 静态项保证顺序与稳定，磁盘项保证**用户新建的目录立刻可达**（数据驱动，清单不再需要人肉同步）。
 */
const LIBRARY_BASE_KEYS: readonly string[] = ['all', 'character', 'scene', 'prop'];

/**
 * 静态基底清单（导出的常量，保持既有消费方语义不变：只含无条件成立的 4 项）。
 * ⚠️ 仅供「不依赖磁盘实况」的场景（如 `resourceFolderOf` 的落点判定）使用；
 * **UI 分类清单**请用 `libraryFoldersOf(folderRows)`（含磁盘实有子目录）。
 */
export const LIBRARY_CATEGORY_KEYS: readonly string[] = LIBRARY_BASE_KEYS;

/** FOLDERS 里「素材库子分类」的 key 前缀约定：子目录 pill 的 key = `sub:<目录名>`。 */
const SUB_FOLDER_KEY_PREFIX = 'sub:';

/**
 * 素材库 UI 分类清单（**唯一实现**）：静态基底 **∪** 磁盘实有子目录。
 *
 * 【为什么需要磁盘那一半（TD-03-15）】静态清单写死 4 项 ⇒ 用户在 `migrated` 下新建的目录
 * 在 UI 里**没有入口**（实测 `颜色`／`HKH其他产品` 点不进去）。本函数把「目录也存在」这件事
 * 纳入清单判据，使**新建目录即自动获得 pill**，无需任何人工同步。
 *
 * 【数据从哪来（不新增接口）】后端 `/api/resources` 返回的 `type:'folder'` 条目就是磁盘目录的
 * 实时投影（`resources.ts::scanRescanDir` 对每个目录录一行 `type:'folder'`）。
 * 调用方把已拉到的 folder 行传进来即可 —— 本函数**纯函数、零 IO**。
 *
 * 【为什么基线仍保留静态项】磁盘为空 / 未连接 / 首次启动时，基底项保证 UI 结构稳定
 * （不出现"pill 忽多忽少"）；磁盘项在其后追加，顺序为「基地顺序 → 磁盘发现顺序」。
 *
 * @param folderRows 后端返回的目录行（`type:'folder'`）—— 只读 `folder`/`name` 两字段
 * @returns 分类清单（不含 `generated`：tasks 由独立来源承载，见 LIBRARY_BASE_KEYS 注释）
 */
export function libraryFoldersOf(
  folderRows: readonly { folder?: string | null; name?: string | null }[] = [],
): FolderPill[] {
  const out: FolderPill[] = [];
  const seenFolder = new Set<string>();
  for (const key of LIBRARY_BASE_KEYS) {
    const hit = FOLDERS.find((f) => f.key === key);
    if (!hit) continue;
    out.push(hit);
    if (hit.folder) seenFolder.add(hit.folder);
  }
  // 磁盘实有子目录：目录行形如 { folder:'migrated', name:'颜色' } ⇒ 子目录路径 = `migrated/颜色`。
  // 由「父目录 + 目录名」派生的**唯一实现**（不自拼，防脏 folder）；只在父 = 素材库根时纳入。
  for (const row of folderRows) {
    const parent = String(row.folder ?? '').replace(/\/+$/, '');
    const name = String(row.name ?? '').trim();
    if (!name || parent !== UPLOAD_DIRS.migrated) continue;
    const path = `${parent}/${name}`;
    if (seenFolder.has(path)) continue; // 已在静态基底里（如 人物/场景/道具）
    seenFolder.add(path);
    out.push({ key: `${SUB_FOLDER_KEY_PREFIX}${name}`, label: name, folder: path });
  }
  return out;
}

/**
 * 剧本分类 → 素材库目录的单一映射（剧本盒不自己拼路径，收口在 FOLDERS 语义）。
 * character→migrated/人物、scene→migrated/场景、prop→migrated/道具，其它→素材库根。
 * 【收口(2026-09-17)】原实现自带一份 `category → 'migrated/人物'` 的 map，与 `FOLDERS` 三项**逐字重复**
 * （M3 第二份：改 FOLDERS 不改这里 = 剧本盒静默落错目录）。现**派生自 FOLDERS**，只认白名单内的分类，
 * 其余（含 'generated' / 未知）一律落素材库根 —— 与旧 map 对全部真实入参（character/scene/prop/undefined）逐一等价。
 * @param {string} [category] character|scene|prop
 * @returns {string} 落盘目录（与后端 folder 结构一致）
 */
export function resourceFolderOf(category?: string): string {
  const hit =
    category && LIBRARY_CATEGORY_KEYS.includes(category)
      ? FOLDERS.find((f) => f.key === category)?.folder
      : null;
  return hit ?? UPLOAD_DIRS.migrated;
}

// P4 落盘节流：高频变更（拖入/批量生成/上传进度）合并落盘，消除主线程长任务。
// write 是「读当前最新 resources」的 thunk —— flush 时才执行，天然把窗口内多次变更合并为最终态。
// 只有「落盘」被节流，UI 响应性不受影响；调度入口见 schedulePersist（原 notify —— 无订阅者，已正名）。
// 【2026-09-17 TD-24-4 阶段1】素材库是**用户主数据**：落盘失败由本处自报（reportDegrade toast 节流），
// 不再寄生于 persist:failed 全局总线（它对本路径时有时无，见 24 区日志 §十一 盲区）。
const persistDebounced = createDebouncedPersist(
  () =>
    confirmPersist(contentSet(STORAGE_KEY, resources), {
      layer: 'resourceStore',
      key: STORAGE_KEY,
      toast: '素材库未能保存（本地存储不可用），刷新可能丢失最近的素材变更',
    }),
  300,
);

function schedulePersist(): void {
  persistDebounced.schedule();
}

/**
 * 【TD-02-2】存储预填就绪后重读一次：扩展环境下模块级 `load()` 早于 `initStorage()`，
 * 只能拿到演示种子（此时不回写）；就绪后重读，真实素材库才不会被整会话遮成演示数据。
 */
onStorageReady(() => {
  reloadFromStorage();
  // 【TD-02-59】镜像由 store **自己**刷一次：不再等"某个界面被打开"才被顺便填上（见 refreshFromBackend 注释）
  void refreshFromBackend();
});

/** 强制立即落盘（页面卸载兜底 / 测试用）；createDebouncedPersist 已自动注册 pagehide 兜底
 * @public 跨边界消费者：tests/unit/resourceStore.test.ts（测试出口，先例同 projectStore.resetProjectStoreForTest） */
export function resourceFlushPersist(): void {
  persistDebounced.flush();
}

/** 读取当前内存素材列表（供测试/非 React 场景） */
export function getResources(): Resource[] {
  return resources;
}

/** 当前项目 id（非 React 场景读 projectStore 快照）。
 *  【消费者不越权 · 2026-09-17 删 catch】`getCurrentProject()` 是内存真相读取（projectStore 恒返回一个
 *  Project，从不抛）。旧 `catch { return null }` 既不可达，又让「取不到项目」与「项目确实是 null」混同
 *  ⇒ `resourcesOfProject` 用 pid=null 过滤 ⇒ 带 projectId 的素材**静默不可见**。 */
function currentProjectId(): string | null {
  return getCurrentProject()?.id ?? null;
}

/**
 * 供展示/面板做项目过滤（docs/122 #2/#7，纯函数、非响应式）：
 * legacy（无 `projectId`）全项目可见；显式 `projectId` 仅其项目可见。
 * 不改动 store 的响应式读（`getSnapshot` 过滤会破坏 useSyncExternalStore 引用相等 → 重渲染循环）。
 * @param {Resource[]} list 待过滤素材
 * @param {string|null|undefined} [projectId] 当前项目 id；缺省取 projectStore 当前快照
 */
export function resourcesOfProject(list: Resource[], projectId?: string | null): Resource[] {
  const pid = projectId ?? currentProjectId();
  return list.filter((r) => r.projectId == null || r.projectId === pid);
}

function genId(): string {
  return generateId('resource');
}

/**
 * 判断文件类型（图片/视频/音频/文字）。
 * 委托 utils/assetType.detectFileType（扩展名/mime 唯一真值源），未识别一律兜底 image
 * （素材库只有四类，无 other/empty；与既有兜底行为一致）。
 */
export function resourceDetectAssetType(file?: TypeProbe | null): AssetType {
  const kind = detectFileType(file);
  return kind === 'video' || kind === 'audio' || kind === 'text' ? kind : 'image';
}

// 判断目录命中：folder 是否为当前 pill 的 folder 前缀
function matchesFolder(assetFolder: string, folder: string | null): boolean {
  if (folder === null) return true; // 全部
  // 素材库根（真源 UPLOAD_DIRS.migrated）是**特例**：它代表"整个素材库"，含全部子目录。
  if (folder === UPLOAD_DIRS.migrated)
    return (
      assetFolder === UPLOAD_DIRS.migrated || assetFolder.startsWith(`${UPLOAD_DIRS.migrated}/`)
    );
  return assetFolder === folder || assetFolder.startsWith(folder + '/');
}

// 按目录 pill 过滤素材
export function filterByFolder(list: Resource[], folder: string | null): Resource[] {
  return list.filter((a) => matchesFolder(a.folder, folder));
}

/** addResources 的入参项：缺字段由 store 补默认（id/folder/type/name/size/ts） */
export type NewResourceItem = Partial<Resource>;

/**
 * 把一条「缺字段的素材入参」规范化为完整 Resource 记录（纯函数，供 addResources 复用）。
 * - id 缺省 genId()；folder 缺省取入参 folder；type 缺省 'image'；name 缺省 '未命名'；size/ts 缺省 0/now。
 * - 不 mutate item、不触发任何副作用；返回新对象（登记语义，无共享可变态）。
 */
export function buildResourceRecord(item: NewResourceItem, folder: string, now: number): Resource {
  return {
    id: item.id || genId(),
    folder: item.folder || folder,
    type: item.type || 'image',
    url: item.url ?? '',
    name: item.name || '未命名',
    size: item.size || 0,
    ts: item.ts || now,
    contentId: item.contentId,
    // 【TD-12-5 修复】透传 projectId：调用方（sendToResourceLibrary/localizeAndStoreToResourceLibrary）
    // 都传了它，此前此处静默丢弃 → `resourcesOfProject` 恒判 legacy → 新素材跨项目可见（隔离失效）。
    projectId: item.projectId,
  };
}

/**
 * 把后端 /api/resources 拉取到的资源并入本 store（docs/122 #4「统一 resourceStore 与后端源」）。
 * 画布 asset 节点持稳定 contentId，经本 store 的 contentId→url 解析出 url；面板与 AssetNode
 * 共用同一份真相，改名/移动（context-only，url 不变）即自动跟随，无需四态 URL 改写广播。
 * 后端项按 id 去重并入（同 id 以 backend 为准覆盖）；纯本地项（demo 种子 / 未落盘 send）保留。
 * 注：合并后照常落盘；下次面板 fetch 会重新合并，以后端为最新真相，避免把后端快照长期固化。
 * @param {ResourceItem[]} items 后端资源列表（含 contentId / url / folder / type 等）
 */
export function mergeResourcesFromBackend(items: ResourceItem[]): void {
  if (!Array.isArray(items) || items.length === 0) return;
  const incoming = new Map<string, Resource>();
  for (const it of items) {
    if (!it?.id) continue;
    incoming.set(it.id, {
      id: it.id,
      folder: it.folder || '',
      type: (it.type as AssetType) || 'image',
      name: it.name || '未命名',
      url: it.url || '',
      size: typeof it.size === 'number' ? it.size : 0,
      ts: typeof it.timestamp === 'number' ? it.timestamp : Date.now(),
      contentId: it.contentId,
      ...(it.projectId != null ? { projectId: it.projectId } : {}),
    });
  }
  // 本地项（demo / 未落盘）保留；backend 项覆盖同 id；backend 新项追加。
  // 【TD-12-2】**同时按 url 归并**：本地占位项（随机 id）落盘成功后 url 已校正为后端持久 url，
  // 与 backend 项同 url = 同一物理文件 = 同一素材 → 去掉本地项，杜绝「同一素材并存两行」的残留
  //（改前只按 id 去重，而随机 id 与后端路径 id 永不相交 → 同一素材两行且永不回收）。
  const incomingUrls = new Set(
    Array.from(incoming.values())
      .map((r) => r.url)
      .filter(Boolean),
  );
  const kept = resources.filter((r) => !incoming.has(r.id) && !(r.url && incomingUrls.has(r.url)));
  resources = [...kept, ...Array.from(incoming.values())];
  schedulePersist();
}

/**
 * 从后端刷新素材索引（**store 自有的填充入口** · TD-02-59 收口）。
 *
 * 【为什么必须由 store 自己做】此前「往后端镜像里填条目」**没有归属**：只能靠某个消费方读到之后
 * 顺便 `mergeResourcesFromBackend(...)`（import 弹窗的 `provider.list` / 素材库面板 / 剧本盒选择器各一处）
 * —— 于是镜像完不完整**取决于用户打开了哪个界面**，`contentId → url` 解析随**时序**静默失效
 * （同一份画布快照，先开弹窗后开面板能显示、反过来就可能解析不到）。
 * 现在：store 在**存储就绪后自己刷一次**（与 `taskStore.initTasks` 同性质：把后端真相拉进内存镜像），
 * 契约层（`base/media/**`）**只读不写**。面板/选择器仍可把自己读到的分片并入（那是"读即同步"，
 * 走同一公开入口 `mergeResourcesFromBackend`，不是绕过所有方改内部状态）。
 *
 * 失败**不静默**：只 `logger.warn` 留痕（镜像刷新是后台动作，用户侧的可见失败由各面板自己的错误态负责）。
 */
export async function refreshFromBackend(): Promise<void> {
  try {
    const items = await fetchAllResourcePages({});
    mergeResourcesFromBackend(items);
  } catch (e) {
    logger.warn(
      'resourceStore',
      '从后端刷新素材索引失败（镜像可能不完整）',
      (e as { message?: string })?.message,
    );
  }
}

// 新增素材（folder 指定落目录，缺省 migrated）
export function addResources(
  items: NewResourceItem[],
  folder: string = UPLOAD_DIRS.migrated,
): Resource[] {
  const now = Date.now();
  const added = items.map((it) => buildResourceRecord(it, folder, now));
  resources = [...added, ...resources];
  schedulePersist();
  return added;
}

/**
 * 发送任意 URL 素材到素材库（节点「发送到素材库」统一入口）。
 * - 自动按 URL/文件名推断类型（resourceDetectAssetType）；
 * - 默认落入「素材库(migrated)」目录；可传 folder 覆盖（如 'tasks'）；
 * - 名称优先用传入 name，否则用 URL 文件名，再否则「未命名」。
 *
 * 【三段顺序 = 真相顺序（TD-12-10 收口轮）】「发送到素材库」= 让素材**在素材库目录下可用**，
 * 而不只是「文件落到了磁盘某处」——三段缺一即用户报障：
 *   ① 落盘（必要时）：URL → uploads 持久 url。判据唯一在 `filesApi.persistUrlToUploads`；
 *      已是本机 /files/ 的**不重传**（重传会撞后端 contentId 去重、行留旧目录 = 假成功）。
 *   ② 归位：把该素材的**资源行**认到目标目录（`relocateToFolder` → filesApi.moveFile 的
 *      context-only 移动原语）。只落盘不归位 → 素材库目录下拉不到它（「点了却库里没有」的结构根因）。
 *   ③ 广播：此刻后端「文件 + 行 + 目录」三件齐备，面板 rescan 才拉得到。
 * 三段的结果如实返回（判别联合），调用方据此决定 toast 真伪与时机（AssetNode / ImageGenerate）。
 *
 * 【登记】仅在落盘成功后登记一条**带后端权威 url** 的行（改前：先登记占位行、成功后打补丁校正、
 * 失败则永久残留一条假素材）。登记 id 由 store 生成、与后端路径 id 不同 →
 * `mergeResourcesFromBackend` 按 url 归并去重（既有机制，本函数不改其语义）。
 *
 * @returns {Promise<PersistOutcome>} 结果；`ok:false` 的 `reason` 词表见 filesApi.PersistFailReason。
 */
export async function sendToResourceLibrary(
  url: string,
  {
    name,
    folder = UPLOAD_DIRS.migrated,
    type,
  }: { name?: string; folder?: string; type?: AssetType } = {},
): Promise<PersistOutcome> {
  if (!url) return { ok: false, reason: 'empty' };
  // TD-16-14：URL→文件名统一走 core/utils 唯一原语（URL 解析剥 ?# + decode 一次）
  const fromUrl = fileNameFromUrl(url);
  const fname = fromUrl && !/^blob:|^data:/.test(url) ? fromUrl : '未命名';
  const resourceName = (name && String(name).trim()) || fname;
  const detectedType = type || resourceDetectAssetType({ name: fname, type: '' });
  // docs/122 #3：登记带当前 projectId（resource 逻辑引用层按项目隔离；渲染过滤见 resourcesOfProject）
  const projectId = currentProjectId() || undefined;

  const outcome = await persistUrlToUploads(url, {
    folder,
    name: resourceName,
    type: detectedType,
    projectId,
  });
  if (!outcome.ok) {
    // 失败不登记、不广播（前端不留假素材；失败可见性由调用方按本结果提示）
    logger.error(
      'resourceStore',
      '发送到素材库失败',
      `${outcome.reason}${outcome.message ? `: ${outcome.message}` : ''} | ${String(url).slice(0, 80)}`,
    );
    return outcome;
  }
  await rescanUploads('发送到素材库');
  const relocated = await relocateToFolder(outcome.url, folder);
  if (!relocated.ok) return relocated;
  // 登记放在**全链路成功之后**（归位失败时不在本地留下「已进素材库」的假行）
  addResources([{ url: outcome.url, name: resourceName, type: detectedType, projectId }], folder);
  emitResourceSent(folder);
  return outcome;
}

/**
 * 把一条素材**归位**到目标目录（context-only：只改 resource 行的 folder，磁盘文件与 url 均不动）。
 *
 * 【为什么必须有这一步】落盘只保证「磁盘上有这个文件」，不保证「资源行属于目标目录」：
 * 内容已在库时上传会命中后端 contentId 去重（`files.ts` 命中即不登记/不刷新行），
 * 于是行留在旧目录（如 tasks）→ 素材库目录下拉不到 → 用户看到「发送了，库里没有」。
 * 归位复用**既有的** context-only 移动原语（`filesApi.moveFile` → 后端 applyResourceContextMove），
 * 不新造第二条改 folder 的路径。
 *
 * 【前提】调用方须先 `rescanUploads()`：行由后端扫描/上传登记建立，否则移动会 404（「资源未同步」）。
 * @returns 成功（含「已在目标目录」的幂等短路）/ 失败（`relocate-failed`，不改写落盘结论）
 */
async function relocateToFolder(
  url: string,
  folder: string,
): Promise<{ ok: true } | { ok: false; reason: 'relocate-failed'; message: string }> {
  if (!relativePathFromUrl(url)) {
    // 非本机 /files/ 形态：无磁盘相对路径可定位 → 无行可归位（不改写落盘结论）
    return { ok: true };
  }
  const { src, dst, sameDir } = resolveMovePaths({ url }, folder);
  if (sameDir) return { ok: true };
  try {
    await moveFile(src, dst);
    return { ok: true };
  } catch (e) {
    const message = (e as { message?: string })?.message || String(e);
    logger.error('resourceStore', '素材归位到目标目录失败', `${folder} | ${message}`);
    return { ok: false, reason: 'relocate-failed', message };
  }
}

/**
 * 重扫后端 upload 目录，让刚落盘的文件在 resources 表有行。
 * 失败只留痕、**不改写落盘结论**（TD-12-2 禁重分类）：rescan 决定「面板何时看到」，
 * 不决定「这是哪个文件」——落盘已成功就不该因扫目录失败而报落盘失败。
 */
async function rescanUploads(reason: string): Promise<void> {
  try {
    await rescanResources();
  } catch (e) {
    logger.warn(
      'resourceStore',
      `重扫 upload 目录失败（${reason}）`,
      (e as { message?: string })?.message,
    );
  }
}

/**
 * 剧本盒资产「真上传」通道（P0-2）：把任意来源素材图真正落盘并返回本地化 /files/ URL。
 * 与 sendToResourceLibrary 的差别**只在失败表达**（本函数 throw，调用方据此置 imageStatus='failed'）
 * —— 落盘判据与顺序与它同源：同一 `persistUrlToUploads`（判据唯一在文件域）+ 同一归位/广播顺序。
 * （改前：本函数内**又抄了一份** data:/blob:/http 分流，与 sendToResourceLibrary 各写各的 → 短路口径漂移。）
 * @returns {Promise<string>} 本地化后的持久 URL（已在 uploads 的素材原样返回，不重传）
 */
export async function localizeAndStoreToResourceLibrary(
  url: string,
  { name, folder = UPLOAD_DIRS.migrated }: { name?: string; folder?: string } = {},
): Promise<string> {
  const src = String(url || '');
  if (!src) throw new Error('无素材可上传');
  const pid = currentProjectId() || undefined;
  const outcome = await persistUrlToUploads(src, { folder, name, projectId: pid });
  if (!outcome.ok) {
    logger.error(
      'resourceStore',
      '素材落盘失败',
      `${outcome.reason}${outcome.message ? `: ${outcome.message}` : ''} | ${src.slice(0, 80)}`,
    );
    throw new Error(outcome.message || '素材落盘失败');
  }
  await rescanUploads('素材入库后');
  // 归位失败只留痕：调用方要的是「可用的持久 url」，图已可用 → 不以 throw 回退它的既有承诺
  const relocated = await relocateToFolder(outcome.url, folder);
  if (!relocated.ok) {
    logger.warn('resourceStore', '素材归位失败（图已可用，仅目录归类未生效）', relocated.message);
  }
  addResources(
    [{ url: outcome.url, name: name || '剧本资产', type: 'image', projectId: pid }],
    folder,
  );
  emitResourceSent(folder);
  return outcome.url;
}

export function removeResource(id: string): void {
  resources = resources.filter((a) => a.id !== id);
  schedulePersist();
}

export function clearResources(): void {
  resources = [];
  schedulePersist();
}

/**
 * 从存储重读素材列表到内存（内部唯一实现：`onStorageReady` 就绪后重读 + 测试出口共用）。
 *
 * 【TD-02-8】原先导出为 `loadResources()`，但 src 零调用方（只有测试拿它当 seed 辅助）——
 * 「定义完整却没人用」的死抽象。改为模块内私有 + 就绪重读复用，公开面不再暴露无调用方 API；
 * 测试改用 `resetResourceStoreForTest`（显式测试出口，仿 `projectStore.resetProjectStoreForTest` 先例）。
 */
function reloadFromStorage(): Resource[] {
  resources = load();
  schedulePersist();
  return resources;
}

/**
 * 【测试出口】把模块级内存态重置为「存储中的素材列表」（等同重新 import 一份干净模块，
 * 但无 vitest 并发下的实例分裂风险——理由见 projectStore.resetProjectStoreForTest 注释）。
 *
 * @public 跨边界消费者：tests/unit/useConnectedInputs.test.ts（测试出口，先例同 projectStore.resetProjectStoreForTest）
 */
export function resetResourceStoreForTest(): Resource[] {
  return reloadFromStorage();
}

// React hook：订阅素材列表

// ── 发送成功事件（P1-D 收口：平行裸回调桥改为 eventBus 事件 resource:sent）──
// 问题背景：resourceStore（落盘）与 ResourceLibrary（读后端 /api/resources）是两套独立模块，
// 互不相通。sendToResourceLibrary 落盘成功后，面板不会自动重新拉取，必须手动切目录才刷新
// （用户体感「点别处才刷新」）。现经 eventBus 发布 resource:sent（EVENTS 已登记），面板订阅后主动刷新。
// onResourceSent/emitResourceSent 保留为薄封装（调用方不变），底层走 eventBus，无平行回调桥。
export function onResourceSent(cb: (folder: string) => void): () => void {
  return subscribe('resource:sent', cb as (payload: unknown) => void);
}
export function emitResourceSent(folder: string): void {
  publish('resource:sent', folder);
}
