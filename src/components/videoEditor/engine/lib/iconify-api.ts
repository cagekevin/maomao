import { logger } from '@videoEditor/lib/logger';
import { API_BASE } from '../../../base/core/config.ts';

/**
 * 贴纸图标（iconify）**唯一入口**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【TD-22-47 收口】此前本文件持有 `ICONIFY_HOSTS` 三家回落链，而
 * `sticker-node.ts`（导出渲染）与 `timeline-element.tsx`（时间轴缩略）**各自手拼
 * `https://api.iconify.design/...` 直连公网** —— 三处三套判据，且都要求外网可达。
 * 现在统一走 localTool 代理 `/api/iconify/*`：
 *   · **出站收口**：localTool 是本仓唯一出站口，`fetchWithProxy` 自带「直连 → 代理隧道」兜底；
 *   · **回落链收在后端一份**（`localTool/src/routes/iconify.ts`），前端不再自己试三家；
 *   · 前端只剩**一个 URL 构造函数** `buildIconSvgUrl`，失败直接暴露（不再静默空图）。
 * ════════════════════════════════════════════════════════════════
 */
const ICONIFY_BASE = `${API_BASE}/api/iconify`;

async function fetchFromUpstream(path: string): Promise<Response> {
  const response = await fetch(`${ICONIFY_BASE}${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`iconify proxy failed: HTTP ${response.status}`);
  }
  return response;
}

export interface IconSet {
  prefix: string;
  name: string;
  total: number;
  author?: {
    name: string;
    url?: string;
  };
  license?: {
    title: string;
    spdx?: string;
    url?: string;
  };
  samples?: string[];
  category?: string;
  palette?: boolean;
}

export interface IconSearchResult {
  icons: string[];
  total: number;
  limit: number;
  start: number;
  collections: Record<string, IconSet>;
}

export interface CollectionInfo {
  prefix: string;
  total: number;
  title?: string;
  uncategorized?: string[];
  categories?: Record<string, string[]>;
  hidden?: string[];
  aliases?: Record<string, string>;
}

export async function getCollections(category?: string): Promise<Record<string, IconSet>> {
  try {
    const response = await fetchFromUpstream('/collections?pretty=1');
    const data = (await response.json()) as Record<string, IconSet>;

    if (category) {
      const filtered = Object.fromEntries(
        Object.entries(data).filter(([_key, info]) => info.category === category),
      ) as Record<string, IconSet>;
      return filtered;
    }

    return data;
  } catch (error) {
    logger.error('Failed to fetch collections:', error);
    return {};
  }
}

export async function getCollection(prefix: string): Promise<CollectionInfo | null> {
  try {
    const response = await fetchFromUpstream(`/collection?prefix=${prefix}&pretty=1`);
    return await response.json();
  } catch (error) {
    logger.error(`Failed to fetch collection ${prefix}:`, error);
    return null;
  }
}

export async function searchIcons(
  query: string,
  limit: number = 64,
  prefixes?: string[],
  category?: string,
): Promise<IconSearchResult> {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
    pretty: '1',
  });

  if (prefixes?.length) {
    params.append('prefixes', prefixes.join(','));
  }

  if (category) {
    params.append('category', category);
  }

  try {
    const response = await fetchFromUpstream(`/search?${params}`);
    return await response.json();
  } catch (error) {
    logger.error('Failed to search icons:', error);
    return {
      icons: [],
      total: 0,
      limit,
      start: 0,
      collections: {},
    };
  }
}

export interface IconSvgParams {
  color?: string;
  width?: number;
  height?: number;
  flip?: 'horizontal' | 'vertical' | 'horizontal,vertical';
  rotate?: number | string;
}

/**
 * 图标 SVG 的 **URL 唯一构造函数**（贴纸面板 / 导出渲染 / 时间轴缩略三处共用）。
 *
 * 【为什么不再收 host 参数】回落链已收进后端代理（上游三家由 `routes/iconify.ts` 依次尝试），
 * 前端留 host 参数只会诱导后人再写一次"自己回落"—— 那正是本轮消灭的第二份判据。
 */
export function buildIconSvgUrl(iconName: string, params?: IconSvgParams): string {
  const [prefix, name] = iconName.includes(':') ? iconName.split(':') : ['', iconName];

  if (!prefix || !name) {
    throw new Error('Invalid icon name format. Expected "prefix:name"');
  }

  const urlParams = new URLSearchParams();

  // `#` 由 URLSearchParams 编码成 %23（原实现先手工 replace 再 append，会把 % 二次编码）。
  if (params?.color) urlParams.append('color', params.color);
  if (params?.width) urlParams.append('width', params.width.toString());
  if (params?.height) urlParams.append('height', params.height.toString());
  if (params?.flip) urlParams.append('flip', params.flip);
  if (params?.rotate) urlParams.append('rotate', params.rotate.toString());

  const queryString = urlParams.toString();
  return `${ICONIFY_BASE}/${prefix}/${name}.svg${queryString ? `?${queryString}` : ''}`;
}

export const POPULAR_COLLECTIONS = {
  general: [
    { prefix: 'mdi', name: 'Material Design Icons' },
    { prefix: 'ic', name: 'Google Material Icons' },
    { prefix: 'ph', name: 'Phosphor' },
    { prefix: 'heroicons', name: 'Heroicons' },
    { prefix: 'lucide', name: 'Lucide' },
    { prefix: 'tabler', name: 'Tabler Icons' },
    { prefix: 'fe', name: 'Feather Icons' },
    { prefix: 'bi', name: 'Bootstrap Icons' },
  ],
  brands: [
    { prefix: 'simple-icons', name: 'Simple Icons' },
    { prefix: 'logos', name: 'SVG Logos' },
    { prefix: 'skill-icons', name: 'Skill Icons' },
    { prefix: 'devicon', name: 'Devicon' },
    { prefix: 'fa-brands', name: 'Font Awesome Brands' },
  ],
  emoji: [
    { prefix: 'noto', name: 'Noto Emoji' },
    { prefix: 'twemoji', name: 'Twemoji' },
    { prefix: 'fluent-emoji', name: 'Fluent Emoji' },
    { prefix: 'fluent-emoji-flat', name: 'Fluent Emoji Flat' },
    { prefix: 'emojione', name: 'EmojiOne' },
    { prefix: 'openmoji', name: 'OpenMoji' },
  ],
};
