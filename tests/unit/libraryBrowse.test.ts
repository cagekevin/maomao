// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  LIBRARY_ROOT,
  isLibraryRoot,
  libraryBrowseArgs,
  libraryUpFolder,
  isEmptyLibraryRoot,
} from '../../src/components/resource/libraryBrowse.ts';

// 素材库「目录浏览」规则层 —— 唯一实现（零 React / 零 store 依赖）。
describe('libraryBrowse：浏览规则', () => {
  it('根 → folderExact（精确，不含子目录）', () => {
    expect(libraryBrowseArgs(LIBRARY_ROOT)).toEqual({ folderExact: LIBRARY_ROOT });
  });

  it('子目录 → folder（前缀，含更深子目录）', () => {
    expect(libraryBrowseArgs(`${LIBRARY_ROOT}/人物`)).toEqual({ folder: `${LIBRARY_ROOT}/人物` });
  });

  it('isLibraryRoot：空串 / null / undefined 一律视为根（未指定 = 根）', () => {
    expect(isLibraryRoot(LIBRARY_ROOT)).toBe(true);
    expect(isLibraryRoot('')).toBe(true);
    expect(isLibraryRoot(null)).toBe(true);
    expect(isLibraryRoot(undefined)).toBe(true);
    expect(isLibraryRoot(`${LIBRARY_ROOT}/人物`)).toBe(false);
  });

  it('上钻：到根即返回 null（调用方自行决定落点）', () => {
    expect(libraryUpFolder(`${LIBRARY_ROOT}/人物`)).toBeNull(); // 父 = 根 → 到顶
    expect(libraryUpFolder(LIBRARY_ROOT)).toBeNull();
    expect(libraryUpFolder(`${LIBRARY_ROOT}/人物/子`)).toBe(`${LIBRARY_ROOT}/人物`);
  });
});

describe('isEmptyLibraryRoot：根空态判定（TD-03-15）', () => {
  // 【锁住的用户可见缺陷】根 = 「尚未归类」区（精确 migrated），而落盘即入库之后
  // 绝大部分行是系统产出（tasks/canvas），**不在根里** ⇒ 新库点开「全部」是空的、
  // 磁盘却躺着几千个文件。旧空态文案"该目录暂无素材"会把"素材在别处"误导成"素材没了"。
  // 本判据让 UI 能区分「根确实空」与「这个子目录空」，从而给出不同的说明。

  it('根 + 空 + 非加载 + 无错 → true（该给"素材在别处"的说明）', () => {
    expect(
      isEmptyLibraryRoot({
        folder: LIBRARY_ROOT,
        itemCount: 0,
        loading: false,
        hasError: false,
      }),
    ).toBe(true);
  });

  it('加载中不算空（避免闪一下"空"再跳成内容）', () => {
    expect(
      isEmptyLibraryRoot({ folder: LIBRARY_ROOT, itemCount: 0, loading: true, hasError: false }),
    ).toBe(false);
  });

  it('读失败**优先于**空态（不得把"读不到"说成"没有素材"）', () => {
    expect(
      isEmptyLibraryRoot({ folder: LIBRARY_ROOT, itemCount: 0, loading: false, hasError: true }),
    ).toBe(false);
  });

  it('有内容 = 非空', () => {
    expect(
      isEmptyLibraryRoot({ folder: LIBRARY_ROOT, itemCount: 3, loading: false, hasError: false }),
    ).toBe(false);
  });

  it('子目录为空 ≠ 根空（文案不同：子目录就是"这个目录里没有"）', () => {
    expect(
      isEmptyLibraryRoot({
        folder: `${LIBRARY_ROOT}/颜色`,
        itemCount: 0,
        loading: false,
        hasError: false,
      }),
    ).toBe(false);
  });
});
