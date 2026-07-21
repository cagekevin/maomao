# 深十一度：background.ts 消息图 + 多窗口事件全集（AI05）

> 对象：`src/background.ts`（全文 115 行，已读）+ App.js 内 `resourceAdded` 接收(L43527)、`import/export-project` 监听(L38534)、多窗口事件全集。
> 承接 08 节（resourceAdded 为 chrome.runtime 跨进程消息，非 window CustomEvent）+ 10 节（background 采集不下载）。
> 红线：只读，不修改。

---

## 1. background.ts 职责与消息图（全文实证）

### 1.1 职责（L1-4）
右键菜单、资源采集存储、侧边栏管理。Service Worker（SW）。

### 1.2 右键菜单采集（L7-53）
- `initContextMenu`(L7) 注册 `save-to-transit`（「发送到资源」），contexts=image/video/audio/selection。
- 安装/启动/开发模式均确保菜单存在（L22-33）。
- `handleSaveToTransit`(L65) 是采集入口。

### 1.3 采集链路（L65-115，与 10 节闭环）
```80:89:src/background.ts
  // 直接使用原始 URL，不再经过本地引擎上传
  const newResource: TransitResource = {
    id: Date.now().toString(),
    url: resourceUrl,
    type: type,
    timestamp: Date.now(),
    pageUrl: info.pageUrl,
    pageTitle: tab ? tab.title : '未知页面',
    source: 'extension',
  };
```
- **关键**：L80 注释「不再经过本地引擎上传」——background 只存**原始 URL 元数据**，`source:'extension'`，**不下载不落盘**（与 10 节 ARCHITECTURE X1.2 过时描述相反，10 节已纠正）。
- L92-97：`chrome.storage.local` 存 `transitResources`，**最多 5 条**防 OOM。
- L101-108：`chrome.runtime.sendMessage({action:'resourceAdded', resource})` 通知侧边栏（SW→前端跨进程消息）。
- L111-113：尝试打开侧边栏。

### 1.4 与前端接收端衔接（L43527，08 节已证）
- 前端 `chrome.runtime.onMessage.addListener`(L43564) → `if(e.action==='resourceAdded' && e.resource)`(L43527) → 处理（含 `source==='local-tool'` 判定 L43529，非 local-tool 则走 `Zr` 下载落盘 migrated，即 10/16 节采集下载闭环）。
- **机制定性**：`resourceAdded` 是 **chrome.runtime 跨进程消息**（SW→前端），**非 window CustomEvent**（08 节 X2 表偏差已记）。

---

## 2. import-project / export-project 实证链

### 2.1 发送端（L44706/L44712）
```44706:44712:src/_engine/App.js
onClick: () => window.dispatchEvent(new CustomEvent(`import-project`)),   // 导入项目按钮
onClick: () => window.dispatchEvent(new CustomEvent(`export-project`)),   // 导出项目按钮
```
- 项目菜单按钮（L44704 浮层）触发，纯前端 window CustomEvent。

### 2.2 监听端（L38534）
```38534:38536:src/_engine/App.js
return window.addEventListener(`import-project`, e), window.addEventListener(`export-project`, t), () => {
  window.removeEventListener(`import-project`, e), window.removeEventListener(`export-project`, t);
};
```
- 监听 handler `e`/`t`（L38531-38532 调 `r.current()` 等，即实际导入/导出执行）。
- **机制定性**：纯前端 window CustomEvent（与 resourceAdded 的 chrome.runtime 跨进程不同）。
- 08 节已记「import-project/export-project@L38534 监听 / @L44706/L44712 发送」存在，本轮确认 handler 真身（调 `r.current()` 触发实际逻辑）。

---

## 3. 多窗口事件全集（window CustomEvent，纯前端）

汇总 App.js 内全部 `mutiwindow-*` / 相关广播：

| 事件名 | 发送位置 | 监听位置 | 机制 |
|--------|---------|---------|------|
| `mutiwindow-task-completed` | L38481/L43640/L43676/L43697/L44406 | L31428 | window CustomEvent |
| `mutiwindow-update-task-meta` | L41032 | L43764 | window CustomEvent |
| `mutiwindow-open-builtin-settings` | L4922/L5867/L9518/L26385 | L43774 | window CustomEvent |
| `mutiwindow-open-schedule-settings` | L4883/L5828/L26348 | L43774 | window CustomEvent |
| `mutiwindow-rerun-task` | L44343 | L36618 | window CustomEvent |
| `mutiwindow-nodes` | L36139/L16369/L16497 | L35918/L36111/L36970 | window CustomEvent（剪贴板节点） |
| `mutiwindow-images` | L16369/L16497 | L36001/L36037 | window CustomEvent（剪贴板图片） |
| `builtin-panel-switch-schedule` | L43771 | —（内部转发） | window CustomEvent |
| `import-project` | L44706 | L38534 | window CustomEvent |
| `export-project` | L44712 | L38534 | window CustomEvent |
| `open-shortcuts-modal` | L37359 | — | window CustomEvent |
| `canvas-state-change` | **不存在** | — | ❌ 08 节证伪 |
| `mutiwindow-sync-local` | **不存在** | — | ❌ 08 节证伪（实为 handleSyncLocal@L44426） |

> **与 08 节 X2 表对照**：X2 事件总线表把 `canvas-state-change`/`mutiwindow-sync-local` 列为 window CustomEvent（实际不存在），漏列上述 10+ 个真实事件。07 §2.2 已建议重写 X2 表。

---

## 4. 跨进程 vs 同窗口 双通道总结

| 通道 | 事件/消息 | 方向 |
|------|----------|------|
| chrome.runtime 跨进程 | `resourceAdded`（SW→前端） | background.ts L101 → App.js L43527 |
| window CustomEvent 同窗口 | `mutiwindow-*` / `import/export-project` / `open-shortcuts-modal` 等 | 前端组件间 |

- background.ts **只发 `resourceAdded` 一条**跨进程消息；其余多窗口同步全为前端 window CustomEvent（同标签页/同 window 内跨组件）。
- 注意：纯 window CustomEvent **不能跨扩展窗口**（不同 window 是独立 document）——多窗口场景实际依赖 storage 事件或 SW 中转，但代码未见对 `mutiwindow-*` 的跨 window 广播实现（可能为同 window 内多面板同步，或原版多窗口能力已弱化）。**标记为待查项**：多窗口真实跨窗口机制是否仍存在。

---

## 5. 校验（门3）

| 引用 | 文件:行 | 命中 |
|------|---------|------|
| background 采集不下载 | background.ts L80/L88 | ✅ source:'extension' 仅存元数据 |
| resourceAdded 跨进程 | background.ts L101 / App.js L43527 | ✅ |
| import/export 发送 | App.js L44706/L44712 | ✅ |
| import/export 监听 | App.js L38534 | ✅ |
| mutiwindow-task-completed | App.js L38481/L31428 | ✅ |
| mutiwindow-update-task-meta | App.js L41032/L43764 | ✅ |
| mutiwindow-open-*settings | App.js L4922/L43774 | ✅ |
| mutiwindow-rerun-task | App.js L44343/L36618 | ✅ |
| mutiwindow-nodes/images | App.js L36139/L16369 | ✅ |
