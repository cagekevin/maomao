/**
 * 剧本盒子 · 缺陷②「场景未垫图」诊断测试
 * -------------------------------------------------------------------------
 * 对应诊断文档：docs/1mao-docs/剧本盒子/剧本盒子-缺陷诊断-垫图断点-2026-08-28.md §五
 *
 * 目的（先测试实证、再由测试定位根因，严禁读码推断下定论）：
 *  1. 用用户真实镜头文本复现「@卧室 未被收为垫图」；
 *  2. 实证角色/道具是否同样中招，解开「其他都可以」矛盾；
 *  3. 判断缺陷是「确定性 bug」还是「偶发（数据依赖）」——关键看 @名 后一位字符；
 *  4. 探索并固化隐藏 bug 用例。
 *
 * 铁律：本文件只断言「当前代码的实际行为」，不改动被测源码。
 * 若某断言与期望（正确行为）不符，说明确有缺陷——由调用方决定是否修复。
 */
import { describe, it, expect } from 'vitest'
import { matchAsset, matchAssetNames, collectAssets, mergeShotsForVideo } from '../../src/components/base/scriptBoxPrompts.ts'

// ═══════════════════════════════════════════════════════════════════
// §0 用户真实镜头数据（2026-08-28 实测：镜头1 的 description + prompt）——钉死断点
// 仅用真实文本验证「哪些资产被垫、哪些没被垫」，不解构、不臆断。
// ═══════════════════════════════════════════════════════════════════
/** 镜头1 真实 description（含 @骷髅A/@骷髅B/@卧室，无 @HKH精华瓶） */
const S1_DESC = `深夜,@卧室内。@骷髅B突然从床上坐起,转头看向旁边的@骷髅A,表情困惑又认真。@骷髅A睡眼惺忪地侧头看她。@骷髅B开始发问'死人还会老吗',@骷髅A一脸无语'我们就是骨头啊',@骷髅B更认真了'我知道,这就是问题所在'。@骷髅A愣住几秒后问'你在说什么',@骷髅B解释'万一我们复活了呢',@骷髅A反问'复活去哪',@骷髅B一本正经'人生啊,显然的'。@骷髅A停顿后点头'好吧,有道理'`
/** 镜头1 真实 生图提示词 prompt */
const S1_PROMPT = `皮克斯3D风格,深夜卧室内,月光透过窗帘洒入柔和蓝紫色调。中景构图,70mm焦段,平视角度。@骷髅B坐在床左侧,上半身直立,头部转向右侧,眼窝直视@骷髅A,眼眶内微弱蓝光,颅骨表面有细微反光,双手自然放在膝盖上,表情困惑认真。@骷髅A躺在床右侧,头部侧向左方,眼窝半睁看向@骷髅B,颅骨放松状态,一只手臂搭在枕头边缘。两具骷髅相距约50厘米,床单褶皱自然,床头柜在右侧边缘,木质纹理清晰。主光源从左侧窗户射入,在@骷髅B颅骨左侧形成窄高光,右侧面部处于柔和阴影中保留暗部细节,@骷髅A面部受到微弱反射光。背景墙面蓝紫色渐变,窗帘半透明材质可见月光轮廓,空气中有细微尘埃颗粒漂浮,整体色调温馨柔和,卡通骷髅造型圆润可爱,骨骼关节结构清晰,材质呈现哑光象牙白`

describe('§0 真实镜头1数据：到底谁被垫、谁没被垫（实测钉死断点）', () => {
  // 注：matchAsset 记录"旧边界"行为（场景被误杀）；修复后 collectAssets 改用 matchAssetNames（词典最长匹配），
  // 下列 collectAssets 断言全部断言【修复后的正确行为】——高亮的即垫图的。
  const descHas = (name) => matchAsset(S1_DESC, name)
  const promptHas = (name) => matchAsset(S1_PROMPT, name)

  it('场景「卧室」：旧 matchAsset 里 @卧室 后接中文(内) → false（这是缺陷②的历史根因，已修复）', () => {
    expect(S1_DESC.includes('@卧室')).toBe(true) // 确认用户确实写了 @卧室
    expect(descHas('卧室')).toBe(false)
    expect(promptHas('卧室')).toBe(false)
  })

  it('角色「骷髅A」：旧 matchAsset 里某处 `@骷髅A,`(逗号) → true（"别的正常"的真相）', () => {
    expect(descHas('骷髅A')).toBe(true)
  })

  it('角色「骷髅B」：旧 matchAsset 靠 prompt 的 `@骷髅B,`(逗号) → true（并非免疫，只是有逗号兜着）', () => {
    expect(descHas('骷髅B')).toBe(false)
    expect(promptHas('骷髅B')).toBe(true)
  })

  it('【修复后·决定性】collectAssets 合并 description+prompt：场景/骷髅A/骷髅B 都被收（词典最长匹配，@卧室内 命中 卧室）', () => {
    const shot = { description: S1_DESC, prompt: S1_PROMPT }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a3', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
    ]
    const urls = collectAssets(shot, assets).map((i) => i.url)
    expect(urls.includes('/files/room.png')).toBe(true) // 场景现在被收（修复核心）
    expect(urls.includes('/files/ka.png')).toBe(true)
    expect(urls.includes('/files/kb.png')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════
// §5.2-1  matchAsset 边界矩阵：核心缺陷复现
// ═══════════════════════════════════════════════════════════════════
describe('缺陷②：matchAsset @名后一位边界（核心）', () => {
  // 边界规则：@名 后一位必须是「结尾 或 非中英数」才算命中，否则视为更长词的一部分。
  describe('后一位=中英数 → 当前判 false（误杀）', () => {
    // —— 用户真实文本场景：`深夜@卧室内`，@卧室 后一位是中文「内」——
    it('场景：text="深夜@卧室内", name="卧室" → 当前返回 false（场景漏收·复现官方缺陷）', () => {
      expect(matchAsset('深夜@卧室内,柔和蓝紫色环境光', '卧室')).toBe(false)
    })
    // —— 用户真实文本角色：`@骷髅A站在床边`，@骷髅A 后一位是中文「站」——
    it('角色：text="@骷髅A站在床边", name="骷髅A" → 当前返回 false（实证角色是否同病）', () => {
      expect(matchAsset('@骷髅A站在床边', '骷髅A')).toBe(false)
    })
    // —— 用户真实文本道具：`@HKH精华瓶至胸前`，@HKH精华瓶 后一位是中文「至」——
    it('道具：text="@HKH精华瓶至胸前", name="HKH精华瓶" → 当前返回 false（实证道具是否同病）', () => {
      expect(matchAsset('@HKH精华瓶至胸前', 'HKH精华瓶')).toBe(false)
    })
    it('角色：text="@骷髅B坐在床上", name="骷髅B" → 当前返回 false', () => {
      expect(matchAsset('@骷髅B坐在床上', '骷髅B')).toBe(false)
    })
    // 后一位为英文/数字也同样被判为「更长词」而误杀（注意：@名 后紧跟英文/数字，中间无空格）
    it('后一位英文：text="@城堡C落", name="城堡" → false', () => {
      expect(matchAsset('@城堡C落', '城堡')).toBe(false)
    })
    it('后一位数字：text="@房间2间", name="房间" → false', () => {
      expect(matchAsset('@房间2间', '房间')).toBe(false)
    })
    // 但 @名 后隔了空格再写英文 → 空格是合法边界 → true（澄清：只有「紧贴」才误杀）
    it('后一位是空格→非词字符 → true（"@城堡 Castel" 实际命中，不再属于误杀）', () => {
      expect(matchAsset('@城堡 Castel', '城堡')).toBe(true)
    })
  })

  describe('后一位=结尾/标点/空白 → 当前判 true（正常命中）', () => {
    it('结尾：text="@卧室", name="卧室" → true', () => {
      expect(matchAsset('@卧室', '卧室')).toBe(true)
    })
    it('后随空格：text="@卧室,柔和" 后是逗号 → true；text="@卧室 柔和" 后是空格 → true', () => {
      expect(matchAsset('@卧室,柔和', '卧室')).toBe(true)
      expect(matchAsset('@卧室 柔和', '卧室')).toBe(true)
    })
    it('后随句号/感叹号/分号等标点 → true', () => {
      expect(matchAsset('后续@卧室。', '卧室')).toBe(true)
      expect(matchAsset('后续@卧室！', '卧室')).toBe(true)
      expect(matchAsset('后续@卧室；', '卧室')).toBe(true)
    })
  })

  // ═══ 关键判据：缺陷是「确定性」还是「偶发（数据依赖）」 ═══
  it('【洞见】同一资产「卧室」，@名后一位不同 → 结果不同（这就是看起来"偶发"的根源）', () => {
    // 同一资产、同一条 @引用，仅随后的字符不同：
    expect(matchAsset('深夜@卧室,从窗外透入', '卧室')).toBe(true)  // 后是逗号
    expect(matchAsset('深夜@卧室内,从窗外透入', '卧室')).toBe(false) // 后是中文
    // 结论：不是随机偶发，而是「数据依赖」——AI 何时写 @卧室, vs @卧室内 决定这一镜垫不垫图。
  })

  it('【修复后】@引用后恰有空白/标点 与 @名后紧贴中文：现在都能垫（词典匹配不再看后一位）', () => {
    const assets = [
      { id: '卧室', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
    ]
    // 修复前：镜B `@卧室内` 是不垫的；修复后：两者都垫（高亮即垫图）。
    const shotA = { description: '深夜@卧室,柔和灯光' }
    const shotB = { description: '深夜@卧室内,柔和灯光' }
    expect(collectAssets(shotA, assets)).toHaveLength(1)
    expect(collectAssets(shotB, assets)).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════
// §5.2-2  collectAssets 集成测试：用用户真实整段文本
// ═══════════════════════════════════════════════════════════════════
describe('缺陷②：collectAssets 用用户真实文本', () => {
  const TEXT = [
    '皮克斯3D风格,卡通骷髅角色,柔和蓝紫色调温馨喜剧氛围。',
    '深夜@卧室内,柔和蓝紫色环境光从窗外透入,床头柜木质纹理清晰。',
    '@骷髅A站在床边...右手举起@HKH精华瓶至胸前位置...',
    '@骷髅B坐在床上...视线锁定@HKH精华瓶...',
  ].join('\n')

  it('【修复后】场景「卧室」：@卧室内 也被词典匹配到 → 场景图被收（缺陷②已修）', () => {
    const shot = { description: TEXT }
    const assets = [{ id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' }]
    const out = collectAssets(shot, assets)
    expect(out.some((i) => i.url === '/files/room.png')).toBe(true)
  })

  // ⚠️ 修复后：角色/道具只要「@名」出现即被收（不再卡在 @名 后一位），下面是修复后的行为。
  it('【修复后】角色「骷髅A」「骷髅B」@名后紧贴中文(站/坐…) → 也能被收（词典匹配不再误杀）', () => {
    const shot = { description: TEXT }
    const assets = [
      { id: 'a1', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a2', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
    ]
    const out = collectAssets(shot, assets)
    expect(out.some((i) => i.url === '/files/ka.png')).toBe(true)
    expect(out.some((i) => i.url === '/files/kb.png')).toBe(true)
  })

  it('【修复后】道具「HKH精华瓶」出现即被收（两处 @HKH精华瓶 任一命中即可）', () => {
    const shot = { description: TEXT }
    const assets = [{ id: 'a1', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' }]
    const out = collectAssets(shot, assets)
    expect(out.some((i) => i.url === '/files/bottle.png')).toBe(true)
  })

  it('【修复后·决定性】真实整段文本：场景/骷髅A/骷髅B/HKH精华瓶 全部被收（不再有偶发漏收）', () => {
    const shot = { description: TEXT }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a3', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
      { id: 'a4', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' },
    ]
    const out = collectAssets(shot, assets)
    const urls = out.map((i) => i.url)
    // 修复后：四类资产都注册过且都在文本中被 @ 引用 → 全部收齐
    expect(new Set(urls)).toEqual(new Set(['/files/room.png', '/files/ka.png', '/files/kb.png', '/files/bottle.png']))
  })

  it('【对照】同一批资产，若 @名 后加空格/标点 → 全部能收集（证明断点在边界而非资产/图）', () => {
    const shot = { description: '深夜@卧室, 柔和光。@骷髅A 站在床边。右手举起@HKH精华瓶 至胸前。' }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a4', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' },
    ]
    const out = collectAssets(shot, assets)
    expect(out.map((i) => i.url).sort()).toEqual(['/files/bottle.png', '/files/ka.png', '/files/room.png'])
  })
})

// ═══════════════════════════════════════════════════════════════════
// 隐藏 bug 探索
// ═══════════════════════════════════════════════════════════════════
describe('隐藏 bug 探索：collectAssets / module', () => {
  const shot = { description: '深夜@卧室内' }
  const assets = [{ id: 'a1', name: '卧室', imageUrl: '/files/room.png' }]

  it('隐藏 bug①：shot.dialogue 是数组 → collectAssets 文本拼接成 "[object Object]"（@资产写在对白里无法收集）', () => {
    // collectAssets 用 ${shot.dialogue} 拼接；真实 dialogue 是数组结构（textToDlg 产出）。
    // 若 @资产引用恰好写在 dialogue 里（而非 description），会因数组→"[object Object]" 漏掉该引用。
    const shotWithDlg = { description: '窗外', dialogue: [{ kind: '台词', role: '小马', text: '@卧室 真美' }] }
    expect(collectAssets(shotWithDlg, assets)).toHaveLength(0) // 当前行为：漏收（@引用在对白里）
  })

  it('隐藏 bug①对照：@引用写在 description → 正常收集（证明只是拼接口径问题）', () => {
    const shotDesc = { description: '@卧室 真美' }
    expect(collectAssets(shotDesc, assets)).toHaveLength(1)
  })

  it('隐藏 bug②：@名 后跟英文即被当作"更长词"——嵌套词名的资产永远匹配不上精确名', () => {
    // 资产名含数字/英文（如骷髅A、2号屋）时，@别名 后只要紧跟字面词就被误判。
    // 这并非"@小马"vs"@小马妈妈"的防误中语义，而是对"带序号/编号资产"的通用误杀。
    expect(matchAsset('@骷髅A站', '骷髅A')).toBe(false)
  })

  it('隐藏 bug③：@名 本身是长词、后接标点才能命中；但 AI 高频在@名后直接写动词（中文无空格）→ 误杀率高', () => {
    // 中文剧本无词空格，@名 后常见直接的动词/方位词（内/里/站/举/坐/至），
    // 这些是全中文字符 → 全部命中 \u4e00-\u9fa5 → 被误杀。这是中文场景下该边界的系统性缺陷。
    const verbs = ['内', '里', '后', '前', '上', '旁', '站', '坐', '走', '举', '回应', '从']
    for (const v of verbs) {
      expect(matchAsset(`@卧室${v}`, '卧室')).toBe(false)
    }
  })

  it('隐藏 bug④：collectAssets 返回对象丢 category，下游无法区分场景/角色/道具（文档§3.3 契约空白）', () => {
    const shotDesc = { description: '@卧室, @骷髅A, @HKH精华瓶' }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a4', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' },
    ]
    const out = collectAssets(shotDesc, assets)
    // 能看到 3 张图，但拿不到 category —— 只能靠 url 反查，无法在返回层做分层处理。
    expect(out).toHaveLength(3)
    expect(out.every((i) => 'category' in i)).toBe(false) // 当前行为：不含 category
  })

  it('【修复后】mergeShotsForVideo 复用同一 collectAssets → 合并视频也能收到场景图（同口修复）', () => {
    const shot = { id: 's1', description: '深夜@卧室内', videoPrompt: 'v' }
    const assets = [{ id: 'a1', name: '卧室', imageUrl: '/files/room.png' }]
    const r = mergeShotsForVideo([shot], assets)
    expect(r.images.map((i) => i.url)).toEqual(['/files/room.png'])
  })
})

// ═══════════════════════════════════════════════════════════════════
// 新函数 matchAssetNames：词典最长匹配（修复核心）
// ═══════════════════════════════════════════════════════════════════
describe('matchAssetNames：以注册资产名词典收集 @引用（修复核心）', () => {
  it('@名后紧贴中文（@卧室内）→ 命中注册资产「卧室」（缺陷②修复点）', () => {
    expect([...matchAssetNames('深夜@卧室内,柔和光', ['卧室'])]).toEqual(['卧室'])
  })
  it('普通 @名 命中：@骷髅A 站在床边 → 骷髅A', () => {
    expect([...matchAssetNames('@骷髅A站在床边', ['骷髅A', '骷髅B'])]).toEqual(['骷髅A'])
  })
  it('最长优先防子串：@小马妈妈 只命中「小马妈妈」，不误配「小马」', () => {
    expect([...matchAssetNames('@小马妈妈 来了', ['小马', '小马妈妈'])].sort()).toEqual(['小马妈妈'])
    expect([...matchAssetNames('@小马 吃草', ['小马', '小马妈妈'])]).toEqual(['小马'])
  })
  it('仅命中注册名：@路人（未注册）不返回任何资产', () => {
    expect(matchAssetNames('@路人 擦肩', ['小马', '卧室']).size).toBe(0)
  })
  it('空文本 / 空资产列表 → 空集合（不抛）', () => {
    expect(matchAssetNames('', ['卧室']).size).toBe(0)
    expect(matchAssetNames('@卧室', []).size).toBe(0)
    expect(matchAssetNames(null, ['卧室']).size).toBe(0)
  })
  it('文本里多 @ 名都命中', () => {
    const s = [...matchAssetNames('深夜@卧室, @骷髅A 举着 @HKH精华瓶', ['卧室', '骷髅A', 'HKH精华瓶'])]
    expect(s).toHaveLength(3)
  })
})