/**
 * 深拷贝**必经唯一入口**的防回潮锁（TD-18-15 · ADR-0005 决议 1 / 判据 3）
 *
 * 【为什么必须有这条】`defaultNodeData` 曾用**裸 `structuredClone`** 深拷默认值，绕过 `core/utils.deepClone`。
 *   而原有 6 条 `nodeDataSchema` 用例**判别不出**这件事 —— 探针实测：把旧实现注回去，那 6 条**仍然全绿**
 *   （因为 `deepClone` 的实现**就是** `structuredClone`，两者行为完全等价）。
 *   ⇒ 「必经唯一入口」是**结构**性质，只能靠「断言它真的调了 `deepClone`」来锁，不能靠行为等价性。
 *
 * 【桩为什么从真模块派生】见 `17-跨区-mock桩脱钩收口-2026-09-18.md`：手抄导出面会在模块长大时整套件崩。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/components/base/core/utils.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/base/core/utils.ts')>();
  return { ...actual, deepClone: vi.fn(<T>(v: T): T => structuredClone(v)) };
});

import { deepClone } from '../../src/components/base/core/utils.ts';
import { defaultNodeData } from '../../src/components/canvas/contract/nodeDataSchema.ts';

describe('defaultNodeData 的深拷贝必经唯一入口（TD-18-15 锁）', () => {
  it('登记了默认值的类型：必须调用 deepClone（不得裸调 structuredClone）', () => {
    vi.mocked(deepClone).mockClear();
    defaultNodeData('imageBoxNode');
    expect(deepClone).toHaveBeenCalled();
  });

  it('未登记默认值的类型：不该多调一次深拷贝', () => {
    vi.mocked(deepClone).mockClear();
    defaultNodeData('group');
    expect(deepClone).not.toHaveBeenCalled();
  });
});
