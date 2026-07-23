// 品牌更名 · 功能标识符批替换（逐组）
// 用法: node scripts/replace-brand-id.cjs --from "yimao-workflow-backup" --to "maomao-workflow-backup" [--apply]
// 自动排除: 反编译代码目录、扫描/替换脚本自身、node_modules 等
const fs = require('fs');
const path = require('path');

const ROOT = 'g:/01画布项目/maomao';
const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FROM = get('--from');
const TO = get('--to');
const APPLY = args.includes('--apply');
if (!FROM || !TO) { console.error('用法: --from <旧> --to <新> [--apply]'); process.exit(1); }

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.codebuddy', 'Temp']);
const EXCLUDE_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'scan-brand.cjs', 'replace-brand-text.cjs', 'replace-brand-id.cjs', 'brand-scan-report.md'
]);
const TEXT_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.md', '.txt', '.ps1', '.command', '.sh', '.example',
  '.css', '.html', '.yml', '.yaml', '.toml', '.py', '.env'
]);

function isDecompiled(rel) {
  return rel.includes('decompiled') || rel.includes('App.original.js') || rel.endsWith('.raw.js');
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
      if (!content.includes(FROM)) continue;
      const cnt = content.split(FROM).length - 1;
      const newContent = content.split(FROM).join(TO);
      if (APPLY) fs.writeFileSync(abs, newContent);
      changed.push({ rel, cnt });
    }
  }
  return changed;
}

const changed = walk(ROOT, '');
if (!APPLY) console.log(`[DRY-RUN] --from "${FROM}" --to "${TO}"  将修改 ${changed.length} 个文件：`);
else console.log(`[APPLIED] --from "${FROM}" --to "${TO}"  已修改 ${changed.length} 个文件：`);
for (const c of changed.sort((a, b) => a.rel.localeCompare(b.rel))) console.log(`  ${c.rel}  (${c.cnt} 处)`);
