#!/usr/bin/env node
/**
 * App.js 函数摘要生成器 — 降低 4.4 万行单文件认知负担的核心工具
 * 
 * 优化版: 修复 AST 骨架解析、抽离公共逻辑、提升健壮性与性能。
 */
const acorn = require("acorn");
const jsx = require("acorn-jsx");
const fs = require("fs");

const JsxParser = acorn.Parser.extend(jsx());
const SRC_PATH = "src/App.js";

if (!fs.existsSync(SRC_PATH)) {
  console.error(`❌ 未找到目标文件: ${SRC_PATH}`);
  process.exit(1);
}
const src = fs.readFileSync(SRC_PATH, "utf-8");

// ---- 1. 加载映射配置 (带有静默回退) ----
const readableNames = {};
try {
  const mapping = fs.readFileSync("docs/func-mapping.txt", "utf-8");
  for (const line of mapping.split("\n")) {
    const m = line.match(/^(\w+)\s*=\s*(\w+)/);
    if (m) readableNames[m[1]] = m[2];
  }
} catch (e) {
  // 仅在严格需要时可开启 console.warn
}

const nodeTypeMap = {}; // componentVarName → nodeTypeName
try {
  const ntSrc = fs.readFileSync("src/components/canvas/nodeTypes.js", "utf-8");
  const bodyMatch = ntSrc.match(/return\s*\{([^}]+)\}/s);
  if (bodyMatch) {
    for (const m of bodyMatch[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) {
      nodeTypeMap[m[2]] = m[1];
    }
  }
} catch (e) {}

// ---- 2. 解析 AST 树 ----
const SKIP_WORDS = [
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
  "undefined","null","true","false","NaN","Infinity","arguments",
  "new","delete","typeof","void","instanceof","in","of","Intl","Proxy","Reflect",
];
const SKIP = new Set(SKIP_WORDS);

let ast;
try {
  ast = JsxParser.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
} catch (e) { 
  console.error("❌ AST 解析失败:", e.message); 
  process.exit(1); 
}

const moduleVars = new Map();
const importMap = new Map();

// 收集模块级声明与 Import
for (const node of ast.body) {
  if (node.type === "ImportDeclaration") {
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier" || spec.type === "ImportDefaultSpecifier") {
        importMap.set(spec.local.name, { 
          source: node.source.value, 
          imported: spec.imported?.name || spec.local.name 
        });
      }
    }
  }
  
  if (node.type === "FunctionDeclaration" && node.id) {
    moduleVars.set(node.id.name, { 
      type: "fn", line: node.loc.start.line, endLine: node.loc.end.line, 
      body: node.body, params: node.params, deps: new Set(), 
      text: src.slice(node.start || 0, node.end || src.length).length 
    });
  }
  
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier") {
        const isFn = decl.init && ["ArrowFunctionExpression", "FunctionExpression"].includes(decl.init.type);
        moduleVars.set(decl.id.name, {
          type: decl.kind === "const" ? "const" : "var",
          line: node.loc.start.line, endLine: node.loc.end.line,
          body: isFn ? decl.init.body : null,
          params: isFn ? decl.init.params : null,
          deps: new Set(), init: decl.init,
          text: src.slice(node.start || 0, node.end || src.length).length,
        });
      }
    }
  }
}

// ---- 3. 依赖图谱收集 ----
function collectIdentifiers(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.type === "Identifier") {
    if (!SKIP.has(node.name) && !importMap.has(node.name)) set.add(node.name);
    return;
  }
  // 阻断内部函数的进一步作用域污染（可选，根据需要调整）
  if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) return;
  
  for (const key of Object.keys(node)) {
    if (["start","end","loc","range","type","leadingComments","trailingComments"].includes(key)) continue;
    const val = node[key];
    if (Array.isArray(val)) { for (const item of val) collectIdentifiers(item, set); }
    else if (val && typeof val === "object") collectIdentifiers(val, set);
  }
}

for (const [name, info] of moduleVars) {
  if (!info.body) continue;
  const refs = new Set();
  collectIdentifiers(info.body, refs);
  refs.delete(name); // 剔除自引用
  for (const r of refs) { 
    if (moduleVars.has(r)) info.deps.add(r); 
  }
}

const inDegree = new Map([...moduleVars.keys()].map(k => [k, 0]));
for (const info of moduleVars.values()) {
  for (const d of info.deps) {
    inDegree.set(d, (inDegree.get(d) || 0) + 1);
  }
}

// ---- 4. 辅助推断工具 ----
function inferPurpose(info, code) {
  const clues = [];
  const cnTexts = [...code.matchAll(/>([\u4e00-\u9fff][\u4e00-\u9fff\s，。！？、；：""''（）《》\-+]+)/g)];
  if (cnTexts.length >= 2) clues.push("UI: " + cnTexts.slice(0, 4).map(m => m[1].trim()).join(" | "));

  const dataFields = [...code.matchAll(/(?:data|n|t)\.(\w+)/g)].map(m => m[1]);
  const uniqFields = [...new Set(dataFields)].filter(f => f.length > 2 && !["type","id","label","selected","expanded","loading","hasChanged","width","height"].includes(f));
  if (uniqFields.length > 0) clues.push("数据: " + uniqFields.slice(0, 6).join(", "));

  const hooks = [...new Set(code.match(/use[A-Z]\w+/g) || [])];
  if (hooks.length > 0) clues.push("hooks: " + hooks.join(", "));

  const callbacks = [...code.matchAll(/(?:n|data)\.(on[A-Z]\w+)/g)].map(m => m[1]);
  if (callbacks.length > 0) clues.push("回调: " + [...new Set(callbacks)].join(", "));

  const outputFields = [...code.matchAll(/updateNodeData\([^,]+,\s*\{([^}]+)\}/g)].map(m => m[1]);
  if (outputFields.length > 0) {
    const fields = outputFields.flatMap(s => s.split(",").map(t => t.trim().split(":")[0].trim()).filter(Boolean));
    if (fields.length > 0) clues.push("输出: " + [...new Set(fields)].join(", "));
  }

  return clues.join("\n         ");
}

function readSource(start, end) {
  return src.slice(start, Math.min(end, src.length));
}

// ---- 5. 骨架提取 (优先 AST，降级文本) ----
function walkJsxSkeleton(node, indent = "") {
  if (node?.type === "CallExpression") {
    const props = node.arguments?.[1];
    if (props?.type === "ObjectExpression") return walkXjsx(props, indent);
  }
  if (node?.type === "JSXElement") return `${node.openingElement.name.name}\n`;
  return "";
}

// ---- 7. Output skeleton (text-based JSX parsing) ----
function textSkeleton(src, startLine, endLine) {
  const lines = src.split("\n").slice(startLine - 1, endLine);
  const text = lines.join("\n");

  const returnMatch = text.match(/return\s*(?:\([^)]*\)\s*,)?\s*(X\.jsx[s]?\()/);
  if (!returnMatch) return ["  (未找到 JSX return)"];

  const out = [];
  const jsxPattern = /X\.jsx[s]?\(`(\w+)`/g;
  let m;
  const tags = new Map();
  while ((m = jsxPattern.exec(text)) !== null) {
    const tag = m[1];
    if (!tags.has(tag)) tags.set(tag, { count: 0, extras: new Set() });
    tags.get(tag).count++;
  }

  const cnTextPattern = /children:\s*(?:\[[\s\S]*?\])?\s*`([^`]*[\u4e00-\u9fff][^`]*)`/g;
  const cnTextMatches = [...text.matchAll(cnTextPattern)];

  const onClickLines = [...text.matchAll(/onClick:\s*\(?(\w+)?\s*=>\s*\{?[^}]*?(\w+\.(\w+))?/g)];
  const handlers = onClickLines.map(o => o[3] || "handler").filter(Boolean);

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

function extractPropValue(val) {
  if (!val) return "";
  if (val.type === "Literal") return `"${String(val.value).slice(0, 20)}"`;
  if (val.type === "ArrowFunctionExpression") {
    if (val.body?.type === "CallExpression") {
      const callee = val.body.callee;
      if (callee?.type === "MemberExpression") return "→" + (callee.property?.name || "?");
    }
    return "[fn]";
  }
  return "";
}

function walkXjsx(propsObj, indent) {
  const prefix = indent ? "│  ".repeat((indent.match(/│/g) || []).length) + "├─ " : "";
  let out = "";

  if (!propsObj || propsObj.type !== "ObjectExpression") return out;

  let cls = "";
  const children = [];
  let allTags = [];

  for (const prop of propsObj.properties) {
    if (!prop.key) continue;
    const key = prop.key.name || prop.key.value;
    if (key === "className") cls = extractClass(prop.value);
    if (key === "children") children.push(prop.value);
  }

  const childNodes = children.flatMap(c => {
    if (c.type === "ArrayExpression") return c.elements;
    return [c];
  });

  for (const child of childNodes) {
    if (!child) continue;

    if (child.type === "ConditionalExpression") {
      const testText = genCondText(child.test);
      out += `${prefix}? ${testText}\n`;

      const consLabel = getXjsxLabel(child.consequent);
      if (consLabel.includes("button") || consLabel.includes("div") || consLabel.includes("input")) {
        out += `${indent}├─ ${consLabel}\n`;
        if (child.consequent.type === "CallExpression") walkXjsxChildren(child.consequent, indent + "│  ", out);

        const btnText = findChildText(child.consequent);
        if (btnText) out += `${indent}│     "${btnText}"\n`;
      }

      const altLabel = getXjsxLabel(child.alternate);
      if (altLabel.includes("button") || altLabel.includes("div") || altLabel.includes("input")) {
        out += `${indent}: ${altLabel}\n`;
        if (child.alternate.type === "CallExpression") walkXjsxChildren(child.alternate, indent + "│  ", out);
        const btnText = findChildText(child.alternate);
        if (btnText) out += `${indent}│     "${btnText}"\n`;
      }
      continue;
    }

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

  const isComponent = callee?.object?.name === "X" && ["jsx","jsxs"].includes(callee?.property?.name);
  if (!isComponent) return "";

  let cls = "";
  const props = call.arguments?.[1];
  if (props?.type === "ObjectExpression") {
    for (const p of props.properties) {
      if (p.key?.name === "className") { cls = extractClass(p.value); break; }
    }
  }

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
          const text = findChildText(child);
          if (text) outArr.push(`${indent}│  "${text}"`);
          walkXjsxChildren(child, indent + "│  ", outArr);
        }
      }
    }
  }
}

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

function skeleton(name, info) {
  const readable = readableNames[name] || "";
  const nodeType = nodeTypeMap[name] || "";
  const title = [readable, nodeType ? `[${nodeType}]` : ""].filter(Boolean).join(" ");

  console.log(`${name}${title ? ` — ${title}` : ""}  L${info.line}-${info.endLine || "?"}`);
  console.log("─".repeat(60));

  // 尝试从 AST 推导 (修复原版中被抛弃的 AST 逻辑)
  let foundAstJsx = false;
  if (info.body) {
    const returnStmt = (Array.isArray(info.body.body) ? info.body.body : [info.body]).find(s => s.type === "ReturnStatement");
    let target = returnStmt?.argument;
    if (target?.type === "SequenceExpression") target = target.expressions[target.expressions.length - 1];
    
    if (target && (target.type === "JSXElement" || target.type === "CallExpression")) {
      const tree = walkJsxSkeleton(target, "");
      if (tree) {
        console.log("组件 JSX 结构 (AST 解析):");
        console.log(tree.split("\n").filter(Boolean).map(l => `  ${l}`).join("\n"));
        foundAstJsx = true;
      }
    }
  }

  // 降级使用纯文本正则扫描兜底（富结构版）
  if (!foundAstJsx) {
    const result = textSkeleton(src, info.line, info.endLine || info.line + 50);
    console.log("组件 JSX 结构 (文本扫描):");
    for (const line of result) console.log(line);
  }
  console.log("─".repeat(60));
}

// ---- 6. 统一提取数据结构 ----
function getSummaryData(name, info) {
  const code = readSource(info.body?.start || info.init?.start || 0, info.body?.end || info.init?.end || 0);
  const internalDeps = [...info.deps].filter(d => !importMap.has(d));
  const vendorDeps = [...info.deps].filter(d => importMap.has(d));
  
  const deg = inDegree.get(name) || 0;
  const isExtractable = internalDeps.filter(d => !["Y","X","Un"].includes(d)).length === 0;
  const isShared = deg >= 3;
  const isNode = !!nodeTypeMap[name];

  const props = (info.params || []).map(p => {
    if (p.type === "Identifier") return p.name;
    if (p.type === "ObjectPattern") return p.properties.map(pr => pr.key?.name === pr.value?.name ? pr.key?.name : `${pr.key?.name}→${pr.value?.name}`).join(", ");
    return "?";
  }).filter(Boolean);

  const reverseDeps = [...moduleVars.entries()].filter(([, v]) => v.deps.has(name)).map(([n]) => n);

  return {
    readable: readableNames[name] || "",
    nodeType: nodeTypeMap[name] || "",
    deg, isExtractable, isShared, isNode,
    purpose: inferPurpose(info, code),
    internalDeps, vendorDeps, reverseDeps, props
  };
}

function summarize(name, info) {
  const d = getSummaryData(name, info);
  const tag = d.isNode ? "🧩 节点" : d.isShared ? "🔗 共享" : d.isExtractable ? "✅ 可提取" : "⚠️ 有内依赖";
  
  console.log(`\n┌${"─".repeat(60)}`);
  console.log(`│ ${name}${d.readable ? ` (${d.readable})` : ""}${d.nodeType ? ` [${d.nodeType}]` : ""}`);
  console.log(`│ L${String(info.line).padStart(5)}  类型=${info.type}  入度=${d.deg}  ${tag}`);
  console.log(`├${"─".repeat(60)}`);
  
  if (d.purpose) d.purpose.split("\n").forEach(line => console.log(`│ ${line}`));
  console.log(`├${"─".repeat(60)}`);
  
  if (d.internalDeps.length > 0) console.log(`│ 依赖 App.js: ${d.internalDeps.join(", ")}`);
  if (d.vendorDeps.length > 0) console.log(`│ 依赖 vendor: ${d.vendorDeps.slice(0, 10).join(", ")}${d.vendorDeps.length > 10 ? " ..." : ""}`);
  if (d.reverseDeps.length > 0) console.log(`│ 被依赖: ${d.reverseDeps.slice(0, 8).join(", ")}${d.reverseDeps.length > 8 ? ` ...共${d.reverseDeps.length}` : ""}`);
  if (d.props.length > 0) console.log(`│ 参数: ${d.props.slice(0, 8).join(", ")}`);
  console.log(`└${"─".repeat(60)}`);
}

function summarizeMd(name, info) {
  const d = getSummaryData(name, info);
  const title = [
    d.readable, d.nodeType ? `\`${d.nodeType}\`` : "",
    d.isExtractable && !d.isShared ? "✅ 可提取" : "",
    d.isShared ? "🔗 共享函数" : ""
  ].filter(Boolean).join(" · ");

  console.log(`## ${name} — ${title}\n`);
  console.log(`| 属性 | 值 |\n|------|----|\n| 行号 | L${info.line} |\n| 类型 | ${info.type} |\n| 入度 | ${d.deg} |`);
  
  if (d.internalDeps.length > 0) console.log(`| 依赖 | ${d.internalDeps.map(dep => `\`${dep}\``).join(", ")} |`);
  if (d.reverseDeps.length > 0) console.log(`| 被依赖 | ${d.reverseDeps.slice(0, 6).map(dep => `\`${dep}\``).join(", ")}${d.reverseDeps.length > 6 ? ` ...共${d.reverseDeps.length}` : ""} |`);
  if (d.props.length > 0) console.log(`| 参数 | ${d.props.map(p => `\`${p}\``).join(", ")} |`);
  if (d.vendorDeps.length > 0) console.log(`| vendor | ${d.vendorDeps.slice(0, 12).map(dep => `\`${dep}\``).join(", ")}${d.vendorDeps.length > 12 ? " ..." : ""} |`);

  if (d.purpose) {
    console.log();
    d.purpose.split("\n").map(l => l.replace("│ ", "").trim()).filter(Boolean).forEach(line => {
      const parts = line.split(": ");
      console.log(parts.length > 1 ? `- **${parts[0]}**: ${parts.slice(1).join(": ")}` : `- ${line}`);
    });
  }
  console.log();
}

// ---- 7. CLI 参数路由 ----
const args = process.argv.slice(2);
const mdMode = args.includes("--md");
const skeletonMode = args.includes("--skeleton");
const targets = [];

// 全局模式处理
if (args.includes("--deps")) {
  const sorted = [...moduleVars.entries()].sort((a, b) => a[1].line - b[1].line);
  console.log(`App.js 模块级依赖图 — ${moduleVars.size} 声明, ${importMap.size} import\n`);
  console.log("━".repeat(50) + "\n🔴 高被依赖（入度 ≥ 5）\n" + "━".repeat(50));
  sorted.filter(([n]) => inDegree.get(n) >= 5).forEach(([n, i]) => console.log(`  ${n.padEnd(12)} L${String(i.line).padStart(5)}  入度=${inDegree.get(n)}`));
  console.log("\n🟢 零入度（无其他函数依赖）");
  sorted.filter(([n, i]) => inDegree.get(n) === 0 && i.deps.size > 0).slice(0, 15).forEach(([n, i]) => console.log(`  ${n.padEnd(12)} L${String(i.line).padStart(5)}`));
  process.exit(0);
}

if (args.includes("--unlock")) {
  const directDependents = new Map([...moduleVars.keys()].map(k => [k, new Set()]));
  for (const [n, i] of moduleVars) for (const d of i.deps) directDependents.get(d)?.add(n);
  
  const blockers = [...directDependents.entries()]
    .filter(([, deps]) => deps.size >= 2)
    .map(([n, deps]) => ({ name: n, line: moduleVars.get(n)?.line, blocks: deps.size, blockedBy: [...deps].slice(0,5).join(",") }))
    .sort((a, b) => b.blocks - a.blocks);
    
  console.log("瓶颈分析 — 共享函数按阻塞节点数排序\n" + "━".repeat(50));
  blockers.slice(0, 15).forEach(b => console.log(`  ${b.name.padEnd(12)} L${String(b.line).padStart(5)}  阻塞=${b.blocks}个  被: ${b.blockedBy}`));
  process.exit(0);
}

// 目标过滤处理
const positionalArgs = args.filter(a => !a.startsWith("--"));
if (args.includes("--nodes")) {
  targets.push(...Object.keys(nodeTypeMap).filter(n => moduleVars.has(n)));
} else if (args.includes("--shared")) {
  targets.push(...[...moduleVars.keys()].filter(n => (inDegree.get(n) || 0) >= 3));
} else if (args.includes("--extractable")) {
  const INFRA = new Set(["Y", "X", "Un"]);
  targets.push(...[...moduleVars.keys()].filter(n => {
    const info = moduleVars.get(n);
    return info && info.deps.size > 0 && [...info.deps].every(d => importMap.has(d) || INFRA.has(d));
  }));
} else if (args.includes("--all")) {
  targets.push(...[...moduleVars.keys()].sort((a, b) => moduleVars.get(a).line - moduleVars.get(b).line));
} else if (positionalArgs.length > 0) {
  targets.push(...positionalArgs);
}

if (targets.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`
用法: 
  node scripts/summarize.cjs <name> [name2 ...] [--skeleton] [--md]
  node scripts/summarize.cjs --deps           # 全局依赖图
  node scripts/summarize.cjs --unlock         # 瓶颈分析
  node scripts/summarize.cjs --nodes          # 仅节点组件
  node scripts/summarize.cjs --shared         # 仅共享函数（入度 ≥ 3）
  node scripts/summarize.cjs --extractable    # 可直接提取的
`);
  process.exit(0);
}

// 执行输出
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