// @vitest-environment node
/**
 * 回归锁：迁移的 fallback **不得再自建一套默认值**（TD-22-24）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约一：`DEFAULT_TEXT_ELEMENT` 是文本元素默认值的**唯一真源**。
 *   v1→v2 迁移原先另写一套字面量，实测漂移 **4 处**：
 *     fontSize 16↔15 · color #000000↔#ffffff · backgroundColor #FFFFFF↔transparent ·
 *     textAlign left↔center。
 *   ⇒ 同一个"用户没设过"的文本元素，**新建**（走 buildTextElement）与
 *     **升级旧工程**（走本迁移）会长成两副样子 —— 旧工程一升级，文字颜色/对齐/字号整体变样。
 *
 * 契约二：**数据字段**（content / name / duration / startTime / trimStart）缺失时保持
 *   `''` / `0` **保真**，不引默认值 —— 那会把旧工程里 duration=0 的片段"复活"。
 *
 * 【怎么走到 `transformTextTrack`】两条路：
 *   · `scene.tracks` **非空** → 原样返回（不转换）；
 *   · `scene.tracks` **空** → 从 legacy IndexedDB 读轨道，再 `transformTracks`。
 *   本测试造"空 tracks + 注入 `loadLegacyTracks`"，走**真实**的字段转换路径
 *   （不用 mock —— 早先 mock 掉 `IndexedDBAdapter` 会把整个模块的 import 绑定打坏，
 *    表现为所有 import 都 `not defined`，见区域日志弯路留痕）。
 * ════════════════════════════════════════════════════════════════
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformProjectV1ToV2 } from '../../src/components/videoEditor/engine/services/storage/migrations/transformers/v1-to-v2';
import { DEFAULT_TEXT_ELEMENT } from '../../src/components/videoEditor/constants/text-constants';

/**
 * legacy 时间轴库里"什么都没设过"的文本元素 —— 除 `type`（转换的入场券，缺失即被丢弃，
 * 见 `transformTextTrack` 的 `element.type !== 'text'` 守卫）外，其余字段全部缺失 → 全走 fallback。
 */
const LEGACY_TRACKS = [{ id: 't1', name: 'Text', type: 'text', elements: [{ type: 'text' }] }];

function makeV1Project() {
  return {
    id: 'p1',
    name: 'p1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: {
      id: 'p1',
      name: 'p1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    // tracks 为空 ⇒ 走 legacy 轨道加载 → transformTracks → transformTextTrack
    scenes: [{ id: 's1', name: 's1', isMain: true, tracks: [] }],
  };
}

async function migrate() {
  const result = await transformProjectV1ToV2({
    project: makeV1Project() as never,
    options: { loadLegacyTracks: async () => LEGACY_TRACKS },
  });
  const scenes = (result.project as { scenes: Array<{ tracks: Array<{ elements: never[] }> }> })
    .scenes;
  const tracks = scenes[0]?.tracks ?? [];
  expect(tracks.length, 'legacy 轨道应被迁移进来（注入生效）').toBe(1);
  return tracks[0].elements[0] as unknown as Record<string, unknown>;
}

describe('v1→v2 文本迁移的样式 fallback == DEFAULT_TEXT_ELEMENT（TD-22-24）', () => {
  it('fontSize / color / backgroundColor / textAlign 四处漂移已消除', async () => {
    const el = await migrate();

    expect(el.fontSize).toBe(DEFAULT_TEXT_ELEMENT.fontSize);
    expect(el.color).toBe(DEFAULT_TEXT_ELEMENT.color);
    expect(el.backgroundColor).toBe(DEFAULT_TEXT_ELEMENT.backgroundColor);
    expect(el.textAlign).toBe(DEFAULT_TEXT_ELEMENT.textAlign);
  });

  it('字体族 / 字重 / 字型 / 装饰同样引常量（值本就一致，引常量防下次漂移）', async () => {
    const el = await migrate();

    expect(el.fontFamily).toBe(DEFAULT_TEXT_ELEMENT.fontFamily);
    expect(el.fontWeight).toBe(DEFAULT_TEXT_ELEMENT.fontWeight);
    expect(el.fontStyle).toBe(DEFAULT_TEXT_ELEMENT.fontStyle);
    expect(el.textDecoration).toBe(DEFAULT_TEXT_ELEMENT.textDecoration);
  });

  it('数据字段保持**保真**：缺失即 ""/0，不引默认值（否则旧工程空片段会"复活"）', async () => {
    const el = await migrate();

    expect(el.content).toBe('');
    expect(el.duration).toBe(0);
    expect(el.startTime).toBe(0);
    expect(el.trimStart).toBe(0);
  });
});

describe('防「下次迁移照抄白名单」（TD-22-24 的深层风险）', () => {
  it('v1→v2 不再出现与常量冲突的样式字面量，且确实引了常量', () => {
    const src = readFileSync(
      join(
        process.cwd(),
        'src/components/videoEditor/engine/services/storage/migrations/transformers/v1-to-v2.ts',
      ),
      'utf8',
    );
    expect(src).not.toContain("fallback: '#FFFFFF'");
    expect(src).not.toContain("fallback: 'left'");
    expect(src).toContain('DEFAULT_TEXT_ELEMENT.fontSize');
    expect(src).toContain('DEFAULT_TEXT_ELEMENT.backgroundColor');
  });

  it('v2→v3 是**透传式**（`...project`）—— 「透传 + 显式覆盖」才是正确模式', () => {
    const src = readFileSync(
      join(
        process.cwd(),
        'src/components/videoEditor/engine/services/storage/migrations/transformers/v2-to-v3.ts',
      ),
      'utf8',
    );
    expect(src).toContain('...project');
  });
});
