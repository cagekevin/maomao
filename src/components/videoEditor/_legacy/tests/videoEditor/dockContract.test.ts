import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 基座形态契约（机器化 `docs/123` G3 的**人工验收项**）。
 *
 * 人工验收原文：「基座展开时画布仍可点选/拖节点（证明**没登记 modalLayer**）」。
 * 人工项容易在后续改动里被悄悄破坏（谁顺手套个 FullscreenShell 就全废），故把它的**根因**
 * 变成源码断言 —— 不是断言"看起来能点"，而是断言"那几样会毁掉它的东西一个都没用"。
 *
 * ── 本文件为什么**按文件精确定位**（不是扫整层合并成一份）──
 * Dock 拆分后这层有多个文件。若把所有文件拼成一份再断言，出错时只知道"图层里有问题"，
 * 却难定位是哪个文件 —— 改回来/排查时很难下手。故每个**正向**不变式钉到它真正归属的那个文件：
 * 断言失败时，vitest 会直接点名是哪个文件哪一行不满足，问题可定位、改回可追溯。
 * 只有**负向**不变式（"全层禁用某标识符"）才扫全层 —— 禁止本就是层级的，不是单文件的事。
 */
const DOCK_DIR = 'src/components/videoEditor/panels/dock';

/** 读取 dock 层指定文件的源码（去掉注释 —— 正文里的「不用 X」说明文字不能算用了 X）。 */
function readFileStripped(relPath: string): string {
  return readFileSync(join(DOCK_DIR, relPath), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/** 整层拼接（负向"全层禁用"断言用）。 */
function readLayer(): string {
  const files = readdirSync(DOCK_DIR)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  return files.map((f) => readFileStripped(f)).join('\n');
}

/* ────────────────────────────────────────────────────────────────
 * ★改：全层禁用 → **按形态禁用**（2026-09-14 · docs/132 §二.3 / P-4）
 *
 * 【为什么改】本守卫的 describe 名一直是「**基座**不得登记 modalLayer」——
 * 它想守的是「**常驻**层不许 portal」，因为 portal ⇒ 登记 ⇒ 画布快捷键全废 ⇒
 * 「在画布上点选素材入轨」这个**主入口**死掉。
 * 但它的**实现**是「扫 `dock/` 整个目录」。M2 工作台（`panels/workbench/`）**需要** portal
 * （要盖住顶栏），若把它放进 `dock/` 就会撞这条守卫 —— 而它**并不常驻**，本不该受此约束。
 *
 * 【为什么不是「换目录名单」】那是手写清单母体（7 步法附录 A4）：
 * 每来一个新目录都要回来改一次。改为**按性质判** —— 文件自己声明「我是常驻层」，
 * 守卫只约束**带该声明**的文件，新目录不声明即自动不受约束。
 *
 * 【守的东西没变弱】约束对象从「某目录的全部文件」变成「声明为常驻的全部文件」，
 * 而当前 `dock/` 的每个文件都带声明（下方有断言锁这一点）⇒ 覆盖面等价，且不会误伤非常驻层。
 * ──────────────────────────────────────────────────────────────── */

/** 「常驻层」声明标记 —— 带它的文件禁止 portal / FullscreenShell / document.body。 */
const PERSISTENT_MARKER = 'DOCK_IS_PERSISTENT';

/** 递归收集 `src/components/videoEditor/` 下所有 ts/tsx（排除测试）。 */
function collectEditorFiles(dir = 'src/components/videoEditor'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectEditorFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * 判断文件是否声明为常驻层。
 *
 * 【为什么在**注释里**找标记，且不 strip】
 * 标记必须**零运行时成本**（不是变量 —— 否则 `noUnusedLocals` 报 TS6133、或 knip 报死导出；
 * 两条都试过，都被闸拦住）。故它是**文件头注释里的一枚 token**，守卫直接读原文匹配。
 * 这也让标记是**纯声明**：不改任何运行时代码，删除它也不会影响行为。
 */
function isPersistent(file: string): boolean {
  return readFileSync(file, 'utf8').includes(PERSISTENT_MARKER);
}

/** 「声明为常驻」的文件（标记在注释里，见 `isPersistent`）。 */
function persistentFiles(): string[] {
  return collectEditorFiles().filter(isPersistent);
}

/** 拼接「声明为常驻」的文件源码（去掉注释后再做「不许出现 X」断言）。 */
function readPersistentStripped(): string {
  return persistentFiles()
    .map((f) =>
      readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    )
    .join('\n');
}

describe('常驻层不得登记 modalLayer（docs/120 C10.1 红线 · 按形态禁用）', () => {
  it('【守卫自身有效性】dock 层每个文件都带常驻声明（否则本守卫形同虚设）', () => {
    const dockFiles = collectEditorFiles(DOCK_DIR);
    expect(dockFiles.length).toBeGreaterThan(0); // 目录非空（防路径写错→空扫→假绿）
    const missing = dockFiles.filter((f) => !isPersistent(f));
    expect(missing).toEqual([]);
  });

  it('声明为常驻的文件不用 FullscreenShell / useFullscreenEditorKeys / registerLayer', () => {
    const code = readPersistentStripped();
    expect(code).not.toContain('FullscreenShell');
    expect(code).not.toContain('useFullscreenEditorKeys');
    expect(code).not.toContain('registerLayer');
  });

  it('声明为常驻的文件不用 portal（常驻底部层，挂 App 根 flex 列）', () => {
    const code = readPersistentStripped();
    expect(code).not.toContain('createPortal');
    expect(code).not.toContain('document.body');
  });
});

describe('键盘归属判据单点（docs/123 §二.6 G-3）', () => {
  it('基座与 useCanvasShortcuts 共用同一个 editorKeyAction（不各自判一套）', () => {
    // 键盘不变式归属 `useTimelineDrag`（onKeyDown 落在那里）
    const dock = readFileStripped('useTimelineDrag.ts');
    const shortcuts = readFileSync('src/hooks/useCanvasShortcuts.ts', 'utf8');
    expect(dock).toContain('editorKeyAction');
    expect(shortcuts).toContain('editorKeyAction');
    expect(shortcuts).toContain('isEditorActive');
  });

  it('让位清单不得被复制（dock 层内不出现裸的按键比较）', () => {
    const code = readLayer();
    expect(code).not.toMatch(/key\s*===\s*'z'/);
    expect(code).not.toMatch(/key\s*===\s*'Delete'/);
  });
});

/* ────────────────────────────────────────────────────────────────
 * G5：入轨 / 导出 / 断链 的**结构性守卫**
 *
 * 这几条是「一旦被绕过，功能看起来还在、但判据已经分叉」的那类退化 ——
 * 人工点一遍发现不了（导出照样出片），所以必须机器守。
 * ──────────────────────────────────────────────────────────────── */

describe('导出必须经唯一入口（docs/120 C5.1：判路只准有一次）', () => {
  it('dock 层不得直调导出实现（exportLossless / exportComposite / needsCompositing）', () => {
    const code = readLayer();
    expect(code).not.toContain('exportLossless');
    expect(code).not.toContain('exportComposite');
    expect(code).not.toContain('needsCompositing');
  });

  it('导出走 runExport / planExport（唯一入口 + 常驻判路），归属 useEditorExport', () => {
    const code = readFileStripped('useEditorExport.ts');
    expect(code).toContain('runExport');
    expect(code).toContain('planExport');
  });
});

describe('C11.5 激活门：折叠态点选不留痕', () => {
  it('入轨 effect 里有「未展开即返回」的门（少它 = 折叠态点两下就静默塞片段），归属 useEditorIngest', () => {
    const code = readFileStripped('useEditorIngest.ts');
    const gate = code.indexOf('if (!open) return;');
    expect(gate).toBeGreaterThan(-1);
    expect(code.indexOf('enqueue(')).toBeGreaterThan(gate);
  });

  it('入轨用「选中集内容签名」驱动（不订阅逐帧坐标 —— 拖动不该触发入轨）', () => {
    const code = readFileStripped('useEditorIngest.ts');
    expect(code).toContain('selectedAssetSig');
    expect(code).toContain('deriveSelectedAssets');
  });
});

describe('C4.5 挂载硬断言（provider 上下文缺失必须立刻炸）· 归属 VideoEditorDock', () => {
  it('挂载期断言 ReactFlowProvider 上下文（缺失时导出回写会静默失败）', () => {
    const code = readFileStripped('VideoEditorDock.tsx');
    expect(code).toContain('useReactFlow');
    expect(code).toContain('throw new Error');
    expect(code).toContain('ReactFlowProvider');
  });
});

describe('C13 断链是持续状态（红标），不是一次性提示 · 归属 VideoEditorDock（Lane）', () => {
  it('片段按素材状态上红标（不是靠 toast 一闪而过）', () => {
    const code = readFileStripped('VideoEditorDock.tsx');
    expect(code).toContain('broken');
    expect(code).toContain('bg-danger');
  });
});

describe('C5.6 导出前信息常驻 · 归属 DockStatusBar', () => {
  it('有一条常驻信息行（路径 / 工程参数 / 黑边 / 音频出口）', () => {
    const code = readFileStripped('DockStatusBar.tsx');
    expect(code).toContain('data-export-info');
  });
});

describe('C11 时间轴标尺用共用原语（不要第二份刻度）· 归属 RulerStrip', () => {
  it('用 pickTickStep / buildTicks 生成刻度（不自己发明步长序列 / 刻度生成）', () => {
    const code = readFileStripped('RulerStrip.tsx');
    expect(code).toContain('pickTickStep(');
    expect(code).toContain('buildTicks(');
  });

  it('标尺是真实渲染点（data-timeline-ruler），刻度经渲染循环输出（接上消费方）', () => {
    const code = readFileStripped('RulerStrip.tsx');
    expect(code).toContain('data-timeline-ruler');
    expect(code).toContain('ticks.map');
  });

  it('播放头可拖动（beginPlayheadDrag），拖动 seek 走同一条 snapTime(clipEdges) 判据（不抄折叠吸附）· 归属 useEditorTransport', () => {
    const code = readFileStripped('useEditorTransport.ts');
    expect(code).toContain('beginPlayheadDrag');
    expect(code).toContain('snapTime(');
  });
});

/* ────────────────────────────────────────────────────────────────
 * 媒体元素宿主唯一（2026-09-14 · `docs/132` §九 P-7 · 债 `TD-22-13` 的前半）
 *
 * 【守什么（红线闸 / 结构偏好闸）】**结构偏好闸** —— 它钉一条`docs/132` §3.2b 的契约，
 * 不是 `CLAUDE.md` 级物理红线 ⇒ 证据充分时可改（改法见下）。
 *
 * 【为什么要有这条】M2 监视器要「看画面」、走带要「出声」。最省事的错误做法是**再挂一份媒体宿主**：
 *   ① 工作台里再写一个 `<PlaybackSink />`；或 ② 工作台直接 `document.createElement('video')`
 *      / 自己 JSX 一个 `<video>`。
 * 两种做法的后果都是同一素材**双份解码 + 双份出声**，而**没有任何一处会红**
 * （用户只会听到声音重了一遍 / 机器发烫，且不会把它归因到「宿主挂了两份」）。
 * 这正是本仓最忌的失败型态：**静默**（`docs/132` §十 F1）。
 *
 * 【判据】全 `videoEditor/**` 内**渲染** `<video>` / `<audio>` 的文件**恰好一处**
 * （现状 = `panels/dock/PlaybackSink.tsx` = 走带元素池）。
 * 断言「恰好这一处」而不是「不含某文件」：**挂第二个宿主也会变成 2 条** ⇒ 命中的是行为，不是名单。
 *
 * 【为什么现在立（守卫先于代码）】`docs/123` §二.6 的教训：闸要在写码前立，否则回潮。
 * 本条**今天就是绿的**（只有一处宿主），到 M2 工作台落地那天才真正生效。
 *
 * 【什么时候该改它 / 怎么改】若将来**真**需要第二个媒体宿主（例如可拖出的独立预览窗）：
 *   先证明「不会双份出声」（宿主单例被两处**引用**，而非各自 `new`），再把本条改成**反向判据**
 *   （「声明为媒体宿主的文件不得自建 `<video>`/`<audio>`」，与 §二.3 的按形态禁 portal 同款手法）
 *   —— **不要直接删掉本条**，那等于把静默失败的口子重新打开。
 * ──────────────────────────────────────────────────────────────── */

/** 渲染中的媒体标签（`<video ` / `<audio ` / `<video>` / `<video/`）。 */
const MEDIA_TAG_RE = /<(video|audio)[\s/>]/;

/** 唯一的媒体元素宿主（改判据时同步改它 + 上面那段说明）。 */
const EXPECTED_MEDIA_HOST = 'src/components/videoEditor/panels/dock/PlaybackSink.tsx';

/** 去注释：正文里写「不用 `<video>`」的说明文字不能算用了它（与 `readFileStripped` 同款）。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('媒体元素宿主唯一（防双份解码 / 双份出声）· docs/132 §九 P-7', () => {
  it('全 videoEditor 层只有一个文件渲染 <video>／<audio>（= 走带元素池）', () => {
    const hosts = collectEditorFiles()
      .filter((f) => MEDIA_TAG_RE.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => f.replace(/\\/g, '/'));
    expect(hosts).toEqual([EXPECTED_MEDIA_HOST]);
  });
});
