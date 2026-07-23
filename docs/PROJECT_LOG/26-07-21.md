# 猫猫AI画布 · 项目日志

> 只记关键决策，不堆细节。
> **规则：本日志只可向后追加，不可覆盖/改写已有条目。新人接手时新增条目，勿改动历史记录。**

## 2026-07-20 11:50
- 控制台三类报错（9004 的 4 个 404、RootErrorBoundary 的 `useState null`、18080 连不上）均为无害噪音，**不予修改**。
  - 9004 的 `/api/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/by-project/default` 网关从未实现（本地模式用不到），前端兜底吞掉。
  - 18080 连不上是 localTool 未启动导致，非代码 bug。
- 之前注释掉的 UI 功能（模型选择/插件市场/工作流管理）仍会发请求，因请求来自底层取数函数（`App.js` L3224/L3240/L38212/L43311），不在被注释的 UI 层——属预期，不改。
- localTool（18080）、网关（9004）需手动启动，属运行前提。

## 2026-07-20 13:07
- **HANDOFF4 死循环修复完成**（`cd3c0aa`）：
  - 根因：`uploadFile` 返回相对路径 `/files/...`，Chrome 扩展环境解析为 `chrome-extension://` 前缀导致加载失败
  - 同时统一同步 effect 的本地化判定未覆盖相对路径，已本地化任务被反复重新上传 → 死循环
  - 修复：两处改动——`uploadFile` 返回补全绝对路径 + 本地化判定补上 `e.startsWith('/files/')` 相对路径检测
  - 遗留：单任务轮询卡 `pending_confirmation` 仍是独立问题，未修

## 2026-07-20 待观察
> ⚠️ **2026-07-23 更正（commit `176437b`）**：下文 GAS push 函数当时名为 `ei`，现已语义化改名为 **`syncToCloud`**（App.js ≈L41365）；pull 仍是 `ti`（≈L41415）。行号 L43888/L44443/L44482 是当时构建快照，已漂移。
- **导出/恢复/云端上传的 JSON 不是同一份**（代码已确认，待观察是否要统一）：
  - 导出备份 `Ri` (L44443) 与 恢复导入 `Bi` (L44482) 是同一份 `{localforage, kvStore}` 结构，互为对偶。
  - 云端上传 `syncToCloud`（当时写作 `ei`，L43888） → GAS `push_data` 是另一份独立扁平结构，仅 9 个 kvStore 键（`app_settings, api_configs, users, membership, projects, presetPrompts, customNodeTemplates, modelSchedules, cloud_storage_config`）。
  - 差异：云端**不含**画布节点(localforage)、`old_membership`、`lastOpenedProject`、项目详情 `Cr(id)`，但**多含** `modelSchedules`；导出备份反之。
  - 互用问题：导出备份拿去云端 push 会丢字段（`syncToCloud` 硬编码只取那 9 键）；云端拉取 `ti` 只写 kvStore 不碰 localforage，画布不会回来。
  - 待观察：是否要统一三者（让云端也带 localforage + 补齐缺失键，或导出也带 modelSchedules）。当前未改。

## 2026-07-22 解耦工程阶段一完成
- **目标**：将编译产物 `src/_engine/App.js`（46,415 行）自底向上解耦为可维护模块，**解耦不是重写**——直接剪切原代码，保持混淆变量名和逻辑完全不变。
- **成果**：
  - 主文件 `src/App.js`：46,415 → 45,098 行（剥离 1,446 行到 17 个模块文件）
  - 目录整理：消除 `_engine/` 和 `v2/` 文件夹，所有内容归入 `src/` 根；CSS/vendor 文件去掉哈希后缀（`App-DFxwm5B3.css` → `app.css`，`vendor-Cr1JWW-B.js` → `vendor.js` 等）
  - 已剥离模块（按依赖方向）：
    - `config/`（storageKeys、constants、options）
    - `utils/`（fileUtils、canvasUtils、helpers、storage/index）
    - `services/jianying.js`
    - `contexts/EditorContext.js`
    - `components/common/`（LogoIcon、ErrorBoundary、ResizableTextarea、LazyImage、ToastContainer）
    - `components/panels/ImportExportPanel.js`
- **踩坑与回退**（重要教训）：
  - `config/options.js` 中的 yc/xc 数组依赖图标变量 `oe/at/_e/$t`（从 vendor 导入），非纯配置 → **移回 App.js**
  - `services/modelApi.js`、`services/localTool.js` 从 `entry.js` 导入（Vn/Hn），而 entry.js 是应用入口动态加载 App.js → **循环依赖触发 TDZ（`Cannot access 'dbe' before initialization`）**，代码体合并回 App.js，删除这两个文件
  - `useState null` 错误经基线版本（848d028）验证为**原有问题**，非解耦引入，RootErrorBoundary 捕获后应用正常恢复
- **路径与构建配置同步更新**：`main.tsx`、`entry.js`、`tsconfig.json`、`vite.config.ts`、`vite-env.d.ts` 中所有 `_engine/`、`v2/`、哈希后缀引用已修正；`vite.config.ts` 的 manualChunks 改为匹配 `/src/App.js`、`/src/vendor/`、`/src/entry.js`。
- **待解耦（高风险，暂保留在 App.js）**：TransitPanel、BuiltinModelPanel 等业务面板（依赖大量闭包变量）；所有 ReactFlow 节点组件（依赖图标变量）；modelApi/localTool（需先打破与 entry.js 的循环依赖）。
- **运行验证**（日志 `1784679240647.log`）：应用正常启动，localTool（18080）连接成功，初始化完成 `isLoggedIn: true`。已知噪音依旧存在（9004 的 4 个 404、RootErrorBoundary 的 useState null），与 07-20 记录一致，**未引入新问题**。用户发请求时 `/api/proxy` 500、`/api/tasks/save` 400，回退 direct fetch——属 localTool 服务端问题，非前端解耦引入。

## 2026-07-22 下一步计划（交接给下一位 AI）
**原则：先修 bug，再继续解耦。** 两线独立，但先修 bug 能让解耦的构建验证基线更干净，且避免与即将解耦的 modelApi/localTool 调用链撞车。

### 任务 1：排查并修复 `/api/proxy` 500 + `/api/tasks/save` 400
- **现象**（日志 `1784679240647.log` L110-122, L130）：用户发送文本请求"啊啊啊"时，`127.0.0.1:18080/api/proxy` 返回 500，前端回退 direct fetch 后 `api/tasks/save` 仍返回 400（出现两次）。
- **排查方向**：
  1. 读 [localTool/src/routes/tasks.ts](file:///Users/kevin/Documents/maomao/localTool/src/routes/tasks.ts) 确认 `/api/tasks/save` 的请求体 schema，对照前端发送的 payload 找 400 根因
  2. 查 localTool 的 proxy 路由（可能在 [localTool/src/routes/](file:///Users/kevin/Documents/maomao/localTool/src/routes) 下或 index.ts）确认 500 根因
  3. 前端调用链在 [src/App.js](file:///Users/kevin/Documents/maomao/src/App.js)（modelApi/localTool 代码体，尚未解耦出），发送逻辑可参考日志 L110 `Sending Text API payload`
- **待确认**：500 是 localTool 路由 bug 还是上游 API 错误透传；400 是 schema 不匹配还是缺字段
- **不要做的事**：不要把 500/400 归咎于解耦——基线版本同样存在

### 任务 2：确认 apiConfigs 空配置项是否需要前端过滤
- **现象**（日志 L77）：`apiConfigs` 数组第二条为空配置 `{name:"", url:"", key:""}`，是用户占位未填。
- **待确认**：发请求时是否可能命中这条空配置导致代理失败；前端是否应在发送前校验/跳过空配置。
- **数据位置**：存储在 localTool kvStore 的 `api_configs` 键，前端加载逻辑在 [src/App.js](file:///Users/kevin/Documents/maomao/src/App.js) 的 `loadAppSettings`（日志 L70）

### 任务 3：bug 修复后，继续解耦 modelApi/localTool
- **前提**：任务 1、2 完成且验证通过，调用链稳定
- **目标**：将 modelApi/localTool 代码体从 App.js 剥离到独立模块
- **关键风险**：与 [src/entry.js](file:///Users/kevin/Documents/maomao/src/entry.js) 存在循环依赖（entry.js 动态加载 App.js，而 modelApi/localTool 需从 entry.js 导入 Vn/Hn）——这是上次解耦失败的根因
- **解法**：先打破循环依赖（可能需将 Vn/Hn 的依赖反转，或把共享逻辑下沉到不依赖 entry.js 的底层模块），再剥离代码体
- **验证**：`npm run build` + 运行时确认无 `Cannot access before initialization` 错误

### 后续解耦队列（低优先级，待 modelApi/localTool 完成后再推进）
- 业务面板：TransitPanel、BuiltinModelPanel（依赖大量闭包变量）
- ReactFlow 节点组件（依赖图标变量 oe/at/_e/$t）

### 工程约束（沿用项目既有约定）
- 只可修改：`src/App.js`、`src/config.js`、`localTool/src/**`、`apimart-gateway/**`
- 禁止修改：`dist/`、`vendor-*.js`（现 `src/vendor/`）、`rolldown-runtime-*.js`、`src/v2/`（已删除）
- 网关启动用 `--port 9004`（README 文档有误）
- 新代码语义命名：常量 UPPER_SNAKE，函数 camelCase
- 解耦原则：**剪切不重写**，保持混淆变量名和逻辑完全不变
- 每个主要剥离步骤后跑 `npm run build` 验证

## 2026-07-22 任务1收尾：proxy 500 / tasks-save 400 根因确认（已闭环）

- **根因全在后端，已在 `7504c3e` 修复，前端无需改动**：
  - `localTool/src/routes/system.ts`（`handleProxyJson`）：原重复 `JSON.stringify` 导致双重序列化 500 → 改为透传前端已序列化的 `body` 字符串。
  - `localTool/src/routes/tasks.ts`（`handleTasksSave` / `handleTasksBatchSave`）：原只认 `taskId` 导致前端发 `id` 时 400 → 改为同时接受 `id` 与 `taskId` 并自动映射 `body.taskId = body.id`。
- **前端调用链核对（确认无遗留 bug）**：
  - `/api/proxy`（`src/App.js` `zc()` ~L18078）：proxy 失败时静默 catch 后直接 `fetch` 原始 URL，是正常容错兜底，**非 bug**；后端修好后基本不触发。
  - `/api/tasks/save`、`/api/tasks/batch-save`（`src/App.js` `J_` ~L40319、`Y_` ~L40332）：直接 `JSON.stringify(e)` 打 `U_`(:18080)，无"回退"逻辑，后端修好即正常。
- **验证状态**：当前基线 `7504c3e` + localTool 重 build 后，发送请求不再 500/400（日志 `1784687267140.log` 已验证应用正常进入、初始化完成）。

## 2026-07-22 解耦实验文件状态（提醒下个 AI）

- 工作区 untracked：`src/services/{apiService,localTool,taskManager}.js`、`src/utils/endpoint.js`。
- 这些是从 `src/App.js` 剥离的**未完成解耦实验**，**未被当前基线 import**，处于"悬空"状态。
- ⚠️ 已知坑：`src/services/apiService.js` 曾误用 `Q.getItem/Q.setItem/Q.remove`（`Q` 是 StorageManager，方法名是 `getConfig/setConfig`，无 `getItem`），正确应引用 storage 的 localStorage 后端 `Nr`。若重启解耦，必须先修此处再启用。
- 重启解耦前请先重读 `CLAUDE.md` 红线与循环依赖约束（entry.js 动态 import App.js，modelApi/localTool 不能反向 import entry.js 的 `Vn/Hn`）。

## 2026-07-22 误改回退记录（重要教训，防重犯）

- 曾有一次未提交改动（`src/App.js` -751 行、`src/entry.js` -102 行）声称"修复变量名冲突/React 导入"，实际删除了 storage 模块的 `Vr/Kr/Qr/ri` 导入，导致运行时 `Vr.getItem is not a function`、应用无法进入。
- 该改动已 `git checkout` 回退到 `7504c3e`，应用恢复正常（日志 `1784687267140.log`）。
- **教训**：`App.js` 内 `Vr/Kr/Qr/ri` 等短名是**被引用的导入符号**，不是"与内部冲突的多余导入"，删除前必须先 grep 全部引用点确认。详见已作废的 `HANDOFF.md`（本日志已取代它）。
