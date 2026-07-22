# 一毛AI画布 · 项目日志

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
- **导出/恢复/云端上传的 JSON 不是同一份**（代码已确认，待观察是否要统一）：
  - 导出备份 `Ri` (L44443) 与 恢复导入 `Bi` (L44482) 是同一份 `{localforage, kvStore}` 结构，互为对偶。
  - 云端上传 `ei` (L43888) → GAS `push_data` 是另一份独立扁平结构，仅 9 个 kvStore 键（`app_settings, api_configs, users, membership, projects, presetPrompts, customNodeTemplates, modelSchedules, cloud_storage_config`）。
  - 差异：云端**不含**画布节点(localforage)、`old_membership`、`lastOpenedProject`、项目详情 `Cr(id)`，但**多含** `modelSchedules`；导出备份反之。
  - 互用问题：导出备份拿去云端 push 会丢字段（`ei` 硬编码只取那 9 键）；云端拉取 `ti` 只写 kvStore 不碰 localforage，画布不会回来。
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
