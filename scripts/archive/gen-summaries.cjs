#!/usr/bin/env node
/**
 * 批量生成 App.js 函数摘要 .md 文件
 * 用法: node scripts/gen-summaries.cjs
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..");
const rootDir = path.join(baseDir, "docs", "summaries");
fs.mkdirSync(rootDir, { recursive: true });

const categories = [
  { key: "nodes", flag: "--nodes", title: "节点组件", desc: "React Flow 画布上的 27 个节点组件" },
  { key: "shared", flag: "--shared", title: "共享瓶颈函数", desc: "入度 ≥ 3，被多个函数依赖" },
  { key: "extractable", flag: "--extractable", title: "可提取函数", desc: "零 App.js 内部依赖（仅依赖 vendor + Y/X/Un）" },
];

const indexLines = ["# App.js 函数摘要索引\n", `> 生成时间：${new Date().toISOString().slice(0, 19)}\n`];

let totalFiles = 0;

for (const cat of categories) {
  const dir = path.join(rootDir, cat.key);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`生成 ${cat.title}...`);
  const output = execSync(`node scripts/summarize.cjs ${cat.flag} --md`, {
    cwd: baseDir, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024,
  });

  const sections = output.split(/\n(?=## )/);
  let count = 0;
  let idx = `# ${cat.title} (${cat.desc})\n\n`;

  for (const section of sections) {
    const m = section.match(/^## (\w+)/);
    if (!m) continue;
    const name = m[1];
    const filename = `${name}.md`;
    fs.writeFileSync(path.join(dir, filename), section.trim() + "\n");
    count++;
    idx += `- [${section.split("\n")[0].replace(/^## /, "")}](${filename})\n`;
  }

  fs.writeFileSync(path.join(dir, "README.md"), idx);
  indexLines.push(`- [${cat.title}](${cat.key}/README.md) — ${count} 个`);
  totalFiles += count;
}

fs.writeFileSync(path.join(rootDir, "README.md"), indexLines.join("\n") + "\n");

console.log(`\n完成: ${totalFiles} 个文件 → docs/summaries/`);
console.log(`入口: docs/summaries/README.md`);
