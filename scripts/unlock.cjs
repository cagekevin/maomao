#!/usr/bin/env node
/**
 * App.js 拆分解锁分析
 * 找最小共享函数集合：提取后能解锁最多节点
 */
const acorn = require("acorn");
const fs = require("fs");

const src = fs.readFileSync("src/App.js", "utf-8");

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
  "Intl","Proxy","Reflect","Worker","SharedWorker","MessageChannel","BroadcastChannel",
  "navigator","undefined","null","true","false","NaN","Infinity",
]);

let ast;
try {
  ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
} catch (e) { console.error(e.message); process.exit(1); }

const moduleVars = new Map();
const importMap = new Map();

for (const node of ast.body) {
  if (node.type === "ImportDeclaration") {
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") importMap.set(spec.local.name, { source: node.source.value });
    }
  }
  if (node.type === "FunctionDeclaration" && node.id) {
    moduleVars.set(node.id.name, { type: "fn", line: node.loc.start.line, deps: new Set() });
  }
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier") {
        moduleVars.set(decl.id.name, { type: "var", line: node.loc.start.line, deps: new Set() });
      }
    }
  }
}

function collectIdentifiers(node, set) {
  if (!node || typeof node !== "object") return;
  if (node.type === "Identifier") {
    if (!SKIP.has(node.name) && !importMap.has(node.name)) set.add(node.name);
    return;
  }
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") return;
  for (const key of Object.keys(node)) {
    if (["start","end","loc","range","type"].includes(key)) continue;
    const val = node[key];
    if (Array.isArray(val)) { for (const item of val) collectIdentifiers(item, set); }
    else if (val && typeof val === "object") collectIdentifiers(val, set);
  }
}

for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && node.id && moduleVars.has(node.id.name)) {
    const refs = new Set();
    collectIdentifiers(node.body, refs);
    refs.delete(node.id.name);
    for (const r of refs) { if (moduleVars.has(r)) moduleVars.get(node.id.name).deps.add(r); }
  }
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (decl.id.type === "Identifier" && decl.init && moduleVars.has(decl.id.name)) {
        if (decl.init.type === "ArrowFunctionExpression" || decl.init.type === "FunctionExpression") {
          const refs = new Set();
          collectIdentifiers(decl.init.body, refs);
          refs.delete(decl.id.name);
          for (const r of refs) { if (moduleVars.has(r)) moduleVars.get(decl.id.name).deps.add(r); }
        }
      }
    }
  }
}

// Count how many nodes each shared function "blocks" (reachable from it)
// A node is "blocked" by X if X is in its transitive dependency chain
// Simplified: just count how many nodes directly depend on each shared function
const directDependents = new Map();
for (const [name] of moduleVars) directDependents.set(name, new Set());
for (const [name, info] of moduleVars) {
  for (const dep of info.deps) {
    if (directDependents.has(dep)) directDependents.get(dep).add(name);
  }
}

// Find shared functions (in-degree >= 2) sorted by how many nodes they block
const blockers = [];
for (const [name, deps] of directDependents) {
  if (deps.size >= 2) blockers.push({ name, line: moduleVars.get(name).line, type: moduleVars.get(name).type, blocks: deps.size, blockedList: [...deps].slice(0, 10).join(",") });
}
blockers.sort((a, b) => b.blocks - a.blocks);

console.log("━".repeat(70));
console.log("瓶颈分析：共享函数（入度 ≥ 2），按阻塞节点数排序");
console.log("━".repeat(70));
for (const b of blockers.slice(0, 20)) {
  console.log(`  ${b.name.padEnd(12)} L${String(b.line).padStart(5)} 阻塞=${b.blocks}个  类型=${b.type}  被: ${b.blockedList}${b.blocks > 10 ? " ..." : ""}`);
}
console.log();

// Which of these blockers are "extractable"? 
// (They only depend on vendor/imports AND other blockers in this set)
const sortedBlockers = blockers.map(b => b.name);
const extractableBlockers = [];
for (const b of blockers) {
  const info = moduleVars.get(b.name);
  const unknownDeps = [...info.deps].filter(d => !sortedBlockers.includes(d) && !importMap.has(d));
  if (unknownDeps.length === 0) {
    extractableBlockers.push({ name: b.name, deps: [...info.deps], blocks: b.blocks });
  }
}

console.log("━".repeat(70));
console.log("优先级：可先提取的阻塞函数（其依赖都在 vendor 或其他阻塞函数中）");
console.log("━".repeat(70));
for (const eb of extractableBlockers.slice(0, 15)) {
  console.log(`  ${eb.name.padEnd(12)} 阻塞=${eb.blocks}个  依赖: ${[...eb.deps].join(",") || "无"}`);
}
if (extractableBlockers.length === 0) console.log("  （无）");
console.log();

// Count: how many nodes are unlocked after extracting all extractable blockers?
const allExtractable = new Set(extractableBlockers.map(b => b.name));
let unlocked = 0;
for (const [name, info] of moduleVars) {
  const remaining = [...info.deps].filter(d => !importMap.has(d) && !allExtractable.has(d));
  if (remaining.length === 0 && info.deps.size > 0) unlocked++;
}
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`提取所有可提取阻塞函数后，可解锁 ${unlocked} 个节点`);
console.log();
