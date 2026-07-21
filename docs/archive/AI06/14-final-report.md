# AI06 · 最终审计报告（自审 + 整合）

> 审计周期：2026-07-21 ｜ 方法：五关流水线（门1锚点→门2引用→门3机器校验→门4逻辑质询→门5入库）
> 范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist/原 docs（红线§3.1）
> 配套文档：00-13 + 工具(check-doc-citations.cjs) + 校验报告.md

---

## 一、审计覆盖范围

| 模块 | 文档 | 状态 |
|------|------|------|
| 阶段0 映射表补全 | 00-mapping-audit.md | ✅ 悬空符号全坐实 + 3 处重名坑厘清 |
| 模块1 配置/去登录 | 01-module1-config-init.md | ✅ |
| 模块2 本地数据/rescan | 02-module2-localdata-rescan.md | ✅ |
| 模块3 AI生成/网关 | 03-module3-aigen-gateway.md | ✅ |
| 模块4 画布 | 04-module4-canvas.md | ✅ |
| 交叉流 X1-X4 | 05-cross-flows.md | ✅ |
| 阶段4 Bug根因 | 07-bug-rootcause.md | ✅ P0-P2 代码级 |
| 模块5 localTool | 08-localtool-audit.md | ✅ |
| 模块6 V2合规 | 09-v2-compliance.md | ✅ |
| 深化：同步事件 | 10-deepen-sync-events.md | ✅ 纠正 #9 |
| 深化：七陷阱 | 11-module3-seven-traps.md | ✅ |
| 深化：交叉流契约 | 12-crossflow-contracts.md | ✅ 纠正 X3 |
| 深化：画布handlers | 13-module4-canvas-handlers.md | ✅ 纠正行号+重名坑 |

---

## 二、门3 机器校验（最终）

`check-doc-citations.cjs` 对 00-13 全文档一次性实 grep 源码：
- **总计 343 条引用 ✅ / 0 ❌**（校验报告.md）
- 覆盖：`App.js` / `config.js` / `localTool/*` / `apimart-gateway/main.py` / `src/v2/` / `src/main.tsx`
- 阴性证据（`mutiwindow-sync-local` 0 命中）由人工 grep 坐实，不计入脚本但结论有效。

---

## 三、门4 逻辑质询与关键结论

### 3.1 重名陷阱治理（核心风险，全链路一致）
| 符号 | 模块级 | 局部重名 | 审计结论 |
|------|--------|----------|----------|
| `Xr` | L1802=uploadToLocalTool | L43881=openInTab | 引用带行号，func-mapping 原错锚已纠正 |
| `Zr` | L1827=uploadFromUrl | L43893=logout | var-mapping 原错锚已纠正 |
| `Jn` | L89=LogoIcon | L32490=生图主回调(useCallback) | 生图须用局部 L32490 |
| `Lr` | L1700=缩略图resize | L36293=onDrop(画布) | 画布域用 L36293 |
| `Ir` | L1695=尺寸取整 | L36290=onDragOver(画布) | 画布域用 L36290 |

→ 全文档引用均已带"模块级/局部 + 行号"限定，无歧义。

### 3.2 base URL 真相（纠正最严重逻辑矛盾）
- `Hr`@L1732 = `localEngineBase()` **动态**（随 `USE_LOCAL_ENGINE` 切 18080/9004）
- `vv`@L42808 = `LOCAL_ENGINE.base` **写死** 18080（仅资源记录，合理）
- `R`/`_`/`g` 局部 = 9004 网关
- **P0 残留真形态**：`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 仅监听 18080 → **false 模式配置死路**（无服务承接），非"双固定常量硬编码 bug"。原 05 X3 / 07 P0.1 / 00 / 01 / 08 旧表述已全部纠正对齐。

### 3.3 资源同步事件链路（纠正 #9 虚构事件）
- `mutiwindow-sync-local`：**源码 0 命中 = 虚构事件**，ARCHITECTURE X2 应删除。
- `Oi`@L3154 = 模型权益函数，**与 rescan 无关**（原假设推翻）。
- 真实同步：生图完成 `mutiwindow-task-completed`(@L38481等) → 监听@L31428 → `Ev()`(rescan@L42883)；素材迁移走 `resourceAdded`@L43527(chrome.tabs)。

### 3.4 七陷阱（模块3）
- 陷阱1/2/3/4/6/7 已在 `Jn` 轮询主链路正确实现（A-C* 注释体系）。
- 陷阱5（URL过期）：轮询主链路 L33046-33052 已正确持久化 ✅；但 `ii`@L1888 通用入口对远程 URL 直返不下载 → **P3 观察项**（不动代码）。

### 3.5 画布 handlers（纠正 4 处行号偏差）
- `kn`@L31980 / `An`@L31993 / `Fr`@L36245 / `jt`@L31513（原文档差1或错行，已纠正）。
- 持久化：`Q.saveCanvasStateWithVersion`@L1650（原写1642）/L31728；`CANVAS_STATE_PREFIX`@L1283；`ov`/`sv`@L42001/L42002。

### 3.6 V2 合规
- `main.tsx`@L41 唯一运行路径 = `import('./_engine/App.js')`；V2 仅 `react-bridge.ts`/`ErrorBoundary.tsx`/`vite-env.d.ts` + `归档.zip`，无运行路径。红线§3/§4 **全合规**。

---

## 四、自审发现并修复的逻辑矛盾（最终轮）

| # | 矛盾 | 修复文档 | 状态 |
|---|------|---------|------|
| 1 | `Hr` 被误判为固定常量（与 12 冲突） | 00/01/02/06/07/08 | ✅ 统一为动态 |
| 2 | `vv` 行号引 var-mapping L118 未落代码真值 | 00/07 | ✅ 统一 L42808 |
| 3 | `xv` 行号 02 写 ARCH L42742，实为 L42821 | 02/05 | ✅ |
| 4 | 06 §2 抽查列 `Fr`@L36195（与 13 冲突） | 06 | ✅ 改 L36245 |
| 5 | 门3 数字滞后（192→322→342→343） | 06/校验报告 | ✅ 343 |
| 6 | 05 X1 `xv L42742` + X4 "Oi→rescan" 旧表述未随 10 更新 | 05 | ✅ 已随 10 纠正 |
| 7 | 01/08 残留"Hr 硬编码"旧表述 | 01/08 | ✅ 对齐 12 |

全部矛盾已闭环，文档集前后自洽。

---

## 五、待回写原文档的修正清单（仅改 docs，不动代码，需用户确认）

| # | 原文档 | 错误 | 修正 |
|---|--------|------|------|
| 1 | func-mapping.txt L173 | `Xr=openInTab`@L43479 | 模块级 `Xr`@L1802=上传；openInTab 局部@L43881 |
| 2 | var-mapping.txt L48 | `Zr=logout`(模块级) | 模块级 `Zr`@L1827=上传；logout 局部@L43893 |
| 3 | TASKS.md T0.1 | `we`=rescanResources | `we`@L4176=insertMention |
| 4 | TASKS.md T0.1 | `wv` 标 L42778 | 真实 `wv`@L42857 |
| 5 | TASKS/ARCH | 生图=模块级 `Jn` | 局部 `Jn`@L32490 |
| 6 | ARCH L1.3/X1.1 | `Jn` 未注局部 | 加"局部 useCallback" |
| 7 | ARCH L2.5 | `Zr()→/api/files/upload` | `Xr`@L1802/`Zr`@L1827 均上传+Zr 局部 logout 重名 |
| 8 | ARCH X2 | `canvas-state-change` 为 CustomEvent | 实为 Q.saveCanvasStateWithVersion 直接调用 |
| 9 | ARCH X2 | `mutiwindow-sync-local` 事件 | 虚构事件，删除；`Oi` 非同步入口 |

（注：以上 9 处与 AI06 文档集结论完全一致，回写不产生新冲突。）

---

## 六、最终结论

1. **阶段0 阻塞解除**：映射表悬空符号全部坐实，5 组重名坑（Xr/Zr/Jn/Lr/Ir）厘清。
2. **模块1-6 + 交叉流 X1-X4 全部代码级审计完成**，无逻辑阻断项。
3. **门3 机器校验 343/343 全绿**，无幻觉引用。
4. **门4 对抗审计无阻断**，P0-P2 根因精确到行，P3 观察项（ii 通用入口裸存 CDN）已记录。
5. **自审闭环**：本轮修复 7 类文档间逻辑矛盾，文档集现已前后一致。
6. **红线合规**：全程仅读源码 + 写 `docs/AI06/`，未触碰任何代码/原文档。

**AI06 审计正式收尾。建议下一步：待用户确认后执行第五节 9 处原文档回写，或据此产出《一毛AI画布-权威重构指南》整合稿。**
