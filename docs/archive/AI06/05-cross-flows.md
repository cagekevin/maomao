# AI06 · 阶段 2.5：交叉流审计（横向切片 · 缝合模块接缝）

> 审计日期：2026-07-21 ｜ 沿边界契约接缝追踪，每条带 file:line。
> 缝合模块：M1(配置) + M2(本地数据) + M3(AI生成) + M4(画布)。

## X1. AI 生成 → 落盘 → 资源面板 全流程
```
局部 Jn(L32490, 模块3)
  → POST /v1/images|videos/generations (网关 main.py L591/L641)
  → Lovart 异步 task_id (L32988 检测分流)
  → 轮询 GET /v1/tasks/{id} (网关 L873, 轮询URL L33005, ≥3s/退避15s/15min)
  → 解析 images[].url (数组[0])
  → ii(L1888, 模块2) 落盘: 远程URL直返 / blob调 Xr(L1802)→Hr/api/files/upload
  → 更新节点 data.imageUrl/videoUrl
  → dispatchEvent('mutiwindow-task-completed') (触发@L38481/L43640/L43676/L43697/L44406)
  → 监听@L31428 → Ev(L42883, 模块2) rescan → POST /api/resources/rescan
  → 资源面板刷新 (xv@L42821 查列表)
```
**接缝校验**：轮询 URL 用局部 `R`(=9004)；落盘用 `Hr`(=18080)；rescan 用 `vv`(=18080)。双服务 base URL 分别正确 ✅。
**风险点**：`ii` 对远程 CDN URL 直返不下载（L1889），违反本地闭环（红线§3.2.6），属设计弱点。

## X2. Rescan 孤儿清理与资源入库一致性
```
Ev(L42883) → POST /api/resources/rescan (localTool resources.ts L37)
  → 扫 uploadDir 子目录(排除.thumbnails)
  → 孤儿清理只清 source='local-tool' (ARCH L2.4)
  → source='extension' 记录不清理 (P2)
与"拖入URL不落盘"割裂面：
  B回调≈L29160 只存状态不下载 → 无磁盘文件 → rescan 也无从补 → 刷新丢失 (P1)
```
**归因**：入库一致性依赖"先落盘再 rescan"；URL 拖入跳过了落盘，两路割裂。

## X3. 配置加载与双服务 base URL 桥接
```
config.js: USE_LOCAL_ENGINE=true (L36) → localEngineBase()=18080 (L42, 动态函数)
DEFAULT_ENDPOINT=9004 (L30) → 网关
LOCAL_ENGINE = {host:'127.0.0.1', port:18080, base getter} (config.js L12-18)
REMOTE_BASE = 'http://127.0.0.1:9004' (config.js L39, 注意也是9004非真远程)
模块内解析:
  Hr = localEngineBase() (App.js L1732, 动态! 随开关切18080/9004) → /api/files/* (M2)
  vv = LOCAL_ENGINE.base (App.js L42808, 写死18080) → /api/resources/* (M2)
  R/_/g (局部, =9004, 网关) → /v1/tasks/* (M3)
```
**纠正（见 `12-crossflow-contracts.md`）**：原"Hr/vv 双固定常量+开关无效"假设**错误**——`Hr` 是 `localEngineBase()` 动态返回值，会随 `USE_LOCAL_ENGINE` 切换（true→18080 / false→REMOTE_BASE 9004）。真正写死的是 `vv`@L42808（仅用于资源记录，硬编码18080合理）。P0 残留真实形态：`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080，**false 分支是配置死路**（无服务承接），非代码硬编码 bug。base URL 不统一仍需治理（TASKS P2）。

## X4. 画布事件总线跨模块通知
| 事件 | 触发源(file:line) | 监听源 | 连锁 |
|------|------------------|--------|------|
| `mutiwindow-task-completed` | L38481/L43640/L43676/L43697/L44406 | L31428 | → Ev rescan → 资源刷新 |
| `mutiwindow-update-task-meta` | L41032 | L43764 | → I_(useTaskMetaSync) 解析宽高时长 |
| `resourceAdded` | background.ts → | L43527 | → transitItems → 素材Tab |
| `canvas-state-change` | **实为 Q.saveCanvasStateWithVersion 直接调用** (L31728) | localforage | 非字面CustomEvent，文档表述待纠 |

**状态同步校验**：所有通知走 `window` CustomEvent / 直接 Q 调用，**未绕过 StorageManager(`Q`)**（红线§3.3.9 遵守）✅。
**`mutiwindow-sync-local` 已坐实虚构**（源码 0 命中，见 `10-deepen-sync-events.md`）：资源面板"同步到本地"按钮实际走 `mutiwindow-task-completed`→`Ev()` rescan，原假设"走 `Oi`→rescan"亦已推翻（`Oi`@L3154 为模型权益函数，与 rescan 无关）。ARCHITECTURE X2 该事件名应删除。

## X5. 校验门
全部接缝 file:line 由 grep 坐实 ✅。无逻辑阻断项。
