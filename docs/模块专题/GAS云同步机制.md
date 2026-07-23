# GAS 云同步机制（模块专题 · 按需查阅）

> 事实锚点：grep `src/App.js`（行号快照 2026-07-22）、`src/config.js` 坐实。
> 行号随构建漂移，主引用用函数语义名 + 真实路径；动手前回源码复核当前行号。
> 本文只写代码里已存在的机制，不写方案、不写待决策。

---

## 一、这是什么

把应用的全部配置 JSON（含画布模板 `local_templates`）整体推到云端、或从云端拉回，实现跨设备/跨机同步与备份。底层是 Google Apps Script。

---

## 二、引擎 `CloudSyncEngine`（`src/App.js` ≈L41312）

- 配置 `config.gasUrl = GAS_CLOUD_SYNC_URL`（`src/config.js` 中，一个 Google Apps Script `exec` 地址）。
- `callGateway(action, data)`：POST `gasUrl`，`body: JSON.stringify({action, data})`，`Content-Type: text/plain`；自带 `isSyncing` 互斥锁，拦截「权限拦截（需设所有人访问）」的 html 响应。

> ⚠️ **2026-07-23 更正（commit `176437b`）**：GAS push 函数已从 `ei` 语义化改名为 **`syncToCloud`**。下文 `ei()` 均指 `syncToCloud()`，旧文档的 `ei`(push) 写法已作废（App.js 内 `ei` 现在仅指"节点打组"函数）。

---

## 三、完整生命周期

- **push（上传/同步）** `syncToCloud()`（≈L41365）：
  1. 遍历固定键集合：`['app_settings','api_configs','users','membership','projects','presetPrompts','customNodeTemplates','modelSchedules','cloud_storage_config','local_templates']`（≈L41369 起）；
  2. 每个键取本地值；`local_templates` 特殊处理：**strip 掉 `coverUrl` 和节点里的 `imageUrl/thumbnailUrl/images/videoUrl/...Ref/...Uploaded` 等二进制字段**，只留纯 JSON 结构（push 函数体内）；
  3. `CloudSyncEngine.push(dataObj)` → `callGateway('push_data', dataObj)` → 云端写库；
  4. 失败 toast，成功 toast。
- **pull（拉取/恢复）** `ti()`（≈L41415）：
  1. `CloudSyncEngine.pull()` → `callGateway('pull_data')` → 返回云端 JSON 对象；
  2. 逐键写回本地：
     - `modelSchedules` → `Sa(n)`；
     - **`local_templates` → 合并而非覆盖**：云端模板按 `id` 去重，`localIds` 没有的才 `unshift` 进本地数组，避免覆盖本地新增；
     - 其余键 → `Q.setObject(e, n)` 直接覆盖；
  3. 写完后 `setTimeout(reload, 1e3)` 重载页面。
- **兜底 `ni()`**（带默认参数）：用于无用户态时的初始化拉取。

---

## 四、一句话

`本地全量配置（含 local_templates 精简 JSON）→ push_data → GAS 云端；pull_data → 逐键写回（local_templates 按 id 合并）→ reload`。

---

## 五、改码前必查

1. **`local_templates` 精简逻辑**（≈41787-41812）不能删字段白名单：push 时 strip 二进制是为了减小云端体积，pull 时本地已有完整数据，不冲突。
2. **pull 的合并语义**（≈41855）：`local_templates` 必须按 `id` 合并，绝不能 `Q.setObject` 直接覆盖，否则本地新增模板被云端旧数据冲掉。
3. **`gasUrl` 必须设为「所有人访问」**：否则 `callGateway` 会收到 html 权限拦截页，被判定为失败。
