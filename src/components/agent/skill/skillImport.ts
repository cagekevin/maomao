/**
 * **整目录导入**：把用户选中的文件夹（一个包，或"装了多个包的上层目录"）写成技能包。
 *
 * 【为什么需要它】逐个 `.md` 导入只能带正文（收益 3 的缺口）；而外部 skill 包的标准形态是
 * 文件夹 + `SKILL.md` + `references/**`（与 ADR-0056 的"文件即真相源"同构）。本层负责把
 * 「浏览器给的相对路径列表」还原成"包根 + 包内相对路径"，再交给 `saveSkillToDisk` 的**整包导入**
 * 语义写盘 —— 写盘只有那一条路（ADR-0056 Q2：唯一可写处）。
 *
 * 【包根怎么找】不按"顶层目录名"切（那会把"选了包含多个包的上级目录"误判成一个包），
 * 而是**按直接含 `SKILL.md` 的目录**切：
 *   - 选了 `X/`（本身是包）      → 根 = `X`
 *   - 选了 `P/`（P 下有 X、Y 两个包）→ 根 = `P/X`、`P/Y`
 *   - 包内再套包（罕见）          → 取**最深**的根，外层因为自己那层没有 SKILL.md 而不会被当根
 *
 * 【只收文本】`references/**` 里的二进制（图片/字体/压缩包）**不导入**并由调用方如实上报 ——
 * 不是偷懒：模型侧读资料本来就只允许文本（`assertSafeSkillRelativePath`），带二进制进来只是
 * 让包变大且永远读不到。等真有"必须保全二进制"的用例再做 base64 通道（ADR-0053：不提前预留）。
 */
import { parseSkillMarkdown } from './skillManifest.ts';
import { TEXT_RESOURCE_EXT } from './skillResourcePath.ts';
import { saveSkillToDisk } from './skillPersist.ts';
import type { SaveSkillResult } from './skillPersist.ts';
import { SKILL_ENTRY_FILE } from './skillEntry.ts';
import { readSkillList } from './skillRepository.ts';
import type { SkillPackageFile } from './skillTypes.ts';

/**
 * 单个技能文件的字节上限 —— **跨栈契约常量**（后端 `localTool/src/routes/skills.ts` 同名常量，
 * 由 `check:arch` 的「跨栈契约常量对账」保证两侧相等，**禁单边漂移**；同 `MAX_SEND_DIM` 形态）。
 *
 * 【为什么必须双写】前端（vite/浏览器）与后端（node + 独立 package.json）是**两个独立构建产物**，
 * 无共享模块机制 ⇒ 双写是结构必然；真正的缺口是**机器对账**（此前两侧各写一份、注释互相提及，
 * 而注释拦不住人 —— 后端放宽后前端仍静默跳过本可导入的文件，TD-11-27）。
 * 【两侧用途不同，数值是同一事实】后端那道是**规则**（超限即 400，整包失败）；
 * 前端这道是**资源判断**（不必把必然被拒的文件读进内存）。
 */
export const SKILL_MAX_FILE_BYTES = 2097152; // 2 MiB（字面数字：闸按 `NAME = <数字>` 抓取，别写成表达式）

/**
 * 单文件导入的扩展名白名单 —— **唯一实现**（判定、去扩展名、文件选择框的 `accept` 全从它派生）。
 *
 * （2026-09-16 收口 TD-16-8；2026-09-22 从 legacy 壳搬进模块，TD-11-52：域内实现不许住壳里）
 * 【与 `isImportablePackageFile` 的分工】本表管"用户挑了一个 `.md` 文件"；
 * 那张 `TEXT_RESOURCE_EXT` 管"包内哪些文件值得读进来"（拒隐藏段、拒二进制）。两张表**不同**：
 * 入口必须是"一个能当 Skill 的文本"，`references/**` 里的 `json/yaml/csv` 不是入口。
 */
export const SKILL_IMPORT_EXT = ['md', 'markdown', 'txt'] as const;

const SKILL_IMPORT_FILE_RE = new RegExp(`\\.(${SKILL_IMPORT_EXT.join('|')})$`, 'i');

/**
 * 文件选择框的 `accept` —— 与白名单**同一份取值**（拼接方式只此一处）。
 *
 * 【为什么必须派生（2026-09-22 · TD-11-63 顺带）】`accept` 是**第二份白名单**：它错了不会报错，
 * 只会让用户在系统选择框里被**挡住**（accept 里没有的扩展名选不了）或被**钓**（accept 里有、
 * 判定却拒 ⇒ 挑完才被告知"不是文本类技能文件"）。实测两处都已漂移：
 * 设置页写的是 `.md,.markdown,.txt,.json,.yaml,.yml,.csv`（后四类判定一律拒）。
 * ⇒ 取值从白名单派生，改白名单则两处选择框同时跟上（结构上不可能再漂）。
 */
export const SKILL_IMPORT_ACCEPT = SKILL_IMPORT_EXT.map((e) => `.${e}`).join(',');

/** 是否是可导入为 Skill 的文件（按扩展名白名单；唯一判定入口） */
export function isSkillImportFile(fileName: string): boolean {
  return SKILL_IMPORT_FILE_RE.test(fileName);
}

/**
 * 由文件名去扩展名得到 Skill 名（与 `isSkillImportFile` 同一白名单口径）。
 * 【幂等】已经去过扩展名的名字再调它不会掉字（正则只认白名单里的那三个）。
 */
export function skillNameFromFile(fileName: string): string {
  return fileName.replace(SKILL_IMPORT_FILE_RE, '');
}

/**
 * 用例「**导入一个 `.md` 文件为 Skill**」（单文件；整目录见 `importSkillPackages`）。
 *
 * 【为什么住这里（2026-09-22 · TD-11-63 顺带）】它此前住 `skillPersist.ts`，于是"导入名怎么来"
 * 变成了**两份口径**：这里用通用正则 `/\.[^.]+$/` 去扩展名，而调用方（设置页）已经先
 * `skillNameFromFile(f.name)` 去过一次 —— 于是 `报告 v1.2.md` 被吃成 `报告 v1`（**静默改名**）。
 * 搬到白名单旁边后，去扩展名只剩 `skillNameFromFile` 一份，且**对"已去过扩展名"的输入幂等**
 * ⇒ 两个调用点传原文件名或传已去扩展名的名字，结果都一致（口径分歧结构上不成立）。
 * 【落盘优先】正文交给 `saveSkillToDisk`（唯一写盘口：先落盘成功才回写缓存）。
 */
export async function importSkillText(fileName: string, text: string): Promise<SaveSkillResult> {
  const { manifest, body } = parseSkillMarkdown(text);
  return saveSkillToDisk({
    id: manifest.id,
    name: manifest.name || skillNameFromFile(String(fileName || '')),
    description: manifest.description || '',
    content: body,
    manifest: {
      whenToUse: manifest.whenToUse,
      version: manifest.version,
      allowedTools: manifest.allowedTools,
      userInvocable: manifest.userInvocable,
      disableModelInvocation: manifest.disableModelInvocation,
      unknown: manifest.unknown,
    },
  });
}

export interface ImportFileInput {
  /** 相对路径（优先用 `File.webkitRelativePath`，它含用户选中的那个顶层文件夹名） */
  relPath: string;
  /** 文本内容（调用方用 `File.text()` 读；只读可导入的文件，见 `isImportablePackageFile`） */
  content: string;
}

export interface ImportPackagesResult {
  ok: boolean;
  /** 成功写盘并进缓存的包 */
  imported: { id: string; name: string; files: number; updated: boolean }[];
  /** 逐包失败原因（**不连坐**：一个包失败不影响其余包） */
  failed: { target: string; message: string }[];
  /** 整体前置失败（如一个 SKILL.md 都没找到、缓存损坏） */
  error?: string;
}

/** 取小写扩展名（无扩展名 / 前导点 ⇒ `''`） */
function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * 这个路径是否值得导入。
 * 拒绝隐藏段（`.DS_Store`、`.git/` 等）：它们既不是内容，又会被后端 `isSafeRelPath` 判 400 ——
 * 一个 `.DS_Store` 会让**整个包**写失败，所以必须在**提交前**就剔掉（而不是等后端报错）。
 * 【扩展名判据 = 读侧同一张表】`TEXT_RESOURCE_EXT`（唯一真源）——此前本文件另写一份正则、
 * 且取值少 `tsv`/`html`/`htm` ⇒ 读得到却导不进（TD-11-34）。差异只在用途：读侧另禁 `scripts/**`，
 * 导入侧收（脚本随包保全在磁盘上）。
 */
export function isImportablePackageFile(relPath: string): boolean {
  const segs = String(relPath || '').split('/');
  if (segs.some((s) => !s || s.startsWith('.'))) return false;
  return TEXT_RESOURCE_EXT.has(extOf(segs[segs.length - 1]));
}

function dirOf(relPath: string): string {
  const i = relPath.lastIndexOf('/');
  return i < 0 ? '' : relPath.slice(0, i);
}
function baseOf(relPath: string): string {
  const i = relPath.lastIndexOf('/');
  return i < 0 ? relPath : relPath.slice(i + 1);
}
/** 把包内绝对（相对选中根）路径还原成**相对包根**的路径 */
function relToRoot(relPath: string, root: string): string {
  return root ? relPath.slice(root.length + 1) : relPath;
}

/**
 * 导入一个/多个 skill 包。
 * @param files 选中文件列表（路径 + 文本）
 * @param opts.category 落到哪个分组；缺省 `_未分类`
 * @returns 逐包结果（**不抛**；一个失败不连坐其余）
 */
export async function importSkillPackages(
  files: ImportFileInput[],
  opts: { category?: string } = {},
): Promise<ImportPackagesResult> {
  const usable = (files || []).filter(
    (f) =>
      f &&
      typeof f.relPath === 'string' &&
      typeof f.content === 'string' &&
      isImportablePackageFile(f.relPath),
  );

  // 入口文件的**小写形**：本层比较是**刻意容忍大小写**的（用户在 Finder 里手建的包可能写成 `skill.md`）
  // ⇒ 由 `SKILL_ENTRY_FILE` 派生，**不许再写一遍字面量**（TD-11-64：协议名散着写，改名时必漏一处）
  const entryLower = SKILL_ENTRY_FILE.toLowerCase();
  const roots = [
    ...new Set(
      usable
        .filter((f) => baseOf(f.relPath).toLowerCase() === entryLower)
        .map((f) => dirOf(f.relPath)),
    ),
  ].sort();
  if (!roots.length) {
    return {
      ok: false,
      imported: [],
      failed: [],
      error: '没找到 SKILL.md —— 请选择 skill 包文件夹本身，或包含它们的上层文件夹',
    };
  }

  const imported: ImportPackagesResult['imported'] = [];
  const failed: ImportPackagesResult['failed'] = [];
  // 判「新增 or 更新」要**事前的**事实（写完再读只能看到新状态）—— 缓存损坏时按"都不存在"处理，
  // 不因此中断导入（真正的失败会由 saveSkillToDisk 的落盘结果如实返回）。
  const knownIds = new Set(
    readSkillList()
      .list.map((e) => (e as { id?: unknown })?.id)
      .filter((v): v is string => typeof v === 'string'),
  );

  for (const root of roots) {
    const folderName = baseOf(root) || '未命名';
    const inRoot = usable.filter((f) => (root ? f.relPath.startsWith(`${root}/`) : true));
    const md = inRoot.find((f) => baseOf(f.relPath).toLowerCase() === entryLower);
    if (!md) {
      failed.push({ target: folderName, message: '该文件夹里没有 SKILL.md' });
      continue;
    }

    const packageFiles: SkillPackageFile[] = inRoot
      .filter((f) => f !== md)
      .map((f) => ({
        relPath: relToRoot(f.relPath, root),
        encoding: 'utf8' as const,
        content: f.content,
      }));

    // 作者写进 frontmatter 的东西一律带过（含未知字段）—— 导入不是"重写成我们的格式"
    const { manifest, body } = parseSkillMarkdown(md.content);
    const declaredId =
      typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : undefined;

    const r = await saveSkillToDisk({
      id: declaredId,
      name: manifest.name || folderName,
      description: manifest.description || '',
      content: body,
      category: opts.category,
      manifest: {
        whenToUse: manifest.whenToUse,
        version: manifest.version,
        allowedTools: manifest.allowedTools,
        userInvocable: manifest.userInvocable,
        disableModelInvocation: manifest.disableModelInvocation,
        unknown: manifest.unknown,
      },
      packageFiles,
    });

    if (r.ok) {
      // `updated` = 这个包的 id **事前就已存在**（同名包再导一次 = 更新那份，不是多出一份）
      imported.push({
        id: r.skill.id,
        name: r.skill.name,
        files: packageFiles.length + 1,
        updated: Boolean(declaredId && knownIds.has(declaredId)),
      });
    } else {
      failed.push({ target: folderName, message: r.message });
    }
  }

  return { ok: failed.length === 0, imported, failed };
}
