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
 * 【覆盖面（2026-09-18 全量扩围）】本轮把 `WATCHED` 从 2 个模块扩到 **19 个「会长大」类模块**
 * （store / api / engine / 业务 hook / config / assetUrl / degrade / contentStore）—— 判据是
 * **「导出面会随功能增长」**：`react` / UI 组件 / `logger` 这类**稳定边界不在此列**
 * （为它们建锁是形式主义：它们不会长大，且闸的成本守恒律要求不为不会发生的事付永久成本）。
 * 本轮实际转换 **195 处桩 / 71 个文件**（含上一轮 23 处），并把 **5 个"被旧桩藏住的真缺陷"**暴露出来：
 *   · 桩 `contentSet` 返 `void` 违反 `PersistWriteOutcome` 契约（`useScriptBoxEngine` / `VideoExtractNode`）；
 *   · `config` 桩缺 `KV_TIMEOUT`（`upstreamLink`）；
 *   · `assetUrl` 桩缺 `toAbsoluteFileUrl`（`ImageGenerate.saveRatioSync`）；
 *   · `conversationState` 桩缺 `setAgentKey`（`useAgentChat.hook`）；
 *   · `localToolApi` 桩缺 `HttpError`（`projectStore`）。
 * ⇒ **全部按"让桩如实履约"修，一处未回退**（回退即把真缺陷重新藏回去）。
 *
 * 【弯路留痕（本锁的判据改过两版，都错在"判据比实际窄/宽"）】
 *   · v1：固定 N 字窗口看 `importOriginal` —— 太窄时把合法的判成违规（`TaskCenter` 的多行泛型）；
 *     太宽时贪婪吞掉下一条 mock 使基数虚降。
 *   · v2：`isFactory` 正则要求工厂头以 `async(` 开头 —— 但切片已从 `=>` **之后**截起，
 *     该正则永远匹配不上 ⇒ **195 处全被判违规**（比 v1 更糟：假红）。
 *   · v3（现行）：`bracketSlice` 按**配平括号**切出本条工厂体；`body !== ''` 已等价于"是工厂"
 *     （因为无 `=>` 或 `=>` 越界时它返回 `''`），**不再二次判形态**。
 *   ⇒ 教训（同 `check-gate-vitals` 那次）：**判据要判"代码做了什么"，不是"长得像不像我预期的样子"。**
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const TESTS_DIR = fileURLToPath(new URL('../', import.meta.url));
const SELF = 'mockPartialSpread.test.ts';

/**
 * 「会长大」类模块 = 导出面会**随功能增长**的（store / api / engine / 业务 hook / config /
 * assetUrl / degrade）。**不含** `react`、UI 组件、`logger` 这类稳定边界 —— 它们不会长大，
 * 为它们建锁是"为不会发生的事付永久成本"（违反闸的成本守恒律，ADR-0016）。
 */
const WATCHED =
  /(?:Store|store|Api|api|Engine|engine|generate|useConnectedInputs|useNodeGeneration|useSyncNodeData|httpClient|kvStore|storageAdapter|assetUrl|config|contentStore|degrade)\.tsx?$/;

/**
 * 抽出文件里**每个** `vi.mock('<path>', <工厂>)`，判该桩有没有从真模块派生。
 *
 * ⚠️ **不能用"路径后开一个 N 字窗口看有没有 importOriginal"那种判据**（本锁的第一版就是这么写的，
 * 被探针当场证伪）。窗口两侧都会错：
 *   · **太窄** → `TaskCenter.test.tsx` 的 `vi.importActual<typeof import('…')>('…')` 带多行泛型，
 *     90 字窗口截在 `importActual<` 之前 ⇒ **把合法的判成违规**（误报）；
 *   · **太宽**（如 2000 字）→ 正则的贪婪会把**下一条 mock** 也吞进来，导致少匹配（基数虚降）。
 * ⇒ 正解 = **按本条的工厂体切片**，切片边界由**配平括号/花括号**决定，不靠固定字数。
 *
 * 判据 = **本条工厂体里出现 `importOriginal` 或 `vi.importActual`**（两个都是"拿真模块"的官方 API）。
 */
function scanMockHeads(text: string): Array<{ path: string; derived: boolean; head: string }> {
  const out: Array<{ path: string; derived: boolean; head: string }> = [];
  // 只锚定 `vi.mock('<path>',` —— 工厂体边界由下方 bracketSlice 决定
  const RE = /vi\.mock\(\s*(['"])([^'"]+)\1\s*,/g;
  for (let m = RE.exec(text); m; m = RE.exec(text)) {
    const body = bracketSlice(text, m.index + m[0].length);
    // ⚠️ 此处 **不再单独判 isFactory**：`bracketSlice` 只在"本条 mock 内确有 `=>` 工厂"时
    //    才返回非空体（无 `=>` 或 `=>` 越界 → 返回 `''`）。故 `body !== ''` 已等价于"是工厂"。
    //    （前一版在这里又判了一次 `/^(?:async...)=>/`，但 body 已从 `=>` **之后**截起，
    //     天然匹配不上 → 把**所有合法桩判成违规**，是典型的"判据比实际窄"。）
    const derived = body !== '' && /(?:importOriginal|vi\.importActual)/.test(body);
    out.push({
      path: m[2],
      derived,
      head: `vi.mock('${m[2]}', ${text.slice(m.index + m[0].length).trim().slice(0, 40).split('\n')[0]}…`,
    });
  }
  return out;
}

/**
 * 从 `start` 起切出**配平的实参体**（以 `(` / `{` 计数），返回其原文。
 * 这样每条 mock 的判据只看自己的体，既不会漏（窗口太窄）也不会串（窗口太宽）。
 */
function bracketSlice(text: string, start: number): string {
  let i = start;
  while (i < text.length && /\s/.test(text[i])) i++;
  // 工厂可能以 `async` / 标识符 / `(` 开头 —— 统一从**第一个括号**开始量配平。
  // ⚠️ 不能要求 `text[i] === '('`：正则已把 `vi.mock('<path>',` 消耗掉，start 落在 `async` 上，
  //    而**工厂体在 `=>` 之后**。故先找到 `=>`，再从其后量。
  const arrow = text.indexOf('=>', i);
  const semi = text.indexOf(';', i);
  // 若 `=>` 出现在本条 mock 的边界内（早于下一个 `vi.mock(` 且早于 `;`）→ 从 `=>` 之后量
  const nextMock = text.indexOf('vi.mock(', i);
  if (arrow >= 0 && (nextMock < 0 || arrow < nextMock) && (semi < 0 || arrow < semi + 0)) {
    let k = arrow + 2;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (text[k] === '(' || text[k] === '{') {
      return balanced(text, k);
    }
    // 箭头体非括号（如 `=> mocks.x`）—— 无反引数可量，返回该行
    return text.slice(arrow, text.indexOf('\n', arrow) < 0 ? text.length : text.indexOf('\n', arrow));
  }
  // 无 `=>`（非工厂形态）：返回空 → 不派生
  return '';
}

/** 从开括号 `open` 起量配平，返回含括号的整段。 */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    const c = text[j];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      j++;
      while (j < text.length && text[j] !== q) {
        if (text[j] === '\\') j++;
        j++;
      }
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) return text.slice(open, j + 1);
    }
  }
  return text.slice(open);
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
  it('★源码级：「会长大」类模块的每个 vi.mock 都用 importOriginal / importActual 拿真模块', () => {
    // 失败信息即修法：把工厂改成 `async (importOriginal) => ({ ...(await importOriginal()), … })`
    expect(offendersOf()).toEqual([]);
  });

  it('扫描基数自检：确实扫到了这一类模块的桩（0 个 = 解析器失效，不是"干净"）', () => {
    let hits = 0;
    for (const file of walk(TESTS_DIR)) {
      hits += scanMockHeads(readFileSync(file, 'utf8')).filter((h) => WATCHED.test(h.path)).length;
    }
    // 2026-09-18 全量扩围后基线 195（只许多不少 —— 少了说明解析器被打瞎，是假绿）
    expect(hits).toBeGreaterThanOrEqual(195);
  });
});
