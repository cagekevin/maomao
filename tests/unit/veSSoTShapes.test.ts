/**
 * 回归锁：剪辑器「同一事实的第二份」收口（母体 M-A）。
 *
 * ════════════════════════════════════════════════════════════════
 * 本轮清的同族债，各自锁一条：
 *   · TD-22-30 —— 字幕模板不再手抄 `TextElement` 全形状，且必须走唯一构造路径 `buildTextElement`；
 *   · TD-22-36 —— 动作参数契约只有 `TActionArgsMap` 一份（`ACTIONS[].args` 死副本已删）；
 *   · TD-22-28 —— 幽灵字段 `agentMessages` 已从类型与持久化层清干净；
 *   · TD-22-39 —— 库音频的取字节原语只有一处（原为 3 份逐字相同的 fetch+ok 校验）。
 * ════════════════════════════════════════════════════════════════
 * 说明：其中三条改用「源码级断言」（读文件比对）。它们锁的是**结构性事实**
 * （某副本不存在了 / 某原语只有一处），无法用运行期行为观察 —— 这正是防回潮所需的锁。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SUBTITLE_TEMPLATES,
  createSubtitleFromTemplate,
} from '../../src/components/videoEditor/constants/subtitle-constants';
import { buildTextElement } from '../../src/components/videoEditor/engine/timeline/element-utils';
import { ACTIONS } from '../../src/components/videoEditor/engine/lib/actions/definitions';

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8');
}

describe('TD-22-30 · 字幕模板：覆盖差 + 唯一构造路径', () => {
  it('createSubtitleFromTemplate 的结果与 buildTextElement 完全一致（无第二条构造路径）', () => {
    const template = SUBTITLE_TEMPLATES[0];

    const fromTemplate = createSubtitleFromTemplate({ template, startTime: 3 });
    const viaBuildTextElement = buildTextElement({
      raw: {
        ...template.styles,
        name: 'Subtitle',
        content: 'Your subtitle here',
      },
      startTime: 3,
    });

    expect(fromTemplate).toEqual(viaBuildTextElement);
  });

  it('模板覆盖的字段生效；未覆盖的字段走默认（覆盖差形状）', () => {
    const element = createSubtitleFromTemplate({
      template: SUBTITLE_TEMPLATES[0],
      startTime: 0,
    });

    expect(element.type).toBe('text');
    expect(element.fontSize).toBe(5); // 模板显式覆盖
    expect(element.fontFamily).toBe('Arial');
    // 模板未覆盖的字段必须由默认值兜底，而不是 undefined（这是「覆盖差」的意义）
    expect(element.color).toBeDefined();
    expect(typeof element.opacity).toBe('number');
  });

  it('8 个模板都只提供 styles（不再各自手抄整份 TextElement 形状）', () => {
    for (const template of SUBTITLE_TEMPLATES) {
      expect(Object.keys(template).sort()).toEqual(['styles', 'templateId', 'templateName']);
    }
  });

  it('字幕工厂走唯一构造路径 buildTextElement（源码级，防回到「直接展开模板字段」的旧写法）', () => {
    const src = read('src/components/videoEditor/constants/subtitle-constants.ts');
    expect(src).toContain('buildTextElement(');
    // ⚠️ 断言的字符串**不能是文件注释里会出现的词**（否则会与「为何改」的说明自相矛盾，
    //    本轮两次踩到：TD-22-28 的 `agentMessages`、这里的 `...elementProps`）。
    expect(src).not.toMatch(/\.\.\.elementProps\b/);
  });
});

// 【2026-09-16 · 已删】原 `TD-22-35 · 迁移返回形状复用 MigrationResult` 一整个 describe ——
// 它锁的是**已被删除的设计**（迁移器整层随 TD-02-35 载体收口删除）。留着它就是给后人
// 一个"这个契约还存在"的假象（SOP：锁着已撤销设计的测试必须删）。

describe('TD-22-36 · 动作参数契约只有一份', () => {
  it('ACTIONS 里不再有平行的 args 副本（唯一契约 = TActionArgsMap）', () => {
    const withArgs = Object.entries(ACTIONS).filter(([, definition]) => 'args' in definition);
    expect(withArgs).toEqual([]);
  });

  it('仍保留动作本身的元数据（描述/分类/默认键位不受影响）', () => {
    expect(ACTIONS['seek-forward'].defaultShortcuts).toEqual(['l']);
    expect(ACTIONS['freeze-frame'].category).toBe('编辑');
  });
});

describe('TD-22-28 · 幽灵字段已清干净', () => {
  it('类型层与持久化层都不再出现该字段/类型声明', () => {
    const files = [
      'src/components/videoEditor/types/project.ts',
      'src/components/videoEditor/engine/services/storage/types.ts',
      'src/components/videoEditor/engine/services/storage/service.ts',
    ];
    for (const file of files) {
      const src = read(file);
      // ⚠️ 只匹配**代码形态**，不匹配裸词 —— 这些文件里刻意留了「为什么删它」的说明注释，
      // 若断言 "文件不含 agentMessages 这个词"，就会与那句注释自相矛盾（本轮实测踩到）。
      expect(src).not.toMatch(/\bagentMessages\s*[?:,]/); // 字段声明 / 属性访问
      expect(src).not.toMatch(/\.agentMessages\b/);
      expect(src).not.toMatch(/\btype\s+AgentMessage\b/); // 类型别名占位
      expect(src).not.toMatch(/AgentMessage\[\]/); // 字段类型
    }
  });
});

describe('TD-22-39 · 库音频取字节原语唯一', () => {
  it('audio.ts 里只有一处 fetch 入口（原为 3 份逐字相同的骨架）', () => {
    const src = read('src/components/videoEditor/engine/lib/media/audio.ts');
    const fetchCalls = src.match(/await fetch\(/g) ?? [];
    expect(fetchCalls).toHaveLength(1);
    // 三处消费方都经同一个原语
    const viaPrimitive = src.match(/fetchLibraryAudioResponse\(/g) ?? [];
    expect(viaPrimitive.length).toBeGreaterThanOrEqual(3);
  });
});
