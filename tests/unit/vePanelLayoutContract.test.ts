// @vitest-environment node
/**
 * 守卫：**面板纵向分区契约**（TD-22-50 的今天形态）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约正文写在 `ui/editor/panels/panel-base-view.tsx` 的注释里 —— 但注释不防回潮
 * （母体 M2「唯一入口无机器守卫」）。这里把契约里**可机器判定**的三条落成判据：
 *
 *   ① **壳只有一层**：面板文件里 `PanelBaseView` 只许出现一处。
 *      出现第二处 = 有人又在 tab content 里套了第二个壳 —— 那正是"各视图各发明
 *      自己的包装层"的起点（高度链在第二层壳处断掉，`grow` 分区再也撑不开）。
 *   ② **滚动只有一个**：面板视图不得自建滚动容器（`ScrollArea` / `overflow-auto` /
 *      `overflow-y-auto`）。第二层滚动的后果：外层永远滚不动、内层高度链对不上。
 *   ③ **占位必须撑满**：每个 `PanelState` 都要住在一个 `<PropertyGroup grow>` 里。
 *      判据 = `占位件数 > grow 分区数`（**鸽笼原理**：占位比容器多 ⇒ 必有占位裸塞进普通分区，
 *      `h-full` 在滚动容器里无参照 → 塌）。
 *
 *      【2026-09-19 修正两处 · 都是判据本身比契约窄/宽，不是代码违规】
 *        · **件名过期**：组件已按 **TD-18-41（域前缀强制：域专用物必须带该域前缀）**
 *          由 `PanelState` 改名为 `VideoEditorPanelState`；原正则 `/<PanelState\b/` 匹配不到新名
 *          ⇒ 5 个面板文件被误判为"0 占位"（**假红**）。实证：`assets/index.tsx:40` ·
 *          `assets/views/{media:457,sounds:79/88/134,stickers:395/401}.tsx` ·
 *          `properties/empty-view.tsx:20` 全部在用新名。
 *        · **口径过窄**：原判据要求 `占位数 !== grow 分区数` 即违规（**相等**为必要条件），
 *          但 `grow` 分区可装**内容**、并非占位独享 —— 实证 `sounds.tsx` 有 6 个 grow 分区
 *          而只有 3 个装占位（另外 3 个装真实内容）⇒ 相等口径把合规件判红。
 *          契约原文只要求"占位住进 grow 里"，**未**要求"grow 里必是占位" ⇒ 改判"多则不合法"。
 * ════════════════════════════════════════════════════════════════
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PANELS_DIR = join(process.cwd(), 'src/components/videoEditor/ui/editor/panels');

/**
 * 面板文件 = **壳** + 素材面板（容器 + 全部视图）+ **属性面板**（同一套面板语言）。
 *
 * ⚠️ 壳（`panel-base-view.tsx`）必须在列表里 —— 它自己就是最重要的 `TabsContent`
 * 调用点。首版判据漏了它，探针注入"裸 flex"时**没红**（"测试不红 = 没测到东西"）。
 */
function panelFiles(): string[] {
  const files = [join(PANELS_DIR, 'panel-base-view.tsx'), join(PANELS_DIR, 'assets/index.tsx')];
  for (const dir of [join(PANELS_DIR, 'assets/views'), join(PANELS_DIR, 'properties')]) {
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith('.tsx')) files.push(join(dir, entry));
    }
  }
  return files.sort();
}

/**
 * 判据只看**代码**：注释里叙述契约（如"滚动只发生在那一个 `ScrollArea`"、
 * "顶层只有 `<BaseView>`"）不算违规 —— 否则守卫会被自己的说明文字判红。
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function count(source: string, re: RegExp): number {
  return (source.match(re) ?? []).length;
}

/** `TabsContent` 原语 —— 「非激活面板怎么隐藏」这件事收口在这里。 */
const TABS_PRIMITIVE = join(PANELS_DIR, '../../ui/tabs.tsx');

/** 取出面板文件里每个 `<TabsContent>` 的 className（属性顺序固定时 300 字符内足够覆盖）。 */
function tabsContentClasses(source: string): string[] {
  const out: string[] = [];
  const re = /<TabsContent[\s\S]{0,300}?className="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) out.push(match[1]);
  return out;
}

function relative(file: string): string {
  return file.replace(/\\/g, '/').split('ui/editor/panels/')[1] ?? file;
}

describe('面板纵向分区契约（TD-22-50）', () => {
  it('壳只有一层：面板文件里 PanelBaseView 最多出现一处', () => {
    const offenders = panelFiles()
      .map((file) => ({ file, hits: count(code(file), /<(?:PanelBaseView|BaseView)\b/g) }))
      .filter((row) => row.hits > 1)
      .map((row) => `${relative(row.file)} (${row.hits})`);
    expect(offenders).toEqual([]);
  });

  it('滚动只有一个：ScrollArea 在面板域内恰好 1 处（在壳里），其余不得自建滚动', () => {
    const SHELL = 'panel-base-view.tsx';
    const offenders = panelFiles()
      .map((file) => ({ file: relative(file), src: code(file) }))
      .filter((row) =>
        row.file === SHELL
          ? // 壳**就是**那唯一滚动的提供者：恰好 1 处 `ScrollArea`，且它自己不得再开一层 overflow-auto。
            count(row.src, /<ScrollArea\b/g) !== 1 || /overflow-(?:y-)?auto/.test(row.src)
          : /ScrollArea|overflow-(?:y-)?auto/.test(row.src),
      )
      .map((row) => row.file);
    expect(offenders).toEqual([]);
  });

  /**
   * ⚠️ 这条是**事故判据**（2026-09-15）：用户的"左上角各 tab 参差 / 互相遮挡"，
   * 真身不是某个视图写错了类，而是：
   *   Radix 用 `hidden` **属性**隐藏非激活面板（`@radix-ui/react-tabs`→`hidden: !present`），
   *   它依赖 UA 样式 `[hidden]{display:none}`；而**作者 display 类会覆盖 UA 样式** ——
   *   调用点写 `className="flex flex-1 …"` 时，那个**空容器**仍参与布局并**与激活面板平分高度**
   *   ⇒ N 个 tab 时"内容只占 1/N、其余空白"，且空白忽上忽下。
   *
   * 【判据迁移(2026-09-15 · docs/135)】原判据是"原语里出现 `data-[state=inactive]:hidden` 这个**词**"——
   * 那是"文件里出现了什么词"，不是"代码做了什么"。自研 `TabsContent` 落地后改为判**行为**：
   *   ① 原语不再依赖 `radix-ui` / `@radix-ui/*`；
   *   ② `TabsContent` 实现体里存在按 `value` 判定的**提前 `return null`**（非激活 = 不渲染 = 不占位）；
   *   ③ 调用点**不得再出现占位补丁**（`hidden` / `data-[state=…]`）——占位该由原语承担，
   *      出现补丁就说明有人在调用点跟布局优先级搏斗。
   */
  it('非激活 tab 必须不占位：原语「非激活即不渲染」，调用点不得再出现占位补丁', () => {
    const primitive = code(TABS_PRIMITIVE);

    expect(primitive).not.toMatch(/from '(?:radix-ui|@radix-ui\/)/);
    expect(primitive).toMatch(/ctx\.value !== value\)\s*return null;/);

    const offenders = panelFiles()
      .flatMap((file) =>
        tabsContentClasses(code(file)).map((className) => ({ file: relative(file), className })),
      )
      .filter((row) =>
        row.className
          .split(/\s+/)
          .some((token) => token === 'hidden' || token.startsWith('data-[state=')),
      )
      .map((row) => `${row.file} → <TabsContent className="${row.className}">`);
    expect(offenders).toEqual([]);
  });

  it('占位必须撑满：每个 PanelState 都住在一个 PropertyGroup grow 里', () => {
    const offenders = panelFiles()
      .map((file) => {
        const source = code(file);
        return {
          file: relative(file),
          // TD-18-41 起域前缀强制 ⇒ 现行名 = `VideoEditorPanelState`；保留裸名以兼容旧名残留
          states: count(source, /<(?:VideoEditor)?PanelState\b/g),
          growGroups: count(source, /<PropertyGroup\s+grow\b/g),
        };
      })
      // 鸽笼原理：占位比 grow 分区多 ⇒ 至少一个占位没住进 grow（相等不是必要条件，见文件头 ③）
      .filter((row) => row.states > row.growGroups)
      .map((row) => `${row.file} (PanelState ${row.states} / grow 分区 ${row.growGroups})`);
    expect(offenders).toEqual([]);
  });
});
