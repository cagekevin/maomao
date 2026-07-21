# 深八度：CloudSyncEngine GAS 同步 + mutiwindow-task-completed 触发链（AI05）

> 对象：`App.js` CloudSyncEngine(L43896-43948) + `ei`/`ti` 真身(L43950/L43974) + `mutiwindow-task-completed` 发送端(4处)/监听端(L31426/L31428)。
> 红线：只读，不修改。

---

## 1. CloudSyncEngine 真身（L43896-43948）

### 1.1 配置与通道
- L43898 `config.gasUrl: GAS_CLOUD_SYNC_URL`（环境变量注入，非硬编码）。
- L43902 `callGateway(action, data)`：POST `text/plain;charset=utf-8` 到 `gasUrl`，body=`JSON.stringify({action, data})`(L43911)。
- **防御**：gasUrl 为空或含「填入」→ 抛「未配置有效的 GAS URL」(L43903)；`isSyncing` 锁防并发(L43904/L43905/L43923)。
- **权限检测**：响应含 `<html` → 抛「权限拦截，请确保 GAS 设为了【所有人】访问」(L43914-43915)——即 GAS 必须部署为「任何人」可访问。
- **响应解析**：`res.text()` 后 `JSON.parse`(L43916-43918，前文 L43913-43920)。

### 1.2 push / pull（L43926-43947）
- `push` → `callGateway("push_data", dataObj)`；成功 `onSuccess(res.msg)`，失败 `onError`+返回 false。
- `pull` → `callGateway("pull_data")`；返回 `res.data`，失败返回 null。
- **失败兜底完善**：push/pull 各自 try/catch，不会抛未捕获异常（与 10 节 var-mapping 收的 GAS 语义一致）。

---

## 2. `ei` / `ti` 四义中的 GAS 双义（L43950/L43974）

> 这是 10 节指出的 var-mapping 严重漏收项：ei/ti 跨 Map/UI/云同步四义。此处坐实云同步两义。

### 2.1 `ei` = pushToCloud（L43950-43973）
```43950:43973:src/_engine/App.js
ei = async () => {
  $r(true);                       // syncing=true
  try {
    let e = {};
    for (let t of [`app_settings`,`api_configs`,`users`,`membership`,`projects`,`presetPrompts`,`customNodeTemplates`,`modelSchedules`,`cloud_storage_config`]) {
      let n = t === `modelSchedules` ? la() : await Q.getObject(t);
      n !== null && (e[t] = n);   // 仅收集非 null 的配置
    }
    if (Object.keys(e).length === 0) { Br(`本地没有可同步的配置数据`); return; }
    let ok = await CloudSyncEngine.push(e, msg=>Br(msg), msg=>{Br(msg);$r(false);}, msg=>{Br(msg);$r(false);});
    if (!ok) $r(false);
  } catch (e) { console.error(`[GAS同步] 推送失败:`, e), Br(`推送失败：`+e.message); }
  finally { $r(false); }
};
```
- 收集 9 类本地配置（`Q.getObject`，localforage），`modelSchedules` 走 `la()`（内存 state）。
- 空数据早退；非空 → `CloudSyncEngine.push`。

### 2.2 `ti` = pullFromCloud（L43974-44004）
```43974:44004:src/_engine/App.js
ti = async () => {
  $r(true);
  try {
    let t = await CloudSyncEngine.pull(msg=>Br(msg), msg=>{}, msg=>{Br(msg);$r(false);});
    if (!t || typeof t !== 'object') { Br(`云端没有配置数据`); return; }
    let n = Object.keys(t);
    if (n.length === 0) { Br(`云端没有新的配置数据`); return; }
    let r = 0;
    for (let e of n) {
      let n = t[e];
      n != null && (e === `modelSchedules` ? await Sa(n) : await Q.setObject(e, n), r++);
    }
    Br(r>0 ? `【配置】已从云端同步到本地 (${r}项)` : `没有需要恢复的配置`);
    setTimeout(() => window.location.reload(), 1e3);   // 拉取后整页 reload
  } catch (e) { console.error(`[GAS同步] 拉取失败:`, e), Br(`拉取失败：`+e.message); }
  finally { $r(false); }
};
```
- 拉取后逐键写回 `Q.setObject`（`modelSchedules` 走 `Sa()`）；**成功拉取后 1s `window.location.reload()`**(L43997)——强制全量刷新本地状态。
- 失败/空数据均早退，不 reload。

> **闭环**：`ei`(push) / `ti`(pull) 对应 var-mapping L9/L10 已收两处；但 L1853(ei=Map)/L36784(ei=打组)/L36822(ti=清缓存) 三处仍漏收（10 节核心发现）。
> 注意：此 `ei`/`ti` 在 L43950/L43974 的同一函数作用域内定义，与 L1853/L36784/L36822 是**不同闭包**——引用必须带行号，否则混淆。

---

## 3. `mutiwindow-task-completed` 完整触发链

### 3.1 发送端（4 处 CustomEvent）
| 位置 | 触发条件 | detail |
|------|---------|--------|
| L38481 | 节点结果刷新成功（`n` 或 `a==='failed'`） | taskId/nodeId/resultUrl/type/status/errorMsg |
| L43640 | 轮询 404 且 notFoundCount≥3 且 >30s | 同上 + errorMsg=「任务未找到或已被清理」 |
| L43676 | 轮询 success/completed 且拿到 url | 同上（completed） |
| L43697 | 轮询 failed | 同上（failed） |
| L44406 | 持久化全局 tasks 后 resultUrl/thumbnail 变更 | + thumbnailUrl/customOutputType |

- 全部 `window.dispatchEvent(new CustomEvent('mutiwindow-task-completed', {detail}))`——**纯前端 window CustomEvent**（与 resourceAdded 的 chrome.runtime 跨进程不同）。
- 仅 `i.nodeId` 存在时才发（L38481/L43640/L43676/L43697 均 `i.nodeId &&`），即无节点绑定的任务不广播。

### 3.2 监听端（resourceStore effect，L31420-31430）
```31426:31430:src/_engine/App.js
return e;
}), i === `completed` && n && (
  Ev().then(() => Di.current && Di.current()).catch(e => console.error(`[resourceStore] 生成完成触发后端 rescan 失败:`, e)),
  console.log(`[resourceStore] 生成完成，触发后端 rescan 统一入库:`, n)
);
};
return window.addEventListener(`mutiwindow-task-completed`, e), () => {
  window.removeEventListener(`mutiwindow-task-completed`, e);
};
```
- 监听函数 `e`：若 `detail.status === 'completed'` 且 `n`（resultUrl 存在）→ 调 `Ev()`(L42883 rescan 触发后端入库，见 03/11 节) + `Di.current()`（资源面板刷新）。
- **语义**：任务完成 → 广播 → resourceStore 收 → 触发后端 `/api/resources/rescan` 把产物统一入库（落盘 18080 + 写 resources 表）。
- 与 13 节 `mutiwindow-update-task-meta`（写 tasks 表）是**两条并行广播**：一个管资源入库(rescan)，一个管任务元数据(mediaMeta)。

### 3.3 数据流总图
```
[L43676 轮询 completed] ─┐
[L38481 刷新成功] ────────┼─ dispatch mutiwindow-task-completed ─▶ [L31426 监听]
[L44406 持久化变更] ──────┘                                            │ status==='completed' && resultUrl
                                                                       ▼
                                                            Ev() → POST /api/resources/rescan (18080)
                                                                       ▼
                                                            Di.current() 刷新资源面板
```

---

## 4. 新发现 / 衔接

- **GAS 权限硬约束**：必须部署为「任何人访问」，否则 `<html` 拦截报错（L43914）。这是部署文档易漏的点。
- **push/pull 容错完善**：与 10 节「GAS 同步」语义一致，无未捕获异常。
- **`mutiwindow-task-completed` 与 `mutiwindow-update-task-meta` 双轨**：前者驱动 rescan 入库（resources），后者驱动 mediaMeta 落库（tasks）；均纯前端 CustomEvent，均已在 X2 事件表漏列（07 §2.2 已建议补）。
- 全部引用带 `文件:L行号`，grep 复核通过。

---

## 5. 校验（门3）

| 引用 | 文件:行 | 命中 |
|------|---------|------|
| CloudSyncEngine 定义 | App.js L43896-43948 | ✅ |
| callGateway GAS POST | App.js L43902-43925 | ✅ |
| ei=push | App.js L43950 | ✅ |
| ti=pull | App.js L43974 | ✅ |
| ei 收集 9 类配置 | App.js L43954 | ✅ |
| ti 拉取后 reload | App.js L43997 | ✅ |
| task-completed 发送×4 | App.js L38481/L43640/L43676/L43697/L44406 | ✅ |
| task-completed 监听→Ev | App.js L31426/L31428 | ✅ |
