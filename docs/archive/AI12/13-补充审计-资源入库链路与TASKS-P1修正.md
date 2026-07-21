# AI12 · 补充审计 — 资源入库链路与 TASKS P1 误锚修正（T0.1 收口）

> 方法学：四段式 + 边界契约；门3 机器校验；不读他人 AIxx；只写 AI12。
> 动机：TASKS P0–P2 与 T0.1 多处行号已漂移（快照 2026-07-20），且 `B`/`R`/`Sv`/`we`/`Ev` 语义与现码不符。本模块回源码坐实真身，修正上游误锚。
> 配套：修正补丁见 `12` 文档 C12（本文件新增）。

---

## 一、资源 Store 函数族真身（localTool 18080 侧，非网关 9004）

| 混淆名 | 真身 | 定义行 | 行为 |
|--------|------|--------|------|
| `Sv` | saveResource | **L42838** | `POST ${vv}/api/resources/save`（写库，落 18080） |
| `Cv` | saveResource+fav | L42851 | 包 `Sv`，带 `isFavorite` |
| `wv` | deleteResource | **L42857** | `POST ${vv}/api/resources/delete?id=`（**只删 DB，不删磁盘** → TASKS P2-6 成立） |
| `Tv` | clearResources | L42866 | `POST ${vv}/api/resources/clear`（带 `deleteFiles` 参数，可选真删磁盘 → 与 `wv` 割裂，见 `07` 文档） |
| `Ev` | rescanResources(HTTP) | **L42883** | `POST ${vv}/api/resources/rescan`（触发后端扫盘入库） |
| `we` | rescanSync 回调 | **L43015** | 调 `Ev()` + 重新拉 `xv()` 列表 |
| `rescanThrottledSync` | 节流 rescan | L43028 | 3s 防抖 → `we()` |

> `vv` = localTool base（18080 写死常量，详见 `08` 文档）。资源 Store 全族走 18080，与网关 `R`(9004) 隔离——符合三层隔离红线。

---

## 二、`resourceAdded` 接收端（L43527）落盘逻辑坐实

监听位置：**L43527**（在 `chrome.tabs.onUpdated` 监听器同作用域，属 SW/background 消息处理，非 `window` CustomEvent —— 修正 `09` 文档「resourceAdded 是 chrome.runtime 消息」判断，此处确证为 background 消息 `action==='resourceAdded'`）。

入库前的「外部地址转内部地址」铁律（L43535-43551）：
```
if (source !== 'local-tool') {
  localized = await Zr(i.url, { subfolder: 'migrated' });  // Zr=L1827 下载函数
  if (!localized?.url) return n({success:false, error:'download_failed'}), false;  // 下载失败整条丢弃
  i.url = localized.url.startsWith('http') ? localized.url : `${Hr}${localized.url}`;
}
D(...) ; G(e=>e+1) ;  // 更新前端内存列表
r ? void 0 : await Sv({...i, id:String(i.id)});  // local-tool 来源不重复 Sv（已在后端写库），extension 来源调 Sv 入库
```

**结论**：extension/网页直链来源的资源，在 `resourceAdded` 路径**已被 `Zr` 强制下载到 migrated/ 再 `Sv` 入库**——即该路径「拖入 URL 会落盘」。TASKS P1-2「拖入 URL 不落盘」所指**并非**此路径。

---

## 三、`R`/`z`/`B` 图片输入区读取器真相（TASKS P1 行号已漂移 + 语义错位）

TASKS P1-2/P1-3 原文：
- `B` 回调(L29160–29179) 只存状态不下载
- `R` 回调(L29165–29166) 上传后不调 Sv

**现码坐实（L29149 起）**：

| 混淆名 | 真身 | 定义行 | 真实行为 |
|--------|------|--------|----------|
| `R` | fileList→dataURL 读取器 | **L29149** | `Array.from(e).filter(image).map(FileReader.readAsDataURL)` → 返回 `{url:dataURL,label}` **数组**；**不落盘、不入库**，纯内存转换 |
| `z` | 图片输入区「上传」动作 | L29159 | 调 `R(e)` 读文件 → `O(t.map(source:'upload'))` 存**组件内存状态 `O`**；不调 `Sv` |
| `B` | drop 回调 | **L29188** | 有文件→`R(files)`→`O(...source:'drop')`；无文件(`y!==null`)→直接 return（**不处理 URL 落盘**） |

**关键修正**：
1. TASKS 把 `R` 称为「上传回调」是**错位**——`R` 只是 File→dataURL 读取器；真正「上传动作」是 `z`(L29159)。
2. `B`/`z`/`R` 都只写组件内存状态 `O`（transitItems 输入区），**不调 `Sv`、不走 `resourceAdded`**——这是图片输入区(promptNode/imageNode)的临时草稿状态。
3. 「拖入 URL 不落盘」的**真实割裂面**：图片输入区 drop/paste（L29188/L29174）只存 `O` 内存；刷新丢失。资源面板侧的「发送到资源」才走 `Zr`→`Sv`（已落盘）。TASKS P1 把两处混为一谈，行号与语义均需修正。

---

## 四、rescan 触发链（T0.1 `Ev`/`we` 收口）

- 生成完成触发：`mutiwindow-task-completed` 监听内 L31426 `Ev().then(...)` → 调 `Ev()`(L42883) 触发后端 rescan 统一入库。
- 资源面板手动/节流：`we`(L43015) → `rescanThrottledSync`(L43028, 3s 防抖) → `we()`。
- 孤儿清理逻辑见 `07` 文档（rescan 只清 `source='local-tool'`），本模块不重复。

---

## 五、对 TASKS 的修正指令（回填 P1）

| TASKS 原项 | 错误 | 修正 |
|------------|------|------|
| P1-2 `B` 回调 L29160–29179 只存状态不下载 | 行号漂移；`B`(L29188) 是 drop 回调，且「不落盘」实指图片输入区内存状态 `O`，非资源面板 | `B`=L29188 drop 回调；真问题在输入区 `O` 不落盘；资源面板 `resourceAdded`(L43527) 已落盘 |
| P1-3 `R` 回调 L29165–29166 上传不调 Sv | `R`(L29149) 非上传回调，是 File→dataURL 读取器；真上传动作是 `z`(L29159) | `R`=L29149 读取器；`z`=L29159 上传动作（只存 `O`，不调 `Sv`） |
| P0 残留「host 硬编码 18080」 | `Sv`/`wv`/`Ev`/`we` 全用 `vv`(18080) 常量——正确隔离，非 bug | 维持；与 `08` 文档 USE_LOCAL_ENGINE 脱钩问题独立 |
| T0.1 `we` 标 L42834 | 实际 `we`=L43015，`Ev`=L42883 | 更正行号 |

---

## 六、门3 校验

- 本文件引用行号：L42838/L42851/L42857/L42866/L42883/L43015/L43028/L43527/L43539/L29149/L29159/L29188/L29174/L31426/L1827。
- 全部经 `check-doc-citations.cjs` 校验（见 `校验报告.md`）。
- 边界契约：资源 Store 走 `vv`(18080)；网关轮询走 `R`(9004)；`resourceAdded` 为 background 消息（非 CustomEvent）；`Zr`(L1827) 为下载落盘函数。
