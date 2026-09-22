/**
 * 云同步**拉取之后**：把云端的 Skill 正文**写回磁盘**（docs/plan/140 §9.5 · D6）。
 *
 * 【为什么必须写回】磁盘是内容的唯一真相源（ADR-0056 Q2）。云端拉下来的技能只进了 `agent_skills`
 * 缓存；若设备上已经有 `skills/<分类>/<名称>/` 目录，那么下一次**重读（hydrate）**会用**磁盘**覆盖缓存
 * ⇒ 云端的更新被磁盘**永久遮蔽**（且用户看不出为什么"云同步了还是旧的"）。写回磁盘才能让三个副本
 * （磁盘 / 缓存 / 云）收敛。
 *
 * 【两条不许破的规则】
 *  ① **不覆盖未回灌的本地磁盘改动**：`protectIds` 里的技能，其磁盘内容与缓存不一致（用户在 VS Code
 *     改过但还没点「重读」）⇒ **跳过写回**并如实上报。写回等于用云端版本删掉用户刚写的东西 ——
 *     本仓红线（不静默丢用户数据）优先于"三个副本一致"。
 *  ② **写盘只有一条路**：逐个交 `saveSkillToDisk`（先落盘成功才回写缓存），本模块**不自己**碰磁盘/缓存 ——
 *     否则就成了第二个写者（ADR-0056 Q2 明禁）。
 *
 * 【为什么"已一致就跳过"】逐包比对一次（一次 `listSkillPackages`）能省掉绝大多数写盘 + 网络往返；
 * 而且**不改动缓存**就不会让台账基线漂移（避免"拉取→写回→下次上传又把同样的内容推回去"的空转）。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import { readDiskSkillPackages } from './skillApi.ts';
import { parseSkillMarkdown } from './skillManifest.ts';
import { saveSkillToDisk } from './skillPersist.ts';
import { findSkillEntryFile } from './skillEntry.ts';
import { readSkillList } from './skillRepository.ts';

export interface CloudSkillApplyResult {
  ok: boolean;
  /** 实际写回磁盘的技能数（磁盘与云端正文不一致的那些） */
  written: number;
  /** 磁盘本已一致、无需写的数量 */
  already: number;
  /** 因**本地磁盘有未回灌的改动**而跳过写回的技能名（如实上报，绝不静默覆盖） */
  protected: string[];
  /** 逐个失败原因（**不连坐**：一个失败不影响其余） */
  failed: { name: string; message: string }[];
  /** 前置失败（缓存损坏 / 技能库读不到）——此时**一个包都不写** */
  error?: string;
}

/**
 * 把缓存里的（= 刚从云端拉下来的）技能正文写回磁盘。
 * @param opts.protectIds 跳过的技能 id（本地磁盘有新改动，未回灌到缓存）
 */
export async function applyCloudSkillsToDisk(
  opts: { protectIds?: Set<string> } = {},
): Promise<CloudSkillApplyResult> {
  const protect = opts.protectIds ?? new Set<string>();
  const empty = {
    written: 0,
    already: 0,
    protected: [] as string[],
    // 显式标注：空数组字面量会被推断成 never[]，后面 push 就报错
    failed: [] as { name: string; message: string }[],
  };
  const cur = readSkillList();
  if (!cur.ok) return { ok: false, ...empty, error: cur.error };

  // 磁盘现状：id → 入口正文指纹（一次拉全，避免逐包往返）。
  // 【取数范围 = 只取入口文件】本层只比它的指纹 ⇒ 别把每包的 `references/**` 全量拉回来
  // （与漂移侦测**共用同一口径** `readDiskSkillPackages`：TD-11-39 的判据要横向铺开，TD-11-65）
  const disk = await readDiskSkillPackages();
  if (!disk.ok) return { ok: false, ...empty, error: `读取技能库失败：${disk.message}` };
  const diskHashById = new Map<string, string>();
  for (const pkg of disk.data.packages) {
    const md = findSkillEntryFile(pkg.contents);
    if (!md || md.encoding !== 'utf8') continue;
    const { manifest, body } = parseSkillMarkdown(md.content);
    const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
    if (id) diskHashById.set(id, contentFingerprint(body));
  }

  const result = { ...empty };
  for (const raw of cur.list) {
    const e = raw as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
      content?: unknown;
      category?: unknown;
      whenToUse?: unknown;
      version?: unknown;
    };
    const id = typeof e.id === 'string' ? e.id : '';
    const name = typeof e.name === 'string' ? e.name : '';
    const content = typeof e.content === 'string' ? e.content : '';
    // 形状不全的条目写不了：**如实计入 `failed`**（不静默跳过）—— 否则"云端拉回 N 条、实写 M 条"
    // 的差额在 UI 上不可见，用户以为已经全部收敛（TD-11-24）。不因此中断其余条目。
    if (!id || !name || !content) {
      result.failed.push({
        name: name || id || '(形状不全的条目)',
        message: '缺 id／name／content，未写回磁盘（可在设置页「重读 / 补齐 id」收敛）',
      });
      continue;
    }
    if (protect.has(id)) {
      result.protected.push(name);
      continue;
    }
    if (diskHashById.get(id) === contentFingerprint(content)) {
      result.already++;
      continue;
    }
    const r = await saveSkillToDisk({
      id,
      name,
      description: typeof e.description === 'string' ? e.description : '',
      content,
      // 用条目自己的分组；缺省留空 ⇒ saveSkillToDisk 落 `_未分类`（旧条目顺便被补上落点）
      category: typeof e.category === 'string' && e.category ? e.category : undefined,
      manifest: {
        whenToUse: typeof e.whenToUse === 'string' ? e.whenToUse : undefined,
        version: typeof e.version === 'string' ? e.version : undefined,
      },
    });
    if (r.ok) result.written++;
    else result.failed.push({ name, message: r.message });
  }

  if (result.failed.length) {
    logger.warn(
      'skillCloudSync',
      '云端技能写回磁盘部分失败',
      result.failed.map((f) => `${f.name}：${f.message}`).join('；'),
    );
  } else if (result.written > 0 || result.protected.length > 0) {
    logger.info('skillCloudSync', '云端技能已写回磁盘', {
      written: result.written,
      already: result.already,
      protected: result.protected.length,
    });
  }
  return { ok: result.failed.length === 0, ...result };
}
