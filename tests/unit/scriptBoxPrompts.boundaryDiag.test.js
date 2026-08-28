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
import { matchAsset, collectAssets, mergeShotsForVideo } from '../../src/components/base/scriptBoxPrompts.js'

// ═══════════════════════════════════════════════════════════════════
// §0 用户真实镜头数据（2026-08-28 实测：镜头1 的 description + prompt）——钉死断点
// 仅用真实文本验证「哪些资产被垫、哪些没被垫」，不解构、不臆断。
// ═══════════════════════════════════════════════════════════════════
/** 镜头1 真实 description（含 @骷髅A/@骷髅B/@卧室，无 @HKH精华瓶） */
const S1_DESC = `深夜,@卧室内。@骷髅B突然从床上坐起,转头看向旁边的@骷髅A,表情困惑又认真。@骷髅A睡眼惺忪地侧头看她。@骷髅B开始发问'死人还会老吗',@骷髅A一脸无语'我们就是骨头啊',@骷髅B更认真了'我知道,这就是问题所在'。@骷髅A愣住几秒后问'你在说什么',@骷髅B解释'万一我们复活了呢',@骷髅A反问'复活去哪',@骷髅B一本正经'人生啊,显然的'。@骷髅A停顿后点头'好吧,有道理'`
/** 镜头1 真实 生图提示词 prompt */
const S1_PROMPT = `皮克斯3D风格,深夜卧室内,月光透过窗帘洒入柔和蓝紫色调。中景构图,70mm焦段,平视角度。@骷髅B坐在床左侧,上半身直立,头部转向右侧,眼窝直视@骷髅A,眼眶内微弱蓝光,颅骨表面有细微反光,双手自然放在膝盖上,表情困惑认真。@骷髅A躺在床右侧,头部侧向左方,眼窝半睁看向@骷髅B,颅骨放松状态,一只手臂搭在枕头边缘。两具骷髅相距约50厘米,床单褶皱自然,床头柜在右侧边缘,木质纹理清晰。主光源从左侧窗户射入,在@骷髅B颅骨左侧形成窄高光,右侧面部处于柔和阴影中保留暗部细节,@骷髅A面部受到微弱反射光。背景墙面蓝紫色渐变,窗帘半透明材质可见月光轮廓,空气中有细微尘埃颗粒漂浮,整体色调温馨柔和,卡通骷髅造型圆润可爱,骨骼关节结构清晰,材质呈现哑光象牙白`

describe('§0 真实镜头1数据：到底谁被垫、谁没被垫（实测钉死断点）', () => {
  const descHas = (name) => matchAsset(S1_DESC, name)
  const promptHas = (name) => matchAsset(S1_PROMPT, name)

  it('场景「卧室」：description 与 prompt 里 @名 后紧跟中文(内) → 全字段都 false（这就是一直垫不上的原因）', () => {
    // description 里唯一出现是 `深夜,@卧室内` → @卧室 后是「内」
    expect(S1_DESC.includes('@卧室')).toBe(true) // 确认用户确实写了 @卧室
    expect(descHas('卧室')).toBe(false)
    // prompt 里出现 `深夜卧室内` —— 连 @ 都没有，更不命中
    expect(promptHas('卧室')).toBe(false)
  })

  it('角色「骷髅A」：description 里出现 `@骷髅A,`(后是逗号) → true（这就是"别的正常"的真相）', () => {
    // 虽然多处 @骷髅A 后是中文(睡/一/愣/反/停)，但至少一处 `@骷髅A,` 后是逗号 → 命中
    expect(descHas('骷髅A')).toBe(true)
  })

  it('角色「骷髅B」：description 每处后是中文，但 prompt 里有 `@骷髅B,`(逗号) → 命中了 → 也能垫上', () => {
    // description：@骷髅B突/开/更/解/一 后全是中文 → false
    expect(descHas('骷髅B')).toBe(false)
    // prompt：`眼窝半睁看向@骷髅B,颅骨放松` 里 @骷髅B 后是逗号 → true（角色并非免疫，只是有逗号兜着）
    expect(promptHas('骷髅B')).toBe(true)
  })

  it('【决定性】collectAssets 合并 description+prompt 三字段：只有场景「卧室」被漏，骷髅A/骷髅B 都被收', () => {
    const shot = { description: S1_DESC, prompt: S1_PROMPT }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a3', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
    ]
    const urls = collectAssets(shot, assets).map((i) => i.url)
    expect(urls.includes('/files/room.png')).toBe(false) // 场景漏（唯一的 @卧室 是 @卧室内）
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

  it('【洞见】@引用后恰有空白/标点时能命中；也就意味着同一剧本里"部分镜头能垫图"（表现为偶发）', () => {
    const assets = [
      { id: '卧室', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
    ]
    // 镜A 写 `@卧室,` → 能垫；镜B 写 `@卧室内` → 不垫。同一资产，结果不同。
    const shotA = { description: '深夜@卧室,柔和灯光' }
    const shotB = { description: '深夜@卧室内,柔和灯光' }
    expect(collectAssets(shotA, assets)).toHaveLength(1)
    expect(collectAssets(shotB, assets)).toHaveLength(0)
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

  it('场景「卧室」有图 → 仍被漏收（collectAssets 不含场景图）', () => {
    const shot = { description: TEXT }
    const assets = [{ id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' }]
    const out = collectAssets(shot, assets)
    expect(out.some((i) => i.url === '/files/room.png')).toBe(false)
  })

  // ⚠️ 以下角色/道具用例基于「文档 §2.2 重建示例」（@骷髅A站 / @HKH精华瓶至），
  //    它证明的是「若 @名 后紧跟中文，角色/道具同样会被边界咬」这一机制（潜在风险），
  //    并非断言真实数据里它们当前已坏。用户实测：角色/道具在运行时文本里 @名 后都有安全边界，当前正常。
  it('【机制证明/潜在风险】角色「骷髅A」「骷髅B」若在文本里 @名后紧跟中文 → 同样被漏收（非结构性免疫）', () => {
    const shot = { description: TEXT }
    const assets = [
      { id: 'a1', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a2', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
    ]
    const out = collectAssets(shot, assets)
    expect(out.some((i) => i.url === '/files/ka.png')).toBe(false)
    expect(out.some((i) => i.url === '/files/kb.png')).toBe(false)
  })

  it('【偶发真面目】道具「HKH精华瓶」出现在两处，第二处 @HKH精华瓶... 以标点结尾 → 被收集（当前实为 true）', () => {
    const shot = { description: TEXT }
    const assets = [{ id: 'a1', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' }]
    const out = collectAssets(shot, assets)
    // 第一处 `@HKH精华瓶至` (至→误杀)，但 matchAsset 继续找到第二处 `@HKH精华瓶...` (.→命中) → true
    expect(out.some((i) => i.url === '/files/bottle.png')).toBe(true)
  })

  it('【决定性结论】真实整段文本中「场景+2角色」漏收、仅「多出现一次的并列道具HKH精华瓶」偶然命中——同镜内即不一致 = 偶发根因', () => {
    const shot = { description: TEXT }
    const assets = [
      { id: 'a1', name: '卧室', category: 'scene', imageUrl: '/files/room.png' },
      { id: 'a2', name: '骷髅A', category: 'character', imageUrl: '/files/ka.png' },
      { id: 'a3', name: '骷髅B', category: 'character', imageUrl: '/files/kb.png' },
      { id: 'a4', name: 'HKH精华瓶', category: 'prop', imageUrl: '/files/bottle.png' },
    ]
    const out = collectAssets(shot, assets)
    const urls = out.map((i) => i.url)
    // 卧室/骷髅A/骷髅B 仅出现一次且后接中文 → 漏收
    expect(urls.includes('/files/room.png')).toBe(false)
    expect(urls.includes('/files/ka.png')).toBe(false)
    expect(urls.includes('/files/kb.png')).toBe(false)
    // HKH精华瓶 第二处后是省略号(非词char) → 偶然命中
    expect(urls.includes('/files/bottle.png')).toBe(true)
    // 结论：同一镜、同一批资产，匹配结果取决于「@名后一位字符」，即数据依赖 → 表现为"有时垫有时不垫"
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

  it('隐藏 bug⑤：mergeShotsForVideo 复用同一 collectAssets → 真实文本下合并视频也缺垫图（同病延伸）', () => {
    const shot = { id: 's1', description: '深夜@卧室内', videoPrompt: 'v' }
    const assets = [{ id: 'a1', name: '卧室', imageUrl: '/files/room.png' }]
    const r = mergeShotsForVideo([shot], assets)
    expect(r.images).toHaveLength(0) // 合并视频同样收集不到
  })
})