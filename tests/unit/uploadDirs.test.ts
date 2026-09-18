/**
 * uploadDirs.ts 目录登记与分域判据单测（TD-03-18）。
 *
 * 锁住「能落盘的目录」与「登记表」的一致性，以及分域判据（用户数据根开放 / 系统产物根封闭）。
 * 与后端 `localTool/test/subfolder-allow.test.js` 是同一条判据的两端表述，二者须行为一致。
 */
import { describe, it, expect } from 'vitest';
import {
  UPLOAD_DIRS,
  UPLOAD_ROOT_KIND,
  KNOWN_SUB_DIRS,
  CODE_GENERATED_USER_SUB_DIRS,
  isKnownUploadDir,
} from '../../src/components/base/utils/uploadDirs.ts';

describe('uploadDirs 登记表', () => {
  it('每个 UPLOAD_DIRS 值都有对应的顶层根分域归属', () => {
    for (const [key, value] of Object.entries(UPLOAD_DIRS)) {
      const root = value.includes('/') ? value.slice(0, value.indexOf('/')) : value;
      expect(UPLOAD_ROOT_KIND[root], `${key}=${value} 的顶层根 ${root} 未在 UPLOAD_ROOT_KIND 登记`).toBeDefined();
    }
  });

  it('所有嵌套 UPLOAD_DIRS 项（含斜杠）都在 KNOWN_SUB_DIRS 或 CODE_GENERATED_USER_SUB_DIRS 备案', () => {
    for (const [key, value] of Object.entries(UPLOAD_DIRS)) {
      if (!value.includes('/')) continue;
      const registered = KNOWN_SUB_DIRS.has(value) || CODE_GENERATED_USER_SUB_DIRS.has(value);
      expect(registered, `${key}=${value} 是嵌套目录但未备案`).toBe(true);
    }
  });

  it('face_mosaic 已补登记（TD-03-18：此前只在本表外裸写）', () => {
    expect(UPLOAD_DIRS.faceMosaic).toBe('canvas/face_mosaic');
    expect(KNOWN_SUB_DIRS.has('canvas/face_mosaic')).toBe(true);
  });

  it('migrated 是唯一的用户数据根', () => {
    const userRoots = Object.entries(UPLOAD_ROOT_KIND)
      .filter(([, kind]) => kind === 'user')
      .map(([root]) => root);
    expect(userRoots).toEqual(['migrated']);
  });

  it('已知的代码生成用户目录均在册', () => {
    for (const d of ['migrated/人物', 'migrated/场景', 'migrated/道具', 'migrated/脚本/尾帧变体']) {
      expect(CODE_GENERATED_USER_SUB_DIRS.has(d), `${d} 应在 CODE_GENERATED_USER_SUB_DIRS 备案`).toBe(true);
    }
  });
});

describe('isKnownUploadDir 分域判据', () => {
  it('顶层根本身一律放行', () => {
    for (const root of Object.keys(UPLOAD_ROOT_KIND)) {
      expect(isKnownUploadDir(root), `顶层根 ${root} 应放行`).toBe(true);
    }
  });

  it('用户数据根的子目录一律放行（用户可自建，不可枚举）', () => {
    for (const d of [
      'migrated/人物',
      'migrated/颜色',
      'migrated/HKH其他产品',
      'migrated/脚本/尾帧变体',
      'migrated/用户任意新建的',
    ]) {
      expect(isKnownUploadDir(d), `${d} 应放行`).toBe(true);
    }
  });

  it('系统产物根下已登记子目录放行', () => {
    for (const d of KNOWN_SUB_DIRS) {
      expect(isKnownUploadDir(d), `${d} 已登记应放行`).toBe(true);
    }
  });

  it('系统产物根下未登记子目录拒绝（孤儿目录入口）', () => {
    for (const d of ['canvas/cleaned', 'canvas/template', 'canvas/upload', 'canvas/新目录']) {
      expect(isKnownUploadDir(d), `${d} 未登记应拒绝`).toBe(false);
    }
  });

  it('未知顶层根拒绝', () => {
    expect(isKnownUploadDir('bogus')).toBe(false);
    expect(isKnownUploadDir('bogus/sub')).toBe(false);
  });
});
