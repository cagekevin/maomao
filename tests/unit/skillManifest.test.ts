import { describe, it, expect } from 'vitest';
import {
  parseSkillMarkdown,
  serializeSkillMarkdown,
  splitFrontmatter,
  sanitizeSkillLabel,
} from '../../src/components/agent/skill/rules/skillManifest.ts';

const ID = '6f1c2a90-3b7e-4d51-9a02-8c4f5b1d7e33';

const DOC = [
  '---',
  `id: ${ID}`,
  'name: 漫画生成',
  'description: 生成分镜式漫画页',
  'when-to-use: 用户要求画漫画时',
  'version: 2',
  'x-extra: keep-me',
  '---',
  '',
  '# 工作流',
  '',
  '1. 读 `references/workflow.md`',
  '',
].join('\n');

const fm = (...lines: string[]): string => ['---', ...lines, '---', '正文'].join('\n');

describe('parseSkillMarkdown', () => {
  it('解析出已知字段（id/name/description/version），正文剥掉 frontmatter', () => {
    const { manifest, body } = parseSkillMarkdown(DOC);

    expect(manifest.id).toBe(ID);
    expect(manifest.name).toBe('漫画生成');
    expect(manifest.description).toBe('生成分镜式漫画页');
    expect(manifest.version).toBe('2');
    expect(body).toContain('# 工作流');
    expect(body).not.toContain('name:');
  });

  it('已退役字段（when-to-use 等）走 unknown 原样保留：不再"假装懂"，但一个字不丢', () => {
    const { manifest } = parseSkillMarkdown(DOC);

    // 【2026-09-22 · docs/plan/142 §3.10】when-to-use / allowed-tools / user-invocable /
    // disable-model-invocation 已从"已知集合"删除（没有任何行为读它们）⇒ 落入 unknown 保真通道。
    expect(manifest.unknown).toEqual({
      'when-to-use': '用户要求画漫画时',
      'x-extra': 'keep-me',
    });
  });

  it('无 frontmatter → 整文件当正文，不丢内容（安全阀）', () => {
    const plain = '# 就是正文\nname: 这行不是 frontmatter';
    const { manifest, body } = parseSkillMarkdown(plain);

    expect(manifest.name).toBe('');
    expect(body).toBe(plain);
  });

  it('frontmatter 未闭合 → 整文件当正文，不丢内容（安全阀）', () => {
    const unclosed = ['---', 'name: x', '正文'].join('\n');
    const { manifest, body } = parseSkillMarkdown(unclosed);

    expect(manifest.name).toBe('');
    expect(body).toBe(unclosed);
  });

  it('非已知字段的多行续行会并入值（含已退役字段）', () => {
    const { manifest } = parseSkillMarkdown(fm('description: 第一行', '第二行'));
    const retired = parseSkillMarkdown(fm('name: x', 'allowed-tools: a', 'b, c')).manifest;

    expect(manifest.description).toBe('第一行\n第二行');
    // 已退役字段不再做"多行 ⇒ 作废"（那条防护的守护对象已不存在），一律按 unknown 原样带过
    expect(retired.unknown['allowed-tools']).toBe('a\nb, c');
  });

  it('引号值去引号（仍适用的唯一类型处理）', () => {
    const quoted = parseSkillMarkdown(fm('name: "带 空格 的名"')).manifest;

    expect(quoted.name).toBe('带 空格 的名');
  });

  it('空格/逗号/布尔写法这些"以前要按类型切"的字段，现在原样进 unknown（不再假装懂类型）', () => {
    const m = parseSkillMarkdown(
      fm(
        'name: x',
        'allowed-tools: a, b ,c',
        'user-invocable: YES',
        'disable-model-invocation: false',
      ),
    ).manifest;

    expect(m.unknown['allowed-tools']).toBe('a, b ,c');
    expect(m.unknown['user-invocable']).toBe('YES');
    expect(m.unknown['disable-model-invocation']).toBe('false');
  });

  it('空值行 = 不存在：可选标量/unknown 都由空折成"无"（TD-11-37）', () => {
    const { manifest } = parseSkillMarkdown(
      fm('name: x', 'description:', 'when-to-use:', 'version:', 'allowed-tools:', 'x-empty:'),
    );

    expect(manifest.version).toBeUndefined();
    // unknown 与已知字段**同口径**：空值不占位（此前 unknown 照写 `x-empty: `，是两副样子）
    expect(manifest.unknown).toEqual({});
    // name/description 是必填字段，回落空串（"写了空行"与"没有这一行"本来就同值）
    expect(manifest.name).toBe('x');
    expect(manifest.description).toBe('');
  });
});

describe('serializeSkillMarkdown（幂等口径：语义幂等 + 序列化自身稳定）', () => {
  it('parse ∘ serialize ∘ parse === parse', () => {
    const p1 = parseSkillMarkdown(DOC);
    const s1 = serializeSkillMarkdown(p1.manifest, p1.body);
    const p2 = parseSkillMarkdown(s1);

    expect(p2.manifest).toEqual(p1.manifest);
    expect(p2.body).toBe(p1.body);
  });

  it('serialize 自身稳定（再序列化字节相同）', () => {
    const p1 = parseSkillMarkdown(DOC);
    const s1 = serializeSkillMarkdown(p1.manifest, p1.body);
    const p2 = parseSkillMarkdown(s1);

    expect(serializeSkillMarkdown(p2.manifest, p2.body)).toBe(s1);
  });

  it('未知字段往返后仍在（不能因为"不认识"就丢掉）', () => {
    const p1 = parseSkillMarkdown(DOC);
    const round = parseSkillMarkdown(serializeSkillMarkdown(p1.manifest, p1.body));

    expect(round.manifest.unknown['x-extra']).toBe('keep-me');
  });

  it('带**空值行**的文档：语义幂等 ① 与序列化稳定 ② 同样成立（此前单测只有非空样例 —— TD-11-37）', () => {
    const doc = fm('name: x', 'description:', 'when-to-use:', 'version:', 'x-empty:', 'x-keep: v');
    const p1 = parseSkillMarkdown(doc);
    const s1 = serializeSkillMarkdown(p1.manifest, p1.body);

    expect(parseSkillMarkdown(s1).manifest).toEqual(p1.manifest);
    expect(serializeSkillMarkdown(parseSkillMarkdown(s1).manifest, p1.body)).toBe(s1);
    // 空值行确实被省略（不再写出 `x-empty: ` 这种带尾空格的"空占位"）
    expect(s1).not.toContain('x-empty');
    expect(s1).not.toContain('when-to-use');
    expect(s1).toContain('x-keep: v');
  });
});

describe('splitFrontmatter', () => {
  it('有 frontmatter 时 raw 非空，body 不含声明', () => {
    const { raw, body } = splitFrontmatter(DOC);

    expect(raw).toContain('name: 漫画生成');
    expect(body).toContain('# 工作流');
    expect(body).not.toContain('name:');
  });
});

describe('sanitizeSkillLabel（进 system 的注入面，必须先清洗）', () => {
  it('去控制字符与换行、压空白', () => {
    expect(sanitizeSkillLabel('a\u0000b\nc   d', 20)).toBe('a b c d');
  });

  it('超长截断并加省略号', () => {
    expect(sanitizeSkillLabel('一二三四五', 3)).toBe('一二三…');
  });

  it('非字符串 → 空串（不抛）', () => {
    expect(sanitizeSkillLabel(undefined, 5)).toBe('');
    expect(sanitizeSkillLabel({} as unknown, 5)).toBe('');
  });
});
