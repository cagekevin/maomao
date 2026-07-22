#!/usr/bin/env node
/**
 * App.js 函数摘要生成器 — 降低 4.4 万行单文件认知负担的核心工具
 *
 * 用法:
 *   node scripts/summarize.cjs <name> [name2 ...]           # 查看单个函数的摘要
 *   node scripts/summarize.cjs <name> --skeleton             # 查看函数 JSX 骨架（标签/按钮/事件）
 *   node scripts/summarize.cjs --nodes                       # 批量查看全部 27 个节点组件
 *   node scripts/summarize.cjs --shared                      # 查看全部共享瓶颈函数（入度 ≥ 3）
 *   node scripts/summarize.cjs --extractable                 # 查看可直接提取的函数（零 App.js 内部依赖）
 *   node scripts/summarize.cjs --nodes --md                  # 生成 Markdown 摘要文件
 *   node scripts/gen-summaries.cjs                           # 生成全部 122 个摘要文件到 docs/summaries/
 *
 * 使用场景:
 *   - 要改某个节点的 UI → <name> --skeleton 看 JSX 标签树和按钮文本
 *   - 要了解某个函数的功能 → <name> 看参数/回调/数据/依赖
 *   - 要评估能不能拆分 → --extractable 找零 App.js 依赖的函数
 *   - 要理解拆分的瓶颈 → --shared 看被高频依赖的共享函数
 *   - 需要静态参考文档 → --nodes --md + gen-summaries.cjs 生成 docs/summaries/
 *
 * 解决的问题:
 *   - 不用在 4.4 万行里 grep 盲搜：知道 eo 是 cropNode，L3691，参数是 id/data/selected
 *   - 不用通读 200 行代码才能理解功能：摘要显示回调/数据/hooks/依赖
 *   - 不用猜测能不能拆：入度 0 + 零 App.js 依赖 = 可直接提取
 *   - 不用手动串联依赖链：被依赖方一目了然
 *
 * 配套工具:
 *   scripts/dep-graph.cjs   — 全局依赖图（659 个模块级声明的关系矩阵）
 *   scripts/unlock.cjs      — 瓶颈分析（提取哪些共享函数能解锁最多节点）
 *   scripts/gen-summaries.cjs — 批量生成 Markdown 摘要文件
 *   (已合并到本脚本: --deps 替代 dep-graph.cjs, --unlock 替代 unlock.cjs)
 */
const acorn = require("acorn");
const jsx = require("acorn-jsx");
const fs = require("fs");

const JsxParser = acorn.Parser.extend(jsx());

const src = fs.readFileSync("src/App.js", "utf-8");

// ---- 1. Load readable name map from func-mapping.txt ----
const readableNames = {};
try {
  const mapping = fs.readFileSync("docs/func-mapping.txt", "utf-8");
  for (const line of mapping.split("\n")) {
    const m = line.match(/^(\w+)\s*=\s*(\w+)/);
    if (m) readableNames[m[1]] = m[2];
  }
} catch {}

// ---- 2. Load nodeType map from src/components/canvas/nodeTypes.js ----
const nodeTypeMap = {}; // componentVarName → nodeTypeName
try {
  const ntSrc = fs.readFileSync("src/components/canvas/nodeTypes.js", "utf-8");
  const bodyMatch = ntSrc.match(/return\s*\{([^}]+)\}/s);
  if (bodyMatch) {
    for (const m of bodyMatch[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) {
      nodeTypeMap[m[2]] = m[1];
    }
  }
} catch {}

// ---- 3. Parse App.js ----
const SKIP = new Set([
  "window","document","console","localStorage","sessionStorage","navigator","chrome",
  "fetch","setTimeout","clearTimeout","setInterval","clearInterval","alert","confirm",
  "requestAnimationFrame","cancelAnimationFrame","Date","Math","JSON","Error",
  "Number","String","Boolean","Array","Object","Map","Set","WeakMap","WeakSet",
  "Promise","Symbol","BigInt","RegExp","parseInt","parseFloat","isNaN","isFinite",
  "encodeURIComponent","decodeURIComponent","Image","Blob","File","FileReader","FormData",
  "URL","DOMParser","XMLSerializer","CustomEvent","Event","TextDecoder","TextEncoder",
  "Uint8Array","Uint8ClampedArray","Float32Array","ArrayBuffer","DataView",
  "HTMLCanvasElement","HTMLImageElement","HTMLVideoElement","HTMLAudioElement",
  "ImageData","CanvasRenderingContext2D","OffscreenCanvas","ResizeObserver",
  "MutationObserver","IntersectionObserver","AbortController","AbortSignal",
  "navigator","undefined","null","true","false","NaN","Infinity","arguments",
  "new","delete","typeof","void","instanceof","in","of","Intl","Proxy","Reflect",
]);

let ast;
try {
  ast = JsxParser.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
} catch (e) { console.error("Parse error:", e.message); process.exit(1); }

const moduleVars = new Map();
const importMap = new Map();

for (const node of ast.body) {
  if (node.type === "ImportDeclaration") {
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") importMap.set(spec.local.name, { source: node.source.value, imported: spec.imported?.name || spec.local.name });
    }
  }
  if (node.type === "FunctionDeclaration" && node.id) {
    moduleVars.set(node.id.name, { type: "fn", line: node.loc.start.line, endLine: node.loc.end.line, body: node.body, params: node.params, deps: new Set(), text: src.slice(node.start || 0, node.end || src.length).length });
  }
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier") {
        const hasFuncInit = decl.init && (decl.init.type === "ArrowFunctionExpression" || decl.init.type === "FunctionExpression");
        moduleVars.set(decl.id.name, {
          type: decl.kind === "const" ? "const" : "var",
          line: node.loc.start.line,
          endLine: node.loc.end.line,
          body: hasFuncInit ? decl.init.body : null,
          params: hasFuncInit ? decl.init.params : null,
          deps: new Set(),
          init: decl.init,
          text: src.slice(node.start || 0, node.end || src.length).length,
        });
      }
    }
  }
}

// ---- 4. Collect dependencies ----
function collectIdentifiers(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.type === "Identifier") {
    if (!SKIP.has(node.name) && !importMap.has(node.name)) set.add(node.name);
    return;
  }
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") return;
  for (const key of Object.keys(node)) {
    if (["start","end","loc","range","type","leadingComments","trailingComments","innerComments"].includes(key)) continue;
    const val = node[key];
    if (Array.isArray(val)) { for (const item of val) collectIdentifiers(item, set); }
    else if (val && typeof val === "object") collectIdentifiers(val, set);
  }
}
for (const [name, info] of moduleVars) {
  if (!info.body) continue;
  const refs = new Set();
  collectIdentifiers(info.body, refs);
  refs.delete(name);
  for (const r of refs) { if (moduleVars.has(r)) info.deps.add(r); }
}

// ---- 5. Compute in-degree ----
const inDegree = new Map();
for (const [name] of moduleVars) inDegree.set(name, 0);
for (const [, info] of moduleVars) { for (const d of info.deps) inDegree.set(d, (inDegree.get(d) || 0) + 1); }

// ---- 6. Inference helpers ----
function inferPurpose(info, code) {
  const clues = [];

  // Chinese text in JSX
  const cnTexts = [...code.matchAll(/>([\u4e00-\u9fff][\u4e00-\u9fff\s，。！？、；：""''（）《》\-+]+)/g)];
  if (cnTexts.length >= 2) clues.push("UI: " + cnTexts.slice(0, 4).map(m => m[1].trim()).join(" | "));

  // data fields accessed
  const dataFields = [...code.matchAll(/data\.(\w+)|n\.(\w+)|t\.(\w+)/g)].map(m => m[1] || m[2] || m[3]);
  const uniqFields = [...new Set(dataFields)].filter(f => f.length > 2 && !["type","id","label","selected","expanded","loading","hasChanged","width","height"].includes(f));
  if (uniqFields.length > 0) clues.push("数据: " + uniqFields.slice(0, 6).join(", "));

  // hooks
  const hooks = [...new Set(code.match(/useState|useEffect|useRef|useMemo|useCallback|useContext/g) || [])];
  if (hooks.length > 0) clues.push("hooks: " + hooks.join(", "));

  // callbacks
  const callbacks = [...code.matchAll(/n\.(on\w+)|data\.(on\w+)/g)].map(m => m[1] || m[2]);
  if (callbacks.length > 0) clues.push("回调: " + [...new Set(callbacks)].join(", "));

  // node output
  const outputFields = [...code.matchAll(/updateNodeData\([^,]+,\s*\{([^}]+)\}/g)].map(m => m[1]);
  if (outputFields.length > 0) {
    const fields = outputFields.flatMap(s => s.split(",").map(t => t.trim().split(":")[0].trim()).filter(Boolean));
    if (fields.length > 0) clues.push("输出: " + [...new Set(fields)].join(", "));
  }

  return clues.join("\n         ");
}

function readSource(start, end) {
  // Get source text between two offsets (approx, from AST)
  return src.slice(start, Math.min(end, src.length));
}

// ---- 7. Output skeleton (text-based JSX parsing) ----
function textSkeleton(src, startLine, endLine) {
  const lines = src.split("\n").slice(startLine - 1, endLine);
  const text = lines.join("\n");

  // Find the return statement — could be `return X.jsxs(` or `return (x, X.jsxs(`
  const returnMatch = text.match(/return\s*(?:\([^)]*\)\s*,)?\s*(X\.jsx[s]?\()/);
  if (!returnMatch) return ["  (未找到 JSX return)"];

  const out = [];
  // Extract unique X.jsx/X.jsxs tag calls (backtick strings)
  const jsxPattern = /X\.jsx[s]?\(`(\w+)`/g;
  let m;
  const tags = new Map(); // tag → { count, extras }
  while ((m = jsxPattern.exec(text)) !== null) {
    const tag = m[1];
    if (!tags.has(tag)) tags.set(tag, { count: 0, extras: new Set() });
    tags.get(tag).count++;
  }

  // Find Chinese text as children — match `children: \`text\`` and `children: [\`a\`, \`b\`]`
  const cnTextPattern = /children:\s*(?:\[[\s\S]*?\])?\s*`([^`]*[\u4e00-\u9fff][^`]*)`/g;
  const cnTextMatches = [...text.matchAll(cnTextPattern)];

  // Find onClick handlers
  const onClickLines = [...text.matchAll(/onClick:\s*\(?(\w+)?\s*=>\s*\{?[^}]*?(\w+\.(\w+))?/g)];
  const handlers = onClickLines.map(o => o[3] || "handler").filter(Boolean);

  // Build output
  out.push("组件 JSX 结构:");
  for (const [tag, info] of tags) {
    out.push(`  ├─ ${tag}${info.count > 1 ? ` ×${info.count}` : ""}`);
  }

  const allTexts = cnTextMatches.map(t => t[1]).filter(Boolean);
  if (allTexts.length > 0) {
    const unique = [...new Set(allTexts)];
    out.push(`  按钮/标签文本: ${unique.join(", ")}`);
  }

  if (handlers.length > 0) {
    out.push(`  事件处理: ${[...new Set(handlers)].join(", ")}`);
  }

  return out;
}

// Extract the first meaningful class portion from a className expression
function extractClass(node) {
  if (!node) return "";
  if (node.type === "Literal") return "." + String(node.value).split(" ").filter(Boolean).slice(0, 2).join(".");
  if (node.type === "TemplateLiteral") {
    const parts = node.quasis.map(q => q.value.cooked).filter(Boolean);
    const joined = parts.join("");
    return "." + joined.split(" ").filter(Boolean).slice(0, 2).join(".");
  }
  return "";
}

// Extract key info from an object property
function extractPropValue(val) {
  if (!val) return "";
  if (val.type === "Literal") return `"${String(val.value).slice(0, 20)}"`;
  if (val.type === "ArrowFunctionExpression") {
    // onXxx handler
    if (val.body?.type === "CallExpression") {
      const callee = val.body.callee;
      if (callee?.type === "MemberExpression") return "→" + (callee.property?.name || "?");
    }
    return "[fn]";
  }
  return "";
}

// Walk X.jsx("div", { ... children: [...] }) style AST
function walkXjsx(propsObj, indent) {
  const prefix = indent ? "│  ".repeat((indent.match(/│/g) || []).length) + "├─ " : "";
  let out = "";

  if (!propsObj || propsObj.type !== "ObjectExpression") return out;

  // Find className
  let cls = "";
  const children = [];
  let allTags = [];

  for (const prop of propsObj.properties) {
    if (!prop.key) continue;
    const key = prop.key.name || prop.key.value;
    if (key === "className") cls = extractClass(prop.value);
    if (key === "children") children.push(prop.value);
  }

  // Process children
  const childNodes = children.flatMap(c => {
    if (c.type === "ArrayExpression") return c.elements;
    return [c];
  });

  for (const child of childNodes) {
    if (!child) continue;

    // ConditionalExpression: cond ? a : b
    if (child.type === "ConditionalExpression") {
      const testText = genCondText(child.test);
      out += `${prefix}? ${testText}\n`;

      // Process consequent
      const consLabel = getXjsxLabel(child.consequent);
      if (consLabel.includes("button") || consLabel.includes("div") || consLabel.includes("input")) {
        out += `${indent}├─ ${consLabel}\n`;
        if (child.consequent.type === "CallExpression") walkXjsxChildren(child.consequent, indent + "│  ", out);

        // Extract key button text from consequent
        const btnText = findChildText(child.consequent);
        if (btnText) out += `${indent}│     \"${btnText}\"\n`;
      }

      // Process alternate
      const altLabel = getXjsxLabel(child.alternate);
      if (altLabel.includes("button") || altLabel.includes("div") || altLabel.includes("input")) {
        out += `${indent}: ${altLabel}\n`;
        if (child.alternate.type === "CallExpression") walkXjsxChildren(child.alternate, indent + "│  ", out);
        const btnText = findChildText(child.alternate);
        if (btnText) out += `${indent}│     \"${btnText}\"\n`;
      }
      continue;
    }

    // X.jsx / X.jsxs call
    if (child.type === "CallExpression") {
      const label = getXjsxLabel(child);
      out += `${prefix}${label}\n`;
      walkXjsxChildren(child, indent + "│  ", out);
    }
  }

  return out;
}

function genCondText(test) {
  if (!test) return "?";
  if (test.type === "Identifier") return test.name;
  if (test.type === "MemberExpression") {
    const obj = test.object?.name || test.object?.property?.name || "";
    const prop = test.property?.name || "";
    return obj && prop ? `${obj}.${prop}` : "?";
  }
  if (test.type === "BinaryExpression") return `${genCondText(test.left)} ${test.operator} ${genCondText(test.right)}`;
  if (test.type === "UnaryExpression" && test.operator === "!") return `!${genCondText(test.argument)}`;
  return "?";
}

function getXjsxLabel(call) {
  if (call.type !== "CallExpression") return "";
  const callee = call.callee;
  const tag = call.arguments?.[0]?.type === "Literal" ? call.arguments[0].value : "?";

  // Check if it's X.jsx / X.jsxs
  const isComponent = callee?.object?.name === "X" && ["jsx","jsxs"].includes(callee?.property?.name);
  if (!isComponent) return "";

  // Extract className from props
  const props = call.arguments?.[1];
  let cls = "";
  if (props?.type === "ObjectExpression") {
    for (const p of props.properties) {
      if (p.key?.name === "className") { cls = extractClass(p.value); break; }
    }
  }

  // Find onClick handler
  let onClick = "";
  if (props?.type === "ObjectExpression") {
    for (const p of props.properties) {
      if (p.key?.name === "onClick") {
        onClick = extractPropValue(p.value);
        break;
      }
    }
  }

  let label = tag + cls;
  if (onClick) label += ` ${onClick}`;
  return label;
}

// Recursively find X.jsx children and append to out array
function walkXjsxChildren(call, indent, outArr) {
  if (call.type !== "CallExpression") return;
  const props = call.arguments?.[1];
  if (props?.type !== "ObjectExpression") return;

  for (const prop of props.properties) {
    if (prop.key?.name !== "children" && prop.key?.value !== "children") continue;
    const children = prop.value.type === "ArrayExpression" ? prop.value.elements : [prop.value];
    for (const child of children) {
      if (!child) continue;
      if (child.type === "CallExpression") {
        const label = getXjsxLabel(child);
        if (label) {
          outArr.push(`${indent}├─ ${label}`);
          // Find Chinese text in children
          const text = findChildText(child);
          if (text) outArr.push(`${indent}│  \"${text}\"`);
          walkXjsxChildren(child, indent + "│  ", outArr);
        }
      }
    }
  }
}

// Find text content (Chinese/string) inside a X.jsx call
function findChildText(call) {
  if (call.type !== "CallExpression") return "";
  const props = call.arguments?.[1];
  if (props?.type !== "ObjectExpression") return "";
  for (const prop of props.properties) {
    if (prop.key?.name === "children" || prop.key?.value === "children") {
      const child = prop.value;
      if (child.type === "Literal" && typeof child.value === "string") return String(child.value).slice(0, 30);
      if (child.type === "ArrayExpression") {
        const texts = child.elements.filter(e => e?.type === "Literal" && typeof e.value === "string").map(e => e.value);
        if (texts.length) return texts.join("").slice(0, 30);
      }
    }
  }
  return "";
}

function walkJsxSkeleton(node, indent = "") {
  // For X.jsx/X.jsxs calls (the codebase style)
  if (node?.type === "CallExpression") {
    const props = node.arguments?.[1];
    if (props?.type === "ObjectExpression") {
      return walkXjsx(props, indent);
    }
  }
  // For actual JSX elements
  if (node?.type === "JSXElement") {
    const tag = node.openingElement.name.name;
    return `${tag}\n`;
  }
  return "";
}

function findReturnJsx(body) {
  if (!body) return null;
  const stmts = body.body || (Array.isArray(body) ? body : [body]);
  for (const stmt of stmts) {
    if (stmt.type === "ReturnStatement" && stmt.argument) {
      let arg = stmt.argument;
      // Unwrap SequenceExpression (comma operator): (a, X.jsxs(...))
      if (arg.type === "SequenceExpression") {
        arg = arg.expressions[arg.expressions.length - 1];
      }
      if (arg.type === "JSXElement" || arg.type === "JSXFragment") return arg;
      if (arg.type === "ConditionalExpression") {
        // ? : JSX
        if (arg.consequent?.type === "JSXElement") return arg.consequent;
        if (arg.alternate?.type === "JSXElement") return arg.alternate;
      }
      if (arg.type === "CallExpression") return arg;
    }
  }
  return null;
}

// ---- 8. Output skeleton mode ----
function skeleton(name, info) {
  const readable = readableNames[name] || "";
  const nodeType = nodeTypeMap[name] || "";
  const title = [readable, nodeType ? `[${nodeType}]` : ""].filter(Boolean).join(" ");

  console.log(`${name}${title ? ` — ${title}` : ""}  L${info.line}-${info.endLine || "?"}`);
  console.log("─".repeat(60));

  const result = textSkeleton(src, info.line, info.endLine || info.line + 50);
  for (const line of result) console.log(line);

  console.log("─".repeat(60));
}

// ---- 9. summarize/summarizeMd functions ----
function summarize(name, info) {
  const readable = readableNames[name] || "";
  const nodeType = nodeTypeMap[name] || "";
  const deg = inDegree.get(name) || 0;
  const code = readSource(info.body?.start || info.init?.start || 0, info.body?.end || info.init?.end || 0);
  const purpose = inferPurpose(info, code);

  const internalDeps = [...info.deps].filter(d => !importMap.has(d));
  const vendorDeps = [...info.deps].filter(d => importMap.has(d));
  const isExtractable = internalDeps.length === 0;
  const isShared = deg >= 3;
  const isNode = !!nodeType;

  const tag = isNode ? "🧩 节点" : isShared ? "🔗 共享" : isExtractable ? "✅ 可提取" : "⚠️ 有内依赖";
  const header = `${name}${readable ? ` (${readable})` : ""}${nodeType ? ` [${nodeType}]` : ""}`;

  console.log(`\n┌${"─".repeat(60)}`);
  console.log(`│ ${header}`);
  console.log(`│ L${String(info.line).padStart(5)}  类型=${info.type}  入度=${deg}  ${tag}`);
  console.log(`├${"─".repeat(60)}`);

  if (purpose) {
    for (const line of purpose.split("\n")) {
      console.log(`│ ${line}`);
    }
  }

  console.log(`├${"─".repeat(60)}`);
  if (internalDeps.length > 0) console.log(`│ 依赖 App.js: ${internalDeps.join(", ")}`);
  if (vendorDeps.length > 0) {
    const v = vendorDeps.map(d => {
      const imp = importMap.get(d);
      return imp.imported ? `${d}←${imp.imported}` : d;
    });
    console.log(`│ 依赖 vendor: ${v.slice(0, 10).join(", ")}${v.length > 10 ? " ..." : ""}`);
  }
  if (deg > 0) {
    const deps = [...moduleVars.entries()].filter(([, v]) => v.deps.has(name)).map(([n]) => n);
    console.log(`│ 被依赖: ${deps.slice(0, 8).join(", ")}${deps.length > 8 ? ` ...共${deps.length}` : ""}`);
  }

  // Props
  if (info.params && info.params.length > 0) {
    const props = [];
    for (const p of info.params) {
      if (p.type === "ObjectPattern") {
        for (const prop of p.properties) {
          const key = prop.key?.name || "";
          const val = prop.value?.name || key;
          props.push(key === val ? key : `${key}→${val}`);
        }
      }
      if (p.type === "Identifier") props.push(p.name);
    }
    if (props.length > 0) console.log(`│ 参数: ${props.slice(0, 8).join(", ")}${props.length > 8 ? ` ...共${props.length}` : ""}`);
  }

  console.log(`└${"─".repeat(60)}`);
}

// ---- 8. CLI ----
function summarizeMd(name, info) {
  const readable = readableNames[name] || "";
  const nodeType = nodeTypeMap[name] || "";
  const deg = inDegree.get(name) || 0;
  const code = readSource(info.body?.start || info.init?.start || 0, info.body?.end || info.init?.end || 0);
  const purpose = inferPurpose(info, code);
  const internalDeps = [...info.deps].filter(d => !importMap.has(d));
  const vendorDeps = [...info.deps].filter(d => importMap.has(d));
  const isExtractable = internalDeps.filter(d => !["Y","X","Un"].includes(d)).length === 0;
  const isShared = deg >= 3;

  const title = [
    readable,
    nodeType ? `\`${nodeType}\`` : "",
    isExtractable && !isShared ? "✅ 可提取" : "",
    isShared ? "🔗 共享函数" : "",
  ].filter(Boolean).join(" · ");

  console.log(`## ${name} — ${title}\n`);
  console.log(`| 属性 | 值 |`);
  console.log(`|------|----|`);
  console.log(`| 行号 | L${info.line} |`);
  console.log(`| 类型 | ${info.type} |`);
  console.log(`| 入度 | ${deg} |`);

  if (internalDeps.length > 0) {
    const list = internalDeps.map(d => INFRA_NAMES[d] ? `\`${d}\` (${INFRA_NAMES[d]})` : `\`${d}\``).join(", ");
    console.log(`| 依赖 | ${list} |`);
  }
  if (deg > 0) {
    const deps = [...moduleVars.entries()].filter(([, v]) => v.deps.has(name)).map(([n]) => {
      const rn = readableNames[n];
      return rn ? `\`${n}\`(${rn})` : `\`${n}\``;
    });
    console.log(`| 被依赖 | ${deps.slice(0, 6).join(", ")}${deps.length > 6 ? ` ...共${deps.length}` : ""} |`);
  }

  // Props
  if (info.params && info.params.length > 0) {
    const props = [];
    for (const p of info.params) {
      if (p.type === "ObjectPattern") {
        for (const prop of p.properties) {
          const key = prop.key?.name || "";
          const val = prop.value?.name || key;
          props.push(key === val ? `\`${key}\`` : `\`${key}\`→\`${val}\``);
        }
      }
      if (p.type === "Identifier") props.push(`\`${p.name}\``);
    }
    if (props.length > 0) console.log(`| 参数 | ${props.join(", ")} |`);
  }

  if (vendorDeps.length > 0) {
    const v = vendorDeps.slice(0, 12).map(d => `\`${d}\``).join(", ");
    console.log(`| vendor | ${v}${vendorDeps.length > 12 ? " ..." : ""} |`);
  }

  if (purpose) {
    console.log();
    const lines = purpose.split("\n").map(l => l.replace("│ ", "").trim()).filter(Boolean);
    for (const line of lines) {
      // Detect pattern: "UI: ...", "数据: ...", etc.
      if (line.includes(": ")) {
        const [label, ...rest] = line.split(": ");
        console.log(`- **${label}**: ${rest.join(": ")}`);
      } else {
        console.log(`- ${line}`);
      }
    }
  }
  console.log();
}

const args = process.argv.slice(2);
// Readable names for known App.js infrastructure vars
const INFRA_NAMES = { Y: "React", X: "JSX(createElement)", Un: "createPortal" };

const mdMode = args.includes("--md");
const skeletonMode = args.includes("--skeleton");
const depsMode = args.includes("--deps");
const unlockMode = args.includes("--unlock");
const filteredArgs = args.filter(a => !["--md", "--skeleton", "--deps", "--unlock"].includes(a));

// Handle special modes first
if (depsMode) {
  // inline dep-graph ...
  const sorted = [...moduleVars.entries()].sort((a, b) => a[1].line - b[1].line);
  console.log(`App.js 模块级依赖图 — ${moduleVars.size} 声明, ${importMap.size} import\n`);
  console.log("━".repeat(50) + "\n🔴 高被依赖（入度 ≥ 5）\n" + "━".repeat(50));
  for (const [n, i] of sorted) {
    const d = inDegree.get(n) || 0;
    if (d >= 5) console.log(`  ${n.padEnd(12)} L${String(i.line).padStart(5)}  入度=${d}`);
  }
  console.log("\n🟢 零入度（无其他函数依赖）");
  let cnt = 0;
  for (const [n, i] of sorted) {
    const d = inDegree.get(n) || 0;
    if (d === 0 && i.deps.size > 0 && cnt < 15) { cnt++; console.log(`  ${n.padEnd(12)} L${String(i.line).padStart(5)}`); }
  }
  console.log(`  ... 共 ${[...sorted].filter(([n,i]) => (inDegree.get(n)||0)===0 && i.deps.size>0).length} 个`);
  process.exit(0);
}

if (unlockMode) {
  const directDependents = new Map();
  for (const [n] of moduleVars) directDependents.set(n, new Set());
  for (const [n, i] of moduleVars) for (const d of i.deps) directDependents.get(d)?.add(n);
  const blockers = [...directDependents.entries()]
    .filter(([, deps]) => deps.size >= 2)
    .map(([n, deps]) => ({ name: n, line: moduleVars.get(n)?.line, blocks: deps.size, blockedBy: [...deps].slice(0,5).join(",") }))
    .sort((a, b) => b.blocks - a.blocks);
  console.log("瓶颈分析 — 共享函数按阻塞节点数排序\n" + "━".repeat(50));
  for (const b of blockers.slice(0, 15)) {
    console.log(`  ${b.name.padEnd(12)} L${String(b.line).padStart(5)}  阻塞=${b.blocks}个  被: ${b.blockedBy}`);
  }
  process.exit(0);
}

// Rebuild targets from filtered args
let targets = filteredArgs.length > 0 ? filteredArgs : [];

if (targets.length === 0 || targets.includes("--help") || targets.includes("-h")) {
  console.log("用法: node scripts/summarize.cjs <name> [name2 ...] [--skeleton] [--md]");
  console.log("      node scripts/summarize.cjs --deps           # 全局依赖图");
  console.log("      node scripts/summarize.cjs --unlock         # 瓶颈分析");
  console.log("      node scripts/summarize.cjs --nodes          # 仅节点组件");
  console.log("      node scripts/summarize.cjs --shared         # 仅共享函数（入度 ≥ 3）");
  console.log("      node scripts/summarize.cjs --extractable    # 可直接提取的");
  process.exit(0);
}

if (targets[0] === "--all") {
  targets = [...moduleVars.keys()].sort((a, b) => moduleVars.get(a).line - moduleVars.get(b).line);
}
if (targets[0] === "--nodes") {
  targets = Object.keys(nodeTypeMap).filter(n => moduleVars.has(n));
}
if (targets[0] === "--shared") {
  targets = [...moduleVars.keys()].filter(n => (inDegree.get(n) || 0) >= 3);
}
if (targets[0] === "--extractable") {
  const INFRA = new Set(["Y", "X", "Un"]);
  targets = [...moduleVars.keys()].filter(n => {
    const info = moduleVars.get(n);
    if (!info || info.deps.size === 0) return false;
    const realDeps = [...info.deps].filter(d => !importMap.has(d) && !INFRA.has(d));
    return realDeps.length === 0;
  });
}

// Output mode dispatch
if (mdMode) {
  console.log("# App.js 模块级函数摘要\n");
  console.log(`> 生成时间：${new Date().toISOString().slice(0, 19)}`);
  console.log(`> 总计 ${moduleVars.size} 个模块级声明\n`);
}

for (const name of targets) {
  const info = moduleVars.get(name);
  if (!info) {
    if (!mdMode) console.log(`\n⚠️  "${name}" 未找到`);
    continue;
  }
  if (skeletonMode) skeleton(name, info);
  else if (mdMode) summarizeMd(name, info);
  else summarize(name, info);
}
