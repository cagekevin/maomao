/**
 * 桩与契约脱钩的**防回潮锁**（TD-17-15 · 2026-09-18）。
 *
 * 【背景 · 两次真实事故（2026-09-17，同日）】tests 侧手写 mock 桩只声明「被用到的那几个导出」，
 * 于是被 mock 的模块**一加导出**，凡是走到该导出的套件立刻**整套件崩**（不是某条断言红）：
 *   · 事故一：`contentStore` 加写原语（`contentSet` 等）⇒ 桩返 `undefined` 的调用点炸；
 *   · 事故二：`providerStore` 加单 hook `useEnsureProvidersLoaded`（TD-24-4 §二）⇒
 *     `AgentPanel` / `ScriptBoxNode` / `useScriptBoxEngine` 三个套件 **27 + 19 + 13 例**全崩。
 *
 * 【根因】被 mock 的模块**会长大**，而桩是**手抄的静态面** ⇒ 二者必然漂移；
 * 且失败方式最差：不在"改契约的那一处"红，而在**一堆不相干的套件**里崩。
 *
 * 【判据（本锁执行的那一条）】桩必须**从真模块派生**，只表达「我要控制什么」：
 *
 *     vi.mock('…/providerStore.ts', async (importOriginal) => ({
 *       ...((await importOriginal()) as Record<string, unknown>), // ← 真模块全量导出（新增自动可见）
 *       useProviders: () => ({ providers: [] }),                  // ← 只覆盖要控的那几个
 *     }));
 *
 * 【为什么不靠"记得同步改桩"】那是把结构问题交给人的注意力（本仓母体：清单/约定必漏）。
 * 【为什么不用 `as unknown as typeof import(…)`】本仓 TD-24-5 正在清 `as unknown as` 双重断言 ⇒
 * 统一用**单次** `as Record<string, unknown>`（vitest 的 `importOriginal` 返回 `unknown`，单次断言即够；
 * 先例：`creditGateModes.test.ts` 的 contentStore 桩 · `AgentPanel.test.tsx` 的 config 桩）。
 *
 * 【本锁的覆盖面（诚实边界）】仅两个**已被证实会长大**的模块：
 * `base/store/providerStore.ts` · `base/core/contentStore.ts`（本轮 23 处手写桩已全量转换）。
 * 其余模块的手写桩**本轮未扫全**（未咬过人）—— 同一判据通用，按逐轮清偿处理。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const TESTS_DIR = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'mockPartialSpread.test.ts';

/** 这两个模块 = 已被证实「会长大」的（见文件头）；其余模块的桩本轮未扫全。 */
const WATCHED = /(?:providerStore|contentStore)\.ts$/;

/**
 * 抽出文件里**每个** `vi.mock('<path>', <工厂>)` 的「路径 + 工厂头」，判该桩有没有从真模块派生。
 *
 * ⚠️ **不能用"路径后开一个 140 字窗口看有没有 importOriginal"那种判据**（本锁的第一版就是这么写的，
 * 被探针当场证伪）：窗口会**越过本条 mock**，被紧邻的下一条 mock 的 `importOriginal` 满足 ⇒ 假绿。
 * 故此处**锚定解析**：路径取字符串字面量，工厂头必须**紧跟逗号**且形如 `async (形参) =>`。
 */
function scanMockHeads(text: string): Array<{ path: string; derived: boolean; head: string }> {
  const out: Array<{ path: string; derived: boolean; head: string }> = [];
  const RE = /vi\.mock\(\s*(['"])([^'"]+)\1\s*,\s*([\s\S]{0,160})/g;
  for (let m = RE.exec(text); m; m = RE.exec(text)) {
    const arg2 = m[3];
    // 工厂头：`async (ident) =>` —— 有且仅有一个形参（vitest 传的就是 importOriginal）才可能展开真模块
    const head = arg2.match(
      /^(async\s*\(\s*[A-Za-z_$][\w$]*\s*\)|\(\s*[A-Za-z_$][\w$]*\s*\))\s*=>/,
    );
    out.push({
      path: m[2],
      derived: Boolean(head) && /^async/.test(arg2.trim()),
      head: `vi.mock('${m[2]}', ${arg2.slice(0, 40).split('\n')[0]}…`,
    });
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!e.isFile()) continue;
    if (!/\.tsx?$/.test(e.name)) continue;
    if (e.name === SELF) continue; // 本文件（判据说明里含示例写法，不自查）
    out.push(join(e.parentPath ?? dir, e.name));
  }
  return out;
}

function offendersOf(): string[] {
  const offenders: string[] = [];
  for (const file of walk(TESTS_DIR)) {
    const name = file.split(/[\\/]/).pop();
    for (const h of scanMockHeads(readFileSync(file, 'utf8'))) {
      if (WATCHED.test(h.path) && !h.derived) offenders.push(`${name} → ${h.head}`);
    }
  }
  return offenders;
}

describe('mock 桩必须从真模块派生（TD-17-15）', () => {
  it('★源码级：providerStore / contentStore 的每个 vi.mock 都用 importOriginal 展开', () => {
    // 失败信息即修法：把工厂改成 `async (importOriginal) => ({ ...(await importOriginal()), … })`
    expect(offendersOf()).toEqual([]);
  });

  it('扫描基数自检：确实扫到了这两个模块的桩（0 个 = 解析器失效，不是"干净"）', () => {
    let hits = 0;
    for (const file of walk(TESTS_DIR)) {
      hits += scanMockHeads(readFileSync(file, 'utf8')).filter((h) => WATCHED.test(h.path)).length;
    }
    expect(hits).toBeGreaterThanOrEqual(20); // 本轮基线 23；只许多不少
  });
});
