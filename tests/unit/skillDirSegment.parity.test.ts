/**
 * 跨栈对账 · 「技能目录/分类名单段合法性」共享向量（TD-11-79）。
 *
 * 【为什么这样测】这条判据的**两侧载体**是前端 `isLegalDirSegment`（早退）与后端 `isSafeSegment`（权威）
 * —— 跨栈无共享模块是结构必然，此前两侧逻辑只能靠人读对齐、无任何机器对账。
 * 现两侧各自断言**同一份** `scripts/skill-segment-vectors.json`：任一侧漂移 ⇒ 该侧变红。
 * （对账测试优先于新增闸 —— 见「建闸前置评审」手段优先级 4 > 6。）
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isLegalDirSegment,
  SKILL_MAX_DIR_SEGMENT_LEN,
} from '@/components/agent/skill/rules/skillDirName';

interface Vector {
  input: string;
  legal: boolean;
}

const { vectors } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scripts/skill-segment-vectors.json'), 'utf8'),
) as { vectors: Vector[] };

describe('跨栈对账 · 目录名单段合法性（TD-11-79）', () => {
  it('共享向量的每一条都与前端谓词一致', () => {
    for (const v of vectors) {
      expect(isLegalDirSegment(v.input), `input=${JSON.stringify(v.input)}`).toBe(v.legal);
    }
  });

  it('长度边界与跨栈常量同源（恰好上限合法、多一个字符非法）', () => {
    expect(isLegalDirSegment('a'.repeat(SKILL_MAX_DIR_SEGMENT_LEN))).toBe(true);
    expect(isLegalDirSegment('a'.repeat(SKILL_MAX_DIR_SEGMENT_LEN + 1))).toBe(false);
  });

  it('非字符串输入一律拒绝', () => {
    expect(isLegalDirSegment(null)).toBe(false);
    expect(isLegalDirSegment(undefined)).toBe(false);
    expect(isLegalDirSegment(123)).toBe(false);
  });
});
