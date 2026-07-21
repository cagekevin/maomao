# 猫猫画布 · 反编译巨兽架构审计（AI01 工作区）

> 本目录为 `TASKS.md` 架构审计计划的阶段 0–2.5 产出（_DRAFT 状态，待后续 AI 审计 + 门3机器校验 + 对抗审计转正）。
> 所有文件仅放 `docs/AI01/`，未改动 `App.js`/`config.js`/`localTool/*`/`dist/` 等任何源码。
> 行号快照：2026-07-21，会漂移，引用以「grep 确认当前行号」为准。

---

## 文件清单

| 文件 | 内容 | 阶段 |
|------|------|------|
| `映射表补全记录.md` | 阶段0 T0.1/T0.2 符号坐实 + 旧文档纠偏（Jn重名、R/B局部、Zr/Xr语义）；其中 Xr/Zr 最终结论以 `符号冲突深度核查_DRAFT.md` 问题2/5 为准（本文件已回填对齐） | 阶段0 |
| `T2.1_系统初始化与配置层_DRAFT.md` | 模块1：Oa/Jh/Ba/ar/tr/Nr/Pr/jr/Cr + config.js 全量 | 阶段2 |
| `T2.2_本地数据层与Rescan_DRAFT.md` | 模块2：ii/Xr/ri/Sv/wv/Ev/xv/we + P1/P2 缺陷真因 | 阶段2 |
| `T2.3_AI生成与网关层_DRAFT.md` | 模块3：Jn生图主回调/轮询7陷阱/统一同步effect + 网关路由 | 阶段2 |
| `T2.4_画布引擎与节点_DRAFT.md` | 模块4：Lr/xn/Cn/wn/Fr/Th + 节点类型 + Z语义冲突 | 阶段2 |
| `T2.5_交叉流审计_DRAFT.md` | 阶段2.5：X1生成落盘/X2 rescan/X3双服务URL/X4事件总线/X5防死循环 | 阶段2.5 |
| `T2.6_pending_confirmation卡死审计_DRAFT.md` | 阶段2补充：`requestConfirm`/`makeConfirmAdapter` 0 调用 + `confirmTaskId` 0 读取 → 确认 UI 缺失，死锁 bug 坐实 | 阶段2 |
| `T2.7_Director3DNode深挖_DRAFT.md` | 阶段2补充：`Th`(L28388–28509) 函数体展开 + 缩略图 `ii` 落盘弱耦合 + `wh`/`Kn` 待补 | 阶段2 |
| `T2.8_双服务URL与USE_LOCAL_ENGINE_DRAFT.md` | 阶段2.5补充：X3 双服务 base + `Hr` 受开关切换 → false 时 `/api/files/upload` 错配 9004 失败（P2） | 阶段2.5 |
| `T2.9_资源面板上传未落盘_P1_DRAFT.md` | 阶段2补充：P1 根因坐实 — `z`(L29159)/`B`(L29188)/paste 仅 `O` 塞内存、`R`(L29149) FileReader，全程无 `ii`/`Sv`/`Ev` 落盘 | 阶段2 |
| `T2.10_wh与In图片盒子深挖_DRAFT.md` | 阶段2补充：`wh`(L28276)/`In`(L32009→`qn` L32370) 展开；3D 截图 dataURL 直进 imageBoxNode 未落盘（P1 同源） | 阶段2 |
| `T2.11_3D导演台全链路闭环_DRAFT.md` | 阶段2补充：`$d`(L24391)/`Sh`(L28112) 展开 → 3D 导演台 `Th→wh→$d→Sh`+`qn` 全链路闭环，局部符号全干净、无重名冲突 | 阶段2 |
| `T2.12_核心节点li_Ya_Qa深挖_DRAFT.md` | 阶段2补充：ImageNode/PromptNode/TextNode 展开；`imageUrlRef`+`Q.getConfig` 原图分离持久化机制；闭合符号冲突 Z/Zr | 阶段2 |

> 注：`check-doc-citations.cjs`（门3机器校验脚本）按用户要求**未再使用/运行**，保留备用。

---

## 已坐实的关键事实（高置信，已回函数体）

1. `Oa`(L3543) = 去登录核心，永远返回 `local-mode-token`
2. `Ev`(L42883)=rescan、`Sv`(L42838)=资源save、`wv`(L42857)=删(只DB)、`xv`(L42821)=查、`ii`(L1888)=上传落盘
3. `Jn` 有**两个重名不同物**：L89 `Jn=LogoIcon`（组件）、L32490 `Jn=生图主回调 useCallback`
4. 生图轮询 7 陷阱（FUNCTION_MAP §2.1）在 L32988–L33069 **已代码覆盖**
5. 统一同步 effect 真实位置 **L44354–L44425**（非 FUNCTION_MAP 记的 L44246），含 `Se.current` 防死循环锁
6. `mutiwindow-task-completed` 在 L31426/L43640/L44406 多处 dispatch

---

## 待后续 AI 审计确认的开放问题（高优先）

1. **`Z` 语义冲突**：func-mapping L113 记 `Z`=创建节点(L36215)，但 L21 记 `Z`=StorageKeys（且 `Cr` 用 `Z.CANVAS_STATE_PREFIX` 已坐实）。创建节点真实函数名需 grep 重查，以 `Z`=StorageKeys 为准。
2. **`Xr` 语义冲突**：func-mapping L173 记 `Xr=openInTab`(L43479)，但 L1802 `Xr` 是 `ii` 内部上传落盘核心。需确认 L1802 与 L43479 是否同一函数。
3. **`we` 三处重名**：L36253(画布坐标转换)/L43015(资源rescan+查询)/L4176(@mention插入) —— grep 必带行号+作用域。
4. **`R`/`B` 局部重名**：资源面板区(L29149 `R`=FileReader读文件、L29159 `z`=上传回调调R、L29188 `B`=拖放) ≠ 3D导演台属性面板区(L23247 `R`=zoom拖拽、L23258 `B`=目标模式切换)。TASKS P1「R 回调不入库」真实锚点是局部 `z`(L29159) 整条上传链路(`z`/`B`/paste)只 `O(...)` 写内存、未调 `ii`/`Sv`/`Ev`（见 T2.9），非模块级 R；`R`/`B` 均组件局部、随组件隔离，不可作模块级符号。
5. **`pending_confirmation` 卡死**：~~需确认网关 AUTO_CONFIRM 默认值与前端是否一致~~ → **已闭合（见 `T2.6`）**：网关默认 AUTO_CONFIRM=true(L34) 仅减少触发；前端 `requestConfirm`/`makeConfirmAdapter` 全文件 0 调用、`confirmTaskId` 等 0 读取 → 确认 UI 完全缺失，是独立死锁 bug（PROJECT_LOG 已记"未修"）。
6. **P1 修复点**：~~资源面板 `z`(L29159) 上传成功后补 `Sv()`/`rescanThrottledSync()`~~ → **已闭合（见 `T2.9`）**：`z`(L29159)/`B`(L29188)/paste(L29168) 全程只 `O`(面板 setState) + `R`(L29149 FileReader→base64)，**无 `ii`/`Sv`/`Ev` 任何落盘调用**；对比画布侧 `Lr`/`onPaste`/文件节点均调 `ii` 落盘 → 面板上传图片仅内存、刷新即丢。修复须单独立项 + 红线 §3.3 第10条确认。
7. **X3 双服务 URL**：~~`USE_LOCAL_ENGINE=false` 时 `Hr`=9004 但 `/api/files/upload` 仅 18080 有路由 → 文件失败（P2 根因）。当前 true 不触发~~ → **已闭合（见 `T2.8`）**：`Hr`(L1732)=localEngineBase()，开关 true→:18080 / false→:9004；网关 :9004 无 `/api/files/upload`（仅 `/v1/uploads/images` 走 Lovart CDN），故 false 时 `ii`/`Xr`/`Zr` 上传全失败；且 `useLocalTool`(L19102) 硬编码 18080 不受开关影响 → 撕裂态。当前 true 不触发，P2 脆弱点。

---

## 红线遵守声明

- 本工作区**只产出文档**，未修改任何源码（`App.js`/`config.js`/`localTool/*`/`dist/` 均原样）。
- 未回写 `func-mapping.txt`/`var-mapping.txt`（按用户要求留给后续审计确认后做）。
- 所有锚点带行号，引用以实际 grep 为准；未基于猜测名推理。
- 未触碰 V2（永久暂停归档）。

---

## 后续步骤建议（交用户/后续 AI）

1. 后续 AI 逐模块跑门3机器校验（用 `check-doc-citations.cjs`，本会话已验证可用）出 `校验报告.md`
2. 对抗审计：就「开放问题」逐条 grep 代码给出证据，修正本 DRAFT
3. 全绿后：T0.3 回写映射表 → 模块从 `_DRAFT` 标「已验证」并入终极文档（T3.1）
4. 修复 P0/P1/P2 须单独立项，经用户确认 + 红线 §3.3 第10条首句确认
