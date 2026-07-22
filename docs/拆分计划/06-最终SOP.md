# App.js 安全解耦 · 最终执行 SOP（AI01 仲裁官签发）

> **性质**：这是给**单个执行 AI** 照做的执行手册，不是方案讨论。基于四份方案（02/03/04/05）交叉仲裁得出，以 **AI03 为骨架**，悬空文件处理改用仲裁结论「删除重拆」（见 §三）。
> **原则**：剪切不重写；只改白名单文件；混淆名与逻辑原样搬运；每阶段 `npm run build` 必须通过；可随时 `git checkout` 回退。
> **基线**：commit `7504c3e`（fix: localTool 两个接口 bug 修复）。执行前 `git status` 确认工作区干净或先 stash。

---

## 〇、执行前置（必做）

1. `git status` 查看工作区。若有未提交改动（CLAUDE.md 等），先 `git stash` 或在新分支上工作：
   ```
   git checkout -b decouple/exec
   ```
2. 确认 Node 版本 ≥ 18，能跑 `npm run build`（package.json 的 build 脚本含 `NODE_OPTIONS=--max-old-space-size=1024`）。
3. **严禁修改**：`dist/`、`src/vendor/`（含 `vendor.js`/`rolldown-runtime.js`）、`*.css`、`reference/App.original.js`、`src/v2/`。
4. 恢复手段只有 `git checkout -- src/App.js`，**不要复制备份文件覆盖**。

---

## 一、切分总览（7 个大模组 + 删除 4 悬空文件）

| 模组 | 文件 | 从 App.js 切出（行号） | base URL 真源 |
|------|------|------------------------|---------------|
| URL 工具 | `src/utils/urlTools.js` | L23-57（`$n`/`er`/`tr`/`nr`/`rr`/`ir`/`ar`/`sr`/`cr`） | active endpoint 用 `entry.js` 的 `Vn()`（`import { r as Vn } from './entry.js'`），**删 sessionStorage 分支** |
| 调度 | `src/services/modelSchedules.js` | L310-443（`na`~`Sa` 全套） | `ta`(config/constants.js)；`Q`(storage) 用 `setObject/getObject` |
| 认证 | `src/services/auth.js` | L447-581（含 `Pa`~`za` 占位原样保留） | `Ca`/`Va`(constants)；`Q` 用 `getConfig/setConfig/remove` |
| 文件层 | `src/services/localToolClient.js` | L742-912（`Vr`/`Kr`/`Xr`/`Zr`/`Qr`/`$r`/`ri`/`ii`/`ai`） | `Hr`(constants, 动态)；`qr`(fileUtils)；`Hn`(entry 第4导出, 合法) |
| 网关代理 | `src/services/gatewayProxy.js` | L18078（`zc`） | base 由调用方传，模块内不硬编码 |
| 任务库 | `src/services/taskStore.js` | L40278-40405（`U_`→改用 `vv`；`G_`/`K_`/`q_`/`J_`/`Y_`/`X_`/`Z_`/`Q_`/`$_`/`ev`/`tv`） | `vv`(constants, 18080) |
| 资源库 | `src/services/resourceStore.js` | L41515-41598（`yv`/`bv`/`xv`/`Sv`/`Cv`/`wv`/`Tv`/`Ev`） | `vv`(constants, 18080) |

**暂不切（明确留 App.js）**：生图主回调 `Jn`@L31452、ReactFlow 节点组件、`Uc`@L18128(useLocalTool hook)、业务面板闭包（`ji`/`Li` 等 L81-215）、模型元信息 `y_/O_/k_/A_/j_`(L581-681)。

---

## 二、事实修正（实勘已坐实，执行前必读）

1. **`Jn` 生图主回调真身** = `let Jn = Y.useCallback(...)` @**L31452**（任务书标的 L32490 是其函数体内 `zc(...)` 轮询调用点，非定义）。L14 `import { Jn }` = LogoIcon 组件，不冲突，不切。
2. **`Zr` 真身** = `async function Zr` @**L803**（glossary 误记 L1827 是 CSS `@keyframes`，作废）。
3. **`Hr` 同名遮蔽**：只 `import { Hr } from '../config/constants.js'`（=localEngineBase），**绝不引用 App.js L35372 组件内的局部 `let Hr`**（图片 blob 缓存回调，无关）。
4. **`U_` = `vv` = `LOCAL_ENGINE.base` = 18080**：tasks 本就落 localTool 18080，**不要改成 9004**。新模块统一 `import { vv }`，不引入 `U_`。
5. **`ai`@L889 可切**：它用 `Hn` = entry.js 第4导出 `t as Hn`（动态 import 工厂，`App.js` L4 已合法 import），**非 TDZ 违规**。随 localToolClient 一起切。
6. **`Uc`@L18128 是 useLocalTool hook 唯一真身**（被 `Nv`@L41641 挂 `window.localTool`）；悬空 `localTool.js` 的 `Uc`@L178 是自创冲突版，删除。

---

## 三、悬空文件处理（仲裁结论：全部删除重拆）

> 不用 endpoint.js / taskManager.js 的副本（避开 `$n` 双源漂移风险），从 App.js 真身重切更稳。

- `src/utils/endpoint.js` → **删除**（从 App.js L23-57 真身切出 `urlTools.js`）
- `src/services/taskManager.js` → **删除**（从 App.js L310-443 真身切出 `modelSchedules.js`）
- `src/services/apiService.js` → **删除**（半成品+坑：`Q.getItem` 误用、大量 `return []`、逗号运算符 bug）
- `src/services/localTool.js` → **删除**（自创重写，符号与 App.js 真身冲突）

删除时机：阶段 0 执行（这些文件当前无 import，删了不影响 build）。

---

## 四、命名策略（红线 §3）

- 新模块内**保留原混淆名作为导出**（`export { tr, nr, ... }`），App.js 改 `import` 后调用点零改动——最低风险。
- 新增语义常量 `UPPER_SNAKE`、函数/变量 `camelCase`、类 `PascalCase`。
- 严禁新增短混淆名（`ii`/`Xr`/`U_` 等是原版残留，别模仿别新增）；`U_`/`W_`/`G_`/`H_`/`B_` 类下划线短名是原版残留，**不改**。

---

## 五、执行步骤（分 4 阶段，每阶段独立验证回退）

> 每阶段：① 新建模块文件（搬运代码体，混淆名不变，只改 import/export）② 在 App.js 对应段**删除原代码**，改为 `import { ... } from './<模块>'` ③ `npm run build` 必须零错误 ④ 手测对应功能 ⑤ 异常则 `git checkout -- src/App.js` 还原（模块文件独立保留，下一轮再修）。

### 阶段 0：删除 4 个悬空文件（零风险）
```
rm src/utils/endpoint.js src/services/taskManager.js src/services/apiService.js src/services/localTool.js
```
- 验证：`npm run build` 通过（它们无 import，删了不影响）。

### 阶段 1：切零风险纯模块（urlTools + modelSchedules + auth）
1. 新建 `src/utils/urlTools.js`：搬运 App.js L23-57（`$n` 改为 `import { r as Vn } from './entry.js'; var $n = Vn()`；删 endpoint.js 式 sessionStorage 分支）；导出 `$n,er,tr,nr,rr,ir,ar,sr,cr`。
2. 新建 `src/services/modelSchedules.js`：搬运 L310-443（`na`~`Sa`）；`import { ta } from '../config/constants.js'`、`import { Q } from '../utils/storage/index.js'`；导出全套。
3. 新建 `src/services/auth.js`：搬运 L447-581（`wa`~`Ka`，含 `Pa`~`za` 占位原样）；`import { Ca, Va } from '../config/constants.js'`、`import { Q } from '../utils/storage/index.js'`；导出全套。
4. App.js：删 L23-57 / L310-443 / L447-581 对应代码体，顶部改 `import` 三模块。
5. L733-740 导出块：移除已外移符号（或保留 re-export 兼容，推荐保留 re-export 降低风险）。
6. **验证**：build 通过；浏览器加载扩展，模型权益/登录态/调度面板正常。

### 阶段 2：切中风险 HTTP 层（localToolClient + gatewayProxy）
1. 新建 `src/services/localToolClient.js`：搬运 L742-912（`Vr/Kr/Xr/Zr/Qr/$r/ri/ii/ai`）；`import { Hr, Rr } from '../config/constants.js'`、`import { qr } from '../utils/fileUtils.js'`、`import { t as Hn } from './entry.js'`（仅 `ai` 用，合法）；导出全套。
2. 新建 `src/services/gatewayProxy.js`：搬运 L18078（`zc`）；纯 fetch 无依赖；导出 `zc`。
3. App.js：删 L742-912 / L18078 对应代码，改 import。注意 `ii`/`ri`/`Kr`/`zc` 被引擎多处调用，需全量替换 import（grep 确认所有调用点）。
4. **验证**：build 通过；拖图上传、缩略图、视频封面帧、网关 proxy 转发正常。

### 阶段 3：切数据写库层（taskStore + resourceStore）
1. 新建 `src/services/taskStore.js`：搬运 L40278-40405（`U_` 赋值删去，改用 `import { vv } from '../config/constants.js'`；`G_/K_/q_/J_/Y_/X_/Z_/Q_/$_/ev/tv`）；导出全套。
2. 新建 `src/services/resourceStore.js`：搬运 L41515-41598（`yv/bv/xv/Sv/Cv/wv/Tv/Ev`）；`import { vv } from '../config/constants.js'`；导出全套。
3. App.js：删对应段，改 import。注意 `G_`/`K_`/`q_` 被 TaskListDrawer `av`@L40408 等引用，需同步改 import。
4. **验证**：build 通过；跑一次生图任务，确认 tasks 写入、资源出现在资源库面板、rescan 正常。

### 阶段 4（下期，本期不做）
- 抽 `Uc`@L18128 为独立 hook；评估引擎核心（`Jn`@L31452 等）。

---

## 六、执行 AI 必须报告的内容

每完成一个阶段，在执行 AI 的工作目录（如 `docs/拆分计划/执行报告.md`）记录：
- 本阶段新建/删除的文件清单
- `npm run build` 输出（成功 or 关键报错）
- 手测结果（功能正常 / 异常现象）
- 若 `git checkout` 回退过，记录回退原因与修复尝试

---

## 七、红线速查（违反即中止）

1. 只改 `src/App.js`/`src/config.js`/`localTool/src/**`/`apimart-gateway/**`。
2. 剪切不重写，混淆逻辑原样。
3. 新模块依赖仅白名单（vendor/config/utils/services/jianying/contexts/common/entry 4导出）；**严禁反向 import App.js**；**严禁 import entry.js 内部的 `Vn`/`Hn` 局部变量**。
4. 文件 URL 必须绝对路径 `http://127.0.0.1:18080/...`；网关实际 `127.0.0.1:9004`。
5. 已知无害噪音（9004 的 4 个 404、RootErrorBoundary 的 `useState null`、18080 连不上）别动。

---

**仲裁官签注**：本 SOP 融合 02/03/04/05 之共识，以 03 为骨架、悬空文件改采「删除重拆」(仲裁结论)。执行 AI 严格照 §五 四阶段推进，每阶段 build 验证，异常即 `git checkout` 回退。完成后将 `执行报告.md` 交 AI01 复核。
