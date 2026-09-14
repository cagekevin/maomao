#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 搬迁 · 收尾清理（第 3 批）。
 * 处理：AISettingsView 残留 tab、t 参数残留、未用 import、transitions 签名。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DST = join(ROOT, 'src/components/videoEditor');
const DRY = process.argv.includes('--dry');

const ops = [];
const op = (rel, from, to = '') => ops.push({ f: join(DST, rel), from, to });

/* settings.tsx */
op('ui/editor/panels/assets/views/settings.tsx', /^import \{ Switch \} from "@videoEditor\/ui\/ui\/switch";\n/m);
op('ui/editor/panels/assets/views/settings.tsx', /^import \{ Label \} from "@videoEditor\/ui\/ui\/label";\n/m);
// AI tab 残留（上一步注释掉了 tab 但 content 里的组件引用可能还在）
op('ui/editor/panels/assets/views/settings.tsx', /AISettingsView \/>/, '{/* AI 设置随 AI 域移除 */}');
op('ui/editor/panels/assets/views/settings.tsx', /const NO_PROVIDER[^\n]*\n/, '');
// BlurPreview 的 t 参数
op('ui/editor/panels/assets/views/settings.tsx', /\n\t\tt,\n\t\}: \{\n\t\tblur:/, '\n\t}: {\n\t\tblur:');
op('ui/editor/panels/assets/views/settings.tsx', /\n\t\tt: \(key: string, options\?: Record<string, string>\) => string;\n/, '\n');
op('ui/editor/panels/assets/views/settings.tsx', /\n\t\t\t\t\tt,\n\t\t\t\t\}\)/, '\n\t\t\t\t})');

/* transitions.tsx：applyTransitionToAdjacentPairs 的类型里还有 t */
op('ui/editor/panels/assets/views/transitions.tsx', /\n\tt: \(key: string, options\?: Record<string, unknown>\) => string;/, '');

/* stickers.tsx / color-picker.tsx / use-timeline-zoom.ts: not all code paths return */
op('ui/editor/panels/assets/views/stickers.tsx', /\(\{([^}]*)\}\) => \{\n(\s*)if \(([^\n]*)\) return;/g, '({$1}) => {\n$2if ($3) return;');

/* onboarding.tsx */
op('ui/editor/onboarding.tsx', /\n\s*description,\n/, '\n');
op('ui/editor/onboarding.tsx', /\{content\}/, '{/* content 随 react-markdown 移除，此处为占位 */}');

/* use-editor-actions.ts: generateAndInsertSpeech 调用带参 */
op('hooks-cutia/actions/use-editor-actions.ts', /generateAndInsertSpeech\(\{[\s\S]*?\}\)/, 'generateAndInsertSpeech()');

let n = 0;
for (const { f, from, to } of ops) {
  if (!existsSync(f)) { console.log('⚠️ 不存在: ' + f.replace(ROOT + '/', '')); continue; }
  const s = readFileSync(f, 'utf8');
  const s2 = s.replace(from, to);
  if (s2 !== s) { n++; if (!DRY) writeFileSync(f, s2); }
  else console.log('  (未命中) ' + f.replace(ROOT + '/', '') + ' :: ' + String(from).slice(0, 45));
}
console.log(`变更：${n}/${ops.length}`, DRY ? '[dry-run]' : '');
