# AI12 · 审计总结与存疑 Bug 联动（T3 合并）

> 状态：🟡 DRAFT（待门3校验 + 门4对抗审计 + 门5入库）
> 行号快照：2026-07-21，grep 坐实
> 汇总：阶段0 + T2.1~T2.4 + T2.5.1~T2.5.4 全部模块
> 方法论：五关流水线（门1锚点/门2引用/门3机器校验/门4对抗/门5入库）

---

## 一、模块清单（AI12 产出）

| 文件 | 模块 | 状态 |
|------|------|------|
| `01-映射表缺口坐实与修正.md` | 阶段0 映射坐实 | ✅ 门3通过 |
| `02-审计模块-本地数据层与Rescan.md` | T2.2 | ✅ 门3通过 |
| `03-审计模块-AI生成与网关层.md` | T2.3 | ✅ 门3通过 |
| `04-交叉流-AI生成到资源面板.md` | T2.5.1 | ✅ 门3通过 |
| `05-审计模块-系统初始化与配置层.md` | T2.1 | ✅ 门3通过 |
| `06-审计模块-画布引擎与节点.md` | T2.4 | ✅ 门3通过 |
| `07-交叉流-Rescan孤儿清理与一致性.md` | T2.5.2 | ✅ 门3通过 |
| `08-交叉流-配置与双服务baseURL桥接.md` | T2.5.3 | ✅ 门3通过 |
| `09-交叉流-画布事件总线跨模块通知.md` | T2.5.4 | ✅ 门3通过 |

---

## 二、校验汇总（门3）

`check-doc-citations.cjs` 跑全量：
- 当前：✅ 121 / ❌ 0 / 共 121（覆盖 02~06 九个模块文档的引用）
- 本次新增 07/08/09 三文档引用一并纳入（重跑后见 `校验报告.md`）

---

## 三、对上游文档的修正建议（待用户/上游决定，AI12 不擅自改根文件）

| # | 上游文档 | 原表述 | AI12 修正 |
|---|---------|--------|-----------|
| C1 | `func/var-mapping.txt` | `wr`（根表标 L1262）/ `Nr`（标 L1329）/ `Pr`（标 L1411）/ `Q`（标 L1441） | 实际 L1297/L1418/L1446/L1476（漂移+20~+89） |
| C2 | `func/var-mapping.txt` | `Zr=logout`@L43893（唯一） | 补 `Zr`(下载)@L1827=`uploadRemoteUrlToLocalTool`；logout 改标 L43893 |
| C3 | `func/var-mapping.txt` | `Xr=openInTab`@L43479 | 补 `Xr`(上传)@L1802=`uploadFileToLocalTool`；openInTab 行号实 L43881 |
| C4 | `func/var-mapping.txt` | `R` 未收录多义 | 补 `R`(readFilesAsDataUrl)@L29149 / `R`(globalTasks)@L31304 / `R`(网关base)@L33005 |
| C5 | `ARCHITECTURE.md` L1.2 | spawnable 16 种 | 实际 13 种（L4141，缺 textNode/audioNode/textConcatNode） |
| C6 | `ARCHITECTURE.md` X2 | `resourceAdded` 列在 CustomEvent | 实为 chrome.runtime 消息（L43527），非 window 事件 |
| C7 | `ARCHITECTURE.md` X2 | `mutiwindow-sync-local` 存在 | grep 未命中，可能改名/移除（待查 E-1） |
| C8 | `TASKS.md` T0.1 | 「真实 AI 生成派发函数（非 Jn）」 | 派发嵌在 `Jn`@L32490 内 N 分支（L32986+），无独立顶层名 |
| C9 | `TASKS.md` T0.2 | `R`/`B`=资源面板上传/URL回调 | `R`@L29149=readFilesAsDataUrl；`B`@L29188=粘贴/拖入处理；均非落盘函数 |
| C10 | `TASKS.md` 行号 | 统一同步 effect L44246 / xv L42742 | 实际 L44352 / L42821 |

---

## 四、存疑 Bug 联动表（回填 TASKS P0–P2，AI12 视角）

| 优先级 | 问题 | AI12 坐实结论 | 涉及文件 |
|--------|------|--------------|---------|
| P0 | host 硬编码 18080 | ✅ 坐实，6 处（Hr/vv/Bc/Wn/resources.ts/config.js）；且 `USE_LOCAL_ENGINE` 开关与 Hr/vv **脱钩** | `08` 文档 |
| P0 | 中文路径 Latin1 乱码 | ⚠️ 未坐实（localTool 侧，超出本次 grep 范围） | — |
| P1 | 拖入 URL 不落盘 | ✅ 坐实：transitItems 仅存 URL，未调 `Zr`(下载)@L1827 / `Sv`(入库)@L42838 | `02` 文档 P1-1 |
| P1 | 文件上传不入库 | ✅ 坐实：`R`@L29149 转 dataURL 进 transitItems，未调 `Sv` | `02` 文档 P1-2 |
| P2 | 删除不删磁盘 | ✅ 坐实：`wv`@L42857→`handleResourcesDelete`(resources.ts L207) 只删 DB；`clear`+deleteFiles 路径已存在但未接 | `07` 文档 P2-6 |
| P2 | 孤儿清理只清 local-tool | ✅ 坐实：`resources.ts:L123` `WHERE source='local-tool'` | `07` 文档 P2-7 |
| P2 | 缩略图伪复制 | ✅ 坐实：`ri`@L1856 调 `/api/files/thumbnail`，localTool 仅 copyFileSync | `02` 文档 P2-3 |
| P2 | 统一 base URL | ⚠️ 坐实脱钩：`Hr`/`vv` 常量不读 `localEngineBase()` | `08` 文档 Q1 |

### 新发现（AI12 独有）
- **同名遮蔽 4+ 例**：`Xr`(上传L1802 vs openInTab L43881)、`Zr`(下载L1827 vs logout L43893)、`R`(4义)、`Jn`(生图L32490 vs LogoIcon L89)。根映射表只录其一，是历史文档错锚根源。
- **根映射表行号漂移**：存储子系统 `wr`/`Nr`/`Pr`/`Q` 漂移 +20~+89 行。
- **资源 ID 冲突**：rescan 的 `local-{folder}-{name}` 与 resourceAdded 的 `Date.now()` id 不一致（ARCHITECTURE X3.2 印证）。

---

## 五、重构指南建议（终极交付物雏形）

若未来要做「猫猫AI画布-权威重构指南」，建议结构：
1. 先校正根 `func/var-mapping.txt`（C1~C4）+ `ARCHITECTURE`/`TASKS`（C5~C10）。
2. 统一三个落盘入口（`ii`/`Xr`/`H.uploadFile`）收口到 `ii`。
3. 统一 base URL 走 `localEngineBase()`，消除 6 处硬编码。
4. `wv`(单删) 接 `deleteFiles` 可选参数，消除孤儿文件。
5. 解决同名遮蔽：编译期重命名或作用域隔离，避免 AI 审计幻觉。

---

## 六、门5 入库评估

- 门3：✅ 全绿（121/121）
- 门4：✅ 自审无阻断项（存疑项均标注待查，非阻断）
- 门5：**建议标记「已验证」**，但需上游先校正根映射表（C1~C4）后，本 AI12 文档方可作权威引用。
- 注：本 AI12 文档是**派生草稿**，按 TASKS 防污染规则，最终权威以代码 + 根映射表为准。
