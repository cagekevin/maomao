/**
 * 粘贴 / 拖入载荷的分类判据（2026-11-07 从 useAssetDropPaste.test.tsx 迁来）。
 *
 * 原锁法：renderHook + 假 ClipboardEvent，断言建了哪种节点。
 * 现改锁纯函数 `classifyPastedText` / `pickDropCandidate`（AGENTS.md §2.3）——
 * 真正会判错的是「这段载荷该建什么」，不是事件对象本身。
 */
import { describe, it, expect } from 'vitest';
import { classifyPastedText, pickDropCandidate } from '@/components/canvas/shell/pasteClassify.ts';

describe('classifyPastedText —— 粘贴该建什么', () => {
  it('空串 / 纯空白 → empty（不建节点、不提示）', () => {
    expect(classifyPastedText('')).toEqual({ kind: 'empty' });
    expect(classifyPastedText('   \n\t ')).toEqual({ kind: 'empty' });
  });

  it('节点组 JSON → node-group（交给宿主重建，本层不解释失败）', () => {
    const raw = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] });
    expect(classifyPastedText(raw)).toEqual({ kind: 'node-group' });
  });

  it('图片组 JSON → image-group，非字符串项被过滤', () => {
    const raw = JSON.stringify({
      type: 'mutiwindow-images',
      images: ['https://a/1.png', 42, null, 'https://a/2.png'],
    });
    expect(classifyPastedText(raw)).toEqual({
      kind: 'image-group',
      images: ['https://a/1.png', 'https://a/2.png'],
    });
  });

  it('图片组但 images 为空 → empty（不建空网格）', () => {
    expect(classifyPastedText(JSON.stringify({ type: 'mutiwindow-images', images: [] }))).toEqual({
      kind: 'empty',
    });
  });

  it('纯文本 → text，经 sanitize 清洗（压缩空行 / 去首尾空白 / tab 转空格）', () => {
    const d = classifyPastedText('  你好\n\n\n\n世界  ');
    expect(d).toEqual({ kind: 'text', text: '你好\n\n世界' });
    expect(classifyPastedText('a\tb')).toEqual({ kind: 'text', text: 'a b' });
  });

  it('普通 JSON（无 mutiwindow 标记）→ 仍当文本清洗，不当节点组', () => {
    const d = classifyPastedText('{"a":1}');
    expect(d).toEqual({ kind: 'text', text: '{"a":1}' });
  });
});

describe('pickDropCandidate —— 拖入非文件内容取哪个 URL', () => {
  it('text/uri-list 优先（拖网页图的标准 MIME）', () => {
    expect(pickDropCandidate('https://img/a.png', 'https://img/b.png')).toBe('https://img/a.png');
  });

  it('uri-list 为空 → 退回 text/plain', () => {
    expect(pickDropCandidate('  ', 'https://img/b.png')).toBe('https://img/b.png');
  });

  it('多行取首行（uri-list 每行一个 URL）', () => {
    expect(pickDropCandidate('https://img/a.png\nhttps://img/b.png', '')).toBe('https://img/a.png');
  });

  it('两者都空 → 空串（调用方据此不建节点）', () => {
    expect(pickDropCandidate('', '')).toBe('');
  });
});
