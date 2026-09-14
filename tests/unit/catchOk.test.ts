import { describe, it, expect } from 'vitest';
import {
  CATCH_OK,
  CATCH_OK_CODES,
  type CatchOkCode,
} from '../../src/components/base/core/catchOk.ts';

describe('catchOk 登记表（TD-02-26 偿还 · 单一真源）', () => {
  it('所有理由码非空且 key === value（闸据此做白名单校验）', () => {
    const vals = Object.values(CATCH_OK) as string[];
    expect(vals.length).toBeGreaterThan(0);
    for (const [k, v] of Object.entries(CATCH_OK)) {
      expect(k).toBe(v);
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('CATCH_OK_CODES 与 CATCH_OK 值一致、无重复', () => {
    const vals = Object.values(CATCH_OK) as string[];
    expect(CATCH_OK_CODES.slice().sort()).toEqual(vals.slice().sort());
    expect(new Set(CATCH_OK_CODES).size).toBe(CATCH_OK_CODES.length);
  });

  it('类型 CatchOkCode 覆盖全部码', () => {
    const sample: CatchOkCode = CATCH_OK_CODES[0] as CatchOkCode;
    expect(typeof sample).toBe('string');
    expect(CATCH_OK_CODES).toContain(sample);
  });

  it('理由码均为大写蛇形（与闸正则 \\S+ / 白名单形态一致）', () => {
    for (const c of CATCH_OK_CODES) {
      expect(c).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
