/**
 * 设置页 `SkillSettings` 的**组件级测试**（TD-11-61）—— 锁"功能都在"这件事：
 *  · 四类行状态各自渲染出**自己的动作**（`ok` / 缺 id / 仅索引 / 读不到）；
 *  · 未决（读不到磁盘）时出横幅且**按索引显示**（不用空清单否定真值）；
 *  · 编辑态：保存走 `saveSkillToDisk` 并带 `baselineHash`（冲突基线）；
 *  · **冲突**时两个字都给出来（覆盖 / 放弃并加载磁盘版）；
 *  · 官方内置只给开关、不给编辑；**没有搜索框**（用户裁定）。
 *  · 分组为 **tab 切换**（更新 2026-09-23：原「可折叠分段 + 全部分组平铺」被用户裁定改为 tab）
 *    ⇒ 断言某组的行之前，先切到该组的 tab；默认 tab = 视图层第一个组（官方恒最前）。
 *
 * 【为什么只 mock 门面的 IO】`buildSkillLibraryView`（判定中枢）保持**真身**：
 * 组件测试要验的正是"真判定 → 真渲染"这条链，把判定也 mock 掉就只剩样式断言了。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// 【深引真源（门面桩不覆盖它）】`accept` 必须与白名单同源：写死字符串就会与真源漂移，而漂移**不报错**
// —— 只会让用户在系统选择框里被挡住或被钓（TD-11-63 顺带：本页此前写死了 `.json,.yaml,.yml,.csv`，
// 那四类在 `handleMdImport` 里一律被拒）。
import { SKILL_IMPORT_ACCEPT } from '../../src/components/agent/skill/write/skillImport.ts';

const h = vi.hoisted(() => ({
  disk: {
    ok: true,
    data: { root: '/r', groups: [] as string[], packages: [] as unknown[] },
  } as unknown,
  indexRows: [] as unknown[],
  enabledMap: {} as Record<string, boolean>,
  saveResult: { ok: true, skill: {} } as unknown,
  hydrate: {
    ok: true,
    loaded: 0,
    missingId: [],
    failures: [],
    warnings: [],
    changed: false,
    undecided: false,
  },
  save: vi.fn(),
  restore: vi.fn(),
  discard: vi.fn(),
  backfill: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('../../src/components/agent/skill/index.ts', async (importOriginal) => ({
  // 常量/纯函数/视图层**保持真身**（要验的就是真判定 → 真渲染）
  ...(await importOriginal<Record<string, unknown>>()),
  readSkillLibrary: () => Promise.resolve(h.disk),
  readUserSkills: () => ({ ok: true, list: h.indexRows, error: '' }),
  readSkillEnabledMap: () => h.enabledMap,
  reloadSkillsFromDisk: () => Promise.resolve(h.hydrate),
  migrateSkillsToDiskIfNeeded: () => Promise.resolve({ migrated: 0, failures: [] }),
  saveSkillToDisk: h.save,
  restoreSkillFromIndex: h.restore,
  discardSkillFromIndex: h.discard,
  backfillMissingIds: h.backfill,
  openSkillFolder: () => Promise.resolve({ ok: true, data: { path: '/r' } }),
  createSkillGroup: () => Promise.resolve({ ok: true, data: { name: 'x', created: true } }),
  deleteSkillEverywhere: () => Promise.resolve({ ok: true }),
  skillMarkdownForExport: () => null,
  importSkillText: () => Promise.resolve({ ok: true, skill: { name: 'x' } }),
  importSkillPackages: () => Promise.resolve({ imported: [], failed: [], error: undefined }),
  isImportablePackageFile: () => true,
  isSkillImportFile: () => true,
  skillNameFromFile: (n: string) => n.replace(/\.[^.]+$/, ''),
}));

vi.mock('../../src/components/agent/index.ts', () => ({
  selectSkillInCurrentConversation: () => ({ ok: true, added: true }),
}));
// 【从真模块派生（TD-17-15）】toastStore / confirmStore 是"会长大"类模块：只写我们关心的那个函数，
// 其余走 `importOriginal` 展开 —— 否则别人给它们加导出时，本桩会静默把新导出变成 undefined。
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  showToast: vi.fn(),
}));
vi.mock('../../src/components/base/core/event/confirmStore.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  askConfirm: () => Promise.resolve(true),
}));

import SkillSettings from '../../src/components/settings/sections/SkillSettings.tsx';

const md = (fields: Record<string, string>, body = '正文') =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n${body}`;

const pkg = (category: string, slug: string, text: string) => ({
  category,
  slug,
  files: ['SKILL.md'],
  contents: [{ relPath: 'SKILL.md', encoding: 'utf8' as const, content: text }],
});

/** 一屏四态：正常 / 缺 id / 仅索引 / 读不到 */
function seedFourStates() {
  h.disk = {
    ok: true,
    data: {
      root: '/r',
      groups: ['营销文案', '图片类'],
      packages: [
        pkg('营销文案', '好的', md({ id: 'id-ok', name: '好的', description: 'd' })),
        pkg('图片类', '缺id的', md({ name: '缺id的', description: 'd' })),
        { category: '图片类', slug: '读不到的', files: [], contents: [] },
      ],
    },
  };
  h.indexRows = [
    { id: 'id-ok', category: '营销文案', slug: '好的', name: '好的', content: '正文' },
    { id: 'id-gone', category: '老组', slug: '没了', name: '没了', content: '只剩这份' },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  h.enabledMap = {};
  h.save.mockResolvedValue({ ok: true, skill: { id: 'id-ok', name: '好的' } });
  h.restore.mockResolvedValue({ ok: true, skill: { id: 'id-gone', name: '没了' } });
  h.discard.mockReturnValue({ ok: true });
  h.backfill.mockResolvedValue({ ok: true, patched: [], failed: [] });
});

describe('SkillSettings · 一个列表（行状态各自带动作）', () => {
  it('四类状态各自渲染：正常可开关 / 缺 id 给「补齐」/ 仅索引给「恢复·丢弃」/ 读不到如实标', async () => {
    seedFourStates();
    render(<SkillSettings />);

    // 【2026-09-23 起分组为 tab 切换】四类状态分处不同组 ⇒ 逐组切过去验（组序：官方最前）。
    // 营销文案组：正常行（骨架 = 磁盘包 ∪ 索引里的"已删除"）
    fireEvent.click(await screen.findByRole('button', { name: /营销文案/ }));
    expect(screen.getByText('好的')).toBeTruthy();

    // 图片类组：缺 id + 读不到
    fireEvent.click(screen.getByRole('button', { name: /图片类/ }));
    expect(screen.getByText('缺id的')).toBeTruthy();
    expect(screen.getByText('读不到的')).toBeTruthy();
    // 状态徽标 + 各自的动作
    expect(screen.getByText('缺 id')).toBeTruthy();
    expect(screen.getByText('补齐 id')).toBeTruthy();
    expect(screen.getByText('读不到 SKILL.md')).toBeTruthy();

    // 收纳组：仅索引（磁盘上已删除）—— 组名与行徽标同措辞 ⇒ 至少一处
    fireEvent.click(screen.getByRole('button', { name: /磁盘上已删除/ }));
    expect(screen.getByText('没了')).toBeTruthy();
    expect(screen.getAllByText('磁盘上已删除').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('恢复')).toBeTruthy();
    expect(screen.getByText('丢弃')).toBeTruthy();
  });

  it('芯片计数说清"一共几个 / 对话里可用几个"（不出现"磁盘/索引"这类实现词）', async () => {
    seedFourStates();
    render(<SkillSettings />);

    expect(await screen.findByText('共 3 个')).toBeTruthy();
    // 可用 = ok 行（1）+ 内置（1）；启用的也是它俩（enabledMap 空 ⇒ 默认启用）
    expect(screen.getByText('对话里可用 2/2')).toBeTruthy();
  });

  it('**没有搜索框**（用户裁定：技能就几个，搜索是噪声）', async () => {
    seedFourStates();
    render(<SkillSettings />);
    await screen.findByText('Skill Library');

    expect(screen.queryByPlaceholderText(/搜索/)).toBeNull();
    expect(screen.queryByRole('textbox', { name: /搜索/ })).toBeNull();
  });

  it('导入用的文件选择框 `accept` 与白名单同源（不许"钓"用户挑一个必然被拒的文件）', async () => {
    seedFourStates();
    render(<SkillSettings />);
    await screen.findByText('Skill Library');

    const picker = document.querySelector('input[type="file"][accept]');
    // 此前写死 `.md,.markdown,.txt,.json,.yaml,.yml,.csv` —— 后四类在 `handleMdImport` 里一律被拒，
    // 而选择框照旧把它们列出来（用户挑完才被告知"不是文本类技能文件"）
    expect(picker?.getAttribute('accept')).toBe(SKILL_IMPORT_ACCEPT);
  });
});

describe('SkillSettings · 未决（读不到磁盘 ≠ 磁盘上没有技能）', () => {
  it('读盘失败 ⇒ 横幅 + 按索引显示（且不把索引条目说成"磁盘上已删除"）', async () => {
    h.disk = { ok: false, message: 'localTool 未启动' };
    h.indexRows = [
      { id: 'id-1', category: '图片类', slug: '漫画生成', name: '漫画生成', content: '正文' },
    ];
    render(<SkillSettings />);

    expect(await screen.findByText(/读不到磁盘技能库/)).toBeTruthy();
    // 分组为 tab：切到该行所在的组再断言（默认 tab = 第一个组）
    fireEvent.click(await screen.findByRole('button', { name: /图片类/ }));
    expect(screen.getByText('漫画生成')).toBeTruthy(); // 按索引显示
    expect(screen.queryByText('磁盘上已删除')).toBeNull(); // 无从判断，就不许凭空造
  });
});

describe('SkillSettings · 编辑与保存（直接编辑磁盘 + 冲突保护）', () => {
  it('点「编辑」进表单；保存把 `baselineHash` 一起给出去（冲突基线）', async () => {
    seedFourStates();
    render(<SkillSettings />);
    // 分组为 tab：先切到「营销文案」，再点该行
    fireEvent.click(await screen.findByRole('button', { name: /营销文案/ }));
    fireEvent.click(screen.getByText('好的'));
    fireEvent.click(screen.getByText('编辑'));

    const nameInput = screen.getByDisplayValue('好的');
    expect(nameInput).toBeTruthy();
    fireEvent.change(nameInput, { target: { value: '改过的名字' } });
    fireEvent.click(screen.getByText('保存修改'));

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    const arg = h.save.mock.calls[0][0] as { name: string; baselineHash?: string; id?: string };
    expect(arg.name).toBe('改过的名字');
    expect(arg.id).toBe('id-ok');
    expect(arg.baselineHash).toBeTruthy(); // 少了它，保存就变成"谁后保存谁赢"
  });

  it('磁盘那一版被外部改过 ⇒ 给两个选择；选「加载磁盘版」把磁盘正文装进表单', async () => {
    seedFourStates();
    h.save.mockResolvedValueOnce({
      ok: false,
      conflict: true,
      message: '磁盘上的「好的」已被外部改动（不是你在界面上看到的这一版）',
      diskContent: '磁盘上那一版',
    });
    render(<SkillSettings />);
    // 分组为 tab：先切到「营销文案」，再点该行
    fireEvent.click(await screen.findByRole('button', { name: /营销文案/ }));
    fireEvent.click(screen.getByText('好的'));
    fireEvent.click(screen.getByText('编辑'));
    fireEvent.click(screen.getByText('保存修改'));

    expect(await screen.findByText(/已被外部改动/)).toBeTruthy();
    expect(screen.getByText('用我的覆盖')).toBeTruthy();
    fireEvent.click(screen.getByText('放弃我的、加载磁盘版'));

    expect(screen.getByDisplayValue('磁盘上那一版')).toBeTruthy();
    expect(screen.queryByText('用我的覆盖')).toBeNull(); // 提示条收起
  });
});

describe('SkillSettings · 官方内置', () => {
  it('内置行只能开关：选中它没有「编辑」「删除」（它是代码常量）', async () => {
    h.disk = { ok: true, data: { root: '/r', groups: [], packages: [] } };
    h.indexRows = [];
    render(<SkillSettings />);

    fireEvent.click(await screen.findByText('电商详情页套图'));

    expect(screen.queryByText('编辑')).toBeNull();
    expect(screen.queryByText('删除')).toBeNull();
    expect(screen.getByText('在 AI 助手里使用')).toBeTruthy(); // 仍可带进对话
  });
});
