# AI06 · 深化审计：资源同步事件链路坐实（门4 质询 #9 收尾）

> 阶段：门4 对抗审计延伸 ｜ 方法：源码 grep 坐实（`search_content` + `read_file`）
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist（红线§3.1）。
> 配套：修正 `06-audit-summary.md` 第4节 #9 结论。

## 1. 待收尾质询（来自 06 第4节 #9）
> ARCHITECTURE X2 记录资源面板同步走 `mutiwindow-sync-local` 事件；TASKS/func-mapping 曾假设该同步经 `Oi`→rescan。

两处假设均需在源码坐实。

## 2. 坐实结果

### 2.1 `mutiwindow-sync-local` —— 虚构事件（源码 0 命中）
- `search_content mutiwindow-sync-local` 在 `src/` 全树 **0 匹配**。
- 全树 `mutiwindow-*` 事件实际清单（L 行号，`App.js`）：
  - `mutiwindow-open-schedule-settings` @L4883/L5828/L26348/L9518/L43774
  - `mutiwindow-open-builtin-settings` @L4922/L5867/L9518/L26385/L43774
  - `mutiwindow-images` @L16369/L16497/L36001/L36037（配 `localStorage` 键 `mutiwindow-clipboard` @L16376/L16503/L36034）
  - `mutiwindow-nodes` @L35918/L36111/L36139/L36970（跨窗口节点粘贴）
  - `mutiwindow-task-completed` @L38481/L43640/L43676/L43697/L44406 触发；监听 @L31428
  - `mutiwindow-update-task-meta` @L41032 触发；监听 @L43764
  - `mutiwindow-rerun-task` @L44343 触发；监听 @L36618
  - `mutiwindow-clipboard`（localStorage 值键，非事件）
- **结论**：`mutiwindow-sync-local` 不真实存在，ARCHITECTURE X2 该事件名应删除。

### 2.2 `Oi` —— 模型权益函数，与资源同步无关
- `function Oi()` @L3154：`return [...xi];`（`xi` = 模型权益列表），被 `ki`(L3157)/`Ai`(L3177)/`ji`(L3181) 用于权益校验；调用点 L40697、L45239（`Oi(true)`）。
- **结论**：`Oi` 是模型/权益层函数，**不是**资源 rescan 同步入口。原"走 `Oi`→rescan"假设错误，应纠正为"与 rescan 无关"。

### 2.3 真实资源面板同步链路（门4 质询的权威答案）
资源/素材统一入库依赖两条独立链路，**均不经 `mutiwindow-sync-local` 或 `Oi`**：

**A. 生图完成 → 后端 rescan（跨窗口任务归一）**
- 触发：`mutiwindow-task-completed` CustomEvent @L38481/L43640/L43676/L43697/L44406（任务完成时派发，含 `nodeId`）。
- 监听：`useEffect` @L31428 注册 `mutiwindow-task-completed` 监听器。
- 消费：@L31426 `i === 'completed' && n && (Ev().then(...))` → 调 `Ev()`（rescan 主函数 @L42883，POST `/api/resources/rescan`）。
- 结果：后端 rescan 统一入库后，`Di.current()` 刷新素材 store。

**B. 网页素材迁移监听（chrome.tabs，非跨窗口同步）**
- 监听：`chrome.tabs.onUpdated`/`onActivated` @L43525，回调 `r` @L43526。
- 命中：`if (e.action === 'resourceAdded' && e.resource)` @L43527。
- 逻辑：按 `source==='local-tool'` 分流；`extension` 来源（网页直链/data:/http）先经 `Zr`(@L1827 uploadFromUrl) 下载到 `migrated/` 子目录本地化，失败整条丢弃（铁律注释 @L43535）；`local-tool` 来源直接走原逻辑。
- 注意：这是**单窗口素材入库迁移**逻辑，不是多窗口广播同步。

**权威结论**：资源面板的"同步"实为「生图任务完成事件触发 rescan」+「tabs 素材迁移监听」两条机制，**无 `mutiwindow-sync-local` 事件、`Oi` 不参与**。

## 3. 对 06 第4节 #9 的修正（回写建议）
| 原 #9 记录 | 修正后 |
|------------|--------|
| ARCHITECTURE X2 记 `mutiwindow-sync-local` 为资源面板同步事件 | 该事件源码 0 命中，应删除；真实同步经 `mutiwindow-task-completed`→`Ev()`(rescan@L42883) |
| 假设同步走 `Oi`→rescan | `Oi`@L3154 为模型权益函数，与 rescan 无关；假设不成立 |

## 4. 门3 校验增量
新增引用（本文档）均经 grep 坐实：
- `mutiwindow-sync-local` 0 命中（阴性证据，符合结论）
- `Oi`@L3154、`mutiwindow-task-completed`@L38481/L43640/L43676/L43697/L44406/L31428、`Ev`@L42883、`Zr`@L1827、`resourceAdded`@L43527、`chrome.tabs.onUpdated`@L43525 — 全部命中 ✅

> 注：阴性证据（`mutiwindow-sync-local` 0 命中）亦为有效审计结论，证明文档记录与代码不符。门3 脚本 `check-doc-citations.cjs` 仅校验正向硬字符串，阴性结论由本文人工 grep 坐实。

---

## 5. `ei` / `ti` 同名遮蔽风险（补录 · 据 AI13 裁决表专项）

> 补录依据：`docs/AI13/裁决表.md` 交叉验证裁决。AI05 断言「`var-mapping` 漏收前端三义」为最严重缺陷，经多 AI 回 `src/_engine/App.js` grep 实锤成立。以下五行均来自实锤，直接引用。

`ei` / `ti` 在源码中存在同名遮蔽，**五处绑定**，凡引用必带行号，否则混淆：

- `ei`@`App.js:L1853` `var ei = new Map()` —— 缩略图缓存 Map（模块级）
- `ei`@`App.js:L36784` `ei = Y.useCallback(...)` —— 节点打组（局部 useCallback）
- `ei`@`App.js:L43950` `ei = async () =>` —— GAS pushToCloud（局部 async）
- `ti`@`App.js:L36822` `ti = Y.useCallback(...)` —— 清缓存（局部 useCallback）
- `ti`@`App.js:L43974` `ti = async () =>` —— GAS pullFromCloud（局部 async）

**风险强调**：`var-mapping` 只收 GAS 两义（`ei`@L43950 pushToCloud、`ti`@L43974 pullFromCloud），**漏收前端三义**（`ei`@L1853 缩略图缓存、`ei`@L36784 节点打组、`ti`@L36822 清缓存）。在资源同步/缓存链路审计中，若仅按 var-mapping 引用 `ei`/`ti`，极可能把「缩略图缓存 Map」或「节点打组」误判为「GAS 云同步」，或反之。**引用 `ei`/`ti` 必带行号**，否则四类语义互相混淆，AI05「最严重缺陷」断言成立。

[2026-07-21 据 AI13 裁决表专项：补录 ei/ti 四义（L1853/L36784/L36822/L43950/L43974）]
