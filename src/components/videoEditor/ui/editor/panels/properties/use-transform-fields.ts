'use client';

import { useDraftCommit, type DraftCommitField } from './use-draft-commit';
import { clamp } from '@/components/base/core/utils.ts';

/**
 * 变换四字段（位置 X / 位置 Y / 缩放 / 旋转）的字段工厂 —— 第三批收口（2026-11-06）。
 *
 * 【它收口的重复】text / video / sticker 三个属性面板曾**逐字手抄**同一组
 * `useDraftCommit` 字段构造（posXField / posYField / scaleField / rotationField）：
 * value 口径（位置/旋转存**未取整**原始值、仅显示取整）、format/parse、
 * percent 域（缩放 10~500 落库 /100）、commit 模板（展开原 position 改一维 / 直写 rotate）——
 * 三份实现零差异，只有 `updateTransform` 的落库形态不同。
 *
 * 【为什么 updateTransform 由面板注入】text 面板是**多选批量**版（elementRefs.map 展开），
 * video / sticker 是**单元素**版 —— 这是三面板的真差异，属面板自身语义；
 * 本 hook 只收「字段怎么读、怎么格式化、怎么换算、提交什么增量」，不越权收「写给谁」。
 *
 * 【与 useDraftCommit 的关系】交互契约（两段提交 / initial 播种 / 撤销一步回原值）
 * 仍由 useDraftCommit 唯一实现（TD-22-20）；本 hook 只是四个字段的**参数模板**，
 * 不另立交互真相。text 面板独有的 fontSize/content/color/背景系/描边/阴影字段
 * 不在收口面，仍留在面板内。
 */
export interface TransformFieldDeps {
  /** 当前元素（读 transform 与 opacity 无关，仅 transform 四字段）。 */
  element: { transform: { position: { x: number; y: number }; scale: number; rotate: number } };
  /** 缩放的显示值（percent 域）。调用方已有 `Math.round(transform.scale * 100)`，不重复派生。 */
  scalePercent: number;
  /**
   * 变更提交入口（由面板注入：多选批量 or 单元素）。
   * `| undefined` 是给 `exactOptionalPropertyTypes` 的：面板侧转发时解构出的
   * 可选属性是 `boolean | undefined`，需在签名上显式容纳。
   */
  updateTransform: (opts: {
    updates: Record<string, unknown>;
    pushHistory?: boolean | undefined;
  }) => void;
}

/** 缩放允许的 percent 域（三面板同款）。 */
const SCALE_PERCENT_MIN = 10;
const SCALE_PERCENT_MAX = 500;

export function useTransformFields({
  element,
  scalePercent,
  updateTransform,
}: TransformFieldDeps): {
  posXField: DraftCommitField<number>;
  posYField: DraftCommitField<number>;
  scaleField: DraftCommitField<number>;
  rotationField: DraftCommitField<number>;
} {
  // 归一化 `pushHistory`（面板注入函数的可选参数在 exactOptionalPropertyTypes 下
  // 不接受显式 undefined）—— 归一化后面板侧 `pushHistory?: boolean` 签名无需改动。
  const applyTransform = (updates: Record<string, unknown>, pushHistory: boolean): void =>
    updateTransform({ updates, pushHistory });
  /** 位置 X：`value` 存**未取整**原始值，仅显示取整。 */
  const posXField = useDraftCommit<number>({
    value: element.transform.position.x,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (x, pushHistory) =>
      applyTransform({ position: { ...element.transform.position, x } }, pushHistory),
  });

  /** 位置 Y：同位置 X。 */
  const posYField = useDraftCommit<number>({
    value: element.transform.position.y,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (y, pushHistory) =>
      applyTransform({ position: { ...element.transform.position, y } }, pushHistory),
  });

  /** 缩放：percent 域（10~500），落库 /100。 */
  const scaleField = useDraftCommit<number>({
    value: scalePercent,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp(parsed, SCALE_PERCENT_MIN, SCALE_PERCENT_MAX);
    },
    commit: (percent, pushHistory) => applyTransform({ scale: percent / 100 }, pushHistory),
  });

  /** 旋转：`value` 存未取整原始值（同位置 X）。 */
  const rotationField = useDraftCommit<number>({
    value: element.transform.rotate,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (rotate, pushHistory) => applyTransform({ rotate }, pushHistory),
  });

  return { posXField, posYField, scaleField, rotationField };
}
