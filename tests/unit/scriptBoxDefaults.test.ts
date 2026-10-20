/**
 * 剧本盒默认值单一源（TD-01-33）契约测试。
 *
 * 锁的是「同一个默认答案只有一处」这件事本身，而不是某个具体字面量：
 *  1. schema 基线与导出常量必须同一（禁止函数内再写一份 `'5s'` / `'固定'`）；
 *  2. 默认 playbook id 必须来自工作流表，且默认生图类型必须在该 playbook 里真实存在
 *     （否则 `resolveImageGenSys` 的 fallback 会落到空模板，UI 只剩最后兜底文案）；
 *  3. 时长解析全仓只有一份：缺省/非法 → 5 秒基线，下限 1 秒；
 *  4. `createNewShot` 的「引导预填」与「数据基线」差异**必须恰好是文档登记的那 5 项**
 *     （duration 3s / description / shotType 中景 / lighting 自然光 / sound 环境音）：
 *     其余字段一旦出现差异，说明又有人往新建模板里手抄了一份默认值。
 */
import { must } from '../helpers/must';
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASPECT_RATIO,
  DEFAULT_IMAGE_GEN_TYPE,
  DEFAULT_MOTION,
  DEFAULT_SHOT_DURATION,
  DEFAULT_TAIL_FRAME_VARIANT_ID,
  SHOT_TIMING_BASE_SECONDS,
  defaultScriptBoxTop,
  defaultShotFields,
  shotSeconds,
} from '@/components/scriptbox/scriptBoxSchema.ts';
import { MOTIONS, createNewShot } from '@/components/scriptbox/scriptBoxPrompts.ts';
import {
  DEFAULT_WORKFLOW,
  SCRIPT_BOX_WORKFLOWS,
} from '@/components/scriptbox/scriptBoxWorkflows.ts';

describe('剧本盒默认值单一源（TD-01-33）', () => {
  it('schema 基线 = 导出常量（不在函数体里另写字面量）', () => {
    const top = defaultScriptBoxTop();
    expect(top.aspectRatio).toBe(DEFAULT_ASPECT_RATIO);
    expect(top.customAspectRatio).toBe(DEFAULT_ASPECT_RATIO);

    const shot = defaultShotFields();
    expect(shot.duration).toBe(DEFAULT_SHOT_DURATION);
    expect(shot.motion).toBe(DEFAULT_MOTION);
    expect(shot.selectedTailFrameVariantId).toBe(DEFAULT_TAIL_FRAME_VARIANT_ID);
  });

  it('默认 playbook 取工作流表真源，且默认生图类型在该 playbook 里真实存在', () => {
    expect(defaultScriptBoxTop().playbookId).toBe(DEFAULT_WORKFLOW);
    const wf = must(SCRIPT_BOX_WORKFLOWS[DEFAULT_WORKFLOW], `工作流 ${DEFAULT_WORKFLOW}`);
    expect(Object.keys(wf.imageGenTemplates ?? {})).toContain(DEFAULT_IMAGE_GEN_TYPE);
  });

  it('shotSeconds：缺省/非法 → 5 秒基线，下限 1 秒（引擎与提示词共用同一份）', () => {
    expect(shotSeconds(undefined)).toBe(SHOT_TIMING_BASE_SECONDS);
    expect(shotSeconds('')).toBe(SHOT_TIMING_BASE_SECONDS);
    expect(shotSeconds('5s')).toBe(5);
    expect(shotSeconds('7s')).toBe(7);
    expect(shotSeconds(12)).toBe(12);
    expect(shotSeconds('abc')).toBe(SHOT_TIMING_BASE_SECONDS);
    // `n || 基线` 的既有判据：0 秒不是合法时长，回落到基线（改这条等于改产品行为）
    expect(shotSeconds('0s')).toBe(SHOT_TIMING_BASE_SECONDS);
    expect(shotSeconds('-3s')).toBe(1);
  });

  it('下拉默认项与数据基线同源（MOTIONS[0] === 默认运镜）', () => {
    expect(MOTIONS[0]).toBe(DEFAULT_MOTION);
  });

  it('createNewShot 与基线的差异恰好是登记的 5 项预填', () => {
    const created = createNewShot([]);
    const base = defaultShotFields();

    // 除「引导预填 + id/index」外的字段必须与基线逐字一致
    const {
      duration: _c1,
      description: _c2,
      shotType: _c3,
      lighting: _c4,
      sound: _c5,
      id: _c6,
      index: _c7,
      ...createdRest
    } = created;
    const {
      duration: _b1,
      description: _b2,
      shotType: _b3,
      lighting: _b4,
      sound: _b5,
      ...baseRest
    } = base;
    expect(createdRest).toEqual(baseRest);

    // 5 项预填的现值（改这里要同时改 createNewShot 上方的角色说明）
    expect(created.duration).toBe('3s');
    expect(created.shotType).toBe('中景');
    expect(created.lighting).toBe('自然光');
    expect(created.sound).toBe('环境音');
    expect(created.description).toContain('双击编辑');
  });
});
