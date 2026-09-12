import { describe, it, expect } from 'vitest';
import {
  detectAssetType,
  detectFileType,
  classifyUrl,
  classifyAssetUrlKind,
  resolveAssetType,
  isAssetUrl,
  isAudio,
} from '../../src/components/base/utils/assetType.ts';

describe('assetType §2.17', () => {
  it('detectAssetType 按 dataURL 前缀/扩展名分类', () => {
    expect(detectAssetType('')).toBe('empty');
    expect(detectAssetType('data:video/mp4;base64,xxx')).toBe('video');
    expect(detectAssetType('data:audio/mp3;base64,xxx')).toBe('audio');
    expect(detectAssetType('data:text/plain;base64,xxx')).toBe('text');
    expect(detectAssetType('/files/a.png')).toBe('image');
    expect(detectAssetType('http://x/a.mp4')).toBe('video');
    expect(detectAssetType('http://x/a.mp3')).toBe('audio');
    expect(detectAssetType('http://x/a.txt')).toBe('text');
    expect(detectAssetType('http://x/a.webp')).toBe('image');
  });

  it('detectFileType 按 File.type/name', () => {
    // 用真实 File 对象（Node 22 起 File 已是全局），既零 cast 又贴近浏览器真实入参
    expect(detectFileType(new File([], 'a.png', { type: 'image/png' }))).toBe('image');
    expect(detectFileType(new File([], 'a.webm', { type: 'video/webm' }))).toBe('video');
    expect(detectFileType(new File([], 'a.wav', { type: 'audio/wav' }))).toBe('audio');
    expect(detectFileType(new File([], 'a.md', { type: 'text/markdown' }))).toBe('text');
    // 无 type 但 name 带扩展名也能识别
    expect(detectFileType(new File([], 'a.svg'))).toBe('image');
    expect(detectFileType(new File([], 'a.mp4'))).toBe('video');
  });

  it('isAssetUrl 识别 http/data/blob', () => {
    expect(isAssetUrl('http://x/y.png')).toBe(true);
    expect(isAssetUrl('https://x/y.png')).toBe(true);
    expect(isAssetUrl('data:image/png;base64,xxx')).toBe(true);
    expect(isAssetUrl('blob:http://x/abc')).toBe(true);
    expect(isAssetUrl('/files/y.png')).toBe(false);
    expect(isAssetUrl('hello')).toBe(false);
  });

  it('isAudio 按 type 或扩展名', () => {
    expect(isAudio('audio', undefined)).toBe(true);
    expect(isAudio('video', '/x.mp3?t=1')).toBe(true);
    expect(isAudio(undefined, '/x.wav')).toBe(true);
    expect(isAudio('image', '/x.png')).toBe(false);
  });
});

/**
 * 媒体判型唯一真值源（EXT_KIND 一张表）—— 此前的 5 处就地正则已全部委托本模块。
 * 本组用「对账断言」把统一钉住：detectAssetType / classifyUrl / isAudio 必须始终与同一张表一致，
 * 今后任何一处再另起一套判型都会在这里先红。
 */
describe('媒体判型唯一真值源（EXT_KIND 表）', () => {
  it('data: 前缀优先于扩展名（data:video/ogg 仍是视频）', () => {
    expect(classifyAssetUrlKind('data:video/ogg;base64,xxx')).toBe('video');
    expect(classifyAssetUrlKind('data:audio/ogg;base64,xxx')).toBe('audio');
  });

  it('ogg 归音频、ogv 归视频、oga 归音频（历史漂移已统一）', () => {
    expect(classifyAssetUrlKind('http://x/a.ogg')).toBe('audio');
    expect(classifyAssetUrlKind('http://x/a.ogv')).toBe('video');
    expect(classifyAssetUrlKind('http://x/a.oga')).toBe('audio');
    // 旧 classifyUrl 把 ogg 当 video、旧 detectAssetType 漏认 ogv —— 现两者一致
    expect(classifyUrl('http://x/a.ogg')).toBe('audio');
    expect(detectAssetType('http://x/a.ogv')).toBe('video');
  });

  it('带查询串/锚点先剥离再判（不再因 ?token= 漏判成 image）', () => {
    expect(detectAssetType('http://x/a.mp4?token=1')).toBe('video');
    expect(detectAssetType('http://x/a.mov#t=1')).toBe('video');
    expect(classifyUrl('http://x/a.flac?t=1')).toBe('audio');
    expect(classifyAssetUrlKind('http://x/a.mp3?file=b.mp4')).toBe('audio'); // 不误读查询串里的 .mp4
  });

  it('大小写不敏感；无扩展名 / 未知 / 空 返回 null（不猜）', () => {
    expect(classifyAssetUrlKind('HTTP://X/A.MP4')).toBe('video');
    expect(classifyAssetUrlKind('blob:http://127.0.0.1:3000/x')).toBeNull();
    expect(classifyAssetUrlKind('/files/noext')).toBeNull();
    expect(classifyAssetUrlKind('')).toBeNull();
    expect(classifyAssetUrlKind(null)).toBeNull();
  });

  it('未知 data: URI 不扫 base64，直接 null（性能 + 不误判）', () => {
    expect(classifyAssetUrlKind('data:application/octet-stream;base64,AAA')).toBeNull();
  });

  it('对账：detectAssetType 与 classifyUrl 同表（text/empty 在产出类型里归 image）', () => {
    const urls = [
      'http://x/a.png',
      'http://x/a.mp4',
      'http://x/a.mp3',
      'http://x/a.txt',
      'http://x/a.ogg',
      'http://x/a.ogv',
      'http://x/a.webm?t=1',
      'data:video/mp4;base64,x',
      'data:audio/mp3;base64,x',
      'blob:http://x/0',
      '',
    ];
    for (const u of urls) {
      const d = detectAssetType(u);
      expect(classifyUrl(u), `classifyUrl 应与 detectAssetType 同表：${u}`).toBe(
        d === 'text' || d === 'empty' ? 'image' : d,
      );
    }
  });

  it('resolveAssetType：产出方声明优先于扩展名（blob/无扩展名兜底）', () => {
    expect(resolveAssetType('blob:http://x/0', 'audio')).toBe('audio');
    expect(resolveAssetType('blob:http://x/0', 'video')).toBe('video');
    expect(resolveAssetType('http://x/a.mp4', undefined)).toBe('video');
    expect(resolveAssetType('http://x/a.mp3', undefined)).toBe('audio');
    expect(resolveAssetType('http://x/a.png', undefined)).toBe('image');
    expect(resolveAssetType('', undefined)).toBe('image');
  });

  it('detectFileType：mime 优先于扩展名（旧实现按 name 先命中会判反）', () => {
    expect(detectFileType(new File([], 'a.png', { type: 'video/webm' }))).toBe('video');
    expect(detectFileType({ name: 'a.png', type: 'audio/mpeg' })).toBe('audio');
  });

  it('detectFileType：无 mime 时走同一张扩展名表（含新增 ogv/opus/srt）', () => {
    expect(detectFileType(new File([], 'a.ogv'))).toBe('video');
    expect(detectFileType(new File([], 'a.opus'))).toBe('audio');
    expect(detectFileType(new File([], 'a.srt'))).toBe('text');
    expect(detectFileType({ name: 'a.zip' })).toBe('other');
    expect(detectFileType(null)).toBe('other');
  });

  it('isAudio 与扩展名表同源（不再自带一套正则）', () => {
    expect(isAudio(undefined, '/x.ogg')).toBe(true);
    expect(isAudio(undefined, '/x.ogv')).toBe(false);
    expect(isAudio(undefined, '/x.opus?t=1')).toBe(true);
    expect(isAudio(undefined, '/x.mp4')).toBe(false);
  });
});
