/**
 * 剧本盒子 —— 权威数据契约 schema + 归一化（P0-0 地基）。
 *
 * 数据契约纪律（docs/剧本盒子数据流对齐与基础设施补齐… P0）：
 *  - 本文件是 ScriptBoxNode.data 全部字段（顶层 / shot 子字段 / asset 子字段）的唯一真相源；
 *  - 任何功能需新字段 → 先在此登记「默认值」，禁止在 UI / 引擎裸加字段；
 *  - 所有读取 node.data 前先经 normalizeScriptBoxData 补齐缺省（向后兼容迁移旧画布数据）。
 *
 * 序列化随画布快照（canvas-state-v1-{projectId}）走，不另立存储键（见 contracts.ts 注释），
 * 防止双写漂移。归一化返回新对象，不改动传入的 raw。
 */
import type { Shot } from './scriptBoxPrompts';

/** 剧本盒 data 顶层字段（P0-1 分通道 negative + tailFrameAngleIds 尾帧默认角度） */
export interface ScriptBoxTop {
  step: number;
  story: string;
  upstreamStory: string;
  globalStyle: string;
  aspectRatio: string;
  customAspectRatio: string;
  shotCount: string;
  customCount: string;
  tailFrameAngleIds: string[];
  /** 当前选用 playbook id（默认漫剧）；提示词配置唯一真相源 = playbook */
  playbookId: string;
  /** 选中时名称快照（悬挂检测提示用） */
  playbookLabel: string;
}

/**
 * 单个 shot 子字段（含 P1-1 连续性 / 尾帧变体全字段）。
 * 基础形状复用 scriptBoxPrompts 的 `Shot`（含 id/index/dialogue/imgGen 等 + 索引签名），
 * 这里补充引擎运行时动态写入的布尔/状态字段（Shot 未显式登记，否则经索引签名退化为 unknown）。
 */
export interface ScriptBoxShot extends Shot {
  promptLoading?: boolean | undefined;
  imgGenLoading?: boolean | undefined;
  connImg?: boolean | undefined;
  connVid?: boolean | undefined;
  usePrevShotVideoTail?: boolean | undefined;
  prevShotImageRefUrls?: string[] | undefined;
  prevTailFrameVariants?: unknown[] | undefined;
  selectedTailFrameVariantId?: string | undefined;
  tailFrameVariantsLoading?: boolean | undefined;
  tailFrameVariantsError?: string | undefined;
  /** 关键帧/宫格等 AI 生图结果（运行时写入，属本表固定字段） */
  imgGen?: ScriptBoxImgGen | undefined;
  /** 该 shot 连出的 videoGenerateNode 持久化的视频地址（尾帧抽取读取） */
  videoUrl?: string | undefined;
}

/** 单个 asset 子字段（含 P0-3 assetUrl / thumbnailUrl 分离） */
export interface ScriptBoxAsset {
  id: string;
  category: string;
  name: string;
  description: string;
  prompt: string;
  assetUrl: string;
  thumbnailUrl: string;
  has: boolean;
  loading: boolean;
  picked: boolean;
  /** 资产参考图上传状态（历史 videoStatus/videoError 在归一化时迁移到此处） */
  imageStatus: string;
  imageError: string | undefined;
  [key: string]: unknown;
}

/**
 * data 的部分更新（`updateData` 的 patch 形状）。
 * 【P5】原先用 `Record<string, unknown>`：ScriptBoxData 删掉索引签名后，
 * 「返回 ScriptBoxData 的函数式 patch」就不再能赋给它了 —— 这说明旧类型把
 * 「随便什么键都能写」当成了契约。写回本就只能写本表登记的字段，故收成 Partial。
 */
export type ScriptBoxPatch = Partial<ScriptBoxData>;

/**
 * data 写回通道（引擎 ↔ hook 的跨层契约，收口在此避免两处各写一份）。
 * 支持对象 patch（直接合并）与函数式 patch `(latestData) => patch`（并发安全合并）。
 */
export type ScriptBoxUpdateData = (
  patch: Record<string, unknown> | ((latest: ScriptBoxData) => ScriptBoxPatch),
) => void;

/**
 * 上游接入图片（`useConnectedInputs` → `node.data.upstreamImages`，由 ScriptBoxNode 同步）。
 * 键固定，来源是连线节点的投影，故显式登记而非留在索引签名里。
 */
export interface ScriptBoxUpstreamImage {
  id?: string | undefined;
  url?: string | undefined;
  label?: string | undefined;
  sourceNodeId?: string | undefined;
}

/** 上游接入文本条目（`node.data.upstreamTexts`，与 upstreamImages 同源同批写入）。 */
export interface ScriptBoxUpstreamText {
  id?: string | undefined;
  label?: string | undefined;
  text?: unknown;
  sourceNodeId?: string | undefined;
}

/** 本片模型设置（GearSettings 写回 `node.data.assetModelSettings`）。 */
export interface ScriptBoxAssetModelSettings {
  globalModel?: string | undefined;
  globalAspectRatio?: string | undefined;
  globalSize?: string | undefined;
}

/** 关键帧/四宫格等 AI 生图结果（运行时挂到 `shot.imgGen`）。 */
export interface ScriptBoxImgGen {
  type?: string | undefined;
  label: string;
  prompt: string;
  ts: number;
}

/**
 * 已连线下游条目（运行时写入 `node.data.connected`）。
 * 值来自持久化快照 ⇒ 读取方必须逐条守卫（见 StepPrompt 的 ConnectedItem 过滤），
 * 故此处**有意声明为 unknown[]**，不假装每条都合法。
 */
export type ScriptBoxConnectedEntry = unknown;

/** 剧本盒节点 data 完整形状 */
export interface ScriptBoxData extends ScriptBoxTop {
  shots: ScriptBoxShot[];
  assets: ScriptBoxAsset[];
  /** 生成剧本时写回的项目名（StepShots 标题/导出用） */
  projectName?: string | undefined;
  /** 本片文本模型（新字段；旧数据只有 selectedModel，读取方需双读） */
  textModel?: string | undefined;
  /** 本片文本模型（历史字段，与 textModel 同步写入，保留向后兼容） */
  selectedModel?: string | undefined;
  /** 本片生图模型 / 比例 / 尺寸 */
  assetModelSettings?: ScriptBoxAssetModelSettings | undefined;
  /** 上游连入的图片（ScriptBoxNode 同步） */
  upstreamImages?: ScriptBoxUpstreamImage[] | undefined;
  /** 上游连入的文本条目（ScriptBoxNode 同步） */
  upstreamTexts?: ScriptBoxUpstreamText[] | undefined;
  /** 已连线的下游节点（运行时写入；读取需守卫） */
  connected?: ScriptBoxConnectedEntry[] | undefined;
  /** 步骤1 生成中遮罩（发起请求置位、结束复位） */
  genMask?: boolean | undefined;
  /** 生成中已生成字数（标题栏计时展示） */
  genChars?: number | undefined;
  /** 资产区全局选中数（派生值，随 assets 写回） */
  pickedCount?: number | undefined;
}

/**
 * 引擎回调集合（三步组件经 props.callbacks 调用，本组件不做计算）。
 * 由 useScriptBoxEngine 创建并**作为返回值下发**（不经 node.data）；ScriptBoxNode 额外补 onDisconnectUpstream。
 *
 * 【TD-09-4 · 2026-09-16】本接口**不得**被任何持久化类型 extends —— `node.data` 经
 * `canvasSnapshotSchema.NODE_KEEP` 整包落盘（`JSON.stringify`），函数在序列化时会被**静默丢弃**
 * （`AbortController`/`Map` 甚至静默变 `{}`）。历史形态是 `ScriptBoxNodeData extends ScriptBoxCallbacks`
 * + 每次挂载 `patchNodeDataById` 重注入，掩盖了「每次落盘都在丢」；现已改为 React 通道下发。
 *
 * 更新(2026-09-11)：`[key: string]: unknown` 索引签名已删——它会让「callbacks 字段名拼错」静默通过。
 * 同时补上引擎实际产出但本表漏登的 2 个（onGenerateAssetImage / onGenerateAllAssetImages，
 * 见 scriptBoxEngine.ts 的产出点与 StepAssets 的消费点）——回调字段真源只此一处，禁止在别处重抄。
 */
export interface ScriptBoxCallbacks {
  onGenerateScript?: () => Promise<void> | void;
  /**
   * 生成全部/选中分镜的提示词（缺省 = 全部）。
   * 【签名口径】分镜 id 真源 `Shot.id` 是 `string | number`（`scriptBoxPrompts.ts:442`），
   * `createNewShot` 产出 `Number`（`scriptBoxPrompts.ts:334`）而旧数据可能是字符串。
   * 引擎按 `s.id === shotId` **严格相等**匹配（`scriptBoxEngine.ts:875`）→ 回调入参必须**同型透传**，
   * 不得 `String()` 归一（否则 number id 的镜头匹配不到，静默无反应）。
   */
  onGenerateShotPrompts?: (
    shotIds: Array<string | number>,
    feedback?: string,
  ) => Promise<void> | void;
  /** 单个分镜生图（缺省 type 见引擎 IMAGE_GEN_DEFAULT）。 */
  onGenerateShotImage?: (shotId: string | number, type?: string) => Promise<void> | void;
  /** 单个资产生成参考图（引擎产出；StepAssets 消费） */
  onGenerateAssetImage?: (assetId: string) => void;
  /** 批量生成资产参考图（缺省 = 全部无图资产） */
  onGenerateAllAssetImages?: (assetIds?: string[]) => void;
  /** 连下游（target 缺省 'image'）。 */
  onConnectShot?: (shotId: string | number, target?: string) => void;
  /** 批量连下游（缺省 = 全部镜头）。 */
  onConnectShots?: (shotIds: Array<string | number>, target?: string) => void;
  /** 合并多条分镜生成一个视频节点（缺省 = 全部）。 */
  onGenerateMergedVideo?: (
    shotIds: Array<string | number>,
    target?: string,
  ) => Promise<void> | void;
  onReviewShotPrompt?: (
    shotId: string | number,
    field: string,
    feedback?: string,
  ) => Promise<{ ok: boolean; text?: string } | undefined>;
  onGenerateTailFrameVariants?: (shotId: string | number) => void;
  /** 重试单张资产图「上传素材库」（此前落盘失败 → imageStatus='failed'） */
  onRetryAssetImageUpload?: (assetId: string) => Promise<void> | void;
  /** 批量上传资产图到素材库 */
  onUploadAllAssetImages?: () => void;
  /** 上传单张资产图（file 为空 = 走文件选择器） */
  onUploadAssetImage?: (assetId: string, file?: File | null) => Promise<void> | void;
  /** 从素材库挑一张图作为资产参考图 */
  onPickAssetImage?: (assetId: string, url: string) => void;
  onDisconnectUpstream?: (sourceNodeId: string) => void;
}

/** 顶层字段默认值（含 P0-1 分通道 negative + tailFrameAngleIds 尾帧默认角度）。 */
export function defaultScriptBoxTop(): ScriptBoxTop {
  return {
    step: 1,
    story: '',
    upstreamStory: '',
    globalStyle: '',
    aspectRatio: '16:9',
    customAspectRatio: '16:9',
    shotCount: 'auto',
    customCount: '',
    tailFrameAngleIds: ['forward', 'closeup', 'rotateLeft45'],
    // playbook 收口：当前选用 playbook id（默认漫剧）；label 为选中时名称快照（悬挂检测提示用）。
    // 提示词配置唯一真相源 = playbook（scriptBoxPlaybookStore），node.data 不存任何 customXxx 副本。
    playbookId: 'manga',
    playbookLabel: '',
  };
}

/** 单个 shot 子字段默认值（含 P1-1 连续性 / 尾帧变体全字段）。 */
export function defaultShotFields(): ScriptBoxShot {
  return {
    duration: '5s',
    description: '',
    shotType: '',
    lighting: '',
    dialogue: [],
    sound: '',
    motion: '固定',
    grid: 0,
    prompt: '',
    videoPrompt: '',
    promptLoading: false,
    imgGenLoading: false,
    connImg: false,
    connVid: false,
    // P1-1 连续性 + 尾帧变体
    usePrevShotVideoTail: false,
    prevShotImageRefUrls: [],
    prevTailFrameVariants: [],
    selectedTailFrameVariantId: 'original',
    tailFrameVariantsLoading: false,
    tailFrameVariantsError: undefined,
  };
}

/** 单个 asset 子字段默认值（含 P0-3 assetUrl / thumbnailUrl 分离）。 */
export function defaultAssetFields(): ScriptBoxAsset {
  return {
    id: '',
    category: 'character',
    name: '',
    description: '',
    prompt: '',
    assetUrl: '',
    thumbnailUrl: '',
    has: false,
    loading: false,
    picked: false,
    // 资产参考图上传状态（上传的是图片，命名用 image；历史 videoStatus/videoError 在归一化时迁移）
    imageStatus: '',
    imageError: undefined,
  };
}

/**
 * 读取旧数据时补齐缺省字段（向后兼容迁移）。所有读取 node.data 前必经此函数。
 * @param [raw] 原始 node.data（可能来自旧画布快照，缺新字段）
 * @returns 归一化后的 data（含全量默认 + 存量的覆盖），不就地改 raw
 */
export function normalizeScriptBoxData(raw: Record<string, unknown> = {}): ScriptBoxData {
  const base = defaultScriptBoxTop();
  const d = { ...base, ...raw } as ScriptBoxData;

  // shots 子字段归一化：旧 shot 缺 P1-1 新字段时补默认；非对象项给空 shot 兜底。
  d.shots = (Array.isArray(raw.shots) ? raw.shots : []).map((s) =>
    s && typeof s === 'object' ? { ...defaultShotFields(), ...s } : { ...defaultShotFields() },
  );

  // assets 子字段归一化：P0-3 thumbnailUrl 缺省回退 assetUrl（唯一回退点，UI 不再各自处理）。
  d.assets = (Array.isArray(raw.assets) ? raw.assets : []).map((a) => {
    if (!a || typeof a !== 'object') return { ...defaultAssetFields() };
    const norm = { ...defaultAssetFields(), ...a } as ScriptBoxAsset & {
      videoStatus?: string;
      videoError?: string;
    };
    if (!norm.thumbnailUrl) norm.thumbnailUrl = norm.assetUrl || '';
    // 字段改名迁移：旧画布用 videoStatus/videoError（历史命名错误，存的是图片上传状态），
    // 迁移到 imageStatus/imageError，避免老数据丢失上传状态。
    if (norm.imageStatus === '' && (norm.videoStatus || norm.videoStatus === '')) {
      if (norm.videoStatus !== undefined) norm.imageStatus = norm.videoStatus;
      if (norm.videoError !== undefined) norm.imageError = norm.videoError;
    }
    return norm;
  });

  return d;
}

/** `s` 是否为可当作 shot 的对象项（与 normalize 的 `s && typeof s === 'object'` 同判据）。 */
function isScriptBoxShotValue(s: unknown): s is ScriptBoxShot {
  return !!s && typeof s === 'object';
}

/** `a` 是否为可当作 asset 的对象项（同上）。 */
function isScriptBoxAssetValue(a: unknown): a is ScriptBoxAsset {
  return !!a && typeof a === 'object';
}

/**
 * 函数式写回 patch 的 latest 视图：**只补顶层缺省，shots/assets 保持原始项**。
 *
 * 【为什么不直接用 `normalizeScriptBoxData`】
 *   函数式 patch 的返回值会被整体写回 node.data。normalize 会把每个 shot 补成
 *   `defaultShotFields()` 的形状（promptLoading:false / duration:'5s' / …）—— 于是
 *   「只复位 busy 标记」的写回会顺带把整套子字段默认值落盘：持久化数据每次写回都膨胀，
 *   且会让「干净镜头不被改写」这类语义失效。补默认是**读取**契约，不该变成**写回**副作用。
 *
 * 【契约】与 `ScriptBoxData` 同形（shots/assets 必为数组、顶层字段带默认值），
 *   但子数组元素引用原样透传，写回不产生新字段。
 */
export function toScriptBoxData(raw: Record<string, unknown> = {}): ScriptBoxData {
  const d = normalizeScriptBoxData(raw);
  d.shots = (Array.isArray(raw.shots) ? raw.shots : []).map((s) =>
    isScriptBoxShotValue(s) ? s : defaultShotFields(),
  );
  d.assets = (Array.isArray(raw.assets) ? raw.assets : []).map((a) =>
    isScriptBoxAssetValue(a) ? a : defaultAssetFields(),
  );
  return d;
}

/* ════════════════════════════════════════════════════════════════
 * 剧本盒「多任务」的伪 nodeId 契约（**单源**：引擎生成 / hook recover 解析共用）
 * ────────────────────────────────────────────────────────────────
 * 剧本盒一个节点会发起多类独立生成任务（每张资产一张图 / 每镜一张尾帧综合图）。**广播载荷只带
 * nodeId**（`agent:task-completed` 的 `{taskId, nodeId, resultUrl, type}`）⇒ 回填要知道「哪张图归哪个
 * asset / 哪一镜」，只能靠伪 nodeId 前缀反解（见 `useScriptBoxEngine` 的 parse*）；顺带任务中心
 * 每张一卡、可读。故每类任务用独立伪 nodeId：
 *
 * 【2026-09-23 理由订正 · ADR-0059】原文写的是「任务中心以 nodeId 为卡片粒度且 reportGenerate 会
 *   结束同 nodeId 的旧 running 任务 → 任务会互相顶掉」。该"结束"行为已**删除**（镜像不得筛除真源），
 *   故规则**继续成立、但理由换成上面这条**（回填路由），代码注释别再引用"会被顶掉"。
 *   - 资产图：`${nodeId}-asset-${assetId}`（批量时每张一卡）
 *   - 尾帧综合图：`${nodeId}-tailframe-${shotId}`（每镜一卡）
 * 引擎上报与 hook 回填**必须用同一规则** → 收在此处，禁止各自拼字符串（否则改一处漏一处）。
 * ════════════════════════════════════════════════════════════════ */

/** 资产图任务的伪 nodeId（引擎 reportGenerate 上报用）。 */
export function assetTaskNodeId(nodeId: string, assetId: string): string {
  return `${nodeId}-asset-${assetId}`;
}

/**
 * 反解伪 nodeId → assetId（hook 收 `agent:task-completed` 广播时用）。
 * 非本剧本盒的资产任务（前缀不匹配）返回 null → 调用方忽略（精准回填，与节点侧 `d.nodeId === nodeId` 同精神）。
 */
export function parseAssetTaskNodeId(nodeId: string, taskNodeId: string): string | null {
  const prefix = `${nodeId}-asset-`;
  return taskNodeId.startsWith(prefix) ? taskNodeId.slice(prefix.length) : null;
}

/** 尾帧综合图任务的伪 nodeId（引擎 reportGenerate 上报用；每镜一张卡，互不顶掉）。
 * shotId 收 `string | number`（Shot.id 真源，模板串内自动 String 化——此处是**构造键**，非身份匹配）。 */
export function tailFrameTaskNodeId(nodeId: string, shotId: string | number): string {
  return `${nodeId}-tailframe-${shotId}`;
}

/** 反解尾帧任务伪 nodeId → shotId（hook 收 `agent:task-completed` 广播回填用；非本盒/非尾帧任务返回 null）。 */
export function parseTailFrameTaskNodeId(nodeId: string, taskNodeId: string): string | null {
  const prefix = `${nodeId}-tailframe-`;
  return taskNodeId.startsWith(prefix) ? taskNodeId.slice(prefix.length) : null;
}
