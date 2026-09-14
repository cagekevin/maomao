#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 搬迁 · 剪断「AI 域已删」留下的引用。
 * 依据：docs/130-cutia搬迁计划书；用户裁定「AI 直接删掉」。
 *
 * 策略：删 import 行 / 删 JSX 用法 / 用诚实占位替代引擎侧依赖。
 * 凡涉及"删功能"的语义判断，一律注释说明来源，不静默吞。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DST = join(ROOT, 'src/components/videoEditor');
const DRY = process.argv.includes('--dry');

const ops = [];
const op = (rel, from, to = '') => ops.push({ f: join(DST, rel), from, to });

/* ── engine 侧：agent-store / ai types / tts ── */
op(
  'engine/core/managers/project-manager.ts',
  /import \{ useAgentStore \} from "@videoEditor\/stores\/agent-store";\n/,
  '// 更新(2026-09-14)：agent-store 已随 AI 域删除，agentMessages 相关读写一并移除。\n',
);
op('engine/core/managers/project-manager.ts', /\s*useAgentStore\.getState\(\)\.initMessages\([^)]*\);\n/, '\n');
op('engine/core/managers/project-manager.ts', /\s*agentMessages:\s*useAgentStore\.getState\(\)\.getMessages\(\)[^\n]*\n/, '\n');

op(
  'engine/core/managers/save-manager.ts',
  /import \{ useAgentStore \} from "@videoEditor\/stores\/agent-store";\n/,
  '// 更新(2026-09-14)：agent-store 已随 AI 域删除。\n',
);
op('engine/core/managers/save-manager.ts', /^\s*agentMessages:[\s\S]*?,\n/gm, '\n');

op(
  'engine/services/storage/types.ts',
  /import type \{ AgentMessage \} from "@videoEditor\/engine\/lib\/ai\/agent\/types";\n/,
  '// 更新(2026-09-14)：AI 域已删，AgentMessage 改本地占位（保持持久化字段兼容）。\ntype AgentMessage = unknown;\n',
);
op(
  'engine/services/storage/service.ts',
  /import type \{ AgentMessage \} from "@videoEditor\/engine\/lib\/ai\/agent\/types";\n/,
  '// 更新(2026-09-14)：AI 域已删，AgentMessage 改本地占位。\ntype AgentMessage = unknown;\n',
);

op(
  'hooks-cutia/actions/use-editor-actions.ts',
  /import \{ useAgentStore \} from "@videoEditor\/stores\/agent-store";\n/,
  '// 更新(2026-09-14)：agent-store 已随 AI 域删除。\n',
);
op('hooks-cutia/actions/use-editor-actions.ts', /^\s*const [A-Za-z]+ = useAgentStore\([^;]*;\n/gm, '\n');

op('hooks-cutia/use-sound-search.ts', /import .*ai-settings-store.*\n/, '');

op('types/project.ts', /import type \{ AgentMessage \} from "@videoEditor\/engine\/lib\/ai\/agent\/types";\n/, '// 更新(2026-09-14)：AI 域已删。\ntype AgentMessage = unknown;\n');
op('types/project.ts', /import type \{ .*SoundSearchState.*\} from "@videoEditor\/types\/sounds";\n/, '');

/* ── UI 侧：agent 面板 / ai / captions / sounds / tts 面板 ── */
op('ui/editor/panels/assets/index.tsx', /import \{ AgentView \} from "\.\/views\/agent\/agent-view";\n/, '');
op('ui/editor/panels/assets/index.tsx', /import \{ SoundSearch \} from "\.\/views\/sounds";\n/, '');
op('ui/editor/panels/assets/index.tsx', /import \{ Captions \} from "\.\/views\/captions";\n/, '');
op('ui/editor/panels/assets/index.tsx', /import \{ AITab \} from "\.\/views\/ai";\n/, '');

op('ui/editor/panels/properties/text-properties.tsx', /import \{ TextSpeechPanel \} from "\.\/text-speech-panel";\n/, '');
op('ui/editor/panels/properties/text-properties.tsx', /\s*<TextSpeechPanel[\s\S]*?\/>\n/, '\n');

op('ui/editor/panels/assets/views/settings.tsx', /import .*ai-settings-store.*\n/, '');

let n = 0;
for (const { f, from, to } of ops) {
  if (!existsSync(f)) { console.log('⚠️ 不存在: ' + f.replace(ROOT + '/', '')); continue; }
  const s = readFileSync(f, 'utf8');
  const s2 = s.replace(from, to);
  if (s2 !== s) { n++; if (!DRY) writeFileSync(f, s2); }
  else console.log('⚠️ 未命中: ' + f.replace(ROOT + '/', '') + ' :: ' + String(from).slice(0, 70));
}
console.log(`变更：${n}/${ops.length}`, DRY ? '[dry-run]' : '');
