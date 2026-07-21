# AI06 · 深化审计：交叉流边界契约补全与 X3 错误假设纠正

> 阶段：门4 对抗审计延伸 ｜ 方法：源码 grep + read_file 坐实
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist（红线§3.1）。
> 配套：纠正 `05-cross-flows.md` X3 段关于 `Hr`/`vv` 的错误假设。

## 1. X3 错误假设纠正（重要）
`05-cross-flows.md` X3 原写：「`Hr`/`vv` 是固定常量，`USE_LOCAL_ENGINE=false` 时仍打 18080，开关无效 → P0 残留」。

**源码坐实后该假设部分错误**：

| 符号 | 真实定义 | 行号 | 性质 |
|------|----------|------|------|
| `LOCAL_ENGINE` | `{host:'127.0.0.1', port:18080, get base()=>'http://127.0.0.1:18080'}` | config.js L12-18 | 对象，base 是 getter |
| `USE_LOCAL_ENGINE` | `true` | config.js L36 | 开关常量 |
| `REMOTE_BASE` | `'http://127.0.0.1:9004'` | config.js L39 | 远程基址（**也是 9004，非真远程**） |
| `localEngineBase()` | `USE_LOCAL_ENGINE ? LOCAL_ENGINE.base : REMOTE_BASE` | config.js L42-44 | **动态解析函数** |
| `Hr` | `localEngineBase()` | **App.js L1732** | **动态调用，非写死常量** |
| `vv` | `LOCAL_ENGINE.base` | **App.js L42808** | 写死 18080 常量 |
| `R`/`_`/`g` | 闭包捕获网关基址（DEFAULT_ENDPOINT=9004） | 轮询分支 L33005/L33525/L34197 | 动态取 config |

**修正结论**：
- `Hr` **不是固定常量**，是 `localEngineBase()` 的返回值，会随 `USE_LOCAL_ENGINE` 切换：true→18080，false→REMOTE_BASE(9004)。原文"Hr 硬编码18080、开关无效"**不成立**。
- 真正的硬编码常量是 `vv`@L42808（始终 18080），但它只用于 `/api/resources/*` 资源查询（见 `xv`@L42827、`Sv`@L42838），这些本就该打 localTool 18080，硬编码合理。
- P0 残留的**真实形态**不是"开关无效"，而是：配置模型本身存在 `REMOTE_BASE`=9004 与 localTool 18080 不匹配的**死路**——`USE_LOCAL_ENGINE=false` 时 `Hr` 切到 9004，但 localTool 路由只在 18080，故 false 模式资源/文件请求全部不可达。这是**配置设计缺陷**（false 分支无对应服务），非代码硬编码 bug。原 P0.1「Hr/vv 硬编码18080」表述需收窄为「vv 硬编码18080（合理）；false 模式 Hr→9004 但无服务承接（配置死路）」。

## 2. X2 资源查询坐实
- `xv`@L42821：`let n = await fetch(\`${vv}/api/resources?${t}\`)` @L42827 → 走 `vv`(18080) `/api/resources`。坐实 ✅。
- `Sv`@L42838：`fetch(\`${vv}/api/resources/save\`)` → 落盘 18080。坐实 ✅。
- 与 X1 落盘 `ii`→`Xr`(L1802 → Hr/api/files/upload) 形成「文件打 Hr(18080) / 资源记录打 vv(18080)」双路径，均本地模式，一致 ✅。

## 3. X4 事件总线坐实（补完整）
- `mutiwindow-task-completed`：触发 L38481/L43640/L43676/L43697/L44406；监听 L31428 → `Ev()`(L42883) rescan。坐实 ✅（已在 10 文档细化）。
- `mutiwindow-update-task-meta`：触发 @L41032（`detail:{taskId, mediaMeta}`）；监听 @L43764 回调 @L43740-43762 合并 `mediaMeta`（宽高/时长）并 `J_` 持久化（setTimeout 1e3）。辅助解析 `I_`@L40988。坐实 ✅。
- `resourceAdded`：触发源为 background/service worker（非 App.js 内部字面 dispatch），App.js 内仅在 L43527 作 chrome.tabs 监听消费。坐实 ✅（与 10 文档一致：属单窗口素材迁移，非跨窗口广播）。
- `canvas-state-change`：非字面 CustomEvent，实为 `Q.saveCanvasStateWithVersion` 直接调用（见 ARCHITECTURE，05 X4 已记）。坐实 ✅。

## 4. 门4 对抗结论
- X3 原"Hr/vv 双固定常量+开关无效"假设**错误**，`Hr` 是动态解析；修正后 P0 残留收窄为「false 模式无服务承接的配置死路」。
- X2/X4 全部接缝 file:line 经 grep 坐实，无新阻断项。
- 红线§3.3.9 复查：所有跨模块通知走 `window` CustomEvent 或 `Q` 直接调用，**未绕过 StorageManager(`Q`)** ✅。

## 5. 门3 校验增量
新增/修正引用（`config.js` L12-18/L36/L39/L42-44、`Hr`@L1732、`vv`@L42808、`xv`@L42821/L42827、`Sv`@L42838、`mutiwindow-update-task-meta`@L41032/L43764、`I_`@L40988）均经 grep/read_file 坐实 ✅。
