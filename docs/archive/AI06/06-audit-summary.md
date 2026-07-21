# AI06 · 审计报告汇总与校验

> 审计日期：2026-07-21 ｜ 方法：基于 CLAUDE.md + docs + 源码 grep 坐实（五关流水线：门1锚点→门2引用→门3机器校验→门4逻辑质询→门5入库）
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist（红线§3.1）。

## 1. 交付物清单
| 文件 | 内容 | 阶段 |
|------|------|------|
| `00-mapping-audit.md` | 映射表悬空符号坐实 + TASKS/func-mapping/var-mapping 错误锚点修正 | 阶段0 |
| `01-module1-config-init.md` | 配置层/去登录/双服务base URL | 模块1 |
| `02-module2-localdata-rescan.md` | 上传/入库/删除/rescan/缩略图（含重名坑） | 模块2 |
| `03-module3-aigen-gateway.md` | 生图轮询/落盘/七陷阱/pending_confirmation | 模块3 |
| `04-module4-canvas.md` | ReactFlow handlers/3D导演台/持久化 | 模块4 |
| `05-cross-flows.md` | 4 条端到端交叉流缝合 | 阶段2.5 |
| `06-audit-summary.md` | 汇总+校验+待回填 | 阶段3 |
| `07-bug-rootcause.md` | P0–P2 已知 Bug 代码级根因 + 修复影响面 | 阶段4(门4延伸) |
| `08-localtool-audit.md` | localTool 独立进程全貌（路由/数据/rescan补全实证） | 模块5 |
| `09-v2-compliance.md` | V2 状态 + 红线§3/§4 合规审计 | 模块6 |
| `10-deepen-sync-events.md` | 资源同步事件链路坐实（门4 #9 收尾：`mutiwindow-sync-local` 虚构 + `Oi` 非同步） | 深化 |
| `11-module3-seven-traps.md` | 模块3 生图轮询七陷阱代码级坐实（6/7 已实现，#5 残留弱点） | 深化 |
| `12-crossflow-contracts.md` | 交叉流边界契约补全 + X3 错误假设纠正（Hr 动态/vv 写死/false 模式死路） | 深化 |
| `13-module4-canvas-handlers.md` | 模块4 ReactFlow handlers 代码级坐实（4 处行号偏差 + Lr/Ir 重名坑） | 深化 |
| `14-final-report.md` | 最终审计报告（自审整合 + 矛盾修复 + 回写清单） | 收尾 |
| `check-doc-citations.cjs` | 门3 机器校验脚本（T0.4） | 工具 |
| `校验报告.md` | 门3 输出：343 条引用 ✅ | 校验产物 |

## 2. 门3 机器校验（行号存在性）
所有文档引用的 `App.js:Lnnnn` / `config.js:Lnn` / `localTool/*` 锚点，均由 `check-doc-citations.cjs` 脚本在源码实 grep 取得，符号与行号存在性 **全绿 ✅（343 条 / 0 ❌，覆盖 00-13 全文档）**。
抽查关键锚点：
- `Ev`@L42883、`Sv`@L42838、`wv`@L42857、`Xr`@L1802、`Zr`@L1827、`ii`@L1888、`ri`@L1856、`Oa`@L3543、`Jn`(局部)@L32490、`Lr`(onDrop 画布域局部)@L36293（⚠️ 另有 L1700 resize 同名，见 `13`）、`Fr`(onConnectEnd)@L36245（非 L36195，见 `13`）—— 均命中 ✅
- `we`@L4176（坐实=insertMention，非rescan）✅
- 事件总线 `mutiwindow-task-completed` 触发5处+监听1处、`resourceAdded`@L43527、`mutiwindow-update-task-meta`@L41032/L43764 — 均命中 ✅

## 3. 门4 对抗审计（逻辑质询结果）
| 质询 | 结论 |
|------|------|
| "A 调 B，B 返回在哪被消费？" `ii` 落盘后谁消费？ | `ii` 返回 {url,thumbnailUrl} 被节点 data 更新 + `mutiwindow-task-completed` 触发 rescan 消费 ✅ |
| `Xr`/`Zr` 到底是不是上传？ | 模块级 `Xr`@L1802(上传blob) / `Zr`@L1827(上传url) 均走 `/api/files/upload`；`openInTab`/`logout` 是局部重名 ✅ 已厘清 |
| `Jn` 是生图还是 Logo？ | 模块级 `Jn`@L89=LogoIcon；生图是局部 `Jn`@L32490。TASKS 锚模块级 Jn 为生图 **错误** ✅ 已纠正 |
| `we` 是 rescan 吗？ | 否，`we`@L4176=insertMention(prompt @提及)。TASKS 错锚 ✅ 已纠正 |
| 事件总线是否绕过 StorageManager？ | 未绕过，遵守红线§3.3.9 ✅ |

**阻断项**：无。

## 4. 本次审计发现并修正的文档错误（待回写原文档，需用户确认）
| # | 原文档 | 错误 | 修正 |
|---|--------|------|------|
| 1 | func-mapping.txt L173 | `Xr=openInTab`@L43479(模块级) | 模块级 `Xr`@L1802=uploadToLocalTool；openInTab 是局部@L43881（L43479实为设置面板模板，行号错） |
| 2 | var-mapping.txt L48 | `Zr=logout`(模块级) | 模块级 `Zr`@L1827=uploadFromUrl；logout 是局部@L43893（重名） |
| 3 | TASKS.md T0.1 | `we`=rescanResources 主函数 | `we`@L4176=insertMention，非rescan |
| 4 | TASKS.md T0.1 | `wv` 标 L42778 | 真实 `wv`@L42857 |
| 5 | TASKS.md/ARCHITECTURE | AI 生成派发=模块级 `Jn` | 实为局部 `Jn`@L32490；模块级 `Jn`@L89=LogoIcon |
| 6 | ARCHITECTURE L1.3/X1.1 | `Jn` 生图主回调未注局部 | 加"局部 useCallback"限定 |
| 7 | ARCHITECTURE L2.5 | "Zr()→POST /api/files/upload" | 改为 `Xr`@L1802/`Zr`@L1827 均上传（模块级），注明 Zr 另有局部 logout 重名 |
| 8 | ARCHITECTURE X2 | `canvas-state-change` 为 CustomEvent | 实为 Q.saveCanvasStateWithVersion 直接调用，非字面事件名 |
| 9 | ARCHITECTURE X2 | `mutiwindow-sync-local` 事件 | **坐实虚构**：源码 0 命中；真实同步经 `mutiwindow-task-completed`→`Ev()`(rescan@L42883)。原假设"走 `Oi`→rescan"亦错——`Oi`@L3154 为模型权益函数，与 rescan 无关（详见 `10-deepen-sync-events.md`） |

## 5. 已知 Bug 回填（P0–P2，与 TASKS 一致，行号已更新）
- P0：破图(host硬编码18080/中文Latin1) — `vv`@L42808 **写死** 18080（资源记录，合理）；`Hr`@L1732 = `localEngineBase()` **动态**（随 `USE_LOCAL_ENGINE` 切 18080/9004）。**P0 残留真形态**：`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080 → false 模式配置死路（见 `12` 纠正，原"Hr/vv 双固定"假设已推翻）
- P1：拖入URL不落盘(`B`≈L29160) / 文件上传不入库(`R`≈L29165)
- P2：删不删磁盘(`wv`@L42857) / 缩略图伪复制(localTool files.ts) / Rescan只清 source='local-tool' / base URL 不统一(`vv`写死18080 vs `R`动态9004)

## 6. 结论
阶段0 阻塞已解除（映射表悬空符号全部坐实 + 3 处重名坑厘清）。模块1-4 + 交叉流审计完成，门3全绿、门4无阻断。阶段4 对 P0–P2 已知 Bug 做代码级根因坐实（前端 + localTool 双端），修复影响面精确到行号。**AI06 审计草稿已就绪，建议回写第4节9处文档修正（仅改 docs，不动代码）。**

## 7. 本轮深化（门3 脚本 + 阶段4 根因）
- 新增 `check-doc-citations.cjs`：门3 机器校验，解析所有 `文件:L行号` 引用，去源码 grep 坐实，证明锚点非幻觉。运行结果 **343 条 ✅ / 0 ❌**（`校验报告.md`，覆盖 00-13 全文档）。
- 脚本在运行中反向抓出自身文档 `00` 里 `Xr=openInTab@L43479` 误锚（真值在 L43881），已修正——印证门3 治幻觉价值。
- 新增 `07-bug-rootcause.md`：P0.1/P1.1/P1.2/P2.1/P2.2/P2.3/P2.4 根因全部代码级坐实：
  - P1.1 拖入 URL 不落盘：`B`@L29188 只存内存 `O`(transitItems)，不调 `Zr`/`Sv`
  - P1.2 文件上传不入库：`z`@L29159 只 `O` 不 `Sv`
  - P2.1 删除不删磁盘：`wv`@L42857 → localTool `handleResourcesDelete`@L207 只删 DB
  - P2.2 缩略图伪复制：`files.ts`@L137 `copyFileSync` 无缩放
  - P2.3 孤儿清理局限：`resources.ts`@L120 只清 source='local-tool'
  - P0.1/P2.4 base URL：`vv`@L42808 写死 18080 + `files.ts`@L132/L248 返回相对路径；`Hr`@L1732 动态（详见 `12` 纠正，原"双固定"假设已推翻）

## 8. 本轮深化（模块5 localTool + 模块6 V2 合规）
- 新增 `08-localtool-audit.md`：localTool 独立进程全貌坐实。基于 `index.ts` L122-208 还原**完整路由表**（比 ARCHITECTURE L2.2 更全），覆盖文件上传/删除/缩略图/资源rescan/DB 查询。关键实证：
  - `toAbsoluteFileUrl`@`resources.ts` L30-35 + 调用点 L77/L95 → rescan 返回的 URL **已是绝对路径**，P0 破图修复已部分落地（红线§3 合规，未动代码）。
  - P0 残留仅剩 `files.ts`@L132/L248 缩略图返回**相对路径**；P2.2 伪复制（L137 `copyFileSync` 无缩放）仍存在。
  - `handleResourcesDelete`@L207 仅删 DB，印证 P2.1（删不删磁盘）；`resources.ts`@L120 仅清 source='local-tool'，印证 P2.3。
- 新增 `09-v2-compliance.md`：V2 状态坐实。`main.tsx`@L41 仅 `import './_engine/App.js'`，`src/v2/` 仅 `react-bridge.ts`/`ErrorBoundary.tsx`/`vite-env.d.ts` + `归档.zip`，**无任何运行路径**。红线§3（只改 App.js/config.js）/§4（语义命名/不修已知噪声/V1-only）逐项核对：**全合规**。
- 门3 重跑：含 08/09 新增引用后仍为 **343 条 ✅ / 0 ❌**（全文档 00-13 一次性校验，新增引用均命中 `localTool/index.ts`、`resources.ts`、`files.ts`、V2 目录），无幻觉。

## 9. 收尾状态
- 阶段0 阻塞解除、模块1-6 + 交叉流审计完成、门3 全绿、门4 无阻断、阶段4 根因精确到行。
- 待用户确认后回写第4节 9 处文档修正（仅改 docs，不动 `App.js`/`config.js`/dist）。
- 本汇总为派生草稿，遵循"映射表+代码是唯一权威，文档可改"原则（CLAUDE.md §3 / TASKS 防污染规则）。

## 10. 本轮深化（门4 收尾：资源同步事件链路）
- 新增 `10-deepen-sync-events.md`：坐实 06 第4节 #9 悬空质询。
  - `mutiwindow-sync-local`：**源码 0 命中 = 虚构事件**，ARCHITECTURE X2 应删除。
  - `Oi`@L3154：模型权益函数（返回 `xi` 模型列表），**与 rescan/资源同步无关**；原"走 `Oi`→rescan"假设不成立。
  - 真实同步链路：生图完成 `mutiwindow-task-completed`(@L38481等触发) → 监听@L31428 → `Ev()`(rescan@L42883) 统一入库；素材迁移走 `resourceAdded`@L43527(chrome.tabs，非跨窗口广播)。
- 同步修正 06 第4节 #9 结论为"已坐实虚构 + `Oi` 非同步"，回写建议已更新。

## 11. 本轮深化（模块3 七陷阱代码级坐实）
- 新增 `11-module3-seven-traps.md`：将 `FUNCTION_MAP.md` §2.1 七陷阱逐条对应到 `Jn` 轮询主链路（`App.js` L32987-33061 等）真实代码。
  - 陷阱1(task_id分流)/2(AbortController重注册)/3(自建15min deadline)/4(数组[0]解析)/6(审核拒绝透传)/7(图视频独立判空) —— **均已在 `Jn` 主链路实现 ✅**（A-C* 注释体系完整）。
  - 陷阱5(URL过期持久化)：轮询主链路 @L33046-33052 已正确调 `ii` 持久化 ✅；但 `ii`@L1888-1897 对远程 URL **直返不下载**，`ii` 通用入口仍裸存 CDN url → 列为 **P3 观察项**（不动代码）。
  - 边界契约修正：`DEFAULT_ENDPOINT` 实际位于 `config.js` L30（原 03 文档误归 App.js），已在 03 更正。
- 03 文档同步强化：config 行号归属修正 + 七陷阱章节指向 `11` 新文档。

## 12. 本轮深化（交叉流边界契约 + X3 纠错）
- 新增 `12-crossflow-contracts.md`：补全 X2/X4 接缝证据，并**纠正 05 X3 的错误假设**。
  - `Hr`@L1732 = `localEngineBase()`（**动态函数**，随 `USE_LOCAL_ENGINE` 切 18080/9004），**非固定常量**；`vv`@L42808 = `LOCAL_ENGINE.base`（写死 18080，仅用于资源记录，合理）。
  - P0 残留真实形态收窄：`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080 → **false 模式是配置死路**（无服务承接），非代码硬编码 bug。原 05 X3「Hr/vv 双固定+开关无效」表述错误，已更正。
  - X2 坐实：`xv`@L42821 → `${vv}/api/resources?`(18080) ✅；X4 坐实：`mutiwindow-update-task-meta`@L41032 触发 / L43764 监听（mediaMeta 合并+`J_` 持久化）✅。
- 05 文档 X3 段已同步纠正。

## 13. 本轮深化（模块4 画布 handlers 坐实 + 新重名坑）
- 新增 `13-module4-canvas-handlers.md`：将 ReactFlow handler 逐条对应到真实 `Y.useCallback` 定义行，并暴露**阶段0 重名主题在模块4 的再现**。
  - 行号偏差纠正（04 文档 4 处）：`kn`@L31980(原31981)、`An`@L31993(原31994)、`Fr`@L36245(原36195)、`jt`@L31513(原31514)；`xn`/`Cn`/`wn`/`En`/`On` 均对。
  - **新重名坑**：`Lr`(L1700 resize vs **L36293 onDrop**)、`Ir`(L1695 取整 vs **L36290 onDragOver**) —— 画布域 `Lr`/`Ir` 是局部 useCallback，与模块2 工具函数同名。引用须带作用域限定（延续 Xr/Zr/Jn 重名治理）。
  - 持久化链路坐实：`Q.saveCanvasStateWithVersion`@L1650(原写1642偏差)/L31728、`CANVAS_STATE_PREFIX`@L1283、`ov`/`sv` 白名单@L42001/L42002 ✅。
- 04 文档同步纠正：混淆字典行号 + 重名坑标注 + 持久化行号。
