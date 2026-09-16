/**
 * URL 探测原语单测 —— fileNameFromUrl / relativePathFromFileUrl（2026-09-16 收口 TD-16-14 / TD-08-20）。
 *
 * 【为什么存在】此前全库有 13 份内联手写「URL→文件名/磁盘路径」提取，口径互不统一且已漂移：
 *   · 漏 decode：编码名 `my%20clip.png` 显示成裸 `%20`（VideoExtractNode 等）；
 *   · 不剥 `?`/`#`：`a.png?token=1` 取到 `a.png?token=1`（imageCompress / ImageZoomDialog）；
 *   · 裸 split：相对路径下取到查询片段（VideoGenerate / AssetNode 等）。
 * 本测试钉死唯一原语的两个契约，防漂移回归。
 */
import { describe, it, expect } from 'vitest';
import {
  fileNameFromUrl,
  relativePathFromFileUrl,
  toAbsoluteFileUrl,
} from '@/components/base/core/utils';

describe('fileNameFromUrl（URL → 文件名，剥 ?# + decode 一次）', () => {
  it('绝对 URL：取末段', () => {
    expect(fileNameFromUrl('https://cdn.example.com/a/b/clip.mp4')).toBe('clip.mp4');
  });

  it('相对 /files/ 路径：取末段（不加 base 也能解析）', () => {
    expect(fileNameFromUrl('/files/migrated/人物/a.png')).toBe('a.png');
  });

  it('剥查询串（旧 imageCompress 只剥 ? 不剥 # 的漂移点）', () => {
    expect(fileNameFromUrl('/files/a.png?token=1')).toBe('a.png');
    expect(fileNameFromUrl('/files/a.png#frag')).toBe('a.png');
    expect(fileNameFromUrl('/files/a.png?token=1#frag')).toBe('a.png');
  });

  it('decode 一次（旧 VideoExtractNode 漏 decode 的漂移点）', () => {
    expect(fileNameFromUrl('/files/my%20clip.png')).toBe('my clip.png');
    expect(fileNameFromUrl('/files/%E5%A6%B9.png')).toBe('妹.png');
  });

  it('空 / 非法 / 无末段 → 空串', () => {
    expect(fileNameFromUrl('')).toBe('');
    expect(fileNameFromUrl(null)).toBe('');
    expect(fileNameFromUrl(undefined)).toBe('');
    expect(fileNameFromUrl('https://x.com/')).toBe('');
  });
});

describe('relativePathFromFileUrl（URL → 相对 /files/ 磁盘路径）', () => {
  it('相对 /files/ 与绝对自指 URL 均剥前缀 + decode', () => {
    expect(relativePathFromFileUrl('/files/migrated/a.png')).toBe('migrated/a.png');
    expect(relativePathFromFileUrl('http://127.0.0.1:18080/files/migrated/a.png')).toBe(
      'migrated/a.png',
    );
  });

  it('剥 ?#（与 fileNameFromUrl 同口径）', () => {
    expect(relativePathFromFileUrl('/files/a.png?token=1')).toBe('a.png');
  });

  it('decode 一次（跨栈口径与后端 relativePathFromFileUrl 一致）', () => {
    expect(relativePathFromFileUrl('/files/my%20clip.png')).toBe('my clip.png');
  });

  it('非 /files/ 形态 → null（远程图 / data URL 不得返回看似合法的残串）', () => {
    expect(relativePathFromFileUrl('https://cdn.example.com/a.png')).toBeNull();
    expect(relativePathFromFileUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(relativePathFromFileUrl('')).toBeNull();
    expect(relativePathFromFileUrl(null)).toBeNull();
  });
});

describe('toAbsoluteFileUrl 不受本次收口影响（回归护栏）', () => {
  it('相对 /files/ 补全为绝对；其余原样', () => {
    expect(toAbsoluteFileUrl('/files/a.png')).toContain('/files/a.png');
    expect(toAbsoluteFileUrl('https://x.com/a.png')).toBe('https://x.com/a.png');
    expect(toAbsoluteFileUrl(null)).toBe('');
  });
});
