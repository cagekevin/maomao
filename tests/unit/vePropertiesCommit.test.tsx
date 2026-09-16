/**
 * 属性面板「两段提交」交互契约 —— **面板级行为测试网**（TD-22-20 · 2026-09-16）。
 *
 * 【为什么先铺这张网】TD-22-20 要把 properties 面板里逐处手抄的
 * 「draft ref + initial ref + onBlur 两段提交」收口成共用 hook（15 处 / 3 变体）。
 * 上一轮（2026-09-16 跨区轮 §四）取证后**推翻**了原描述的"纯机械重构、行为零变化"：
 *   ① 15 处至少 3 变体（text 内联两写 / video `commitNumberField` / Slider 的两段回调）；
 *   ② 同一字段的 `initialXxxRef` 被 `<Slider>` 与 `<Input>` **共享**（per-field hook 会改变该耦合）；
 *   ③ 3 个面板文件**零测试覆盖** ⇒ 盲改必然"漏 1 处 = 静默错"（A12 的形态）。
 * ⇒ 正确顺序：**先铺网（本文件）→ 再按变体分组迁移 → 每组先红后绿**。在此之前禁止盲改。
 *
 * 【锁的是什么契约（不是"函数被调用"，是可观察的提交语义）】
 *  - 编辑中（`onChange` / `onValueChange`）：`updateElements({ updates, pushHistory:false })`
 *    —— 实时预览，**不落历史**（否则拖一次滑杆 = 几十条撤销记录）；
 *  - 落定（`onBlur` / `onValueCommit`）：**先**把 initial 写回（`pushHistory:false`）、
 *    **再**提交最终值（`pushHistory:true`）—— 使历史栈里呈现为「从 initial 到 final 的**一次**变更」。
 *
 * 【为什么这条契约值得锁】上面"先还原再提交"的两步顺序，是撤销栈正确性的**唯一**保证，
 * 而它当前**逐处手抄**且无任何测试 —— 抄漏任何一处，用户感知是"撤销回不到原样"（静默错）。
 *
 * 【测试策略】
 *  - `useEditor` 打桩（只关心 `timeline.updateElements` 的**调用序**）；
 *  - `Slider` **用真实实现**：它是原生 `<input type="range">`（无 Radix）⇒ `fireEvent.change` 触发
 *    `onValueChange`、`fireEvent.pointerUp` 触发 `onValueCommit`（后者报元素当前值，见其实现注释）；
 *  - `Input` 用真实实现 ⇒ `change` / `blur` 即可。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const updateElements = vi.hoisted(() => vi.fn());

vi.mock('../../src/components/videoEditor/hooks-cutia/use-editor.ts', () => ({
  useEditor: () => ({ timeline: { updateElements } }),
}));

import { TextProperties } from '../../src/components/videoEditor/ui/editor/panels/properties/text-properties';
import { buildTextElement } from '../../src/components/videoEditor/engine/timeline/element-utils';
import {
  DEFAULT_BG_OPACITY,
  DEFAULT_BG_BORDER_RADIUS,
  DEFAULT_BG_PADDING_X,
  DEFAULT_BG_PADDING_Y,
} from '../../src/components/videoEditor/constants/text-constants';
import { VideoProperties } from '../../src/components/videoEditor/ui/editor/panels/properties/video-properties';
import { StickerProperties } from '../../src/components/videoEditor/ui/editor/panels/properties/sticker-properties';
import { AudioProperties } from '../../src/components/videoEditor/ui/editor/panels/properties/audio-properties';
import {
  buildVideoElement,
  buildStickerElement,
  buildUploadAudioElement,
} from '../../src/components/videoEditor/engine/timeline/element-utils';

/** 取第 n 次调用的实参（`updateElements({updates, pushHistory})`）。 */
const callAt = (n: number) =>
  updateElements.mock.calls[n]?.[0] as
    { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean } | undefined;

/** 只取"提交进了历史"的那几次（pushHistory !== false）。 */
const committedCalls = () =>
  updateElements.mock.calls
    .map((c) => c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean })
    .filter((a) => a.pushHistory !== false);

/** 只取"实时预览"的那几次（pushHistory === false）。 */
const previewCalls = () =>
  updateElements.mock.calls
    .map((c) => c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean })
    .filter((a) => a.pushHistory === false);

/**
 * 渲染面板。
 * `raw` 覆盖元素字段 —— ⚠️「样式」折叠组（背景 / 描边 / 阴影）**默认折叠**，
 * 只有该组任一字段有值时才展开（`hasStyleSection`）⇒ **要测背景字段就必须让 fixture 带上背景**，
 * 否则那些控件压根没渲染（`getByText` 会抛 not found）。
 */
const setup = (raw?: Record<string, unknown>) => {
  // `buildTextElement` 产出的是 `CreateTextElement`（工厂不负责 id，id 由插入轨道时给）
  // ⇒ 面板要的是 `TextElement`，这里固定一个 id（确定性，便于断言）。
  let element = {
    ...buildTextElement({ raw: { content: '你好', ...raw }, startTime: 0 }),
    id: 'text-1',
  };
  const view = render(<TextProperties elements={[{ element, trackId: 'track-1' }]} />);

  // 模拟真实环境的「写库 → 数据回流 → 面板重渲染」：
  // `updateElements` 是外部 store 的写入口，真实情况下 element 会被更新、面板随之重渲染。
  // 不模拟的话，受控 `<Slider>` 的 DOM value 会一直停在被重置的旧值上，
  // 而它 `onValueCommit` 报的是**元素当前值**（见 slider.tsx 的 `commit()`）⇒ 会报出一个
  // 没人提交过的旧值 —— 那是**测试环境的假象**，不是组件缺陷。
  updateElements.mockImplementation(
    (payload: { updates: { updates: Record<string, unknown> }[] }) => {
      for (const u of payload.updates) element = { ...element, ...u.updates } as typeof element;
      view.rerender(<TextProperties elements={[{ element, trackId: 'track-1' }]} />);
    },
  );

  return {
    get element() {
      return element;
    },
  };
};

/**
 * 「字号」那一组里的两个控件。
 * 面板里有多个 `input[type=number]` / `input[type=range]`（不透明度 / 位置 / 缩放 / 旋转…），
 * 按 role 取会命中多个 ⇒ 用**标签定位**（`PropertyItem` 是 `label + value` 的兄弟结构）。
 */
const fontSizeControls = () => {
  const scope = screen.getByText('字号').parentElement as HTMLElement;
  return {
    input: scope.querySelector('input[type="number"]') as HTMLInputElement,
    slider: scope.querySelector('input[type="range"]') as HTMLInputElement,
  };
};

// 顶层 beforeAll/Each：**所有** describe 共用（一度误写在某个 describe 内部 ⇒ 其余 describe 的调用跨用例累积，
// 断言里混进了上一个用例的调用记录，症状是"第一条 received 是 fontSize"）。
beforeEach(() => {
  updateElements.mockClear();
});

describe('属性面板两段提交契约（TD-22-20 测试网）', () => {
  it('字号 · Input 路径：编辑中只预览不落历史，失焦时「先还原 initial、再提交」', () => {
    const { element } = setup();
    const initial = element.fontSize;
    const { input } = fontSizeControls();

    // 编辑中：预览两次（20 → 21），全部 pushHistory:false
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: String(initial + 5) } });
    fireEvent.change(input, { target: { value: String(initial + 6) } });

    expect(previewCalls()).toHaveLength(2);
    expect(committedCalls()).toHaveLength(0);
    expect(callAt(1)?.updates[0].updates).toEqual({ fontSize: initial + 6 });

    // 失焦：两步——① 写回 initial（不落历史）② 提交最终值（落历史）
    fireEvent.blur(input);

    const seq = updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates.fontSize, a.pushHistory === true] as const;
    });
    expect(seq).toEqual([
      [initial + 5, false],
      [initial + 6, false],
      [initial, false], // ← 先还原（这一步是撤销栈正确性的关键）
      [initial + 6, true], // ← 再提交
    ]);
  });

  it('字号 · Slider 路径：拖动只预览、松手时同序提交（与 Input 路径共用同一个 initial ref）', () => {
    const { element } = setup();
    const initial = element.fontSize;
    const { slider } = fontSizeControls();

    fireEvent.change(slider, { target: { value: String(initial + 4) } });
    expect(committedCalls()).toHaveLength(0);

    fireEvent.pointerUp(slider);

    const seq = updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates.fontSize, a.pushHistory === true] as const;
    });
    expect(seq).toEqual([
      [initial + 4, false],
      [initial, false],
      [initial + 4, true],
    ]);
  });

  it('每次提交只产生**一次**历史记录（预览次数不影响历史条数）', () => {
    const { element } = setup();
    const { input } = fontSizeControls();

    fireEvent.focus(input);
    for (const delta of [1, 2, 3, 4, 5]) {
      fireEvent.change(input, { target: { value: String(element.fontSize + delta) } });
    }
    fireEvent.blur(input);

    expect(previewCalls().length).toBeGreaterThan(1);
    expect(committedCalls()).toHaveLength(1);
  });
});

/**
 * 组①（text 的 6 个数字字段）其余 5 个字段的**提交序 + 值域换算**锁。
 *
 * 字号的三条已覆盖 Slider / Input 两条路径；其余字段的 Slider 路径与字号**同形且共用同一个 hook**
 * （见 `use-draft-commit.ts`），故这里只用 Input 路径逐字段锁两件事：
 *   ① 同样遵守「先还原 initial、再提交」的序；
 *   ② 各字段的**值域换算**正确（percent 域字段落库要 /100；位置/旋转保留浮点原样，不取整）。
 * ② 是最容易在"抽取共用实现"时被抹平的差异（统一成"直接存输入值"就会让不透明度存成 42 而不是 0.42）。
 */
describe('组① 其余数字字段：提交序 + 值域换算（TD-22-20）', () => {
  const numberInputFor = (label: string) => {
    const scope = screen.getByText(label).parentElement as HTMLElement;
    return scope.querySelector('input[type="number"]') as HTMLInputElement;
  };

  /** 每次调用的 `[updates[0].updates, pushHistory]` 序。 */
  const seq = () =>
    updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates, a.pushHistory === true] as const;
    });

  it('不透明度：percent 域 → 落库 /100；先还原 initial 再提交', () => {
    const { element } = setup();
    const input = numberInputFor('不透明度');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    expect(seq()).toEqual([
      [{ opacity: 0.42 }, false],
      [{ opacity: element.opacity }, false],
      [{ opacity: 0.42 }, true],
    ]);
  });

  it('位置 X：浮点**原样**落库（不取整）；先还原 initial 再提交', () => {
    const { element } = setup();
    const input = numberInputFor('位置 X');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.blur(input);

    // 注意：面板经 `updateTransform` 写库 ⇒ updates 是**整个 transform 展开**后的对象
    //（`{ transform: { ...ref.element.transform, ...transformUpdates } }`），不是 `{ position }`。
    const xs = seq().map(([u, h]) => [(u.transform as { position: { x: number } }).position.x, h]);
    expect(xs).toEqual([
      [12.5, false],
      [element.transform.position.x, false],
      [12.5, true],
    ]);
  });

  it('位置 Y：浮点原样落库（同位置 X）', () => {
    const { element } = setup();
    const input = numberInputFor('位置 Y');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7.25' } });
    fireEvent.blur(input);

    const ys = seq().map(([u, h]) => [(u.transform as { position: { y: number } }).position.y, h]);
    expect(ys).toEqual([
      [7.25, false],
      [element.transform.position.y, false],
      [7.25, true],
    ]);
  });

  it('缩放：percent 域 → 落库 /100；先还原 initial 再提交', () => {
    const { element } = setup();
    const input = numberInputFor('缩放');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);

    const scales = seq().map(([u, h]) => [(u.transform as { scale: number }).scale, h]);
    expect(scales).toEqual([
      [1.5, false],
      [element.transform.scale, false],
      [1.5, true],
    ]);
  });

  it('旋转：浮点原样落库（不取整）；先还原 initial 再提交', () => {
    const { element } = setup();
    const input = numberInputFor('旋转');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '45.5' } });
    fireEvent.blur(input);

    const rotations = seq().map(([u, h]) => [(u.transform as { rotate: number }).rotate, h]);
    expect(rotations).toEqual([
      [45.5, false],
      [element.transform.rotate, false],
      [45.5, true],
    ]);
  });
});

/**
 * 组②（text 的非数字字段）—— 同一个 hook 的另外两种入口。
 *
 * 这一组证明"收口"没有把不同形态**强行统一成一个模式**，而是同一个 hook 支持多种入口：
 *  · **draft 入口**（`content` 走 Textarea）：与组① 的 Input 路径完全同形；
 *  · **值直传入口**（颜色走 ColorPicker 的 `onChange`/`onChangeEnd`；背景三项走 Slider）：
 *    调用方负责值域换算（如 ColorPicker 回传不带 `#` 的 hex ⇒ 调用方补 `#`）。
 */
describe('组② 非数字字段：draft 入口与值直传入口（TD-22-20）', () => {
  /** 取某个 label 所在 `PropertyItem` 内的控件。 */
  const scopeOf = (label: string) => screen.getByText(label).parentElement as HTMLElement;

  const seq = () =>
    updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates, a.pushHistory === true] as const;
    });

  it('文本内容（Textarea）：编辑中预览、失焦时先还原 initial 再提交', () => {
    const { element } = setup();
    const textarea = screen.getByPlaceholderText('输入文字');

    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: '你好世界' } });
    fireEvent.blur(textarea);

    expect(seq()).toEqual([
      [{ content: '你好世界' }, false],
      [{ content: element.content }, false],
      [{ content: '你好世界' }, true],
    ]);
  });

  it('文字颜色（ColorPicker）：回传不带 `#` ⇒ 调用方补 `#` 后入库', () => {
    const { element } = setup();
    const picker = scopeOf('颜色').querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#ff3b30' } });

    expect(seq()).toEqual([
      [{ color: '#ff3b30' }, false],
      [{ color: element.color || '#FFFFFF' }, false],
      [{ color: '#ff3b30' }, true],
    ]);
  });

  it('背景色（ColorPicker）：同上（初始值取字段现有值）', () => {
    const { element } = setup({ backgroundColor: '#123456' });
    const picker = scopeOf('背景').querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#00ff00' } });

    expect(seq()).toEqual([
      [{ backgroundColor: '#00ff00' }, false],
      [{ backgroundColor: element.backgroundColor }, false],
      [{ backgroundColor: '#00ff00' }, true],
    ]);
  });

  it('背景不透明度（Slider）：percent 域 ⇒ 落库 /100；initial 落在 0~1 域', () => {
    const { element } = setup({ backgroundColor: '#123456' });
    // ⚠️「不透明度」在本面板出现**两次**（文字 / 背景）—— 文字组在前、样式组在后，取后者。
    const slider = screen
      .getAllByText('不透明度')[1]
      .parentElement!.querySelector('input[type="range"]') as HTMLInputElement;
    // 断言复用面板自己的判据（字段缺省时回落到 DEFAULT_*），不手抄默认值。
    const initial = element.backgroundOpacity ?? DEFAULT_BG_OPACITY;

    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.pointerUp(slider);

    expect(seq()).toEqual([
      [{ backgroundOpacity: 0.5 }, false],
      [{ backgroundOpacity: initial }, false],
      [{ backgroundOpacity: 0.5 }, true],
    ]);
  });

  it('背景圆角（Slider）：值原样入库（不换算）', () => {
    const { element } = setup({ backgroundColor: '#123456' });
    const slider = scopeOf('圆角半径').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '24' } });
    fireEvent.pointerUp(slider);

    expect(seq()).toEqual([
      [{ backgroundBorderRadius: 24 }, false],
      [
        { backgroundBorderRadius: element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS },
        false,
      ],
      [{ backgroundBorderRadius: 24 }, true],
    ]);
  });

  it('背景高度（Slider · paddingY）：值原样入库', () => {
    const { element } = setup({ backgroundColor: '#123456' });
    const slider = scopeOf('高度').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '12' } });
    fireEvent.pointerUp(slider);

    expect(seq()).toEqual([
      [{ backgroundPaddingY: 12 }, false],
      [{ backgroundPaddingY: element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y }, false],
      [{ backgroundPaddingY: 12 }, true],
    ]);
  });

  it('背景宽度（Slider · paddingX）：值原样入库', () => {
    const { element } = setup({ backgroundColor: '#123456' });
    const slider = scopeOf('宽度').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '16' } });
    fireEvent.pointerUp(slider);

    expect(seq()).toEqual([
      [{ backgroundPaddingX: 16 }, false],
      [{ backgroundPaddingX: element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X }, false],
      [{ backgroundPaddingX: 16 }, true],
    ]);
  });
});

/**
 * 组②c（text 的描边 / 阴影）—— **对象字段**：多个入口改的是**同一个对象**
 * （描边：宽度滑杆 + 颜色选择器；阴影：X/Y 偏移 + 模糊 + 颜色）⇒ 共用同一个 hook 实例。
 *
 * 这两组还各自**条件渲染**（`strokeEnabled` = `width > 0`；`shadowEnabled`）⇒
 * fixture 必须带上对应对象，否则控件不在 DOM 里。
 */
describe('组②c 描边 / 阴影（对象字段）（TD-22-20）', () => {
  const scopeOf = (label: string) => screen.getByText(label).parentElement as HTMLElement;

  const seq = () =>
    updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates, a.pushHistory === true] as const;
    });

  const STROKE = { color: '#000000', width: 4 };
  const SHADOW = { offsetX: 2, offsetY: 2, blur: 4, color: '#000000' };

  it('描边宽度（Slider）：整个 stroke 对象写回；先还原 initial 再提交', () => {
    setup({ stroke: STROKE });
    // 「宽度」在面板里有两条（背景 paddingX / 描边 width），但本用例 fixture 只带 stroke
    // ⇒ 背景组折叠（`hasStyleSection` 仍因 stroke 为真而展开，段内条件渲染只出描边那条）
    // ⇒ 这里 `getByText('宽度')` 是唯一的。
    const slider = scopeOf('宽度').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.pointerUp(slider);

    const widths = seq().map(([u, h]) => [(u.stroke as { width: number }).width, h]);
    expect(widths).toEqual([
      [8, false],
      [4, false],
      [8, true],
    ]);
  });

  it('描边颜色（ColorPicker）：补 `#` 后写回**同一个** stroke 对象', () => {
    setup({ stroke: STROKE });
    const picker = scopeOf('描边').querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#ff3b30' } });

    const colors = seq().map(([u, h]) => [(u.stroke as { color: string }).color, h]);
    expect(colors).toEqual([
      ['#ff3b30', false],
      ['#000000', false],
      ['#ff3b30', true],
    ]);
  });

  it('阴影 X 偏移（Slider）：值原样写入 shadow 对象', () => {
    setup({ shadow: SHADOW });
    const slider = scopeOf('X 偏移').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '7' } });
    fireEvent.pointerUp(slider);

    const xs = seq().map(([u, h]) => [(u.shadow as { offsetX: number }).offsetX, h]);
    expect(xs).toEqual([
      [7, false],
      [2, false],
      [7, true],
    ]);
  });

  it('阴影模糊（Slider）：**另一个入口**，与 X 偏移共用同一个 shadow 实例', () => {
    setup({ shadow: SHADOW });
    const slider = scopeOf('模糊').querySelector('input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '12' } });
    fireEvent.pointerUp(slider);

    const blurs = seq().map(([u, h]) => [(u.shadow as { blur: number }).blur, h]);
    expect(blurs).toEqual([
      [12, false],
      [4, false],
      [12, true],
    ]);
  });

  it('阴影颜色（ColorPicker）：同样归还 shadow 对象', () => {
    setup({ shadow: SHADOW });
    const picker = scopeOf('阴影').querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#00ff00' } });

    const colors = seq().map(([u, h]) => [(u.shadow as { color: string }).color, h]);
    expect(colors).toEqual([
      ['#00ff00', false],
      ['#000000', false],
      ['#00ff00', true],
    ]);
  });
});

/**
 * 组③（video 面板 6 个字段）—— 与 text 同一套 hook。
 *
 * 这组原本有个**局部** `commitNumberField({draft, initial, apply})`：它只抽了"解析 + 清 initial"，
 * 两段提交仍写在每个 `apply` 回调里（= 换了个写法的同一种手抄）。迁移后该函数**已删**。
 *
 * 另外：video 的写库形状与 text 不同 —— 它是
 * `updates: [{ trackId, elementId, updates }]`（text 走 `buildBatchUpdates`，
 * 但因为 text 只选中一个元素，形状等价）；transform 类字段同样经 `updateTransform` 整体展开。
 */
describe('组③ video 面板 6 个字段（TD-22-20）', () => {
  const numberInputFor = (label: string) => {
    const scope = screen.getByText(label).parentElement as HTMLElement;
    return scope.querySelector('input[type="number"]') as HTMLInputElement;
  };

  const seq = () =>
    updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates, a.pushHistory === true] as const;
    });

  const setupVideo = () => {
    let element = {
      ...buildVideoElement({ mediaId: 'm1', name: 'v.mp4', duration: 10, startTime: 0 }),
      id: 'video-1',
    };
    const view = render(<VideoProperties _element={element} trackId="track-1" />);
    updateElements.mockImplementation(
      (payload: { updates: { updates: Record<string, unknown> }[] }) => {
        for (const u of payload.updates) element = { ...element, ...u.updates } as typeof element;
        view.rerender(<VideoProperties _element={element} trackId="track-1" />);
      },
    );
    return {
      get element() {
        return element;
      },
    };
  };

  it('位置 X：浮点原样写入 transform.position.x', () => {
    const { element } = setupVideo();
    const input = numberInputFor('位置 X');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.blur(input);

    const xs = seq().map(([u, h]) => [(u.transform as { position: { x: number } }).position.x, h]);
    expect(xs).toEqual([
      [12.5, false],
      [element.transform.position.x, false],
      [12.5, true],
    ]);
  });

  it('位置 Y：同位置 X', () => {
    const { element } = setupVideo();
    const input = numberInputFor('位置 Y');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7.25' } });
    fireEvent.blur(input);

    const ys = seq().map(([u, h]) => [(u.transform as { position: { y: number } }).position.y, h]);
    expect(ys).toEqual([
      [7.25, false],
      [element.transform.position.y, false],
      [7.25, true],
    ]);
  });

  it('缩放：percent 域 ⇒ 落库 /100', () => {
    const { element } = setupVideo();
    const input = numberInputFor('缩放');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);

    const scales = seq().map(([u, h]) => [(u.transform as { scale: number }).scale, h]);
    expect(scales).toEqual([
      [1.5, false],
      [element.transform.scale, false],
      [1.5, true],
    ]);
  });

  it('旋转：浮点原样写入', () => {
    const { element } = setupVideo();
    const input = numberInputFor('旋转');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '45.5' } });
    fireEvent.blur(input);

    const rotations = seq().map(([u, h]) => [(u.transform as { rotate: number }).rotate, h]);
    expect(rotations).toEqual([
      [45.5, false],
      [element.transform.rotate, false],
      [45.5, true],
    ]);
  });

  it('不透明度：percent 域 ⇒ 落库 /100（本面板直接写 element 字段，不经 transform）', () => {
    const { element } = setupVideo();
    const input = numberInputFor('不透明度');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    const opacities = seq().map(([u, h]) => [u.opacity as number, h]);
    expect(opacities).toEqual([
      [0.42, false],
      [element.opacity, false],
      [0.42, true],
    ]);
  });

  it('变速：倍率 + 同步换算 duration（旧速率由落库函数自行读取）', () => {
    const { element } = setupVideo();
    const input = numberInputFor('变速');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);

    const rates = seq().map(([u, h]) => [[u.playbackRate as number, u.duration as number], h]);
    expect(rates).toEqual([
      [[2, element.duration * (1 / 2)], false],
      [[1, element.duration * (1 / 1)], false],
      [[2, element.duration * (1 / 2)], true],
    ]);
  });
});

/**
 * 组④（sticker 6 + audio 2）—— 四个属性面板的**最后两个**。
 * sticker 与 text 同形（含颜色）；audio 与 video 同形（音量 + 变速）。
 * 两者原先各有自己的手抄/局部函数，迁移后都由同一个 `useDraftCommit` 承担
 * ⇒ **四个面板的「两段提交」到此只剩 1 份实现**。
 */
describe('组④ sticker / audio 面板（TD-22-20）', () => {
  const numberInputFor = (label: string) => {
    const scope = screen.getByText(label).parentElement as HTMLElement;
    return scope.querySelector('input[type="number"]') as HTMLInputElement;
  };

  const seq = () =>
    updateElements.mock.calls.map((c) => {
      const a = c[0] as { updates: { updates: Record<string, unknown> }[]; pushHistory?: boolean };
      return [a.updates[0].updates, a.pushHistory === true] as const;
    });

  const setupSticker = () => {
    let element = {
      ...buildStickerElement({ iconName: 'lucide:star', startTime: 0 }),
      id: 'sticker-1',
    };
    const view = render(<StickerProperties _element={element} trackId="track-1" />);
    updateElements.mockImplementation(
      (payload: { updates: { updates: Record<string, unknown> }[] }) => {
        for (const u of payload.updates) element = { ...element, ...u.updates } as typeof element;
        view.rerender(<StickerProperties _element={element} trackId="track-1" />);
      },
    );
    return {
      get element() {
        return element;
      },
    };
  };

  const setupAudio = () => {
    let element = {
      ...buildUploadAudioElement({
        mediaId: 'm1',
        name: 'a.mp3',
        duration: 8,
        startTime: 0,
      }),
      id: 'audio-1',
    };
    const view = render(<AudioProperties _element={element} trackId="track-1" />);
    updateElements.mockImplementation(
      (payload: { updates: { updates: Record<string, unknown> }[] }) => {
        for (const u of payload.updates) element = { ...element, ...u.updates } as typeof element;
        view.rerender(<AudioProperties _element={element} trackId="track-1" />);
      },
    );
    return {
      get element() {
        return element;
      },
    };
  };

  it('sticker 位置 X：浮点原样写入 transform', () => {
    const { element } = setupSticker();
    const input = numberInputFor('位置 X');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.blur(input);

    const xs = seq().map(([u, h]) => [(u.transform as { position: { x: number } }).position.x, h]);
    expect(xs).toEqual([
      [12.5, false],
      [element.transform.position.x, false],
      [12.5, true],
    ]);
  });

  it('sticker 缩放：percent 域 ⇒ 落库 /100', () => {
    const { element } = setupSticker();
    const input = numberInputFor('缩放');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);

    const scales = seq().map(([u, h]) => [(u.transform as { scale: number }).scale, h]);
    expect(scales).toEqual([
      [1.5, false],
      [element.transform.scale, false],
      [1.5, true],
    ]);
  });

  it('sticker 不透明度：percent 域 ⇒ 落库 /100', () => {
    const { element } = setupSticker();
    const input = numberInputFor('不透明度');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.blur(input);

    const opacities = seq().map(([u, h]) => [u.opacity as number, h]);
    expect(opacities).toEqual([
      [0.42, false],
      [element.opacity, false],
      [0.42, true],
    ]);
  });

  it('sticker 颜色（ColorPicker）：回传不带 `#` ⇒ 补 `#` 后入库', () => {
    const { element } = setupSticker();
    const picker = screen
      .getByText('颜色')
      .parentElement!.querySelector('input[type="color"]') as HTMLInputElement;

    fireEvent.change(picker, { target: { value: '#ff3b30' } });

    const colors = seq().map(([u, h]) => [u.color as string, h]);
    expect(colors).toEqual([
      ['#ff3b30', false],
      [element.color ?? '#000000', false],
      ['#ff3b30', true],
    ]);
  });

  it('audio 音量：percent 域（0~200）⇒ 落库 /100', () => {
    const { element } = setupAudio();
    const input = numberInputFor('音量');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);

    const volumes = seq().map(([u, h]) => [u.volume as number, h]);
    expect(volumes).toEqual([
      [1.5, false],
      [element.volume, false],
      [1.5, true],
    ]);
  });

  it('audio 变速：倍率 + 同步换算 duration', () => {
    const { element } = setupAudio();
    const input = numberInputFor('变速');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);

    const rates = seq().map(([u, h]) => [[u.playbackRate as number, u.duration as number], h]);
    expect(rates).toEqual([
      [[2, element.duration * (1 / 2)], false],
      [[1, element.duration * (1 / 1)], false],
      [[2, element.duration * (1 / 2)], true],
    ]);
  });
});
