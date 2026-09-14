#!/usr/bin/env node
/**
 * 2026-09-14 · 审计：搬迁时删掉的东西，是否真的依赖 AI / 范围外？
 *
 * 判据：对每个被删模块，检查其**真实**外部依赖里有没有 AI 相关符号。
 *   有 → 删对了；没有 → **误删**（本该保留）。
 *
 * 输出：每个被删模块的依赖摘要 + 误删判定。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = '/tmp/cutia/apps/web/src';
const DST = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/components/videoEditor');

/** 我删除的模块清单（本次审计对象） */
const DELETED = [
  'components/editor/panels/assets/views/sounds.tsx',
  'stores/sounds-store.ts',
  'types/sounds.ts',
  'components/editor/panels/assets/views/captions.tsx',
  'services/transcription/service.ts',
  'lib/transcription/caption.ts',
  'components/editor/panels/assets/views/ai.tsx',
  'stores/ai-image-generation-store.ts',
  'stores/ai-video-generation-store.ts',
  'stores/ai-settings-store.ts',
  'stores/ai-generation-history-store.ts',
  'stores/character-store.ts',
  'lib/tts/service.ts',
];

/** AI 相关判定符号 */
const AI_PAT = /ai\/|agent|nanobanana|seedream|seedance|tts|provider|huggingface|prompt/i;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : /\.tsx?$/.test(n) && out.push(p);
  }
  return out;
}

/** 提取一个文件的 import specifiers */
function importsOf(file) {
  if (!existsSync(file)) return null;
  const s = readFileSync(file, 'utf8');
  const specs = [];
  for (const m of s.matchAll(/from\s+["']([^"']+)["']/g)) specs.push(m[1]);
  for (const m of s.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
  return [...new Set(specs)];
}

console.log('模块'.padEnd(58), '判定'.padEnd(10), 'AI 依赖');
console.log('-'.repeat(110));

for (const rel of DELETED) {
  const file = join(SRC, rel);
  const specs = importsOf(file);
  if (specs === null) { console.log(rel.padEnd(58), '(原仓库无此文件)'); continue; }

  const aiSpecs = specs.filter((s) => AI_PAT.test(s));
  const verdict = aiSpecs.length > 0 ? '✅ 删对' : '⚠️ 疑误删';
  console.log(rel.padEnd(58), verdict.padEnd(10), aiSpecs.length ? aiSpecs.join(', ') : '（无）');
}
