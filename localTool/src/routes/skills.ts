/**
 * ════════════════════════════════════════════════════════════════
 * Skill 包 facade —— 技能库 `~/.maomao-localtool/skills/<分类>/<名称>/` 的**唯一读写口**。
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么必须独立于 `/api/files/*`（2026-09-21 定案 · 不是洁癖）】技能库**不在 uploads/ 之下**，
 * 既有 files 端点的作用域完全不适用 —— 且反向也成立（不能把技能库塞进 uploads）：
 *   · `/files/**` 是静态服务 ⇒ 放进去 `scripts/**` 会被 HTTP 直接取走；
 *   · 素材库 rescan 递归遍历 uploads 每个顶层目录并入库 ⇒ `SKILL.md` 变成"素材"；
 *   · uploads 有顶层根白名单 + 孤儿 GC ⇒ 要塞特例或被误判。
 * 详见 `db/database.ts getSkillsDir()`。本文件是技能库的唯一出入口。
 *
 * 【端点】
 *   GET    /api/skills                                    列全部包（`?withContent=1` 一次带正文，避免 N+1）
 *   GET    /api/skills/<分类>/<名称>?scope=content|package 单包。**默认 content = 排除 `scripts/**`**
 *   POST   /api/skills/<分类>/<名称>                        整包原子写（body = { files:[{relPath,encoding?,content}] }）
 *   DELETE /api/skills/<分类>/<名称>                        整包原子删（进 `.trash/`，全有或全无）
 *   POST   /api/skills/group                               新建分组（body = { name }；已存在 ⇒ 幂等 created:false）
 *   GET    /api/skills/open-dir?category=&slug=            打开文件夹（缺 slug ⇒ 开技能库根）
 *
 * 【安全】只接受「分类 / 名称」两段，**不接受任意路径输入**（无穿越面）：
 *   每段禁 `/` `\` `:`、`.`/`..`、控制字符、以 `.` 开头（保留给 `.tmp`/`.trash`）、超长。
 *   包内相对路径另有一道越界校验（禁绝对、禁 `..`、禁隐藏、限深度/条数/单文件体积）。
 * 【原子】写 = 先写 `.tmp/<随机>/pkg` 全成 → 旧包 rename 进 `.trash/` → rename 覆盖；rename 失败回滚旧包。
 *        删 = 整包 rename 进 `.trash/`（不真删，可人工捞回）。
 * 【scope=content 的语义】`scripts/**` 永不外流 —— 模型（经 skill_read_file）与网页读的都是 content 范围，
 *   只有导入/导出 UI 才用 `package` 范围。两道（本处 + 前端扩展名白名单）是纵深防御，不是重复规则。
 * ════════════════════════════════════════════════════════════════
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getSkillsDir } from '../db/database.js';
import { json, sendError, parseJsonBody, HttpStatusError } from '../utils/helpers.js';

const MAX_SEGMENT_LEN = 64;
const MAX_REL_DEPTH = 8;
const MAX_REL_SEGMENT_LEN = 128;
const MAX_FILES = 200;
/**
 * 单个技能文件字节上限 —— **跨栈契约常量**（前端 `src/components/agent/skill/write/skillImport.ts`
 * 同名常量，由 `check:arch` 的「跨栈契约常量对账」保证两侧相等；**字面数字**：闸按 `NAME = <数字>`
 * 抓取，写成表达式会抓不到 ⇒ 闸会报"缺失"）。
 */
const SKILL_MAX_FILE_BYTES = 2097152; // 2 MiB
/**
 * 技能包**入口文件名** —— **跨栈协议名**，与前端 `src/components/agent/skill/rules/skillEntry.ts` 的
 * `SKILL_ENTRY_FILE` 必须相等（两侧各留一份是结构必然：两个独立构建产物无法共享模块；
 * 由 `check:arch` 的 `CROSS_STACK_CONSTS` 机器对账，见 TD-11-59）。
 */
const SKILL_ENTRY_FILE = 'SKILL.md';
/**
 * `.trash/` 的保留上限（份）。覆盖保存与删除都会把旧包**整份**移进 `.trash/`（可人工捞回），
 * 但它**不是无界堆**：超出上限就按时间删最旧的，并把删掉几份如实写进日志（见 `pruneTrash`）。
 * 【为什么必须有个头（TD-11-35）】只有写入、没有清理 ⇒ 磁盘随"保存次数"无限增长，且用户
 * 完全不知道有这堆备份。**静默增长**与**静默删除**都不许有：一个要有上限，一个要留痕。
 * 100 份 ≈ "最近 100 次改动/删除都能捞回"，再往上基本不会回去翻。数字由列表接口回传给界面。
 */
const MAX_TRASH_ENTRIES = 100;

interface SkillFileInput {
  relPath?: unknown;
  encoding?: unknown;
  content?: unknown;
}
interface SkillFileEntry {
  relPath: string;
  encoding: 'utf8' | 'base64';
  content: string;
}

/** 技能库根（不存在则建）。根只允许本文件创建，保证「列目录」永远拿得到真值。 */
function ensureSkillsRoot(): string {
  const root = getSkillsDir();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

/**
 * 分类名 / 名称段的合法性。
 * 判据刻意**排除了以 `.` 开头的名字** —— `.tmp` 与 `.trash` 是 facade 内部工作目录，
 * 若允许用户段以 `.` 开头，就能写进内部目录（脏数据 + 列目录时被跳过，用户看不见自己写的东西）。
 */
function isSafeSegment(v: unknown): v is string {
  if (typeof v !== 'string' || !v) return false;
  if (v !== v.trim()) return false; // 前后空白：多半是复制粘贴带来的，拒绝而非静默裁剪
  if (v.length > MAX_SEGMENT_LEN) return false;
  if (v === '.' || v === '..') return false;
  if (v.startsWith('.')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[/\\:\u0000-\u001f]/.test(v)) return false;
  return true;
}

/** 包内相对路径归一（唯一函数，写侧读侧共用；非法 → null，调用方须拒绝而非回退）。 */
function safeRelPath(rel: unknown): string | null {
  if (typeof rel !== 'string' || !rel) return null;
  if (rel.startsWith('/') || rel.includes('\\')) return null;
  const parts = rel.split('/');
  if (parts.length > MAX_REL_DEPTH) return null;
  for (const p of parts) {
    if (!p || p === '.' || p === '..') return null;
    if (p.startsWith('.')) return null; // 隐藏文件（.git 等）不进包
    if (p.length > MAX_REL_SEGMENT_LEN) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f]/.test(p)) return null;
  }
  return parts.join('/');
}

/** 列一级子目录（排除 `.tmp`/`.trash` 等内部目录）；不可读 → []（空库是合法状态）。 */
function listSubDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * 递归收集包内文件相对路径。
 * @param withScripts false 时**排除顶层 `scripts/` 整目录**（content 范围的判据，只此一处）
 */
function walkFiles(absDir: string, relBase: string, withScripts: boolean, out: string[]): void {
  // 排序：readdirSync 的顺序由文件系统决定（跨平台/跨盘不稳定）⇒ 不排的话「清单」会随机漂移，
  // 前端 diff 与单测都会假红。用**码点序**（不是 localeCompare：locale 排序会随 ICU 版本/语言变，
  // 且把 `SKILL.md` 排到 `references/` 之后）—— 码点序下 `SKILL.md` 恒在最前，符合包的心智模型。
  const entries = fs
    .readdirSync(absDir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (!withScripts && rel === 'scripts') continue;
    if (e.isDirectory()) walkFiles(path.join(absDir, e.name), rel, withScripts, out);
    else if (e.isFile()) out.push(rel);
  }
}

/**
 * 二进制判据 —— **"这段字节能否无损地当作 UTF-8 文本"**（不是"含不含 NUL"）。
 *
 * 【为什么不是只查 NUL（TD-11-36）】无 NUL 的二进制（小图标、GBK 编码的旧文本、带 `0xFF/0xFE`
 * 的片段…）会被 `toString('utf8')` 换成 U+FFFD（**不可逆**），而它随后会跟着**整包回写**
 * （`saveSkillToDisk` 改正文、`backfillMissingIds` 补 id 都读整包再写回）把损坏写回磁盘 ——
 * 用户的图片/字体就这样被静默毁掉，而且是在"我只是改了个名字"之后。
 * 【判据与不变量对齐】改成"往返无损"后：判 utf8 的 ⇒ `Buffer.from(str,'utf8')` 必得原字节；
 * 判 base64 的 ⇒ 本来就走 base64 往返。**两种都不损坏**，这才是这里该守的不变量。
 */
function isBinaryBuffer(buf: Buffer): boolean {
  if (buf.includes(0)) return true; // 快速判据：绝大多数二进制含 NUL
  return !Buffer.from(buf.toString('utf8'), 'utf8').equals(buf); // 解→编不还原 ⇒ 有字节被替换过
}

/**
 * 读包内文件内容（文本 utf8 / 二进制 base64）。
 * @param only 只读这些相对路径（**不遍历**）—— 漂移侦测只比 `SKILL.md` 的正文指纹，
 *   犯不上把 `references/**` 全量读出来再传一遍（TD-11-39：取数范围要跟判据匹配）
 */
function readEntries(pkgDir: string, withScripts: boolean, only?: string[]): SkillFileEntry[] {
  const rels: string[] = [];
  if (only) {
    for (const rel of only) {
      if (fs.existsSync(path.join(pkgDir, ...rel.split('/')))) rels.push(rel);
    }
  } else {
    walkFiles(pkgDir, '', withScripts, rels);
  }
  return rels.map((rel) => {
    const buf = fs.readFileSync(path.join(pkgDir, ...rel.split('/')));
    const binary = isBinaryBuffer(buf);
    return {
      relPath: rel,
      encoding: binary ? 'base64' : 'utf8',
      content: binary ? buf.toString('base64') : buf.toString('utf8'),
    };
  });
}

/** 整包原子写：先全成再切换；切换失败回滚旧包。@returns 写入文件数 */
function writePackageAtomic(category: string, slug: string, files: SkillFileInput[]): number {
  const root = ensureSkillsRoot();
  const target = path.join(root, category, slug);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpPkg = path.join(root, '.tmp', stamp, 'pkg');
  fs.mkdirSync(tmpPkg, { recursive: true });
  try {
    let written = 0;
    for (const f of files) {
      const rel = safeRelPath(f?.relPath);
      if (!rel) throw new HttpStatusError(400, `非法包内路径：${String(f?.relPath)}`);
      const encoding = f?.encoding === 'base64' ? 'base64' : 'utf8';
      const buf = Buffer.from(String(f?.content ?? ''), encoding);
      if (buf.length > SKILL_MAX_FILE_BYTES)
        throw new HttpStatusError(400, `文件超过上限（${SKILL_MAX_FILE_BYTES} 字节）：${rel}`);
      const full = path.join(tmpPkg, ...rel.split('/'));
      // 硬兜底：join 后必须仍在 tmpPkg 内（safeRelPath 若被绕过，这里是最后一道闸）
      if (!full.startsWith(tmpPkg + path.sep))
        throw new HttpStatusError(400, `包内路径越界：${rel}`);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buf);
      written++;
    }
    // 切换：旧包先移入 trash（不直接删，人工可捞回），再 rename 覆盖
    const trashDir = path.join(root, '.trash', `${stamp}-${category}-${slug}`);
    let movedOld = false;
    if (fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(trashDir), { recursive: true });
      fs.renameSync(target, trashDir);
      movedOld = true;
    }
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(tmpPkg, target);
    } catch (e) {
      if (movedOld) {
        try {
          fs.renameSync(trashDir, target);
        } catch {
          /* 回滚失败：原包仍在 .trash/ 下，数据未丢；错误继续上抛给调用方 */
        }
      }
      throw e;
    }
    // 切换成功之后才清理：回滚窗口内**不许动** `.trash`（那正是回滚要用的那份）
    pruneTrash(root);
    return written;
  } finally {
    fs.rmSync(path.join(root, '.tmp', stamp), { recursive: true, force: true });
  }
}

/** 整包原子删（rename 进 `.trash/`）。@returns 包是否存在并被移走 */
function deletePackageAtomic(category: string, slug: string): boolean {
  const root = ensureSkillsRoot();
  const target = path.join(root, category, slug);
  if (!fs.existsSync(target)) return false;
  const trashDir = path.join(root, '.trash', `${Date.now()}-${category}-${slug}`);
  fs.mkdirSync(path.dirname(trashDir), { recursive: true });
  fs.renameSync(target, trashDir);
  pruneTrash(root);
  return true;
}

/**
 * 清理 `.trash/`：只留最新 `keep` 份，删掉的**如实写日志**（不静默）。@returns 删除份数
 *
 * 【为什么按 mtime】`.trash` 里的条目名形如 `<时间戳>-<分类>-<名称>`；rename 会刷新目录自身 mtime
 * ⇒ 用 mtime 排序即可，不必去解析名字（名字里含分类/名称，解析反而脆）。
 * 【为什么清理失败不抛】它是**副流程**：清不掉就留着（下次再试），绝不因为"清理没做成"让
 * 用户的保存/删除失败 —— 那是把内部维护成本转嫁给用户。
 * 【为什么保留最新的就意味着"刚删的那份一定在"】刚移进来的条目 mtime 最新 ⇒ 恒在保留集内，
 * 所以"删除后还能捞回"这条承诺不因清理而破。
 */
function pruneTrash(root: string, keep = MAX_TRASH_ENTRIES): number {
  const dir = path.join(root, '.trash');
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0; // 还没有 `.trash`（正常：没覆盖/删除过）
  }
  if (names.length <= keep) return 0;
  const entries = names.map((name) => {
    const full = path.join(dir, name);
    let mtime = 0;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      /* 读不到 mtime 的按最旧处理（要被清掉的那一类） */
    }
    return { full, mtime };
  });
  entries.sort((a, b) => b.mtime - a.mtime); // 新的在前
  let removed = 0;
  for (const e of entries.slice(keep)) {
    try {
      fs.rmSync(e.full, { recursive: true, force: true });
      removed++;
    } catch {
      /* 删不掉就留着（下次再试） */
    }
  }
  if (removed) {
    console.warn('[skills:trash] 备份超过上限，已清理最旧的', { removed, keep, dir });
  }
  return removed;
}

/** 从 URL 路径提取并校验 `/<分类>/<名称>` 两段（正则路由在 router.ts，这里只做解码 + 合法性）。 */
function segmentsOf(url: URL): { category: string; slug: string } | null {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','skills',分类,名称]
  if (parts.length !== 4) return null;
  let category: string;
  let slug: string;
  try {
    category = decodeURIComponent(parts[2]);
    slug = decodeURIComponent(parts[3]);
  } catch {
    return null; // 非法百分号编码
  }
  if (!isSafeSegment(category) || !isSafeSegment(slug)) return null;
  return { category, slug };
}

/**
 * 列全部 Skill 包。
 * @param withContent=1 带内容：默认 `SKILL.md` + `references/**`（一次拉全避免 N+1）；
 *   `&only=SKILL.md` ⇒ **只带 `SKILL.md`**（漂移侦测只要正文指纹，别把 references 全量搬一遍，TD-11-39）。
 */
export async function handleSkillsList(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const root = ensureSkillsRoot();
    const withContent = url.searchParams.get('withContent') === '1';
    const onlySkillMd = url.searchParams.get('only') === SKILL_ENTRY_FILE;
    const groups = listSubDirs(root);
    const packages: unknown[] = [];
    for (const category of groups) {
      for (const slug of listSubDirs(path.join(root, category))) {
        const pkgDir = path.join(root, category, slug);
        // 只认「含入口文件的目录」为包：目录里少了它属残包/用户手建目录，不列给前端
        if (!fs.existsSync(path.join(pkgDir, SKILL_ENTRY_FILE))) continue;
        const rels: string[] = [];
        walkFiles(pkgDir, '', false, rels);
        const entry: Record<string, unknown> = { category, slug, files: rels };
        if (withContent) {
          entry.contents = readEntries(pkgDir, false, onlySkillMd ? [SKILL_ENTRY_FILE] : undefined);
        }
        packages.push(entry);
      }
    }
    // `trashKeep` 如实回传：界面要告诉用户"删/改不会真丢、能捞回多少"——
    // 数字由生产者给全（消费者只转发），别在 UI 里再抄一份（TD-11-35）
    json(res, { code: 0, data: { root, groups, packages, trashKeep: MAX_TRASH_ENTRIES } });
  } catch (e) {
    sendError(res, (e as Error)?.message || '列举 Skill 包失败', 500);
  }
}

/** 读单个包。`scope=content`（默认）排除 `scripts/**`；`scope=package` 全含（导入导出 UI 用）。 */
export async function handleSkillsRead(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const seg = segmentsOf(url);
    if (!seg) return sendError(res, '非法分类或名称', 400);
    const pkgDir = path.join(getSkillsDir(), seg.category, seg.slug);
    if (!fs.existsSync(pkgDir)) return sendError(res, 'Skill 包不存在', 404);
    const scope = url.searchParams.get('scope') === 'package' ? 'package' : 'content';
    const files = readEntries(pkgDir, scope === 'package');
    json(res, { code: 0, data: { category: seg.category, slug: seg.slug, scope, files } });
  } catch (e) {
    sendError(res, (e as Error)?.message || '读取 Skill 包失败', 500);
  }
}

/** 整包原子写（覆盖语义：新包 = 提交的文件集合，不做"合并保留旧文件"）。 */
export async function handleSkillsSave(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const seg = segmentsOf(url);
    if (!seg) return sendError(res, '非法分类或名称', 400);
    const body = (await parseJsonBody(req)) as { files?: unknown } | null;
    if (!body || !Array.isArray(body.files))
      return sendError(res, 'body 需为 { files: [...] }', 400);
    if (body.files.length > MAX_FILES) return sendError(res, `文件数超过上限（${MAX_FILES}）`, 400);
    const written = writePackageAtomic(seg.category, seg.slug, body.files as SkillFileInput[]);
    json(res, { code: 0, data: { category: seg.category, slug: seg.slug, written } });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    sendError(res, err?.message || '写入 Skill 包失败', err?.status || 500);
  }
}

/** 整包原子删（进 `.trash/`）。 */
export async function handleSkillsDelete(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const seg = segmentsOf(url);
    if (!seg) return sendError(res, '非法分类或名称', 400);
    if (!deletePackageAtomic(seg.category, seg.slug)) return sendError(res, 'Skill 包不存在', 404);
    json(res, { code: 0, data: { category: seg.category, slug: seg.slug, deleted: true } });
  } catch (e) {
    sendError(res, (e as Error)?.message || '删除 Skill 包失败', 500);
  }
}

/**
 * 新建分组（= 技能库下的一级目录）。
 * 【幂等】目录已存在 ⇒ 返回 `created:false` 而不是报错 —— 用户点两次、或两个端同时点，都不该看到失败。
 * 【同名文件冲突】若同名的是**文件**（不是目录），返回 409 并说明：静默当成功会让界面出现"分组建好了"
 * 的假象，而实际放技能时还会失败（一次失败、两处显示不一致，是最难查的那种）。
 * 名字复用 `isSafeSegment`（唯一判据）：禁 `/` `\` `:`、`.`/`..`、前导 `.`（内部目录）、前后空白、超长。
 */
export async function handleSkillsCreateGroup(
  req: IncomingMessage,
  res: ServerResponse,
  _url: URL,
): Promise<void> {
  try {
    const body = (await parseJsonBody(req)) as { name?: unknown } | null;
    const name = body?.name;
    if (!isSafeSegment(name)) {
      return sendError(res, '非法分组名（禁 / \\ : 、前后空白、以 . 开头、超 64 字）', 400);
    }
    const root = ensureSkillsRoot();
    const dir = path.join(root, name);
    if (fs.existsSync(dir)) {
      if (!fs.statSync(dir).isDirectory())
        return sendError(res, '同名文件已存在，无法作为分组', 409);
      json(res, { code: 0, data: { name, created: false } });
      return;
    }
    fs.mkdirSync(dir, { recursive: true });
    json(res, { code: 0, data: { name, created: true } });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    sendError(res, err?.message || '新建分组失败', err?.status || 500);
  }
}

/**
 * 打开技能库文件夹（Finder / 资源管理器 / 文件管理器）。
 * 缺 `slug` ⇒ 开技能库根；给 `category` 无 `slug` ⇒ 开该分组。
 * 【为什么新端点而不复用 /api/files/open-dir】后者 `path.join(uploadDir, filepath)` 绑死 uploads 根，
 * 技能库是它的**兄弟目录** ⇒ 必被越根守卫拒；且它接受任意 filepath，攻击面更大。这里只收 category/slug。
 */
export async function handleSkillsOpenDir(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  try {
    const root = ensureSkillsRoot();
    const category = url.searchParams.get('category') || '';
    const slug = url.searchParams.get('slug') || '';
    let dir = root;
    if (category) {
      if (!isSafeSegment(category)) return sendError(res, '非法分类名', 400);
      dir = path.join(root, category);
      if (slug) {
        if (!isSafeSegment(slug)) return sendError(res, '非法名称', 400);
        dir = path.join(dir, slug);
      }
    }
    if (!fs.existsSync(dir)) return sendError(res, '目录不存在', 404);
    const cmd =
      process.platform === 'win32'
        ? 'explorer'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    try {
      // 【不走 shell（TD-11-25）】`execSync(`${cmd} "${dir}"`)` 把路径拼进命令行 ⇒ 目录名里只要有一个
      // `"` / `$()` / 反引号就能逃出引号执行任意命令，而 `isSafeSegment` **允许**这些字符（POSIX 文件名
      // 本就可以含 `"`，Finder 也建得出来）。改成 `execFileSync(cmd, [dir])`：参数不经 shell 解析，
      // 这一整类注入**结构上不存在**（不依赖"字符集够不够严"这种会漂移的判据）。
      execFileSync(cmd, [dir], { timeout: 5000 });
    } catch {
      // 打开失败不阻断：路径已如实返回，UI 可提示用户手动前往（与 files.ts handleOpenDir 同口径）
    }
    json(res, { code: 0, data: { path: dir } });
  } catch (e) {
    sendError(res, (e as Error)?.message || '打开目录失败', 500);
  }
}
