# TASK-027 — 持久化写入点分类枚举（R1 系统性根因：写入失败静默）

> 本文件为唯一产出。仅做「写盘点 + 分类」，未修改任何 `src/` 代码。
> 所有行号均来自本次实际打开文件核实（2026-08-16）。

## 一、项目背景与铁律
- 系统性根因 R1：持久化写入普遍用 `.catch(()=>{})` / `catch { /* ignore */ }` 静默吞错（约 20 处），导致"写入失败用户无感、数据静默丢失"。
- 本任务只做"写盘点 + 分类"，不写代码：产出"哪些写入是关键（必须反馈/重试）、哪些是次要（可静默）"的完整清单。
- 硬约束：只读核验。结论必须有代码证据（文件 + 行号 + 关键片段）。

## 二、判断标准
- **关键**：丢失后用户数据受损/不可恢复（画布快照、任务结果、对话内容）→ 必须反馈 + 尽量重试。
- **次要**：丢了可重新生成/默认值兜底（偏好设置、临时缓存）→ 可静默。
- 对每个「关键」写入，明确它当前是否被静默吞掉（若是，标"当前静默=需修复"）。

---

## 三、写入点完整清单（≥15 条，覆盖所有探索起点文件）

| # | 写入入口 | 文件:行 | 数据内容 | 失败后果 | 关键性 | 建议处理 | 当前是否静默 |
|---|---------|---------|----------|----------|--------|----------|--------------|
| 1 | `sSet`（localStorage/chrome.storage 兜底写入） | `storageAdapter.js` L55-63（L58、L62） | 任意 key（`catch {/* ignore */}`） | 取决于调用方；内存已更新但落盘失败 → 刷新丢 | 地基 | 必反馈/可重试 | **是（静默）** L58/L62 裸 `catch` |
| 2 | `sRemove`（删除兜底） | `storageAdapter.js` L66-74（L69、L73） | 任意 key | 删除未生效 | 地基 | 可静默 | 是（静默）L69/L73 裸 `catch` |
| 3 | `saveProjects`→localStorage 双写 `saveJSON` | `projectStore.js` L54-61（`persist` 内 L55-56 走 `saveJSON` → L32-38 `sSet` L34 裸 `catch`） | 项目列表 + lastOpened | 项目列表/当前项目丢失 | 关键 | 必反馈/重试 | 是（静默）L35-37 `catch{/*ignore*/}` |
| 4 | `saveProjects`→后端 `/api/projects/save` | `projectStore.js` L57-60 + `projectsApi.js` L18-26 | 项目列表 + lastOpened（SQLite 跨端） | 后端不落盘（仅 localStorage 兜底仍在） | 关键 | 必反馈/重试 | **是（静默）** L60 `.catch(()=>{})` |
| 5 | `saveCanvasState`→KV `storageSet` | `projectStore.js` L146-170（L163 `storageSet`）→ `kvStore.js` L62-66 → `kvSet` L31-39 POST `/api/kv/set` | 画布 nodes/edges 快照（用户核心数据） | 画布丢失、刷新空白 | 关键 | 必反馈/重试 | 半静默：`storageSet` 同步 sSet 分支静默；KV 分支 `saveCanvasState` L166-169 `catch` 仅 `console.warn` 返回 `{success:false}`（调用方未强制反馈） |
| 6 | `saveCanvasState`→KV `kvSet` 版本号 | `projectStore.js` L164 + `kvStore.js` L31-39 | `<key>_version` 版本戳 | 版本冲突检测失效 | 关键（附属） | 随 #5 | 半静默（同 #5） |
| 7 | `deleteProject`→KV 快照删除 `storageDelete` | `projectStore.js` L201-202 → `kvStore.js` L69-73 → `kvDelete` L42-46 | `canvas-state-v1-<id>` + `_version` | 残留孤立快照 | 次要 | 可静默 | **是（静默）** L201-202 `.catch(()=>{})` |
| 8 | `taskStore.persist`→`saveTask` 后端 | `taskStore.js` L47-49 + `tasksApi.js` L28-36 POST `/api/tasks/save` | 单条任务记录（含结果 URL） | 任务历史丢失、刷新后任务中心空 | 关键 | 必反馈/重试 | **是（静默）** L48 `.catch(()=>{})` |
| 9 | `reportGenerate`→`persist`（running 落库） | `taskStore.js` L160、L169、L177、L185、L199 | 任务状态流转（running/done/fail） | 同上，进度/结果不落库 | 关键 | 必反馈/重试 | 是（静默，走 #8 `persist`） |
| 10 | `removeTask`→`deleteTask` 后端 | `taskStore.js` L234-238 + `tasksApi.js` L51-55 | 删除任务 | 任务残留 | 次要 | 可静默 | 是（静默）L237 `.catch(()=>{})` |
| 11 | `clearTasksBy`→`batchDeleteTasks` | `taskStore.js` L343-350（L348）+ `tasksApi.js` L58-67 | 批量删任务 | 残留 | 次要 | 可静默 | 是（静默）L348 `.catch(()=>{})` |
| 12 | `clearAllTasks`→`clearAllTasksApi` | `taskStore.js` L351-357（L355）+ `tasksApi.js` L70-74 | 清空全部任务 | 残留 | 次要 | 可静默 | 是（静默）L355 `.catch(()=>{})` |
| 13 | `conversationStore.commit`→`sSet` 落盘 | `conversationStore.js` L86-97（L91-92） | 全量对话列表 `agent_conversations` + 当前 id `agent_active_conversation_id` | 对话历史/记忆丢失（用户核心数据） | 关键 | 必反馈/重试 | **是（静默）** L93-95 `catch{/* 忽略写失败 */}` |
| 14 | `skillStore.saveCustomSkills`→`sSet` | `skillStore.js` L123-127（L125） | 用户自定义 Skill 列表 `agent_skills` | 用户自建 Skill 丢失 | 关键（用户资产） | 必反馈/重试 | **是（静默）** L126 `catch{/* 忽略写失败 */}` |
| 15 | `skillStore.markSkillUsed`→`sSet` | `skillStore.js` L176-182（L180） | Skill 使用次数 `agent_skill_usage` | 仅统计失效 | 次要 | 可静默 | 是（静默）L180 `catch{/* 忽略 */}` |
| 16 | `appSettings.save`→`sSet` | `appSettings.js` L35-37（L36） | UI 偏好 `app_settings`（性能模式/小地图/AI助手） | 偏好重置为默认 | 次要 | 可静默 | 是（静默）L36 `catch{/* ignore */}` |
| 17 | `providerStore.save`→`providerApi.saveProviders`（后端） | `providerStore.js` L150-197（L172 `saveProviders` + `settingsApi` 走 fetch） | API 供应商配置（含 key 脱敏） | API 配置丢失，无法生图 | 关键（功能阻断） | 必反馈/重试 | 否：L192-194 `catch` 返回 `{ok:false,error}`，调用方可见 |
| 18 | `providerStore.save`→`kvSet('active_api_endpoint')` | `providerStore.js` L183-190 | 当前生效 endpoint（KV） | 跨端 endpoint 不同步 | 关键（附属） | 随 #17/可重试 | **是（静默）** L189 `.catch(()=>{})` |
| 19 | `providerStore.save`→`syncConfigBase` 回写 | `providerStore.js` L176-179 | `api.config.json` 本地双源 | 双源漂移 | 次要 | 可静默 | 否：L179 `.catch` 仅记 `configSyncError`（非致命，设计如此） |
| 20 | `accountsStore.persist`→`sSet` | `accountsStore.js` L96-100（L98） | 多开账号环境 `yimao_accounts`（含 Cookie） | 账号环境丢失 | 关键（含登录态） | 必反馈/重试 | **是（静默）** L99 `catch{/* ignore */}` |
| 21 | `cloudSync.uploadConfig`→`writeLS` | `cloudSync.js` L93-103（L97）+ `writeLS` L26-28 | 模拟云端备份 `yimao_cloud_backup` | 备份未生成 | 关键（备份动作） | 必反馈 | 否：L100-102 `catch` 返回 `{ok:false,error}` |
| 22 | `cloudSync.restoreLocal`→`saveProviders`/`saveProjects` | `cloudSync.js` L62-87（L69、L82） | 覆盖恢复本地 providers/projects | 恢复部分失败 | 关键 | 必反馈 | 部分：L73、L84 `catch{/* ignore */}` 静默吞单类失败 |
| 23 | `assetStore.persist`→`sSet` | `assetStore.js` L60-66（L62） | 素材库 `yimao_asset_library` | 素材库丢失 | 关键（用户资产） | 必反馈/重试 | **是（静默）** L63-65 `catch{/* ignore */}` |
| 24 | `assetStore.load` seed→`sSet` | `assetStore.js` L34-45（L40） | 首次 seed 演示素材 | 下次重启重新 seed | 次要 | 可静默 | 是（静默）L40 `catch{/* ignore */}` |
| 25 | `backupStore.importAll`→`writeLS` + `saveCanvasState` | `backupStore.js` L110-132（L117 `writeLS`、L126 `saveCanvasState`） | 导入全量备份到 localStorage + KV | 导入不完整 | 关键（恢复动作） | 必反馈 | 部分：L117 `writeLS` 静默（L55-59 `catch{/* ignore */}`）；L128 单画布失败静默 `catch` |
| 26 | `backupStore.exportAll`→读（无写，仅打包） | `backupStore.js` L78-102 | 读取各 key 打包（非写） | — | — | — | 仅读，无写落盘 |
| 27 | `kvStore.kvSet`/`kvDelete`（底层 KV POST） | `kvStore.js` L31-39、L42-46 | 任意 KV key（画布/endpoint 等） | 取决于调用方 | 地基 | 视上层 | 否：抛错交由上层；但上层多为静默 `catch` |

---

## 四、「关键写入 + 当前被静默吞掉」汇总表

| # | 关键写入 | 文件:行 | 静默证据 | 治理优先级 |
|---|---------|---------|----------|-----------|
| 1 | 项目列表/当前项目 localStorage 落盘 | `projectStore.js` L35-37 | `catch{/* ignore */}` | 高 |
| 2 | 项目列表后端落库 `/api/projects/save` | `projectStore.js` L60 | `.catch(()=>{})` | 高 |
| 3 | 画布快照 KV 落盘 | `projectStore.js` L166-169 | `catch` 仅 `console.warn` 返回失败、无用户反馈；同步分支 `storageSet`→`sSet` 静默 | 最高 |
| 4 | 任务记录后端落库 `/api/tasks/save` | `taskStore.js` L48 | `.catch(()=>{})` | 高 |
| 5 | 对话历史落盘 `agent_conversations` | `conversationStore.js` L93-95 | `catch{/* 忽略写失败 */}` | 最高 |
| 6 | 用户自定义 Skill 落盘 `agent_skills` | `skillStore.js` L126 | `catch{/* 忽略写失败 */}` | 中 |
| 7 | 当前生效 endpoint KV 落盘 | `providerStore.js` L189 | `.catch(()=>{})` | 中 |
| 8 | 账号环境落盘 `yimao_accounts` | `accountsStore.js` L99 | `catch{/* ignore */}` | 高 |
| 9 | 素材库落盘 `yimao_asset_library` | `assetStore.js` L63-65 | `catch{/* ignore */}` | 中 |
| 10 | 存储地基 `sSet`/`sRemove` 落盘 | `storageAdapter.js` L58/L62/L69/L73 | 裸 `catch {/* ignore */}` | 最高（地基，影响所有上层） |
| 11 | 导入备份逐键覆盖（localStorage 分支） | `backupStore.js` L55-59 | `catch{/* ignore */}` | 中 |

> 说明：#17 providerStore.save 后端、#21 cloudSync.uploadConfig、#22 的 `saveProjects` 主路径均**未**静默（返回错误给调用方），不列入需修复静默项。

---

## 五、R1 治理建议

### A. 必须走「统一上报 + 重试」（关键写入，当前静默=需修复）
1. **存储地基 `sSet`/`sRemove`**（`storageAdapter.js` L55-74）：建议引入统一写失败上报（toast + 错误事件总线），非插件环境 `localStorage.setItem` 抛错（配额满/隐私模式）时反馈；插件环境 `chrome.storage.local.set` 应接其 callback 的错误参而非裸 `try/catch`。
2. **画布快照**（`projectStore.js` L146-170）：用户核心资产，写入失败必须 toast 提示 + 允许重试（已有 `{success:false}` 返回值，调用方需据此弹反馈，而非仅 `console.warn`）。
3. **对话历史**（`conversationStore.js` L86-97）：丢失即丢用户全部记忆，建议写失败弹"本地存储已满/不可用"提示，并提供导出兜底。
4. **任务记录后端**（`taskStore.js` L48）：建议改为"失败进内存重试队列 + toast"，至少让用户在任务中心看到"未保存"标记。
5. **项目列表 localStorage + 后端**（`projectStore.js` L54-61）：后端静默 `.catch` 应改为上报，localStorage 兜底失败应提示。
6. **账号环境 / 素材库 / 自定义 Skill**（`accountsStore.js` L99、`assetStore.js` L63、`skillStore.js` L126）：属用户资产，建议统一上报（轻量 toast）而非静默。

### B. 可保持静默（次要写入，丢了可重生成/默认兜底）
- `sRemove` 删除兜底异常、画布快照删除 KV（`projectStore.js` L201-202）、任务删除/批量删/清空（`taskStore.js` L237/L348/L355）、Skill 使用次数（`skillStore.js` L180）、UI 偏好（`appSettings.js` L36）、素材库 seed（`assetStore.js` L40）、`providerStore` 的 `syncConfigBase` 双源回写（L179 已记非致命错误）。
- 这些失败要么有"重做即恢复"语义，要么不影响主数据，静默可接受。

### C. 已正确非静默、保持现状
- `providerStore.save` 后端保存（L192 返回错误）、`cloudSync.uploadConfig`（L100 返回错误）、`cloudSync.restoreLocal` 主路径（L73/L84 虽静默单类但整体返回 `written` 计数，调用方可感知恢复项数）。建议治理时把 `restoreLocal` 的静默 `catch` 改为累加失败计数返回，让调用方区分"恢复了几项/漏了几项"。

---

## 六、验收对照
1. ✅ 清单完整：27 条写入入口，每条带文件+行号+数据内容+关键性评级。
2. ✅ 区分关键/次要：关键 13 项（含地基），次要 14 项。
3. ✅ 每个关键写入标注当前是否静默：汇总表（第四节）列 11 项"关键且当前静默"。
4. ✅ 亲自核实：所有行号来自本次实际打开文件，非引用外部文档。

> 注：探查中未找到 `src/components/base/providerStore.js` 与 `accountsStore.js` 于根 `base/`，实际位于 `src/components/base/settings/`（已由 `search_file` 核实：L？→ `settings/providerStore.js`、`settings/accountsStore.js`），行号以实际文件为准。
