#!/usr/bin/env node
/**
 * App.js 模块级依赖图生成器 v2
 * 用法：node scripts/dep-graph.cjs
 */
const acorn = require("acorn");
const fs = require("fs");

const src = fs.readFileSync("src/App.js", "utf-8");

// Browser globals and builtins to skip
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
  "Intl","Proxy","Reflect","Worker","SharedWorker","MessageChannel",
  "navigator","undefined","null","true","false","NaN","Infinity",
]);

let ast;
try {
  ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
} catch (e) {
  console.error("Parse error:", e.message);
  process.exit(1);
}

const moduleVars = new Map();   // name → { type, line, refs: Set }
const importMap = new Map();    // localName → { source }

// Step 1: imports
for (const node of ast.body) {
  if (node.type === "ImportDeclaration") {
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") {
        importMap.set(spec.local.name, { source: node.source.value });
      }
    }
  }
}

// Step 2: module-level declarations
for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id) {
    moduleVars.set(node.id.name, { type: "fn", line: node.loc.start.line, refs: new Set() });
  }
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier") {
        moduleVars.set(decl.id.name, { type: "var", line: node.loc.start.line, refs: new Set() });
      }
    }
  }
}

// Step 3: collect references — simple recursive walk, no scope tracking
// Strategy: for each module-level function, walk its entire AST and record
// any Identifier that matches a moduleVar name (but not itself, not imports, not globals)

function collectIdentifiers(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.type === "Identifier") {
    if (!SKIP.has(node.name) && !importMap.has(node.name)) {
      set.add(node.name);
    }
    return;
  }
  // Don't enter nested function declarations (they define new scope)
  if (node.type === "FunctionDeclaration" || 
      node.type === "FunctionExpression" || 
      node.type === "ArrowFunctionExpression") {
    // Only walk params (optional, skip for simplicity)
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range" || key === "type") continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) collectIdentifiers(item, set);
    } else if (val && typeof val === "object") {
      collectIdentifiers(val, set);
    }
  }
}

// Walk each module-level function's body
for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id && moduleVars.has(node.id.name)) {
    const refs = new Set();
    collectIdentifiers(node.body, refs);
    refs.delete(node.id.name); // remove self-reference
    // Filter: only keep refs that are actual moduleVars
    for (const r of refs) {
      if (moduleVars.has(r)) moduleVars.get(node.id.name).refs.add(r);
    }
  }
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier" && decl.init && moduleVars.has(decl.id.name)) {
        if (decl.init.type === "ArrowFunctionExpression" || decl.init.type === "FunctionExpression") {
          const refs = new Set();
          collectIdentifiers(decl.init.body, refs);
          refs.delete(decl.id.name);
          for (const r of refs) {
            if (moduleVars.has(r)) moduleVars.get(decl.id.name).refs.add(r);
          }
        }
      }
    }
  }
}

// Step 4: compute in-degree
const inDegree = new Map();
for (const [name] of moduleVars) inDegree.set(name, 0);
for (const [name, info] of moduleVars) {
  for (const ref of info.refs) {
    inDegree.set(ref, (inDegree.get(ref) || 0) + 1);
  }
}

// --- Output ---
const sorted = [...moduleVars.entries()].sort((a, b) => a[1].line - b[1].line);

console.log(`App.js 模块级依赖图`);
console.log(`总计 ${moduleVars.size} 个模块级声明，${importMap.size} 个 import`);
console.log();

// 🔴 高被依赖（共享组件，不可拆）
console.log("━".repeat(60));
console.log("🔴 高被依赖（入度 ≥ 5）— 共享函数，不可拆");
console.log("━".repeat(60));
for (const [name, info] of sorted) {
  const deg = inDegree.get(name) || 0;
  if (deg >= 5) {
    console.log(`  ${name.padEnd(12)} L${String(info.line).padStart(5)}  入度=${deg}  ${info.type}`);
  }
}
console.log();

// 🟡 中依赖（入度 1-4）
console.log("━".repeat(60));
console.log("🟡 中度依赖（入度 1-4）— 谨慎拆");
console.log("━".repeat(60));
for (const [name, info] of sorted) {
  const deg = inDegree.get(name) || 0;
  if (deg >= 1 && deg <= 4) {
    console.log(`  ${name.padEnd(12)} L${String(info.line).padStart(5)}  入度=${deg}  ${info.type}`);
  }
}
console.log();

// 🟢 零入度（叶子节点）
console.log("━".repeat(60));
console.log("🟢 零入度 — 无其他函数依赖，可安全提取");
console.log("━".repeat(60));
let count = 0;
const leafNodes = [];
for (const [name, info] of sorted) {
  const deg = inDegree.get(name) || 0;
  if (deg === 0 && info.refs.size > 0) {
    leafNodes.push(name);
    if (count < 30) {
      const deps = [...info.refs];
      console.log(`  ${name.padEnd(12)} L${String(info.line).padStart(5)} 出度=${deps.length}  依赖内: ${deps.filter(d => !importMap.has(d)).slice(0,4).join(",") || "无"}`);
    }
    count++;
  }
}
console.log(`  ... 共 ${count} 个零入度变量`);
console.log();
console.log(`  其中 ${leafNodes.filter(n => {
  const info = moduleVars.get(n);
  return [...info.refs].every(r => importMap.has(r));
}).length} 个零 App.js 内部依赖（可直接提取）`);
