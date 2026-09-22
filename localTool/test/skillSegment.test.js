/**
 * 跨栈对账 · 「技能目录/分类名单段合法性」共享向量（TD-11-79）。
 *
 * 【与前端配对】`tests/unit/skillDirSegment.parity.test.ts` 断言同一份
 * `scripts/skill-segment-vectors.json` 对**前端** `isLegalDirSegment` 的期望；
 * 本文件断言它对**后端权威** `isSafeSegment` 的期望。任一侧漂移 ⇒ 该侧测试红。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeSegment, SKILL_MAX_DIR_SEGMENT_LEN } from '../src/utils/skillSegment.ts';

const here = dirname(fileURLToPath(import.meta.url));
const { vectors } = JSON.parse(
  readFileSync(resolve(here, '../../scripts/skill-segment-vectors.json'), 'utf8'),
);

test('共享向量的每一条都与后端权威谓词一致', () => {
  for (const v of vectors) {
    assert.equal(isSafeSegment(v.input), v.legal, `input=${JSON.stringify(v.input)}`);
  }
});

test('长度边界与跨栈常量同源（恰好上限合法、多一个字符非法）', () => {
  assert.equal(isSafeSegment('a'.repeat(SKILL_MAX_DIR_SEGMENT_LEN)), true);
  assert.equal(isSafeSegment('a'.repeat(SKILL_MAX_DIR_SEGMENT_LEN + 1)), false);
});

test('非字符串输入一律拒绝', () => {
  assert.equal(isSafeSegment(null), false);
  assert.equal(isSafeSegment(undefined), false);
  assert.equal(isSafeSegment(123), false);
});
