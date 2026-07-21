# 术语表（Glossary）

> 术语表经 AI13 交叉验证实锤（2026-07-21），锚点来源 `docs/AI13/交叉验证最终报告.md` 与 `docs/AI13/裁决表.md`。
> 本文只解释"代码表达不了的命名歧义 / 黑话"。压缩后的 `App.js` 行号随构建漂移，仅作参考附注；主引用用**函数名 / 真实 TS 路径**。
> 对外能力接口见 `docs/06-integration.md`。

---

## 一、同名遮蔽（一个短变量名绑定多个真身）

minified 的 `App.js` 大量复用短名。引用时必须指明是哪一个真身，否则无法定位（来源：裁决表 M1/M3/M6/M7）。

| 变量 | 真身 A | 真身 B | 真身 C | 备注 |
|------|--------|--------|--------|------|
| `ei` | 缩略图缓存 `var ei = new Map()`（L1853） | 节点打组 `ei = Y.useCallback`（L36784） | GAS pushToCloud `ei = async`（L43950） | 实为**四义**，与 `ti` 配对；还有 L36822 清缓存（见 `ti`） |
| `ti` | 清缓存 `ti = Y.useCallback`（L36822） | GAS pullFromCloud `ti = async`（L43974） | — | 与 `ei` 配对；共 4 处分散在 L1853/L36784/L36822/L43950/L43974 |
| `Jn` | `function Jn` LogoIcon 组件（L89） | `let Jn = Y.useCallback` 生图主回调（L32490） | — | 生图回调是真身；勿与 LogoIcon 混淆 |
| `Zr` | `async function Zr` 下载/URL 上传（L1827，被 `resourceAdded`@L43539 调用） | logout `Q.remove(Z.AUTH_TOKEN)`（L43893） | — | 双绑定成立；var-mapping 漏收 L1827（仅收 logout） |
| `we` | `we = (t,n=false)=>{}` insertMention（L4176） | `we = Y.useCallback` 资源 rescan（L43015） | — | rescan 真身为 `Ev`@L42883，`we`(L43015) 为同名遮蔽 |
| `R` | 文件预览回调（L29149） | 网关 base 轮询 `${R}/v1/tasks/{id}`（L33005） | — | 两义不同模块 |
| `Th` | `director3dNode: Th` 注册（L31141） | Director3DNode 声明（非失效） | — | **非失效**（AI08 曾误标），见下方 3D 段 |

> 引用规则：写"生图主回调 `Jn`@L32490"这样的**语义名 + 行号**，别只写"`Jn`"。

---

## 二、动态配置与硬编码

- **`Hr`** = `localEngineBase()`@L1732，随 `USE_LOCAL_ENGINE` 开关在 `18080`（本地 localTool）与 `9004`（网关）之间动态切换（裁决表 M1 措辞修正：AI05 旧称"三处硬编码 18080"不严谨，Hr 实为动态）。
- **`vv`** 字面值写死 `18080`（L42808，硬编码，不受开关影响）——已知不一致点，改动前先确认意图。
- **`U_`** 同 `vv`，host 硬编码 18080 兜底（呼应 P0）。
- **`ot`** = `'http://127.0.0.1:9004'`（L42691 附近），AI 网关 base 硬编码残留；实际连接端口以 `config.js` 的 `DEFAULT_ENDPOINT` 为准。

---

## 三、已证伪项（红字警示 · 勿再引用）

以下两项在旧审计文档中被误造为"真实事件"，源码 grep **0 命中**，已裁决证伪（裁决表 M5/M6/M7）：

- ❌ **`canvas-state-change`** —— 画布持久化实际走 `Q.saveCanvasState`(L1642) / `saveCanvasStateWithVersion`(L1650/L31728) 直接写 localforage，**无此事件**。
- ❌ **`mutiwindow-sync-local`** —— 实为 `handleSyncLocal`@L44426 函数，**无此事件名**。

> 看到旧文档引用上述事件，一律视为错误结论。

---

## 四、跨包真身（不在 App.js 内）

- **`toAbsoluteFileUrl`** 真身 = `localTool/src/routes/resources.ts#L31`（资源 URL 补全为 `http://127.0.0.1:18080/...`）。App.js 内 0 命中该函数定义；L43462 是云模板、L43548 仅 `${Hr}${url}` 拼接（裁决表 M6/M7 已纠正 AI11 旧锚）。

---

## 五、3D 系统两层封装

- **`$d`** = DirectorShell（布局壳）@L24391。
- **`Th`** = Director3DNode（节点壳），注册于 `director3dNode: Th`@L31141。

两者同属 3D 系统两层封装，勿混为一谈。`Th` **仍生效**，非 AI08 旧文档所称"待废弃"。

---

## 六、事件总线真实事件名（替代已证伪项）

前端进程内为 `window` CustomEvent（`mutiwindow-` 前缀）；跨进程消息走 `chrome.runtime`：

- `mutiwindow-task-completed`（L38481 等多处）—— AI 生图完成广播，回填节点 + 触发 rescan。**detail**: `{taskId, nodeId, resultUrl, type, status, errorMsg}`（L44406 额外 `thumbnailUrl, customOutputType`）；仅 `nodeId` 存在时发。
- `mutiwindow-update-task-meta`（L41032 → L43734）—— 任务元数据更新。**detail**: `{taskId, meta}`。
- `mutiwindow-rerun-task`（L44343 → L36618）—— 重跑任务。**detail**: `{task: <task对象>}`（含 nodeId）。
- `resourceAdded` —— `chrome.runtime` 跨进程消息（background.ts L101 → App.js L43527），非 CustomEvent。**detail**: `{action:'resourceAdded', resource:{id,url,type,pageUrl,pageTitle,source:'extension'}}`。
- 多窗口事件全集 10+ 条，均带 `mutiwindow-` 前缀（见 `06-integration.md` §2.1）。
- ⚠️ 纯 `window` CustomEvent **不能跨扩展窗口**；跨进程只用 `resourceAdded`。
