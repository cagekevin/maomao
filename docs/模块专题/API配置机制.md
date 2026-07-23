# API 配置机制（模块专题 · 按需查阅）

> 事实锚点：grep `src/config.js`、`src/config/storageKeys.js`、`src/config/constants.js`、`src/App.js`、`src/hooks/useLocalTool.js`、`src/utils/storage/index.js`（行号快照 2026-07-23）坐实。
> 行号随构建漂移，主引用用函数/语义名 + 真实路径；动手前回源码复核当前行号。
> 本文只写代码里已存在的机制，不写方案、不写待决策。
> 与本文件直接衔接：《GAS云同步机制.md》《中转资源本地落盘机制.md》《节点体系（AI 生成）篇》（见 README）。

---

## 一、这是什么

应用运行时要对接**三类后端地址**，配置方式各不相同：

| 后端 | 默认地址 | 性质 | 谁在用 |
|---|---|---|---|
| AI 网关（第三方 OpenAI 兼容协议） | `:9004` | 硬编码常量 + 用户可改（api 配置） | 节点 AI 生成 |
| 本地引擎 localTool（KV / 文件落盘） | `:18080` | 硬编码常量 | 资源中转落盘、KV 存储 |
| GAS 云同步 endpoint | Google Apps Script `exec` 地址 | 硬编码常量 | 云端推送/拉取 |

一句话：`:9004` 与 `:18080` 的**端口号**是写死的常量；但 `:9004` 指向的**具体网关 URL** 可被用户在每个节点类型的「API 配置」里替换，`GAS` 地址目前只能改源码常量。

---

## 二、硬编码常量（`src/config.js`）

全部集中在 `src/config.js`，是「逆向还原版」集中接管原版散落硬编码地址的地方（文件头注释明说：便于替换为你们自己的后端）。

**1. 本地引擎 localTool（`:18080`）**

```12:18:src/config.js
export const LOCAL_ENGINE = {
  host: '127.0.0.1',
  port: 18080,
  get base() {
    return `http://${this.host}:${this.port}`;
  },
};
```

`JIANYING_PORT` 同为 `18080`，但注释标「已禁用，保留定义」：

```21:21:src/config.js
export const JIANYING_PORT = 18080;
```

便捷开关 `USE_LOCAL_ENGINE`：

```36:36:src/config.js
export const USE_LOCAL_ENGINE = true;
```

`localEngineBase()` 按开关决定走本地还是远程基址：

```42:44:src/config.js
export function localEngineBase() {
  return USE_LOCAL_ENGINE ? LOCAL_ENGINE.base : REMOTE_BASE;
}
```

`constants.js` 里这些常量被拆成短名到处用（`Hr`=本地基址、`Bc`=端口、`vv`=本地 base）：

```13:13:src/config/constants.js
var Hr = localEngineBase();
```

```25:25:src/config/constants.js
var Bc = LOCAL_ENGINE.port;
```

```39:39:src/config/constants.js
var vv = LOCAL_ENGINE.base;
```

**2. AI 网关（`:9004`）**

接入点列表、默认接入点、远程基址、默认网关 URL **全部写死为同一个 `http://127.0.0.1:9004`**：

```25:30:src/config.js
export const ENDPOINTS = [
  { label: 'API网关', url: 'http://127.0.0.1:9004' },
];

// 默认接入点
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:9004';
```

```39:39:src/config.js
export const REMOTE_BASE = 'http://127.0.0.1:9004';
```

```59:59:src/config.js
export const DEFAULT_GATEWAY_URL = DEFAULT_ENDPOINT;
```

> ⚠️ **关键点**：这 4 个 `:9004` 常量只是**兜底默认值**。节点实际发起 AI 请求时用的 URL 来自用户「API 配置」里的 `url` 字段（见 §三），不是这里写死的常量。设置面板里网关地址输入框的初始值就是 `DEFAULT_GATEWAY_URL`：
> ```40630:40631:src/App.js
>     ot = DEFAULT_GATEWAY_URL,
>     [st, ct] = Y.useState(ot),
> ```

默认模型也集中在这里（`DEFAULT_MODELS`，本地单人模式默认走 `:9004 → Lovart`）：

```80:87:src/config.js
export const DEFAULT_MODELS = {
  text: 'lovart-chat',
  drawing: 'gpt-image-2-low',
  video: 'seedance-2-fast',
};
```

**3. GAS 云同步 endpoint**

```75:75:src/config.js
export const GAS_CLOUD_SYNC_URL = "https://script.google.com/macros/s/AKfycbwI6PvC1v8Bv1E-0aKGx1PQ3AIH5SIUUKjTeDHtq5UxxF3qFFHj8DCr1QvflPDqFdI5/exec";
```

注释要求该地址部署为「所有人可访问」。被 `CloudSyncEngine.config.gasUrl` 直接引用（`src/App.js` ≈L41314，详见《GAS云同步机制.md》）。

---

## 三、用户可改的配置项（存哪里、UI 在哪改）

所有用户级配置都落在 **localTool KV**（键名在 `src/config/storageKeys.js`），写入只走 `Q.setObject → wr.setObject`（localTool），**无降级链**——详见《本地 JSON 存储机制.md》§二更正。

**1. `api_configs`（键 `Z.API_CONFIGS`，`storageKeys.js:3`）—— 用户自定义 API 网关**

这是「可改 `:9004` 指向」的真正载体。用户在设置面板「添加 API 配置」里填 `url`/`token`/`model` 等，按节点类型（text/image/video/sd2Video/audio）各选一个配置。

存储键定义：

```3:3:src/config/storageKeys.js
    API_CONFIGS: `api_configs`,
```

保存点（自动保存 effect，只落用户自己加的非 readonly 项）：

```40988:40989:src/App.js
      let e = En.filter(e => !e.readonly);
      Q.setObject(Z.API_CONFIGS, e).catch(e => console.error(`API_CONFIGS save error`, e))
```

导出/导入也包含该键：

```41369:41369:src/App.js
        for (let t of [`app_settings`, `api_configs`, `users`, `membership`, `projects`, `presetPrompts`, `customNodeTemplates`, `modelSchedules`, `cloud_storage_config`, `local_templates`]) {
```

**2. `app_settings`（键 `Z.APP_SETTINGS`，`storageKeys.js:2`）—— 记录「每个节点类型选了哪个 API 配置」**

它存的是**选择关系**与各节点默认模型，不是 URL 本身：`textApiConfigId` / `imageApiConfigId` / `videoApiConfigId` / `sd2VideoApiConfigId` / `audioApiConfigId`，以及 `defaultTextModel` 等。

```2:2:src/config/storageKeys.js
    APP_SETTINGS: `app_settings`,
```

启动加载时把选择写回运行时（若用户手动在 `localStorage` 覆盖过 `apiConfigId_*` 则优先用 `localStorage`）：

```40584:40585:src/App.js
      }), Q.getObject(Z.APP_SETTINGS).then(e => {
        console.log(`[Storage] 加载 app_settings:`, e ? `存在` : `不存在`), e && (... e.textApiConfigId && !localStorage.getItem(`apiConfigId_text`) && kn(e.textApiConfigId), e.imageApiConfigId && !localStorage.getItem(`apiConfigId_image`) && Mn(e.imageApiConfigId), ...)
```

`cloud_storage_config`（键 `Z.CLOUD_STORAGE_CONFIG`，`storageKeys.js:12`）是文件中转节点的云端存储（S3 类）凭证（accessKey/secretKey/bucket/endpoint/domain），与 AI 网关无关，仅在文件转 URL 节点使用。

---

## 四、读取顺序（运行时先读谁）

**原则：用户配置覆盖硬编码常量，本地运行时先做合并后再用。**

1. **API 配置合并**（启动加载，≈L40571）：先 `Q.getObject(Z.API_CONFIGS)`，再做 `Dn(t => ...)`——把用户配置里 `readonly` 的系统内置项与用户自加项（`!e.readonly`）拼回，保证「内置默认 + 用户自定义」都在。

```40571:40581:src/App.js
      }), Q.getObject(Z.API_CONFIGS).then(e => {
        e && e.length > 0 && Dn(t => {
          let n = e.map(e => ({ ...e, showKey: e.showKey ?? false })),
            r = n.filter(e => e.readonly),
            i = n.filter(e => !e.readonly),
            a = t.filter(e => e.readonly);
          return [...(a.length > 0 ? a : r), ...i];
        });
      })
```

2. **节点类型选择关系**（≈L40584）：`Q.getObject(Z.APP_SETTINGS)` 读出 `textApiConfigId` 等，决定「文本节点用哪个 api config」。`localStorage` 里的 `apiConfigId_*` 临时覆盖优先级更高。

3. **实际请求 URL 来源**：节点生成时取的 URL = 第 1 步里被选中的那个 api config 的 `url` 字段（用户填的，例如任意 OpenAI 兼容地址），**不是** `config.js` 里的 `:9004` 常量。`:9004` 常量仅在用户没配任何 api config、走内置默认时作为兜底。

4. **localTool `:18080` 被发现（不是配置，是探测）**：组件挂载时 `useLocalTool` 轮询 `http://127.0.0.1:${Bc}/api/status`，连通后置 `window.localTool`：

```20:20:src/hooks/useLocalTool.js
        let e = await fetch(`http://127.0.0.1:${Bc}/api/status`, {
```

```40362:40362:src/App.js
    window.localTool = n;
```

端口 `Bc = LOCAL_ENGINE.port`（18080）是常量，用户不可改，只能保证 localTool 进程确实监听 18080。断开后按 `Vc=5e3`/`Hc=15e3` 间隔重连（`useLocalTool.js` ≈11-54）。

5. **GAS `:exec` 地址**：直接读常量 `GAS_CLOUD_SYNC_URL`，无用户层配置入口。

> ⚠️ **易错点**：`Q.getObject` 走 `jr() → wr.get()`（localTool KV），`Q.setObject` 走 `wr.setObject`（localTool KV）(`storage/index.js` ≈223/238)。`Mr`(chrome.storage.local)/`Nr`(localStorage)/`Pr`(localforage) 三个引擎虽都定义，但 **Q 的 get/set 只用 `wr`**；它们只在 `syncToLocalTool` 迁移路径里把老数据**拉回** localTool。所以「配置存哪」答案唯一：localTool KV `:18080`，没有 chrome/localStorage 兜底。

---

## 五、三个地址分别服务什么（衔接既写文档）

- **AI 网关 `:9004`（及用户自定义 URL）→ AI 生成链路**：节点体系里文本/生图/视频/音频节点发起请求走这里。默认 `:9004 → Lovart`（OpenAI 兼容），用户可在「API 配置」换成自己的网关。详见节点体系篇（见 `docs/模块专题/README.md` 索引）。
- **localTool `:18080` → 资源中转落盘 + KV 存储**：画布生成的图片/视频经「中转资源本地落盘」写进 localTool，KV 模板/预设/配置也存这里。详见《中转资源本地落盘机制.md》《本地 JSON 存储机制.md》。
- **GAS `exec` → 云端同步**：全部配置 JSON（含 `api_configs`、`local_templates`）整体 push/pull。详见《GAS云同步机制.md》。

注意边界：`:18080` 是**本地存储/落盘**后端，不是 AI 推理后端；AI 推理只认 `:9004` 类网关或用户自定义 URL。

---

## 六、一句话

`硬编码常量（:9004 / :18080 / GAS）定端口与兜底；用户真正的网关地址写在 api_configs（localTool KV），运行时按 app_settings 的 apiConfigId 选择关系覆盖默认常量后发起请求；localTool 靠轮询 /api/status 发现，GAS 直接读源码常量。`

---

## 七、改码前必查

1. **改后端地址优先改 `src/config.js`**：`:9004` 有四个别名常量（`ENDPOINTS`/`DEFAULT_ENDPOINT`/`REMOTE_BASE`/`DEFAULT_GATEWAY_URL`），要改一起改；只改一个会留下不一致兜底值。
2. **用户网关 URL 不在 `config.js`**：别在常量里找「用户填的网关」——它在 `api_configs` 的 `url` 字段，运行时由 `apiConfigId_*` 选择。改生成链路 URL 拼接请先看节点体系篇。
3. **`localTool` 端口是常量 `LOCAL_ENGINE.port=18080`**：用户无法在 UI 改端口；若要让 localTool 监听别的端口，需同步改 `config.js` 与 localTool 进程配置，且 `useLocalTool.js` 里所有 `Bc` 引用会自动跟随（它 import 自 `constants.js`）。
4. **`Q.setObject` 只落 localTool**：用户配置（api_configs/app_settings/cloud_storage_config）非优雅退出会丢（详见《本地 JSON 存储机制.md》§三）。
5. **`GAS_CLOUD_SYNC_URL` 必须「所有人可访问」**：否则 `callGateway` 收到 html 权限页被判定失败（详见《GAS云同步机制.md》§五）。
