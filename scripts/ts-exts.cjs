'use strict';
/**
 * ts-exts.cjs — TS 规范化重构期【扩展名无关 + 永久豁免】的唯一事实来源。
 *
 * 为什么是 .cjs：消费方既有 .mjs（mv-sync-refs / check-*），也有 .cjs（_smoke_checks /
 * health-check / regression_test / test_agent_tools）。CJS 文件两边都能 require
 * （ESM 侧用 createRequire），从而只维护一份清单，避免「改了目录结构/改了后缀，
 * 忘了补某个脚本」再次形成盲区（本轮 hook 收口已经踩过一次，见 check-targets.mjs 头注释）。
 *
 * 提供：
 *   1. SOURCE_EXTS —— 源码扩展名全集（转换前后四种形态都算源码）
 *   2. TS_EXEMPT_DIRS / TS_EXEMPT_FILES / isExempt —— 永不转换的豁免清单（红线）
 *   3. resolveSourceFile —— 扩展名无关的模块解析（'…/foo' 或 '…/foo.jsx' → 真实存在的文件）
 *
 * 【用法】
 *   const { resolveSourceFile, isExempt } = require('./ts-exts.cjs')                 // .cjs 里
 *   import { resolveSourceFile, isExempt } from './check-targets.mjs'                // .mjs 里（转出口）
 */
const fs = require('fs');
const path = require('path');

/** 源码扩展名（转换前 .js/.jsx + 转换后 .ts/.tsx） */
const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx'];

/**
 * 永久豁免目录：外部开源库（CLAUDE.md 红线：不重构、不纳入测试）。
 *
 * 更新(2026-09-01)：director3d 已由用户明确要求「全部收敛」，26 个 .js/.jsx 全部 TS 化
 * （App.tsx / Viewport.tsx / project.ts / rig.ts / panels/* 等），不再豁免，故清空本清单。
 * 保留字段本身（各 check 脚本共用），后续若再引入外部库可在此登记。
 */
const TS_EXEMPT_DIRS = [];

/**
 * 永久豁免文件：契约/配置真相源。
 *
 * 更新(2026-09-01)：contracts.js / config.js 均已 TS 化（config.ts / contracts.ts），
 * 不再豁免（此前因「被 4 个 check 脚本 Node 直接 import()，改名会崩门禁」而豁免，
 * 实测 Node import() 扩展名无关 + resolveSourceFile 免疫，障碍仅为脚本路径字符串同步）。
 * 现全仓已无任何永久豁免源码文件，清空本清单。保留字段本身（各 check 脚本共用），
 * 后续若再引入外部库/特殊文件可在此登记。
 */
const TS_EXEMPT_FILES = [];

/**
 * @param {string} p
 * @returns {string}
 */
function toPosix(p) {
  return String(p).split(path.sep).join('/');
}

/**
 * relPath（posix，相对仓库根）是否命中永久豁免
 * @param {string} relPath
 * @returns {boolean}
 */
function isExempt(relPath) {
  const p = toPosix(relPath);
  if (TS_EXEMPT_DIRS.some((d) => p === d || p.startsWith(d + '/'))) return true;
  return TS_EXEMPT_FILES.includes(p);
}

/**
 * 解析模块绝对路径（可带也可不带扩展名）→ 真实存在的源码文件绝对路径；找不到返回 null。
 *
 * 扩展名无关的意义：TS 化期间同一模块会在 .jsx→.tsx 之间漂移，任何写死后继扩展名的脚本
 * 都会在改名的那一刻变红（或直接静默漏扫）。统一走这里解析即可免疫：
 *   '…/nodes/ImageNode'      → ImageNode.jsx / .tsx 都能命中
 *   '…/nodes/ImageNode.jsx'  → 只剩 .tsx 时也能回退命中（防存量引用失效）
 *   '…/base'                 → base/index.tsx
 */
/**
 * 解析模块绝对路径（可带也可不带扩展名）→ 真实存在的源码文件绝对路径；找不到返回 null。
 * @param {string} abs
 * @returns {string|null}
 */
function resolveSourceFile(abs) {
  if (!abs) return null;
  try {
    if (fs.statSync(abs).isFile()) return abs;
  } catch (e) {
    /* 不存在 → 继续按扩展名试探 */
  }
  const ext = path.extname(abs);
  const stem = SOURCE_EXTS.includes(ext) ? abs.slice(0, abs.length - ext.length) : abs;
  for (const e of SOURCE_EXTS) {
    const cand = stem + e;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  for (const e of SOURCE_EXTS) {
    const cand = path.join(abs, 'index' + e);
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 * 后缀判定：内容里有没有 JSX（有 → .tsx；纯逻辑 → .ts）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 常见 HTML/内置标签白名单：小写【无点】的标签名只有在白名单里才算 JSX。
 * 目的是压住误判——比较运算 `a < b > c`、泛型 `Array<T>` 都不是 JSX。
 */
const HTML_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'param',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
  // SVG（画布/图标常用，漏掉会把纯 SVG 组件误判成无 JSX）
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'rect',
  'text',
  'defs',
  'use',
  'clipPath',
  'mask',
  'linearGradient',
  'stop',
  'foreignObject',
  'tspan',
]);

/**
 * 标签名是否算 JSX 标签：
 *  - 大写开头 → 组件（含成员式：`CanvasEdgesContext.Provider`、`Motion.div`）
 *  - 含点但小写开头 → 不当 JSX（多为成员访问/比较运算，如 `a < b.c > d`）
 *  - 小写无点 → 必须在 HTML 标签白名单内
 */
/**
 * @param {string} name
 * @returns {boolean}
 */
function isJsxTagName(name) {
  if (/^[A-Z]/.test(name)) return true;
  if (name.includes('.')) return false;
  return HTML_TAGS.has(name.toLowerCase());
}

/**
 * JSX 探测：先剥离注释与字符串/模板串，再找开/闭/自闭合标签。
 * 避免把纯逻辑文件里字符串/正则中的 `<div>`、`<br>` 等 HTML 形文本误判成 JSX
 * （曾误伤 asyncGuard/utils 等纯逻辑文件）。
 *
 * 组件层（.jsx 批次）必须识别三类形态，缺一就会把组件判成纯逻辑：
 *   · 成员式标签：`<CanvasEdgesContext.Provider>`（旧正则的标签名不含点 → 漏判）
 *   · Fragment：`<>` / `</>`
 *   · 自闭合：`<Foo />`
 *
 * 已知残留误判面：正则字面量里的 HTML 形文本（如 `/[\\/:*?"<>|]/`）在字符串剥离后
 * 可能拼出伪标签。故 hasJsx 只用于【建议后缀】，最终以后 `convert --to` 可强制覆盖。
 */
/**
 * @param {string} code
 * @returns {boolean}
 */
function hasJsx(code) {
  const stripped = String(code)
    .replace(/(^|[^\w$])\/\*[\s\S]*?\*\//g, '$1') // 块注释
    .replace(/(^|[^\w$])\/\/[^\n]*/g, '$1') // 行注释
    .replace(/(^|[^\w$])'([^'\\]|\\.)*'/g, '$1') // 单引号串
    .replace(/(^|[^\w$])"([^"\\]|\\.)*"/g, '$1') // 双引号串
    .replace(/(^|[^\w$])`([^`\\]|\\.)*`/g, '$1'); // 模板串

  // 开标签/自闭合：`<` 的前一个字符限定为空白或 `({;,`（JSX 起始的真实上下文）。
  // 不用「非标识符字符」这种宽口径：字符串剥离会把正则字面量里的引号吃掉并拼出伪标签，
  // 例如 `/[\\/:*?"<>|]/`（文件名清洗）剥离后会留下 `…?<>`，被误判成 Fragment。
  const OPEN = /(^|[\s({;,])<([A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*)(\s[^<>]*)?\/?>/g;
  for (const m of stripped.matchAll(OPEN)) {
    if (isJsxTagName(m[2])) return true;
  }
  // 闭标签：`</div>` 常紧跟文本（前面是标识符字符），故不加前缀约束
  const CLOSE = /<\/([A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*)\s*>/g;
  for (const m of stripped.matchAll(CLOSE)) {
    if (isJsxTagName(m[1])) return true;
  }
  // Fragment：`<>` / `</>`（开标签同样限定前置字符，防正则字面量误判）
  if (/(^|[\s({;,])<\s*>/.test(stripped) || /<\/\s*>/.test(stripped)) return true;
  return false;
}

/**
 * 原始源码里是否存在 JSX 形文本（未剥离注释/字符串的粗判）。
 * 用途：hasJsx 的结论如果来自「剥离后的拼接产物」，原文里就不会有形如 `<Tag` / `<>` 的字样，
 * 此时判为「可疑」，交给人工确认（plan 会打标），避免机械脚本悄悄给文件定错后缀。
 */
/**
 * @param {string} code
 * @returns {boolean}
 */
function hasJsxHintRaw(code) {
  return /<\/?[A-Za-z][\w.-]*/.test(String(code)) || /<>/.test(String(code));
}

/**
 * 判定目标后缀：有 JSX → .tsx；纯逻辑 → .ts
 * @param {string} code
 * @returns {'.ts'|'.tsx'}
 */
function detectExt(code) {
  return hasJsx(code) ? '.tsx' : '.ts';
}

module.exports = {
  SOURCE_EXTS,
  TS_EXEMPT_DIRS,
  TS_EXEMPT_FILES,
  isExempt,
  resolveSourceFile,
  toPosix,
  HTML_TAGS,
  isJsxTagName,
  hasJsx,
  hasJsxHintRaw,
  detectExt,
};
