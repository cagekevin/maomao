#!/usr/bin/env node
// App.js 批量注释器 — 为模块级函数添加中文说明，带置信度分级
// 用法:
//   node scripts/annotate.cjs --run       # 实际写入（默认 dry-run）
//   node scripts/annotate.cjs --dry       # 预览模式，只打印将要添加的注释
//   node scripts/annotate.cjs --limit 10  # 只处理前 10 个函数
//   node scripts/annotate.cjs --list      # 列出所有待注释函数
//   node scripts/annotate.cjs --restore   # 恢复备份 src/App.js.bak
//
// 注释格式:
//   // [✔ 已确认] 可读名 — 一句话说明
//   // [🤖 AI推断] 基于代码模式推断 — 说明
//   // [⚠️ 待确认] 未知函数 — @ai-check: 需人工或 AI 复核确认
const acorn = require("acorn");
const jsx = require("acorn-jsx");
const fs = require("fs");

const JsxParser = acorn.Parser.extend(jsx());
const SRC = "src/App.js";
const src = fs.readFileSync(SRC, "utf-8");

// --- 1. 加载可读名映射（func-mapping.txt + var-mapping.txt）---
const allNames = {};
function loadMapping(file) {
  try {
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      // 格式: 混淆名 = 可读名 # 说明 或 混淆名 = 可读名（说明）
      const m = line.match(/^(\w+)\s*=\s*(\w[\w ]+?)(?:\s*#|$)/);
      if (m) allNames[m[1]] = m[2].trim();
    }
  } catch {}
}
loadMapping("docs/func-mapping.txt");
loadMapping("docs/var-mapping.txt");

// --- 2. 加载 nodeType 映射 ---
const nodeTypeMap = {};
try {
  const ntSrc = fs.readFileSync("src/components/canvas/nodeTypes.js", "utf-8");
  const body = ntSrc.match(/return\s*\{([^}]+)\}/s);
  if (body) for (const m of body[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) nodeTypeMap[m[2]] = m[1];
} catch {}

// --- 3. 解析 App.js ---
const SKIP = new Set([
  "window","document","console","localStorage","sessionStorage","navigator","chrome",
  "fetch","setTimeout","clearTimeout","setInterval","clearInterval","alert","confirm",
  "requestAnimationFrame","cancelAnimationFrame","Date","Math","JSON","Error",
  "Number","String","Boolean","Array","Object","Map","Set","WeakMap","WeakSet",
  "Promise","Symbol","BigInt","RegExp","parseInt","parseFloat","isNaN","isFinite",
  "encodeURIComponent","decodeURIComponent","Image","Blob","File","FileReader","FormData",
  "URL","DOMParser","XMLSerializer","CustomEvent","Event","TextDecoder","TextEncoder",
  "Uint8Array","Float32Array","ArrayBuffer","DataView","undefined","null","true","false","NaN","Infinity",
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
    moduleVars.set(node.id.name, { type: "fn", line: node.loc.start.line, endLine: node.loc.end.line, body: node.body, params: node.params, text: src.slice(node.start || 0, node.end || src.length) });
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
          init: decl.init,
          text: src.slice(node.start || 0, node.end || src.length)
        });
      }
    }
  }
}

// --- 4. 推断函数用途 ---
function infer(funcName, info) {
  const code = info.text;
  const cnTexts = [...code.matchAll(/>([\u4e00-\u9fff][\u4e00-\u9fff\s，。！？、；：""''（）《》\-+]+)/g)];
  const hasCn = cnTexts.length >= 2;
  const name = allNames[funcName];
  const nodeType = nodeTypeMap[info.name];

  // Level 1: 从 func-mapping / var-mapping 有明确可读名
  if (name) {
    const extra = nodeType ? ` [${nodeType}]` : "";
    return { confidence: "✔ 已确认", desc: `${name}${extra}` };
  }

  // Level 2: 有节点类型但无可读名
  if (nodeType) {
    return { confidence: "🤖 AI推断", desc: `节点组件: ${nodeType}` };
  }

  // Level 3: 有中文文案
  if (hasCn) {
    const texts = cnTexts.slice(0, 3).map(m => m[1].trim().slice(0, 20));
    return { confidence: "🤖 AI推断", desc: `UI 组件 — 文案: ${texts.join(" / ")}` };
  }

  // Level 4: 零信息
  const hooks = [...new Set(code.match(/useState|useEffect|useRef|useMemo|useCallback/g) || [])];
  if (hooks.length) return { confidence: "⚠️ 待确认", desc: `React Hook 组件 (${hooks.join(", ")}) — @ai-check: 未知用途，需复核` };
  return null; // skip tiny non-function declarations
}

// --- 5. 主逻辑 ---
const lines = src.split("\n");
const args = process.argv.slice(2);
const isDry = args.includes("--dry");
const isRun = args.includes("--run");
const isList = args.includes("--list");
const isRestore = args.includes("--restore");
const isForce = args.includes("--force");
const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || args[args.indexOf("--limit") + 1] || "0");

if (isRestore) {
  if (fs.existsSync(`${SRC}.bak`)) { fs.copyFileSync(`${SRC}.bak`, SRC); console.log("✅ 已恢复备份"); }
  else console.log("⚠️ 必须 --run 后再 --restore");
  process.exit(0);
}

// --force: 先写入清理后的文件，然后重新读取和解析
if (isForce) {
  const pattern = /^\/\/ \[(✔ 已确认|🤖 AI推断|⚠️ 待确认)\]/;
  const kept = lines.filter(l => !pattern.test(l));
  const removed = lines.length - kept.length;
  if (removed > 0) {
    fs.writeFileSync(SRC, kept.join("\n"));
    console.log(`🧹 已清除 ${removed} 条旧注释，重新解析...`);
    // 重新读取和解析
    process.argv = process.argv.filter(a => a !== "--force"); // 防止死循环
    // 直接用 execSync 重新跑自己，带 --run
    const { execSync } = require("child_process");
    const restArgs = process.argv.slice(2).join(" ");
    execSync(`node scripts/annotate.cjs ${restArgs}`, { stdio: "inherit" });
    process.exit(0);
  } else {
    console.log(`🧹 没有旧注释需要清除`);
  }
}

// 收集待注释的函数（筛选：有推断结果 + 不在已注释后面）
const targets = [];
for (const [name, info] of moduleVars) {
  const result = infer(name, info);
  if (!result) continue;
  // 检查前面是否已有同类注释（非 force 模式跳过）
  if (!isForce) {
    const prevLine = lines[info.line - 2] || "";
    if (prevLine.includes("@ai-check") || prevLine.includes("已确认") || prevLine.includes("AI推断") || prevLine.includes("待确认")) continue;
  }
  targets.push({ name, line: info.line, info, result });
}

targets.sort((a, b) => a.line - b.line);

if (isList) {
  for (const t of targets) {
    console.log(`L${String(t.line).padStart(5)}  [${t.result.confidence}]  ${t.name.padEnd(20)}  ${t.result.desc}`);
  }
  console.log(`\n共 ${targets.length} 个待注释函数 (${targets.filter(t=>t.result.confidence.includes("✔")).length} 已确认 / ${targets.filter(t=>t.result.confidence.includes("🤖")).length} AI推断 / ${targets.filter(t=>t.result.confidence.includes("⚠️")).length} 待确认)`);
  process.exit(0);
}

// 应用限制
const toAnnotate = limit > 0 ? targets.slice(0, limit) : targets;

if (isDry) {
  console.log(`[DRY RUN] 将添加 ${toAnnotate.length} 条注释:\n`);
  for (const t of toAnnotate.slice(0, 20)) {
    console.log(`  L${t.line - 1}: // [${t.result.confidence}] ${t.name} — ${t.result.desc}`);
  }
  if (toAnnotate.length > 20) console.log(`  ... 还有 ${toAnnotate.length - 20} 条`);
  process.exit(0);
}

if (!isRun) {
  console.log("⚠️  默认 dry-run 模式。执行写入请加 --run");
  console.log("    node scripts/annotate.cjs --run");
  console.log("    node scripts/annotate.cjs --run --limit 10     # 只加 10 条");
  console.log("    node scripts/annotate.cjs --run --force         # 清除旧注释，重新跑");
  console.log("    node scripts/annotate.cjs --list                # 列出全部");
  console.log("    node scripts/annotate.cjs --restore             # 恢复备份 (App.js.bak)");
  process.exit(0);
}

// --- 实际写入 ---
fs.copyFileSync(SRC, `${SRC}.bak`);
console.log(`📦 备份已保存: ${SRC}.bak`);

// 从后往前插入，避免行号偏移
for (const t of toAnnotate.reverse()) {
  const insertLine = t.line - 1; // 0-based index
  const comment = `// [${t.result.confidence}] ${t.name} — ${t.result.desc}`;
  lines.splice(insertLine, 0, comment);
}

fs.writeFileSync(SRC, lines.join("\n"));
console.log(`✅ 已添加 ${toAnnotate.length} 条注释`);
const stats = { conf: toAnnotate.filter(t=>t.result.confidence.includes("✔")).length, ai: toAnnotate.filter(t=>t.result.confidence.includes("🤖")).length, unk: toAnnotate.filter(t=>t.result.confidence.includes("⚠️")).length };
console.log(`   ✔ 已确认: ${stats.conf}  🤖 AI推断: ${stats.ai}  ⚠️ 待确认: ${stats.unk}`);
console.log(`   npm run build 验证通过后，用 --restore 可回滚`);
