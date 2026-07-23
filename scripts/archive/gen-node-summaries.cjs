#!/usr/bin/env node
/**
 * 批量生成 App.js 模块级函数摘要 .md 文件
 * 用法:
 *   node scripts/gen-summaries.cjs          # 全部类别
 *   node scripts/gen-summaries.cjs nodes    # 仅节点组件
 *   node scripts/gen-summaries.cjs shared   # 仅共享函数
 *   node scripts/gen-summaries.cjs helpers  # 仅辅助函数
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..");

const categories = {
  nodes: { flag: "--nodes", dir: "docs/summaries/nodes", title: "节点组件（27个）" },
  shared: { flag: "--shared", dir: "docs/summaries/shared", title: "共享函数（入度 ≥ 3）" },
  extractable: { flag: "--extractable", dir: "docs/summaries/extractable", title: "可提取函数（零 App.js 依赖）" },
  helpers: { flag: "--all", dir: "docs/summaries/helpers", title: "辅助工具函数",
    // Filter: exclude nodes, exclude infra (Y/X/Un), exclude CSS vars
    postFilter: (name) => {
      const { execSync } = require("child_process");
      const path = require("path");
      try {
        const out = execSync(`node scripts/summarize.cjs ${name} --md 2>/dev/null | grep "\\`nodeType\\`" | wc -l`, { cwd: baseDir, encoding: "utf-8" });
        return parseInt(out) === 0; // not a node
      } catch { return true; }
    }
  },
};

const which = process.argv[2] || "all";
const toRun = which === "all" ? Object.keys(categories) : [which];

let total = 0;
const indexLines = ["# App.js 函数摘要索引\n"];

for (const cat of toRun) {
  if (!categories[cat]) {
    console.log(`未知类别: ${cat}，可选: ${Object.keys(categories).join(", ")}`);
    continue;
  }
  const { flag, dir, title } = categories[cat];
  const outDir = path.join(baseDir, dir);
  fs.mkdirSync(outDir, { recursive: true });

  const output = execSync(`node scripts/summarize.cjs ${flag} --md`, {
    cwd: baseDir, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024,
  });

  const sections = output.split(/\n(?=## )/);
  let count = 0;
  let idx = `## ${title}\n\n`;

  for (const section of sections) {
    const m = section.match(/^## (\w+)/);
    if (!m) continue;
    const name = m[1];
    const filename = `${name}.md`;
    fs.writeFileSync(path.join(outDir, filename), section.trim() + "\n");
    count++;
    const firstLine = section.split("\n")[0].replace(/^## /, "");
    idx += `- [${firstLine}](${cat === "helpers" ? "" : `../${cat}/`}${filename})\n`;
  }

  fs.writeFileSync(path.join(outDir, "README.md"), idx);
  indexLines.push(`- [${title}](${dir}/README.md) (${count} 个)`);
  total += count;
}

// Write root index
fs.writeFileSync(path.join(baseDir, "docs/summaries/README.md"), indexLines.join("\n") + "\n");

console.log(`生成完成: ${total} 个文件 → docs/summaries/`);
