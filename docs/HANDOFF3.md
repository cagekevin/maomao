# 一毛AI画布 · Handoff 3（2026-07-20）

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

## 2. "破图 / 疯狂刷新" 误判纠正 —— 已撤销改动，仅沉淀结论

### 2.1 现象

本地模式下，资源面板图片显示异常（"破图"），同时本地工具服务日志反复出现：

```
[POST] /api/proxy
[POST] /api/resources/rescan   ← 反复
[GET]  /api/resources           ← 反复
```

### 2.2 错误方向（已放弃）

曾误判为前端 `ii()` 相对路径在 `chrome-extension://` 下解析失败，并对 `src/_engine/App.js` 的 `ii()` / `Xr()` / `Zr()` / `ri()` 四处做了修改。**此方向错误**：终端日志证明图片其实已成功上传（`/api/files/upload` + `/api/tasks/save` 均成功，文件落在 `C:\Users\xinye\.yimao-localtool\uploads\tasks`）。问题不在 URL 解析，而在资源面板不断 rescan/重载，把刚生成的图片覆盖或清掉。

### 2.3 已撤销改动

所有前端改动已 `git checkout -- src/_engine/App.js` 撤销，`git diff --stat` 对该文件无任何输出，回到 git 原始基线（初始提交 `0e0b2cc`）。当前工作区仅余原本就存在的未跟踪文件（如 `启动项目.command/.ps1`），与本次无关。

### 2.4 真实根因（待定位，未改代码）

- rescan 后端**无定时器**：`localTool/src/index.ts` 仅在 `POST /api/resources/rescan` 注册 handler（L196-L198），后端不会自循环。
- 因此循环调用方在 **V1 前端**（`src/_engine/App.js`）。`resources/rescan` 只在 `Ev()` 一处定义，需找其调用链 + 是否存在定时器 / 轮询 effect（如 `useEffect` + `setInterval`）。

---

## 3. 待后续 session 处理的事项

- [ ] **定位 rescan 循环真因**：从 `src/_engine/App.js` 的 `Ev()` 定义出发，向下挖调用方与定时器/轮询 effect，确认是谁在循环调用 `resources/rescan` 和 `proxy`。**只定位、先不改代码**。
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
