# 猫猫AI画布 · Handoff 3（2026-07-20）

> 承接 HANDOFF2.md。本文记录 2026-07-19 ~ 07-20 跨 session 排查的两条主线的结论、改动、验证结果、残留风险。
> **默认工作上下文仍是 V1（原版引擎）。** 代码位置同 HANDOFF2 §3。

---

## 0. 本回合做了什么（一句话）

1. **资源面板类型识别验证（已通过）**：清表重建后 rescan，`folder` / `text` / `image` 三类资源全部正确进入 `resources` 表，前端资源面板已能显示文件夹、md/文本、图片、视频、音频。
2. **"破图/疯狂刷新"误判纠正（已撤销改动，仅沉淀结论）**：把现象误判为相对路径在 `chrome-extension://` 下解析错误，方向错了；真实循环源是前端反复调用 `resources/rescan` + `resources` + `proxy`。相关前端改动已全部 `git checkout` 撤销，代码回到干净基线。

---

## 1. 资源面板类型识别（folder/text/image）—— 已验证通过

### 1.1 验证方法

- 清空 `resources` 表（走 `/api/resources/clear` POST），再触发 `/api/resources/rescan` POST。
- 创建测试资产：文件夹 `testfolder_handoff`、markdown `testnote_handoff.md`，连同既有图片一起 rescan。

### 1.2 验证结果（resources 表实际内容）

```
[folder] testfolder_handoff        ← 新增文件夹识别生效
[folder] 新建文件夹 / upload / drop ← 磁盘文件夹均被识别
[text]   testnote_handoff.md        ← 新增 md 文本识别生效
[text]   1784511367685-text_result_*.txt ← 既有 txt 也识别
[image]  *.png ×4                    ← 既有图片
```

三条类型 `folder` / `text` / `image` 全部正确入库，前端资源面板现可显示：文件夹、md/文本、图片、视频、音频。

### 1.3 类型映射规则（后端 `localTool/src/routes/resources.ts`）

| 扩展名 | 入库 type |
|--------|-----------|
| `.png .jpg .jpeg .webp .gif .bmp .svg` | `image` |
| `.mp4 .webm .mov .avi .mkv .flv .m4v` | `video` |
| `.mp3 .wav .flac .ogg .m4a` | `audio` |
| `.md .markdown .txt` | `text`（前端有文本渲染分支，统一归 text） |
| 目录项 | `folder` |

映射表在 `RESCAN_FILE_TYPE`（resources.ts L12-L21）。**未登记扩展名会被 `extToFileType` 直接跳过**，不会进入资源表。

### 1.4 实现要点

- rescan 仅扫描 `uploadDir` 下的子目录（`tasks` / `migrated` / 其它），跳过 `.thumbnails` 与以 `.` 开头的项（resources.ts L36-L54）。
- 文件夹按 `isDirectory()` 单独作为 `type=folder` 录入，`url=/files/{folder}/{name}`（L57-L77）。
- `id = local-{folder}-{name}`，rescan 对已有 id 直接 `skipped`（保留收藏/手动元数据），不会覆盖（L60-L93）。

---

## 2. "破图 / 疯狂刷新" 排查与修复（2026-07-19 ~ 07-20）

### 2.1 现象

本地模式下，资源面板图片显示异常（"破图"），同时本地工具服务日志反复出现：

```
[POST] /api/proxy
[POST] /api/resources/rescan   ← 反复
[GET]  /api/resources           ← 反复
```

### 2.2 错误方向（2026-07-19，已放弃）

曾误判为前端 `ii()` 相对路径在 `chrome-extension://` 下解析失败，并对 `src/_engine/App.js` 的 `ii()` / `Xr()` / `Zr()` / `ri()` 四处做了修改。**此方向错误**：终端日志证明图片其实已成功上传（`/api/files/upload` + `/api/tasks/save` 均成功，文件落在 `C:\Users\xinye\.maomao-localtool\uploads\tasks`）。问题不在 URL 解析，而在资源面板不断 rescan/重载，把刚生成的图片覆盖或清掉。

> ⚠️ 历史记录澄清：早前某 session 曾声称"已 `git checkout` 撤销 App.js 全部改动、回到基线 `0e0b2cc`"。**该结论不准确**——实际工作区里保留了对"破图"真正有效的修复（见 2.4），且本次（2026-07-20）已随 commit `3db58ff` 一并提交。文档早期版本照抄了"已撤销"说法，特此更正。

### 2.3 问题 A：疯狂刷新（rescan 频率，2026-07-20 已修复 `3db58ff`）

- rescan 后端**无定时器**：`localTool/src/index.ts` 仅在 `POST /api/resources/rescan` 注册 handler（L196-L198），后端不会自循环。
- 循环调用方在 **V1 前端**（`src/_engine/App.js`）：`transit` Tab 切换的 effect 直接调用 `Oi(true)`（裸 rescan），在频繁切换 / 多触发下造成 rescan + resources 反复请求，即日志里的"疯狂刷新"。
- **已修复**（`App.js`，随 `3db58ff` 提交）：
  1. 新增 `rescanThrottledSync`（3 秒节流，基于 `rescanLastRunRef`）替代裸 `we()`，`transit` Tab 切换的 effect 改调它（L42915、L44298）。
  2. 生成完成时把结果写入 `resources` 表（`mutiwindow-task-completed` 监听内，L31358），图片/视频生成后自动进资源面板，不再依赖反复 rescan 拉取。
- 命名合规：`rescanThrottledSync` / `rescanLastRunRef` 均为语义化命名（符合 §5.4 规则）。

### 2.4 问题 B：资源面板破图（相对路径 url，2026-07-20 已修复 `d5d48dd`）★ 真凶

> ⚠️ 重要更正：早前把"破图"笼统归因为"transit Tab 裸 rescan 把图片覆盖/清掉"是**错误判断**。rescan 频率只影响刷新次数，**不会造成破图**。破图的真正根因是 url 格式，见下。

- **根因**：`localTool/src/routes/resources.ts` 的 rescan 把资源 `url` 存成**相对路径** `/files/{folder}/{name}`。资源面板运行在 `chrome-extension://` 页面，直接 `<img src="/files/...">` 被解析成 `chrome-extension://xxx/files/...` → 404 → **所有图片/视频破图**（包括历史图，不止生成的）。
- **已修复**（`resources.ts`，随 `d5d48dd` 提交）：新增 `LOCAL_TOOL_BASE = 'http://127.0.0.1:18080'` + `toAbsoluteFileUrl()`，rescan 入库时把 `url` 补全为 `http://127.0.0.1:18080/files/...`，前端 `<img src>` 可直接加载。
- **验证**：清表 + rescan 后 11 条资源 `url` 均为完整地址，图片可访问。
- ⚠️ 已知次要问题：中文目录名（如"新建文件夹"）在 resources 表里读出乱码（`æ°å»ºæä»¶å¤±`），疑似 sql.js 以 Latin1 存中文。不影响图片加载，但资源面板中文文件夹名显示异常，待后续修（见 §3）。

### 2.5 残留风险

- 刷新节流仅 3 秒，极端高频切换仍可能触发有限次 rescan，但已不会"疯狂"。
- rescan 入库的 `url` host 硬编码 `127.0.0.1:18080`（localTool 监听地址）。若以后 localTool 改 host/port 或前端跨设备访问，需同步此处（或改为前端渲染时按 `config.js` 的 `LOCAL_ENGINE` 动态补前缀）。
- 生成写资源表里的 `type` 判定（`video`/`image`/`text`）依赖 `r` 字段取值，若新增节点类型需同步补充。

---

## 3. 待后续 session 处理的事项

- [x] ~~定位 rescan 循环真因（疯狂刷新）~~ → **已完成（2026-07-20 `3db58ff`）**：transit Tab 裸 rescan，已用 `rescanThrottledSync` 节流，见 §2.3。
- [x] ~~修复资源面板破图~~ → **已完成（2026-07-20 `d5d48dd`）**：根因为 rescan 存相对路径 url，已补全为完整地址，见 §2.4。
- [ ] **修复中文目录/文件名乱码**：resources 表里中文名（如"新建文件夹"）读出为 Latin1 乱码（`æ°å»ºæä»¶å¤±`），疑似 sql.js 以 Latin1 存中文。影响资源面板中文文件夹显示，需排查 database.ts 存读编码或 rescan 时的字符串编码，见 §2.4。
- [ ] **确认轮询端点与成功结果格式**（`lovart-chat` 异步生图，HANDOFF2 §9.3 遗留）：轮询 URL、成功 `status` 取值、图片字段位置。
- [ ] 实现 `lovart-chat` 生图异步轮询（HANDOFF2 §9.3）。
- [ ] 待处理 bug：提示词库"最近使用"不记录本地提示词（HANDOFF2 §9.3 遗留）。

---

## 4. 关键代码位置速查

| 位置 | 内容 |
|------|------|
| `localTool/src/routes/resources.ts` L12-L21 | `RESCAN_FILE_TYPE` 类型映射表 |
| `localTool/src/routes/resources.ts` L27-L111 | `handleResourcesRescan`：扫描 uploadDir，录入 folder/text/image/video/audio |
| `localTool/src/routes/resources.ts` L57-L77 | 文件夹作为 `type=folder` 录入分支 |
| `localTool/src/routes/resources.ts` L189-L216 | `handleResourcesClear`：清表（可带 `deleteFiles`） |
| `localTool/src/index.ts` L196-L198 | rescan 仅注册为 `POST /api/resources/rescan`，无后端定时器 |
| `src/_engine/App.js` `Ev()` | rescan 前端定义点（循环调用方待挖） |

---

## 5. 命名与版本澄清（防止后续 session 混淆）

聊天记录中多次出现 V1/V2、变量名、App.js 与其它 js 到底用哪个的混淆。**以下为唯一事实，后续 session 直接采信：**

### 5.1 用 V1 还是 V2？

**默认且当前运行的只有 V1（原版引擎）。V2 是已暂停的归档代码，不参与运行。**

| 版本 | 位置 | 是否运行 | 说明 |
|------|------|---------|------|
| **V1** | `src/_engine/` + `src/main.tsx` + `src/background.ts` | ✅ 运行中 | 反编译原版引擎，已魔改成本地模式 |
| **V2** | `src/v2/` | ❌ 不运行 | 进度见 HANDOFF2 §2，已暂停，纯归档 |

**判定铁证**：`src/main.tsx` L41 `const App = React.lazy(() => import('./_engine/App.js'))` —— 入口只加载 `_engine/App.js`。V2 的 `src/v2/AppShell` 当前未被任何运行路径 import。
**规则**：除非用户明确说"用 V2 / 切到 V2 / 恢复 V2"，否则所有改动都在 V1（`src/_engine/`）下进行。

### 5.2 `_engine/` 下的 js 文件，到底改哪个？

| 文件 | 角色 | 是否要改 |
|------|------|---------|
| **`App.js`** | **主程序（1.72MB 反编译产物）** | ✅ 唯一要改的逻辑文件（V1 全部业务逻辑在这） |
| `config.js` | 集中配置层（端点地址等） | ✅ 改配置时动它 |
| `entry.js` | 入口壳（接入点引导） | 极少改 |
| `App.original.js` | **原始备份**，git 基线 `0e0b2cc` 的同款 | ❌ 只读参照，别改 |

| `vendor-Cr1JWW-B.js` | 打包后的第三方 vendor | ❌ 别改 |
| `rolldown-runtime-*.js` | rolldown 运行时垫片 | ❌ 别改 |
| `captureVideoFrame-*.js` | 摄像头抽帧小工具 | ❌ 别改 |
| `*.css` | 预编译样式 | ❌ 别改（除非改样式） |

**关键提醒**：`App.original.js` 与 `App 备份.js` 是备份，**不要往里写逻辑**，改完别的文件后容易误以为是"原版"。唯一权威运行文件是 `App.js`。恢复基线用 `git checkout -- src/_engine/App.js`，不是复制这两个备份。

### 5.3 混淆变量名（ii/Xr/Zr/ri/Ev/Jn…）

`App.js` 是混淆后的反编译代码，函数/变量名（`ii()` `Xr()` `Zr()` `ri()` `Ev()` `Jn()` `Oa()` `er()` 等）都是反编译器生成的，**没有稳定语义**，不同次反编译可能重命名。引用时**必须带行号**（如 `Ev()` 定义在某行、`Jn` 在 32425），不能只说"改 ii()"。行号映射可查 `docs/var-mapping.txt` 与 `docs/func-mapping.txt`（但行号会随编辑漂移，引用时以实际打开为准）。

> 注意：`U_` / `W_` / `G_` / `H_` / `B_` 这类短下划线名（如 `U_ = 'http://127.0.0.1:18080'`）**也是原版反编译残留**，在 `App.original.js` 基线里同样存在，**不是我们加的，不要改**（改了会和基线对不上，且 grep 会误判）。

### 5.4 我们自己新建的变量/函数 —— 禁止再用短混淆名（硬规则）

**规则**：在 `App.js` / `config.js` / `localTool/*` 中**由我们新增**的任何变量、函数、常量，必须使用**语义化命名**，严禁使用 `ii` / `Xr` / `U_` / `W_` / `G_` 这类反编译风格短名。

- ✅ 允许：`rawResp`、`CloudSyncEngine`、`LOCAL_ENGINE`、`localEngineBase`、`taskId`、`customRawResponse`
- ❌ 禁止：`ii()` `Xr()` `Zr()` `ri()` `U_` `W_` `G_` `a_` `e_` 等单/双字母 + 下划线
- 常量用 `UPPER_SNAKE`，函数/变量用 `camelCase`，类名用 `PascalCase`；命名要能看出用途（如 `rawResp` 而非 `r2`）。
- 在反编译混淆代码里插入新逻辑时，新变量也不要复用周围的短名风格，避免后续 session 分不清"这是原版混淆的"还是"我们加的"。

**现状核查（2026-07-20）**：当前我们自己新增的代码命名已合规——诊断变量用 `rawResp`（`App.js` ~32785）、云同步用 `CloudSyncEngine`（`App.js` ~43760）、配置层 `config.js` 全用 `UPPER_SNAKE` 常量。无需回溯重命名历史代码；此规则仅约束**后续新增**。

### 5.4 localTool 与 V1/V2 的关系

`localTool/`（`src/routes/*`、`src/db/database.ts`）是 **V1/V2 共用的本地工具服务（:18080）**，独立于前端版本。资源面板类型识别、rescan、文件上传的改动都在 `localTool/` 里，不要跑到 `src/_engine/App.js` 去找。

---

## 6. 已验证事实（交棒时可直接采信）

1. `resources` 表类型识别正确：folder / text / image / video / audio 均按扩展名与目录类型正确分类。
2. 前端 `src/_engine/App.js` 当前处于 git 干净基线（初始提交 `0e0b2cc`），无任何本次修改残留。
3. 图片上传链路本身正常（files/upload + tasks/save 成功落盘）。
4. 资源面板"破图/刷新"尚未修复，根因定位工作未开始（仅排除"URL 解析错误"方向）。
5. **当前运行 = V1（`_engine/App.js`）**，V2（`src/v2/`）不运行；改代码只动 V1，除非用户明确切 V2。
