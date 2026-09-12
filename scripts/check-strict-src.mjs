#!/usr/bin/env node
/**
 * 渐进式 strict 类型收口闸（noImplicitAny）—— TD-09-1 选项 A 的落点。
 *
 * 【背景】`tsconfig.json` 关闭 `strict` / `noImplicitAny` / `strictNullChecks`（历史遗留）。
 * 全 src 在 `--noImplicitAny` 下实测 **1435 处**隐式 any（TS7006 参数 984 / TS7031 解构 242 为主，
 * 见 `daily/架构日志/09-类型诚实性-隐式any复核-2026-09-12.md`）。一次性开 strict 不现实。
 *
 * 【机制】白名单**渐进收口**：`WHITELIST` 内目录必须零 noImplicitAny 错误（不达标即红）；
 * 白名单外暂不阻塞（存量债，属 TD-09-1「待翻新」）。每收口一个目录，就把它加进 `WHITELIST`。
 * 依赖方向：先 `core/` 契约地基 → `stores` → `hooks` → `nodes`/`ui`（自底向上）。
 *
 * 【为什么用路径过滤而非新 tsconfig】TS 会连带检查被 import 的文件（include 白名单挡不住），
 * 故本闸跑全 src 的 `--noImplicitAny`，再按路径过滤，只对白名单目录负责。
 *
 * 用法：`node scripts/check-strict-src.mjs`（挂 `npm run check:strict-src`）
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** 已收口目录（单一真源 = scripts/strict-src-whitelist.json，与 strict-report.mjs 共用） */
const WHITELIST = JSON.parse(
  readFileSync(new URL('./strict-src-whitelist.json', import.meta.url), 'utf8'),
).whitelist;

let out = '';
try {
  out = execSync('npx tsc -p tsconfig.json --noEmit --noImplicitAny', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
} catch (e) {
  out = `${e.stdout || ''}${e.stderr || ''}`;
}

const allErrors = out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
const inScope = allErrors.filter((l) => WHITELIST.some((w) => l.includes(w)));

console.log('🔒 strict 类型收口闸（noImplicitAny · TD-09-1 选项 A）');
console.log(`   白名单目录（${WHITELIST.length}）：${WHITELIST.join(' · ')}`);
console.log(`   全 src 隐式 any 存量：${allErrors.length} 处（白名单外不阻塞，属待翻新）`);

if (inScope.length > 0) {
  console.error(`\n❌ 白名单目录内出现 ${inScope.length} 处隐式 any（须清零后才能扩白名单）：`);
  for (const l of inScope) console.error('   ' + l);
  process.exit(1);
}

console.log('   ✅ 白名单目录 0 隐式 any');
