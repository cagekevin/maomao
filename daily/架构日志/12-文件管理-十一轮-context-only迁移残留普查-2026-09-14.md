# 架构日志 · 文件管理（资源素材库落盘）· 2026-09-14（十一轮）

> **文件名**：`12-文件管理-十一轮-context-only迁移残留普查-2026-09-14.md`
> **触发**：用户问「localTool 现在还有债吗？因为**之前改名是直接改文件名，近期改成 context-only**」——
> 这是一次**针对"迁移后残留"的聚焦审计**（改写入入口只是第一步，**残留躲在消费方与描述里**）。
> 方法：Step 0 普查（能力 → 实现 → 份数）→ 只 grep 取证，不猜。

---

## 一、普查结果（context-only 迁移是否已"干净"）

| 能力 / 关切点 | 现状取证 | 结论 |
| --- | --- | --- |
| **磁盘定位**（谁会按 `folder`/`name` 拼磁盘路径） | `path.join(uploadDir, rel)` 的 6 处调用点全部由**不可变来源**派生：`handleRead`/`handleOpenDir`/`handleList`/静态托管/`localPatch`/`resolveLocalImages` 取自 URL；`rescan` 遍历磁盘目录；孤儿判定取 `relativePathFromFileUrl(row.url)` | ✅ **无残留**（TD-12-8 修得彻底，没有第二处 `row.folder+row.name` 拼路径） |
| **引用感知 GC**（改名/移动会不会导致误删盘） | `orphanGc.queryReferenceSources` 的引用来源 = `resources.url` + `tasks.result_url/thumbnail_url` + KV 全部 value（含 `contentId` 反查）—— **完全不读 `folder`/`name`** | ✅ 改名/归类**不可能**让文件变"孤儿"（关键安全面正确） |
| **旧机制残留** | `applyResourceIdentityChange` / `rewriteUrlReferences` / `buildUrlRewritePairs` / `resource:renamed`：`localTool/src` **0 定义**、`src/` **0 引用**（仅 `contracts.ts` 一行历史注 + 测试的反向断言） | ✅ 无死残留 |
| **HTTP 端点** | 只有 `/api/files/move`（归类）+ `/api/resources/rename`（改名），二者均 context-only；无旧"物理改名"端点 | ✅ 无旁路 |
| **文档描述** | `docs/122` 两处仍写「`applyResourceIdentityChange` 改名/移动唯一入口」「改名后失效」= **过时**（该函数已退役） | ❌ **2 处漂移 → 本轮已就地回改**（A7） |

**结论**：**迁移本身是干净的**。真正的问题不在"旧机制残留"，而在**新写入入口引入的三列随动规则没有收敛**（下面两条）。

---

## 二、本轮修的两条真缺陷

### ① 归属被"再上传"覆盖（**十轮自身引入**）

- **机制**：十轮让"命中去重也要刷新 context"，实现时把 `project_id` 与 `folder`/`name` 一起刷新。
- **后果**：在项目 B 上传一张项目 A 已有的图（同内容）→ 行的 `project_id` 变成 B →
  **回项目 A 时该素材直接不可见**（比"分类漂移"严重得多的用户可见后果）。
- **修**：**归属保护** —— 既有行已有 `project_id` 时不覆盖；仅 legacy（NULL）时写入本次项目（TD-12-5 初衷）。
- **不变式**：**归属（`project_id`）不随最近声明漂移；呈现层（`folder`）才随最近声明**。

### ② 手动改名被"再上传"覆盖（十轮语义过宽）

- **机制**：`name` 也被当成"随最近声明"。
- **后果**：用户把素材改名「主角.png」→ 之后从节点把同一张图再发送一次 → 名字被改回节点名（用户显式意图被静默覆盖）。
- **修**：**显式命名优先** —— `resolveDisplayName(prevName, declaredName, diskName)`：
  既有名非空且 ≠ 磁盘哈希名 → **保留**；否则采用本次声明名（"上传后库里显示哈希名"的修复仍在）。
- **收敛**：`folder` 随最近声明 · `name` 显式/先到者优先 · `project_id` 首次声明不动（三列各有规则，写进 `spec/DATAFLOW.md` 唯一真源表）。

---

## 三、验证

- localTool：`npm test`（tsc + node:test）→ **290 pass / 0 fail**
  （本轮新增 4 条 `resolveDisplayName` 纯函数用例 + 1 条端到端归属保护用例）
- 探针（先红后绿）：

```
🔬 探针结论｜归属保护（注入=读不到既有 project_id ⇒ 退化为覆盖）
   文件   : localTool\src\routes\resources.ts（命中 1 处，已还原 sha=85332b63eef5）
   命令   : npm --prefix localTool test
   观测   : exit=1｜输出 400 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「归属应保持首次声明的项目」 — 命中
```

```
🔬 探针结论｜显示名合并（注入=不再保留既有命名 ⇒ 手动改名被覆盖）
   文件   : localTool\src\routes\resources.ts（命中 1 处，已还原 sha=3fb8df39a00d）
   命令   : npm --prefix localTool test
   观测   : exit=1｜输出 444 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「不被再次上传覆盖」 — 命中
```

### ⚠️ 探针踩坑留痕（第三条，同族教训）

归属保护的第一版注入是 `if (false) resource.projectId = prev.project_id;` → **tsc 报 `TS18048 'prev' is possibly 'undefined'`**（注入破坏了条件窄化）→ 探针 `exit=2`、红得不是断言。
第二版注入 `resource.projectId = undefined;` → 测试**红了但不是那一点**：sql.js 报 `tried to bind a value of an unknown type (undefined)`（值进不了 SQL）。
第三版改为**注入读不到既有归属**（`SELECT` 去掉 `project_id` 列）→ 才精确红在断言上。
**口诀**：探针注入要"**最小且类型合法**"——注入本身不能制造新错误类型，否则红的是注入不是缺陷。

---

## 四、度量

| 口径 | 改前（十轮） | 改后（十一轮） |
| --- | --- | --- |
| `project_id` 随动 | 随最近声明（跨项目可被搬走） | **首次声明不动**（legacy 才补写） |
| `name` 随动 | 随最近声明（覆盖手动改名） | **显式/先到者优先** —— 未命名才采用声明名 |
| 三列规则表达 | 散在实现注释里 | **`spec/DATAFLOW.md` 一张不变式表**（`folder`/`name`/`project_id` 各一行） |
| 纯函数护栏 | `contextOfUpload`（6 用例） | + `resolveDisplayName`（4 用例） |
| 端到端护栏 | 2 条 | 3 条（+跨项目归属保护） |
| `docs/122` 描述漂移 | 2 处过时（指向已退役函数） | **已回改** |

---

## 五、残留（登记，不动手）

| 债 | 现象 | 归属 |
| --- | --- | --- |
| **TD-12-14** | `/api/resources/batch-save` 是**第二处可写 context 的旁路**（`upsertResource` 直刷 `name/folder/project_id`，不过 context-only 语义与三条不变式）；当前 `apiRegistry` 标 RESERVED、前端零消费 → 无实害，但一旦接线即绕过不变式 | 12 区（低） |

> 其它"可能被误当债"的两处已在本轮排除并留痕：
> ① **磁盘名是哈希名**（`c12ae61….png`）= **有意设计**（内容寻址 = 去重真源），UI 显示名走 `name` 列，不是债；
> ② **改名后 `id` 仍含旧磁盘名**（`local-tasks-<sha1>.png`）= 正确（id 跟磁盘、不跟显示名，前端 `key` 因此稳定不重渲染）。

## 六、结论

- **回答用户的问题**：localTool 在"改名 → context-only"这条迁移线上**没有残留债**（磁盘定位 / 引用 GC / 旧端点三面都干净）；
  真正的债是**新写入入口的三列随动规则没收敛**——本轮已收敛为**一张不变式表**并各自加了护栏。
- **TD-12-11/12-12 的十轮实现**：`name`/`project_id` 两处过宽**已在十一轮回改**（十轮日志已就地加"十一轮修正"指向，A7）。
- 本区域状态：**已还清**（TD-12-10/11/12/13 全部结清；新增 TD-12-14 低债待裁决）。
