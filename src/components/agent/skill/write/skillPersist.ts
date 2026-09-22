/**
 * 写路径：**先落盘成功，才回写缓存**（fail-loud）。
 *
 * 【为什么这个顺序不可换】`ADR-0056` Q2：磁盘是内容真相源。"先写缓存、再异步落盘"会在落盘失败时
 * 留下「缓存里有、磁盘没有」的灰色状态 —— 用户以为改了，重启后变回去（121 前的护栏已被明确删掉）。
 * 本模块把顺序钉死：**磁盘没写成功 ⇒ 缓存一个字都不改**，并把失败原样交回 UI 显示「未保存」。
 *
 * 【覆盖语义提醒】技能包写是**整包原子写**（提交的集合即最终状态）⇒ 改 `SKILL.md` 前必须先把整包
 * （含 `references/**`、`scripts/**`）读回来，**只替换 `SKILL.md`** 再原样写回，否则会把附带文件删掉。
 *
 * 【"磁盘上没有"不是失败】旧条目可能只活在缓存里（从没落过盘）⇒ 删除时 `404` 表示"本来就没有"，
 * 此时清缓存是正确动作，不该报错（否则用户永远删不掉它）。判据用 `notFound`，不猜 message 文案。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import { generateUUID } from '@/components/base/core/idGen.ts';
import {
  emptyManifest,
  parseSkillMarkdown,
  serializeSkillMarkdown,
} from '../rules/skillManifest.ts';
import { isLegalDirSegment, slugifySkillName, uniqueSlugIn } from '../rules/skillDirName.ts';
import { UNSORTED_GROUP } from '../rules/skillGroup.ts';
import {
  deleteSkillPackage,
  listSkillPackages,
  readSkillPackage,
  saveSkillPackage,
} from '../store/skillApi.ts';
import { SKILL_ENTRY_FILE, findSkillEntryFile } from '../rules/skillEntry.ts';
import { readSkillList, writeSkillList } from '../store/skillRepository.ts';
import type {
  SkillApiResult,
  SkillLibrary,
  SkillManifest,
  SkillPackageFile,
  UserSkill,
} from '../skillTypes.ts';

export interface SaveSkillInput {
  /** 既有条目的 id（新建时留空） */
  id?: string;
  name: string;
  description: string;
  /** 正文（不含 frontmatter；由本模块负责拼装 frontmatter） */
  content: string;
  /**
   * 目标分组（= 技能库一级目录）。
   *  - 新建：缺省落 `_未分类`；给了名字就落到那个组（目录由整包写**顺带创建**，故"新建分组"
   *    不需要单独的建目录动作 —— 建技能到新组 = 造出这个组）。
   *  - 改既有条目：给出的名字**与现值不同** ⇒ 视为**移动分组**（新位置写成功后才删旧包）。
   * 名字经 `slugifySkillName` 安全化（禁 `/` `\` `:` 等路径敌意字符）。
   */
  category?: string;
  /**
   * **希望落到的目录名**（只有"恢复"这类动作会给）：
   * 索引里记的原目录名，恢复时要落回**原路径**，不能因为"索引里还有这一条"而被让位成 `-2`
   * （占用集合会排除正在被重写的这一条自己，见 `uniqueSlugOnDisk`）。
   * 不给 ⇒ 由 `name` 经 `slugifySkillName` 安全化后取名（新建的常规路径）。
   * 给的值**原样使用**：它是磁盘上曾经存在的目录名（可能与安全化结果不同），改名/换组那一套口径不适用于"恢复原位"。
   */
  slug?: string;
  /** 额外要保留的 frontmatter 字段（导入时原样带过：version / unknown（含已退役的 when-to-use 等声明）…） */
  manifest?: Partial<SkillManifest>;
  /**
   * **整包导入**语义：调用方给的是完整文件集合（含 `references/**`）⇒ 它就是最终状态（覆盖写）。
   * - 不给（默认）＝「改这一份」：先读旧包，只替换 `SKILL.md`，附带文件原样保留；
   * - 给了 ＝「导入一整个包」：提交集合即最终状态（`SKILL.md` 仍由本模块重建，保证 frontmatter 由我们写）。
   * 两种语义必须**显式区分**，不能靠"磁盘上有没有旧文件"去猜 —— 猜的结果是"导入把旧 references 删了"
   * 或"更新把别人的 references 并进来了"，两种都不可预测。
   */
  packageFiles?: SkillPackageFile[];
  /**
   * **界面渲染这一行时看到的正文指纹**（`contentHash`）。
   * 给了它才做冲突检测：磁盘当前正文与它不同 ⇒ 说明**有人在别处改过这一版**（VS Code / 另一次会话）
   * ⇒ 返回 `conflict`，由界面问用户「覆盖 / 放弃并加载磁盘版」。
   * 【为什么界面直接编辑磁盘必须有这一条】界面保存 = 直接写那个文件，而人也在改同一个文件 ——
   * 两个写者真实存在。少了它，"保存"就变成"谁后保存谁赢"，用户的外改会被静默吞掉。
   * **不给 = 不检测**：新建 / 导入 / 云写回不在"编辑某一版"的语境里。
   */
  baselineHash?: string;
  /** 用户已确认覆盖（冲突提示里选了"用我的覆盖"） */
  allowOverwrite?: boolean;
}

export type SaveSkillResult =
  | { ok: true; skill: UserSkill }
  /** `diskWritten: true` = 磁盘已改但缓存没跟上（可用「重读」收敛；**不谎报成功**） */
  | { ok: false; message: string; diskWritten?: boolean }
  /**
   * **冲突**：磁盘上这一版被外部改过 ⇒ 一个字都没写。带上磁盘当前正文，界面可让用户
   * "放弃我的改动、加载磁盘版"（不带上它就只能让用户自己去文件夹里看，是半成品）。
   */
  | { ok: false; conflict: true; message: string; diskContent: string };

/**
 * 在某分类下取一个磁盘与缓存都不撞的目录名（`lib` = 已取回的磁盘清单：**同一事实只读一次**）。
 * @param excludeId 正在被重写的条目 id —— **它自己不算占用**：恢复原位时，索引里还留着的那一条
 *   正是我们要写回去的，若把它算作占用就会平白让位成 `<名字>-2`（落不回原路径）。
 */
async function uniqueSlugOnDisk(
  category: string,
  base: string,
  lib: SkillApiResult<SkillLibrary>,
  excludeId = '',
): Promise<string> {
  const used = new Set<string>();
  for (const item of readSkillList().list) {
    const e = item as { id?: unknown; category?: unknown; slug?: unknown };
    if (excludeId && e.id === excludeId) continue;
    if (e.category === category && typeof e.slug === 'string' && e.slug) used.add(e.slug);
  }
  if (lib.ok) {
    for (const p of lib.data.packages) if (p.category === category) used.add(p.slug);
  }
  return uniqueSlugIn(base, used); // 注意：uniqueSlugIn 会把结果记入集合，此处集合已用完即可
}

/**
 * 目标分组名的解析：**磁盘上已有的组名一律原样使用，只有新名字才经 `slugifySkillName`**。
 *
 * 【为什么不能无脑 slugify（TD-11-25）】组名的真相源是**磁盘目录**。若把一个已存在的组名再"安全化"，
 * 就等于**给一个真实存在的目录改名**：输入 `客户*项目`（Finder 建得出，本页「新建分组」也造得出——
 * 那个入口走的是后端 `isSafeSegment`，它允许 `*`）会被改成 `客户 项目` ⇒ 技能落到**另一个目录**，
 * 用户看到的是"明明有这个分组，技能却进了别处"，且磁盘上悄悄多出一个组。
 * 【不存在的名字才安全化】新造名字要避免"后端会拒的名字直接甩给用户"（那会把可预防的失败变成难懂的报错）。
 * 【读不到磁盘怎么办】退回"一律安全化"：写盘本来就要后端在，它没起时 `saveSkillPackage` 会带着真实原因
 * 失败 —— 不在这里编一个假结论。
 */
function resolveGroupName(raw: string, lib: SkillApiResult<SkillLibrary>): string {
  if (raw === UNSORTED_GROUP) return raw;
  if (lib.ok && (lib.data.groups || []).includes(raw)) return raw; // 已存在：原样（不许改名）
  return slugifySkillName(raw);
}

async function currentEntries(): Promise<Partial<UserSkill>[] | { error: string }> {
  const cache = readSkillList();
  if (!cache.ok) return { error: cache.error };
  return cache.list as Partial<UserSkill>[];
}

/**
 * 保存一个 Skill（新建或更新）：**磁盘优先**。
 * @returns `ok:true` 表示磁盘与缓存都已更新；失败带可展示 `message`
 */
export async function saveSkillToDisk(input: SaveSkillInput): Promise<SaveSkillResult> {
  const entriesOrErr = await currentEntries();
  if (!Array.isArray(entriesOrErr)) return { ok: false, message: entriesOrErr.error };
  const entries = entriesOrErr;
  // 磁盘真值（组清单 + 包清单）**只取一次**：组名解析（`resolveGroupName`）与"不撞的目录名"
  // （`uniqueSlugOnDisk`）都要用它 —— 读两次等于读两遍同一事实（还会多一次 N+1 请求）。
  const lib = await listSkillPackages({ withContent: false });

  const name = input.name.trim();
  const description = input.description;
  const exist = input.id ? entries.find((e) => e.id === input.id) : undefined;
  const id = typeof exist?.id === 'string' && exist.id ? exist.id : generateUUID();
  /**
   * 分组意图**三态**（不可折叠）：
   *  · `null`（调用方没提分组，如导入 / 云写回）⇒ **不改组**；
   *  · 空白串 ⇒ **显式要求未分组**（用户在编辑框里清空了「分组」）⇒ 移回 `_未分类`；
   *  · 有名 ⇒ 落到该组。
   * 【为什么必须区分后两者】旧实现把二者折叠成一个值 ⇒ "清空分组框"变成"什么都不做"，
   * 与同页 placeholder「留空 = 未分组」直接矛盾（TD-11-23）。
   */
  const categoryInput = typeof input.category === 'string' ? input.category.trim() : null;
  const wantGroup =
    categoryInput === null
      ? ''
      : categoryInput
        ? resolveGroupName(categoryInput, lib)
        : UNSORTED_GROUP;

  // 【第二入口的围栏（TD-11-53）】`input.slug` 绕过了 `slugifySkillName`（"恢复原位"必须如此），
  // 但它必须过合法性判据：非法落点要在**这里**被拦住，而不是等后端 400（那时错误已离成因很远）。
  if (input.slug !== undefined && !isLegalDirSegment(input.slug)) {
    return { ok: false, message: `落点目录名非法：${JSON.stringify(input.slug)}` };
  }

  let category =
    typeof exist?.category === 'string' && exist.category ? exist.category : UNSORTED_GROUP;
  let slug = typeof exist?.slug === 'string' && exist.slug ? exist.slug : '';
  let files: SkillPackageFile[] = [];
  /** 移动分组时记住旧落点（新位置写成功后才删它，顺序不可换） */
  let oldLoc: { category: string; slug: string } | null = null;
  /**
   * 磁盘上原有的 frontmatter 声明。**更新时必须带过**：`SKILL.md` 是整文件重建的，
   * 若不带上，用户/外部包写在里面的字段（尤其 `x-*` 未知字段）会被一次"保存"静默抹掉。
   */
  let diskManifest: Partial<SkillManifest> | null = null;

  if (slug) {
    // 改既有包：先读整包（含 scripts），下面只替换 SKILL.md
    const full = await readSkillPackage(category, slug, 'package');
    if (full.ok) {
      files = full.data.files.map((f) => ({ ...f }));
      const md = findSkillEntryFile(files);
      if (md && md.encoding === 'utf8') {
        const parsed = parseSkillMarkdown(md.content);
        diskManifest = parsed.manifest;
        // 【冲突检测】磁盘当前正文 ≠ 界面渲染时的那一版 ⇒ 有人（人或另一次会话）在别处改过。
        // 不静默覆盖：一个字都不写，把磁盘版正文回传给界面让用户选。
        if (
          input.baselineHash &&
          !input.allowOverwrite &&
          contentFingerprint(parsed.body) !== input.baselineHash
        ) {
          return {
            ok: false,
            conflict: true,
            message: `磁盘上的「${name}」已被外部改动（不是你在界面上看到的这一版）`,
            diskContent: parsed.body,
          };
        }
      }
    } else {
      // 磁盘上没有这个包（旧条目从没落过盘）⇒ 退化为新建，不让用户卡住
      logger.warn('skillPersist', '既有条目在磁盘上不存在，按新建处理', `${category}/${slug}`);
      slug = '';
      files = [];
    }
  }
  // 整包导入：提交集合即最终状态（覆盖语义）。放在读旧包之后、写盘之前 —— 它就是"最终 files"。
  if (input.packageFiles) {
    files = input.packageFiles.filter((f) => f.relPath !== SKILL_ENTRY_FILE).map((f) => ({ ...f }));
  }
  // 调用方**没提**分组时保持既有分组；提了（含"要求未分组"）就按它
  const targetCategory = categoryInput !== null ? wantGroup : category || UNSORTED_GROUP;
  if (!slug) {
    category = targetCategory;
    // 给了 `slug`（恢复原位）就原样用它；否则由 name 安全化取名
    slug = await uniqueSlugOnDisk(
      category,
      input.slug ? input.slug : slugifySkillName(name),
      lib,
      id,
    );
  } else if (targetCategory !== category) {
    // 移动分组：目标组里若已有同名目录则让位（`-2`），再改指向 —— 目录名不是身份（id 才是）
    oldLoc = { category, slug };
    slug = await uniqueSlugOnDisk(targetCategory, slug, lib, id);
    category = targetCategory;
  }

  // 合并次序 = 「磁盘原有的」（最弱）→ 「调用方显式给的」→ 「本次事实（id/name/description）」（最强）；
  // `unknown` 单独**并集**（未知字段是"额外带上"的语义，不是覆盖关系）。
  const manifest = emptyManifest({
    ...(diskManifest ?? {}),
    ...(input.manifest ?? {}),
    id,
    name,
    description,
    unknown: { ...(diskManifest?.unknown ?? {}), ...(input.manifest?.unknown ?? {}) },
  });
  const nextMd = serializeSkillMarkdown(manifest, input.content);
  const mdFile = findSkillEntryFile(files);
  if (mdFile) mdFile.content = nextMd;
  else files = [{ relPath: SKILL_ENTRY_FILE, encoding: 'utf8', content: nextMd }, ...files];

  const w = await saveSkillPackage(category, slug, files);
  if (!w.ok) return { ok: false, message: `落盘失败：${w.message}` }; // 缓存一个字都不改
  // 移动：**新位置写成功之后**才删旧包。反过来的话，写新失败即等于"先删了旧技能还没写新的"。
  if (oldLoc) {
    const d = await deleteSkillPackage(oldLoc.category, oldLoc.slug);
    if (!d.ok && !d.notFound) {
      // 半程态如实上报：新位置已生效，旧包仍在 → 用户会看到两份，别让他以为一切正常
      return {
        ok: false,
        message: `已写入分组「${category}」，但旧分组「${oldLoc.category}」里的包没删掉：${d.message}（磁盘上会同时存在两份，可手动删旧的）`,
        diskWritten: true,
      };
    }
  }

  const skill: UserSkill = {
    kind: 'user',
    id,
    category,
    slug,
    name,
    description,
    version: typeof exist?.version === 'string' ? exist.version : undefined,
    content: input.content,
    contentHash: contentFingerprint(input.content),
    aliases: Array.isArray(exist?.aliases) ? exist.aliases : undefined,
    source: exist?.source,
    createdAt: exist?.createdAt,
    updatedAt: Date.now(),
  };
  // 内容字段以本次 manifest 为准（导入时可能带来 version）
  if (manifest.version !== undefined) skill.version = manifest.version;

  const nextList = exist ? entries.map((e) => (e.id === id ? skill : e)) : [...entries, skill];
  const cw = writeSkillList(nextList);
  if (!cw.ok) {
    return {
      ok: false,
      message: `已写盘，但缓存回写失败：${cw.error || '未知原因'}（可点「重读」收敛）`,
      diskWritten: true,
    };
  }
  return { ok: true, skill };
}

/**
 * 删除一个 Skill：**先删磁盘包，成功后才动缓存**。
 * @returns `cacheOnly:true` = 磁盘上本来就没有（旧条目），只清了缓存
 */
export async function deleteSkillEverywhere(
  id: string,
): Promise<{ ok: boolean; message?: string; cacheOnly?: boolean }> {
  const entriesOrErr = await currentEntries();
  if (!Array.isArray(entriesOrErr)) return { ok: false, message: entriesOrErr.error };
  const entries = entriesOrErr;

  const exist = entries.find((e) => e.id === id);
  if (!exist) return { ok: false, message: '缓存里找不到这个 Skill（可能已被删除）' };

  const category = typeof exist.category === 'string' ? exist.category : '';
  const slug = typeof exist.slug === 'string' ? exist.slug : '';
  const onDisk = Boolean(category && slug);

  if (onDisk) {
    const d = await deleteSkillPackage(category, slug);
    // 404 = 磁盘上本来就没有 ⇒ 不是失败（否则这种条目永远删不掉）
    if (!d.ok && !d.notFound) return { ok: false, message: `删除磁盘技能包失败：${d.message}` };
  }

  const cw = writeSkillList(entries.filter((e) => e.id !== id));
  if (!cw.ok) {
    return { ok: false, message: `磁盘已删除，但缓存回写失败：${cw.error || '未知原因'}` };
  }
  return { ok: true, cacheOnly: !onDisk };
}

/**
 * 「**恢复**」：把索引里还留着的正文**写回磁盘**（磁盘包已被删、而索引这份可能是最后一份）。
 *
 * 【为什么必须留这个动作】索引里存着全文 ⇒ 文件夹被误删时，那份可能是**唯一副本**。
 * 把它当"幽灵"静默清掉，等于毁掉用户最后一份数据；而把它当正常行允许保存，又会变成
 * "保存的副作用顺带重建了包"（用户不知道自己做了什么）。⇒ 只有**显式**动作才能写回。
 * 【为什么复用 `saveSkillToDisk`】它本来就处理"既有条目在磁盘上不存在 ⇒ 按新建写"这一支，
 * 且整包原子写、写盘成功才回写索引 —— 恢复 = "用索引的内容重建那个包"，语义完全重合；
 * 写盘只许有一个实现，不另写一份。
 * 【代价要如实说】只能恢复**正文与声明**（name/description/version）；
 * `references/**` 随磁盘删除而丢失 —— 界面在确认框里要写明。
 */
export async function restoreSkillFromIndex(id: string): Promise<SaveSkillResult> {
  const cache = readSkillList();
  if (!cache.ok) return { ok: false, message: cache.error };
  const row = (cache.list as Partial<UserSkill>[]).find((e) => e.id === id);
  if (!row) return { ok: false, message: '索引里找不到这个 Skill（可能已被删除）' };
  return saveSkillToDisk({
    id,
    name: typeof row.name === 'string' && row.name ? row.name : id,
    description: typeof row.description === 'string' ? row.description : '',
    content: typeof row.content === 'string' ? row.content : '',
    category: typeof row.category === 'string' ? row.category : '',
    slug: typeof row.slug === 'string' ? row.slug : undefined, // 落回原路径（否则会让位成 -2）
    manifest: { version: row.version },
  });
}

/** 「**丢弃**」：把条目移出索引（**不动磁盘** —— 它本来就不在磁盘上了）。 */
export function discardSkillFromIndex(id: string): { ok: boolean; message?: string } {
  const cache = readSkillList();
  if (!cache.ok) return { ok: false, message: cache.error };
  const w = writeSkillList(cache.list.filter((e) => (e as { id?: unknown }).id !== id));
  return w.ok ? { ok: true } : { ok: false, message: w.error || '写入索引失败' };
}

/**
 * 导出用：给**完整 `SKILL.md`**（含 frontmatter）。
 *
 * 【为什么读磁盘、而不是从缓存重拼（TD-11-70）】此前拿缓存条目重拼 frontmatter，而缓存只带 4 个字段
 * （id/name/description/version）⇒ `unknown`（未识别字段，含 `when-to-use`/`allowed-tools` 等已退役声明）**全丢**。
 * 导入侧明明"原样带过"，导出侧却丢 ⇒ **"导出→再导入"一轮就悄悄少声明**（用户还拿它当备份）。
 * 磁盘上那个文件才是真相源 ⇒ 导出就是**把那个文件给你**。
 * 【读不到就 `null`】调用方（设置页）有"降级必须如实说"的分支：宁可能说清，不许悄悄给一份残缺 frontmatter。
 * （另：`name`/`description` 等声明丢了之后再导入只能靠文件名猜 —— 这也是"导出即残缺"。
 * 找不到条目 / 没有磁盘包 → `null`，由调用方回退到原始正文并**明说**降级。）
 */
export async function skillMarkdownForExport(id: string): Promise<string | null> {
  const cur = readSkillList();
  if (!cur.ok) return null;
  const e = (cur.list as Partial<UserSkill>[]).find((x) => x.id === id);
  const category = typeof e?.category === 'string' ? e.category : '';
  const slug = typeof e?.slug === 'string' ? e.slug : '';
  if (!category || !slug) return null; // 没有磁盘落点（内置 / 仅索引）⇒ 无从导出
  const full = await readSkillPackage(category, slug, 'content'); // 只取正文域（SKILL.md + references/**）
  if (!full.ok) return null;
  const md = findSkillEntryFile(full.data.files);
  return md && md.encoding === 'utf8' ? md.content : null; // **逐字**：不重建 frontmatter
}

// 【`importSkillText` 已搬到 `skillImport.ts`（2026-09-22 · TD-11-63 顺带）】
// 它在那里与"可导入扩展名白名单 + 去扩展名"同住 ⇒ 去扩展名只剩一份口径，且对"已去过扩展名"的
// 输入幂等（此前这里用通用正则 `/\.[^.]+$/`，会把调用方已剥过扩展名的 `报告 v1.2` 吃成 `报告 v1`）。
