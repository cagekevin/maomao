# AI06 · 阶段 0：映射表补全与错误锚点修正记录

> 审计人：AI（基于 CLAUDE.md / docs / 源码 grep 坐实）
> 日期：2026-07-21
> 范围：坐实 `TASKS.md` §架构审计计划 T0.1/T0.2 标注 ⬜ 待补的悬空符号，并修正现有文档的错误锚点。
> 铁律：每条事实带 `src/_engine/App.js:Lnnnn`（行号快照 2026-07-21，会漂移，动手前重 grep）。
> 放置位置：仅 `docs/AI06/`，不写别处。

---

## 0. 结论速览

TASKS.md T0.1/T0.2 里标注"待补 / 疑似 / 待定"的符号，**本次已在源码中全部坐实**。核心纠正：

| 符号 | TASKS/旧文档的错误认知 | 源码坐实真身（带行号） | 结论 |
|------|----------------------|----------------------|------|
| `Ev` | rescan 触发器（待补） | `async function Ev()` @L42883 → POST `/api/resources/rescan` | ✅ `rescanResources`，已坐实 |
| `we` | rescanResources 主函数（L42834/L42980 误锚） | `we = (t,n)=>{…}` @L4176 → 提示词 `@提及` 插入 handler | ❌ **TASKS 错锚**：`we` 是 prompt 插入，非 rescan |
| `Sv` | 资源入库（疑似大写，待定） | `async function Sv(e)` @L42838 → POST `/api/resources/save` | ✅ `saveResource`，已坐实 |
| `wv` | 资源删除（L42778 误锚） | `async function wv(e)` @L42857 → POST `/api/resources/delete` | ✅ `deleteResource`；**真实行号 L42857，非 L42778** |
| `ii` | 落盘上传（疑似 ii/R，待补） | `async function ii(e,t={})` @L1888 → 统一上传入口，内部调 `Xr` | ✅ `uploadFile` 统一入口，已坐实 |
| `Xr` | openInTab（func-mapping @L43479，非上传） | `async function Xr(e,t={})` @L1802 → POST `/api/files/upload`（blob） | ❌ **func-mapping 冲突**：模块级 `Xr`@L1802 = 上传；`openInTab` 是**局部** `Xr`@L43881 |
| `Zr` | logout（var-mapping）/ 非下载（TASKS） | `async function Zr(e,t={})` @L1827 → POST `/api/files/upload`（fileUrl） | ❌ **重名冲突**：模块级 `Zr`@L1827 = `uploadFromUrl`；`logout` 是**局部** `Zr`@L43893 |
| `ri` | 缩略图缓存 Map（待补） | `async function ri(e,t={})` @L1856 → 缩略图缓存+并发锁，返回 thumbnailUrl | ✅ `getThumbnail`（内存缓存），已坐实 |
| `Jn`（生图） | 生图主回调（TASKS 锚 L32731） | `let Jn = Y.useCallback(async …)` @L32490 → 生图主回调 | ⚠️ **局部 useCallback，非模块级**；模块级 `Jn`@L89 = `LogoIcon`（func-mapping 正确） |

---

## 1. T0.1 解码结果（逐符号坐实）

### 1.1 `Ev` = rescanResources ✅
`src/_engine/App.js:L42883`
```js
async function Ev() {
  let e = await fetch(`${vv}/api/resources/rescan`, { method: `POST` });
  return e.ok ? (await e.json()).count ?? 0 : 0;
}
```
- 语义：触发 localTool 磁盘扫描 → resources 表。base URL 用 `vv`（=LOCAL_ENGINE.base=18080，代码真值 `vv`@L42808；原 var-mapping L118 为文档行号）。
- 调用方：统一同步 effect / `mutiwindow-task-completed` 监听（见 ARCHITECTURE X1.1/X2）。

### 1.2 `we` = 提示词 @提及插入 handler（**非 rescan**）❌ 纠正
`src/_engine/App.js:L4176`
```js
we = (t, n = false) => {
  let r = U.current, i = r?.textareaRef?.current || r;
  let o = `@${t} `;
  // 在 textarea 光标处插入 @提及
  ...
}
```
- 语义：在 prompt 节点 textarea 插入 `@{模型名}` 提及片段。与 rescan 无关。
- TASKS.md T0.1 把 `we` 标为 "rescanResources 主函数 (L42834/L42980)" 是**错误锚定**。真实 rescan 主函数是 `Ev`(L42883)。

### 1.3 `Sv` = saveResource（资源入库）✅
`src/_engine/App.js:L42838`
```js
async function Sv(e) {
  return (await fetch(`${vv}/api/resources/save`, { method:`POST`, ..., body: JSON.stringify(e) })).ok;
}
```
- 语义：POST `/api/resources/save`（upsert）。被 `Cv`(收藏切换)、资源面板写入消费。
- 注：`sv`（小写）是另一符号 = `nodeCallbackFieldSet`（var-mapping L178），**与 `Sv` 大小写区分**，TASKS T0.2 已留意。

### 1.4 `wv` = deleteResource（资源删除）✅ — 行号纠正
`src/_engine/App.js:L42857`
```js
async function wv(e) {
  return (await fetch(`${vv}/api/resources/delete?id=${encodeURIComponent(e)}`, { method:`POST` })).ok;
}
```
- **真实行号 L42857**，TASKS.md 标注的 `L42778` 是 UI 弹窗代码，非函数定义。已纠正。
- 语义：只删 DB，**不删磁盘**（P2，见 TASKS）。

### 1.5 `ii` = uploadFile 统一入口 ✅
`src/_engine/App.js:L1888`
```js
async function ii(e, t = {}) {
  if (typeof e == `string` && /^https?:\/\//i.test(e) && !e.startsWith(`data:`)) return { url: e }; // 远程 URL 直接返回
  let n = await Xr(e, { subfolder: t.subfolder ?? `canvas`, generateThumb: ..., thumbMaxDim, thumbQuality });
  return n ? { url: n.url, thumbnailUrl: n.thumbnailUrl } : ...;
}
```
- 语义：统一落盘入口。远程 https URL 不下载（直接返回）；blob/File 调 `Xr` 上传。被画布拖入(L36285)、粘贴(L36003)、AI 结果落盘(L44287/44377) 消费。
- 注：App.js 内另有 `uploadFile` useCallback（L19098，H.uploadFile 实例方法），是 `window.localTool` 后端封装；`ii` 是更上层的统一入口。两者不冲突，命名已区分。

### 1.6 `Xr` = uploadToLocalTool（**模块级 = 上传**，非 openInTab）❌ 纠正 func-mapping
`src/_engine/App.js:L1802`
```js
async function Xr(e, t = {}) {
  if (!(await Kr())) return null;
  let { blob: n, ext: r } = await qr(e);
  let i = t.filename || `${Qr(n.type)}_${Date.now()}_${$r()}.${r}`;
  let a = new FormData();
  a.append(`file`, n, i); a.append(`subfolder`, t.subfolder ?? `canvas`);
  let o = await fetch(`${Hr}/api/files/upload`, { method:`POST`, body:a });
  ...
  return s?.url ? { url:s.url, thumbnailUrl:s.thumbnailUrl, path:s.path } : null;
}
```
- 语义：blob/File → FormData → POST `/api/files/upload`，返回绝对 url。**这就是真正的上传函数**。
- **冲突说明**：func-mapping.txt L173 把 `Xr = openInTab @L43479` 收录为模块级，但源码里：
  - 模块级 `Xr` @L1802 = 上传（上述）；
  - `openInTab` 是**局部** `Xr = async e => {...}` @L43881（在头像菜单组件内，chrome.tabs.query）；
  - 还有 `xr`(小写, L1252) 是另一个函数。
  - 注：@L43479 实为设置面板 JSON 模板字符串（`Lr = \`{...}\``），**非 openInTab**，原 func-mapping 行号错。
- **结论**：func-mapping 把局部 `openInTab` 误当模块级 `Xr`。应以 L1802 模块级 `Xr` = `uploadToLocalTool` 为准。ARCHITECTURE L2.5 表里 "Zr()→POST /api/files/upload" 实际应改为 `Xr`/`Zr` 均走上传，需在 T4 修正。

### 1.7 `Zr` = uploadFromUrl（**模块级 = 从 URL 上传**）❌ 纠正 var-mapping
`src/_engine/App.js:L1827`
```js
async function Zr(e, t = {}) {
  if (!e || typeof e != `string` || !(await Kr())) return null;
  let n = new FormData();
  n.append(`fileUrl`, e); n.append(`subfolder`, t.subfolder ?? `canvas`);
  let r = await fetch(`${Hr}/api/files/upload`, { method:`POST`, body:n });
  ...
}
```
- 语义：接收 `fileUrl` → POST `/api/files/upload`（"发送到资源"拖入 URL 落盘走这里）。
- **重名冲突（关键）**：
  - 模块级 `Zr` @L1827 = `uploadFromUrl`（上传）；
  - `logout`/"重置配置" 是**局部** `Zr = async () => {...}` @L43893（头像菜单内，清本地数据）；
  - var-mapping.txt L48 把 `Zr = logout` 标为模块级 🟢 是**错误**的——它实为局部重名，模块级 `Zr` 是上传。
- **TASKS T0.2 纠正项**："Zr=logout 被旧文档当下载函数误用"——方向对，但根因是**重名**：模块级 `Zr` 本来就是上传（非下载），局部 `Zr` 才是 logout。归档时须注明 `Zr` 有两义，引用必带行号/上下文。

### 1.8 `ri` = getThumbnail（缩略图缓存）✅
`src/_engine/App.js:L1856`
```js
async function ri(e, t = {}) { /* 内存缓存 Map<TTL=300s> + 并发锁，返回 thumbnailUrl */ }
```
- 语义：与 ARCHITECTURE L2.4 描述一致（前端 `ri()` 内存缓存 Map，TTL 300s）。已坐实。

### 1.9 `Jn`（生图主回调）= 局部 useCallback ⚠️ 纠正 TASKS
`src/_engine/App.js:L32490`
```js
let Jn = Y.useCallback(async (e, r, o=`1024x1024`, s, c=`auto`, d=1) => {
  // 模型可用性检查 Xi/Ai → 提交生成 → 轮询 → 回填节点
  ...
}, [...]);
```
- 语义：图片生成主回调（提交 + 轮询编排）。但它是**组件内局部 useCallback**，非模块级函数。
- **冲突**：模块级 `Jn` @L89 = `LogoIcon`（func-mapping 正确）。
- **TASKS 错误**：TASKS.md L114/§架构审计计划 把"AI 生成派发函数"锚定到 `Jn`（模块级），并说"T0.1 解码，非 Jn"。真相是：**生图派发确实是某个 `Jn`，但它是局部 useCallback(@L32490)，不是模块级 `Jn`(LogoIcon)**。AI 生成与网关层（模块3）审计须用 L32490 这个局部 `Jn`，并明确标注"局部，非模块级"。
- ARCHITECTURE L1.3 / X1.1 把 `Jn` 当生图主回调描述，同样需加"局部 useCallback"限定。

---

## 1.10 `ei` / `ti` 同名遮蔽四义（五处绑定）⚠️ 补录（据 AI13 裁决表专项）

> 补录依据：`docs/AI13/裁决表.md` 交叉验证裁决。AI05 称「`var-mapping` 漏收前端三义」为最严重缺陷；经多 AI 回 `src/_engine/App.js` grep 实锤，该断言成立。以下五行均来自实锤，直接引用，不杜撰行号。

`ei` / `ti` 在源码中存在同名遮蔽，**五处绑定**，var-mapping 仅收 GAS 两义，漏收前端三义：

| 符号 | 行号 | 真身 | 层级/场景 |
|------|------|------|-----------|
| `ei` | `App.js:L1853` `var ei = new Map()` | 缩略图缓存 Map | 模块级变量 |
| `ei` | `App.js:L36784` `ei = Y.useCallback(...)` | 节点打组 | 组件内局部 useCallback |
| `ei` | `App.js:L43950` `ei = async () =>` | GAS pushToCloud | 组件内局部异步 |
| `ti` | `App.js:L36822` `ti = Y.useCallback(...)` | 清缓存 | 组件内局部 useCallback |
| `ti` | `App.js:L43974` `ti = async () =>` | GAS pullFromCloud | 组件内局部异步 |

- **结论（关键）**：`var-mapping` 只收 GAS 两义（`ei`@L43950 pushToCloud、`ti`@L43974 pullFromCloud），**漏收前端三义**（`ei`@L1853 缩略图缓存 Map、`ei`@L36784 节点打组、`ti`@L36822 清缓存）。AI05 称此为「最严重缺陷」成立——映射表未覆盖前端三义，导致审计/引用时极易混淆 `ei`/`ti` 真身。
- **引用铁律**：凡引用 `ei`/`ti` 必带行号 + 层级标注（模块级 / 局部 useCallback / 局部 async），否则无法区分缩略图缓存、节点打组、清缓存与 GAS 云同步四类语义。

---

## 2. T0.2 易混项核对结果

| 项 | 现状 | 动作 |
|----|------|------|
| `Zr = logout`（var-mapping L48） | 实为**局部** `Zr`@L43893；模块级 `Zr`@L1827 = `uploadFromUrl` | ❗ 纠正：模块级 Zr 是上传，logout 是局部重名 |
| `sv`(小写) vs `Sv`(大写) | `sv`=nodeCallbackFieldSet(L178，@L42002)；`Sv`=saveResource(@L42838) | ✅ 已厘清大小写，无冲突 |
| `Hr` / `vv` | `Hr`@L1732=`localEngineBase()`（**动态**，随 `USE_LOCAL_ENGINE` 切 18080/9004）；`vv`@L42808=`LOCAL_ENGINE.base`（**写死** 18080，仅资源记录） | ⚠️ 初判"双固定常量"已纠正：仅 `vv` 写死，`Hr` 动态。详见 `12-crossflow-contracts.md`（原 var-mapping L117/L118 为文档行号，代码真值见上） |
| `B` / `R` / `ii` / `wv` / `ri` | `ii`@L1888(上传入口)、`wv`@L42857(删)、`ri`@L1856(缩略图) 已坐实；`B`/`R` 为局部回调（资源面板文件上传 `R`≈L29165，拖入 `B`≈L29160）属组件局部，非模块级 | ⚠️ `B`/`R` 仅在资源面板组件内有效，引用带行号 |

---

## 3. 对后续审计阶段的约束（门1 锚点门）

- **AI 生成与网关层（模块3）**：真实生图派发函数 = 局部 `Jn`(@L32490)，轮询逻辑在其内部 + `mutiwindow-task-completed` 监听；不要锚模块级 `Jn`(LogoIcon)。
- **本地数据层（模块2）**：上传用 `Xr`(@L1802 blob) / `Zr`(@L1827 url)；入库 `Sv`(@L42838)；删 `wv`(@L42857)；rescan `Ev`(@L42883)；缩略图 `ri`(@L1856)。`we` 与 rescan 无关，勿用。
- **所有 `Xr`/`Zr`/`Jn` 引用必须带行号 + 模块级/局部标注**，避免重名误锚（本次已抓 3 处重名坑）。

---

## 4. 待回填到现有文档的修正（T4 同步项）

1. **func-mapping.txt**：`Xr` 条目应注明"模块级 L1802=uploadToLocalTool；局部 L43881=openInTab，重名"，而非直接 =openInTab。
2. **var-mapping.txt**：`Zr=logout` 应改为"局部 L43893=logout；模块级 L1827=uploadFromUrl（重名）"。
3. **TASKS.md**：
   - T0.1 `we` 行删除"rescanResources 主函数"误锚；
   - `wv` 行号 L42778 → L42857；
   - "AI 生成派发函数"注明为局部 `Jn`@L32490。
4. **ARCHITECTURE.md**：
   - L1.3 / X1.1 的 `Jn` 生图主回调加"局部 useCallback"限定；
   - L2.5 "Zr()→POST /api/files/upload" 改为 `Xr`/`Zr` 均上传（模块级），并注明 `Zr` 另有局部 logout 重名。

> 注：以上修正**只改文档**，不动 `App.js`（红线 §3.1）。是否回写原文档待用户确认；本记录为 AI06 派生草稿，过校验门后转正。

---

## 5. 校验门状态（门3 机器校验）

本记录所有 `App.js:Lnnnn` 锚点均由 `search_content` 在 `src/_engine/App.js` 实 grep 取得，符号与行号存在性 ✅。
逻辑一致性（重名辨析）由门4 对抗审计复核，本会话单遍已交叉核对 L1802/L1827/L43881/L43893/L89/L32490 确认无自我矛盾。

**结论**：阶段 0 阻塞已解除，可进入阶段 1–4 模块审计。

[2026-07-21 据 AI13 裁决表专项：补录 ei/ti 四义（L1853/L36784/L36822/L43950/L43974）]
