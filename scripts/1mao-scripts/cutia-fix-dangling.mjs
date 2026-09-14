#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 搬迁 · 剪断"范围外文件已删"留下的悬空引用。
 * 依据：docs/130-cutia搬迁计划书。
 *
 * 两类：
 *   A. 路径修正：engine/lib/timeline → engine/timeline（搬运时落点不同）
 *   B. 剪断引用：被删域（characters / feedback / transcription / 整站壳 / next）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DST = join(ROOT, 'src/components/videoEditor');
const DRY = process.argv.includes('--dry');

const edits = [];
function edit(rel, from, to) {
  edits.push({ file: join(DST, rel), from, to });
}

/* ── A. 路径修正：lib/timeline → engine/timeline ── */
for (const rel of [
  'engine/lib/tts/service.ts',
  'engine/lib/ai/agent/tools/timeline-tools.ts',
]) {
  edit(rel, '@videoEditor/engine/lib/timeline', '@videoEditor/engine/timeline');
}

/* ── B. 剪断引用 ── */

// editor-header：删整站壳（theme/language toggle）+ feedback + next/image + navigation
edit('ui/editor/editor-header.tsx', /import \{ ThemeToggle \} from "..\/theme-toggle";\n/, '');
edit('ui/editor/editor-header.tsx', /import \{ LanguageToggle \} from "..\/language-toggle";\n/, '');
edit('ui/editor/editor-header.tsx', /import \{ FeedbackTrigger \} from "@videoEditor\/ui\/feedback\/feedback-trigger";\n/, '');
edit('ui/editor/editor-header.tsx', /import Image from "next\/image";\n/, '');
edit('ui/editor/editor-header.tsx', /import \{ useRouter \} from "@videoEditor\/engine\/lib\/navigation";\n/, '');
// 用法移除
edit('ui/editor/editor-header.tsx', /\s*<ThemeToggle \/>\n?/g, '\n');
edit('ui/editor/editor-header.tsx', /\s*<LanguageToggle \/>\n?/g, '\n');
edit('ui/editor/editor-header.tsx', /\s*<FeedbackTrigger \/>\n?/g, '\n');

// onboarding：删整站壳引用
edit('ui/editor/onboarding.tsx', /import \{ LanguageToggle \} from "@videoEditor\/ui\/language-toggle";\n/, '');
edit('ui/editor/onboarding.tsx', /\s*<LanguageToggle \/>\n?/g, '\n');
edit('ui/editor/onboarding.tsx', /import .*react-markdown.*\n/, '');

// ai.tsx：删 characters / navigation / character-store
edit('ui/editor/panels/assets/views/ai.tsx', /import \{ CharacterPicker \} from "@videoEditor\/ui\/characters\/character-picker";\n/, '');
edit('ui/editor/panels/assets/views/ai.tsx', /import \{ CharacterDetailDialog \} from "@videoEditor\/ui\/characters\/character-detail";\n/, '');
edit('ui/editor/panels/assets/views/ai.tsx', /import \{ useCharacterStore \} from "@videoEditor\/stores\/character-store";\n/, '');
edit('ui/editor/panels/assets/views/ai.tsx', /import type \{ AICharacter \} from "@videoEditor\/types\/character";\n/, '');
edit('ui/editor/panels/assets/views/ai.tsx', /import \{ Link, useRouter \} from "@videoEditor\/engine\/lib\/navigation";\n/, '');

// agent-message：删 streamdown
edit('ui/editor/panels/assets/views/agent/agent-message.tsx', /import .*streamdown.*\n/, '');

// captions：删 transcription（转写域已删）
edit('ui/editor/panels/assets/views/captions.tsx', /import \{ transcriptionService \} from "@videoEditor\/engine\/services\/transcription\/service";\n/, '');
edit('ui/editor/panels/assets/views/captions.tsx', /import \{ buildCaptionChunks \} from "@videoEditor\/engine\/lib\/transcription\/caption";\n/, '');
edit('ui/editor/panels/assets/views/captions.tsx', /import \{\n\t\tTranscriptionProgress,\n\s*\} from "@videoEditor\/types\/transcription";\n/, '');

// sonner：去 next-themes
edit('ui/ui/sonner.tsx', /import \{ useTheme \} from "next-themes";\n/, '');
edit('ui/ui/sonner.tsx', /const \{ theme = "system" \} = useTheme\(\);/, 'const theme = "system";');

// next/image → <img>（剩余 5 处）
for (const rel of [
  'ui/editor/panels/assets/views/settings.tsx',
  'ui/editor/panels/assets/views/media.tsx',
  'ui/editor/panels/assets/views/stickers.tsx',
  'ui/editor/panels/timeline/timeline-element.tsx',
  'ui/editor/layout-guide-overlay.tsx',
]) {
  edit(rel, /import Image from "next\/image";\n/, '');
  edit(rel, /<Image\b/g, '<img');
}

// layout-guide-overlay 里的整站壳引用（若有）
edit('ui/editor/layout-guide-overlay.tsx', /import .*language-toggle.*\n/, '');

let changed = 0;
for (const { file, from, to } of edits) {
  if (!existsSync(file)) { console.log('  ⚠️ 跳过（不存在）: ' + file.replace(ROOT + '/', '')); continue; }
  const src = readFileSync(file, 'utf8');
  const next = src.replace(from, to);
  if (next !== src) {
    changed++;
    if (!DRY) writeFileSync(file, next);
  }
}
console.log(`变更文件数：${changed}/${edits.length}`);
console.log(DRY ? '[dry-run]' : '已写入');
