/**
 * PromptInput「运行期 @名 自动转缩略图」回归测试（docs/PromptInput-@名自动转缩略图 §8）。
 *
 * 背景：旧实现只在挂载/改名时全量重建（autoLinkAssetsByName），运行期打字/粘贴的
 * `@资产名` 因 effect 短路（serializeDOM===value）永不转换，必须打空格再退格才生效。
 * 本测试覆盖 §8.3 事件驱动接线：
 *  - 手输唯一名即转；@猫 有候选「猫A」不提前转、补打 A 后转；
 *  - 粘贴含 @名 文本即转；
 *  - @不存在的资产不误转；
 *  - IME 组字中不转；
 *  - 共享 value 双实例：焦点实例转 chip，光标不被面板实例抢走。
 */
import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import PromptInput from '../../src/components/base/prompt/PromptInput.tsx';

// jsdom 未实现 Range#getBoundingClientRect：@提及弹层定位（getAtRect）依赖它，
// 测试里输入 @ 会触发 detectMention → 无此方法直接抛错、中断 onInput（自动转换随之失效）。
// 仅在测试环境 polyfill，不动生产代码。
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () =>
    ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** 素材转 refImages；value 由 PromptInput 自持（onChange setState） */
function Harness({ assets }) {
  const [value, setValue] = useState('');
  const refImages = (assets || []).map((a, i) => ({
    id: a.id || `img-${i}`,
    label: a.label,
    url: a.url,
  }));
  return (
    <PromptInput value={value} onChange={setValue} refImages={refImages} refTexts={[]} richText />
  );
}

const placeCaretAtEnd = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
};

/** 模拟真实打字：字符追加进编辑器末尾的文本节点（光标落在文本节点内，而非元素边界），并派发 input */
const typeInto = (el, ch) => {
  const sel = document.getSelection();
  let last = el.lastChild;
  if (!last || last.nodeType !== Node.TEXT_NODE) {
    last = document.createTextNode('');
    el.appendChild(last);
  }
  last.appendData(ch);
  const range = document.createRange();
  range.setStart(last, last.textContent.length);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  fireEvent.input(el);
};

const chipOf = (el, id) => el.querySelector(`[data-ref-id="${id}"]`);

describe('PromptInput 运行期 @名 自动转芯片', () => {
  it('手输唯一名（@猫）→ 输入完成后自动变缩略图芯片', () => {
    const { container } = render(
      <Harness assets={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]} />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(el);
      typeInto(el, '@');
      typeInto(el, '猫');
    });

    expect(chipOf(el, 'img-1')).toBeTruthy();
  });

  it('@猫 但候选有「猫A」→ 不提前转；补打 A 成 @猫A 后转', () => {
    const { container } = render(
      <Harness
        assets={[
          { id: 'a', label: '猫', url: 'u/a.png' },
          { id: 'b', label: '猫A', url: 'u/b.png' },
        ]}
      />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(el);
      typeInto(el, '@');
      typeInto(el, '猫');
    });
    // 可扩展名（猫 → 猫A）：停在弹层/补打阶段，不提前转
    expect(el.querySelector('[data-ref-id]')).toBeNull();
    expect(el.textContent).toBe('@猫');

    act(() => {
      typeInto(el, 'A');
    });
    expect(chipOf(el, 'b')).toBeTruthy();
  });

  it('@猫 但候选有「花猫」（非前缀）→ 靠弹层候选判定不提前转', () => {
    const { container } = render(
      <Harness
        assets={[
          { id: 'a', label: '猫', url: 'u/a.png' },
          { id: 'c', label: '花猫', url: 'u/c.png' },
        ]}
      />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(el);
      typeInto(el, '@');
      typeInto(el, '猫');
    });

    // query='猫' 时弹层候选 = [猫, 花猫]（有其它候选）→ 不提前转
    expect(el.querySelector('[data-ref-id]')).toBeNull();
  });

  it('粘贴含 @资产名 文本 → 松手即变缩略图（无需再操作）', () => {
    const { container } = render(
      <Harness assets={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]} />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(el);
      fireEvent.paste(el, { clipboardData: { getData: () => '参考@猫 生成' } });
    });

    expect(chipOf(el, 'img-1')).toBeTruthy();
    // 剩余文本保留，序列化结果含芯片
    expect(el.textContent.replace(/\u200B/g, '')).toBe('参考猫 生成');
  });

  it('输入 @不存在的资产 → 保持纯文本，不误转', () => {
    const { container } = render(
      <Harness assets={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]} />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(el);
      for (const ch of ['@', '不', '存', '在']) typeInto(el, ch);
    });

    expect(el.querySelector('[data-ref-id]')).toBeNull();
    expect(el.textContent).toBe('@不存在');
  });

  it('IME 组字中不转；组字结束后补一个终结字符即转', () => {
    const { container } = render(
      <Harness assets={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]} />,
    );
    const el = container.querySelector('[contenteditable="true"]');

    act(() => {
      fireEvent.compositionStart(el);
      placeCaretAtEnd(el);
      typeInto(el, '@');
      typeInto(el, '猫');
    });
    // 组字中：onInput 守卫直接 return，不转换
    expect(el.querySelector('[data-ref-id]')).toBeNull();

    act(() => {
      fireEvent.compositionEnd(el);
      typeInto(el, ' '); // 组字结束后打字 → 空格终结，@猫 已封口 → 转
    });
    expect(chipOf(el, 'img-1')).toBeTruthy();
  });

  it('共享 value 双实例：焦点实例转 chip，光标不被面板实例抢走', () => {
    function Shared() {
      const [value, setValue] = useState('');
      return (
        <>
          <PromptInput
            value={value}
            onChange={setValue}
            refImages={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]}
            refTexts={[]}
            richText
          />
          <PromptInput
            value={value}
            onChange={setValue}
            refImages={[{ id: 'img-1', label: '猫', url: 'u/cat.png' }]}
            refTexts={[]}
            richText
          />
        </>
      );
    }
    const { container } = render(<Shared />);
    const [panel, full] = container.querySelectorAll('[contenteditable="true"]');

    act(() => {
      placeCaretAtEnd(full);
      typeInto(full, '@');
      typeInto(full, '猫');
    });

    // 焦点实例（full）就地转 chip；光标仍留在 full
    expect(chipOf(full, 'img-1')).toBeTruthy();
    const sel = document.getSelection();
    expect(full.contains(sel.anchorNode)).toBe(true);
    expect(panel.contains(sel.anchorNode)).toBe(false);
  });
});
