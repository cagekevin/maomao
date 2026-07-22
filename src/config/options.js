var mi = [{
  text: `提问前加上“你是一位资深文案”，AI的输出结构会更专业`,
  category: `text`
}, {
  text: `告诉AI“请使用积极的语气”，比说“不要用消极语气”效果更好`,
  category: `text`
}, {
  text: `在提示词中附带满意的案例，AI能迅速模仿你的行文格式`,
  category: `text`
}, {
  text: `加上“请一步步进行推理”，能大幅提高处理复杂逻辑题的准确率`,
  category: `text`
}, {
  text: `交待清楚目标受众和具体应用场景，生成的文案会更有针对性`,
  category: `text`
}, {
  text: `不要让AI一次写完长文，先生成大纲，确认后再逐段扩写`,
  category: `text`
}, {
  text: `设定具体的字数和情绪，如“写一段100字幽默带讽刺的短评”`,
  category: `text`
}, {
  text: `输入长文并要求“提取时间、地点、人物，并以JSON格式输出”`,
  category: `text`
}, {
  text: `把优秀的文案喂给AI，让它分析并反推当初生成这段文案的提示词`,
  category: `text`
}, {
  text: `大部分的大模型都支持图片反推，但支持视频反推的不对，例如Qwen系列`,
  category: `text`
}, {
  text: `把最重要的元素（如人物、主要物体）放在提示词的最开头位置`,
  category: `image`
}, {
  text: `加入“电影级光效”、“丁达尔效应”或“边缘背光”提升画面高级感`,
  category: `image`
}, {
  text: `使用“广角镜头”、“微距特写”或“俯视仰拍”精准控制画面构图`,
  category: `image`
}, {
  text: `提示词中加入“莫兰迪色系”、“高对比度”统一画面的色彩倾向`,
  category: `image`
}, {
  text: `添加“杰作、最高画质、8k分辨率、细节极其丰富”等通用魔法词`,
  category: `image`
}, {
  text: `利用参考图控制构图走势，配合文本提示词进行二次风格迁移`,
  category: `image`
}, {
  text: `描述细节忌抽象：说“穿红裙在雨中撑伞的女孩”，不要说“忧郁女孩”`,
  category: `image`
}, {
  text: `大尺寸慢不稳而且贵，可以先生成小尺寸，满意后高清放大处理`,
  category: `image`
}, {
  text: `越具体的穿搭描述，越能避免AI随机生成结构奇怪的衣服款式`,
  category: `image`
}, {
  text: `若生成元素过多显得拥挤，加上“极简主义”、“干净的背景”、“留白”`,
  category: `image`
}, {
  text: `提示词中加入“镜头缓慢平移”、“推镜头”来精确控制运镜语言`,
  category: `video`
}, {
  text: `利用昂贵主力模型+首尾帧便宜模型，是省钱有好用的方法`,
  category: `video`
}, {
  text: `拆解动作过程，如“他先低头看手表，然后慢慢抬头望向天空”`,
  category: `video`
}, {
  text: `对于长视频，提供多视角的参考图，能有效减少过程中的人物崩坏`,
  category: `video`
}, {
  text: `描述动作和场景即可，太复杂的心理描写AI视频模型目前无法表现`,
  category: `video`
}, {
  text: `添加光影动态变化，如“阳光透过树叶缝隙，光斑在人物脸上移动”`,
  category: `video`
}, {
  text: `先用极高画质的模型生成图像，再输入到视频模型让图片动起来`,
  category: `video`
}, {
  text: `根据低端模型模型能力选择5秒生成，过长的时间容易导致后半段画面崩塌`,
  category: `video`
}, {
  text: `部分模型支持音频节点，让可以让生成的数字人根据台词音频精准对口型`,
  category: `video`
}, {
  text: `描述“大雪纷飞”、“烟雾弥漫”，这类动态粒子效果AI处理极为出色`,
  category: `video`
}, {
  text: `加入“频繁眨眼”、“嘴角微微上扬”，让生成的视频人物更有生命力`,
  category: `video`
}, {
  text: `单个短镜头内尽量保持单一视角，复杂的机位切换容易导致空间错乱`,
  category: `video`
}, {
  text: `写长视频脚本时，务必把提示词按照场景分开，建立独立节点生成`,
  category: `video`
}, {
  text: `上传真人动作视频作为骨骼参考，让AI角色完美复刻复杂的舞蹈动作`,
  category: `video`
}, {
  text: `打斗跳舞高运动感模型目前只推荐SD2`,
  category: `video`
}, {
  text: `在连续节点中传递相同的角色设定，确保下一秒主角不会突然换衣服`,
  category: `video`
}, {
  text: `设定首尾完全相同的画面特征，非常适合制作动态壁纸或网页背景`,
  category: `video`
}, {
  text: `生文写分镜，生图做原画，最后一起喂给生视频节点，流程无缝衔接`,
  category: `video`
}, {
  text: `画布支持多个项目管理，不要把所有都放在一个项目里面`,
  category: `general`
}, {
  text: `生成的满意结果随时拖入素材，作为公共素材池供各节点调用`,
  category: `general`
}, {
  text: `在复杂的节点群旁边添加文本便签，几个月后你依然能一眼看懂逻辑`,
  category: `general`
}, {
  text: `工作流会被实时保存在本地，即使意外关闭浏览器，进度也绝不会丢失`,
  category: `general`
}, {
  text: `使用快捷键Q / W /E，让你快速添加常用节点`,
  category: `general`
}, {
  text: `目前Window支持将资源一键传入剪映，非常高效`,
  category: `general`
}, {
  text: `不要把所有图片都铺满整个画布，不妨试试图片盒子`,
  category: `image`
}, {
  text: `画布太乱？点击“自动整理”功能，让复杂的节点拓扑图瞬间井井有条`,
  category: `general`
}, {
  text: `想在家/在公司资源共享，迁移你的文件的最快方法是把data文件夹搬过去`,
  category: `general`
}, {
  text: `对于视频生成节点，双击即可在画布悬浮窗中全屏播放，无需下载查看`,
  category: `general`
}, {
  text: `不要把整章小说丢给AI，按场景发生地切分成小段，剧本生成会更精准`,
  category: `text`
}, {
  text: `小说里的心理活动无法直接拍出，让AI将其转化为具体的微表情或肢体动作`,
  category: `text`
}, {
  text: `拆解动作时避免连贯长句，让AI重写为“他拔出剑。他向前冲刺”的短平快句型`,
  category: `text`
}, {
  text: `设定镜头感：“请用导演口吻描述剧情，多使用推镜头、特写和全景等专业术语”`,
  category: `text`
}, {
  text: `对于战斗场景，提示AI“增加动词密度，强调力量和速度感，减少修饰性形容词”`,
  category: `text`
}, {
  text: `遇到抽象设定（如剑气、威压），让AI具象化为“发光的蓝色半月形能量波”`,
  category: `text`
}, {
  text: `剧本分镜编号化：要求AI输出“Shot 1, Shot 2”，在画布中对应独立分支`,
  category: `text`
}, {
  text: `如果主角会变身，在小传节点中提前定义好“常态”和“变身态”的两套特征库`,
  category: `text`
}, {
  text: `小说转绘本的核心是角色一致性：先跑出完美的主角三视图，作为后续垫图参考`,
  category: `image`
}, {
  text: `给角色面部打光：加入“伦勃朗光”或“蝴蝶光”，让角色五官更具立体电影感`,
  category: `image`
}, {
  text: `分镜图构图技巧：人物对话多用“过肩镜头（Over-the-shoulder）”，增强互动`,
  category: `image`
}, {
  text: `如果小说场景是宏大奇幻修仙，多用“极远景（Extreme long shot）”和史诗构图`,
  category: `image`
}, {
  text: `控制画面留白：如果该图后续要配大量旁白字幕，提示词记得加上“负空间”`,
  category: `image`
}, {
  text: `保持画风统一的捷径：在每个生图节点末尾加上同一位特定画师或电影导演的名字`,
  category: `image`
}, {
  text: `对于连贯动作，先生成静止的起步动作，这比直接生成复杂的运动画面更容易`,
  category: `image`
}, {
  text: `突出人物情绪：使用“面部特写”配合“泪水”、“咬牙”、“瞳孔地震”等微表情词`,
  category: `image`
}, {
  text: `场景氛围图不需要太清晰的人脸，强调“轮廓（Silhouette）”和环境光更出效果`,
  category: `image`
}, {
  text: `生成背影或侧脸：有效规避正脸崩坏的风险，同时还能增加画面的故事悬念感`,
  category: `image`
}, {
  text: `重要武器或道具：单独生成高清大图，在后续剧情中作为局部重绘的参考源`,
  category: `image`
}, {
  text: `色彩心理学：回忆情节用“泛黄滤镜/黑白”，战斗高潮用“高饱和度对比色”`,
  category: `image`
}, {
  text: `仰拍能让反派显得高大威猛，俯拍（High angle）能表现角色的弱小与无助`,
  category: `image`
}, {
  text: `避免画面太平淡：加入“前景遮挡（Foreground framing）”，如透过树叶看主角`,
  category: `image`
}, {
  text: `整场戏的提示词都带上“蓝绿色调（Teal and orange）”，轻松打造好莱坞大片质感`,
  category: `image`
}, {
  text: `不要每一格都画满人物：适当插入只画背景空镜头的过渡图，让节奏张弛有度`,
  category: `image`
}, {
  text: `生成速度感画面：加上“运动模糊（Motion blur）”和“速度线”视觉效果`,
  category: `image`
}, {
  text: `固定一张完美的图作为风格锚点，通过工作流将其作为所有后续生成的参考`,
  category: `image`
}, {
  text: `图生视频第一准则：原图必须足够清晰，视频的画质与稳定性上限由原图决定`,
  category: `video`
}, {
  text: `视频提示词要克制：不要重复描述图片里已有的东西，重点描述什么东西怎么动`,
  category: `video`
}, {
  text: `小说里的打斗戏：运镜词使用“快速平移（Fast pan）”或“推拉镜头”增强冲击力`,
  category: `video`
}, {
  text: `人物对话场景：保持摄像机微弱移动（Subtle drift），不要完全静止，增加呼吸感`,
  category: `video`
}, {
  text: `控制动作幅度：廉价模型AI视频动作过大易变形，加上“缓慢移动”能大幅提高成功率`,
  category: `video`
}, {
  text: `在视频提示词中强调“角色眨眼并看向镜头”，让原画里的纸片人瞬间活过来`,
  category: `video`
}, {
  text: `首尾相接控制：动作复刻最后一帧，但是可以换个角度`,
  category: `video`
}, {
  text: `小说转场效果：生视频时加入“黑屏过渡”或“白闪”，方便后续节点拼剪`,
  category: `video`
}, {
  text: `处理人物转身：尽量用“切换不同机位”代替“让人物在同一个镜头里转180度”`,
  category: `video`
}, {
  text: `表现时间流逝：输入一张白天场景图，提示词写“从白天变黑夜的延时摄影”`,
  category: `video`
}, {
  text: `头发和衣服的物理效果：加上“随风飘动（Blowing in the wind）”，极大增加生动感`,
  category: `video`
}, {
  text: `镜头光晕移动：提示词加“镜头光晕在画面中划过”，科幻与写实摄影感拉满`,
  category: `video`
}, {
  text: `遇到视频生成崩坏：不要硬死磕，回到生图节点换一张构图稍微不同的图片再试`,
  category: `video`
}, {
  text: `制造悬疑感：使用“缓慢向黑暗的走廊尽头推进（Slow dolly in toward darkness）”`,
  category: `video`
}, {
  text: `你用过Ctrl+D这个快捷键吗，不妨对着节点尝试下，有惊喜`,
  category: `general`
}, {
  text: `云端可以备份你的api/多开/视频模型等信息，你换了设备也可以马上用，而本地资源你需要手动备份`,
  category: `general`
}, {
  text: `别被工具困住：接受适度的随机性，有时AI的“错误”会带来意想不到的绝妙转场`,
  category: `general`
}, {
  text: `不会写提示词时，不妨查看提示词库，学习别人的经验`,
  category: `general`
}];

var Ua = [{
    value: ``,
    label: `全部`
  }, {
    value: `text`,
    label: `文本`
  }, {
    value: `image`,
    label: `生图`
  }, {
    value: `video`,
    label: `视频`
}];

var to = [{
    label: `2×2`,
    rows: 2,
    cols: 2
  }, {
    label: `3×3`,
    rows: 3,
    cols: 3
  }, {
    label: `4×4`,
    rows: 4,
    cols: 4
  }, {
    label: `1×5`,
    rows: 1,
    cols: 5
  }, {
    label: `5×1`,
    rows: 5,
    cols: 1
}];

var bo = [{
    label: `2×2`,
    rows: 2,
    cols: 2
  }, {
    label: `3×3`,
    rows: 3,
    cols: 3
  }, {
    label: `4×4`,
    rows: 4,
    cols: 4
  }, {
    label: `1×5`,
    rows: 1,
    cols: 5
  }, {
    label: `5×1`,
    rows: 5,
    cols: 1
}];

var ko = [{
    label: `16:9`,
    value: `16:9`
  }, {
    label: `9:16`,
    value: `9:16`
  }, {
    label: `3:4`,
    value: `3:4`
  }, {
    label: `4:3`,
    value: `4:3`
  }, {
    label: `1:1`,
    value: `1:1`
}];

var is = [{
    label: `16:9`,
    value: `16:9`
  }, {
    label: `9:16`,
    value: `9:16`
  }, {
    label: `3:4`,
    value: `3:4`
  }, {
    label: `4:3`,
    value: `4:3`
  }, {
    label: `1:1`,
    value: `1:1`
  }, {
    label: `自定义`,
    value: `custom`
}];

var zs = [240, 360, 480, 640, 720];

var Zs = [{
    label: `原始`,
    value: 0
  }, {
    label: `2048`,
    value: 2048
  }, {
    label: `1600`,
    value: 1600
  }, {
    label: `1280`,
    value: 1280
  }, {
    label: `1024`,
    value: 1024
  }, {
    label: `768`,
    value: 768
  }, {
    label: `512`,
    value: 512
}];

var yp = [{
  id: `auto`,
  label: `自动`,
  value: null
}, {
  id: `1:1`,
  label: `1:1`,
  value: 1
}, {
  id: `2:1`,
  label: `2:1`,
  value: 2
}, {
  id: `3:4`,
  label: `3:4`,
  value: 3 / 4
}, {
  id: `4:3`,
  label: `4:3`,
  value: 4 / 3
}, {
  id: `16:9`,
  label: `16:9`,
  value: 16 / 9
}, {
  id: `21:9`,
  label: `21:9`,
  value: 21 / 9
}, {
  id: `9:16`,
  label: `9:16`,
  value: 9 / 16
}];

var fm = [{
    id: `convenience`,
    label: `便利生活`,
    directoryName: `便利生活`
  }, {
    id: `home`,
    label: `居家生活`,
    directoryName: `生活家居`
  }, {
    id: `outdoor`,
    label: `户外出行`,
    directoryName: `户外出行`
  }, {
    id: `tools`,
    label: `工具配件`,
    directoryName: `工具配件`
  }, {
    id: `my-models`,
    label: `我的模型`,
    directoryName: ``
}];

export { mi, Ua, to, bo, ko, is, zs, Zs, yp, fm };
