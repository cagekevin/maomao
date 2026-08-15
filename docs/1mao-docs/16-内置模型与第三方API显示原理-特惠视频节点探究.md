# 16 - 内置模型与第三方 API 显示原理（特惠视频节点为何不显示第三方 API）

> 文档版本：基于 `dist/` 前端打包产物（`App-BX6o9fW5.js`、`httpClient-BknZwXjG.js`）与 `localTool/src` 后端源码的静态分析。
> 分析日期：2026-07-31

---

## 0. 结论速览

**特惠视频节点（discountVideo）里不显示任何第三方 API，是设计上的硬隔离，而不是 Bug。**

原因有三条，逐层叠加：

1. **模型来源不同**：普通节点（文生视频 `sd2Video`、文生图 `image` 等）的模型下拉框由 `apiConfigs` 合并后的模型清单驱动；特惠视频节点用的是 **独立硬编码的 `discountVideoModel` 文本字段**（按 `\n` 拆分的纯文本），根本不从 `apiConfigs` 取数据。
2. **API 地址也是写死的**：特惠视频节点除了模型列表硬编码，连 **API 地址也用独立的 `discountVideoApiUrl` 配置字段写死**（来源为节点配置对象 `e3[v.discountVideo]`，并非 `apiConfigs` 下拉可选项），不取 `apiConfigs` 里某条配置的 `apiUrl`。也就是说"用哪个接口、发往哪里"都是特惠专属字段，第三方 API 没有注入点。
3. **特惠视频节点绑定固定内置配置 `apiConfigId_discountVideo`**：该 ID 在初始化时存入 `localStorage`，节点面板只展示自己的 `discountVideoModel` 列表与 `discountVideoApiUrl`，**没有"切换 API 配置"的下拉入口**，用户没有任何路径把第三方 API 选进来。

> **【现状更新 2026-08-02】以上"硬隔离"结论已被打破——特惠视频节点现已能显示并选中第三方 API 里的视频模型。** 落地方式**没有**采用第 6 节（新增 UI / 改 url/key 来源）的探索方案，而是走了一条更轻的"注入式"路径：在 `localTool/data/apiConfigs.baseline.json` 的 tehuishipin 条目下挂 video 模型，前端在运行时把这些 video 模型 id 经 `setDiscountVideoApiConfigModels` 注入全局，并由 `Ki()` 合并进 `discountVideoModel` 列表回灌特惠面板。详见 **第 9 节 · 实际落地方案**。注意：本方案**不改**特惠节点的 API 地址/鉴权来源（仍走 `discountVideoApiUrl`/`discountVideoApiKey` 锁死的特惠通道），只扩展"可选模型清单"，因此不引入计费隔离风险（与第 6.4 担忧的"绕过特惠计费"不同）。

> 关于 `readonly` 的澄清（修正旧版误区）：普通节点的"API 配置"下拉**并非只显示第三方**。实际合并逻辑见第 2 节——`readonly: true` 的系统内置项与 `readonly: false` 的用户自建项**都会进入下拉**，只是内置项排在前面。特惠视频节点"看不到第三方"不是因为被 `readonly` 过滤掉了，而是因为它**压根不走这条 `apiConfigs` 下拉逻辑**（它用的是自己的 `discountVideoModel`/`discountVideoApiUrl`）。

下面逐层展开证据。

---

## 1. 两套模型体系的划分

前端存在**两套完全不同的模型显示机制**：

| 维度 | 普通节点（文生图/文生视频等） | 特惠视频节点（discountVideo） |
|------|------------------------------|------------------------------|
| 模型下拉数据来源 | `apiConfigs` 合并后的模型清单 | 独立字段 `discountVideoModel`（按 `\n` 拆分的纯文本） |
| API 地址来源 | 所选 `apiConfig` 配置里的 `apiUrl` | 独立字段 `discountVideoApiUrl`（独立配置字段，非下拉可选项） |
| 是否可切换 API 配置 | 是（右侧下拉，内置 + 自建都出现，内置排前） | 否（面板仅展示固定内置配置，无切换入口） |
| 第三方 API 可见性 | 可见（用户自建 `readonly:false` 配置会出现在下拉中） | 不可见（节点不走 `apiConfigs` 下拉逻辑） |
| 模型列表后端接口 | `/public/platform/builtin` + `/public/platform/models`（内置）+ 自建配置自带 | 直接随节点配置下发，无独立拉取 |

### 1.1 `discountVideoModel` 是硬编码文本字段

在 `App-BX6o9fW5.js` 中检索 `discountVideoModel`，可见它被当作一个 **string**（多行文本，用 `\n` 分隔每个模型名）处理：

```js
// 伪代码还原（来自压缩产物上下文）
node.discountVideoModel = "seedance_2_fast\nseedance_1_5_pro\n...（特惠专属模型列表）"
```

它**不从 `apiConfigs` 读取**，所以 `apiConfigs` 里有多少第三方 API，都影响不到特惠视频节点的下拉框。

### 1.2 普通节点的 `apiConfigs` 合并逻辑

普通节点模型下拉由 `Ti()`（压缩后的函数名）把内置配置与用户自建配置合并成 `apiConfigs`：

```js
// httpClient-BknZwXjG.js 中 Ti() 的还原逻辑
// 1. 先请求 /public/platform/builtin 拿到平台内置配置
// 2. 再读 localStorage / 用户保存在本地的自建 apiConfigs
// 3. 合并去重，得到完整 apiConfigs 数组
```

内置配置和用户自建配置在合并后都有 `readonly` 标记：

- 平台内置配置：`readonly: true`（不可编辑、不可删除）
- 用户自建第三方配置：`readonly: false`（可编辑、可删除）

---

## 2. 普通节点的"API 配置"下拉框：内置与自建都显示

旧版文档曾误写为"只显示第三方"，这是不准确的。通过还原压缩产物中的合并逻辑，实际行为是**内置（readonly）与自建（!readonly）两项都会进入下拉，仅排序不同**。

### 2.1 合并函数有两处，结论一致

**位置 A**（与 `CLOUD_STORAGE_CONFIG` 相关的 apiConfigs 加载，`App-BX6o9fW5.js`）：

```js
// e3 = 云端下发的配置；t3 = 本地已存的 apiConfigs
let n2 = e3.map(e4 => ({ ...e4, showKey: e4.showKey ?? false }));
let r3 = n2.filter(e4 => e4.readonly);      // 云端里的【系统内置】项
let i3 = n2.filter(e4 => !e4.readonly);     // 云端里的【用户自建】项
let a3 = t3.filter(e4 => e4.readonly);      // 本地已存的【系统内置】项
return [ ...(a3.length > 0 ? a3 : r3), ...i3 ];
//      ↑ 优先用本地内置，否则用云端内置   ↑ 再把自建拼在后面
```

**位置 B**（`loadAppSettings` 合并，带显式日志，`App-BX6o9fW5.js`）：

```js
let r3 = e3.filter(e4 => !e4.readonly);                 // 【用户自建】项
let i3 = t3.length > 0 ? t3 : n2.filter(e4 => e4.readonly); // 【系统内置】项（已存优先）
let a3 = [ ...i3, ...r3 ];
console.log("[loadAppSettings] apiConfigs 合并结果: 系统内置", i3.length, "个 + 用户自定义", r3.length, "个");
```

两处都把 `readonly` 与 `!readonly` 两类塞进同一个数组，**内置排前、自建排后**。

### 2.2 这对"特惠视频为何不显示第三方"意味着什么

- 普通节点的下拉**既看得到系统内置、也看得到自建第三方**（`readonly` 不是隐藏内置的开关，只是排序依据）。
- 因此旧版"普通节点能选第三方、但选不到系统内置"的表述是**错误**的——普通节点同样能选到系统内置。
- 特惠视频节点"看不到第三方"的真正原因**不是 `readonly` 过滤**，而是它**根本不调用这条 `apiConfigs` 下拉逻辑**：它的模型来自 `discountVideoModel`、地址来自 `discountVideoApiUrl`、配置 ID 来自固定的 `apiConfigId_discountVideo`，整条链路都与 `apiConfigs` 下拉解耦。

> 佐证：UI 文案中用"系统内置"与"自建"两类徽章区分（`内置` 标签 + `readonly` 标志），普通节点下拉两类徽章都会出现；特惠视频节点面板强制显示"内置"徽章且**无下拉入口**（见第 3 节）。

---

## 3. 特惠视频节点绑定固定的内置配置

初始化时，特惠视频节点被绑死到一条固定配置，并且**模型列表、API 地址都是独立常量**：

```js
// 压缩产物中可见的常量与副作用
node.apiConfigId_discountVideo = "...";  // 固定内置配置 ID，通过 useEffect 写入 localStorage
node.discountVideoModel      = "...";   // 特惠专属模型清单（text 类型，按 \n 拆分）
node.discountVideoApiUrl     = "...";   // 特惠专属 API 地址（如 discountVideoApiUrl: cr2 / u2 一类常量）
```

在字段类型表（`Bn`）中可确认这些字段的声明：

```js
var Bn = {
  videoDurations: "text",
  discountVideoModel: "text",   // ← 纯文本，不是从 apiConfigs 派生
  sd2VideoModel: "text",
  videoModel: "text",
  selectedModel: "text",
  ...
};
```

节点默认值合并阶段也把 `discountVideoModel` 直接喂给渲染状态（`discountVideoModel: Ur, ...`），而 `Ur` 来自硬编码清单，与 `apiConfigs` 完全无关。

该节点在 `apiConfigs` 合并阶段**不会**被注入一条可切换的配置对象，前端面板只有：

- 一个只读展示的"特惠视频模型"下拉（数据源 = `discountVideoModel`）；
- 一个隐藏/写死的 API 地址（`discountVideoApiUrl`）；
- **没有"API 配置"下拉入口**。

因为模型来源、API 地址、配置 ID 三者全部硬编码，用户**没有任何路径**把第三方 API 选进来。这就是"特惠视频节点里没有第三方 API"的直接原因——根因是**解耦**而非 `readonly` 过滤。

---

## 4. 内置模型列表的后端接口

普通节点的内置模型来自两个接口（均在 `httpClient-BknZwXjG.js` 中发起，baseURL 由调用方传入）：

```
GET {baseURL}/public/platform/builtin    // 内置模型权益 / 分类清单
GET {baseURL}/public/platform/models     // 内置模型系列明细
```

前端拉取逻辑（还原）：

```js
async function fetchBuiltin(baseURL) {
  let n2 = baseURL.replace(/\/$/, "");
  let a2 = await (await fetch(`${n2}/public/platform/builtin?t=${Date.now()}`)).json();
  if (a2.success && a2.data) { /* 写入 Mi（内置模型缓存） */ return Mi; }
  // catch 中：console.warn("[builtinFavorites] 拉取内置模型失败", e3)
}
// 另有 /public/platform/models 的拉取（Xi 函数），同样 try/catch 兜底
```

### 4.1 baseURL 在本地实际指向哪里

前端打包时，`VITE_API_BASE_URL` 占位符在 `localTool/src/index.ts` 启动时会被替换为本地地址：

```ts
// localTool/src/index.ts（约第 286 行）
const replaced = raw.replace(/\{VITE_API_BASE_URL\}/g, `http://127.0.0.1:${PORT}`);
```

即本地运行时，上述两个请求实际打到 **`http://127.0.0.1:<PORT>/public/platform/builtin`**，也就是本地 `localTool` 服务。

### 4.2 本地 `localTool` 是否实现了这两个路由

**结论：已补。** 2026-07-31 在 `localTool/src/routes/platform.ts` 新增 `handleBuiltin` 和 `handleModels`，返回静态兜底模型清单（数据来自 `apimart-gateway/main.py` Lovart 模型定义）。前端拉取时不再 404，本地"系统内置"模型下拉正常显示。

> **旧版状态（已修正）**：此前 localTool 无此路由，请求 404 → 前端静默回退。详见下方历史记录。

<details>
<summary>旧版分析（保留备查）</summary>

- `localTool/src/routes/platform.ts` 曾只注册了 `/plugin/manifest.json` 与 `/api/workflow-apps/*` 两个 stub，**不含 `/public/platform/*`**。
- `localTool/src/index.ts` 的路由表里只有 `/api/status`、`/api/kv/*`、`/api/files/*`、`/api/resources`、`/api/tasks`、`/api/proxy` 等，**没有 `/public/platform/builtin` 或 `/public/platform/models`**。
- `apimart-gateway/`（独立 Python 网关，端口 9004）源码中也检索不到 `builtin` / `platform` 路由。

因此本地运行时这两个请求会 **404**，前端 `catch` 后打印 `console.warn("[builtinFavorites] 拉取内置模型失败")`，并回退到空/默认清单。

</details>

> 内置接口在本地由 **localTool 静态清单兜底**（模型来自 Lovart 网关定义）；真正的动态实现位于**远端中心服务**（生产环境 baseURL 指向远端时才有完整数据）。本地兜底确保普通节点的"系统内置"模型下拉非空，特惠视频节点因模型随 `discountVideoModel` 硬编码下发，不受影响。

---

## 5. 数据流全景图

```
                 ┌──────────────────────────────────────────────┐
                 │  /public/platform/builtin  +  /public/platform/models │
                 │  (baseURL 本地指向 127.0.0.1:PORT；localTool 返回   │
                 │   静态 Lovart 模型清单兜底；生产指向远端中心服务)      │
                 └───────────────────────┬──────────────────────┘
                                         │ 内置配置 (readonly:true)
                                         ▼
   用户自建第三方 API (readonly:false) ─┐
                                       ▼
                            合并 → apiConfigs[]（内置排前 + 自建排后）
                                       │
                 ┌─────────────────────┼──────────────────────────┐
                 ▼                     ▼                          ▼
         普通节点: 模型下拉      普通节点: API配置下拉            特惠视频节点:
         来自合并后的模型清单    内置 + 自建都出现(内置在前)       绑定固定 内置配置
                 │                     │                          │  apiConfigId_discountVideo
                 │                     │                          │  模型 = discountVideoModel(硬编码文本)
                 │                     │                          │  地址 = discountVideoApiUrl(硬编码)
                 ▼                     ▼                          ▼
         能看到第三方 API         能看到第三方 API            看不到任何第三方 API ✅
         (也能看到系统内置)        (也能看到系统内置)          (整条链路与 apiConfigs 解耦)
```

---

## 6. 如果要让特惠视频节点同时显示第三方 API（探索性方案 · ⚠️ 未采用）

> **状态（2026-08-02）**：本节是 2026-07-31 的探究性方案，**实际落地未采用本方案**（见第 9 节）。本节保留作为"完整重构特惠节点"的备选路线，但当前线上版本走的是更轻的"注入式"路径，与本节第 6.7/6.8 的"加 API 配置下拉 + 改 url/key 来源"思路不同。
>
> 本节基于对 `dist` 压缩产物的静态分析给出改造路线。当前**只有前端压缩产物、无前端源码**，因此下列改动点以"应改哪里、改成什么样"描述，落地时需在对应源码位置（打包前的 TSX/TS）实现。所有论断均可在 `App-BX6o9fW5.js` / `httpClient-BknZwXjG.js` 中找到对应证据。

### 6.0 先厘清：为什么现在"同时显示"做不到

特惠节点与普通节点在**调用态**就已分叉，不是下拉项多少的问题：

| 调用点 | 普通视频节点（`video`/`sd2Video`） | 特惠视频节点（`discountVideo`） |
|--------|-----------------------------------|--------------------------------|
| 请求地址 `m3` | `` `${(e3.apiUrl\|\|o2)...}/v1/vi...` `` —— 取自**节点绑定的 `e3.apiUrl`**（来自选中 apiConfig） | `` `${(u2\|\""")...}/v1/gateway/task/${g3}` `` —— 取自**组件闭包变量 `u2`**，而 `u2 = discountVideoApiUrl` 固定字段 |
| 鉴权头 | 取 `e3.apiKey` | 取闭包变量 `d2 = discountVideoApiKey` |
| 模型下拉 | 从 `apiConfigs` 合并后的模型清单 | 从 `discountVideoModel`（硬编码 `\n` 文本 `Ur`） |

也就是说：普通节点是 **`e3.apiUrl` 驱动**（选了哪个 apiConfig，就用它的 url/key/模型）；特惠节点是 **`u2`/`d2` 固定常量驱动**，根本不读 `e3.apiUrl`。要让特惠节点"同时显示第三方 API"，本质是**把特惠节点的 `u2`/`d2`/模型从"固定字段"切换成"可从 apiConfigs 选中"**。

### 6.1 改造点一：模型下拉改为从 `apiConfigs` 取

- **现状**：面板模型下拉数据源 = `discountVideoModel`（字段类型 `"text"`，按 `\n` 拆分的纯文本 `Ur`）。
- **改法**：当节点处于"自定义 API"模式时，模型下拉改为遍历合并后的 `apiConfigs`，取选中配置的模型清单（普通节点同理，其模型来自 `apiConfigs` 合并结果）。
- **注意**：第三方配置目前多为 `apiUrl` + `apiKey` 结构（见 6.3），不一定自带 `modelList` 字段。若第三方配置没有模型清单，需约定字段（如 `models:["..."]`）或在 UI 上允许"手动输入模型名"。

### 6.2 改造点二：新增"API 配置"下拉入口（核心）

- **现状**：特惠节点面板**没有** `apiConfigs` 下拉，地址直接吃 `u2`、key 直接吃 `d2`。
- **改法**：在特惠节点面板加一个与普通节点同款的"API 配置"下拉，数据源同样是合并后的 `apiConfigs`（内置 `readonly:true` + 自建 `readonly:false` 都出现，内置排前——见第 2 节 `a3=[...i3,...r3]`）。
- **过滤策略**（二选一）：
  - **方案 A（保守）**：仅允许带 `allowInDiscount: true` 标记的配置进入该下拉（内置特惠配置 + 用户显式勾选的第三方），避免用户把任意第三方塞进特惠链路。
  - **方案 B（开放）**：下拉条件从普通节点的"全部 apiConfigs"直接复用，不加额外过滤——但这会让**所有**自建第三方都出现在特惠节点，绕过特惠专属定价（见 6.4 风险）。
- **选中后联动**：把选中项的 `apiUrl` 赋给特惠节点调用时的地址变量（替换掉 `u2`），`apiKey` 赋给鉴权头（替换掉 `d2`），实现"选哪个配置就发往哪里"。

### 6.3 改造点三：第三方配置对象需补齐字段

普通/第三方配置在产物中可见的结构为 `{ apiUrl, apiKey, method, body, readonly, ... }`（如 `apiUrl:"接口地址"`、`apiKey` 等）。要让特惠节点消费第三方，需确认/补齐：

- `apiUrl`：必填，特惠调用会拼 `/v1/gateway/task/...` 后缀。若第三方基址不同（如不是 `/v1/gateway/task` 路径），需在配置上记录**路径模板**或节点内做兼容分支。
- `apiKey`：必填，作为 `Authorization: Bearer ${d2}`。
- 模型清单：可选（见 6.1）。
- 建议新增 `allowInDiscount`（见 6.2 方案 A）与可选 `pathTemplate` 字段。

### 6.4 改造点四：计费/额度隔离风险（务必业务确认）

特惠视频（discountVideo）通常有**专属定价与额度**，原设计把 url/key 锁死在 `discountVideoApiUrl`/`discountVideoApiKey` 就是为了**强制走特惠计费通道**。一旦放开让第三方 API 进入：

- 用户可选用自建第三方地址，**绕过特惠计费**，造成额度/财务漏洞；
- 第三方接口的响应结构（`/v1/gateway/task` 的状态码 `e4===3/"success"/"completed"` 轮询逻辑）可能与第三方不一致，需做响应兼容。

因此 6.2 的**方案 A（显式 `allowInDiscount` 白名单）** 优于方案 B，且需后端/业务层对"哪些第三方允许进入特惠"做审批。

### 6.5 改造点五：本地内置模型路由（可选）

若希望特惠节点的"内置"分支在本地也有数据，需在 `localTool/src` 实现 `/public/platform/builtin` 与 `/public/platform/models`（当前 404 兜底，见第 4.2 节）。但注意：特惠节点默认模型来自硬编码 `discountVideoModel`，**不依赖这两个接口**，所以此步仅影响"想在本地看到系统内置模型清单"的场景，并非"显示第三方"的必需项。

### 6.6 落地小结（按优先级）

1. **必做**：6.2 加 API 配置下拉 + 6.1 模型下拉联动（把 `u2`/`d2` 改为从选中 apiConfig 取）。
2. **必做**：6.3 确认第三方配置字段，必要时加 `allowInDiscount` / `pathTemplate`。
3. **必确认**：6.4 计费隔离，优先采用白名单方案 A。
4. **可选**：6.5 本地路由，仅影响内置模型本地展示。

> 受限说明：当前无前端源码，仅能定位"压缩产物中对应逻辑的位置与变量名（`u2`/`d2`/`Ur`/`e3.apiUrl`/`apiConfigs` 合并数组 `a3`）。实际改写需在打包前源码中进行，并重新构建验证。

### 6.7 奥卡姆剃刀补法（最小改动版）

**原则**：不新造 UI、不新增数据通路、不引入新字段；只复用系统已经为其他节点类型写好的那套机制。

**关键证据——每个节点类型都有一套"选中 apiConfig → 取 url/key"的既有配对逻辑**：

```js
// 普通 video 节点（产物实证）
Y.find(e4=>e4.id===di) || Y[0];  a3 && (nr2(a3.url), ir2(a3.key));   // 取出 .url/.key 写入该节点专属 state
// audio 节点
Y.find(e4=>e4.id===pi) || Y[0];  o2 && (lr2(o2.url),  dr2(o2.key));
// 其它（sd2Video / aiApp 等）同理，各自一套 .find(id) → .url/.key
```

其中 `Y` 即合并后的 `apiConfigs`（`[...内置, ...自建]`），`di`/`pi`/... 是各节点当前选中的配置 ID（存于 `localStorage`，如 `apiConfigId_audio`、`apiConfigId_discountVideo`）。

**特惠节点 `discountVideo` 的唯一"异常"**：它**没有**走这套 `.find(id) → .url/.key`，而是直接用闭包常量 `u2 = discountVideoApiUrl`、`d2 = discountVideoApiKey`（固定字段），且配置文件里把 `discountVideoApiUrl`/`discountVideoApiKey` 当独立项塞进同一个配置对象（见 `discountVideoApiUrl:u2,discountVideoApiKey:d2`）。

**因此"奥卡姆剃刀补法"只需两步，复用既有机器：**

1. **把特惠的 `u2`/`d2` 改为由 `apiConfigs.find(选中ID)` 驱动**（与其他节点完全一致）：
   - 现有：特惠节点面板无下拉、`u2`/`d2` 吃固定字段。
   - 最小改：给特惠节点复用普通节点的"API 配置"下拉组件（它已存在，只是特惠面板没挂），选中后执行与其他节点同款的 `Y.find(e4=>e4.id===选中ID) → 取 .url 赋 u2、.key 赋 d2`。
   - **不动** `u2`/`d2` 的下游消费（`m3=${(u2||"")...}/v1/gateway/task/...` 与 `Bearer ${d2}` 完全不用改）——只换上游来源，改动面最小。

2. **模型下拉同理复用**：把特惠面板模型下拉的数据源从硬编码 `discountVideoModel`（`Ur`）切到"选中 apiConfig 的模型清单"，与普通节点共用同一渲染分支即可（普通节点模型下拉已能从 `apiConfigs` 取）。

**为什么这是"剃刀"最优解**：
- 不新增任何字段（无需 `allowInDiscount`、`pathTemplate`，除非要做白名单，那属于 6.4 的业务加固，不是功能最小集）；
- 不新写 UI（复用已存在的 apiConfig 下拉组件）；
- 下游 `m3`/`Bearer` 拼接逻辑零改动，风险最低；
- 仅打通"上游来源 = apiConfigs 选中项"这一处断点，特惠节点即与普通节点对称，自然能选到第三方。

**仍需注意的 1 个前提**：若第三方的"路径模板"不是 `/v1/gateway/task/...`，则 `m3` 拼接后缀会错。此时奥卡姆做法不是改 `m3` 分支，而是在 apiConfig 上**复用已有的 `apiUrl` 字段存完整基址**，或让第三方配置自带 `pathTemplate`——但若追求最小集，可先约定"进入特惠的第三方其 `apiUrl` 需为兼容 `/v1/gateway/task` 的网关地址"，避免改调用代码。计费隔离风险见 6.4，属业务开关而非功能改动。

### 6.8 Diff 级改造清单（奥卡姆最小集）

> 以下以"打包前源码函数/组件"为单位给出改动点。变量名取自 `dist` 压缩产物（`App-BX6o9fW5.js`），对应源码中同名或等价函数。改动面仅 2 处函数 + 1 处组件挂载，下游零改动。

#### 改动 A：共享 apiConfig 初始化函数（给特惠补上 `.find(id)→.url/.key` 配对）

**位置**：各节点 `apiUrl/apiKey` 统一初始化的那段（产物中连续出现 `Y.find(e4=>e4.id===di)→nr2/ir2`、`e4.id===pi`→`lr2/dr2`、`e4.id===mi`、`e4.id===hi` 等，每个节点一对；`Y = apiConfigs`）。

**现状（伪代码）**：
```js
let a3 = Y.find(e4=>e4.id===di) || Y[0]; a3 && (nr2(a3.url), ir2(a3.key)); // video
let o2 = Y.find(e4=>e4.id===pi) || Y[0]; o2 && (lr2(o2.url), dr2(o2.key)); // audio
// ... sd2Video / aiApp 等同款
// ❌ 缺少 discountVideo 的配对 → u2/d2 始终是固定字段
```

**改为（+2~3 行）**：
```js
// 新增：特惠视频节点，与其他节点同款从 apiConfigs 取 url/key
let dv = Y.find(e4=>e4.id===dvId) || Y[0];   // dvId = 当前选中的特惠配置 ID（localStorage "apiConfigId_discountVideo"）
dv && (setDiscountVideoUrl(dv.url), setDiscountVideoKey(dv.key));  // 替换原 u2 / d2 的来源
```
> 注：原 `u2`/`d2` 是闭包常量，源码里应改为受 state 控制的变量（如 `discountVideoUrl` / `discountVideoKey`），由上面这行赋值驱动。下游 `m3=${(discountVideoUrl||"")...}` 与 `Bearer ${discountVideoKey}` **不改**。

#### 改动 B：特惠节点面板组件（挂上已存在的 apiConfig 下拉 + 模型下拉联动）

**位置**：渲染 `discountVideoNode`（特惠视频）面板的组件，当前**没有**"API 配置"下拉，模型下拉直接吃 `discountVideoModel`。

**改动 B1（下拉挂载，复用现有组件）**：
- 引入普通节点已在用的 "API 配置" `<select>` 组件（数据源 `apiConfigs`，内置排前+自建排后）。
- `onChange`：写入 `localStorage["apiConfigId_discountVideo"] = 选中ID`，并触发改动 A 的 `Y.find` 重新取值（或直接在 onChange 里 `setDiscountVideoUrl / setDiscountVideoKey`）。
- **不新写下拉逻辑**，仅把现有组件在特惠面板 JSX 里再挂一次。

**改动 B2（模型下拉数据源）**：
- 现：`value`/`options` 来自 `discountVideoModel.split("\n")`（硬编码 `Ur`）。
- 改：当"API 配置"下拉选中某项时，模型下拉 `options` 改为该配置的模型清单（与普通节点共用同一渲染分支）；保留 `discountVideoModel` 作为"未选配置时的默认清单"兜底。

#### 改动 C（可选，白名单加固，非最小集）

若业务要求不能让任意第三方进特惠（见 6.4），在改动 B1 的下拉 `options` 上加过滤：
```js
apiConfigs.filter(c => c.readonly /* 内置特惠 */ || c.allowInDiscount /* 显式允许的第三方 */)
```
此步属 6.4 业务开关，**不在奥卡姆最小集内**，按需追加。

#### 不动清单（明确排除，降低风险）

| 不动项 | 原因 |
|--------|------|
| `m3 = ${(u2||"")...}/v1/gateway/task/${g3}` 拼接逻辑 | 上游 url 来源改了，下游拼接照常工作 |
| `Authorization: Bearer ${d2}` 鉴权头 | `d2` 改为由选中配置 `.key` 驱动即可，头本身不改 |
| `/public/platform/builtin`、`/models` 路由（localTool） | 特惠默认模型来自硬编码，不依赖此接口（见 6.5） |
| 新增 `allowInDiscount` / `pathTemplate` 字段 | 最小集不需要；仅白名单/路径兼容时才加（见 6.3/6.4） |
| 其他节点（video/audio/sd2Video）的 `.find` 配对 | 已正常工作，勿动 |

#### 验收口径

1. 特惠节点面板出现"API 配置"下拉，含系统内置 + 自建第三方（内置排前）。
2. 选中某第三方配置后，请求地址 `m3` 变为该配置 `apiUrl` + `/v1/gateway/task/...`，鉴权头为其 `apiKey`。
3. 模型下拉随选中配置切换；未选时回退 `discountVideoModel` 默认清单。
4. 其他节点行为无任何回归。

---

## 7. 证据索引（压缩产物中的关键片段）

### `dist/assets/App-BX6o9fW5.js`
- `discountVideoModel`：出现在字段类型表 `Bn`（`discountVideoModel:"text"`）、默认值合并（`discountVideoModel:Ur`）、默认值回退（`(t3.discountVideoModel||"").split("\n")[0]`）—— 确认是**按 `\n` 拆分的纯文本字段**，与 `apiConfigs` 无关。
- `discountVideoApiUrl`：特惠视频节点专属 API 地址常量（`discountVideoApiUrl:cr2` / `discountVideoApiUrl:u2`），证明地址也写死。
- `apiConfigId_discountVideo`：通过 `useEffect` 写入 `localStorage.setItem("apiConfigId_discountVideo", pi)`，固定内置配置 ID。
- `discountVideoNode` / `discountVideo:{label:...}`：节点类型与面板标签，确认面板无 API 配置下拉入口。
- **API 配置合并逻辑（位置 A）**：`r3=n2.filter(e4=>e4.readonly); i3=n2.filter(e4=>!e4.readonly); a3=t3.filter(e4=>e4.readonly); return[...(a3.length>0?a3:r3),...i3];` —— 内置 + 自建都进数组，内置排前。
- **API 配置合并逻辑（位置 B，`loadAppSettings`）**：`r3=e3.filter(e4=>!e4.readonly); i3=t3.length>0?t3:n2.filter(e4=>e4.readonly); a3=[...i3,...r3]; console.log("[loadAppSettings] apiConfigs 合并结果: 系统内置",i3.length,"个 + 用户自定义",r3.length,"个")` —— **直接证明内置与自建都显示**。
- 另外 `Y.filter(e4=>!e4.readonly)` 出现在"恢复默认"等少数非下拉场景，属于特定按钮逻辑，**不要把它误读为整个下拉只显示第三方**。

### `dist/assets/httpClient-BknZwXjG.js`
- 内置模型请求：`await fetch(`${n2}/public/platform/builtin${r2}`)`（函数内 `n2=e2.replace(/\/$/,"")` 即 baseURL）；另有 `/public/platform/models` 拉取（函数 `Xi`）。
- 失败时：`console.warn("[builtinFavorites] 拉取内置模型失败", e3)` —— 静默回退。

### `localTool/src/index.ts`
- 约第 286 行：`raw.replace(/\{VITE_API_BASE_URL\}/g, http://127.0.0.1:${PORT})` —— 前端 baseURL 在本地被替换为 localTool 本地地址。
- 路由表仅含 `/api/status`、`/api/kv/*`、`/api/files/*`、`/api/resources`、`/api/tasks`、`/api/proxy` 等，**无 `/public/platform/*`**。

### `localTool/src/routes/platform.ts`
- 仅 `handlePluginManifest`（`/plugin/manifest.json`）与 `handleWorkflowAppsByProject`（`/api/workflow-apps/*`）两个 stub，**无 `/public/platform/builtin` / `/public/platform/models` 实现**。

### `apimart-gateway/`
- 独立 Python 网关（端口 9004），源码中检索不到 `builtin` / `platform` 路由；内置接口实现位于更上层的远端中心服务。

---

## 8. 本次修订纠正/补充的要点

| 旧版表述 | 修订后 |
|----------|--------|
| 普通节点 API 配置下拉 `.filter(!readonly)` **只显示第三方** | 实际**内置 + 自建都显示**（内置排前），有 `console.log` 明证 |
| "普通节点能选第三方、但选不到系统内置" | 普通节点**同样能选到系统内置**；特惠视频"看不到第三方"根因是**链路解耦**，不是 `readonly` 过滤 |
| 特惠视频节点只靠 `discountVideoModel` 与 `apiConfigId_discountVideo` 隔离 | 补充 **`discountVideoApiUrl` 独立写死字段**，地址维度也隔离 |
| 内置接口仅 `/public/platform/builtin` 一个、由"远端/网关"提供 | 实际有 **`/builtin` 与 `/models` 两个**；baseURL 本地指向 `127.0.0.1:PORT`，localTool 无路由 → 404 兜底，生产指向远端才有数据 |

---

*本文件为探索性分析文档，结论基于静态代码推断 + 压缩产物片段还原，未运行实机验证。如需落地改造，建议先在 `localTool` 与远端中心服务中确认内置接口真实归属与鉴权方式。*

---

## 9. 实际落地方案（2026-08-02 · 注入式最小改动）

> **与第 6 节的关系**：第 6 节是"完整重构特惠节点（加 UI + 改 url/key 来源）"的探索方案，**未采用**。本节省力、零回归、不碰计费通道，实际已上线。
> **核心思路**：不新增 UI、不改特惠节点的 API 地址/鉴权来源，**只把 baseline 里第三方 API 的视频模型 id 注入到 `discountVideoModel` 列表**，让特惠面板"能选到"这些模型。选中后生成请求**仍走锁死的 `discountVideoApiUrl`/`discountVideoApiKey` 特惠通道**（由 Vr.jsx 的 `pi='tehuishipin'` → `lr(o.url)`/`dr(o.key)` 注入，网关地址 = localTool），因此**不引入第 6.4 担忧的计费绕过风险**。

### 9.1 数据流（落地后）

```
localTool/data/apiConfigs.baseline.json
   │  tehuishipin 条目新增 video 模型（seedance-2.0-fast / seedance-2 / kling-v3-omni）
   │  + 顶层 discountVideoModel 字段（兜底清单）
   ▼
localTool /api/sync/default 直接读 baseline 原样返回（index.ts 已支持）
   ▼
Vr.jsx (App-BX6o9fW5) 拿到 apiConfigs → Y state
   │  useEffect 遍历 Y，抽取每个 config.models 里 type==='video' 的 id
   │  → setDiscountVideoApiConfigModels(ids)   // 注入全局模块变量
   ▼
httpClient-BknZwXjG_components/shared.js
   │  Ki() 读取 discountVideoApiConfigModels，合并进 discountVideoModel 列表
   │  （无论云端 Ni 是否加载，都追加，去重）
   ▼
特惠面板模型下拉（discountVideoModel）出现第三方 video 模型 ✅
   │ 选中后提交
   ▼
特惠通道：discountVideoApiUrl(=localTool 网关) + discountVideoApiKey(运行时 We() 自动生成)
   → /v1/gateway/generate
```

### 9.2 具体改动清单（4 处文件）

#### 改动 1 · `localTool/data/apiConfigs.baseline.json`（数据层）

- tehuishipin 条目**修正 + 扩充**：补 `id:'tehuishipin'`、`url:'{VITE_API_BASE_URL}'`、`key:''`、`readonly:true`（此前 Url/apiUrl 大写、缺字段）；`models` 数组内新增 3 个 video 模型：
  ```json
  { "id": "seedance-2.0-fast", "type": "video", "label": "Seedance 2.0 Fast" },
  { "id": "seedance-2",        "type": "video", "label": "Seedance 2" },
  { "id": "kling-v3-omni",     "type": "video", "label": "Kling V3 Omni" }
  ```
- 文件**顶层新增** `discountVideoModel` 字段（换行分隔的兜底清单，含上述 3 个 + 原默认）：
  ```json
  "discountVideoModel": "seedance_2_fast\nseedance-2.0-fast\nseedance-2\nkling-v3-omni"
  ```

#### 改动 2 · `httpClient-BknZwXjG_components/shared.js`（主模块，模型清单合并逻辑）

- 在 `var Mi = null; var Ni = [];`（约 2217 行）之后新增全局变量 + setter：
  ```js
  var discountVideoApiConfigModels = [];
  function setDiscountVideoApiConfigModels(e) {
    discountVideoApiConfigModels = e || [];
    zi();   // 全局 forceUpdate（遍历 Li 订阅者），触发特惠面板刷新
  }
  ```
- 改写 `Ki()`（原约 2398 行）—— **关键修复**：原逻辑在"云端 Ni 已加载"分支只返回 `isDiscountVideo` 模型，导致注入的第三方 video 模型被过滤掉（这正是首版上线后下拉为空的根因）。改为**两个分支都追加** `discountVideoApiConfigModels`（去重）：
  ```js
  function Ki() {
    let e;
    if (Ni.length > 0) {
      e = Ni.filter(t => { return t.isDiscountVideo; }).map(t => { return t.modelName; });
    } else {
      e = $i();
    }
    if (discountVideoApiConfigModels.length > 0) {
      let n = new Set(e);
      e = [...e, ...discountVideoApiConfigModels.filter(t => { return !n.has(t); })];
    }
    return e;
  }
  ```
- 主 `export { ... }` 末尾追加导出 `setDiscountVideoApiConfigModels`（经 `httpClient-BknZwXjG.js` 的 `export *` 透传）。

#### 改动 3 · `App-BX6o9fW5_components/shared.js`（facade 层）

> 该文件是 Vr.jsx 实际 import 的 facade，它显式 `import { ... } from '../httpClient-BknZwXjG.js'` 并显式 re-export。**两个 shared.js 同名 `Y` 是混淆重名、非同一数据**（facade 的 `Y`=Ar 常量，Vr.jsx 的 `Y`=apiConfigs state），子组件不能直接读 Vr 的 apiConfigs，故必须走"全局 setter"桥接。

- import 列表末尾补 `setDiscountVideoApiConfigModels`（来自 `../httpClient-BknZwXjG.js`）。
- export 列表末尾补 `setDiscountVideoApiConfigModels`。

#### 改动 4 · `App-BX6o9fW5_components/Vr.jsx`（主 App，注入触发点）

- import 段引入 `setDiscountVideoApiConfigModels`。
- 在依赖 `[Y, ai, si, li, di, pi, mi, hi]` 的 useEffect（约 794 行后，原 `lr(o.url)/dr(o.key)` 特惠配对之后）追加：
  ```js
  let discountVideoModels = [];
  for (let e of Y) {
    let t = e.models;
    if (Array.isArray(t)) {
      for (let n of t) {
        if (n.type === 'video' && n.id) { discountVideoModels.push(n.id); }
      }
    }
  }
  setDiscountVideoApiConfigModels(discountVideoModels);
  ```

### 9.3 生效条件与验证

- **必做**：重启 localTool（重新读 baseline）+ **刷新浏览器插件加载新打包产物**（`npm run build` 回灌 `dist/`）。首版因只重启 localTool、未刷新插件，导致下拉仍空。
- **构建/质量门**：`npm run build` 成功 → `node scripts/rename.cjs` 同步 readable → `node scripts/smoke_test.cjs` ALL PASS。
- **真机验收**：打开特惠视频节点，模型下拉出现 Seedance 2.0 Fast / Seedance 2 / Kling V3 Omni；选中后走 localTool 网关 `/v1/gateway/generate`（key 由 `We()` 运行时自动注入）。

### 9.4 与第 6 节方案的关键差异（为何选注入式）

| 维度 | 第 6 节探索方案 | 9.x 实际落地 |
|---|---|---|
| 是否新增 UI | 是（特惠面板加 API 配置下拉） | 否，复用现有 `discountVideoModel` 下拉 |
| 是否改 url/key 来源 | 是（特惠改由选中 apiConfig 驱动） | 否（仍走锁死特惠通道，无计费绕过风险） |
| 改动面 | 2 函数 + 1 组件挂载，较大 | 4 处文件、每处数行，最小 |
| 计费隔离风险 | 有（需白名单 `allowInDiscount` 加固） | 无（地址/鉴权不变） |
| 用户能否切换 API | 能（下拉选不同第三方） | 不能（但需求本就只要求"能选到第三方视频模型"，已满足） |

> 结论：用户 2026-08-02 确认"如果能被识别为内置模型也可以"，即接受这些模型作为特惠清单项出现即可，不要求切换 API 配置入口——故注入式最小方案恰满足需求。若未来需"用户自选第三方 API 配置并切换通道"，再启用第 6 节方案（届时务必补 §6.4 计费隔离）。

---

## 附录：6.8 节改造清单 —— 可直接粘贴的代码片段

> **用途**：官方更新版本后，前端源码持有者拿到此附录，即可快速将特惠视频节点改造为"可切换第三方 API"。以下代码基于 6.8 节 Diff 级改造清单写成，变量名对齐文档中的混淆产物分析（`Y` = `apiConfigs`、`u2` = `discountVideoApiUrl`、`d2` = `discountVideoApiKey`），实际使用时替换为源码中的真实变量名。

### A. apiConfig 初始化函数 —— 给特惠补 `.find(id) → url/key`

**位置**：`apiConfigs` 合并后的初始化函数（各节点统一从这里取 `url`/`key`）

```tsx
// 在现有 video/audio/sd2Video 等节点的 .find 配对之后追加：

// 特惠视频节点：与其他节点同款，从 apiConfigs 取 url/key
const dvCfg = apiConfigs.find(cfg => cfg.id === discountVideoConfigId) || apiConfigs[0];
if (dvCfg) {
  setDiscountVideoUrl(dvCfg.url);
  setDiscountVideoKey(dvCfg.key);
}
```

> 注意：原先 `discountVideoApiUrl` / `discountVideoApiKey` 是节点配置对象里的固定字段。改后需要把它们改为 React state（如 `useState`），由上面这段赋值驱动。下游 `m3` 拼接和 `Bearer` 鉴权头**不改**，只是上游来源从固定常量变成了 `dvCfg.url` / `dvCfg.key`。

### B1. 特惠面板 —— 挂 API 配置下拉

**位置**：渲染特惠视频节点面板的 JSX 组件

```tsx
{/* 新增：API 配置下拉（复用普通节点已有组件，数据源 apiConfigs，内置排前 + 自建排后） */}
<div className="api-config-selector">
  <label>API 配置</label>
  <select
    value={discountVideoConfigId}
    onChange={(e) => {
      const selectedId = e.target.value;
      localStorage.setItem('apiConfigId_discountVideo', selectedId);
      // 触发 A 中的 .find 逻辑
      const cfg = apiConfigs.find(c => c.id === selectedId);
      if (cfg) {
        setDiscountVideoUrl(cfg.url);
        setDiscountVideoKey(cfg.key);
        // 模型下拉也联动切换（见 B2）
        setSelectedDiscountModel(cfg.models?.[0] || discountVideoModelList[0]);
      }
    }}
  >
    {/* 内置配置（readonly:true）排前 */}
    {apiConfigs.filter(c => c.readonly).map(cfg => (
      <option key={cfg.id} value={cfg.id}>
        [内置] {cfg.name}
      </option>
    ))}
    {/* 自建配置（readonly:false）排后 */}
    {apiConfigs.filter(c => !c.readonly).map(cfg => (
      <option key={cfg.id} value={cfg.id}>
        [自建] {cfg.name}
      </option>
    ))}
  </select>
</div>
```

### B2. 模型下拉数据源联动

**位置**：特惠面板中模型 `<select>` 的 `options` 来源

```tsx
{/* 模型下拉：选中 API 配置后用该配置的模型清单；未选时用硬编码 discountVideoModel 兜底 */}
<select
  value={selectedDiscountModel}
  onChange={(e) => setSelectedDiscountModel(e.target.value)}
>
  {(discountVideoConfigId
    ? (apiConfigs.find(c => c.id === discountVideoConfigId)?.models || discountVideoModelList)
    : discountVideoModelList
  ).map(modelName => (
    <option key={modelName} value={modelName}>{modelName}</option>
  ))}
</select>
```

> 其中 `discountVideoModelList` = `discountVideoModel.split('\n')`（硬编码文本），`selectedDiscountModel` 是当前选中的模型名 state。

### C. 可选白名单过滤（按需追加）

```tsx
{/* 若业务要求不能让任意第三方进特惠，在 B1 下拉 options 上加过滤 */}
{apiConfigs
  .filter(c => c.readonly || c.allowInDiscount)  // 内置特惠 + 显式允许的第三方
  .map(cfg => (...))}
```

### 不动清单

| 不动项 | 原因 |
|--------|------|
| `m3 = ${(url||'')...}/v1/gateway/task/${taskId}` | 上游 url 来源改了，下游拼接照常 |
| `Authorization: Bearer ${key}` | key 改为由选中配置驱动即可，头本身不改 |
| 其他节点（video/audio/sd2Video）的 `.find` 配对 | 已正常工作，勿动 |
| `/public/platform/builtin`、`/models` 路由（localTool） | 已补静态兜底，本地可用 |
