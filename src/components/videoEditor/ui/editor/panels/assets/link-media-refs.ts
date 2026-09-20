/**
 * 把一批 `MediaRef` 登记为「当前剪辑工程的素材」（**唯一入口**）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【语义：登记引用，不复制、不上传】（docs/136 §9.2 裁决 · 用户 2026-09-17 确认走"路线 A"）
 * 来自「画布 / 素材库 / 生成」的素材，其**二进制已在 localTool `/files/`**，
 * 这里只做两件事：
 *   ① 取 `File`（`fetch(ref.url)` → blob → `new File`）——**仅为满足 `MediaAsset.file: File` 类型**，
 *      **不上传、不落盘**（`saveMediaAsset` 见 `persistentUrl` 即跳过上传，见其"引用分支"）；
 *   ② 在**当前剪辑工程**里登记一条指向它的元数据（经既有 `editor.media.addMediaAsset`）。
 *
 * 【为什么"取 File"是路线 A 的已知代价】`MediaAsset.file` 是必填（`types/mediaAssets.ts:34`），
 * 而 `MediaRef` 只有 URL。`fetch` 会让**选中文件全量进内存**（大视频有压力）。
 * 本轮按 `docs/136` P1-1 短期方案加**大小上限**兜底；长期若要改 `MediaAsset.file` 为惰性取
 * （路线 B）需实测证明痛点后再动公共类型（不预先为假设付成本）。
 * 先例：`service.ts::loadMediaAsset` 已用同款 `fetch → blob → new File`（本仓既有做法）。
 *
 * 【为什么住在剪辑器而不是 `base/media/`】它依赖 `editor.media`（引擎）→ 属**业务适配**。
 * 放进 `base/media/` 会让地基反向依赖 `videoEditor`（违反 check:arch 规则 2）。
 * **地基只回答"有什么"，不回答"怎么用"。**
 * ════════════════════════════════════════════════════════════════
 */
import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
// 落地判据（唯一实现）住在 ref 契约层：画布入口消费同一份，**禁止在此另写一份判据**。
import { mediaRefFactsOf } from '@/components/base/media/mediaRefTypes.ts';
import type { MediaRef, MediaRefFacts } from '@/components/base/media/mediaRefTypes.ts';
import { fileNameFromUrl, formatBytes } from '@/components/base/core/utils.ts';

/** 单个素材大小上限（路线 A 的内存兜底 · docs/136 P1-1 短期方案）。 */
export const LINK_MAX_BYTES = 100 * 1024 * 1024; // 100MB

export type LinkMediaRefsOutcome =
  | {
      ok: true;
      linked: MediaAsset[];
      /** 已存在（按双轨去重命中），无需重复登记 */
      skipped: MediaRef[];
    }
  | {
      ok: false;
      /** 部分成功不丢 */
      linked: MediaAsset[];
      failures: Array<{ ref: string; message: string }>;
    };

/** 归一化 URL 作去重判据：去掉 `API_BASE` 前缀与 query/hash，只留 `/files/...`。
 *  【为什么必须归一化】画布侧可能是 `http://127.0.0.1:18080/files/a.png`，
 *  素材库侧是 `/files/a.png` —— 不归一化就是两个字符串，去重失效（docs/136 P0-3）。 */
export function normalizeFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  // 去 query / hash
  u = u.split('?')[0].split('#')[0];
  // 去协议+主机（只保留 path）
  u = u.replace(/^https?:\/\/[^/]+/i, '');
  // 相对路径统一以 / 开头
  if (!u.startsWith('/')) u = `/${u}`;
  return u;
}

/**
 * 双轨去重：`contentId` 两者都有时按它；否则按归一化 `url`（docs/136 §9.3 设计点 3 / P0-3）。
 * 【为什么不能只按 contentId】`contentId` 缺失是常态（画布图往往没有）→ 只按它会静默重复登记。
 */
/**
 * 双轨去重：`contentId` 命中 或 归一化 `url` 命中即视为已存在（docs/136 §9.3 / P0-3）。
 * 【为什么不能只按 contentId】它缺失是常态（画布图往往没有）→ 只按它会静默重复登记。
 * 【为什么只按 url 也需要 contentId 轨】同一文件的 url 可能因改名/移动而变，
 * 而 contentId（`sha1:<hex>`）是稳定身份 → 两轨互补。
 */
function findDuplicate(ref: MediaRefFacts, existing: MediaAsset[]): MediaAsset | undefined {
  const refContentId = ref.contentId;
  const refUrl = normalizeFileUrl(ref.url);
  return existing.find((a) => {
    // 轨 1：contentId（`contentId` 挂在 asset 的可选扩展字段上）
    if (refContentId && a.contentId === refContentId) return true;
    // 轨 2：归一化 url
    if (!refUrl) return false;
    const aUrl = normalizeFileUrl(a.persistentUrl || a.url);
    return !!aUrl && aUrl === refUrl;
  });
}

/** 取 File（仅为满足类型；不上传）。超限抛错，由调用方计入 failures。 */
async function fetchAsFile(ref: MediaRefFacts): Promise<File> {
  const res = await fetch(ref.url);
  if (!res.ok) {
    throw new Error(`取素材失败（HTTP ${res.status}）`);
  }
  const blob = await res.blob();
  if (blob.size > LINK_MAX_BYTES) {
    throw new Error(`素材超过 ${formatBytes(LINK_MAX_BYTES)} 上限（${formatBytes(blob.size)}）`);
  }
  const name = ref.name || fileNameFromUrl(ref.url) || 'media';
  return new File([blob], name, { type: blob.type || undefined });
}

/**
 * 登记一批引用为当前工程素材。
 *
 * 依赖注入 `editor.media`（引擎）而非 import —— 保持本模块可测、且不把引擎耦合进签名。
 */
export async function linkMediaRefsToProject({
  items,
  projectId,
  media,
}: {
  items: MediaRef[];
  projectId: string;
  /** 引擎媒体管理器（`useEditor().media`）；注入以解耦。 */
  media: {
    getAssets: () => MediaAsset[];
    addMediaAsset: (args: {
      projectId: string;
      asset: Omit<MediaAsset, 'id'>;
    }) => Promise<{ ok: true; id: string; asset: MediaAsset } | { ok: false; message?: string }>;
  };
}): Promise<LinkMediaRefsOutcome> {
  const linked: MediaAsset[] = [];
  const skipped: MediaRef[] = [];
  const failures: Array<{ ref: string; message: string }> = [];

  // 落地判据 = 唯一实现（`mediaRefTypes.mediaRefFactsOf`）：契约违约（无可渲染地址）**在根部抛出**，
  // 由调用方原样转发（fail-fast）。该函数已删 `{ok,failures}` 信封（见其文件头：那分支运行期不可达
  // ＝ 幽灵逻辑，且把"记得转发"推给每个消费端）⇒ 此处不再就地重判、不再自己拼失败项。
  const facts = mediaRefFactsOf(items);

  // 去重基线 = 现有工程素材（每次循环后追加已登记的，避免同批内重复）
  const seen = [...media.getAssets()];

  // 逐条配对（判据是 items 的逐条映射：同长同序）：**落盘字段取契约事实**，失败身份取 `ref.ref`。
  for (let i = 0; i < facts.length; i++) {
    const ref = items[i];
    const fact = facts[i];
    // 双轨去重：已存在 → 跳过（不重复登记）
    const dup = findDuplicate(fact, seen);
    if (dup) {
      skipped.push(ref);
      continue;
    }

    try {
      const file = await fetchAsFile(fact);
      // 【关键】传 `persistentUrl: fact.url` ⇒ saveMediaAsset 走**引用分支**（跳过上传）。
      const asset: Omit<MediaAsset, 'id'> = {
        name: fact.name || file.name,
        type: fact.type,
        file,
        persistentUrl: fact.url,
        contentId: fact.contentId,
      };

      const outcome = await media.addMediaAsset({ projectId, asset });
      if (outcome.ok) {
        linked.push(outcome.asset);
        seen.push(outcome.asset);
      } else {
        failures.push({ ref: ref.ref, message: outcome.message || '登记失败' });
      }
    } catch (e) {
      failures.push({ ref: ref.ref, message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (failures.length === 0) {
    return { ok: true, linked, skipped };
  }
  // 部分成功：已登记的照常在工程里可见，失败的如实上报（不静默吞）。
  // 【只留痕给开发者】用户可见文案由**宿主**（它才知道该说什么、且是弹窗的消费方）决定 ——
  // 生产者不替消费者显示，避免同一失败在两处各说一句。
  videoEditorLogger.warn('视频剪辑器', '部分引用登记失败', { failures });
  return { ok: false, linked, failures };
}
