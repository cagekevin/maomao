/**
 * budget — 生成任务预算真源（143 · S1′）
 * ------------------------------------------------------------
 * 锁三件事：
 *   ① 三模态各返对应值（数值口径，见 `src/budget.ts` 头部）；
 *   ② `override` 优先于默认（调用方本次耐心 > 后端默认）；
 *   ③ **非法 override 必须回落默认，不得变成「不超时 / 秒超时」** ——
 *      这是本条唯一有真实回归风险的点：`0 ?? 5 === 0`、`NaN ?? 5 === NaN`（`??` 只挡 nullish），
 *      而 `0` 在本仓 = 不掐点、`NaN` 让 setTimeout 立即触发。
 *
 * 走**公开路径** `budgetMsFor` 断言（不测内部常量表）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetMsFor, DEFAULT_BUDGET_MS } from '../src/budget.ts';

test('三模态各返对应值', () => {
  assert.equal(budgetMsFor('chat'), 180_000);
  assert.equal(budgetMsFor('image'), 300_000);
  assert.equal(budgetMsFor('video'), 600_000);
});

test('override 优先于默认', () => {
  assert.equal(budgetMsFor('video', 90_000), 90_000);
  assert.equal(budgetMsFor('image', 1), 1);
});

test('非法 override（0 / NaN / 负数 / 非数）⇒ 回落默认，不得变成「不超时」', () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      budgetMsFor('image', bad),
      DEFAULT_BUDGET_MS.image,
      `override=${String(bad)} 必须回落默认`,
    );
  }
  // @ts-expect-error 故意传错类型：运行期也必须回落，不许抛
  assert.equal(budgetMsFor('image', '9000'), DEFAULT_BUDGET_MS.image);
});

test('undefined 走默认（缺省即后端真相）', () => {
  assert.equal(budgetMsFor('chat', undefined), DEFAULT_BUDGET_MS.chat);
});
