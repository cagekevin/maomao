# 34-素材系统与落盘 rescan 专题

> 原文档名：`34-画布右键导入-素材 tab 为空排查与素材系统梳理`（2026-08-11 重命名，原主题「画布右键导入-素材 tab 为空排查」的排查记录见 §7 排查记录）。

> **本文档即"素材 / 落盘 / rescan"的专题文档**，今后改动 rescan、落盘、素材库相关逻辑，以本文档为准。
> **2026-08-11 同步**：rescan 已升级为**递归扫描子目录**（变更 #17，`resources.ts:88` `scanRescanDir`），修正了 §2.2/§4.3/§8 的相关描述与行号。此前 rescan 只扫顶层目录一层，导致 `migrated/人物|场景|道具` 下的剧本资产文件不入库、素材 tab 看不到（详见 §2.2 变更 #17 说明）。

> 本文档基于实际源码核对（核对时间：2026-08-07，变更 #17 后已修订）。文中出现的 `L` / `Pe` / `ne` / `xt` / `mt` 等都是 **Vite 打包后的压缩（minified）变量名**，非源码原始命名；它们在同一份打包产物内一一对应，下方每条都给出了"压缩名 → 含义"的映射，便于对照。
>
> 已核对的源码文件：
> - 前端（打包产物）：`src/bundle/App-BX6o9fW5_components/Vr.jsx`（App 主界面/资源面板）、`src/bundle/App-BX6o9fW5_components/shared.js`（资源 store：rescan / save / delete / clear）、`src/bundle/httpClient-BknZwXjG_components/H_.jsx`（画布）、`src/bundle/httpClient-BknZwXjG_components/Un.jsx`（资源面板内的目录/上传区）、`src/bundle/httpClient-BknZwXjG_components/_Component118.jsx`（右键「导入」弹窗）、`src/bundle/httpClient-BknZwXjG_components/shared.js`（文件上传 `ci`/`hi` 等）。
> - 后端：`localTool/src/routes/resources.ts`（/api/resources/*）、`localTool/src/db/database.ts`（SQLite 表结构、本地文件路径）。

---

## 0. 一句话结论（先看这里）

画布右键 →「导入」弹窗里**素材 tab 为空**，本质是**前端手里的那一份 transit 资源列表 `L` 是空的**。`L` 只来自两个动作：

1. 打开资源面板并切到 transit 相关 tab 时，自动触发一次 rescan + 列表加载（`xt()` → `Pr()` rescan + `kr()` 拉取）；
2. 通过 `addTransitResource`（`Ia`）显式新增一条（剪贴板粘贴、画布节点拖出等）。

如果 **localTool 服务没启动（18080 端口不可达）**、或 **rescan 没跑过（磁盘上 `migrated/人物` 等目录从未被扫进 SQLite 的 `resources` 表）**，那么 `L` 必然为空，导入弹窗的素材 tab 也就空着。

> 特别注意：**AI 节点生成的资产落盘（H_.jsx 的 `ci`/`hi`）并不会写 `resources` 表，也不会触发 rescan**，因此"在 AI 节点里生成了图、以为素材库会自动有"是常见误解——这条数据只在磁盘上，必须手动 rescan 才会进 `L`。

---

## 1. 为什么素材 tab 会为空（原因排查）

### 1.1 数据从源头到弹窗的传递链（已逐节点核对）

```
localTool 服务 (18080)
  └─ SQLite: localtool.db / resources 表   (database.ts:108 建表)
       └─ folder 字段取值: tasks / migrated / materials / 以及子目录 migrated/人物、migrated/场景、migrated/道具、materials/...
            │  (rescan 接口扫描磁盘 upload 目录 → 写入 resources 表)
            ▼
Vr.jsx  xt()  ── ① await Pr()  调用 /api/resources/rescan   (shared.js:3068)
            └─ ② kr({pageSize:300}) 拉取 → 写入 L (ne 是 L 的 setter, 见 147/148)
            │
            ├─ Vr.jsx:3675  资源面板 <_Component39 transitResources={L} .../>
            │
            └─ Vr.jsx:3679  画布 <Ye ... transitResources={L} addTransitResource={Ia} .../>
                              │  (Ye 即 H_.jsx 组件)
                              ▼
                 H_.jsx:12421  画布右键「导入」弹窗 <_cmp__Component118 transitResources={A} .../>
                              │  (A = H_.jsx 顶部解构的 props.transitResources, 默认 [], 实际来自上面的 L)
                              ▼
                   _Component118.jsx  kg(materials) 过滤 → 渲染素材 tab
```

关键映射（压缩名 → 含义）：

| 压缩名 | 含义 | 出处 |
|---|---|---|
| `L` | 前端手里的 transit 资源全量列表 `transitResources` | Vr.jsx:70 `let [L, ne] = useState([])` |
| `ne` | `L` 的 setter（写入列表） | 同上 |
| `Pe` | 资源面板分页用的 `transitItems` | Vr.jsx:69 `let [Pe, Ie] = useState([])` |
| `Ie` | `Pe` 的 setter | 同上 |
| `xt` | 同步函数：rescan + 拉全量 → 写 `L` | Vr.jsx:147 |
| `mt` | 分页拉取函数：拉 `Pe` | Vr.jsx:125 |
| `Xa` | 同步入口：内部调 `xt()`；参数 `true` 表示静默（不弹 toast） | Vr.jsx:2528 |
| `Pr` | rescan 请求：`POST /api/resources/rescan` | shared.js(同 bundle):3068 |
| `kr` | 分页查询请求：`GET /api/resources?...` | Vr.jsx 内引用 |
| `Ia` | `addTransitResource`：新增一条 transit 资源（写 `L` + 调后端 save） | Vr.jsx:2085 |
| `Ar` | 后端 save 请求：`POST /api/resources/save` | shared.js:3016 |
| `Kg` | 工具函数：按文件名/扩展名判断媒体类型（video/audio/text/image） | httpClient shared.js:11192 |
| `ci` / `hi` | 文件本地化落盘函数（POST /api/files/upload，按 subfolder 写入磁盘） | httpClient shared.js:1752 / 1848 |

### 1.2 四条写入 `L` 的路径（哪些会、哪些不会刷新素材）

- **a. 打开资源面板并切到 transit tab（路径①）**：`Vr.jsx:2543` 的 `useEffect` 在切到 `transit` 时调用 `Xa(true)` → `xt()` → `Pr()` rescan + `kr()` 拉取 300 条写 `L`。**这是 `L` 在绝大多数情况下被填充的方式**。打开导入弹窗（画布右键）本身**不**触发这个 effect，它只读取当前 `L` 的快照。
- **b. 剪贴板粘贴/拖入**：`Vr.jsx` 粘贴处理里调 `Ia(e, 'text')` 等（`Ia` 在 2085）→ 先 `ne` 把新项塞进 `L`，再 `Ar(...)` 调后端 save。
- **c. 画布节点"拖出/发送到素材"**：`H_.jsx` 中 `Ia(t, e.sourceHandle)` / `Ia(t, e.sourceHandle, 'video')`（调用点：2290、3544、4099、6118）→ 同样走 `Ia` 写 `L` + 后端 save。
- **d. AI 节点生成资产（易踩坑！）**：`H_.jsx:5698` 的 `handleAssetImageGenerate` 把图用 `ci(f, {subfolder:'migrated/人物'})` 或 `hi(f, {subfolder:'migrated/人物'})` **直接写到磁盘**（`migrated/人物|场景|道具` 目录）。**这里既不调 `Ia`、也不写 `resources` 表、也不触发 rescan**。所以"AI 生成了一张角色图"并不等于"素材库里多了一条"——磁盘有文件，但 `L` 和 SQLite 都没有，必须手动 rescan 才会出现。

### 1.3 空 tab 的直接判定

- 若**整个素材 tab 空**（不是只有某几个子目录空）→ 问题在 `L` 源头：大概率是 localTool 服务未启动，或 rescan 从未跑过（首次启动 / 清空数据库后）。
- 若**资源面板里能看到、但右键导入弹窗里没有** → 可能是二者过滤视图不同（见第 3 节：`materials` vs `migrated` 前缀差异），或弹窗挂载时 `L` 恰为空（没先打开过资源面板触发 rescan）。

### 1.4 建议的快速验证（真实可用命令）

> 原文引用的 `tools/ps/check-transit.ps1`、`tools/ps/rescan-transit.ps1` **在当前仓库中不存在**（`tools/` 目录下仅有 `infinite-canvas别人仓库学习专用/`、`ProPainter-Webui/`、`ProPainter/` 等子目录），请勿照抄路径。可用下面等价的真实命令替代：

**① 确认 localTool 服务在跑（18080）：**
```powershell
# PowerShell
(Invoke-WebRequest -Uri http://127.0.0.1:18080/api/status -UseBasicParsing -TimeoutSec 3).StatusCode
# 或命令行查看端口占用
netstat -ano | findstr 18080
```

**② 手动触发 rescan，把磁盘素材扫进 resources 表：**
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:18080/api/resources/rescan -Method Post
# 返回示例: {"ok":true,"count":N,"scanned":N,"added":N,"skipped":N,"orphanDeleted":0}
```
rescan 成功后再打开资源面板（或刷新页面）切到 transit tab，素材 tab 应即有内容。

**③ 直接看数据库里有哪些 folder：**
```powershell
# 用 sqlite 工具查看 localtool.db（位于 localTool 的 data 目录）
# SELECT folder, COUNT(*) FROM resources GROUP BY folder;
```

---

## 2. 素材系统完整梳理（核对后）

### 2.1 存储与两张核心表（database.ts 已核对）

- `resources` 表：所有 transit 素材的统一元数据表，关键列：`id`(PK, 形如 `local-${folder}-${name}`)、`url`、`type`、`source`、`folder`、`name`、`timestamp`、`isFavorite` 等。建表逻辑在 `database.ts:108`（`initTables` 内）。
- `tasks` 表：AI 任务，与素材是两套体系。
- **不存在 `resources_meta` 表，也没有 `scanned` 键**（原文此处有误）。rescan 的"幂等"靠的是 `id` 唯一 + 已存在则 `skipped`：

```ts
// localTool/src/routes/resources.ts:98-103
const exist = queryOne(db, 'SELECT id FROM resources WHERE id = ?', [id]);
if (exist) { skipped++; continue; }   // 已扫过则跳过，保留收藏/手动元数据
```
rescan 末尾还会做**孤儿清理**（120-130 行）：source='local-tool' 但磁盘对应路径已不存在的记录会被 `DELETE`，所以本地删文件后 rescan 不会再显示陈旧条目。

### 2.2 rescan 到底扫了什么（resources.ts:37-134，已通读）

`handleResourcesRescan`（**⚠️ 2026-08-11 已升级为「递归扫描」**，见变更 #17）：
1. 取 `uploadDir`（`getUploadDir()`）。
2. 对 `upload/` 下的每个顶层目录（`tasks` / `migrated` / `materials` / 其它），调用递归函数 `scanRescanDir(db, absDir, relFolderPath, counters)`（`resources.ts:88`）。
3. `scanRescanDir` 对目录内每个 entry：
   - **子目录**：作为 `type='folder'` 的资源录入（`folder=父路径`、`name=子目录名`），然后**递归进入该子目录继续扫描**（跳过 `.thumbnails`、以 `.` 开头的隐藏项）。
   - **文件**：按扩展名映射为 image/video/audio/text 录入，`folder` 字段存**完整父路径**（如 `migrated/人物`）、`name` 存文件名、`id=local-<完整父路径>-<文件名>`。
   - **顶层目录里的文件**：`relFolderPath=顶层目录名`，`id=local-<顶层名>-<文件名>`（如 `local-tasks-xxx.png`）——**与旧格式完全一致**，向后兼容。
4. 入库 URL 规则：`toAbsoluteFileUrl('/files/${folder}/${name}')`，`LOCAL_FILE_BASE = 'http://127.0.0.1:18080/files/'`（`database.ts:22`），完整地址形如 `http://127.0.0.1:18080/files/migrated/人物/xxx.png`。
5. 幂等（见 2.1）+ 孤儿清理：`DELETE` 磁盘路径（`path.join(uploadDir, folder, name)`）已不存在的 `source='local-tool'` 记录（`resources.ts:170-176`）——对多级 `folder`（含 `/`）同样正确。

> **变更 #17（2026-08-11）**：此前 rescan **只遍历顶层目录一层**，`migrated/` 下的子目录（`人物`/`场景`/`道具`）只录一个 `type='folder'` 空条目、**不递归扫文件** → 剧本盒子资产（落盘 `migrated/人物/xxx.png`）无法进素材库。本次改成递归 `scanRescanDir`（`resources.ts:88`），通用扫描所有子目录文件。**顶层 id 格式不变**，旧数据无需迁移。详见 `docs/01` 变更 #17。

> 注意：`materials` 是 `upload/` 下的独立子目录（见 `MATERIALS_DIR` 配置），与 `migrated` 并列；两者都会被 rescan 扫进 `resources` 表，只是 `folder` 字段不同。

### 2.3 资源面板（_Component39 / Un.jsx）的过滤

资源面板的过滤在 **`Vr.jsx` 的 `ft()`（107-124 行）**，不是在 `Un.jsx` 里。`ft()` 逻辑：

```js
let ft = W.useCallback(() => {
  let e = {};
  let t = pe === 'generated' ? 'tasks' : 'migrated';   // pe = transitTabFilter
  e.folder = { eqOrPrefix: ve ? `${t}/${ve}` : t };      // ve = currentFolder（子目录）
  if (oe !== 'all') { /* 按 type 再过滤 */ }
  ... kr({ filters: e, page, pageSize, sortBy, sortDir }) ...
}, [...]);
```

- `pe`(tab) 为 `generated` → 查 `folder = tasks*`；为 `migrated` → 查 `folder = migrated*`。
- 用 `eqOrPrefix`，所以 `migrated` 会匹配 `migrated`、`migrated/人物`、`migrated/场景`、`migrated/道具` 等。
- **关键点**：`eqOrPrefix:'migrated'` **不会**匹配 `folder='materials'`（前缀不同）。资源面板的 migrated tab 因此**看不到** `materials/` 下的条目；`materials` 是另一类视图（见下方 3.1）。

> 原文把"过滤在 `Un.jsx:208`"是错误的——`Un.jsx:208` 处是"打开本地目录"按钮的路径，真正的分页过滤发生在 `Vr.jsx` 的 `ft()`。

### 2.4 新增素材的两条后端出口

- `POST /api/resources/save`（`Ar`，shared.js:3016）→ 新增/覆盖一条 `resources` 记录。被 `Ia`（剪贴板、画布拖出）调用。
- `POST /api/files/upload`（`ci`/`hi`，httpClient shared.js:1752/1848）→ 只把文件写到磁盘（subfolder 决定落点），**不**写 `resources` 表、**不** rescan。被 AI 资产本地化调用。

---

## 3. 导入弹窗（_Component118）的素材 tab 为什么和面板不同

### 3.1 弹窗用的是"宽口径"过滤（_Component118.jsx:92-108，已核对）

```js
const kg = (materials) => {
  materials = (materials || []).filter((e) => {
    if (!(e.folder && (e.folder.startsWith('materials') || e.folder.startsWith('migrated')))) return false;
    if (e.type && e.type !== 'folder' && Kg(e.type, e.url || e.name || '') !== d) return false; // d = 当前子类型
    return true;
  });
  ...
};
```

也就是说，导入弹窗的素材 tab **同时收 `materials/*` 和 `migrated/*` 两类**，并可用 `Kg()` 按媒体类型（image/video/audio/text）再细分。

而资源面板 migrated tab（`ft()`）只收 `migrated*`。**这是两者范围差异的根因**——若你的素材都在 `materials/` 下，资源面板 migrated tab 看不到，但右键导入弹窗能看到（前提是 `L` 已被 rescan 填充）。

### 3.2 弹窗只读 `L` 的快照

`H_.jsx:12421` 把 `transitResources={A}` 传给 `_Component118`，`A` 就是来自 `Vr.jsx` 的 `L`（经 `Ye/H_.jsx` 的 props 透传）。如果打开弹窗时 `L` 为空（比如从未打开过资源面板触发 rescan），弹窗自然全空——**打开弹窗本身不会触发 rescan**。

---

## 4. AI 生成资产的"落盘 vs 入库"问题（空 tab 的常见根因）

### 4.1 现象

在画布 AI 节点里生成了一张角色/场景/道具图，文件确实出现在本地（`upload/migrated/人物/xxx.png`），但去右键导入弹窗的素材 tab 找，没有它。

### 4.2 源码事实（H_.jsx:5698，已核对）

```js
let m = `migrated/${i.category === 'character' ? '人物' : i.category === 'scene' ? '场景' : '道具'}`;
// 远程 URL → 下载并本地化：
let e = await ci(f, { subfolder: m });        // httpClient shared.js:1752，POST /api/files/upload
// 或本地已有文件 → 直接归位：
let e = await hi(f, { subfolder: m });         // httpClient shared.js:1848
// 成功后仅更新"画布节点上的 asset 缩略图/原图字段"，不写 resources 表、不调 Ia、不 rescan
```

结论：**AI 资产本地化只落盘，不入库**。`L` 和 SQLite 的 `resources` 表都不会因此多出记录。要让它出现在素材 tab，需要手动 rescan（1.4 节命令 ②），或让用户在资源面板触发一次同步（`Xa`）。

### 4.3 修复方向（如需让 AI 资产自动进素材库）

二选一：
1. 在 `handleAssetImageGenerate` 本地化成功后，额外调一次 `Ia(url, type, 'generated')`（走 `Ar` 入库 + 写 `L`）；注意 `Ia` 里 `n==='generated'` 会把 `folder` 设为 `tasks`，若想归到 `migrated` 需调整 folder 逻辑或新增一个参数。
2. 本地化成功后直接 `POST /api/resources/rescan` 一次（轻量，仅扫该目录），再触发前端 `Xa()` 刷新 `L`。

> **✅ 变更 #17 已落地（2026-08-11）**：rescan 已改为**递归扫描子目录**（`resources.ts:88`），因此方向 2 已完全可行且通用——剧本资产落盘到 `migrated/人物|场景|道具` 后，素材 tab 每次打开自动 rescan 即可收录，无需改前端。方向 1（`Ia` 主动入库）仍是"即时出现、不等 rescan"的增强项，目前未做。

---

## 5. 深度排查：剪贴板粘贴素材为什么不落地（用户实际场景）

> 用户现场事实：「素材是之前**剪贴板粘贴**进去的，当时只能在网页上看到，但本地 `upload/` 文件夹是空的，刷新/重开后再去素材 tab 就空了。」据此重新追了粘贴这条链路，**发现根因不在 rescan / `L` 拉取，而在 `save` 接口根本不把图片写盘**。

### 5.1 粘贴链路逐行核对（Vr.jsx）

1. `Vr.jsx:2050-2079` 全局 `paste` 监听：剪贴板图片经 `FileReader.readAsDataURL` 转成 **base64 dataURL** 字符串，调 `Ia(t, 'image')`。
2. `Ia(e, t, n='pasted')`（2085-2114）：
   - `n==='pasted'` → `folder = 'migrated'`，`source = 'pasted'`，**`url = e`（即 dataURL 本身）**。
   - `ne(e => [a, ...e])`：**先写入前端内存 `L`**（`L` 是 `transitResources`）→ 这就是「当次网页立刻能看到」的原因。
   - 然后 `Ar({...a})` → `POST /api/resources/save` 尝试落库。
3. `xt()`（147-159）重建 `L` 时**有端口守卫** `if (r.status.port)`：只有 localTool 端口在线才会 `Pr()`(rescan) + `kr()` 拉取 SQLite 重写 `L`。

### 5.2 后端 save 不写文件（resources.ts:182-190，关键缺陷）

```ts
export async function handleResourcesSave(req, res) {
  const body = await parseJsonBody(req);
  if (!body || !body.id) return sendError(res, 'Missing id field', 400);
  const db = await getDb();
  upsertResource(db, resourceToRow(body));   // 把整条记录(含 dataURL 长字符串 url)直接 INSERT 进 resources 表
  debouncedSaveDb();
  return json(res, { ok: true });
}
```

- `upsertResource` 只把 `body` 原样落 SQLite，**从不解码 dataURL、从不调用 `fs.writeFile`**。
- 因此**无论后端是否启动，磁盘 `upload/migrated/` 下都不会出现该图片文件**——「本地文件夹是空的」是必然结果，不是偶发。

### 5.3 为什么最后素材 tab 会变空（两种演化）

- **情形 A（当时端口不在线）**：`Ia` 里 `ne` 已写入内存 `L`（网页可见），但 `Ar` 的 fetch 抛错被 `catch` 吞掉，SQLite **没落库**。刷新后 `L` 清空，`xt()` 需端口在线才跑；即使之后端口在线，rescan 只扫磁盘、dataURL 记录磁盘无文件且 `source='pasted'`（非 `local-tool`）不会被 rescan 生成 → **这条素材永久丢失**，素材 tab 空。
- **情形 B（当时端口在线，save 成功）**：dataURL 进了 SQLite，但磁盘仍无文件。刷新后 `xt()` 的 `kr`（`handleResourcesGet` 直接 `SELECT FROM resources`，169-180）能查回这条记录，`L` 重建后理论上仍可见——但整条资源**完全绕开了 rescan 文件体系**，一旦遇到「清空 resources / 重置数据库 / 删除 dataURL 记录」等情形即消失，且它永远不出现在本地文件夹、不被任何文件级备份覆盖。

> 两种情形共同指向同一个设计缺陷：**粘贴素材只存 dataURL 进内存/数据库，从不落地为真实文件**，因此它既不是 rescan 体系的一部分，也无法在本地文件夹找到，可靠性远低于 `ci`/`hi`（AI 资产）和 rescan 扫描出来的文件型素材。

### 5.4 修复方向（让粘贴素材真正"落地 + 入库"，根治 tab 为空）

在「写库之前把 dataURL 解码成文件」即可一次性解决"本地空"和"刷新后丢"：

- **改 `handleResourcesSave`（resources.ts:182）**：若 `body.url` 以 `data:` 开头，用 `Buffer.from(base64, 'base64')` 解出二进制，写入 `path.join(getUploadDir(), folder, name)`（如 `upload/migrated/clip-<timestamp>.<ext>`），再把 `body.url` 改写为 `LOCAL_FILE_BASE + folder + '/' + name`。这样资源与 `ci`/`hi`/rescan 共用同一文件体系，`<img>` 用 18080 地址也能正常显示。
- **或改前端 `Ia`（Vr.jsx:2085）**：粘贴拿到 dataURL 后，先 `fetch(dataURL).blob()` 走一遍 `ci(f, {subfolder:'migrated'})`（即 `POST /api/files/upload`，会真正写盘并返回 18080 地址），再拿返回的 url 调 `Ar`。这样落盘与写库都走既有可靠通道，无需改后端。
- 落地后 `source` 建议保留 `pasted`（便于区分来源），但 `folder='migrated'` + 磁盘有文件，**之后任何一次 rescan 都能稳定接管**，刷新不再丢。

> 注意：`deleteLocalFile`（database.ts:69）已对"非 `LOCAL_FILE_BASE` 开头的 URL"直接跳过删除，所以即使是 dataURL 型记录，删除时也不会误删其它文件；改成真实 18080 地址后删除逻辑也会正确清理磁盘文件，无需额外改动。

## 6. 导入到素材库的全部方式（已逐一核对源码）

> 以下按「是否写入素材库（`L` + SQLite `resources` 表）」逐个核对了 `Ia`(addTransitResource) 与资源落库的所有调用点。凡最终调 `Ia` / `Ar`(save) 的，才是真正的"导入到素材库"；只写画布、只写磁盘、或写外部平台的，单列排除。

### 6.1 真正写入素材库的方式（5 种）

1. **① 剪贴板粘贴**（Vr.jsx:2050-2079 → `Ia(t,'image')` / `Ia(e,'text')`）
   - 触发：在应用内任意可粘贴区 `Ctrl+V` 粘贴图片/文本。
   - 入库：`Ia(e,t,n='pasted')` → `folder='migrated'`、`source='pasted'`、`url=dataURL` → `ne` 写内存 `L` + `Ar`(save) 写 SQLite。**不写磁盘文件**（见第 5 节，这是"本地文件夹空"的根因）。
   - 用户已确认的两种之一。

2. **② 网页发送到资源**（插件环境 `La`，Vr.jsx:2115 → `chrome.runtime.onMessage` → Vr.jsx:1166）
   - 触发：浏览器插件里点"发送到资源"，把当前网页上的图片注入到网页 file input 并触发其上传，再由 `onMessage` 回调接收。
   - 入库：Vr.jsx:1166-1200 → `folder='migrated'`、`source='local-tool'|'extension'` → `ne` 写 `L`；若 source≠local-tool 额外 `Ar`(save) 写 SQLite。随后自动切到 transit / materials 视图。
   - 用户已确认的两种之二。

3. **③ 画布节点输出"发送到素材"**（H_.jsx:2290 / 3544 / 4099 / 6118 → `Ia`）
   - 触发：在画布上对生成类节点（图片/视频等）执行"发送到素材 / 收集输出"类操作（节点间连线结算、右键收集、选中上下文资源等）。
   - 入库：`Ia(t, e.sourceHandle, 'video'?)` → 把节点的图片/视频输出按 `folder='migrated'` 加入 `L` + `Ar` 入库。注意第 3 参多为 `'video'` 或省略（默认 `'pasted'`），都不会设 `tasks`。

4. **④ rescan 扫描磁盘**（localTool `resources.ts` `handleResourcesRescan`）
   - 触发：打开资源面板切到 transit tab（`Xa(true)`→`xt`→`Pr`），或手动调 `/api/resources/rescan`。
   - 入库：遍历 `upload/` 下 `tasks` / `migrated` / `materials` 等目录的所有文件，按 `folder` 写入 `resources` 表。**这是"被动导入"**——任何落到磁盘 `upload/` 下的文件，经一次 rescan 都会进素材库。

5. **⑤ AI 节点资产本地化落盘（半导入，需配合 ④）**（H_.jsx:5698 → `ci`/`hi`）
   - 触发：AI 节点生成人物/场景/道具图。
   - 行为：`ci(f,{subfolder:'migrated/人物'})` / `hi(...)` 把文件写到磁盘 **但不调 `Ia`、不写 `resources` 表**。它自身**不是**直接入库，必须等下一次 rescan（方式 ④）才会进素材库。`folder` 落在 `migrated/人物|场景|道具`。

> 小结：**前 3 种是"主动入库"（前端 `Ia`），第 4 种是"被动入库"（后端 rescan），第 5 种是"只落盘"，需靠第 4 种收口。**
> 其中 **①②③ 都可能携带 dataURL / 远程 URL 而非真实本地文件**：① 是纯 dataURL（最严重，从不写盘）；②③ 取决于抓取来源，若抓到的是远程 URL 则会存远程地址（`<img>` 能跨域显示，但本地文件夹同样没有文件，且刷新后能否显示依赖该远程地址是否仍可用）。

### 6.2 容易误认为"导入素材库"、但其实不是的方式（排除项）

- **导入弹窗(_Component118)里"上传本地文件"**：`_Component118.jsx:115-143` 把文件读成 dataURL 后走 `onImportToCanvas` / `onSelect`（H_.jsx:12421 的 `onImportToCanvas`）→ **生成画布节点**，不写素材库，也不写 `resources` 表。
- **聊天面板图片上传**（`_Component40.jsx:207` `pe`）：走 `uploadAsset` 到 apimart 网关，与本地素材库无关。
- **"发送到剪映素材库"**（`Bn.jsx:14`）：外部平台（剪映），非本地 `resources` 表。
- **资源面板"上传云端"/"保存到我的模板"**（Vr.jsx:3462 等）：云端化模板，非本地素材库。
- **拖拽文件到画布/环境卡片**（Vr.jsx:3609-3615 等）：生成画布节点或环境切换，不入库。

### 6.3 与"素材 tab 为空"的关联

- 若你的素材来自 **① 剪贴板粘贴**：最可能是第 5 节的"dataURL 不落地"——网页能看（内存 `L`），本地空（save 不写盘），刷新后若当时后端未启动或库被清则彻底丢失。
- 若来自 **② 网页发送 / ③ 节点发送**：一般能正常入库（走 `Ar` 写 SQLite，且多为远程/磁盘已有文件），刷新后能靠 `xt`→`kr` 从 SQLite 恢复；但若当时端口不在线，`Ar` 失败则同样只留内存、刷新即丢。
- 若来自 **⑤ AI 资产**：必须记得触发一次 rescan（方式 ④），否则只落盘不入库，导入弹窗（读 `L`）看不到。

## 7. 结论与根因清单（排查 checklist）

| 现象 | 最可能根因 | 验证 / 修复 |
|---|---|---|
| 导入弹窗素材 tab 全空 | localTool 服务未启动（18080 不可达） | 1.4 ① 检查端口；启动 localTool |
| 导入弹窗素材 tab 全空，但服务在 | rescan 从未跑过（首次/清库后） | 1.4 ② 手动 rescan，再开资源面板触发 `Xa` |
| 面板能看到、弹窗看不到 | 弹窗挂载时 `L` 恰为空（没先打开面板 rescan） | 先打开资源面板切到 transit tab，再右键导入 |
| **之前粘贴过、当时网页能看到、本地文件夹空、刷新后 tab 也空** | **剪贴板粘贴只存 dataURL 进内存 `L`+SQLite，从不解码写文件**（5.1-5.3） | 按 5.4 让 `save`/`Ia` 把 dataURL 落地为真实文件，之后 rescan 可接管 |
| AI 生成的图在本地但素材库没有 | `ci`/`hi` 只落盘不入库（4.2） | 手动 rescan；或按 4.3 改代码 |
| 资源面板 migrated tab 看不到 materials | `ft()` 用 `eqOrPrefix:'migrated'`，不含 `materials`（2.3/3.1） | 这是设计差异，非 bug；用右键导入弹窗（宽口径）才能看到 `materials` |

**一句话定位口诀**：素材 tab 空 = `L` 空；`L` 空 = 没 rescan / 没落库。剪贴板粘贴的素材**只把 dataURL 塞进内存和数据库、从不写真实文件**——所以"网页能看到、本地文件夹空"是必然，"刷新后丢"在端口不在线或重置库时必然发生。要让它稳定，必须让 `save`/`Ia` 把 dataURL 解码落地（见 5.4）。

---

## 8. 附：已核对的行号清单（均与实际代码一致）

- `localTool/src/routes/resources.ts:67` `handleResourcesRescan`；`:88` 递归函数 `scanRescanDir`；`:139` 文件幂等跳过；`:170-176` 孤儿清理；`:181` 返回；`:220` 分页查询 `handleResourcesQuery`；`:230` `handleResourcesSave`。
- `localTool/src/db/database.ts:22` `LOCAL_FILE_BASE`；`:108` `resources` 表建表。
- `src/bundle/App-BX6o9fW5_components/shared.js:3068` `Pr`(rescan)；`:3016` `Ar`(save)。
- `src/bundle/httpClient-BknZwXjG_components/shared.js:11192` `Kg`(类型判断)；`:1752` `ci`(上传)；`:1848` `hi`(本地化)。
- `Vr.jsx:70` `[L, ne]`；`:69` `[Pe, Ie]`；`:72` `pe`(tab, 默认 `generated`)；`:107` `ft()` 过滤；`:125` `mt()`；`:147` `xt()`；`:150` `Pr()`；`:2085` `Ia`；`:2528` `Xa`；`:2543` 切 tab 调 `Xa(true)`；`:3675` 资源面板传 `L`；`:3679` 画布传 `L`+`Ia`。
- `H_.jsx:53` props 解构 `transitResources: A=[]`；`:5698` AI 资产落盘子目录 `migrated/人物|场景|道具`；`:12421` 导入弹窗传 `transitResources={A}`；`Ia` 调用点 2290/3544/4099/6118。
- `_Component118.jsx:92-108` `kg` 过滤（materials+migrated + 类型）。

---

## 9. 修复实施记录（方案 A：后端 save 统一把 dataURL 落盘）

> 按 5.4 节方案 A 落地（2026-08-07）。**只改后端一个文件，前端零改动**，因为所有带 dataURL 的入库请求最终都经过 `handleResourcesSave`，在此统一收口，一次修复覆盖剪贴板粘贴及其它 dataURL 写入路径。

### 9.1 改动文件与内容

**文件：`localTool/src/routes/resources.ts`**（共约 +20 行新代码）

1. **新增 import**：
   ```ts
   import { writeUploadBuffer } from '../utils/fileStore.js';
   ```

2. **新增辅助函数 `decodeDataUrl`**（解析 dataURL、解 base64、推导扩展名）：
   ```ts
   const MIME_TO_EXT: Record<string, string> = {
     'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp',
     'image/gif': '.gif', 'image/bmp': '.bmp', 'image/svg+xml': '.svg',
     'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
     'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/flac': '.flac', 'audio/ogg': '.ogg',
     'text/markdown': '.md', 'text/plain': '.txt',
   };
   function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
     const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
     if (!m || !m[3]) return null;
     const mime = (m[1] || '').toLowerCase();
     const isBase64 = !!m[2];
     let buffer: Buffer;
     try {
       buffer = isBase64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
     } catch { return null; }
     if (buffer.length === 0) return null;
     const ext = MIME_TO_EXT[mime] || '.bin';
     return { buffer, ext };
   }
   ```

3. **修改 `handleResourcesSave`**：在 `upsertResource` 前，把 `data:` 开头的 url 解码落盘为真实文件，再改写 url 入库：
   ```ts
   if (typeof body.url === 'string' && body.url.startsWith('data:')) {
     const decoded = decodeDataUrl(body.url);
     if (decoded) {
       const folder = typeof body.folder === 'string' && body.folder ? body.folder : 'migrated';
       const filename = `clip-${Date.now()}${decoded.ext}`;
       try {
         const { urlPath } = writeUploadBuffer(folder, filename, decoded.buffer);
         body.url = toAbsoluteFileUrl(urlPath);   // 改写为 http://127.0.0.1:18080/files/<folder>/<name>
       } catch (e) {
         console.error(`[resources] save dataURL 落盘失败，按原样入库:`, e);  // 失败不阻断
       }
     }
   }
   ```

### 9.2 效果与边界

**解决：**
- 剪贴板粘贴图片 → 真实落盘到 `upload/migrated/clip-<时间戳>.png`，本地文件夹有文件，刷新不再丢（rescan 体系接管）。
- 删除时 `deleteLocalFile`（database.ts:69）能正确清理对应磁盘文件（改后 URL 已是 `LOCAL_FILE_BASE` 开头）。
- 一个 save 接口统一收口所有 dataURL 入库路径。

**不解决（有意保留范围）：**
- **已存在的 dataURL 旧记录**不会自动迁移（save 只在有新的 save 请求时触发）。现场发现的 1 条 `migrated` dataURL 记录（见 9.3）需一次性数据迁移恢复。
- **远程 http(s) URL 型素材**（网页发送/节点发送抓到远程地址）不落盘——方案 A 只处理 `data:` 前缀，这是有意不扩展的范围。
- **AI 节点资产**（`ci`/`hi` 落盘不入库）仍需 rescan 收口，方案 A 不涉及。
- **文本粘贴**（`Ia(e,'text')` 传纯字符串非 dataURL）走原逻辑直接入库，本身无需落盘。

### 9.3 现场验证（2026-08-07）

- 服务在跑（18080 可达）。
- `POST /api/resources/rescan` 返回 `{ok:true, scanned:303, added:0, skipped:303, orphanDeleted:0}` → 磁盘 303 个文件**全已在 resources 表**，库健康。
- `GET /api/resources` 全量 311 条分布：`tasks:299`、`migrated:8`、`canvas:4`。
- **磁盘 `upload/` 结构**：`canvas:273`、`migrated:1`、`tasks:556`。`migrated/` 下**只有 1 个缩略图**（`.thumbnails/thumb_*.png`），无真实图片文件。
- **确认现场证据**：`migrated` 中 1 条记录 url 为 `data:image/png;base64,...`（粘贴素材），**磁盘无对应文件** → 这正是"本地文件夹空"的直接证据，也是方案 A 修复的典型场景。
- **待办**：重启 localTool 使修改生效 → 重新粘贴图片验证落盘 → （可选）对存量 dataURL 记录做一次性解码落盘迁移。
