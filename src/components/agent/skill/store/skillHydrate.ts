/**
 * 磁盘 → 缓存 的收敛（hydrate）：把技能库里的 `SKILL.md` 读成 `agent_skills` 索引。
 *
 * 【为什么需要】技能文件的真相源是磁盘（`ADR-0056` Q2），而运行时（注入 / UI 列表 / 云同步）
 * 读的是 `agent_skills` 缓存 ⇒ 两者必须能收敛。触发时机：面板手动「重读」、后续 focus 变更检测。
 *
 * 【三条不许破的规则】
 *  ① **空技能库 = 未决**：一个包都没读到（后端没起 / 用户还没放文件）时**绝不写空**，
 *     否则一次误触手就把缓存里的技能全抹了（本仓对"失败伪装成空"有红线）；
 *  ② **单包问题不许连坐**：某包读失败/形状不对 ⇒ 跳过并记入 `failures`（**未纳入**），其余照常；
 *     "已纳入但引用缺失"另记 `warnings` —— **两个字段不许并成一个**（TD-11-46：一个字段两义，
 *     消费者必然写错措辞，用户会去排查一个根本不存在的问题）；**不写空**；
 *  ③ **缺 `id` 的包不猜身份**：id 是要跨改名/换设备存的（启用态、绑定都指向它），
 *     拿目录名当身份就是路径兜底（`ADR-0056` Q3 明禁）⇒ 该包**不纳入**，但要**如实列出来**
 *     并由用户点「补齐 id」显式写回 frontmatter（见 `backfillMissingIds`）。
 *
 * 【保留旧缓存里的"磁盘上没有"的字段】`aliases`（迁移期旧 id）与 `source`（导入来源追踪）
 * 只活在缓存里 ⇒ 同 id 的旧条目要**带过来**，否则一次重读就把它们丢了。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import { generateUUID } from '@/components/base/core/idGen.ts';
import { parseSkillMarkdown, serializeSkillMarkdown } from '../rules/skillManifest.ts';
import { extractResourcePaths } from '../rules/skillResourcePath.ts';
import {
  listSkillPackages,
  readDiskSkillPackages,
  readSkillPackage,
  saveSkillPackage,
} from './skillApi.ts';
import { findSkillEntryFile } from '../rules/skillEntry.ts';
import { readSkillList, writeSkillList } from './skillRepository.ts';
import type { SkillPackageFile, UserSkill } from '../skillTypes.ts';

export interface HydrateResult {
  ok: boolean;
  /** 成功纳入缓存的包数 */
  loaded: number;
  /** 缺 frontmatter `id` 而**未纳入**的包（列出来，供「补齐 id」） */
  missingId: { category: string; slug: string }[];
  /** 单个包的失败原因（不阻断其余包，但必须可见） */
  /**
   * 单个包**未纳入**（读不到 `SKILL.md` / 形状不对）—— 它不是"已生效但有毛病"，是**没进去**。
   * 消费者必须按"未纳入"措辞上报（TD-11-46：此前把"已纳入但引用缺失"也塞进这里，
   * 于是三处全按"未纳入"说 ⇒ 谎报：用户以为技能没进来，实际只是某个 `references/*.md` 不在包里）。
   */
  failures: string[];
  /**
   * 已纳入、但**有毛病要提醒**（正文引用了包里不存在的资料）。与 `failures` **分字段**：
   * 一个字段承担两义 = 消费者必然写错措辞（同 TD-11-23 的折叠病）。
   */
  warnings: string[];
  /** 缓存是否真的被改写（内容一致 ⇒ false，不做无意义写入） */
  changed: boolean;
  /**
   * **未决**：磁盘**没给出可写入的结论**（空库 / 有包但一个都不可纳入 / 读盘或写缓存失败）
   * ⇒ 缓存**保持原样**。
   * 【为什么必须显式表达】少了它，`changed:false` 会被 UI 读成"磁盘内容与缓存一致"——
   * 于是"磁盘是空的"被谎报成"两边一样"（TD-11-18）：用户以为技能还在磁盘上，实际已经被删，
   * 点保存还会经 `skillPersist` 的"磁盘上没这个包 ⇒ 按新建处理"把已删技能**重建回磁盘**。
   */
  undecided: boolean;
  error?: string;
}

/** 旧缓存条目的可继承字段（磁盘上没有、只活在缓存里） */
interface CarryOver {
  id?: unknown;
  aliases?: unknown;
  source?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** 比对签名：只取"hydrate 决定得了的字段"，避免旧条目多几个字段就被判成"变了"而无谓写盘 */
function signatureOf(s: {
  id?: unknown;
  contentHash?: unknown;
  name?: unknown;
  category?: unknown;
  slug?: unknown;
}): string {
  return [s.id, s.contentHash, s.name, s.category, s.slug].map((v) => String(v ?? '')).join('|');
}

/**
 * 从磁盘重读技能库，写入 `agent_skills` 缓存。
 * @returns 结果（`failures` = 未纳入的包；`warnings` = 已纳入但引用缺失；**不抛**）
 */
export async function reloadSkillsFromDisk(): Promise<HydrateResult> {
  const r = await listSkillPackages({ withContent: true });
  if (!r.ok) {
    // 连磁盘都没读到 ⇒ 当然未决（带 `error`：调用方报的是"读不到"，不是"你没有技能"）
    return {
      ok: false,
      loaded: 0,
      missingId: [],
      failures: [],
      warnings: [],
      changed: false,
      undecided: true,
      error: r.message,
    };
  }
  const lib = r.data;
  // 规则①：一个包都没有 ⇒ 未决，不写空（保留缓存现状）
  if (lib.packages.length === 0) {
    logger.debug('skillHydrate', '技能库为空，按「未决」处理：不写缓存', { root: lib.root });
    return {
      ok: true,
      loaded: 0,
      missingId: [],
      failures: [],
      warnings: [],
      changed: false,
      undecided: true,
    };
  }

  const prev = readSkillList();
  const carryById = new Map<string, CarryOver>();
  for (const item of prev.list) {
    const e = item as CarryOver;
    if (typeof e?.id === 'string' && e.id) carryById.set(e.id, e);
  }

  const next: UserSkill[] = [];
  const missingId: { category: string; slug: string }[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const pkg of lib.packages) {
    const target = `${pkg.category}/${pkg.slug}`;
    const md = findSkillEntryFile(pkg.contents);
    if (!md || md.encoding !== 'utf8') {
      // 规则②：单包问题只跳过它自己（可能被外部工具写成了二进制/读取失败）
      failures.push(`${target}：读不到 SKILL.md 文本（已跳过，未写空）`);
      continue;
    }
    const { manifest, body } = parseSkillMarkdown(md.content);
    const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
    if (!id) {
      // 规则③：不猜身份
      missingId.push({ category: pkg.category, slug: pkg.slug });
      continue;
    }
    // 【装载期对账（方案 §7 承诺）】正文引用的资料 vs **包内实有** —— 差集在这里就暴露，
    // 而不是等模型运行期调 `skill_read_file` 时才失败（那时用户已经等了一轮回复）。
    // 只比 `contents`（后端 content 范围 = `SKILL.md` + `references/**`，**不含 `scripts/**`**）——
    // 与"可读资料集合"同一口径，故不会把 scripts 的引用误报成缺失。
    const presentFiles = new Set((pkg.contents || []).map((f) => f.relPath));
    const missingRefs = extractResourcePaths(body).filter((p) => !presentFiles.has(p));
    if (missingRefs.length) {
      warnings.push(
        `${target}：正文引用了 ${missingRefs.join('、')}，但包里没有这些文件（模型读到时会失败）`,
      );
    }

    const carry = carryById.get(id);
    next.push({
      kind: 'user',
      id,
      category: pkg.category,
      slug: pkg.slug,
      name: manifest.name || pkg.slug,
      description: manifest.description || '',
      version: manifest.version,
      content: body, // 只存正文：frontmatter 是声明，不进注入上下文
      contentHash: contentFingerprint(body),
      aliases: Array.isArray(carry?.aliases) ? (carry.aliases as string[]) : undefined,
      source: carry?.source as UserSkill['source'],
      createdAt: typeof carry?.createdAt === 'number' ? carry.createdAt : undefined,
      updatedAt: typeof carry?.updatedAt === 'number' ? carry.updatedAt : undefined,
    });
  }

  // 变化判定（按 id 排序后逐条签名比对；顺序不同不算变）
  const sig = (list: unknown[]) =>
    list
      .map((s) => signatureOf(s as { id?: unknown }))
      .sort()
      .join('\n');
  // 【关键闸门】`next` 为空 ⇒ **绝不写**（与"空技能库=未决"同源）：
  // 磁盘上有目录、但一个包都不可纳入（全缺 id / 全读失败）时，写空 = 把缓存里的技能全抹掉。
  // 代价：从磁盘直接删包**不会**通过 hydrate 反映到缓存（删除必须走 UI 的删包动作，它同时更新缓存）。
  const changed = next.length > 0 && sig(next) !== sig(prev.list);
  // 【未决】磁盘上有目录、但一个包都不可纳入（全缺 id / 全读失败）⇒ 缓存保持原样，
  // 这不是"磁盘与缓存一致"，而是"磁盘没给出可写入的结论"（见 HydrateResult.undecided）。
  const undecided = next.length === 0;

  if (changed) {
    const w = writeSkillList(next);
    if (!w.ok) {
      // 写缓存失败：**不隐瞒**，也不假装 hydrate 成功
      return {
        ok: false,
        loaded: 0,
        missingId,
        failures,
        warnings,
        changed: false,
        undecided: true,
        error: w.error || '写入 Skill 缓存失败',
      };
    }
  }
  if (failures.length) logger.warn('skillHydrate', '部分技能包未纳入', failures.join('；'));
  if (warnings.length) {
    logger.warn('skillHydrate', '部分技能包引用的资料缺失（包已纳入）', warnings.join('；'));
  }
  return { ok: true, loaded: next.length, missingId, failures, warnings, changed, undecided };
}

/**
 * 给「缺 frontmatter `id`」的包补齐 id（**显式动作，不在 hydrate 里偷偷写盘**）。
 *
 * 【为什么必须写回磁盘】id 要跨改名/换设备存活；只在内存里发一个 UUID，重启就变 ⇒ 启用态与绑定全断。
 * 【为什么必须读整包再写】包写是**整包原子写**（覆盖语义）⇒ 只用 content 范围（不含 `scripts/`）回写会把脚本删掉。
 *   故这里逐包 `scope=package` 读全量（含 `scripts/**`）再原样回写，只改 `SKILL.md` 的 frontmatter。
 */
export async function backfillMissingIds(): Promise<{
  ok: boolean;
  patched: string[];
  failed: { target: string; message: string }[];
  error?: string;
}> {
  const list = await listSkillPackages({ withContent: true });
  if (!list.ok) return { ok: false, patched: [], failed: [], error: list.message };

  const patched: string[] = [];
  const failed: { target: string; message: string }[] = [];

  for (const pkg of list.data.packages) {
    const target = `${pkg.category}/${pkg.slug}`;
    const md = findSkillEntryFile(pkg.contents);
    if (!md || md.encoding !== 'utf8') continue;
    const { manifest } = parseSkillMarkdown(md.content);
    if (typeof manifest.id === 'string' && manifest.id.trim()) continue; // 已有 id，不动

    const full = await readSkillPackage(pkg.category, pkg.slug, 'package');
    if (!full.ok) {
      failed.push({ target, message: full.message });
      continue;
    }
    const files: SkillPackageFile[] = full.data.files.map((f) => ({ ...f }));
    const targetFile = findSkillEntryFile(files);
    if (!targetFile || targetFile.encoding !== 'utf8') {
      failed.push({ target, message: '整包里找不到可写的 SKILL.md 文本' });
      continue;
    }
    const re = parseSkillMarkdown(targetFile.content);
    targetFile.content = serializeSkillMarkdown({ ...re.manifest, id: generateUUID() }, re.body);
    const w = await saveSkillPackage(pkg.category, pkg.slug, files);
    if (w.ok) patched.push(target);
    else failed.push({ target, message: w.message });
  }
  return { ok: failed.length === 0, patched, failed };
}

export interface DriftResult {
  ok: boolean;
  /** 磁盘正文指纹与缓存不一致的条目（用**缓存里的名字**回报，便于用户对上号） */
  changed: { id: string; name: string }[];
  error?: string;
}

/**
 * 侦测「磁盘上的 `SKILL.md` 被外部改了」（**只读，绝不写**）—— 与 `reloadSkillsFromDisk` 同一把尺子
 * （`contentHash`），区别只在写与不写：本函数只回答"变了没"，由 UI 决定是否提示、用户决定是否重读。
 *
 * 【为什么不能自动改】"改了文件就自动覆盖缓存"会把一次误触手（编辑器保存了个半截文件）直接变成
 * 事实；且 hydrate 的写门槛（不写空/不猜身份）在这里同样成立。故**只提示、不擅动**。
 *
 * 【缓存为空 ⇒ 无基线】此时不是"没漂移"，而是"无从判断"——归零返回（迁移/hydrate 负责建立基线）。
 * 【缺 frontmatter id 的包不报】它压根没进缓存（更没基线），由面板的「重读 / 补齐 id」管。
 */
export async function detectSkillDrift(): Promise<DriftResult> {
  const prev = readSkillList();
  if (!prev.ok) return { ok: false, changed: [], error: prev.error };
  const baseline = new Map<string, { name?: unknown; contentHash?: unknown }>();
  for (const item of prev.list) {
    const e = item as { id?: unknown; name?: unknown; contentHash?: unknown };
    if (typeof e?.id === 'string' && e.id) baseline.set(e.id, e);
  }
  if (baseline.size === 0) return { ok: true, changed: [] };

  // 只取入口文件：本函数只比 `SKILL.md` 正文的指纹 ⇒ 不必把 `references/**` 全量拉回来（TD-11-39）。
  // 口径收在 `readDiskSkillPackages`（"只取入口文件"只在一处定义，取用面共用它 —— TD-11-55）
  const r = await readDiskSkillPackages();
  // 后端失败**不得**当作"无漂移"（那会把"读不到"伪装成"一切都好"）：如实 ok:false
  if (!r.ok) return { ok: false, changed: [], error: r.message };

  const changed: { id: string; name: string }[] = [];
  for (const pkg of r.data.packages) {
    const md = findSkillEntryFile(pkg.contents);
    if (!md || md.encoding !== 'utf8') continue;
    const { manifest, body } = parseSkillMarkdown(md.content);
    const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
    const before = id ? baseline.get(id) : undefined;
    if (!before) continue;
    if (contentFingerprint(body) !== before.contentHash) {
      changed.push({
        id,
        name: typeof before.name === 'string' && before.name ? before.name : pkg.slug,
      });
    }
  }
  return { ok: true, changed };
}
