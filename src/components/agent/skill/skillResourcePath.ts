/**
 * 技能包内**相对路径的准入**（"模型能读哪些文件"的唯一判据）与正文引用提取。
 *
 * 【本文件管的是安全面，不是预算面】它决定**模型的读权限**：哪些包内文件算得上"可读资料"。
 * 变更理由独立于预算（`skillBudget.ts`）、块文案（`skillInjectText.ts`）、目录名（`skillDirName.ts`）
 * —— 改这里的任何一条都等于改模型的能力边界，必须单独被看见。
 *
 * 【历史上它与另外四类一起住在 `skillCatalog.ts`（TD-11-60 六类混居）】
 */

/**
 * **文本类扩展名白名单 —— 唯一真源**（两个消费者，取值不许再各写一份）：
 *  ① 读侧准入 `assertSafeSkillRelativePath`：模型可读的资料只收这些；
 *  ② 导入侧准入 `skillImport.isImportablePackageFile`：只把这些当文本读进来。
 * 【为什么必须一份】两边曾各写一份且取值不同（导入侧少 `tsv`/`html`/`htm`）⇒ 同一个
 * `references/page.html` 读侧允许、导入侧被跳过：用户被拦在一个本可用的文件之外，
 * 而模型那边其实读得到（TD-11-34）。
 * 【两份用途的真正差异不在本表】读侧另拒 `scripts/**`（脚本永不进模型视野），
 * 导入侧**收**它（脚本随包保全在磁盘上，只是模型读不到）—— 差异在用途，不在扩展名表。
 */
export const TEXT_RESOURCE_EXT = new Set([
  'md',
  'markdown',
  'txt',
  'json',
  'yaml',
  'yml',
  'csv',
  'tsv',
  'html',
  'htm',
]);

/**
 * 包内相对路径准入（**读资料唯一判据**）。
 *
 * 拒绝：绝对路径 · 反斜杠 · 带 scheme（`http:`/`file:`） · `.`/`..` 段 · 隐藏文件 · 非文本扩展名
 * · **`scripts/**` 整目录**（脚本永不读）。
 * 通过者只可能是「`SKILL.md` 同级的 `references/**` 之类的文本文件」。
 */
export function assertSafeSkillRelativePath(rel: unknown): boolean {
  if (typeof rel !== 'string' || !rel) return false;
  if (rel.startsWith('/') || rel.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rel)) return false; // scheme（含 windows 盘符 `C:`）
  const parts = rel.split('/');
  for (const p of parts) {
    if (!p || p === '.' || p === '..') return false;
    if (p.startsWith('.')) return false;
  }
  if (parts[0] === 'scripts') return false;
  const last = parts[parts.length - 1];
  const dot = last.lastIndexOf('.');
  if (dot <= 0) return false; // 无扩展名 → 不是可读资料
  return TEXT_RESOURCE_EXT.has(last.slice(dot + 1).toLowerCase());
}

/** 正文里的反引号引用（`` `references/x.md` ``） */
const BACKTICK_RE = /`([^`\n]+)`/g;
/** markdown 链接目标（`](references/x.md)`；带锚点的 `#` 段剥掉后再判） */
const MD_LINK_RE = /\]\(([^)\s]+)\)/g;

/**
 * 提取「资料清单」——**只有正文里显式写出的路径才可读**（不是"包内任意文件可读"）。
 * 两个来源：反引号（主）与 markdown 链接（兼容），逐条过 `assertSafeSkillRelativePath` 校验。
 */
export function extractResourcePaths(body: string): string[] {
  if (typeof body !== 'string' || !body) return [];
  const out = new Set<string>();
  const consider = (raw: string) => {
    const bare = raw.trim().split('#')[0];
    if (!bare || !bare.includes('/')) return; // 只认带目录的引用（references/...）
    if (assertSafeSkillRelativePath(bare)) out.add(bare);
  };
  for (const m of body.matchAll(BACKTICK_RE)) consider(m[1]);
  for (const m of body.matchAll(MD_LINK_RE)) consider(m[1]);
  return [...out];
}
