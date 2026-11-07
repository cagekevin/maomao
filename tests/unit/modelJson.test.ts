/**
 * 「模型输出读 JSON」唯一原语的契约测试（TD-01-34）。
 *
 * 断言口径：**失败臂取不到值** —— 不只断 `ok===false`，还要断 `'value' in r` 为 false；
 * 否则「失败伪装成空值」回潮时这条测试不会红。
 */
import { describe, it, expect } from 'vitest';
import { parseModelJsonText } from '@/components/base/utils/text/modelJson.ts';

describe('parseModelJsonText · 提取', () => {
  it('```json 代码块 → 取块内对象', () => {
    const raw = '说明文字\n```json\n{"a":1}\n```\n结束';
    expect(parseModelJsonText(raw)).toEqual({ ok: true, value: { a: 1 } });
  });

  it('无代码块 → 截取首尾 {} 直接 parse', () => {
    expect(parseModelJsonText('前缀 {"b":2} 后缀')).toEqual({ ok: true, value: { b: 2 } });
  });

  it('纯数组回复 → 数组兜底', () => {
    expect(parseModelJsonText('[1,2,3]')).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('多个代码块 → 只认第一块（顺序是契约）', () => {
    const raw = '```json\n{"first":1}\n```\n中间\n```json\n{"second":2}\n```';
    expect(parseModelJsonText(raw)).toEqual({ ok: true, value: { first: 1 } });
  });

  it('无围栏但含围栏残留字符 → 仍能取出对象', () => {
    expect(parseModelJsonText('```\n{"c":3}\n```')).toEqual({ ok: true, value: { c: 3 } });
  });
});

describe('parseModelJsonText · 失败（判别联合，失败臂取不到值）', () => {
  it('非字符串 → not-string', () => {
    const r = parseModelJsonText(undefined);
    expect(r).toEqual({ ok: false, reason: 'not-string' });
    expect('value' in r).toBe(false);
  });

  it('空串 / 纯空白 → not-string（不是解析故障）', () => {
    expect(parseModelJsonText('')).toEqual({ ok: false, reason: 'not-string' });
    expect(parseModelJsonText('   ')).toEqual({ ok: false, reason: 'not-string' });
  });

  it('没有任何 JSON 块 → no-json-block（普通回复，正常结论）', () => {
    const r = parseModelJsonText('这是一段普通策划文字，没有 JSON。');
    expect(r).toEqual({ ok: false, reason: 'no-json-block' });
    expect('value' in r).toBe(false);
  });

  it('块内非法 JSON → parse-error，并带原始 error（要排查的真故障）', () => {
    const r = parseModelJsonText('{bad}');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('parse-error');
    expect(r.error).toBeInstanceOf(Error);
    expect('value' in r).toBe(false);
  });
});
