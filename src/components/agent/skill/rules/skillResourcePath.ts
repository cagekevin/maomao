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
 * 两侧都经 `isTextPackageFile`（本文件）取用 ⇒ **这条口径只有一处出生地**（2026-09-22 收口）。
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

/** 取小写扩展名（无扩展名 / 前导点 ⇒ `''`）—— 唯一实现（本文件内用，不导出：没有第二个出生地要它） */
function textExtOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * 包内相对路径的**公共准入**（读侧与导入侧**共用这一处**）：段合法 + 扩展名在 `TEXT_RESOURCE_EXT` 内。
 *   段合法 = 非空 / 非 `.` `..` / 非前导点（隐藏段与空段一律拒）。
 *
 * 【为什么收成一处（2026-09-22）】这条判据此前**两侧各写一份**：读侧在 `assertSafeSkillRelativePath`
 * 里内联了"段检查 + 取扩展名"，导入侧 `skillImport` 另有一个本地 `extOf` + 同样的段检查
 * ⇒ 同一条口径两个出生地（改一处必漂移，且没有类型错）。现在只有本函数判它。
 * 【两侧的差异在用途，不在这条判据里】读侧另拒 `scripts/**`（脚本永不进模型视野），导入侧**收**它
 * （脚本随包保全在磁盘上）—— 那条差异留在各自的函数里，别再往本函数加"用途"分支。
 */
export function isTextPackageFile(rel: unknown): boolean {
  if (typeof rel !== 'string' || !rel) return false;
  const parts = rel.split('/');
  for (const p of parts) {
    if (!p || p === '.' || p === '..' || p.startsWith('.')) return false;
  }
  return TEXT_RESOURCE_EXT.has(textExtOf(parts[parts.length - 1]));
}

/**
 * 包内相对路径**准入**（安全面）—— 判的是"这条路径**危不危险**"，不是"它是不是一份附属资料"。
 *
 * 拒绝：绝对路径 · 反斜杠 · 带 scheme（`http:`/`file:`） · `.`/`..` 段 · 隐藏文件 · 非文本扩展名
 * · **`scripts/**` 整目录**（脚本永不读）。段合法与扩展名两条**与导入侧共用** `isTextPackageFile`。
 * ⚠️ **射程边界（TD-11-77）**：它**放行**包根裸文件名（`SKILL.md` 就是其一，入口名必须能过），
 * 所以"能不能读"是**两道**判据的合取：本函数（危不危险）× `extractResourcePaths`（是不是正文写出的
 * 附属资料引用）。附属资料只收**带目录**的引用（`references/**`）—— 那条口径在提取侧，不在本函数。
 */
export function assertSafeSkillRelativePath(rel: unknown): boolean {
  if (typeof rel !== 'string' || !rel) return false;
  if (rel.startsWith('/') || rel.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rel)) return false; // scheme（含 windows 盘符 `C:`）
  if (!isTextPackageFile(rel)) return false; // 段合法 + 文本扩展名（与导入侧**同一条判据**）
  return rel.split('/')[0] !== 'scripts'; // 读侧专有：脚本永不进模型视野
}

/** 正文里的反引号引用（`` `references/x.md` ``） */
const BACKTICK_RE = /`([^`\n]+)`/g;
/** markdown 链接目标（`](references/x.md)`；带锚点的 `#` 段剥掉后再判） */
const MD_LINK_RE = /\]\(([^)\s]+)\)/g;

/**
 * 提取「资料清单」——**只有正文里显式写出的路径才可读**（不是"包内任意文件可读"）。
 * 两个来源：反引号（主）与 markdown 链接（兼容），逐条过 `assertSafeSkillRelativePath` 校验。
 *
 * 【"带目录"这条口径**在这里**（TD-11-77）】附属资料 = `references/**`（`docs/plan/140 §1.1/§1.4`）
 * ⇒ 包根裸文件名**不算资料**：正文里随手写的 `` `foo.md` `` / `` `npm run dev` `` 是**代码片段**，
 * 不是引用（放宽了它，`missingRefs` / `resourceCount` 会当场被噪声淹没）。
 * ⚠️ 因此本函数与 `assertSafeSkillRelativePath` **射程不同**（后者只管危不危险、必须放行 `SKILL.md`）；
 * 拒绝时**必须说清是哪一条拒的**，否则模型会拿到"原因说谎"的报错（见 `skillResource.ts`）。
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
