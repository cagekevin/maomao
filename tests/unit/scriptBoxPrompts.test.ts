import { describe, it, expect } from 'vitest';
import type { Dialogue, Shot, ScriptAsset } from '@/components/scriptbox/scriptBoxPrompts.ts';
import {
  ZgPrompt,
  dialogueText,
  textToDlg,
  dlgToText,
  stripAtRef,
  hlAt,
  matchAsset,
  collectAssets,
  buildShotPrompts,
  buildShots,
  buildAssets,
  IMAGE_GEN_TYPES,
  ASSET_TEMPLATES,
  patchShots,
  createNewShot,
  removeShot,
  applyTailFrameSelection,
  removeAsset,
  renameAssetRefs,
  formatLineBreaks,
  parseShotSeconds,
  mergeShotsForVideo,
  buildMergedVideoUser,
} from '@/components/scriptbox/scriptBoxPrompts.ts';

describe('剧本盒纯函数 §2.7/2.17', () => {
  it('ZgPrompt：描述 + 模板拼接，style 前置', () => {
    const r = ZgPrompt('character', '蓝发少女', '皮克斯');
    expect(r).toContain('[视觉风格：皮克斯]');
    expect(r).toContain('蓝发少女');
    expect(r).toContain(ASSET_TEMPLATES.character); // 默认模板
  });

  it('ZgPrompt：描述无句号自动补句号', () => {
    const r = ZgPrompt('scene', '森林空地');
    expect(r).toMatch(/森林空地。/); // 末尾补了句号再接模板
  });

  it('ZgPrompt：未知 category 回退 character', () => {
    const r = ZgPrompt('unknown', 'x', '');
    expect(r).toContain(ASSET_TEMPLATES.character);
  });

  it('dialogueText：台词/旁白格式化', () => {
    // 旁白无 role / 纯 role 无 kind 是真实输入边界，用 as Dialogue 标注「故意喂偏类型」测容错分支
    expect(dialogueText([{ kind: '台词', role: '小马', text: '你好' }])).toBe('小马: 你好');
    expect(dialogueText([{ kind: '旁白', text: '天黑了' } as Dialogue])).toBe('[旁白] 天黑了');
    expect(dialogueText([])).toBe('');
    expect(
      dialogueText([
        { role: 'A', text: '1' },
        { role: 'B', text: '2' },
      ] as Dialogue[]),
    ).toBe('A: 1 / B: 2');
  });

  it('hlAt：只高亮真实资产名（传资产列表），非资产 @ 不高亮', () => {
    const r = hlAt('@小红帽 走进 @幽暗森林 还有 @路人', ['小红帽', '幽暗森林']);
    expect(r).toContain('<span class="at">@小红帽</span>');
    expect(r).toContain('<span class="at">@幽暗森林</span>');
    expect(r).not.toContain('<span class="at">@路人</span>'); // 非资产名不高亮
    expect(r).toContain('走进');
  });

  it('hlAt：长名优先匹配，@小马妈妈 不被 @小马 吃掉', () => {
    const r = hlAt('@小马妈妈 和 @小马', ['小马', '小马妈妈']);
    expect(r).toContain('<span class="at">@小马妈妈</span>');
    expect(r).toContain('<span class="at">@小马</span>');
  });

  it('hlAt：未传资产列表/空列表 → 不高亮任何 @，仅做 XSS 转义', () => {
    expect(hlAt('@小红帽 你好')).not.toContain('class="at"');
    expect(hlAt('@小红帽', [])).not.toContain('class="at"');
    expect(hlAt('<script>@x')).toContain('&lt;script&gt;'); // XSS 转义仍生效
  });

  it('matchAsset：@名 后一位非中英数才算合法（防误匹配）', () => {
    expect(matchAsset('@小马 吃草', '小马')).toBe(true);
    expect(matchAsset('@小马妈妈 来了', '小马')).toBe(false); // @小马妈妈 不应匹配 @小马
    expect(matchAsset('@小马', '小马')).toBe(true);
    expect(matchAsset('没有引用', '小马')).toBe(false);
  });

  it('stripAtRef：只去 @ 前缀、保留名字文字，边界与 matchAsset 一致', () => {
    expect(stripAtRef('@森林 深处', '森林')).toBe('森林 深处');
    expect(stripAtRef('@小马 和 @小马妈妈', '小马')).toBe('小马 和 @小马妈妈'); // 不误伤更长词
    expect(stripAtRef('@森林', '森林')).toBe('森林'); // 行尾去 @
    expect(stripAtRef('无引用', '森林')).toBe('无引用');
  });

  it('stripAtRef：空 text/name → 原样返回（不抛）', () => {
    expect(stripAtRef('', '森林')).toBe('');
    expect(stripAtRef('@森林', '')).toBe('@森林');
    expect(stripAtRef(null, '森林')).toBe(null);
  });

  it('textToDlg：每行 `角色：台词` 解析为数组，旁白识别', () => {
    expect(textToDlg('小马：你好\n旁白：天黑了\n无冒号行')).toEqual([
      { kind: '台词', role: '小马', text: '你好' },
      { kind: '旁白', role: '旁白', text: '天黑了' },
      { kind: '台词', role: '', text: '无冒号行' },
    ]);
  });

  it('textToDlg：空/空白文本 → 空数组；过滤空行', () => {
    expect(textToDlg('')).toEqual([]);
    expect(textToDlg('   ')).toEqual([]);
    expect(textToDlg('a\n\nb')).toEqual([
      { kind: '台词', role: '', text: 'a' },
      { kind: '台词', role: '', text: 'b' },
    ]);
  });

  it('dlgToText ↔ textToDlg roundtrip：数据不丢（旁白/台词均可还原）', () => {
    const arr = [
      { kind: '台词', role: '小马', text: '你好' },
      { kind: '旁白', role: '旁白', text: '天黑了' },
    ];
    const text = dlgToText(arr);
    expect(text).toBe('小马：你好\n旁白：天黑了');
    expect(textToDlg(text)).toEqual(arr);
  });

  it('dlgToText：非数组 → 空串', () => {
    expect(dlgToText(null)).toBe('');
    // 故意喂字符串（非 Dialogue[]）测兜底分支，用 unknown as 标注
    expect(dlgToText('字符串' as unknown as Dialogue[])).toBe('');
  });

  it('formatLineBreaks：句号类标点（。！？；）后补换行，标点留在行尾', () => {
    expect(formatLineBreaks('第一句。第二句？第三句！')).toBe('第一句。\n第二句？\n第三句！');
  });

  it('formatLineBreaks：已换行处不重复补；合并 3+ 空行为 2；整体 trim', () => {
    expect(formatLineBreaks('第一句。\n第二句。')).toBe('第一句。\n第二句。');
    expect(formatLineBreaks('a。\n\n\n\nb。')).toBe('a。\n\nb。');
    expect(formatLineBreaks('  第一句。  ')).toBe('第一句。');
  });

  it('formatLineBreaks：空值原样返回（不抛）', () => {
    expect(formatLineBreaks('')).toBe('');
    expect(formatLineBreaks(null)).toBe(null);
  });

  it('createNewShot：id/index 按末尾自增，缺省字段用默认值', () => {
    const s1 = createNewShot([]);
    expect(s1).toMatchObject({
      id: 1,
      index: 1,
      duration: '3s',
      shotType: '中景',
      lighting: '自然光',
      dialogue: [],
    });
    const s2 = createNewShot([{ id: 5 }, { id: 7 }]);
    expect(s2).toMatchObject({ id: 8, index: 3 });
  });

  it('removeShot：删除中间镜 → index 连续重排', () => {
    const shots = [
      { id: 'a', index: 1 },
      { id: 'b', index: 2 },
      { id: 'c', index: 3 },
    ];
    const next = removeShot(shots, 1);
    expect(next.map((s) => s.index)).toEqual([1, 2]);
    expect(next.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('applyTailFrameSelection：选帧 → usePrevShotVideoTail=true + 参考 URL 数组', () => {
    const shots = [{ id: 1, usePrevShotVideoTail: false, prevShotImageRefUrls: [] }];
    const next = applyTailFrameSelection(shots, 1, { id: 'v2', imageUrl: '/files/tail.png' }, true);
    expect(next[0]).toMatchObject({
      usePrevShotVideoTail: true,
      selectedTailFrameVariantId: 'v2',
      prevShotImageRefUrls: ['/files/tail.png'],
    });
  });

  it('applyTailFrameSelection：不使用尾帧 → 清空开关与参考 URL', () => {
    const shots = [
      {
        id: 1,
        usePrevShotVideoTail: true,
        prevShotImageRefUrls: ['/x.png'],
        selectedTailFrameVariantId: 'v2',
      },
    ];
    const next = applyTailFrameSelection(shots, 1, null, false);
    expect(next[0]).toMatchObject({
      usePrevShotVideoTail: false,
      selectedTailFrameVariantId: 'original',
      prevShotImageRefUrls: [],
    });
  });

  it('applyTailFrameSelection：找不到 shotId → 返回 null 不写回', () => {
    expect(applyTailFrameSelection([{ id: 1 }], 999, {}, true)).toBe(null);
  });

  it('removeAsset：删资产 → 各镜头文本 @名 去标记（保留名字文字），pickedCount 重算', () => {
    const assets = [
      { id: 'a1', name: '森林', picked: true },
      { id: 'a2', name: '小红帽', picked: false },
    ];
    const shots = [{ description: '@森林 深处 @小红帽 走进' }, { description: '无引用' }];
    const patch = removeAsset(assets, 'a1', shots);
    expect(patch.assets.map((a) => a.id)).toEqual(['a2']);
    expect(patch.pickedCount).toBe(0);
    expect(patch.shots[0].description).toBe('森林 深处 @小红帽 走进'); // @森林 去 @，@小红帽 保留
    expect(patch.shots[1].description).toBe('无引用');
  });

  it('removeAsset：无 name 资产（空壳）删除时不改镜头', () => {
    const assets = [{ id: 'a1' }];
    const patch = removeAsset(assets, 'a1', [{ description: '@x' }]);
    expect(patch.shots).toBeUndefined();
  });

  it('renameAssetRefs：@旧名 → @新名（与既有实现一致：@后以旧名开头的片段都替换）', () => {
    const shots = [{ description: '@小红帽 走进 @小红帽屋' }];
    const next = renameAssetRefs(shots, '小红帽', '小红帽(新)');
    // 原实现用 seg.startsWith(oldName) 判断，@小红帽屋 也被改写（抽取不改变行为）
    expect(next[0].description).toBe('@小红帽(新) 走进 @小红帽(新)屋');
  });

  it('parseShotSeconds："3s"→3；非法/0/空 → 兜底 3', () => {
    expect(parseShotSeconds('3s')).toBe(3);
    expect(parseShotSeconds('7')).toBe(7);
    expect(parseShotSeconds('abc')).toBe(3);
    expect(parseShotSeconds('0')).toBe(3);
    expect(parseShotSeconds('')).toBe(3);
    expect(parseShotSeconds(null)).toBe(3);
  });

  it('collectAssets：镜头 @名 匹配到有图资产', () => {
    const shot = { description: '@小红帽 走进 @幽暗森林' };
    const assets = [
      { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
      { id: 'a2', name: '幽暗森林', imageUrl: '' }, // 无图不算
      { id: 'a3', name: '大灰狼', imageUrl: '/files/w.png' },
    ];
    const out = collectAssets(shot, assets);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('/files/r.png');
    expect(out[0].label).toBe('小红帽'); // 资产名带出，供下游 @名 匹配
  });

  it('collectAssets：无资产或无图返回空', () => {
    expect(collectAssets({ description: '@x' }, [])).toEqual([]);
    expect(collectAssets(null, [{ name: 'x', imageUrl: '/f' }])).toEqual([]);
  });

  it('buildShotPrompts：生成 prompt/videoPrompt 并保留 @资产', () => {
    // dialogue 里的 {role,text} 缺 kind（真实输入边界），用 as Dialogue[] 标注故意偏类型
    const shot = {
      description: '@小马 奔跑',
      shotType: '中景',
      lighting: '自然光',
      motion: '推',
      duration: '5s',
      dialogue: [{ role: '小马', text: '冲' } as Dialogue],
      sound: '风声',
    } as Shot;
    const r = buildShotPrompts(shot);
    expect(r.prompt).toContain('@小马');
    expect(r.prompt).toContain('中景');
    expect(r.videoPrompt).toContain('镜头时长 5s');
    expect(r.videoPrompt).toContain('小马: 冲');
  });

  it('buildShots：生成 n 个分镜，id/index 连续，无副作用', () => {
    const shots = buildShots(3);
    expect(shots).toHaveLength(3);
    expect(shots.map((s) => s.id)).toEqual([1, 2, 3]);
    expect(shots.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(shots.every((s) => s.prompt && s.videoPrompt)).toBe(true);
  });

  it('buildAssets：生成角色/场景/道具三类资产，prompt 走 ZgPrompt', () => {
    const assets = buildAssets('皮克斯');
    expect(assets.length).toBeGreaterThan(0);
    const cats = new Set(assets.map((a) => a.category));
    expect(cats.has('character')).toBe(true);
    expect(cats.has('scene')).toBe(true);
    expect(cats.has('prop')).toBe(true);
    // ScriptAsset 带 [key:string]:unknown 索引签名，prompt/has 经此皆为 unknown，故用 String 收窄
    expect(assets.every((a: ScriptAsset) => String(a.prompt).includes('[视觉风格：皮克斯]'))).toBe(
      true,
    );
    expect(assets.every((a: ScriptAsset) => a.has === false)).toBe(true);
  });

  it('IMAGE_GEN_TYPES 含 4 种（keyframe/grid4/grid9/topdown）', () => {
    expect(Object.keys(IMAGE_GEN_TYPES).sort()).toEqual(['grid4', 'grid9', 'keyframe', 'topdown']);
  });

  it('patchShots：字符串字段更新第 idx 个分镜（不可变）', () => {
    const shots = [
      { id: 's1', duration: '3s' },
      { id: 's2', duration: '5s' },
    ];
    const next = patchShots(shots, 0, 'duration', '7s');
    expect(next[0]).toMatchObject({ id: 's1', duration: '7s' });
    expect(next[1]).toMatchObject({ id: 's2', duration: '5s' }); // 未改动
    expect(next).not.toBe(shots); // 新引用（不可变）
    expect(shots[0].duration).toBe('3s'); // 原数组不受影响
  });

  it('patchShots：对象 patch 一次性合并多字段', () => {
    const shots = [{ id: 's1', prompt: '', videoPrompt: '' }];
    const next = patchShots(shots, 0, { prompt: 'p', videoPrompt: 'v' });
    expect(next[0]).toMatchObject({ id: 's1', prompt: 'p', videoPrompt: 'v' });
  });
});

/* ═══════════════════════════════════════════════════════════════
 * 合并生成视频（mergeShotsForVideo / buildMergedVideoUser / MERGE_VIDEO_SYSTEM）
 * ═══════════════════════════════════════════════════════════════ */
describe('剧本盒纯函数 · 合并生成视频', () => {
  const shots = [
    {
      id: 's1',
      index: 1,
      duration: '3s',
      description: '@小狗 蹲坐',
      videoPrompt: '镜头时长 3s，小狗蹲坐',
    },
    {
      id: 's2',
      index: 2,
      duration: '4s',
      description: '@小狗 叼鱼',
      videoPrompt: '镜头时长 4s，小狗叼鱼',
    },
  ];
  const assets = [
    { id: 'a1', name: '小狗', imageUrl: '/files/dog.png' },
    { id: 'a2', name: '餐桌', imageUrl: '/files/table.png' },
  ];

  it('mergeShotsForVideo：时长累加（单一数据来源：第一步各镜 duration）', () => {
    const r = mergeShotsForVideo(shots, assets);
    expect(r.seconds).toBe(7); // 3s + 4s = 7s
  });

  it('mergeShotsForVideo：参考图合并去重（按 url），只留 @匹配且有图的资产', () => {
    // 两镜都引用 @小狗（同一资产），应去重为 1 张；餐桌未在镜头文本出现则不入图
    const r = mergeShotsForVideo(shots, assets);
    expect(r.images).toHaveLength(1);
    expect(r.images[0].url).toBe('/files/dog.png');
  });

  it('mergeShotsForVideo：多镜引用不同资产 → 全部并入且去重', () => {
    const shots2 = [
      { id: 's1', index: 1, duration: '3s', description: '@小狗 蹲坐', videoPrompt: 'a' },
      { id: 's2', index: 2, duration: '4s', description: '@餐桌 摆着鱼', videoPrompt: 'b' },
    ];
    const r = mergeShotsForVideo(shots2, assets);
    expect(r.seconds).toBe(7);
    expect(r.images.map((i) => i.url).sort()).toEqual(['/files/dog.png', '/files/table.png']);
  });

  it('mergeShotsForVideo：无 videoPrompt 段过滤为空 prompt；duration 缺省兜底 5', () => {
    // seconds 对每个元素累加：空 duration → 兜底 5；null → 兜底 5。共 5+5=10
    const r = mergeShotsForVideo([{ id: 'x', duration: '' }, null], assets);
    expect(r.seconds).toBe(10);
    expect(r.prompt).toBe(''); // 无有效 videoPrompt
  });

  it('buildMergedVideoUser：每个镜头标注【镜头N】标题（对应镜号），含对白/音效/可用资产', () => {
    const shotWithDlg = {
      id: 's1',
      index: 1,
      duration: '3s',
      description: '@小狗 蹲坐',
      shotType: '近景',
      lighting: '暖光',
      motion: '缓慢推进',
      dialogue: [{ kind: '台词', role: '小狗', text: '好吃吗' }],
      sound: '呜咽声',
    };
    const user = buildMergedVideoUser([shotWithDlg, shots[1]], assets);
    expect(user).toContain('下面共 2 个连续镜头');
    // 标题【镜头N】对应剧本镜号
    expect(user).toContain('【镜头1】');
    expect(user).toContain('【镜头2】');
    expect(user).toContain('画面描述：@小狗 蹲坐');
    expect(user).toContain('景别：近景');
    expect(user).toContain('光影：暖光');
    expect(user).toContain('运镜：缓慢推进');
    expect(user).toContain('对白/旁白：小狗: 好吃吗');
    expect(user).toContain('音效：呜咽声');
    expect(user).toContain('可用 @资产');
  });

  it('buildMergedVideoUser：缺省字段明确标"（未指定）/（无）"，不留空让 AI 脑补', () => {
    // 该镜头没有景别/光影/运镜/对白/音效 → 应明确标出，而非省略那一行
    const bare = { id: 's9', index: 9, duration: '3s', description: '小狗跑向门外' };
    const user = buildMergedVideoUser([bare], assets);
    expect(user).toContain('景别：（未指定）');
    expect(user).toContain('光影：（未指定）');
    expect(user).toContain('运镜：（未指定）');
    expect(user).toContain('对白/旁白：（无）');
    expect(user).toContain('音效：（无）');
    expect(user).toContain('画面描述：小狗跑向门外');
  });

  it('buildMergedVideoUser：已有字段原样保留，不误标为未指定', () => {
    const full = {
      id: 's1',
      index: 1,
      duration: '3s',
      description: '@小狗 蹲坐',
      shotType: '近景',
      lighting: '暖光',
      motion: '缓慢推进',
      dialogue: [{ kind: '台词', role: '小狗', text: '好吃吗' }],
      sound: '呜咽声',
    };
    const user = buildMergedVideoUser([full], assets);
    expect(user).toContain('景别：近景');
    expect(user).toContain('光影：暖光');
    expect(user).toContain('运镜：缓慢推进');
    expect(user).toContain('对白/旁白：小狗: 好吃吗');
    expect(user).toContain('音效：呜咽声');
    expect(user).not.toContain('（未指定）');
    expect(user).not.toContain('（无）');
  });

  /* ═══ 边界用例：暴露隐藏 bug（先测当前行为，再决定是否修） ═══ */
  describe('mergeShotsForVideo · 时长脏数据边界', () => {
    const s = (duration) => ({ id: 'x', index: 1, duration, description: 'a', videoPrompt: 'v' });

    it('正常字符串时长累加', () => {
      expect(mergeShotsForVideo([s('3s'), s('4s')], []).seconds).toBe(7);
    });

    it('duration 缺失/空/null → 兜底 5（不产生 NaN）', () => {
      expect(mergeShotsForVideo([s(undefined)], []).seconds).toBe(5);
      expect(mergeShotsForVideo([s('')], []).seconds).toBe(5);
      expect(mergeShotsForVideo([s(null)], []).seconds).toBe(5);
    });

    it('duration 是脏字符串（非数字）→ 兜底 5（不产生 NaN）', () => {
      expect(mergeShotsForVideo([s('abc')], []).seconds).toBe(5);
    });

    it('duration=0s 当前被兜底为 5（潜在 bug：0 秒应算 0 还是 5？）', () => {
      // 当前实现 `parseInt('0s') || 5` → 0||5 → 5。这里先固化当前行为，标注这是待确认的坑。
      expect(mergeShotsForVideo([s('0s')], []).seconds).toBe(5);
    });

    it('duration 负数当前被钳制为 1（潜在 bug：-3s 应算 1 还是报错？）', () => {
      expect(mergeShotsForVideo([s('-3s')], []).seconds).toBe(1);
    });

    it('duration 大数不崩', () => {
      expect(mergeShotsForVideo([s('100s')], []).seconds).toBe(100);
    });

    it('空数组 → 0', () => {
      expect(mergeShotsForVideo([], []).seconds).toBe(0);
    });

    it('shots 传 null/undefined → 不崩，seconds 0', () => {
      expect(mergeShotsForVideo(null, []).seconds).toBe(0);
      expect(mergeShotsForVideo(undefined, []).seconds).toBe(0);
    });
  });

  describe('mergeShotsForVideo · 参考图去重边界', () => {
    it('两镜引用同一资产（同 url）→ 去重为 1', () => {
      const shots = [
        { id: 's1', index: 1, duration: '3s', description: '@小狗 蹲坐', videoPrompt: 'a' },
        { id: 's2', index: 2, duration: '4s', description: '@小狗 叼鱼', videoPrompt: 'b' },
      ];
      const assets = [{ id: 'a1', name: '小狗', imageUrl: '/files/dog.png' }];
      expect(mergeShotsForVideo(shots, assets).images).toHaveLength(1);
      expect(mergeShotsForVideo(shots, assets).images[0].url).toBe('/files/dog.png');
    });

    it('资产 imageUrl 为空串 → 不入图', () => {
      const shots = [
        { id: 's1', index: 1, duration: '3s', description: '@小狗', videoPrompt: 'a' },
      ];
      const assets = [{ id: 'a1', name: '小狗', imageUrl: '' }];
      expect(mergeShotsForVideo(shots, assets).images).toHaveLength(0);
    });

    it('assets 传 null → 不崩，无图', () => {
      const shots = [
        { id: 's1', index: 1, duration: '3s', description: '@小狗', videoPrompt: 'a' },
      ];
      expect(mergeShotsForVideo(shots, null).images).toHaveLength(0);
    });

    it('镜头 description 为 undefined → collectAssets 不崩、不入图', () => {
      const shots = [{ id: 's1', index: 1, duration: '3s', videoPrompt: 'a' }];
      const assets = [{ id: 'a1', name: '小狗', imageUrl: '/files/dog.png' }];
      expect(mergeShotsForVideo(shots, assets).images).toHaveLength(0);
    });
  });

  describe('buildMergedVideoUser · null/缺省安全', () => {
    it('shots 含 null 项 → 不崩', () => {
      const user = buildMergedVideoUser([null, { id: 's2', index: 2, description: 'ok' }], []);
      expect(user).toContain('【镜头2】');
    });

    it('index 缺失 → 标题回退 i+1（不出现 undefined）', () => {
      const user = buildMergedVideoUser(
        [
          { id: 's1', description: 'a' },
          { id: 's2', description: 'b' },
        ],
        [],
      );
      expect(user).toContain('【镜头1】');
      expect(user).toContain('【镜头2】');
      expect(user).not.toContain('undefined');
    });

    it('dialogue 是字符串（非数组）→ 当前 dialogueText 返回空，标"（无）"（潜在 bug：有对白却标无）', () => {
      // dialogue 为 string（真实边界输入），用 as Shot 标注故意偏类型
      const shot = {
        id: 's1',
        index: 1,
        duration: '3s',
        description: 'a',
        dialogue: '小狗：好吃吗',
      } as unknown as Shot;
      const user = buildMergedVideoUser([shot], []);
      // 当前行为：dialogueText('小狗：好吃吗') 非数组 → '' → 标（无）。先固化，标注潜在坑。
      expect(user).toContain('对白/旁白：（无）');
    });

    it('空数组 → 不崩', () => {
      expect(buildMergedVideoUser([], [])).toContain('共 0 个连续镜头');
    });
  });
});
