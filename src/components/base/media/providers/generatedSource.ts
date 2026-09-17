/**
 * 来源 provider · 生成（`source='generated'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【与「素材库」是**不同数据源**（用户裁定 2026-09-17）】
 *  · 生成 = `fetchResources({ folder:'tasks' })` —— AI 产出落盘处
 *    （与 `GeneratedView.tsx:176` 同口径，**硬编码 tasks 目录**）；
 *  · 素材库 = `fetchResources({ folder: 空 })` —— 用户自己的目录（migrated/…）。
 *  **画布里的图与生成结果未必是同一批**（生成产出会落 tasks 目录并登记），故独立成来源。
 *
 * 【为什么是 provider 而不是复制一份映射逻辑】
 * 二者读取路径完全相同（都是 `fetchResources` → `ResourceItem` → `MediaRef`），
 * 差异**只有一个 folder 字面量**。故本 provider **委托 `librarySourceProvider.list`**
 * 并注入 `folder:'tasks'`（M3 母体：同一映射不抄第二份）。
 * `source` 与 `ref` 前缀标 `'generated'`（去重身份与素材库区分开）。
 * ════════════════════════════════════════════════════════════════
 */
import { librarySourceProvider } from './librarySource.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/** 生成结果的落盘目录（唯一真源口径，与 GeneratedView.tsx 一致）。 */
export const GENERATED_FOLDER = 'tasks';

export const generatedSourceProvider: MediaRefProvider = {
  source: 'generated',
  label: '生成',
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    const items = await librarySourceProvider.list({ ...query, folder: GENERATED_FOLDER });
    // 只改 source 与 ref 前缀（映射/过滤/归一全部复用 library provider）。
    // ref 必须经 makeMediaRef 重造（禁止手拼 —— 契约铁律 2）。
    return items.map((it) => ({
      ...it,
      source: 'generated' as const,
      ref: makeMediaRef('generated', it.ref.replace(/^library:/, '')),
    }));
  },
};
