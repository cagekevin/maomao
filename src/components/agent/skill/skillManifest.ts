/**
 * `SKILL.md` 的 frontmatter 解析 / 序列化 —— **零依赖手写**，只解析不执行。
 *
 * 【为什么手写不引 yaml】frontmatter 是**不可信数据**（用户/外部导入）。引一个完整 YAML 解析器
 * 会把「锚点/别名/自定义类型/多文档」这些**能构造出对象图**的能力一并引进来 —— 那是安全面，
 * 不是便利面。这里只认「标量键值 + 续行」，其余一律忽略但保留。
 *
 * 【三条硬规则】
 *  ① **未知字段忽略但原样保留**（`unknown`）：保证往返幂等，也让外部 skill 包能直接放进来用；
 *     **空值行 = 不存在**（`x-foo:` 不占位）—— 与已知字段同一口径，解析 / 序列化两侧都据此（见 §幂等口径 ③）；
 *  ② **安全字段禁多行**（`allowed-tools` / `user-invocable` / `disable-model-invocation`）：
 *     多行 ⇒ 该字段**整体作废**并记入 `rejectedMultiLine`（可见，不静默），防"用续行伪造权限声明"；
 *  ③ **安全阀**：frontmatter 缺失或未闭合 ⇒ 整个文件当正文，**绝不丢内容**（宁可解析退化，不可丢字）。
 *
 * 【已知边界（诚实声明）】值内换行只在「续行不含 `: `」时才能无损往返 —— 这是零依赖手写解析器的
 * 固有边界；真需要块标量再单独做，不在本期（禁幽灵预留：现在没有需要多行值的真实用例）。
 */
import type { SkillManifest } from './skillTypes.ts';

/** 多行即作废的安全字段（判据：这些字段一旦能多行，就能用续行拼出伪造声明） */
const SAFE_MULTILINE_FIELDS = new Set([
  'allowed-tools',
  'user-invocable',
  'disable-model-invocation',
]);

/** 本模块已知并单独建模的字段（其余进 `unknown` 原样保留） */
const KNOWN_FIELDS = new Set([
  'name',
  'description',
  'when-to-use',
  'version',
  'id',
  ...SAFE_MULTILINE_FIELDS,
]);

/** 去成对引号（只去最外层一对；`"a"b"` 这类畸形保持原样，不猜） */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length < 2) return t;
  const a = t[0];
  const b = t[t.length - 1];
  if ((a === '"' && b === '"') || (a === "'" && b === "'")) return t.slice(1, -1);
  return t;
}

/**
 * 切出 frontmatter 原文与正文。
 * @returns `raw === null` 表示「没有 frontmatter」或「有开头但未闭合」——两种都走安全阀（整文件当正文）。
 */
export function splitFrontmatter(source: string): { raw: string | null; body: string } {
  const text = source.replace(/^\uFEFF/, ''); // 去 BOM（外部编辑器常见）
  if (!/^---[ \t]*\r?\n/.test(text)) return { raw: null, body: source };
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (/^---[ \t]*$/.test(lines[i])) {
      return { raw: lines.slice(1, i).join('\n'), body: lines.slice(i + 1).join('\n') };
    }
  }
  return { raw: null, body: source }; // 未闭合 → 安全阀
}

/**
 * 造一个"空 manifest"（供**新建**技能的调用方用）。
 * 【为什么需要】`SkillManifest` 有两个必填集合字段（`unknown` / `rejectedMultiLine`），
 * 新建时逐处手写它们既啰嗦又容易漏 —— 收口成唯一入口，语义也清楚：新建 = 从空声明开始。
 */
export function emptyManifest(patch: Partial<SkillManifest> = {}): SkillManifest {
  return { name: '', description: '', unknown: {}, rejectedMultiLine: [], ...patch };
}

/** 键值扫描（含续行合并 + 安全字段多行作废）。 */
function parseFields(raw: string): { fields: Record<string, string>; rejected: string[] } {
  const fields: Record<string, string> = {};
  const rejected: string[] = [];
  let current: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (m) {
      current = m[1].toLowerCase();
      fields[current] = unquote(m[2]);
      continue;
    }
    // 续行：并入上一字段；安全字段遇到续行 ⇒ 整体作废（防伪造）
    if (!current) continue;
    if (SAFE_MULTILINE_FIELDS.has(current)) {
      if (!rejected.includes(current)) rejected.push(current);
      delete fields[current];
      current = null;
      continue;
    }
    fields[current] = `${fields[current]}\n${line.trim()}`;
  }
  return { fields, rejected };
}

/** 布尔字面量（YAML 的多种写法都要认；认不出按 false 处理并由调用方决定是否提示） */
function toBool(v: string): boolean {
  return /^(true|1|yes|on)$/i.test(v.trim());
}

/**
 * 解析 `SKILL.md`。
 * @returns `manifest` + `body`（正文，已剥 frontmatter）；任何异常形态都退化为"整文件当正文"。
 */
export function parseSkillMarkdown(source: string): { manifest: SkillManifest; body: string } {
  const base: SkillManifest = { name: '', description: '', unknown: {}, rejectedMultiLine: [] };
  const { raw, body } = splitFrontmatter(source);
  if (raw === null) return { manifest: base, body: source };

  const { fields, rejected } = parseFields(raw);
  const manifest: SkillManifest = { ...base, rejectedMultiLine: rejected };
  const has = (k: string) => Object.prototype.hasOwnProperty.call(fields, k);

  // 【空值 = 不存在（唯一口径）】`when-to-use:`（空）与"没写这一行"是同一件事 ⇒ 折成 `undefined`。
  // 不折的话：解析给 `''`、序列化省略空值行 ⇒ 再解析回 `undefined` ≠ `''`，语义幂等当场破（TD-11-37）。
  // `name`/`description` 不必折：它们"无此行"本就回落到 `''`（与"写了空行"同一个值）。
  const optional = (v: string): string | undefined => (v ? v : undefined);
  if (has('name')) manifest.name = fields['name'];
  if (has('description')) manifest.description = fields['description'];
  if (has('when-to-use')) manifest.whenToUse = optional(fields['when-to-use']);
  if (has('version')) manifest.version = optional(fields['version']);
  if (has('id')) manifest.id = optional(fields['id']);
  if (has('allowed-tools')) {
    const tools = fields['allowed-tools']
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (tools.length) manifest.allowedTools = tools; // 空列表 = 没写（同上：不给"空 vs 无"两副样子）
  }
  // 【空值 = 不存在（同一口径，TD-11-49）】`user-invocable:`（空）**不许**被 `toBool('')` 物化成 `false`：
  // 那等于把一个"空声明"改成显式 `user-invocable: false`，下次保存就把文件改写了（替用户改文件）。
  // 这两个字段是布尔，但"没值"与"值为 false"是两件事 —— 与字符串字段同口径处理。
  if (has('user-invocable') && fields['user-invocable']) {
    manifest.userInvocable = toBool(fields['user-invocable']);
  }
  if (has('disable-model-invocation') && fields['disable-model-invocation']) {
    manifest.disableModelInvocation = toBool(fields['disable-model-invocation']);
  }
  for (const [k, v] of Object.entries(fields)) {
    if (!KNOWN_FIELDS.has(k) && v) manifest.unknown[k] = v; // 空值行 = 不存在，不占位（同口径）
  }
  return { manifest, body };
}

/**
 * 序列化回 `SKILL.md`。
 *
 * 【幂等口径（诚实版）】字节级 `serialize(parse(x)) === x` **不可能**成立也不该要求 ——
 * 原文件的字段顺序/引号/缩进是用户写的，我们无权改写成"必须一样"。本模块保证的是：
 *   ① **语义幂等**：`parse(serialize(parse(x)))` 与 `parse(x)` 深等；
 *   ② **序列化自身稳定**：`serialize(parse(serialize(s))) === serialize(s)`；
 *   ③ **空值行不占位**：`when-to-use:`（空）≡ 没写这一行（解析折成 `undefined`，序列化省略它），
 *     `unknown` 同口径（此前只守了已知字段、`unknown` 照写 `x-foo: ` 带尾空格子，
 *     且"空值已知字段"往返由 `''` 变 `undefined` ⇒ ①对空值样例**并不成立**，而注释声称已锁死 ——
 *     TD-11-37：口径强于实现，且单测只覆盖非空样例）。
 *  三者都在单测里锁死（**含空值样例**）。
 */
export function serializeSkillMarkdown(manifest: SkillManifest, body: string): string {
  const lines: string[] = [];
  const push = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== '') lines.push(`${k}: ${v}`);
  };
  push('id', manifest.id);
  push('name', manifest.name);
  push('description', manifest.description);
  push('when-to-use', manifest.whenToUse);
  push('version', manifest.version);
  if (manifest.allowedTools && manifest.allowedTools.length) {
    push('allowed-tools', manifest.allowedTools.join(', '));
  }
  if (manifest.userInvocable !== undefined) push('user-invocable', String(manifest.userInvocable));
  if (manifest.disableModelInvocation !== undefined) {
    push('disable-model-invocation', String(manifest.disableModelInvocation));
  }
  // 空值不写（与解析同口径：空值行 = 不存在）。带上它同时也堵住"手搓 manifest 里塞空串"这条路。
  for (const [k, v] of Object.entries(manifest.unknown)) {
    if (v) lines.push(`${k}: ${v}`);
  }
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

/**
 * 标签脱敏：去控制字符与换行、压空白、截断。
 * 用途：`name`/`description` 来自用户文件却要拼进 system 提示（**注入面**），必须先清洗。
 */
export function sanitizeSkillLabel(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const cleaned = v
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}
