#!/usr/bin/env node
/**
 * 2026-09-14 · 全量审计：cutia 原仓库里、编辑器**用得到**的模块，
 * 哪些在当前仓库里**不存在**（= 被删了）。
 *
 * 目的：不再靠"我以为"，而是**列清单**逐个判定。
 *
 * 判据：只列「编辑器主链路可能用得到」的范围（engine / ui/editor / 相关 stores/types/constants/hooks）。
 * 排除：明确的整站壳（app/ landing/ auth/ mobile/ agent/）。
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = '/tmp/cutia/apps/web/src';
const DST = '/Users/kevin/Documents/maomao/src/components/videoEditor';

/** 需要审计的源目录（编辑器相关） */
const SCOPE = [
  'core',
  'services',
  'lib/timeline', 'lib/commands', 'lib/media', 'lib/preview', 'lib/gradients',
  'lib/scenes.ts', 'lib/export.ts', 'lib/time.ts', 'lib/drag-data.ts',
  'lib/transcription', 'lib/tts',
  'components/editor',
  'components/ui',
  'stores',
  'hooks',
  'types',
  'constants',
  'utils',
  'data',
];

/** 明确不要的（整站壳 / 已知范围外） */
const EXCLUDE_PAT = /(\/mobile\/|landing\/|panels\/agent\/|views\/agent\/|\/ai\/|\/auth\/|\/db\/|\/r2\/|rate-limit|views\/ai\.tsx|views\/agent|onboarding|gitHub-contribute|theme-toggle|language-toggle|\/footer\.tsx|\/header\.tsx)/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  const st0 = statSync(dir);
  // 支持传入单个文件
  if (st0.isFile()) {
    if (/\.(ts|tsx|css)$/.test(dir)) out.push(dir);
    return out;
  }
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(n)) out.push(p);
  }
  return out;
}

/** 源文件路径 → 目标文件的候选路径（我们的目录映射不完全一致，故多候选匹配） */
function candidatesFor(rel) {
  const base = rel.split('/').pop();
  // 映射规则（与搬迁时的 cp 命令对应）
  const maps = [
    [/^core\//, 'engine/core/'],
    [/^lib\/commands\//, 'engine/commands/'],
    [/^lib\/timeline\//, 'engine/timeline/'],
    [/^services\//, 'engine/services/'],
    [/^lib\//, 'engine/lib/'],
    [/^components\/editor\//, 'ui/editor/'],
    [/^components\/ui\//, 'ui/ui/'],
    [/^components\//, 'ui/'],
    [/^hooks\//, 'hooks-cutia/'],
  ];
  for (const [re, prefix] of maps) {
    if (re.test(rel)) return join(DST, prefix + rel.replace(re, ''));
  }
  return join(DST, rel); // stores/types/constants/utils/data 同名
}

const missing = [];
let total = 0;

for (const scope of SCOPE) {
  const abs = join(SRC, scope);
  for (const f of walk(abs)) {
    const rel = relative(SRC, f);
    if (EXCLUDE_PAT.test('/' + rel)) continue;
    total++;
    const dst = candidatesFor(rel);
    if (!existsSync(dst)) {
      // 再宽容匹配：同 basename 在 DST 下找
      const base = rel.split('/').pop();
      const found = walk(DST).some((p) => p.endsWith('/' + base));
      if (!found) missing.push(rel);
    }
  }
}

console.log(`审计范围文件数：${total}`);
console.log(`缺失（原仓库有、当前没有）：${missing.length}\n`);
for (const m of missing.sort()) console.log('  ' + m);
