/**
 * ── 唯一性声明（2026-08-30）──
 * 本表内 EVENTS / STORAGE_KEYS / GEN_ERRORS / NODE_TYPES / apiRegistry 各自是全项目唯一登记表；
 *
 * 🔒 【键名冻结 · ADR-0038】本文件各登记表的**键名与字符串值**（存储键 / KV 键 / 事件名 / 节点类型串 /
 *    错误码）是**跨版本共享的持久化标识**（存量数据与已落盘 URL 都按它寻址），**不是内部符号**。
 *    ⇒ **改名/重构只动符号名与文件路径，禁止"顺手统一"这些字符串** —— 改键＝存量数据失联。
 *    ⇒ 若发现符号名与键名不一致（如符号 `videoEditorXxx`、键仍 `cutia-xxx`），那是**故意的**，不要改。
 *    ⇒ 确需改键：单独成批 + 用户显式接受数据重置（判据全文见 `docs/adr/ADR-0038-*.md`）。
 *    ⇒ **不做逐行标注**（TD-25-12 改判 2026-09-20）：把同一条判据复制到 800 个登记行 = **装饰化**
 *      （本仓 `// catch-ok:` 实证：99 处标记里 7 处贴错 —— "一句话即可伪装成已评审"），且与
 *      ADR-0046「判据要么机器可判、要么字段不可达」冲突。本表的**正确落点 = 唯一入口**（键名只在此定义）
 *      + **本节**；三处表声明各带**一行指针**（不是复制）。
 * 彼此形态相同（静态声明表 + 派生/校验），与 settingRegistry.js 同族（兄弟）。
 * 新增同族登记表先归本文件或既有表，禁止另起新表。
 *
 * 横切契约登记表 —— 横切基础设施层的「单一事实来源」。
 *
 * 【职责】把跨切面的机制（事件/存储键/错误类型）集中登记，避免散落各文件、
 * 调用方式不一致、发布无订阅等死代码。后续所有新增机制先查/先登记本表。
 *
 * 【分层】横切基础设施分 5 类，各一个权威入口：
 *   ① 通信层 eventBus     —— 瞬时事件广播（本表 EVENTS 是其注册表）
 *   ② 表现层 toastStore   —— 用户可见即时反馈
 *   ③ 观测层 logger       —— 记录 + 上报，供排查
 *   ④ 持久化层 storageAdapter + *Store —— 数据存取
 *   ⑤ 能力层 assetType / clipboard / filesApi / imageCompress 等 —— 工具函数单一入口
 *
 * 【约定】新增事件：先在本表 EVENTS 登记（发布方/订阅方须成对，避免「只监听未发布」），
 * 命名统一「领域:动作」，再用 eventBus.publish/subscribe。
 *
 * 【能力层单一入口登记 · 2026-08-28】
 *   ⑤ 能力层「@名 → 素材芯片」匹配：`promptChips.js` 的 `autoLinkAssetsByName`（唯一入口）。
 *   · 输入 prompt 字符串 + 候选素材数组；把 `@素材名`（全等命中）替换成 `@{id:label|thumb}`。
 *   · 禁止在 PromptInput/任何组件里手写 lastIndexOf('@')/匹配正则（见 docs/70）。
 *   · 图片命名写回（NodeTitle.onRename → 节点 data.label）+ 产出带 label（getNodeOutput）
 *     是本能力的前置链路，统一走 NodeShell/useConnectedInputs 唯一入口，禁止各节点旁路。
 */

/**
 * 高消耗积分确认（通用积分闸 creditSwitch）相关契约字符串 —— 单一事实来源。
 * 【三按钮收敛 · 2026-08-27】直接生图/分步确认/完全自主下，真生成图/视频前是否先确认，
 * 由全局开关 creditSwitch（默认开）+ per-conversation creditGate 决定（见 docs/59、60）。
 * 【更新 2026-09-05】执行模型已收敛恒 auto（direct/step-confirm 三态删除），模式注册表 runModeRegistry 已删除，恒 auto；闸语义不变：真生成前先确认，由 creditSwitch + creditGate 决定。
 * 所有消费方一律 import 本常量引用，禁止散写裸字面量。
 */
/** creditSwitch 全局存储键（localStorage，默认 true = 任何模式真烧积分前先确认） */
export const CREDIT_SWITCH_KEY = 'agent_credit_switch';
/** conversation 会话字段名：creditGate（单一对象 { pending, gens, map }，per-conversation 唯一读写清） */
export const CREDIT_GATE_FIELD = 'creditGate';
/** credit 确认门禁广播事件名（useCanvasAgentTools 置位/清除 → AgentPanel 刷新确认卡片） */
export const CREDIT_GATE_EVENT = 'agent:credit-gate';

/**
 * 事件注册表（通信层 eventBus 的单一事实来源）。
 *
 * 每项：
 *   key  = 事件名（统一「领域:动作」）
 *   from = 发布方（文件:行）
 *   to   = 订阅方（文件:行）
 *   payload = 载荷结构（约定）
 *   note = 用途/状态
 *
 * ⚠️ 铁律（给维护者 / AI 读此文件时）：
 *   本表的 from / to 行号靠人工维护，会随代码插入而【漂移】，
 *   也可能出现【表登记滞后于代码】的情况（如 to:[] 实际已被订阅）。
 *   因此：凡判定「某事件无订阅方 / 是死事件 / 可删发布逻辑」，
 *   必须以代码实测为准——grep `subscribe('事件名'` 确认，
 *   禁止仅凭本表 to:[] / 注释「待核对」下结论。
 *   来源：`grep -rn "publish('" src/components` 提取，2026-08-17 核对。
 */
/** EVENTS 单条登记的形状（from / to = 「文件:行」字符串数组）。
 *  与 `STORAGE_KEYS: Record<string, StorageKeyMeta>` 同款——登记表须**显式定型**（提供上下文类型），
 *  否则 `from: []` 在 noImplicitAny 下推断为 `any[]`（TD-09-1 隐式 any 面）。
 *  ⚠️ 须用**前缀类型标注**而非 `satisfies`：`x satisfies T` 不用 T 做上下文推断，空数组仍会是 any[]。 */
export interface EventRegistryEntry {
  from: string[];
  to: string[];
  payload: string;
  note: string;
}

// 🔒 键名冻结（ADR-0038）：本表**键名**属对外契约，禁随手改名 —— 见文件头【键名冻结】段。
export const EVENTS: Record<string, EventRegistryEntry> = {
  'agent:task-completed': {
    from: ['taskCompletionBus.ts:30'],
    to: ['useNodeGeneration.ts:328', 'useScriptBoxEngine.ts', 'GeneratedView.tsx'],
    payload: '{ taskId, nodeId, resultUrl, type, status: "completed" }',
    note: '任务完成 → 精准回填节点（刷新不丢图）+ 刷新「生成」面板。现统一经 taskCompletionBus.publishTaskCompleted 唯一发布（P1-D）；done 已去落盘（P0-C），广播直接用持久 resultUrl。订阅者判据各不同：节点侧按 nodeId 等值（useNodeGeneration）；剧本盒资产图按伪 nodeId 前缀反解（useScriptBoxEngine，TD-01-9）；生成面板只关心「有新结果落 tasks」→ 全量刷新（GeneratedView，TD-12-10 同母体：结果就绪信号须被当前可见消费方收到）',
  },
  // 上游节点完成 → 直接下游可视需要自动触发（P2-G 安全网，AUTO_TRIGGER_DOWNSTREAM 默认关）
  'upstream:updated': {
    from: ['taskCompletionBus.ts:33'],
    to: ['upstreamLink.ts:36'],
    payload: '{ sourceNodeId }',
    note: '上游生成完成 → 直接下游（只接一层）自动触发（经 useUpstreamAutoTrigger；开关默认关，零行为改变）',
  },
  'presets-changed': {
    from: ['promptManager.ts:105'],
    to: ['PromptPresetView.tsx:61'],
    payload: '{ presets }',
    note: '提示词库跨节点同步。生产使用',
  },
  'agent:credit-gate': {
    from: ['useCanvasAgentTools.ts:1464', 'useCanvasAgentTools.ts:1550'],
    to: ['AgentPanel.tsx:577'],
    payload: '{ pending }',
    note: '高消耗积分确认门禁置位/清除广播（AgentPanel 刷新 credit 确认卡片）。经常量 CREDIT_GATE_EVENT 引用（P1-D）；check-events 已支持常量引用解析（TD-13-1），不再跳过',
  },
  // 素材发送成功事件（P1-D 收口：原 resourceStore 裸回调桥 → eventBus；resourceStore 保留薄封装 onResourceSent/emitResourceSent）
  'resource:sent': {
    from: ['resourceStore.ts:537'],
    to: ['resourceStore.ts:534'],
    payload: '{ folder }',
    note: '【TD-12-10 语义=「素材已落盘**且已归位到目标目录**，可用」】发送方 sendToResourceLibrary 在三段（落盘 → 归位 context-only 改行 folder → 广播）全部成功后才发（此前在发起处同步广播 → 面板 rescan 时后端还没有该文件/行 = 用户报障「点了却库里没有」）。订阅方：ResourceLibrary 经薄封装 onResourceSent 消费（该文件内无 subscribe 字面量，故本表 to 只列真实 subscribe 点），收到后切目录并重拉（同目录也重拉，见其 refreshSignal）。生产使用',
  },
  // 'resource:renamed' 已于 2026-09-12 删除：四态 url 改写广播随 context-only 改名已无订阅方（发布点亦被守卫为 no-op），
  // 改名/移动改由 contentId 模型处理，属「第二机制」死脚手架（见 docs/122）。
  // 'yimao:remove-edge' 已于 2026-09-11 删除（TD-04-8）：只有 App window 监听、全项目从无 dispatch
  // （CustomEdge 实际走 deleteElements→onDelete）。属「只有订阅、从无发布」的死事件，同 §多窗口 判定。
  'project:import': {
    from: ['ProjectSelector.tsx:117'],
    to: ['useCanvasEventSubscriptions.ts:66'],
    payload: '{}',
    note: '导入按钮 → App 处理文件（App.tsx:437 标准 subscribe 承接，已核对，D5）。生产使用',
  },
  'project:export': {
    from: ['ProjectSelector.tsx:121'],
    to: ['useCanvasEventSubscriptions.ts:67'],
    payload: '{}',
    note: '导出按钮 → useCanvasEventSubscriptions 下载。生产使用',
  },
  // 'persist:failed' 已于 2026-09-17 删除（TD-24-4 阶段 2 / TD-16-33）：持久化失败改由**各站点自己确认**
  // （`storageAdapter.sSet/sRemove` 返回 `PersistWriteOutcome` → `core/degrade.ts::confirmPersist`）。
  // 原全局总线（publish + usePersistFailureToast 节流 toast + persistFailureBus 工厂）三处盲区
  // （同 key 节流合并 / memFallback 不 publish / 绕开 adapter 的链路全漏）且违反「失败由产生层负责」，
  // 按用户裁定退役。消费者若再需要失败提示，回产生层补 `confirmPersist`，**禁止复活全局吸收层**。

  // 剪辑器播放头跳转（TD-22-23，2026-09-15）：原为 `window.dispatchEvent('playback-seek')` ——
  // eventBus 文件头明文禁止的「第二套广播」，videoEditor 搬迁时带进来的漏网（同族前例：TD-04-8 的
  // 'yimao:remove-edge'、已删的 'resource:renamed'）。现收口进唯一通道。
  'videoeditor:seek': {
    from: ['playback-manager.ts:209'],
    to: ['audio-manager.ts:31'],
    payload: '{ time }',
    note: '播放头跳转（拖拽 / 快捷键 / 帧步进 / 播到末尾）→ 音频侧按新位置重排。★不要往里塞每帧的 currentTime / isPlaying / volume —— 那些是**状态**，走 editor.playback.subscribe()（useSyncExternalStore）；本通道只承载**离散动作**（详见 playback-manager.ts::notifySeek 注释）',
  },
};

/**
 * 存储键登记区（持久化层单一事实来源）。
 *
 * 每条记录：
 *   key      = 存储键名（storageAdapter.sGet/sSet 调用时的 key，不含 yimao: 前缀）
 *   domain   = 所属领域（project/task/asset/settings/agent/etc.）
 *   store    = 所属 store/文件
 *   backend  = 存储后端
 *     'local'  → localStorage/Chrome storage（storageAdapter 自动路由）
 *     'kv'     → localTool KV（/api/kv/*，canvas-state-v1- 前缀）
 *     'native' → 原生 localStorage 直写（不经 storageAdapter）
 *   pattern  = 是否是动态键模板（如含 {agentKey} 占位符）
 *   dynamic  = 是否运行时动态生成
 *   note     = 用途/说明
 *
 * 使用规则：
 *   1. 新增存储键 → 先在此登记，禁止散落字符串字面量
 *   2. 改键名 → 全量 grep 同步所有引用，更新本条
 *   3. 删键 → 先确认无引用再删除本条
 *   4. 迁移键 → 添加 migration 字段记录迁移历史
 *
 * 来源：`grep -rn "sGet\|sSet\|sRemove\|storageGet\|storageSet\|storageDelete" src/components` 提取，2026-08-17 核对。
 */
/**
 * 画布快照 KV 键前缀（P0-1 收口单一来源）。
 * kvStore.js 运行时前缀与下方登记表模板统一引用本常量，消除双写 'canvas-state-v1-'。
 */
export const CANVAS_STATE_PREFIX = 'canvas-state-v1-';

/**
 * 画布快照 schema 版本号（P0-4 跨端对齐）。
 * 写入 saveCanvasState 快照的 schemaVersion 字段；读取端按版本做兼容（旧结构缺字段默认补齐）。
 * 变更快照结构（新增/重命名字段影响旧数据可恢复性）时 → 提升本版本号并补迁移，不宜原地覆盖旧结构。
 */
import { KV_TIMEOUT } from './config.ts';

export const CANVAS_SCHEMA_VERSION = 1;

/** STORAGE_KEYS 单条登记的元信息形状（存储键登记表唯一类型）。 */
export interface StorageKeyMeta {
  domain: string;
  /** 产出该键的源码文件（尽量不带扩展名，扩展名无关） */
  store: string;
  /** 后端通道：local（localStorage）/ kv（localTool KV） */
  backend: 'local' | 'kv' | 'native';
  /** 是否为动态键模板（含 {xxx} 占位，运行时按实际 id 展开） */
  pattern?: boolean;
  /** 旧键迁移映射：`旧键模板 → 新键模板`，存在时表示该键曾由旧键迁移而来 */
  migration?: string;
  /** KV 键专用：KV 成功后是否保留本地降级副本（双通道镜像）。默认 false = 成功后清副本（避免旧副本"复活"覆盖新值）；true = 保留（如 d3d 工程双通道形态，TD-7 方案A 收编 contentStore） */
  fallback?: boolean;
  /** KV 键专用：本次 KV 读写的独立超时（ms）。缺省 = 走全局默认（contentStore 当前非 per-key）。d3d 等需快失败降级的场景置为 KV_TIMEOUT */
  timeout?: number;
  /**
   * **云同步**：是否进云端（TD-13-9 收口 · 2026-09-16 用户裁定）。
   *
   * 【为什么是本表字段，而不是 cloudSync 里的白名单清单】「要不要同步」= 这个键的**固有属性**，
   * 与 `backend` / `fallback` / `timeout` 同类，住在键自己的登记里才对。此前它住在
   * `cloudSync.ts` 的 `SYNC_ALLOW` 集合里 ⇒ **同一件事两处维护**（M3 第二份）：加一个需同步的键
   * 要改 2 个文件，且"清单型判据必漏"（本仓规则 2/4/10/12 已四次从清单改回反向判据）。
   * 收口后：cloudSync 只**派生**（`getSyncKeys()`），不再认识任何一个具体键名。
   *
   * 【判据（红线）】**缺省 = 不参与云同步**（`undefined` → false，与 2026-09-16 翻转后的
   * 「默认拒绝」语义一致）。**绝不可改成"默认同步 + 显式排除"** —— 那会把工程数据/UI 偏好
   * 静默送上云（造第二真相源）。要同步的键必须**显式**写 `sync: true`。
   */
  sync?: boolean;
  /**
   * **面向用户的可读名**：云同步冲突清单要让人看懂「到底动了什么」（直接甩 `yimao_preset_prompts` 等于没说）。
   * 与 `sync` 同批下沉（TD-13-9）：原为 `cloudSync.ts` 的 `SYNC_LABELS` 清单——同一份"键的属性"被抄成第二处。
   * 缺省时由 `getKeyLabel()` 回退键名本身（宁可显示原始 key，也绝不静默省略条目）。
   */
  label?: string;
  note: string;
}

/**
 * 视频剪辑器工程 KV 键前缀（G2 收口，模板照 `CANVAS_STATE_PREFIX` / `agentKeys.ts`）。
 *
 * 为什么抽常量：写者 `videoEditorKeys.ts`（键构造唯一真源）必须拼 `…-<projectId>` /
 * `…-<projectId>_<editorId>`，若在那里手写 `'video_editor_'` 字面量，就等于**同一键名两份**
 * （登记表与写者），改键时必漏一处。抽成常量后：登记表与写者同源（docs/133 §2.2）。
 *
 * 三前缀对应三类键：列表（轻）/ 活跃 id / 单工程本体（重）。禁任何模块再拼 `video_editor_` 字面量。
 */
export const VIDEO_EDITOR_PROJECTS_PREFIX = 'video_editor_projects_';
export const VIDEO_EDITOR_ACTIVE_PREFIX = 'video_editor_active_project_';
export const VIDEO_EDITOR_PROJECT_PREFIX = 'video_editor_project_';
/**
 * 剪辑素材**元数据表**前缀（TD-02-35 · 2026-09-16 载体收口）。
 * 值 = `{ [assetId]: MediaAssetData }`（整表一键，与工程本体同粒度）；素材**二进制**在 localTool `/files/`。
 * 收口理由（架构最优形态）：剪辑器原先四类数据散在四种载体（KV / IndexedDB / OPFS / localStorage），
 * 素材元数据独留 IndexedDB ⇒ 不进备份、不跨端、与工程本体不同生命周期。现统一走 KV。
 */
export const VIDEO_EDITOR_MEDIA_META_PREFIX = 'video_editor_media_meta_';

/**
 * 固定存储键的**可 import 命名常量**（TD-13-4 收口 · 母体 M7「SSOT 第二份」）。
 *
 * 【为什么必须导出命名 const，而不是让各模块本地复刻】`STORAGE_KEYS` 登记表自述为「持久化层
 * 单一事实来源」，但拥有这些键的 store 模块此前各自又声明一份本地 `const STORAGE_KEY = '...'`
 * —— 同一键名**两份维护**（登记表 + 模块本地），且模块那份被真实读写。一旦改名只改一处，
 * 该键在 `getLocalKeys()` 生成的**备份 / 云同步清单**里即漂移 → 漏备 / 误还原（数据完整性风险）。
 * ⇒ 正解 = 登记表导出命名 const，模块 `import` 引用，键名全仓唯一定义。
 * （模板照 `CANVAS_STATE_PREFIX` / `VIDEO_EDITOR_*_PREFIX` / `agentKeys.AGENT_KEY_PREFIX`。）
 */
export const KEY_YIMAO_ASSET_LIBRARY = 'yimao_asset_library';
export const KEY_YIMAO_PRESET_RECENT = 'yimao_preset_recent';
export const KEY_YIMAO_ACCOUNTS = 'yimao_accounts';
export const KEY_YIMAO_PRESET_PROMPTS = 'yimao_preset_prompts';
export const KEY_YIMAO_PROMPT_HUB_CACHE = 'yimao_prompt_hub_cache';
export const KEY_YIMAO_NODE_PREFS = 'yimao_node_prefs';
export const KEY_YIMAO_CLOUD_SYNC_LEDGER = 'yimao_cloud_sync_ledger';

/**
 * M7 裸写收口命名常量（2026-09-16 · TD-02-33/36/37/40）。
 *
 * 【为什么要这几个 const】这批键原先**根本不在本表**：各自模块用**裸 `localStorage` 字面量**直写
 * （无 `yimao:` 前缀、不经 contentStore）→ 同一键名在「模块本地字面量 + 本表缺登记」间分裂，
 * `getLocalKeys()` 派生的**备份/云同步清单恒漏收**（换机即丢用户数据）。
 * 收口动作 = ① 本表登记（backend:'local'）+ 导出命名 const；② 模块 `import` 引用（消第二份，照 TD-13-4）；
 * ③ 真实写路径一律委托 contentStore。
 *
 * ⚠️ **物理键随之改变**：`<裸键>` → `yimao:<键名>`（storageAdapter 统一加前缀）→
 * 各写者内含**一次性迁移读**（命中旧裸键 → 回填新键 + 删旧键，幂等；见各自模块注释）。
 * 注：**不给它们填 `migration` 字段** —— `getLocalKeys()` 会过滤掉带 `migration` 的项（那是"仅迁移读、不再写"的
 * 旧键语义），填了反而进不了备份清单。
 */
export const KEY_DIRECTOR3D_CUSTOM_POSES = 'director3d-custom-poses';
export const KEY_EDITOR_CAPTION_LANGUAGE = 'editor-caption-language';
export const KEY_EDITOR_CAPTION_MODEL_ID = 'editor-caption-model-id';
export const KEY_EDITOR_CAPTION_TEMPLATE_ID = 'editor-caption-template-id';
export const KEY_VIDEO_EDITOR_SAVED_SOUNDS = 'video-editor-saved-sounds';

/**
 * 固定存储键的命名常量（第二批 · TD-13-7 收口 · 2026-09-16）。
 *
 * 【为什么是第二批】TD-13-4 只导出了 7 把 `yimao_*` + M7 裸写键，剩下这一批**登记了却没导出
 * 命名 const** → 各消费层只能自己再声明一份同名字面量（`agent_skills` 等 9 键）：
 *  · store 层：`skillStore.ts` SKILLS/USAGE/ENABLED_KEY · `agentModelStore.ts`
 *    AGENT_CHAT_MODEL/HISTORY_TURNS_KEY · `scriptBoxPlaybookStore.ts` PLAYBOOKS_KEY
 *  · 消费层：`VideoExtractNode.tsx` MULTIWINDOW_CLIPBOARD_KEY · `tableWorkspaceState.ts`
 *    WIDTH_KEY · `AgentPanel.tsx` PANEL_WIDTH_KEY
 *  · 裸字面量：`providerStore.ts:466` `contentSetAsync('active_api_endpoint', …)` ·
 *    `cloudSync.ts` 两组清单（SYNC_ALLOW / SYNC_LABELS）里逐字重复键名
 * ⇒ 同一键名**两份维护**，`getLocalKeys()` 派生的备份/云同步清单会漂移（漏备 / 误还原）。
 * 注：上述 cloudSync 两组清单已于 **TD-13-9（2026-09-16）整体删除**（改由本表 `sync` / `label` 字段派生）。
 *
 * 【收口口径（与 TD-13-4 一致）】键名全仓唯一定义 = 本表；消费方 `import` 引用。
 * 【更新（2026-09-16 · TD-13-9 收口）】上文原写「唯一例外：cloudSync 的 SYNC_ALLOW / SYNC_LABELS
 * 是独立关注点，故保留自身的清单结构」—— **该判断已被推翻**：'要不要同步' 与 '怎么显示'
 * 都是**键的固有属性**（与 `backend`/`fallback`/`timeout` 同类），把键名抄进消费者清单
 * 就是标准的 M3 第二份（加一个需同步的键要改 2 个文件，清单型判据必漏）。
 * 现两者均已下沉为登记表字段（`sync` / `label`），cloudSync 只派生（`getSyncKeys()` / `getKeyLabel()`），
 * **不再认识任何一个具体键名** —— 故本项目内已无「键名清单例外」。
 */
export const KEY_SCRIPTBOX_PLAYBOOKS = 'scriptbox_playbooks';
export const KEY_ACTIVE_API_ENDPOINT = 'active_api_endpoint';
export const KEY_AGENT_CHAT_MODEL = 'agent_chat_model';
export const KEY_AGENT_HISTORY_TURNS = 'agent_history_turns';
export const KEY_AGENT_SKILLS = 'agent_skills';
export const KEY_AGENT_SKILL_USAGE = 'agent_skill_usage';
export const KEY_AGENT_SKILL_ENABLED = 'agent_skill_enabled';
export const KEY_AGENT_PANEL_WIDTH = 'agent_panel_width';
export const KEY_AGENT_SPLIT_WIDTH = 'agent_split_width';
export const KEY_MULTIWINDOW_CLIPBOARD = 'mutiwindow-clipboard';
export const KEY_CANVAS_AGENT_GEN_PARAMS = 'canvasAgentGenParams';
/**
 * 3D 导演台工程键**前缀**（含默认键本身）· TD-13-6 收口：原在 project.ts / d3dPersistence.ts 两份裸写。
 *
 * ⚠️ **不带尾横线**，这是**既有行为契约**（`d3dPersistence.test.ts` 锁住
 * `isProjectPersistenceKey('director3d-project') === true`）：默认键 `director3d-project` **本身也算工程键**，
 * 动态键 `director3d-project-{nodeId}` 亦以它为前缀。收口时必须保持这个**宽前缀**语义——
 * 若误写成 `'director3d-project-'`（带横线），默认键会被判为非工程键（既有测试当场红）。
 */
export const DIRECTOR3D_PROJECT_PREFIX = 'director3d-project';
/** 3D 导演台工程默认键（无 nodeId 独立运行场景）= 前缀本身 */
export const KEY_DIRECTOR3D_PROJECT = DIRECTOR3D_PROJECT_PREFIX;

// 🔒 键名冻结（ADR-0038）：本表**键名**属对外契约，禁随手改名 —— 见文件头【键名冻结】段。
export const STORAGE_KEYS: Record<string, StorageKeyMeta> = {
  // ── 项目（projectStore）────────────────────────────────────────────
  projects: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'local',
    note: '项目列表 [{id, name}]。双写：localStorage + localTool /api/projects',
  },
  lastOpenedProject: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'local',
    note: '上次打开项目 id。刷新后自动恢复该项目',
  },
  [`${CANVAS_STATE_PREFIX}{projectId}`]: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'kv',
    pattern: true,
    note: '画布快照：{ nodes, edges, viewport }。跨端共享，走 localTool KV（P20 新增 viewport 视窗缩放/平移）',
  },
  [`${CANVAS_STATE_PREFIX}{projectId}_version`]: {
    domain: 'project',
    store: 'projectStore.js',
    backend: 'kv',
    pattern: true,
    note: '画布快照版本号（单调递增，防旧数据覆盖新数据）',
  },

  // ── 应用设置（appSettings）─────────────────────────────────────────
  app_settings: {
    domain: 'settings',
    store: 'appSettings.ts',
    backend: 'local',
    // 混合桶：含 thumbnailOn/minimapOn/agentOpen/pinnedTools 等 UI 开关 → 整键留本机（2026-09-16 裁定）
    label: '应用设置',
    note: '应用设置：{ thumbnailOn, minimapOn, agentOpen, performanceMode, debugOn, pinnedTools, autoSyncEnabled }——整键随云端同步（手工 note，改动 settingRegistry 须同步，防漂移）。注：videoEditorOpen 已于 2026-09-15 **迁出**（它是界面开合的会话态，不该持久化/sync → base/core/editorSession.ts）',
  },
  [KEY_SCRIPTBOX_PLAYBOOKS]: {
    domain: 'settings',
    store: 'scriptBoxPlaybookStore.ts',
    backend: 'local',
    sync: true,
    label: '剧本盒子 Playbook',
    note: '剧本盒子自定义 Playbook 列表 { id: playbook }。整键随云同步+备份（内置走代码常量，不在此）',
  },

  // ── 供应商配置（providerStore）─────────────────────────────────────
  [KEY_ACTIVE_API_ENDPOINT]: {
    domain: 'settings',
    store: 'settings/providerStore.js',
    backend: 'kv',
    note: '当前生效的主供应商 endpoint（跨端读取，写入 localTool KV）',
  },

  // ── AI 聊天模型（agentModelStore）──────────────────────────────────
  [KEY_AGENT_CHAT_MODEL]: {
    domain: 'agent',
    store: 'agentModelStore.js',
    backend: 'local',
    sync: true,
    label: 'AI 聊天模型配置',
    note: 'AI 聊天模型配置：{ providerId, modelId, streamMode }',
  },
  [KEY_AGENT_HISTORY_TURNS]: {
    domain: 'agent',
    store: 'agentModelStore.js',
    backend: 'local',
    sync: true,
    label: 'AI 历史回传轮数',
    note: 'AI 助手历史回传轮数（默认 6，非负整数）',
  },

  // ── Skill（skillStore）─────────────────────────────────────────────
  [KEY_AGENT_SKILLS]: {
    domain: 'agent',
    store: 'skillStore.ts',
    backend: 'local',
    sync: true,
    label: '自定义 Skill',
    note: '用户自定义 Skill 列表 [{id, name, description, content}]',
  },
  [KEY_AGENT_SKILL_USAGE]: {
    domain: 'agent',
    store: 'skillStore.ts',
    backend: 'local',
    label: 'Skill 使用统计',
    note: 'Skill 使用次数统计：{ [skillId]: count }',
  },
  [KEY_AGENT_SKILL_ENABLED]: {
    domain: 'agent',
    store: 'skillStore.ts',
    backend: 'local',
    sync: true,
    label: 'Skill 启用状态',
    note: 'Skill 启用状态：{ [skillId]: boolean }。默认启用',
  },

  // ── 提示词预设（promptManager）─────────────────────────────────────
  [KEY_YIMAO_PRESET_PROMPTS]: {
    domain: 'preset',
    store: 'promptManager.js',
    backend: 'local',
    sync: true,
    label: '提示词预设',
    note: '提示词预设列表 [{id, title, type, prompt, enabled}]',
  },
  [KEY_YIMAO_PRESET_RECENT]: {
    domain: 'preset',
    store: 'promptManager.js',
    backend: 'local',
    label: '最近使用预设',
    note: '最近使用预设 id 列表（上限 50）',
  },

  // ── 素材库（resourceStore）────────────────────────────────────────────
  [KEY_YIMAO_ASSET_LIBRARY]: {
    domain: 'resource',
    store: 'resourceStore.ts',
    backend: 'local',
    note: '素材库列表 [{id, folder, type, url, name, size, ts}]',
  },

  // ── 提示词社区库（promptHubStore.js，联网 GitHub 源，非本地预设）──
  // 注意：与 promptManager.js 的 yimao_preset_prompts（我的预设）是两回事。
  [KEY_YIMAO_PROMPT_HUB_CACHE]: {
    domain: 'prompthub',
    store: 'promptHubStore.js',
    backend: 'local',
    label: '提示词社区库缓存',
    note: '提示词社区库各源拉取缓存 { [sourceId]: { items, fetchedAt, signature, lastError } }',
  },

  // ── 节点偏好（nodePrefs）───────────────────────────────────────────
  [KEY_YIMAO_NODE_PREFS]: {
    domain: 'pref',
    store: 'nodePrefs.js',
    backend: 'local',
    label: '节点参数记忆',
    note: '节点「上次参数」记忆：{ [nodeType]: { ...lastParams } }',
  },

  // ── 账号环境（accountsStore）───────────────────────────────────────
  [KEY_YIMAO_ACCOUNTS]: {
    domain: 'account',
    store: 'accountsStore.js',
    backend: 'kv',
    label: '多开账号环境',
    note: '多开账号环境列表 [{id, name, siteName, siteUrl, avatar, cookies}]。走 localTool KV 磁盘持久化（对齐官方 users，关插件/跨设备不丢），仍进云同步',
  },

  // ── AI 会话（conversationStore）────────────────────────────────────
  'agent_conversations_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'kv',
    pattern: true,
    note: 'AI 会话列表（按 agentKey 隔离，如 canvas-assistant-{projectId}），存 localTool KV',
  },
  'agent_active_conversation_id_{agentKey}': {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'kv',
    pattern: true,
    note: '当前活跃会话 id（按 agentKey 隔离），存 localTool KV',
  },
  'agent_project_memory_v1_{agentKey}': {
    domain: 'agent',
    store: 'agent/runtime/projectMemoryStore.js',
    backend: 'local',
    pattern: true,
    note: '项目长期记忆（用户确认后写入，agentKey 全局共用，单 agentKey 上限 60 条）',
  },
  agent_conversations: {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    migration: 'agent_conversations_{agentKey}',
    note: '旧全局会话键（迁移用，仅读不写，改造后不再使用）',
  },
  agent_active_conversation_id: {
    domain: 'agent',
    store: 'conversationStore.js',
    backend: 'local',
    migration: 'agent_active_conversation_id_{agentKey}',
    note: '旧全局会话 id 键（迁移用，仅读不写，改造后不再使用）',
  },

  // ── AI 面板（AgentPanel.jsx）───────────────────────────────────────
  [KEY_AGENT_PANEL_WIDTH]: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    label: 'AI 面板宽度',
    note: 'AI 助手面板宽度（px）',
  },
  [KEY_AGENT_SPLIT_WIDTH]: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    note: 'AI 助手表格模式左右分栏：左栏宽（px）。表格工作区左表格 | 分隔条 | 右对话',
  },
  agent_input_mode: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    label: 'AI 输入模式',
    note: 'AI 助手输入模式兼容字段（2026-09-05 精简后不再产出；agent_input_mode 登记保留，仅历史读兼容）',
  },
  [CREDIT_SWITCH_KEY]: {
    domain: 'agent',
    store: 'AgentPanel.jsx',
    backend: 'local',
    sync: true,
    note: '高消耗积分确认开关：任何模式真生成图/视频前是否先确认（默认 true = 开/安全）',
  },

  // ── AI 历史迁移（useAgentChat.ts）──────────────────────────────────
  'agent_history_{agentKey}': {
    domain: 'agent',
    store: 'useAgentChat.ts',
    backend: 'local',
    pattern: true,
    note: '旧单会话历史（仅首次迁移用，从旧格式迁移到多对话体系后不再写入）',
  },

  // ── AI 生图参数（useCanvasAgentTools.ts）───────────────────────────
  [KEY_CANVAS_AGENT_GEN_PARAMS]: {
    domain: 'agent',
    store: 'useCanvasAgentTools.ts',
    backend: 'local',
    note: 'AI 生图默认参数：{ model, ratio, resolution }',
  },

  // ── 多窗口剪贴板（VideoExtractNode.jsx）────────────────────────────
  [KEY_MULTIWINDOW_CLIPBOARD]: {
    domain: 'clipboard',
    store: 'VideoExtractNode.jsx',
    backend: 'local',
    note: '多窗口剪贴板数据（跨窗口同步用）',
  },

  // ── 云同步台账（cloudSync.ts）─────────────────────────────────
  // 本机同步基线：{ rev, syncedAt, localHash }——记住「上次同步到云端哪一版 + 当时本地数据指纹」，
  // 供上传/下载前判断「云端是不是比我新」「本地改没改过」（防覆盖保护的唯一依据）。
  // ⚠️ 绝不能进云端：每台机器基线不同，同步它会互相污染判断 → 已由 cloudSync.ts 的
  //    SYNC_EXCLUDE 显式排除（domain 标 sync 只为归类，不依赖 SYNC_DOMAIN_SWITCHES）。
  // 进备份是自洽的：备份恢复时台账随数据一并还原，不会误报冲突。
  [KEY_YIMAO_CLOUD_SYNC_LEDGER]: {
    domain: 'sync',
    store: 'cloudSync.ts',
    backend: 'local',
    note: '云同步台账 { rev, syncedAt, localHash }：上次同步的云端修订号 + 本地数据指纹（本机基线，不同步到云端）',
  },

  // ── 3D 导演台工程（director3d）【P2-F2 登记修正】───────────
  // 注：director3d 工程经 base/d3dPersistence 收口——主通道写 localTool KV（/api/kv/set），
  // 18080 不可达才降级直写 localStorage。故 backend 标 kv（配下方动态 pattern），与实测一致；
  // 别再标 native（旧"native 空洞语义"，见 contentStore.getBackend 启发式兜底问题）。
  [KEY_DIRECTOR3D_PROJECT]: {
    domain: 'director3d',
    store: 'd3dPersistence.ts',
    backend: 'kv',
    fallback: true, // TD-7 方案A：双通道镜像，KV 成功后保留本地降级副本
    timeout: KV_TIMEOUT, // 独立超时，KV 不可达快失败降级（不挂起编辑）
    note: '3D 导演台工程默认 key（独立运行时）→ KV 主通道 + localStorage 降级副本（双通道，TD-7 方案A 收编 contentStore）',
  },
  // TD-07-7：旧键（stageframe 期命名），仅迁移读 + 读后删，不再写。登记以消除「裸 localStorage 闸扫不到」盲区。
  'stageframe-project': {
    domain: 'director3d',
    store: 'director3d/project.ts',
    backend: 'local',
    migration: KEY_DIRECTOR3D_PROJECT,
    note: '3D 导演台旧工程键（stageframe 期）→ 迁移读入 director3d-project 后删除，仅读不写',
  },
  [`${DIRECTOR3D_PROJECT_PREFIX}-{nodeId}`]: {
    domain: 'director3d',
    store: 'd3dPersistence.ts',
    backend: 'kv',
    pattern: true,
    fallback: true, // TD-7 方案A：双通道镜像
    timeout: KV_TIMEOUT, // 独立超时
    note: '3D 导演台工程（画布节点实例）动态键 → KV 主通道 + localStorage 降级副本（双通道，TD-7 方案A）',
  },
  [KEY_DIRECTOR3D_CUSTOM_POSES]: {
    domain: 'director3d',
    store: 'director3d/storage.ts',
    // 【2026-09-16 M7 收口 · 原为 backend:'native'】native 与 local 在 contentStore 内**共用同一条
    // 本地落地路径**（resolveBackend 非 kv → sSet），故改标 local 不改物理行为，只改**治理语义**：
    // getLocalKeys() 只收 backend==='local' → 标 native 时该键恒不进备份清单（这才是"登记项形同虚设"的真因，
    // 不是"缺 backend 字段"——原债描述此处有误，见 02 区 2026-09-16 轮次日志）。
    backend: 'local',
    note: '3D 导演台自定义姿势库（**用户资产**，非工程本体）→ 经 contentStore 写 localStorage；进 getLocalKeys 备份清单。原写者 director3d/storage.ts 裸 localStorage 直写（TD-02-36/38/39）',
  },
  // 注：故 hideFromViewportCapture 曾登记为 native（2026-08-22 移除）——它实为 3D object.userData
  // 属性（SceneRoot.tsx / DirectorCanvas.tsx），并非存储键，登记纯属误导。此键不影响存储读写。

  // ── 视频剪辑器工程（videoEditor）【docs/133 §2.2 / §2.3 收口】──────────
  // 三键全部 kv（localTool KV 严格族 CAS，docs/133 §3.5 D-4），禁静默覆盖。
  // 键构造唯一真源 = base/core/videoEditorKeys.ts（禁手拼 video_editor_ 字面量，见 T2 验收）。
  // 不复用 director3d-project-{nodeId}：对象（tracks 时间轴 ≠ 3D 场景）与写族（严格族 vs director3d 双通道）均不同。
  [`${VIDEO_EDITOR_PROJECTS_PREFIX}{projectId}`]: {
    domain: 'videoEditor',
    store: 'videoEditor/engine/services/storage/service.ts',
    backend: 'kv',
    pattern: true, // 动态键模板：按画布 projectId 隔离（一个画布项目 = 多个剪辑工程）
    note: '剪辑工程**列表**（轻）：[{id, name, createdAt, updatedAt}]。切换器读取；保存单工程时同步更新其 updatedAt。与单工程本体分键（docs/133 §2.3 体积修正：保存 02 不触碰 01/03）',
  },
  [`${VIDEO_EDITOR_ACTIVE_PREFIX}{projectId}`]: {
    domain: 'videoEditor',
    store: 'videoEditor/engine/services/storage/service.ts',
    backend: 'kv',
    pattern: true, // 动态键模板：按画布 projectId 隔离
    note: '当前活跃剪辑工程 editorId（UUID，docs/133 §2.1 M-4）。刷新后恢复（不变式 I-3 配合 EditorShell key={editorId}）',
  },
  [`${VIDEO_EDITOR_PROJECT_PREFIX}{projectId}_{editorId}`]: {
    domain: 'videoEditor',
    store: 'videoEditor/engine/services/storage/service.ts',
    backend: 'kv',
    pattern: true, // 动态键模板：双占位（画布 projectId + 工程 editorId）
    note: '**单个剪辑工程本体**（重）：完整 TProject（docs/133 §一.1，禁镜像）。严格族 CAS 独写；409 由 UI 显式消费（D-4 禁静默重试）',
  },
  [`${VIDEO_EDITOR_MEDIA_META_PREFIX}{projectId}`]: {
    domain: 'videoEditor',
    store: 'videoEditor/engine/services/storage/service.ts',
    backend: 'kv',
    pattern: true, // 动态键模板：按画布 projectId 隔离
    note: '**剪辑素材元数据表**（`{ [assetId]: MediaAssetData }`，整表一键）：原存浏览器 IndexedDB（不进备份/不跨端/与工程本体不同生命周期），2026-09-16 收口到 KV（TD-02-35）。素材二进制仍在 localTool /files/，本键只存元数据（url/name/type/size/duration）',
  },

  // ── 剪辑器本地偏好 / 用户资产（2026-09-16 M7 裸写收口：TD-02-33/37/40）──────
  // 载体判据（本轮确立，两分法）：**工程本体**（大、按 projectId 隔离、需跨端）→ `backend:'kv'`（上方三键）；
  //   **跨项目的小型用户资产 / 偏好** → `backend:'local'`（登记即自动进 getLocalKeys 备份清单）。
  //   —— 该判据回答的是「数据该放哪」，与「备份收不收得到」是**两条正交的问题**。
  //   更新(2026-09-16 · TD-02-30 已结清)：原句此处写的理由是「KV 的 pattern 动态键当前进不了备份，
  //   迁 KV 反而修不成症状」——该理由**已被 TD-02-30 修复推翻**：backupStore 现有 `kv` 段，
  //   按本表模板派生收录**全部** KV 键（含 pattern 动态键）。结论不变（这三者按两分法本就该 local），
  //   但**以后判载体请只用两分法**，不要再拿"备份收不收得到"当理由（那已不是约束）。
  //   云同步不受影响：cloudSync 仍按登记表 `sync` 字段**默认拒绝**（用户 2026-09-16 裁定）。
  [KEY_EDITOR_CAPTION_LANGUAGE]: {
    domain: 'videoEditor',
    store: 'videoEditor/hooks-cutia/storage/use-local-storage.ts',
    backend: 'local',
    note: '字幕识别语言偏好（原 cutia 裸 localStorage 键 editor-caption-language，未登记；TD-02-33/37）',
  },
  [KEY_EDITOR_CAPTION_MODEL_ID]: {
    domain: 'videoEditor',
    store: 'videoEditor/hooks-cutia/storage/use-local-storage.ts',
    backend: 'local',
    note: '字幕识别模型偏好（原 cutia 裸 localStorage 键 editor-caption-model-id，未登记；TD-02-33/37）',
  },
  [KEY_EDITOR_CAPTION_TEMPLATE_ID]: {
    domain: 'videoEditor',
    store: 'videoEditor/hooks-cutia/storage/use-local-storage.ts',
    backend: 'local',
    note: '字幕模板偏好（原 cutia 裸 localStorage 键 editor-caption-template-id，未登记；TD-02-33/37）',
  },
  [KEY_VIDEO_EDITOR_SAVED_SOUNDS]: {
    domain: 'videoEditor',
    store: 'videoEditor/engine/services/storage/service.ts',
    backend: 'local',
    note: '用户收藏音效清单 { sounds[], lastModified }（原仅存 IndexedDB `video-editor-saved-sounds`，不进备份；TD-02-34/40）。键名沿用旧 IndexedDB 库名，便于迁移对照',
  },

  // ── 备份 / 云同步范围（backupStore.ts / cloudSync.ts）──────────────
  // 两条范围**均已从本表派生**，禁止再在任何消费者里手写清单（防漂移漏备 / 误把工程数据送上云）：
  //   · 备份 = `getLocalKeys()`（**全量**，登记即进）；
  //   · 云同步 = `getSyncKeys()`（= 全量 ∩ **本表显式 `sync: true`**，缺省**不进云**）。
  // 判据演进：SYNC_EXCLUDE 黑名单（新增键默认进云，危险）→ SYNC_ALLOW 白名单（默认拒绝，
  //   但清单抄在 cloudSync 里 = M3 第二份）→ **本表 `sync` 字段**（唯一真源，cloudSync 零键名）。
};

/** 获取所有 localStorage 后端键列表（不含动态键模板、不含已迁移旧键） */
export function getLocalKeys() {
  return Object.entries(STORAGE_KEYS)
    .filter(([, v]) => v.backend === 'local' && !v.migration && !v.pattern)
    .map(([k]) => k);
}

/**
 * 参与**云同步**的 localStorage 键 = `getLocalKeys()` 中**显式声明 `sync: true`** 者。
 *
 * 【为什么是派生而非清单（TD-13-9 收口 · 2026-09-16）】此前 `cloudSync.ts` 自持 `SYNC_ALLOW`
 * 白名单集合 → 同一件事（"这个键进不进云"）在 contracts 与 cloudSync **两处维护**，
 * 加一个需同步的键要改 2 个文件；且清单型判据必漏（本仓已把规则 2/4/10/12 全部改回反向判据）。
 * 现判据 = 从本表**派生**：`cloudSync` 不再认识任何一个具体键名。
 *
 * ⚠️ **缺省 = 不同步**（`sync` 未写 → 不收）。**这是红线**：反向（默认同步）会把工程数据/UI 偏好
 * 静默送上云。新增键若需同步 → 在本表显式写 `sync: true`（只改一行，0 个其他文件）。
 */
export function getSyncKeys() {
  return getLocalKeys().filter((k) => STORAGE_KEYS[k]?.sync === true);
}

/**
 * **非存储键**的云同步条目显示名（键的属性不在 STORAGE_KEYS 里的那部分）。
 *
 * 【为什么需要这张极小的表】云同步范围里有两个条目**不是** `STORAGE_KEYS` 的键：
 *   · `providers` —— API 供应商配置，走 localTool `/api/providers`（独立真通道，与 localStorage 无关）。
 * `accounts` 不在此表：它只是 `KEY_YIMAO_ACCOUNTS` 的**短名**，调用点已改传真键（label 在登记表内）。
 * 故本表的唯一成员是 `providers` —— 它是**真的不存在存储键**的同步条目，需要自己的名字。
 * 这**不是**第二份清单：`sync`/`label` 的判据仍在登记表，本表只承接"不在登记表内的条目"。
 */
const NON_STORAGE_SYNC_LABELS: Record<string, string> = {
  providers: 'API 供应商配置',
};

/**
 * 同步条目 → **面向用户的可读名**（存储键查登记表 `label`；非存储条目查上面的极小表）。
 * 缺省回退键名本身 —— 宁可显示原始 key，也绝不静默省略条目（漏报比难看危险）。
 * 判据真源 = 本表 `label` 字段（TD-13-9：原为 cloudSync 的 `SYNC_LABELS` 第二份清单）。
 */
export function getKeyLabel(key: string): string {
  return STORAGE_KEYS[key]?.label ?? NON_STORAGE_SYNC_LABELS[key] ?? key;
}

/**
 * 获取所有 KV 后端键模板列表（固定键 + `{占位}` 动态模板）。
 * 【谁在用（2026-09-16 · TD-02-30 起）】`backupStore.exportAll` 的 `kv` 段收录判据 =
 *   「后端实际存在的键」∩「本表模板」⇒ **新工程域只要在本表登记就自动进备份**（0 行接入，
 *   不必再给每个域手写收集逻辑——那正是 M3「手写清单必漂移」母体）。
 * 注：`<key>_version`（CAS 元数据）也在本表，但后端 `/api/kv/keys` **默认已过滤**它；
 *   消费方无需（也不该）自己写这个后缀判断（那是第二份协议知识）。
 */
export function getKvKeyPatterns() {
  return Object.entries(STORAGE_KEYS)
    .filter(([, v]) => v.backend === 'kv')
    .map(([k]) => k);
}

/**
 * 错误类型登记区（错误分类与文案的单一事实来源，实现见 genErrors.ts classifyError）。
 * ⚠️ 新增错误：先登记 type 与其文案，禁止各节点自写 if(/网络错误/) 判断。
 *
 * 【为什么不登记 retryable（TD-16-16 · 2026-09-16）】本表曾带 `retryable` 字段，
 * 但全库**零读者** —— 唯一被消费的是 `label`（见 genErrors.ts timeoutMessage）。
 * 「能否自动重试」的真决策点在 `api/httpClient.ts:261`（判据＝NetworkError／TimeoutError／
 * fetch 网络型 TypeError；HttpError 一律不重试，属**主动设计**「业务失败不重试·防封号」）。
 * 原先「retryable 供『再来一次』入口决策」的设想（docs/27 §四）**从未接线**，故删字段去误导。
 */
export const GEN_ERRORS = {
  abort: { label: '已取消' },
  timeout: { label: '请求超时' },
  network: { label: '网络错误' },
  http: { label: '服务错误' },
  business: { label: '上游业务错误' },
};

/**
 * 节点类型登记区（节点「上次参数」记忆 / 节点创建 的单一事实来源）。
 *
 * ⚠️ 新增节点：先在 nodePrefs 的 useNodePrefs(首参) 里用的类型名在此登记；
 *   禁止散落裸字符串当 useNodePrefs 命名空间（拼错跨窗口默认参数会静默失效）。
 *   编译期拦截见 `scripts/check-node-types.mjs`（npm run check:node-types）。
 *
 * 注：值为画布 node.type / useNodePrefs 首参的命名空间字符串；
 *   director3dNode 依赖 WebGL 无法 SSR、ghostTarget 为连线占位，均一并登记。
 */
// 🔒 键名冻结（ADR-0038）：本表**键名**属对外契约，禁随手改名 —— 见文件头【键名冻结】段。
export const NODE_TYPES = {
  assetNode: 'assetNode',
  imageBoxNode: 'imageBoxNode',
  gridSplitNode: 'gridSplitNode',
  gridMergeNode: 'gridMergeNode',
  panoramaNode: 'panoramaNode',
  director3dNode: 'director3dNode',
  faceMosaicNode: 'faceMosaicNode',
  loopNode: 'loopNode',
  videoExtractNode: 'videoExtractNode',
  videoProcessNode: 'videoProcessNode',
  group: 'group',
  // ScriptBoxNode.data 全部顶层/子字段属画布快照(canvas-state-v1-{projectId})一部分，
  // 禁止独立持久化（防双写漂移）。字段唯一真相源见 src/components/scriptbox/scriptBoxSchema.ts。
  scriptBoxNode: 'scriptBoxNode',
  textGenerateNode: 'textGenerateNode',
  imageGenerateNode: 'imageGenerateNode',
  videoGenerateNode: 'videoGenerateNode',
  ghostTarget: 'ghostTarget',
};

/**
 * 节点类型值集合（check-node-types 比对用）。
 *
 * 【2026-09-15 修复】`check-node-types.mjs` 第 48 行读的是 `mod.NODE_TYPE_SET`，
 * 但本文件历史上 `NODE_TYPE_SET` 导出被死代码清理误删（见 scripts/dead-code-baseline.json
 * 的 `contracts.ts::exports::NODE_TYPE_SET`），脚本从此永远拿到空 Set，导致所有
 * `useNodePrefs` 裸调用（含 TemplateNode 示例命名空间 imageGenerateNode）一律误报「未登记」。
 * 在此从权威表 NODE_TYPES 派生补回该集合，恢复闸的正确性（不改闸脚本、只补真源侧）。
 *
 * @public 跨边界消费者：scripts/check-node-types.mjs
 *   取用点 :48 `mod.NODE_TYPE_SET`。为何必须显式标记：① `scripts/**` 在 `knip.json` 的 `ignore` 内，
 *   knip 的引用图看不到该消费方；② 消费方式是 `import(pathToFileURL(resolve(...)).href)` ——
 *   非字面量说明符，静态分析**原理上**解析不到（把 scripts 放进 entry 也修不好）。
 *   故豁免写在**声明处**（随文件移动、带理由），**不要**删此导出。
 *   格式由 scripts/check-dead-code.mjs 的元层校验强制（句式 + 路径存在 + 该文件真含此符号名）。
 */
export const NODE_TYPE_SET = new Set(Object.values(NODE_TYPES));
// 注：原 templateNode 登记项已于 2026-09-11 删除（TD-04-5）——TemplateNode 是「新建节点参考蓝本」，
// 非活节点，已迁至 src/components/nodes/_template/ 且不再占用 registry（详见该文件头 JSDoc）。

/** 节点类型值集合（check-node-types 比对用） */

/**
 * ════════════════════════════════════════════════════════════════
 * 剧本盒子「分镜端口」契约 —— 跨模块 handle id 的唯一事实来源
 * ════════════════════════════════════════════════════════════════
 *
 * 剧本盒子为每个分镜恒定注册一个 source handle，id 形如 `shot-${shotId}`。
 * 这个字符串是**跨模块契约**，四处独立消费，此前各写各的裸字面量（极易漂移）：
 *
 *   写侧（生成 handle id / 建边）：
 *     ScriptBoxNode.jsx:189   Handle id（渲染注册锚点）
 *     scriptBoxEngine.js:848  setEdges 建「合并视频」下游边
 *     scriptBoxEngine.js:928  setEdges 建「尾帧变体」下游边
 *   读侧（解析 handle id → shotId）：
 *     App.jsx:487             从端口拖出新节点时反查分镜预填参数
 *     useConnectedInputs.js   下游读取时按分镜取 @资产参考图
 *
 * 为什么必须收口：写侧改前缀而读侧没改 → 连线建得上但下游取不到图，
 * 且失败是静默的（find 落空返回空数组，无报错）。故前缀 + 编解码一并登记在此，
 * 消费方只能走 shotHandleId / parseShotHandle，禁止 slice/replace 手写。
 */

/** 分镜端口 handle id 前缀（拼接式：`${SHOT_HANDLE_PREFIX}${shotId}`） */
export const SHOT_HANDLE_PREFIX = 'shot-';

/**
 * 写侧：分镜 id → handle id。
 * @param {string|number} shotId
 * @returns {string} `shot-${shotId}`
 */
export function shotHandleId(shotId: string | number) {
  return `${SHOT_HANDLE_PREFIX}${shotId}`;
}

/**
 * 读侧：handle id → 分镜 id；非分镜端口返回 null。
 * 按前缀长度截取而非 replace：分镜 id 自身可含 `shot-`（如 `shot-9`），
 * replace 只替换首个匹配会截错（旧实现 App.jsx:487 的 slice 口径是对的，统一按此）。
 * @param {string} [handle]
 * @returns {string|null}
 */
export function parseShotHandle(handle?: string | null) {
  if (typeof handle !== 'string' || !handle.startsWith(SHOT_HANDLE_PREFIX)) return null;
  const id = handle.slice(SHOT_HANDLE_PREFIX.length);
  return id || null;
}

/**
 * ════════════════════════════════════════════════════════════════
 * 节点「固定端口」契约 —— type → { targetHandleId?, sourceHandleId? } 的唯一事实来源
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么收口（TD-04-1）】React Flow 渲染一条边时，用 edge.sourceHandle/targetHandle
 * 去节点 handleBounds 里查句柄；查不到就静默不渲染该边（code-008）。节点的端口真源是各
 * 节点文件的 NodeShell `targetHandleId/sourceHandleId` prop。但此前还有两处手工复制表：
 *   - App.tsx `TARGET_/SOURCE_HANDLE_BY_NODE_TYPE`（补存量坏边 handle、建边 connection 路径）
 *   - lazyNode.tsx `LAZY_NODE_HANDLE_CONTRACT`（chunk 未到达的占位骨架声明端口）
 * 三处独立维护，且已实测漂移（App 表 target 缺 gridSplit/gridMerge/imageBox/videoProcess，
 * source 缺 assetNode/videoGenerate）——同语义 ≥2 可写点且漂移过一次，按 CLAUDE §5.4·9 收口。
 *
 * 【本表定位】节点「非默认口」的**集中清单**（默认口 = React Flow null，无需登记）。
 *   - 消费方（App 补边 / lazyNode 占位骨架）一律读本表，禁止再写内联表。
 *   - 新增节点若声明 targetHandleId/sourceHandleId，必须同步登记本表。
 *   - **与节点文件真源一致性由静态闸守护**：`node scripts/check-node-handles.mjs` 已扩展为
 *     对账「节点文件 NodeShell prop ⊆ 本表」，漏登记即红（防回潮，见脚本头）。
 *
 * 【非标端口豁免 · 机器可读（TD-17-4）】本表中 `customHandles: true` 的条目 = 该节点手写端口
 *   （overlayHandles / 动态多口），合法豁免「端口渲染硬门禁」规则 1 的 `showHandles=false` + `<CustomHandle>` 组合。
 *   唯一实例：scriptBoxNode 的 target `in` 经 overlayHandles（非 NodeShell prop）挂在节点根 div 上
 *   （showHandles=false + overlayHandles，见 ScriptBoxNode.tsx）；其 source 口为动态多口（shot-*），
 *   由 SHOT_HANDLE_PREFIX 契约表达。该豁免**只在本表声明一份**，闸 `check-node-handles.mjs` 运行时派生，
 *   禁止在闸内再手抄（SSOT：漂移根因）。GridMerge 多输出口已收敛为单一 'merged-output'，故仍登记固定口。
 */
export const NODE_HANDLE_CONTRACT: Record<string, NodeHandleContract> = {
  /** 剧本盒子：输入口 'in' 经 overlayHandles 注册（非 NodeShell prop）；出口为动态 shot-* 多口，不在此登记 */
  scriptBoxNode: { targetHandleId: 'in', customHandles: true },
  /** 全景图（懒加载）：固定一进一出（three 重依赖） */
  panoramaNode: { targetHandleId: 'in', sourceHandleId: 'main-output' },
  /** 视频处理（懒加载）：固定一进一出 */
  videoProcessNode: { targetHandleId: 'default', sourceHandleId: 'main-output' },
  /** 3D 导演台（懒加载）：沿用 NodeShell 默认口（无显式 handleId） */
  director3dNode: {},
  /** 图片切分：一进一出 */
  gridSplitNode: { targetHandleId: 'in', sourceHandleId: 'batch' },
  /** 图片拼图：一进一出（多输出口已收敛为 merged-output） */
  gridMergeNode: { targetHandleId: 'default', sourceHandleId: 'merged-output' },
  /** 图片盒子：一进一出 */
  imageBoxNode: { targetHandleId: 'in', sourceHandleId: 'active' },
  /** 素材节点：出口 main-output（输入沿用默认 null） */
  assetNode: { sourceHandleId: 'main-output' },
  /** 视频生成：出口 main-output */
  videoGenerateNode: { sourceHandleId: 'main-output' },
};

/** 节点端口契约值的形状 */
export interface NodeHandleContract {
  targetHandleId?: string;
  sourceHandleId?: string;
  /** 该节点手写端口（overlayHandles / 动态多口），合法豁免端口渲染硬门禁规则 1；仅真源在此声明 */
  customHandles?: boolean;
}

/**
 * 前端调用的后端 API 端点（url 路径段）——图片按需出图等 URL 构造处唯一事实来源。
 * 新增/改动端点路径 → 先在此登记，禁止组件散写裸路径字面量。
 * 与下方 apiRegistry 的 ACTIVE 清单一致：/api/files/thumbnail 为前端真实调用端点（envelope: stream）。
 */
export const API_ENDPOINTS = {
  /** 按需出图：GET {API_BASE}/api/files/thumbnail?url=<相对/subfolder/name>&maxDim=[&format=]
   *   直接返回缩略图二进制（image/*），供 <img src> 直接使用。
   *   `format` 白名单 = **Jimp 可编码格式**，唯一真源 `localTool/src/utils/fileStore.ts` 的
   *   `JIMP_MIME_BY_EXT`（png/jpg/jpeg/gif/bmp/tiff）；白名单外（如 webp）后端回退源扩展名，不报错。
   *   更新(2026-09-16 · TD-02-41)：原注释此处把 webp 也列为白名单成员（比代码多一个值 = 描述层漂移）；
   *   同时前端已删除同名校验 —— format 现为**后端单方判据**且前端零消费者（不再有第二份白名单）。 */
  fileThumbnail: '/api/files/thumbnail',
  /** 画布快照版本号轻量读取：GET {API_BASE}/api/kv/version?key=<key>
   *  3s 跨源冲突轮询专用（只读 <key>_version，不拉整包）。见 docs/118 §三 S1 / §五 C4。 */
  kvVersion: '/api/kv/version',
  /** KV 键枚举（备份列举）：GET {API_BASE}/api/kv/keys
   *  备份要能「新工程域登记即自动进备份」，就必须枚举**实际存在**的键（前端只持有模板，
   *  实例存在性真源在后端）。默认已排除 CAS 内部元数据 `<key>_version` —— 该判据归后端
   *  （只有它知道哪些是自己的协议元数据）。见 TD-02-30 / M7 方案 A 三期。 */
  kvKeys: '/api/kv/keys',
};

/**
 * localTool 后端路由库存档（P0-4 死路由标注）。
 *
 * 目的：避免「前端改完后端炸 / 后端改契约前端无感知」。前端调用的端点集中登记，
 * 后端侧存在但前端【零调用】的端点归类为「预留/上游转发」，改动它们不触发前端回归，
 * 也防止误当 bug 删除。
 *
 * 前端【实际调用】的端点（改动需评估前端契约影响）：
 *   GET/POST /api/status、/api/logs、/api/tasks*、/api/projects*、/api/resources*、
 *   /api/files/*（upload/read/thumbnail/mkdir/move/open/open-dir/list）、
 *   /api/providers*、/api/config/base、/api/kv/*（get/set/version/keys）。
 *   （注：旧 /api/proxy 与 /api/agent/:key/chat 均已收口退役——chat 出站统一打 /api/generate，见 L3b。）
 *   → 见 localToolApi.js / filesApi.js / logger.js / useLocalToolStatus.js 等。
 *
 * 后端存在、前端【零调用】= 预留/上游转发（勿当死代码删，勿随前后端契约盲改）：
 *   admin.ts： /api/admin/stats、/api/admin/clear-cache、
 *              /api/admin/cleanup、/api/admin/export、/api/admin/import
 *   （注：原 /api/admin/kv-list 已于 2026-09-16 归位为 /api/kv/keys —— 它不再是"前端零调用"，
 *     用户备份已消费它；归位理由见 routes/kv.ts `handleKvKeys` 注释，TD-02-30。
 *   platform.ts：/plugin/manifest.json、/api/workflow-apps/by-project/:id、
 *              /public/platform/builtin、/public/platform/models
 *   passthrough.ts（isLocalOnlyPath 判定后的上游转发补偿用）
 *
 * 注：旧 /api/agent/:key/chat 直连端点已随 L3b 退役——AI 助手 chat 出站统一打 /api/generate（relayChatStream）。
 */
/**
 * 中央端点登记表（apiRegistry）—— 前端函数 ↔ 后端 route 的双向映射唯一真源（docs/26-M2-a/C1）。
 *
 * 【为什么建】早期 `BACKEND_ROUTES` 仅是无 program 化结构的字符串占位（已删除，2026-08-22）。
 * 本表以结构化数据承接
 * 「前端消费点 ↔ 后端 route pattern ↔ method ↔ 信封形状」，供 `scripts/check-api-contract.cjs`
 * 与 `localTool/src/router.ts` 的 `routes` 表正则互检（前端有后端无→warn 白实现；
 * 后端有前端无→info 待补；信封标注与 handler 形态不符→error）。
 *
 * 【形态】每条 = { fn, method, path, envelope, status, note?, consumer? }
 *  - fn：   前端聚合函数/消费点（localToolApi 导出 / filesApi / generate / logger / hook 等；须为 `模块.符号[.符号]` 链）
 *  - method：GET/POST/PUT/DELETE（对齐 router.ts routes）
 *  - path：  后端 route pattern（字符串精确或正则源文本，与 router.ts 一致）
 *  - envelope：ok | code-data | items | success-data | raw | stream | sse | probe | stub。
 *       流式/探针/裸值/桩豁免信封检查（stream/sse/raw/probe/stub，check-api-contract 跳过）。
 *  - status：ACTIVE（前端已消费）/ RESERVED（后端有前端零消费，勿当死代码删）。
 *  - note：  描述性说明（2026-09-04 起 fn 禁止夹描述，说明一律放本字段，check:api 对 ACTIVE 的 fn 形态强制校验）
 *  - consumer：真实消费门面链（4.4：fn 是底层原语时用本字段登记门面，如 relayProxy.* 配 generate.*，check:api 双查）
 *
 * 【纪律】新增端点 → 先在本表登记 + 在 localToolApi/filesApi 加函数（M2-d「加函数+登记」双动作）。
 * 散落点（GeneratedView/ResourceLibrary/pollTask）也须登记，即便它们暂走 httpRequest 直拼——
 * 本批只登记定位，B3 再收进薄壳。
 *
 * ⚠️ RESERVED 组（后端已 handle、前端零消费）登记 admin/official/platform/workflow/sync/assets
 *   /batch-save/clear/move/list/jianying，校验脚本标 info 待补，勿误判白实现或误删。
 */

/** 单条端点登记的形状（check-api-contract.cjs 强校验 fn 形态、method、envelope 与后端一致）。 */
export interface ApiRegistryEntry {
  /** 前端消费点（模块.符号[.符号]，须真实导出，禁止夹描述） */
  fn: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | '*';
  /** 后端 route pattern（字符串全等或正则源文本转 {x}，与 localTool/src/router.ts 一致） */
  path: string;
  /** 信封形态：ok | code-data | items | success-data | raw | stream | sse | probe | stub */
  envelope:
    'ok' | 'code-data' | 'items' | 'success-data' | 'raw' | 'stream' | 'sse' | 'probe' | 'stub';
  status: 'ACTIVE' | 'RESERVED';
  note?: string;
  /** 门面消费链（fn 是底层原语时登记上层门面，check:api 双查） */
  consumer?: string;
}

/**
 * 中央端点登记表（apiRegistry）—— 前端函数 ↔ 后端 route 唯一真源（docs/26-M2-a/C1）。
 *
 * 2026-09-15 补全：此前 apiRegistry 为空表，导致 check:api 反向差集把所有源码 httpRequest
 * 调用点判为 ERROR（32 条），prebuild 闸失败。现按 router.ts 路由表 + 实际调用点补齐 ACTIVE 组。
 * 形态以各 handler 实际返回为准（kv/tasks/files/projects/resources/admin 均 code-data；status 为 {status:'ok'}）。
 *
 * @public 跨边界消费者：scripts/check-api-contract.cjs
 *   取用点 :611 `mod.apiRegistry`。豁免理由同 `NODE_TYPE_SET`：`scripts/**` 被 knip ignore +
 *   非字面量动态 import，静态图看不到 → 显式标记。本表是前后端唯一契约真源，**不要**删此导出。
 */
export const apiRegistry: Record<string, ApiRegistryEntry> = {
  // ── 系统 ────────────────────────────────────────────────────────────
  status: {
    fn: 'useLocalToolStatus.useLocalToolStatus',
    method: 'GET',
    path: '/api/status',
    envelope: 'ok',
    status: 'ACTIVE',
    note: '本地工具连通性 ping（useLocalToolStatus hook 内 runCheck 调用）',
  },

  // ── 声音库（剪辑器「音效 / 音乐」· **自建**本地库，TD-22-47）────────────────
  soundLibrary: {
    fn: 'localToolApi.fetchSoundLibrary',
    method: 'GET',
    path: '/api/sounds/library',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '扫描 uploads/sounds/{effects,music} 返回清单（替代 cutia 时代未实现的 /api/sounds/search）',
  },

  // ── 供应商（providerApi · 2026-09-20 补登记）────────────────────────────────
  // 【为什么补】`check:api` 的**字面量调用点扫描**上线后（TD-17-32），这 5 个端点才从盲区里露出来：
  //   前端经 `localToolApi.request<T>('/api/providers…')` 本地包装调用，而旧判据只认
  //   `httpRequest/httpPost/httpRequestLogged` 的**模板**一参 ⇒ 长期隐身。
  //   它们在后端存在（handleProvidersGet/Put · handleProviderTest · handleProviderProbeAsync ·
  //   handleProviderFetchModels）但**未登记** ⇒ 本次补齐（不是新端点，是漏登记）。
  providersGet: {
    fn: 'localToolApi.providerApi.getProviders',
    method: 'GET',
    path: '/api/providers',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '读取供应商与模型清单（providerApi.getProviders）',
  },
  providersSave: {
    fn: 'localToolApi.providerApi.saveProviders',
    method: 'PUT',
    path: '/api/providers',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '保存供应商与模型清单（providerApi.saveProviders）',
  },
  providerTest: {
    fn: 'localToolApi.providerApi.testConnection',
    method: 'POST',
    path: '/api/providers/test-connection',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '测试供应商连通性（providerApi.testConnection）',
  },
  providerProbeAsync: {
    fn: 'localToolApi.providerApi.probeAsync',
    method: 'POST',
    path: '/api/providers/probe-async',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '异步探测供应商模型（providerApi.probeAsync）',
  },
  providerFetchModels: {
    fn: 'localToolApi.providerApi.fetchModels',
    method: 'POST',
    path: '/api/providers/{x}/fetch-models',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '拉取指定供应商的模型列表（providerApi.fetchModels；路径含 encodeURIComponent(id)）',
  },
  iconifyProxy: {
    /* fn 形态：**裸导出符号**（非 `模块.符号`）。
       修(2026-09-15)：原写 `iconifyApi.buildIconSvgUrl` —— 而 `iconifyApi` **不是任何模块名**
       （真身在 `src/components/videoEditor/engine/lib/iconify-api.ts`，导出 `buildIconSvgUrl`），
       于是 `check:api` 的 R5 模块发现判它 `fn 模块未映射`（info，永不拦）。
       自动发现支持两种形态（`base/api/*.ts` 文件名 + 全仓 src 导出符号），本符号全仓唯一 ⇒ 用后一种。 */
    fn: 'buildIconSvgUrl',
    method: 'GET',
    path: '/api/iconify/{x}',
    envelope: 'raw',
    status: 'ACTIVE',
    note: '贴纸图标唯一出站口（原样透传；上游 api.iconify.design→simplesvg→unisvg 三家回落收在后端）。实现在 videoEditor/engine/lib/iconify-api.ts',
  },
  hfProxy: {
    fn: 'applyHfProxyHost',
    method: 'GET',
    path: '/api/hf/{x}',
    envelope: 'raw',
    status: 'ACTIVE',
    note: '转写模型唯一出站口（huggingface 原样透传：/api/hf/<model>/resolve/<rev>/<file> → huggingface.co）。实现在 videoEditor/engine/services/transcription/hf-proxy.ts，由 transcription/worker.ts 在 pipeline 前调用设为 env.remoteHost',
  },

  // ── Generate（relayProxy 门面：submit → 轮询 attach；chat 出站统一走此处）──
  generateSubmit: {
    fn: 'relayProxy.relaySubmit',
    method: 'POST',
    path: '/api/generate',
    envelope: 'code-data',
    status: 'ACTIVE',
    consumer: 'relayProxy.relayGenerate',
    note: '统一生成提交入口（聊天/图片/视频），返回 taskId',
  },
  generateGet: {
    fn: 'relayProxy.relayPoll',
    method: 'GET',
    path: '/api/generate/{x}',
    envelope: 'code-data',
    status: 'ACTIVE',
    consumer: 'relayProxy.relayAttachUntilDone',
    note: '按 taskId 拉取生成结果（常驻轮询 attach）',
  },
  generateCancel: {
    fn: 'relayProxy.relayCancel',
    method: 'POST',
    path: '/api/generate/{x}/cancel',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '按 taskId 取消生成',
  },

  // ── KV（localToolApi 薄壳）──────────────────────────────────────────
  kvGet: {
    fn: 'localToolApi.kvGet',
    method: 'GET',
    path: '/api/kv/get',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: 'KV 读取（键值跨端共享）',
  },
  kvSet: {
    fn: 'localToolApi.kvSet',
    method: 'POST',
    path: '/api/kv/set',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: 'KV 写入（CAS 版本保护）',
  },
  kvDelete: {
    fn: 'localToolApi.kvDelete',
    method: 'POST',
    path: '/api/kv/delete',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: 'KV 删除',
  },
  kvKeys: {
    fn: 'localToolApi.kvKeys',
    method: 'GET',
    path: '/api/kv/keys',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: 'KV 键枚举（backupStore 备份列举；后端默认排除 _version 内部元数据）',
  },

  // ── 文件操作（filesApi 收口，唯一落盘归属点）─────────────────────────
  filesOpen: {
    fn: 'filesApi.openLocalFolder',
    method: 'GET',
    path: '/api/files/open',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '打开子目录所在文件夹（open?subfolder=）',
  },
  filesOpenDir: {
    fn: 'filesApi.openFileDir',
    method: 'GET',
    path: '/api/files/open-dir',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '打开指定文件所在目录（open-dir?filepath=）',
  },
  filesMove: {
    fn: 'filesApi.moveFile',
    method: 'POST',
    path: '/api/files/move',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '移动/归类素材（move {src,dst}）',
  },
  filesMkdir: {
    fn: 'filesApi.createFolder',
    method: 'POST',
    path: '/api/files/mkdir',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '创建本地文件夹（mkdir {folder}）',
  },
  filesUpload: {
    fn: 'filesApi.uploadFileToLocal',
    method: 'POST',
    path: '/api/files/upload',
    envelope: 'code-data',
    status: 'ACTIVE',
    consumer: 'filesApi.saveInlineToLocal|persistUrlToUploads|downloadRemoteToLocal',
    note: '上传落盘唯一端点（dataUri / fileUrl / 远程下载三模式）',
  },

  // ── Tasks（localToolApi 收口 CRUD）──────────────────────────────────
  tasksGet: {
    fn: 'localToolApi.fetchTasks',
    method: 'GET',
    path: '/api/tasks',
    envelope: 'code-data',
    status: 'ACTIVE',
    // 2026-09-17 修正：原写 `keyword` —— 前端确实发过 `keyword`，但**后端读的是 `search`**
    // （`helpers.ts::parsePagination`）⇒ 搜索静默失效。现已两端统一为 `search`，并新增
    // `filters`（`{nodeId}` → `node_id = ?` 精确查）。
    note: '分页拉取任务列表（tasks?page&pageSize&search&filters）',
  },
  tasksSave: {
    fn: 'localToolApi.saveTask',
    method: 'POST',
    path: '/api/tasks/save',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '单条 upsert 任务',
  },
  tasksBatchSave: {
    fn: 'localToolApi.batchSaveTasks',
    method: 'POST',
    path: '/api/tasks/batch-save',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '批量 upsert 任务',
  },
  tasksDelete: {
    fn: 'localToolApi.deleteTask',
    method: 'POST',
    path: '/api/tasks/delete',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '删除单条任务（delete?id=）',
  },
  tasksBatchDelete: {
    fn: 'localToolApi.batchDeleteTasks',
    method: 'POST',
    path: '/api/tasks/batch-delete',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '批量删除任务（{ids}）',
  },
  tasksClear: {
    fn: 'localToolApi.clearAllTasksApi',
    method: 'POST',
    path: '/api/tasks/clear',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '清空所有任务',
  },

  // ── Projects（localToolApi 收口）────────────────────────────────────
  projectsGet: {
    fn: 'localToolApi.fetchProjects',
    method: 'GET',
    path: '/api/projects',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '拉取项目列表（projects/lastOpened）',
  },
  projectsSave: {
    fn: 'localToolApi.saveProjects',
    method: 'POST',
    path: '/api/projects/save',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '全量覆盖保存项目（版本并发保护）',
  },

  // ── Resources（localToolApi 收口）───────────────────────────────────
  resourcesGet: {
    fn: 'localToolApi.fetchResources',
    method: 'GET',
    path: '/api/resources',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '分页拉取素材库（resources?page&pageSize&filters&projectId&search）',
  },
  resourcesRescan: {
    fn: 'localToolApi.rescanResources',
    method: 'POST',
    path: '/api/resources/rescan',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '重扫磁盘 upload 目录进素材表',
  },
  resourcesDelete: {
    fn: 'localToolApi.deleteResource',
    method: 'POST',
    path: '/api/resources/delete',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '删除素材（delete?id=）',
  },
  resourcesRename: {
    fn: 'localToolApi.renameResource',
    method: 'POST',
    path: '/api/resources/rename',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '重命名素材（rename?id=&name=）',
  },

  // ── Admin（localToolApi 收口，前端实际消费的健康/删除文件）──────────
  adminStorageHealth: {
    fn: 'localToolApi.fetchStorageHealth',
    method: 'GET',
    path: '/api/admin/storage-health',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '存储健康总报表（只读）',
  },
  adminDeleteFile: {
    fn: 'localToolApi.deleteStorageFile',
    method: 'POST',
    path: '/api/admin/delete-file',
    envelope: 'code-data',
    status: 'ACTIVE',
    note: '安全删除单个 uploads 文件（孤儿/重复副本共用）',
  },
};
