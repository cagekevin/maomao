/**
 * `mediaRefFactsOf` —— 「一条 ref 能不能落地 / 落地要哪些事实」的**唯一判据**。
 *
 * 为什么单独锁它：画布入口（`App.handleImportPick` → assetNode）与剪辑器入口
 * （`link-media-refs.ts` → MediaAsset）都消费它，两侧只做字段名适配。
 * 它一旦判错（静默丢违约、拿 undefined 占位、把 contentId 当唯一形态），
 * 症状会出现在两个业务域、且表现不同（画布是节点空、剪辑器是类型强转）。
 */
import { describe, it, expect } from 'vitest';
import { mediaRefFactsOf } from '../../src/components/base/media/mediaRefTypes';
import type { MediaRef } from '../../src/components/base/media/mediaRefTypes';

const mk = (over: Partial<MediaRef> = {}): MediaRef => ({
  ref: 'generated:r1',
  source: 'generated',
  name: 'a.png',
  type: 'image',
  url: 'http://127.0.0.1:18080/files/tasks/a.png',
  ...over,
});

describe('mediaRefFactsOf：落地事实（唯一判据）', () => {
  it('照抄生产者给的可落地事实（url / type / name），contentId 有则带上', () => {
    const facts = mediaRefFactsOf([mk({ contentId: 'sha1:abc' })]);

    expect(facts).toHaveLength(1);
    expect(facts[0]).toEqual({
      name: 'a.png',
      type: 'image',
      url: 'http://127.0.0.1:18080/files/tasks/a.png',
      contentId: 'sha1:abc',
    });
  });

  it('无 contentId 时不产生该字段（不用 undefined 占位）', () => {
    const facts = mediaRefFactsOf([mk()]);

    expect('contentId' in facts[0]).toBe(false);
  });

  it('契约违约（无 url）→ 在根部抛出（不是返判别联合等消费端转发）', () => {
    const bad = mk({ ref: 'generated:r2', name: 'bad.png', url: '' });

    expect(() => mediaRefFactsOf([bad])).toThrow('素材「bad.png」没有可显示的地址，未能导入');
  });
});
