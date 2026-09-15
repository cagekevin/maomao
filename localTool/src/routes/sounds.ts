/**
 * 子模块 — 声音库（音效 / 音乐）路由 —— 视频剪辑器「音效 / 音乐」面板的**自建数据源**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么有它（TD-22-47）】剪辑器面板原先直接打 `/api/sounds/search` —— 那是 cutia
 * （Next 同源）时代的第三方代理端点（上游 Freesound，可由 `types/sounds.ts` 的
 * `username/downloads/rating/bitrate/samplerate` 字段完全对上），**本仓后端从未实现**：
 * 请求落到 catch-all 透传 → 打到一个不存在的上游 → 前端 `response.ok` 为假 → **静默空面板**。
 * 本轮按用户裁定改「**自建**」：不再依赖任何第三方，改为扫描本地目录。
 *
 * 【目录约定（唯一真源）】
 *   · `uploads/sounds/effects/`  —— 音效
 *   · `uploads/sounds/music/`    —— 音乐
 *   文件名（去扩展名）= 显示名；`kind` 由所在目录决定；音频文件经既有 `/files/` 静态服务
 *   （支持 Range + 长缓存）返回，**不另起文件服务**。
 *
 * 【空库是合法状态，不是错误】目录不存在 → 返回**空清单 + 目录相对路径**（`dir`），
 *   前端据此渲染「把音频放进这里」的引导 + 打开目录入口。
 *   这正修掉旧行为的病灶：以前是 404 → 前端静默显空，用户**无法分辨**"没有"和"坏了"。
 * ════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../utils/helpers.js';
import { getUploadDir } from '../db/database.js';
import { extToMime } from '../utils/mime.js';

/** kind → 磁盘子目录（相对 `uploads/`）；**唯一映射**，别处不得再写这两个字面量。 */
const SOUND_DIRS = {
  effect: 'sounds/effects',
  music: 'sounds/music',
} as const;

export type SoundKind = keyof typeof SOUND_DIRS;

/** 清单条目（前端 `SoundEffect` 的本地库子集；与第三方时代的字段刻意区分，见 types/sounds.ts）。 */
export interface SoundLibraryItem {
  /** 稳定数字 id（路径的 FNV-1a 哈希）—— 前端 `SoundEffect.id` 是 number，且存档要用它做键。 */
  id: number;
  name: string;
  kind: SoundKind;
  /** 供 `<audio>` / 入轨直接使用的 /files/ URL。 */
  url: string;
  ext: string;
  size: number;
}

/** FNV-1a 32 位：路径 → 稳定数字 id（同一文件跨重启/跨会话不变，存档键才靠得住）。 */
function hashPath(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * GET /api/sounds/library?kind=effect|music
 *
 * 返回 `{ code: 0, data: { kind, dir, items } }`。
 * 【为什么带 `dir`】空库时前端要能告诉用户"放到哪儿"，目录路径是后端的知识，不该由前端拼。
 */
export async function handleSoundsLibrary(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const kind: SoundKind = url.searchParams.get('kind') === 'music' ? 'music' : 'effect';
  const relDir = SOUND_DIRS[kind];
  const absDir = path.join(getUploadDir(), ...relDir.split('/'));

  const items: SoundLibraryItem[] = [];

  try {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      // 音频判型复用唯一 MIME 表（禁止在本文件另立扩展名白名单 —— 本仓 SSOT 纪律）。
      if (!extToMime(path.extname(entry.name).toLowerCase()).startsWith('audio/')) continue;

      const relPath = `${relDir}/${entry.name}`;
      items.push({
        id: hashPath(relPath),
        name: path.basename(entry.name, path.extname(entry.name)),
        kind,
        // percent-encode：文件名可能含中文/空格，/files/ 服务端会解码回真实路径（见 index.ts handleStaticFile）。
        url: `/files/${relDir}/${encodeURIComponent(entry.name)}`,
        ext: path.extname(entry.name).slice(1).toLowerCase(),
        size: fs.statSync(path.join(absDir, entry.name)).size,
      });
    }
  } catch {
    // 目录不存在 = **空库**（合法状态），不是错误。走下方的空清单返回（附 dir 供前端引导）。
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  return json(res, {
    code: 0,
    data: { kind, dir: relDir, items },
  });
}
