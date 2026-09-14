#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 搬迁 · 批量清理 A/B 类错误。
 *   A. 未使用的 import（TS6133 / TS6196）
 *   B. `<img>` 不支持属性残留（fill / sizes / unoptimized）（TS2322）
 * 依据：docs/130-cutia搬迁计划书（next/image → <img> 的收尾）。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DST = join(ROOT, 'src/components/videoEditor');
const DRY = process.argv.includes('--dry');

/** A. 删除指定的 import 行 / 多行 import 中的某个符号 */
const removals = [
  // storage/service.ts：SavedSound / SoundEffect 未用
  ['engine/services/storage/service.ts', /,?\s*SavedSound/, ''],
  ['engine/services/storage/service.ts', /,?\s*SoundEffect/, ''],
];
// 上面这种 sed 式替换风险高，改为逐项精确处理：
const precise = [
  // editor-header：BubbleChatIcon / SparklesIcon 未用（多行 import）
  ['ui/editor/editor-header.tsx', /\tBubbleChatIcon,\n/, ''],
  ['ui/editor/editor-header.tsx', /\tSparklesIcon,\n/, ''],
  // ui/alert.tsx：AlertTriangle 未用
  ['ui/ui/alert.tsx', /^import \{ AlertTriangle \} from "@videoEditor\/ui\/cutia-ui-icons";\n/m, ''],
];

/** B. <img> 属性清理（fill / sizes / unoptimized） */
const imgAttrFiles = [
  'ui/editor/panels/assets/views/media.tsx',
  'ui/editor/panels/assets/views/settings.tsx',
  'ui/editor/panels/assets/views/stickers.tsx',
  'ui/editor/panels/timeline/timeline-element.tsx',
];

let n = 0;
for (const [rel, from, to] of precise) {
  const f = join(DST, rel);
  if (!existsSync(f)) { console.log('⚠️ 不存在: ' + rel); continue; }
  const s = readFileSync(f, 'utf8');
  const s2 = s.replace(from, to);
  if (s2 !== s) { n++; if (!DRY) writeFileSync(f, s2); }
  else console.log('⚠️ 未命中: ' + rel + ' :: ' + String(from).slice(0, 50));
}

// B. 在 JSX 的 <img .../> 里删掉 fill / sizes / unoptimized 属性
for (const rel of imgAttrFiles) {
  const f = join(DST, rel);
  if (!existsSync(f)) { console.log('⚠️ 不存在: ' + rel); continue; }
  let s = readFileSync(f, 'utf8');
  const before = s;
  // 逐行删（这些属性都是独占一行的写法）
  s = s.split('\n').filter((line) => {
    const t = line.trim();
    return !(
      /^(fill|sizes|unoptimized)(=(\{true\}|"[^"]*"))?,?$/.test(t) ||
      /^(fill|sizes|unoptimized)=/.test(t)
    );
  }).join('\n');
  if (s !== before) { n++; if (!DRY) writeFileSync(f, s); console.log('  B清理: ' + rel); }
}

console.log(`变更文件数：${n}`, DRY ? '[dry-run]' : '');
