'use client';

import { useReducer, useRef } from 'react';

/**
 * 属性面板「编辑中预览 / 落定两段提交」的**唯一实现**（TD-22-20）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【它收口的交互契约】（三个面板曾逐处手抄 31 个字段，`initialXxxRef` 声明数）
 *
 *   1. **编辑中**（Input 的 `onChange` / Slider 的 `onValueChange`）
 *      → `commit(值, pushHistory:false)`：实时预览，**不落历史**。
 *      （否则拖一次滑杆/连打几个字，撤销栈里就是几十条记录。）
 *   2. **首次编辑时播种 `initial`**（该字段进入编辑那一刻的真实值）。
 *   3. **落定**（Input 的 `onBlur` / Slider 的 `onValueCommit`）
 *      → **先** `commit(initial, false)`、**再** `commit(最终值, true)`。
 *      这一步顺序是**撤销栈正确性的唯一保证**：预览期间外部 store 已被改过多次，
 *      只有先把它写回原值、再把最终值作为**唯一一次**历史变更提交，
 *      撤销才能一步回到"用户开始编辑之前"。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么是「一个字段一个实例」，而不是「一个控件一个实例」】
 * 同一个字段的 `<Slider>` 与 `<Input>` 是**同一个编辑会话**（拖完滑杆接着在输入框里微调，
 * 撤销应当**一次**回到原值）⇒ 两者必须共用同一个 `initial`。
 * 本 hook 按**字段**实例化，天然满足该耦合 —— 若按控件实例化，就会出现两个 initial 各记一半。
 *
 * ════════════════════════════════════════════════════════════════
 * 【用法】`commit` 里写该字段的落库方式（直接字段 / 经 transform 换算都可）：
 *
 * ```tsx
 * const fontSizeField = useDraftCommit<number>({
 *   value: element.fontSize,
 *   format: (v) => v.toString(),
 *   parse: (raw) => {
 *     const n = parseInt(raw, 10);
 *     return Number.isNaN(n) ? null : clamp(n, MIN_FONT_SIZE, MAX_FONT_SIZE);
 *   },
 *   commit: (fontSize, pushHistory) =>
 *     editor.timeline.updateElements({ updates: buildBatchUpdates({ fontSize }), pushHistory }),
 * });
 * // <Slider value={[element.fontSize]} onValueChange={([v]) => fontSizeField.onSliderChange(v)}
 * //         onValueCommit={([v]) => fontSizeField.onSliderCommit(v)} />
 * // <Input value={fontSizeField.display} onFocus={fontSizeField.onFocus}
 * //        onChange={(e) => fontSizeField.onChange(e.target.value)} onBlur={fontSizeField.onBlur} />
 * ```
 *
 * 【`parse` 返回 `null` 的含义】该输入**当前不构成一个合法值**（空串 / 非数字 / 越界被拒）。
 * 此时**不提交**（编辑中）或**回退到真实值**（落定时）—— 与手抄实现逐字一致：
 * 它们在 NaN 时提交 `element.<field>`（即"什么都没改"）。
 */
export interface DraftCommitField<T> {
  /** Input 的显示值：编辑中显示用户正在打的草稿，否则显示真实值。 */
  display: string;
  /** Input 的 `onFocus`。 */
  onFocus: () => void;
  /** Input 的 `onChange`（传 `event.target.value`）。 */
  onChange: (raw: string) => void;
  /** Input 的 `onBlur`。 */
  onBlur: () => void;
  /** Slider 的 `onValueChange`（值已在字段域，如 percent→实际值的换算由调用方在 Slider 侧完成）。 */
  onSliderChange: (value: T) => void;
  /** Slider 的 `onValueCommit`。 */
  onSliderCommit: (value: T) => void;
}

export function useDraftCommit<T>({
  value,
  format,
  parse,
  commit,
}: {
  /** 字段的真实值（用于播种 `initial` 与非编辑态显示）。 */
  value: T;
  /** 真实值 → Input 显示串。 */
  format: (value: T) => string;
  /** Input 显示串 → 值；`null` = 当前不构成合法值（不提交 / 落定时回退到真实值）。 */
  parse: (raw: string) => T | null;
  /** 落库方式（`pushHistory:false` = 预览，`true` = 作为一次历史变更提交）。 */
  commit: (value: T, pushHistory: boolean) => void;
}): DraftCommitField<T> {
  const isEditing = useRef(false);
  const draft = useRef('');
  /** 本次编辑会话的起点值；`null` = 尚未进入编辑。提交后清空（下一次会话重新播种）。 */
  const initial = useRef<T | null>(null);
  // 与手抄实现同款：ref 变了不会触发重渲染，而 `display` 依赖它们 ⇒ 手动重渲染。
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  /** 首次编辑时播种起点值（同一会话内后续编辑不再播种）。 */
  const seedInitial = () => {
    if (initial.current === null) initial.current = value;
  };

  /** 落定：先把起点值写回（不落历史），再把最终值作为唯一一次历史变更提交。 */
  const settle = (finalValue: T) => {
    if (initial.current === null) return; // 从未进入编辑（如聚焦后直接失焦）⇒ 无变更可落
    commit(initial.current, false);
    commit(finalValue, true);
    initial.current = null;
  };

  return {
    display: isEditing.current ? draft.current : format(value),

    onFocus: () => {
      isEditing.current = true;
      draft.current = format(value);
      forceRender();
    },

    onChange: (raw) => {
      draft.current = raw;
      forceRender();
      const parsed = parse(raw);
      if (parsed === null) return; // 非法中间态（如只输了个负号）：不提交，等它变合法
      seedInitial();
      commit(parsed, false);
    },

    onBlur: () => {
      // 落定时再解析一次。
      const parsed = parse(draft.current);
      if (parsed === null) {
        // 草稿是**非法**状态（空串 / 只输了个负号 / 打错）⇒ **放弃本次编辑**：
        // 不提交、不落历史；预览期间写进去的最后**有效**值就留在那里。
        // 【为什么不是"回退到真实值再提交"】那会往撤销栈里塞一条"什么都没变"的记录
        //（`initial` 与"当前值"多半同值）—— 用户按撤销时画面纹丝不动，是纯噪音。
        // 这个口径取自 video 面板原 `commitNumberField`（它正是"NaN 就不 apply"）。
        initial.current = null;
      } else {
        settle(parsed);
      }
      isEditing.current = false;
      draft.current = '';
      // 与手抄实现一致：落定后重渲染一次，让 `display` 从草稿切回真实值。
      forceRender();
    },

    onSliderChange: (v) => {
      seedInitial();
      commit(v, false);
    },

    onSliderCommit: (v) => {
      settle(v);
    },
  };
}
