#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 搬迁 · 为"依赖已移除域"的功能打诚实占位（不静默、不假装成功）。
 * 涉及：字幕转写（transcription）· AI 流式渲染（streamdown）· Markdown（react-markdown）
 * 依据：docs/130-cutia搬迁计划书 · 用户裁定「先注释/断开 AI 入口，其余全部推进」。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DST = join(ROOT, 'src/components/videoEditor');
const DRY = process.argv.includes('--dry');

const ops = [];
const op = (rel, from, to) => ops.push({ f: join(DST, rel), from, to });

/* ── captions.tsx：转写服务 → 诚实占位 ── */
op('ui/editor/panels/assets/views/captions.tsx',
  /import \{ transcriptionService \} from "@videoEditor\/engine\/services\/transcription\/service";\n/,
  '// 更新(2026-09-14)：转写域（engine/services/transcription + lib/transcription）属范围外已移除。\n'
  + '// 占位：调用即明确报错（诚实失败，不做静默降级）。\n'
  + 'const transcriptionService = {\n'
  + '\tasync transcribe(): Promise<never> {\n'
  + '\t\tthrow new Error("字幕转写功能未移植（transcription 域已移除）");\n'
  + '\t},\n'
  + '};\n');

op('ui/editor/panels/assets/views/captions.tsx',
  /import \{ buildCaptionChunks \} from "@videoEditor\/engine\/lib\/transcription\/caption";\n/,
  'const buildCaptionChunks = (..._args: unknown[]): never => {\n'
  + '\tthrow new Error("字幕分块功能未移植（transcription 域已移除）");\n'
  + '};\n');

op('ui/editor/panels/assets/views/captions.tsx',
  /import type \{\n\tTranscriptionLanguage,\n\tTranscriptionModelId,\n\tTranscriptionProgress,\n\} from "@videoEditor\/types\/transcription";\n/,
  'type TranscriptionLanguage = string;\ntype TranscriptionModelId = string;\ntype TranscriptionProgress = { progress: number };\n');

/* ── agent-message.tsx：streamdown → 纯文本渲染 ── */
op('ui/editor/panels/assets/views/agent/agent-message.tsx',
  /<Streamdown\n([\s\S]*?)\n\s*<\/Streamdown>/,
  '{/* 更新(2026-09-14)：streamdown 属范围外已移除，降级为纯文本渲染。 */}\n'
  + '<div className="whitespace-pre-wrap text-sm">{content}</div>');

/* ── onboarding.tsx：ReactMarkdown → 纯文本 ── */
op('ui/editor/onboarding.tsx',
  /<ReactMarkdown\n([\s\S]*?)\n\s*<\/ReactMarkdown>/,
  '{/* 更新(2026-09-14)：react-markdown 属范围外已移除，降级为纯文本渲染。 */}\n'
  + '<div className="whitespace-pre-wrap text-sm">{content}</div>');

let n = 0;
for (const { f, from, to } of ops) {
  if (!existsSync(f)) { console.log('⚠️ 不存在: ' + f.replace(ROOT + '/', '')); continue; }
  const s = readFileSync(f, 'utf8');
  const s2 = s.replace(from, to);
  if (s2 !== s) { n++; if (!DRY) writeFileSync(f, s2); }
  else console.log('⚠️ 未命中: ' + f.replace(ROOT + '/', '') + ' :: ' + String(from).slice(0, 60));
}
console.log(`变更：${n}/${ops.length}`, DRY ? '[dry-run]' : '');
