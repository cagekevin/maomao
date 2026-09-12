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
 * 接真系统：本 store 是前端本地缓存（localStorage）；
 * 「发送到素材库」（sendToResourceLibrary）现已同时把 URL 素材落盘到 localTool
 * （POST /api/files/upload，subfolder=folder）并 rescan，素材库面板（读 /api/resources）可读到。
 */
import { useMemo, useSyncExternalStore } from 'react';
import { contentGet, contentSet, createDebouncedPersist } from '../core/contentStore.ts';
import { isStorageReady, onStorageReady } from '../storage/index.ts';
import { generateId } from '../core/idGen.ts';
import { httpRequest } from '../api/httpClient.ts';
import '../core/config.ts';
import { rescanResources } from '../api/localToolApi.ts';
import type { ResourceItem } from '../api/localToolApi.ts';
import { saveInlineToLocal, uploadFileToLocal, EXT_BY_TYPE } from '../api/filesApi.ts';
import { UPLOAD_DIRS } from '../utils/uploadDirs.ts';
import { detectFileType } from '../utils/assetType.ts';
import { safeFileName } from '../core/utils.ts';
import { logger } from '../core/logger.ts';
import { publish, subscribe } from '../core/eventBus.ts';
import { getCurrentProject, useCurrentProjectId } from './projectStore.ts';
import type { AssetType } from '@/types';

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
  [key: string]: unknown;
}

/** 目录 pill 配置 */
export interface FolderPill {
  key: string;
  label: string;
  /** null = 全部（不过滤） */
  folder: string | null;
}

/** detectAssetType 的入参最小契约：只需 name / type 两个字段（既有调用传字面量，非真 File） */
export interface TypeProbe {
  name?: string;
  type?: string;
}

const STORAGE_KEY = 'yimao_asset_library';
const listeners = new Set<() => void>();

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
  if (isStorageReady()) contentSet(STORAGE_KEY, seeded);
  return seeded;
}

// 初始化素材列表（必须在 DEFAULT_RESOURCES 与 load 定义之后）
let resources = load();

// 目录 pill 配置（含 folder 前缀匹配）
export const FOLDERS: FolderPill[] = [
  { key: 'all', label: '全部', folder: null },
  { key: 'generated', label: 'AI生成', folder: 'tasks' },
  { key: 'character', label: '人物', folder: 'migrated/人物' },
  { key: 'scene', label: '场景', folder: 'migrated/场景' },
  { key: 'prop', label: '道具', folder: 'migrated/道具' },
  { key: 'migrated', label: '素材库', folder: 'migrated' },
];

/**
 * 剧本分类 → 素材库目录的单一映射（剧本盒不自己拼路径，收口在 FOLDERS 语义）。
 * character→migrated/人物、scene→migrated/场景、prop→migrated/道具，其它→migrated。
 * @param {string} [category] character|scene|prop
 * @returns {string} 落盘目录（与后端 folder 结构一致）
 */
export function resourceFolderOf(category?: string): string {
  const map: Record<string, string> = {
    character: 'migrated/人物',
    scene: 'migrated/场景',
    prop: 'migrated/道具',
  };
  return (category && map[category]) || 'migrated';
}

// P4 落盘节流：高频变更（拖入/批量生成/上传进度）合并落盘，消除主线程长任务。
// write 是「读当前最新 resources」的 thunk —— flush 时才执行，天然把窗口内多次变更合并为最终态。
// 通知订阅者（notify）保持即时，只有「落盘」被节流，UI 响应性不受影响。
const persistDebounced = createDebouncedPersist(() => contentSet(STORAGE_KEY, resources), 300);

function notify(): void {
  persistDebounced.schedule();
  listeners.forEach((l) => l());
}

/**
 * 【TD-02-2】存储预填就绪后重读一次：扩展环境下模块级 `load()` 早于 `initStorage()`，
 * 只能拿到演示种子（此时不回写）；就绪后重读，真实素材库才不会被整会话遮成演示数据。
 */
onStorageReady(() => {
  reloadFromStorage();
});

/** 强制立即落盘（页面卸载兜底 / 测试用）；createDebouncedPersist 已自动注册 pagehide 兜底 */
export function flushPersist(): void {
  persistDebounced.flush();
}

function storeSubscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Resource[] {
  return resources;
}

/** 读取当前内存素材列表（供测试/非 React 场景） */
export function getResources(): Resource[] {
  return resources;
}

/** 当前项目 id（非 React 场景读 projectStore 快照；未初始化返回 null） */
function currentProjectId(): string | null {
  try {
    return getCurrentProject()?.id ?? null;
  } catch {
    return null;
  }
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
export function detectAssetType(file?: TypeProbe | null): AssetType {
  const kind = detectFileType(file);
  return kind === 'video' || kind === 'audio' || kind === 'text' ? kind : 'image';
}

// 判断目录命中：folder 是否为当前 pill 的 folder 前缀
function matchesFolder(assetFolder: string, folder: string | null): boolean {
  if (folder === null) return true; // 全部
  if (folder === 'migrated')
    return assetFolder === 'migrated' || assetFolder.startsWith('migrated/');
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
    url: item.url,
    name: item.name || '未命名',
    size: item.size || 0,
    ts: item.ts || now,
    contentId: item.contentId,
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
  // 本地项（demo / 未落盘）保留；backend 项覆盖同 id；backend 新项追加
  const kept = resources.filter((r) => !incoming.has(r.id));
  resources = [...kept, ...Array.from(incoming.values())];
  notify();
}

// 新增素材（folder 指定落目录，缺省 migrated）
export function addResources(
  items: NewResourceItem[],
  folder: string = UPLOAD_DIRS.migrated,
): Resource[] {
  const now = Date.now();
  const added = items.map((it) => buildResourceRecord(it, folder, now));
  resources = [...added, ...resources];
  notify();
  return added;
}

/**
 * 发送任意 URL 素材到素材库（节点「发送到素材库」统一入口）。
 * - 自动按 URL/文件名推断类型（detectAssetType）；
 * - 默认落入「素材库(migrated)」目录；可传 folder 覆盖（如 'tasks'）；
 * - 名称优先用传入 name，否则用 URL 文件名，再否则「未命名」。
 * 返回新增的素材数组（供调用方 toast / 其它联动）。
 *
 * 【后端落盘】此前只写前端 localStorage，素材库面板读的是后端 /api/resources，两套割裂导致
 * 「已发送但面板看不到」。现补上：把 URL 素材经 localTool 落盘到对应 folder 目录（幂等 sha1 去重），
 * 落盘成功后 rescan，素材库面板即可读到。data: → multipart；http(s) → 下载成 Blob 后 multipart。
 * blob: 是本地临时地址，不落盘（调用方应传 data:/http）。
 */
export function sendToResourceLibrary(
  url: string,
  {
    name,
    folder = UPLOAD_DIRS.migrated,
    type,
  }: { name?: string; folder?: string; type?: AssetType } = {},
): Resource[] {
  logger.debug(
    'resourceStore',
    '[SEND] sendToResourceLibrary 进入',
    { urlPrefix: String(url).slice(0, 60), folder, name },
    { module: 'resource' },
  );
  if (!url) return [];
  let fname = '未命名';
  try {
    const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (fromUrl && !/^blob:|^data:/.test(url)) fname = fromUrl;
  } catch {}
  const resourceName = (name && String(name).trim()) || fname;
  const detectedType = type || detectAssetType({ name: fname, type: '' });
  // docs/122 #3：发送到素材库登记时带上当前 projectId（resource 逻辑引用层按项目隔离；渲染过滤见 resourcesOfProject）
  const added = addResources(
    [{ url, name: resourceName, type: detectedType, projectId: currentProjectId() || undefined }],
    folder,
  );

  // 异步后端落盘（不阻塞、失败不抛——前端 store 仍保留，只是面板稍后 rescan 可见）。
  // 修复：blob: 是本地临时对象 URL，此前被直接短路丢弃（「发送到素材库」静默不落盘）。
  // 现改为用 filesApi.uploadFileToLocal 直接把 blob 作为文件上传落盘，与 data:/http 分支一致。
  // 【名字保留】落盘文件名用用户起的 resourceName（安全化），使素材库面板读到的资源名 = 用户起的名，
  // 从素材库拖回画布时 label 即该名，@名 匹配不再丢名字（见 docs/70 问题2）。
  if (url) {
    logger.debug(
      'resourceStore',
      '[SEND] 准备落盘',
      { urlPrefix: String(url).slice(0, 60), folder, name: resourceName },
      { module: 'resource' },
    );
    persistUrlToBackend(url, folder, resourceName, detectedType);
  }
  // 广播「已发送」事件：素材库面板（resourceStore 与 ResourceLibrary 互不相通）订阅后
  // 自动切到落盘目录并重新 rescan 拉取，避免「点别处才刷新」的假象。
  emitResourceSent(folder);
  return added;
}

/** 文件名安全化：去掉非法字符/空白，返回「可作磁盘文件名的 base」，空则回退 'asset'。
 *  后缀由调用方按类型拼接，避免名字带已有扩展名造成歧义（如「猫.png」存成「猫.png.png」）。
 *  行为与 utils.safeFileName(stripExt, fallback:'asset') 逐字节一致（有单测钉住）。
 *  @param {string} [name] 用户起的名字
 *  @returns {string} 安全文件名 base */
export function safeResourceBase(name?: string): string {
  return safeFileName(name, { stripExt: true, fallback: 'asset' });
}

/** 把单个 URL 素材落盘到后端指定 folder 目录，成功后 rescan。
 *  @param {string} url
 *  @param {string} folder
 *  @param {string} [name] 用户起的名字（用于落盘文件名，保留给素材库面板/拖回画布）
 *  @param {string} [type] 素材类型（image/video/audio/text，推扩展名） */
async function persistUrlToBackend(
  url: string,
  folder: string,
  name: string,
  _type: AssetType,
): Promise<void> {
  logger.debug(
    'resourceStore',
    '[PERSIST] 开始',
    {
      kind: url.startsWith('data:') ? 'data' : url.startsWith('blob:') ? 'blob' : 'http',
      folder,
      name,
    },
    { module: 'resource' },
  );
  try {
    if (url.startsWith('data:')) {
      // 本地 base64 → multipart 上传（复用 filesApi 的 dataURL 落盘，subfolder 传 folder）。
      // data 分支用 sha1 hash 作文件名（幂等去重，filesApi 内部行为），不传自定义名；
      // 素材库面板的名字仍以 store 的 name 为准（前端已有），不依赖此文件名。
      logger.debug('resourceStore', '[PERSIST] 走 data 分支 saveInlineToLocal', null, {
        module: 'resource',
      });
      await saveInlineToLocal(url, folder);
      logger.debug('resourceStore', '[PERSIST] data 分支完成', null, { module: 'resource' });
    } else if (url.startsWith('blob:')) {
      // 修复：blob: 是本地临时对象 URL，不能通过 fileUrl 下载（new URL 报错 / 浏览器回收）。
      // 改为 fetch 取 Blob 后作为文件上传，走与链路 A 一致的上传入口，保证「发送到素材库」对任意来源都落盘。
      try {
        logger.debug('resourceStore', '[PERSIST] 走 blob 分支 fetch', url, { module: 'resource' });
        const resp = await httpRequest(url, {
          parseJson: false,
          retries: 0,
          label: 'resourceStore.persistBlob',
        });
        logger.debug(
          'resourceStore',
          '[PERSIST] blob fetch 响应',
          { ok: resp.ok, status: resp.status },
          { module: 'resource' },
        );
        const blob = await resp.blob();
        const mime = blob.type || 'image/png';
        const ext =
          EXT_BY_TYPE[detectAssetType({ name: '', type: mime })] || mime.split('/')[1] || 'png';
        const file = new File([blob], `${safeResourceBase(name)}.${ext}`, { type: mime });
        await uploadFileToLocal(file, folder, file.name);
        logger.debug('resourceStore', '[PERSIST] blob 分支 uploadFileToLocal 完成', null, {
          module: 'resource',
        });
      } catch (blobErr) {
        logger.warn('resourceStore', 'blob 转文件失败，跳过落盘', blobErr?.message);
      }
    } else {
      // http(s) 上游 url → 模仿链路 A（面板上传）：先把远程内容 fetch 成 Blob，
      // 再用 uploadFileToLocal 走 multipart（file + subfolder）落盘，
      // 不再走 JSON fileUrl 的 saveRemoteUrl 分支（避免 data:/异常态/内部地址等坑）。
      logger.debug('resourceStore', '[PERSIST] 走 http 分支 fetch', url, { module: 'resource' });
      const resp = await httpRequest(url, { parseJson: false, label: 'resourceStore.persistHttp' });
      logger.debug(
        'resourceStore',
        '[PERSIST] http fetch 响应',
        { ok: resp.ok, status: resp.status },
        { module: 'resource' },
      );
      const blob = await resp.blob();
      const mime = blob.type || 'image/png';
      const ext =
        EXT_BY_TYPE[detectAssetType({ name: '', type: mime })] || mime.split('/')[1] || 'png';
      const file = new File([blob], `${safeResourceBase(name)}.${ext}`, { type: mime });
      await uploadFileToLocal(file, folder, file.name);
      logger.debug('resourceStore', '[PERSIST] http 分支 uploadFileToLocal 完成', null, {
        module: 'resource',
      });
    }
    // 落盘后 rescan，让素材库面板（读 /api/resources）能收到新素材
    logger.debug('resourceStore', '[PERSIST] 落盘成功，准备 rescan', null, { module: 'resource' });
    await rescanResources();
    logger.debug('resourceStore', '[PERSIST] rescan 完成', null, { module: 'resource' });
  } catch (e) {
    // 落盘失败不再弹错误 toast（避免「成功」与「失败」提示矛盾、误导用户）；
    // 仅保留日志，便于后续排查实际落盘情况。
    const msg = e?.message || String(e);
    logger.error('resourceStore', '发送到素材库落盘失败', msg);
  }
}

/**
 * 剧本盒资产「真上传」通道（P0-2）：把任意来源素材图真正落盘并返回本地化 /files/ URL。
 * 区别 sendToResourceLibrary（异步尽力落盘，不返回 URL）：本函数同步 await 落盘成功后返回
 * `http://127.0.0.1:18080/files/<folder>/<name>`；失败 throw（调用方据此置 imageStatus='failed'）。
 *  - data:           → saveInlineToLocal（sha1 幂等）
 *  - blob: / http(s) → fetch 转 File 后 uploadFileToLocal
 *  - 已是 /files/     → 原样返回
 * 落盘成功后登记进素材库 store + 广播（ResourceLibrary 面板自动刷新），与 sendToResourceLibrary 一致。
 * @returns {Promise<string>} 本地化后的持久 URL
 */
export async function localizeAndStoreToResourceLibrary(
  url: string,
  { name, folder = UPLOAD_DIRS.migrated }: { name?: string; folder?: string } = {},
): Promise<string> {
  const src = String(url || '');
  if (!src) throw new Error('无素材可上传');
  let localized = null;
  if (src.startsWith('data:')) {
    localized = await saveInlineToLocal(src, folder);
  } else if (src.startsWith('blob:') || /^https?:/i.test(src)) {
    const resp = await httpRequest(src, {
      parseJson: false,
      retries: 0,
      label: 'resourceStore.localize',
    });
    const blob = await resp.blob();
    const mime = blob.type || 'image/png';
    const ext =
      EXT_BY_TYPE[detectAssetType({ name: '', type: mime })] || mime.split('/')[1] || 'png';
    const file = new File([blob], `${name || 'asset'}.${ext}`, { type: mime });
    localized = await uploadFileToLocal(file, folder);
  } else if (src.startsWith('/files/') || /^https?:\/\/127\.0\.0\.1:\d+\/files\//.test(src)) {
    localized = src; // 已是本地持久 URL
  } else {
    throw new Error('不支持的素材来源');
  }
  if (!localized) throw new Error('素材落盘失败');
  // docs/122 #3：本地化落盘登记带当前 projectId（逻辑引用层按项目隔离）
  addResources(
    [
      {
        url: localized,
        name: name || '剧本资产',
        type: 'image',
        folder,
        projectId: currentProjectId() || undefined,
      },
    ],
    folder,
  );
  emitResourceSent(folder);
  rescanResources().catch(() => {});
  return localized;
}

export function removeResource(id: string): void {
  resources = resources.filter((a) => a.id !== id);
  notify();
}

export function clearResources(): void {
  resources = [];
  notify();
}

/**
 * 从存储重读素材列表到内存（内部唯一实现：`onStorageReady` 就绪后重读 + 测试出口共用）。
 *
 * 【TD-02-8】原先导出为 `loadResources()`，但 src 零调用方（只有测试拿它当 seed 辅助）——
 * 「定义完整却没人用」的死抽象。改为模块内私有 + 就绪重读复用，公开面不再暴露无调用方 API；
 * 测试改用 `__resetForTest`（显式测试出口，仿 `projectStore.__resetForTest` 先例）。
 */
function reloadFromStorage(): Resource[] {
  resources = load();
  notify();
  return resources;
}

/**
 * 【测试出口】把模块级内存态重置为「存储中的素材列表」（等同重新 import 一份干净模块，
 * 但无 vitest 并发下的实例分裂风险——理由见 projectStore.__resetForTest 注释）。
 */
export function __resetForTest(): Resource[] {
  return reloadFromStorage();
}

// React hook：订阅素材列表
export function useResources(): Resource[] {
  const all = useSyncExternalStore(storeSubscribe, getSnapshot, getSnapshot);
  // docs/122 #7：按当前项目投影过滤（legacy 无 projectId 全项目可见；显式 projectId 仅其项目）。
  // memo 化关键：getSnapshot 返回的 `all` 只在 resources 变更时换引用、currentProjectId 只在切项目时变，
  // 投影数组仅当二者之一变化才重建 → 不破坏 useSyncExternalStore 引用相等、无重渲染循环。
  const projectId = useCurrentProjectId();
  return useMemo(() => resourcesOfProject(all, projectId), [all, projectId]);
}

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
