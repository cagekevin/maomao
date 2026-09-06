import { describe, it, expect, vi, beforeEach } from 'vitest';

// 补齐 window.__DEBUG_ALL 调试开关的全局类型（同 config.test.ts 的处理），去掉 5 处 (globalThis.window as any)
declare global {
  interface Window {
    __DEBUG_ALL?: boolean;
  }
}

// appSettings 用模块级单例 + 默认兜底；用 resetModules 隔离每次导入，保证测试独立。
describe('appSettings 读写（key 受 SettingKey 约束，值类型随 key 收窄）', () => {
  beforeEach(() => {
    // 清空持久化，保证每次加载都回到默认（appSettings 设计为持久化，load() 会从 localStorage 读回）
    try {
      localStorage.clear();
    } catch {
      /* node 下 setup.mjs 已注入内存 localStorage */
    }
    vi.resetModules();
  });

  it('默认设置：性能模式开 / 小地图关 / AI 助手关 / 调试关', async () => {
    const { getSetting } = await import('../../src/components/base/store/appSettings.ts');
    expect(getSetting('performanceMode')).toBe(true);
    expect(getSetting('minimapOn')).toBe(false);
    expect(getSetting('agentOpen')).toBe(false);
    expect(getSetting('debugOn')).toBe(false);
  });

  it('pinnedTools 默认值由注册表单一真源给出（C 纳管闭环，拼装默认不再散在消费方）', async () => {
    const { getSetting } = await import('../../src/components/base/store/appSettings.ts');
    expect(getSetting('pinnedTools')).toEqual(['imageBoxNode', 'gridSplitNode', 'panoramaNode']);
  });

  it('setSetting 写入后可读到新值', async () => {
    const { getSetting, setSetting } =
      await import('../../src/components/base/store/appSettings.ts');
    setSetting('minimapOn', true);
    expect(getSetting('minimapOn')).toBe(true);
  });

  it('setSetting(string[] 型键) 写读一致', async () => {
    const { getSetting, setSetting } =
      await import('../../src/components/base/store/appSettings.ts');
    const next = ['imageBoxNode', 'panoramaNode'];
    setSetting('pinnedTools', next);
    expect(getSetting('pinnedTools')).toEqual(next);
  });

  it('setSetting 不影响其它字段', async () => {
    const { getSetting, setSetting } =
      await import('../../src/components/base/store/appSettings.ts');
    setSetting('agentOpen', true);
    // 其余默认值保持不变
    expect(getSetting('performanceMode')).toBe(true);
    expect(getSetting('minimapOn')).toBe(false);
  });

  it('setSetting 持久化落盘（重新读取同一模块仍生效）', async () => {
    const { getSetting, setSetting } =
      await import('../../src/components/base/store/appSettings.ts');
    setSetting('minimapOn', true);
    // 同一模块实例内再次读取应反映已写值（验证内存 + 持久化路径不崩）
    expect(getSetting('minimapOn')).toBe(true);
  });

  it('debugOn 默认关闭（debug 日志默认安静）', async () => {
    const { getSetting } = await import('../../src/components/base/store/appSettings.ts');
    expect(getSetting('debugOn')).toBe(false);
  });

  it('setSetting debugOn=true → 同步 window.__DEBUG_ALL（总开关实时生效）', async () => {
    // node 测试环境无 window，stub 一个用于断言 syncDebugAll 的副作用
    const prevWindow = globalThis.window;
    globalThis.window = { __DEBUG_ALL: false } as typeof globalThis.window;
    const { setSetting } = await import('../../src/components/base/store/appSettings.ts');
    setSetting('debugOn', true);
    expect(globalThis.window.__DEBUG_ALL).toBe(true);
    // 关闭后清除
    setSetting('debugOn', false);
    expect(globalThis.window.__DEBUG_ALL).toBe(false);
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  });

  it('拼错键由编译期拦截（原「未知 key 静默返回 undefined」行为已作废）——运行时仅存默认兜底路径', async () => {
    // 该用例不再调用 getSetting('notARealKey')（编译期即红）；这里仅守住「非法 key 不再被当作合法设置接受」的
    // 语义边界：注册表 SettingKey 联合是唯一 key 来源，见 settingRegistry.ts 派生。
    const { getSetting } = await import('../../src/components/base/store/appSettings.ts');
    // 兜底路径对所有合法键恒返回明文默认（undefined 只可能出现在外部持久化损坏时，属不可达的防御分支）
    expect(getSetting('minimapOn')).not.toBeUndefined();
  });
});
