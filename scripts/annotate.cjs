#!/usr/bin/env node
/**
 * App.js 批量注释器 — 为模块级函数添加中文说明，带置信度分级
 * 
 * 优化版: 修复推断 Bug、移除子进程调用、内存级快速 --force 清理。
 */
const acorn = require("acorn");
const jsx = require("acorn-jsx");
const fs = require("fs");

const JsxParser = acorn.Parser.extend(jsx());
const SRC = "src/App.js";

// --- 0. 参数解析与前置校验 ---
const args = process.argv.slice(2);
const isDry = args.includes("--dry");
const isRun = args.includes("--run");
const isList = args.includes("--list");
const isRestore = args.includes("--restore");
const isForce = args.includes("--force");

const limitArg = args.find(a => a.startsWith("--limit="));
const limitIdx = args.indexOf("--limit");
const limit = parseInt(limitArg ? limitArg.split("=")[1] : (limitIdx !== -1 ? args[limitIdx + 1] : "0")) || 0;

if (isRestore) {
  if (fs.existsSync(`${SRC}.bak`)) {
    fs.copyFileSync(`${SRC}.bak`, SRC);
    console.log("✅ 已恢复备份 (src/App.js.bak -> src/App.js)");
  } else {
    console.log("⚠️ 无法恢复：未找到备份文件，必须 --run 后再 --restore");
  }
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.error(`❌ 未找到目标文件: ${SRC}`);
  process.exit(1);
}

let src = fs.readFileSync(SRC, "utf-8");
let lines = src.split("\n");

// --- 1. 处理 --force: 在内存中清除旧注释 ---
if (isForce) {
  const pattern = /^\/\/ \[(✔ 已确认|🤖 AI推断|⚠️ 待确认)\]/;
  const kept = lines.filter(l => !pattern.test(l.trim()));
  const removed = lines.length - kept.length;
  
  if (removed > 0) {
    console.log(`🧹 已在内存中清除 ${removed} 条旧注释，开始重新解析...`);
    lines = kept;
    src = lines.join("\n"); // 更新源代码字符串，确保 AST 行号与清理后的代码对齐
  } else {
    console.log(`🧹 没有旧注释需要清除...`);
  }
}

// --- 2. 加载字典映射 ---
const allNames = {};
function loadMapping(file) {
  try {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
      const m = line.match(/^(\w+)\s*=\s*(\w[\w ]+?)(?:\s*#|$)/);
      if (m) allNames[m[1]] = m[2].trim();
    }
  } catch {}
}
loadMapping("docs/func-mapping.txt");
loadMapping("docs/var-mapping.txt");

const nodeTypeMap = {};
try {
  const ntPath = "src/components/canvas/nodeTypes.js";
  if (fs.existsSync(ntPath)) {
    const ntSrc = fs.readFileSync(ntPath, "utf-8");
    const body = ntSrc.match(/return\s*\{([^}]+)\}/s);
    if (body) {
      for (const m of body[1].matchAll(/(\w+)\s*:\s*(\w+)/g)) nodeTypeMap[m[2]] = m[1];
    }
  }
} catch {}

// --- 3. 解析 AST 语法树 ---
let ast;
try {
  ast = JsxParser.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
} catch (e) {
  console.error("❌ AST 解析失败:", e.message);
  process.exit(1);
}

const moduleVars = new Map();

for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id) {
    moduleVars.set(node.id.name, {
      type: "fn", line: node.loc.start.line, endLine: node.loc.end.line,
      text: src.slice(node.start || 0, node.end || src.length)
    });
  }
  
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier") {
        moduleVars.set(decl.id.name, {
          type: decl.kind === "const" ? "const" : "var",
          line: node.loc.start.line, endLine: node.loc.end.line,
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
  const nodeType = nodeTypeMap[funcName]; // [修复] 修正了原版 nodeTypeMap[info.name] 的 Bug

  if (name) {
    const extra = nodeType ? ` [${nodeType}]` : "";
    return { confidence: "✔ 已确认", desc: `${name}${extra}` };
  }

  if (nodeType) {
    return { confidence: "🤖 AI推断", desc: `节点组件: ${nodeType}` };
  }

  if (hasCn) {
    const texts = cnTexts.slice(0, 3).map(m => m[1].trim().slice(0, 20));
    return { confidence: "🤖 AI推断", desc: `UI 组件 — 文案: ${texts.join(" / ")}` };
  }

  const hooks = [...new Set(code.match(/useState|useEffect|useRef|useMemo|useCallback/g) || [])];
  if (hooks.length) {
    return { confidence: "⚠️ 待确认", desc: `React Hook 组件 (${hooks.join(", ")}) — @ai-check: 未知用途，需复核` };
  }
  
  return null;
}

// --- 5. 组装待注释目标 ---
const targets = [];
for (const [name, info] of moduleVars) {
  const result = infer(name, info);
  if (!result) continue;
  
  if (!isForce) {
    const prevLine = lines[info.line - 2] || "";
    if (/(已确认|AI推断|待确认|@ai-check)/.test(prevLine)) continue;
  }
  
  targets.push({ name, line: info.line, info, result });
}

targets.sort((a, b) => a.line - b.line);

// --- 6. 执行功能分支 ---
if (isList) {
  targets.forEach(t => console.log(`L${String(t.line).padStart(5)}  [${t.result.confidence}]  ${t.name.padEnd(20)}  ${t.result.desc}`));
  
  const conf = targets.filter(t => t.result.confidence.includes("✔")).length;
  const ai = targets.filter(t => t.result.confidence.includes("🤖")).length;
  const unk = targets.filter(t => t.result.confidence.includes("⚠️")).length;
  
  console.log(`\n共 ${targets.length} 个待注释函数 (${conf} 已确认 / ${ai} AI推断 / ${unk} 待确认)`);
  process.exit(0);
}

const toAnnotate = limit > 0 ? targets.slice(0, limit) : targets;

if (isDry) {
  console.log(`[DRY RUN] 预览将添加的 ${toAnnotate.length} 条注释:\n`);
  toAnnotate.slice(0, 20).forEach(t => console.log(`  L${t.line - 1}: // [${t.result.confidence}] ${t.name} — ${t.result.desc}`));
  if (toAnnotate.length > 20) console.log(`  ... 还有 ${toAnnotate.length - 20} 条`);
  process.exit(0);
}

if (!isRun) {
  console.log(`
⚠️  默认 dry-run 模式。执行写入请加 --run
    node scripts/annotate.cjs --run
    node scripts/annotate.cjs --run --limit 10      # 只加 10 条
    node scripts/annotate.cjs --run --force         # 清除旧注释并重新生成
    node scripts/annotate.cjs --list                # 列出全部待注释对象
    node scripts/annotate.cjs --restore             # 恢复备份 (App.js.bak)
  `);
  process.exit(0);
}

// --- 7. 实际写入 ---
// 如果使用 --force 清理了旧代码，此时备份的是清理前的原版。
fs.copyFileSync(SRC, `${SRC}.bak`);
console.log(`📦 备份已保存: ${SRC}.bak`);

// 必须从后往前插入（倒序），以避免行号偏移
for (const t of toAnnotate.reverse()) {
  const insertIndex = t.line - 1; // AST 提供的是 1-based 行号，数组是 0-based
  const comment = `// [${t.result.confidence}] ${t.name} — ${t.result.desc}`;
  lines.splice(insertIndex, 0, comment);
}

fs.writeFileSync(SRC, lines.join("\n"));
console.log(`✅ 已成功写入 ${toAnnotate.length} 条注释`);

const stats = {
  conf: toAnnotate.filter(t => t.result.confidence.includes("✔")).length,
  ai: toAnnotate.filter(t => t.result.confidence.includes("🤖")).length,
  unk: toAnnotate.filter(t => t.result.confidence.includes("⚠️")).length
};
console.log(`   ✔ 已确认: ${stats.conf}  🤖 AI推断: ${stats.ai}  ⚠️ 待确认: ${stats.unk}`);
console.log(`   提示: npm run build 验证通过后即可提交；若存在问题，用 --restore 可回滚代码`);