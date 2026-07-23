// 品牌更名 · 中文文案批替换（最安全批次）
// 仅替换纯中文品牌展示文案，零功能风险。
// 默认 dry-run（只打印将修改的文件与处数）；加 --apply 才真正写盘。
const fs = require('fs');
const path = require('path');

const ROOT = 'g:/01画布项目/maomao';
const APPLY = process.argv.includes('--apply');
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.codebuddy', 'Temp']);
const EXCLUDE_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'scan-brand.cjs', 'replace-brand-text.cjs', 'brand-scan-report.md']);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.md', '.txt', '.ps1', '.command', '.sh', '.example',
  '.css', '.html', '.yml', '.yaml', '.toml', '.py', '.env'
]);

// 排除：反编译/原始 vendor 代码（改了会失真）
function isDecompiled(rel) {
  return rel.includes('decompiled') ||
         rel.includes('App.original.js') ||
         rel.endsWith('.raw.js');
}

// 仅中文品牌展示文案（长→短顺序，避免短串误伤长串）
const MAP = [
  ['一毛AI画布', '猫猫AI画布'],
  ['一毛 AI 画布', '猫猫AI画布'],
  ['一毛用户', '猫猫用户'],
  ['一毛画布', '猫猫画布'],
  ['一毛AI', '猫猫AI'],
];

function repl(s) {
  for (const [a, b] of MAP) {
    if (s.includes(a)) s = s.split(a).join(b);
  }
  return s;
}

function walk(dir, relPrefix) {
  const changed = [];
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return changed; }
  for (const ent of ents) {
    const abs = path.join(dir, ent.name);
    const rel = relPrefix ? path.join(relPrefix, ent.name) : ent.name;
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(ent.name)) continue;
      changed.push(...walk(abs, rel));
    } else {
      if (EXCLUDE_FILES.has(ent.name)) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!TEXT_EXT.has(ext)) continue;
      if (isDecompiled(rel)) continue;
      let content;
      try { content = fs.readFileSync(abs, 'utf8'); }
      catch { continue; }
      if (!MAP.some(([a]) => content.includes(a))) continue;
      const newContent = repl(content);
      if (newContent !== content) {
        const cnt = MAP.reduce((n, [a]) => n + (content.split(a).length - 1), 0);
        if (APPLY) fs.writeFileSync(abs, newContent);
        changed.push({ rel, cnt });
      }
    }
  }
  return changed;
}

const changed = walk(ROOT, '');

if (!APPLY) {
  console.log(`[DRY-RUN] 将修改 ${changed.length} 个文件（未写盘）：`);
} else {
  console.log(`[APPLIED] 已修改 ${changed.length} 个文件：`);
}
for (const c of changed.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(`  ${c.rel}  (${c.cnt} 处)`);
}
