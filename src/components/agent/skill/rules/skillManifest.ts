/**
 * `SKILL.md` 的 frontmatter 解析 / 序列化 —— **零依赖手写**，只解析不执行。
 *
 * 【为什么手写不引 yaml】frontmatter 是**不可信数据**（用户/外部导入）。引一个完整 YAML 解析器
 * 会把「锚点/别名/自定义类型/多文档」这些**能构造出对象图**的能力一并引进来 —— 那是安全面，
 * 不是便利面。这里只认「标量键值 + 续行」，其余一律忽略但保留。
 *
 * 【两条硬规则】
 *  ① **未知字段忽略但原样保留**（`unknown`）：保证往返幂等，也让外部 skill 包能直接放进来用；
 *     **空值行 = 不存在**（`x-foo:` 不占位）—— 与已知字段同一口径，解析 / 序列化两侧都据此（见 §幂等口径 ③）；
 *  ② **安全阀**：frontmatter 缺失或未闭合 ⇒ 整个文件当正文，**绝不丢内容**（宁可解析退化，不可丢字）。
 *
 * 【已知字段只有 4 个（2026-09-22 · `docs/plan/142 §3.10`）】`id` / `name` / `description` / `version`。
 * 原 `when-to-use` / `allowed-tools` / `user-invocable` / `disable-model-invocation` 四个"已知字段"已退役
 * （读点全在存取转发路径，**没有任何行为读它们**）⇒ 它们现在走 `unknown` 通道**原样保留、往返不丢**。
 * 随之退役的还有"**安全字段禁多行**"那条规则：它防的是"用续行伪造权限声明"，而权限声明本身已不再被解析
 * ⇒ 该防护失去了保护对象（守着一个没人读的字段的伪造面，是自欺）。`rejectedMultiLine` 一并删除。
 *
 * 【已知边界（诚实声明）】值内换行只在「续行不含 `: `」时才能无损往返 —— 这是零依赖手写解析器的
 * 固有边界；真需要块标量再单独做，不在本期（禁幽灵预留：现在没有需要多行值的真实用例）。
 */
import type { SkillManifest } from '../skillTypes.ts';

/** 本模块已知并单独建模的字段（其余进 `unknown` 原样保留） */
const KNOWN_FIELDS = new Set(['name', 'description', 'version', 'id']);

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
 * 【为什么需要】`SkillManifest` 有一个必填集合字段（`unknown`），
 * 新建时逐处手写它既啰嗦又容易漏 —— 收口成唯一入口，语义也清楚：新建 = 从空声明开始。
 */
export function emptyManifest(patch: Partial<SkillManifest> = {}): SkillManifest {
  return { name: '', description: '', unknown: {}, ...patch };
}

/**
 * 键值扫描（含续行合并）。
 * 【更新(2026-09-22)】原"安全字段遇续行 ⇒ 整体作废"分支已删：那 3 个字段不再被解析（见文件头）。
 */
function parseFields(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let current: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (m) {
      current = m[1].toLowerCase();
      fields[current] = unquote(m[2]);
      continue;
    }
    // 续行：并入上一字段
    if (!current) continue;
    fields[current] = `${fields[current]}\n${line.trim()}`;
  }
  return fields;
}

/**
 * 解析 `SKILL.md`。
 * @returns `manifest` + `body`（正文，已剥 frontmatter）；任何异常形态都退化为"整文件当正文"。
 */
export function parseSkillMarkdown(source: string): { manifest: SkillManifest; body: string } {
  const base: SkillManifest = { name: '', description: '', unknown: {} };
  const { raw, body } = splitFrontmatter(source);
  if (raw === null) return { manifest: base, body: source };

  const fields = parseFields(raw);
  const manifest: SkillManifest = { ...base };
  const has = (k: string) => Object.prototype.hasOwnProperty.call(fields, k);

  // 【空值 = 不存在（唯一口径）】`version:`（空）与"没写这一行"是同一件事 ⇒ 折成 `undefined`。
  // 不折的话：解析给 `''`、序列化省略空值行 ⇒ 再解析回 `undefined` ≠ `''`，语义幂等当场破（TD-11-37）。
  // `name`/`description` 不必折：它们"无此行"本就回落到 `''`（与"写了空行"同一个值）。
  const optional = (v: string): string | undefined => (v ? v : undefined);
  if (has('name')) manifest.name = fields['name'];
  if (has('description')) manifest.description = fields['description'];
  if (has('version')) manifest.version = optional(fields['version']);
  if (has('id')) manifest.id = optional(fields['id']);
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
 *   ③ **空值行不占位**：`version:`（空）≡ 没写这一行（解析折成 `undefined`，序列化省略它），
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
  push('version', manifest.version);
  // 未知字段（含已退役的 when-to-use / allowed-tools / 布尔字段）原样写回。
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
