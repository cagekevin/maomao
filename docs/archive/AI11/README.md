# 猫猫AI画布 · 审计整理索引（AI11 工作区）

> **本目录为审计专属工作区**。所有产物仅存放于 `docs/AI11/`，不污染 `docs/` 根与其他目录、不修改 `AI01`–`AI10` 任何文件。
> 审计对象：当前运行的 **V1 引擎**（`src/_engine/App.js` 等），V2 已暂停不纳入。
> 方法：遵循 `CLAUDE.md` 红线 + `TASKS.md` 五关流水线；每条事实 grep 坐实并过机器校验（门3）。
> 快照日期：**2026-07-21**（行号会漂移，文档内引用以「L行号 + grep 复核」为准）。

---

## 审计原则（红线对齐）

1. **只出文档，不改代码**：未修改 `App.js` / `config.js` / `dist/` / `localTool` / 网关 任何源码。
2. **锚点门**：每条事实带 `file:line`，且经 `search_content` + `read_file` 在源码坐实；映射表未收录的不猜测，先补建议记录再写。
3. **映射表是唯一可信锚层**：`func-mapping.txt` / `var-mapping.txt` 为权威字典；本工作区发现的补录仅在 `07` 列建议，**不回写原表**。
4. **核心发现**：App.js 存在**同名遮蔽**（`Xr`/`Zr`/`Jn`/`we`/`Q` 等各有模块级/组件局部/vendor 导入多个身份），旧文档据此产生错锚点，详见 `07`（已按 import 映射 `App.js L3` 复核更正）。

---

## 文件清单（本工作区）

| 文件 | 内容 | 状态 |
|------|------|------|
| `00-审计计划与进度.md` | 本轮计划、范围、方法论、防污染约束 | ✅ |
| `01-映射表缺口复核.md` | T0 缺口自 grep 坐实 + 同名遮蔽陷阱 + 未收录名建议 | ✅ |
| `02-模块1-初始化与配置层.md` | 四段式：bootstrap/config 加载 + 边界契约 | ✅ |
| `03-模块2-本地数据层与Rescan.md` | 7 个落盘入口坐实 + P1/P2 排雷 + 修正 ARCHITECTURE 错锚 | ✅ |
| `04-模块3-AI生成与网关层.md` | 完整轮询落盘链路 + 红线§3.2 合规验证 | ✅ |
| `05-模块4-画布引擎与节点.md` | ReactFlow handler + 节点集 + `we` 第三处遮蔽证据 | ✅ |
| `06-交叉流审计.md` | T2.5 四条端到端流沿边界契约缝合 | ✅ |
| `07-文档纠错建议.md` | 给维护者的错锚点回填清单（不动权威文件） | ✅ |
| `08-启动与同步流审计.md` | bootstrap + 统一同步 effect(真实L44354) + GAS同步 + uploadFile双路径 | ✅ |
| `09-localTool与网关路由全量核对.md` | 后端端点全量坐实 + 模块→路由映射 | ✅ |
| `10-画布持久化与节点序列化审计.md` | 画布保存/加载 + ov/sv 白名单序列化 + nodeTypes 注册表 + Pr/Mr 身份修正 | ✅ |
| `11-3D导演台与存储后端审计.md` | Director3D 节点/面板 + 独立 Zustand store + 四后端职责矩阵 + 同步覆盖 bug | ✅ |
| `12-多窗口通信与生成调度审计.md` | mutiwindow-* 事件总线 + ar 故障转移 + sr/cr/Jn/tr 同名遮蔽澄清 | ✅ |
| `13-资源面板与导出发布流审计.md` | 资源 CRUD 后端路径 + 发布流 pv→Dg + 拖拽落盘一致性 | ✅ |
| `14-后端双基址与数据流一致性审计.md` | 消除 round5 待查项：vv(:18080) vs R(:9004) 分端口架构 | ✅ |
| `15-全局快捷键与剪贴板审计.md` | 主画布快捷键全集 + 节点/图片双剪贴板机制 + 跨窗口一致性 | ✅ |
| `校验脚本.cjs` | 门3 机器校验脚本（扫描本目录 md → 回源码核对） | ✅ |
| `校验报告-AI11.md` | 门3 结果：**224 锚点全过，0 失败** | ✅ |

---

## 关键结论（先说结果）

1. **前面轮次（AI02/AI04/AI05）的模块审计始终空转**；本轮实际落地了 T2.1–T2.4 与 T2.5 全部四个模块 + 交叉流 + 机器校验。
2. **旧文档错锚根因 = 同名遮蔽**：模块级 `Xr`@L1802(uploadToLocalTool) 被 func-mapping 误记为组件局部 openInTab@L43881；`Zr`/`Jn`/`we`/`Q` 同理。经 `App.js L3` import 复核，`Xr`/`Zr` 为本地定义、`Jn`@L89 为本地 SVG 组件（vendor `Jn` 已改名 `I`）、`Q`@L1476 为本地 StorageManager（vendor `Q` 已改名 `me`）、`we` 另有 vendor 导入版(`Tr as we`)。已逐一厘清并在 `07` 给回填清单。
3. **红线 §3.2 异步契约经实测合规**：AI 生成结果 `ii(u,{subfolder:'tasks'})` 落盘 18080（App L33049），不直用 CDN；`resourceAdded` 也补全绝对路径（L43548 仅 `${Hr}${url}` 拼接；真正的 `toAbsoluteFileUrl` 定义在 `localTool/src/routes/resources.ts#L31`，硬编码 18080）。

[2026-07-21 据 AI13 裁决表修订：toAbsoluteFileUrl 真身 localTool resources.ts L31，删 App.js L43462/L43548 旧锚]
4. **唯一真问题**在模块2：`we` 是组件局部非模块级；且「资源面板 URL 拖入」(@L29176) 不落盘，与 rescan 不清理 extension 孤儿叠加产生僵尸记录（TASKS P1-2 + P2-7），建议统一走 `Zr` 落盘。
5. **统一同步 effect 真实位置 L44354（非文档所记 L44246）**：L44246 实为「发送到左侧网站」的 DOM 操作；真实 effect 带 `Se.current` 防重入锁，落盘走 `useLocalTool.uploadFile`@L19098（hook 版），与 AI 生成走模块级 `ii`@L1888 形成**第三条同名遮蔽（uploadFile）**。
6. **后端路由全量坐实**：localTool 25 个端点（含文档遗漏的 `/api/tasks/batch-delete`）+ 网关 10 个端点，与 ARCHITECTURE 基本一致；模块→路由映射见 `09`。
7. **存储四后端身份厘清**：`wr`=localTool WASM、`Mr`=chrome.storage、`Nr`=localStorage、`Pr`=localforage。**模块1文档曾把 `Pr` 误记为 chrome.storage，已纠正（见 `10`/`07`）**。`saveCanvasState` 走双写（localTool+localforage）。
8. **节点序列化白名单**：`ov`(L42001)/`sv`(L42002) 控制工作流导出的字段过滤；复杂配置对象默认不导出。`nodeTypes: lg`(L37127) 注册 15 种节点，`textConcatNode`(L31137) 在注册表但不在 spawnable 菜单——潜在文档盲点。
9. **3D 导演台隔离性风险（新发现，P 级）**：Director3D 用独立 Zustand store(`$`)，**仅退出节点时把 `directorProject` 塞回 node data 才持久化**，中途刷新丢失编辑；且导演台内 AI 生成走 `kp`/`wd` 独立通道，不触发主画布 `mutiwindow-task-completed`。另发现**启动同步覆盖方向风险（P 级）**：`syncToLocalTool`(L1591) 逻辑为「仅当 chrome.storage(`Mr`) 有值才 `wr.set(e,t)` 覆盖 localTool」（`App.js L1594`）——若 localTool 数据比 chrome.storage 新，重启会被旧 chrome.storage 覆盖回退（见 11 §11.5 风险3）。建议回写 TASKS.md（待授权）。
10. **多窗口通信 = CustomEvent + localStorage 双通道**：跨窗口用 `mutiwindow-*` CustomEvent（注意拼写少一个 l），图片粘贴兜底走 `localStorage('mutiwindow-clipboard')`。完成事件 `mutiwindow-task-completed` 是 rescan 入库的统一触发器（L31426→`Ev()`）。
11. **生成调度同名遮蔽澄清（补 07）**：`Jn`@L89 实为 SVG Logo 图标组件（非生成！），`Jn`@L32490 才是图片生成核心；`tr`/`ar` 各含模块级 vendor(L846/L863) 与组件局部生成/调度(L34350/L34759) 两身份。`ar`(L34759) 是多模型故障转移调度器（`rr.current` 防重入，`va(t)` 候选列表）。
12. **资源与导出流合规**：资源 CRUD 全走后端（`Sv`/`wv`/`Tv`/`Ev` @L42838+，端点 `/api/resources/*`）；发布 `Dg('/workflow-apps/publish', pv(...))`@L42492 经 `Tg`(`Sg` 拼 URL) 走网关，非 CDN。文件/URL 拖入资源均经 `Zr`/`ii` 落盘；删除 `wv`(L42857) 仍仅删 DB 不删磁盘（P1-2 孤儿问题未解）。
13. **双基址架构澄清（round 6 消除待查项）**：`vv`=`LOCAL_ENGINE.base`=**:18080 (localTool)**（L42808+config L15），`R`/`$n`=网关 **:9004 (apimart-gateway)**（DEFAULT_GATEWAY_URL，L43212/config L59）。二者**故意分端口**：localTool 管 KV/文件/资源，网关管 AI 转发。所有媒体结果最终回写 :18080（红线 §3.2 合规），仅 AI 请求发 :9004。原 round5 "漂移"担忧**非 bug**，已降级为架构说明。
14. **发布路径真相**：`Dg('/workflow-apps/publish')`→`Sg`(L38213) 拼 `$n`(:9004)+`/api`+路径，目标网关，非 CDN。潜在用户误配风险（网关改填 :18080 致发布 404）与 `vv` 硬编码不随 `USE_LOCAL_ENGINE` 切换（远程模式隐患）记 T，非当前 bug。
15. **全局快捷键与双剪贴板（round 7）**：主画布 `Q/W/E` 加节点、`Ctrl/Cmd+Z/Y/A/C/D/G/L` 全集（L36920-36962）；节点复制 `jr`(L36129) 仅走 `navigator.clipboard`（**无 localStorage 兜底**），图片复制 `P`(L16362) 有 `localStorage('mutiwindow-clipboard')` 兜底——两套不对称（T 级待补）；导演台 `C/V/Z/Y` 走独立 store `$` 完全隔离（L28319/L22294）。

详见各模块文件与 `校验报告-AI11.md`。
