# TASK-027 — 持久化写入点分类枚举（R1 系统性根因：写入失败静默）

> 本文件为唯一产出。仅做「写盘点 + 分类」，未修改任何 `src/` 代码。
> 所有行号均来自本次实际打开文件核实（2026-08-16，含二次审计补漏）。

## 一、项目背景与铁律
- 系统性根因 R1：持久化写入普遍用 `.catch(()=>{})` / `catch { /* ignore */ }` 静默吞错，导致"写入失败用户无感、数据静默丢失"。
- 本任务只做"写盘点 + 分类"，不写代码：产出"哪些写入是关键（必须反馈/重试）、哪些是次要（可静默）"的完整清单。
- 硬约束：只读核验。结论必须有代码证据（文件 + 行号 + 关键片段）。

## 二、判断标准
- **关键**：丢失后用户数据受损/不可恢复（画布快照、任务结果、对话内容、账号、素材、自定义 Skill、预设、生成结果落盘）→ 必须反馈 + 尽量重试。
- **次要**：丢了可重新生成/默认值兜底（偏好设置、临时缓存、使用计数、seed 演示）→ 可静默。
- 对每个「关键」写入，明确它当前是否被静默吞掉（若是，标"当前静默=需修复"）。

> 文件位置说明（二次审计发现）：`providerStore.js` 与 `accountsStore.js` 实际位于 `src/components/base/settings/`（非 `base/` 根），已由 `search_file` 核实；`nodePrefs.js`、`promptManager.js`、`agentModelStore.js`、`filesApi.js`、`resourcesApi.js` 为初版遗漏、本次补全。

---

## 三、写入点完整清单（共 36 条，覆盖所有探索起点 + 下游落库入口）

| # | 写入入口 | 文件:行 | 数据内容 | 失败后果 | 关键性 | 建议处理 | 当前是否静默 |
|---|---------|---------|----------|----------|--------|----------|--------------|
| 1 | `sSet`（localStorage/chrome.storage 兜底写入） | `storageAdapter.js` L55-63（`L58` 非插件 `setItem`、`L62` 插件 `set`） | 任意 key（裸 `catch {/* ignore */}`） | 内存已更新但落盘失败 → 刷新丢 | 地基 | 必反馈/可重试 | **是（静默）** L58、L62 |
| 2 | `sRemove`（删除兜底） | `storageAdapter.js` L66-74（`L69`、`L73`） | 任意 key | 删除未生效 | 地基 | 可静默 | 是（静默）L69、L73 |
| 3 | `projectStore.persist`→localStorage `saveJSON` | `projectStore.js` L54-61（L55-56 → `saveJSON` L32-38 `sSet` L34） | 项目列表 `projects` + `lastOpenedProject` | 项目列表/当前项目丢失 | 关键 | 必反馈/重试 | **是（静默）** L35-37 `catch{/*ignore*/}` |
| 4 | `projectStore.persist`→后端 `/api/projects/save` | `projectStore.js` L57-60 + `projectsApi.js` L18-26 | 项目列表 + lastOpened（SQLite 跨端） | 后端不落盘（仅 localStorage 兜底） | 关键 | 必反馈/重试 | **是（静默）** L60 `.catch(()=>{})` |
| 5 | `saveCanvasState`→KV `storageSet`/`kvSet` | `projectStore.js` L146-170（L163 `storageSet`→`kvStore.js` L62-66 → L31-39 POST `/api/kv/set`） | 画布 nodes/edges 快照（用户核心数据） | 画布丢失、刷新空白 | 关键 | 必反馈/重试 | 半静默：同步分支 `sSet` 静默；KV 分支 L166-169 `catch` 仅 `console.warn` 返回 `{success:false}`，调用方未强制反馈 |
| 6 | `saveCanvasState`→KV 版本号 `kvSet` | `projectStore.js` L164 + `kvStore.js` L31-39 | `<key>_version` 版本戳 | 版本冲突检测失效 | 关键（附属） | 随 #5 | 半静默（同 #5） |
| 7 | `deleteProject`→KV 快照删除 `storageDelete` | `projectStore.js` L201-202 → `kvStore.js` L69-73 → `kvDelete` L42-46 | `canvas-state-v1-<id>` + `_version` | 残留孤立快照 | 次要 | 可静默 | **是（静默）** L201-202 `.catch(()=>{})` |
| 8 | `taskStore.persist`→`saveTask` 后端 | `taskStore.js` L47-49 + `tasksApi.js` L28-36 POST `/api/tasks/save` | 单条任务记录（含结果 URL） | 任务历史丢失、刷新后任务中心空 | 关键 | 必反馈/重试 | **是（静默）** L48 `.catch(()=>{})` |
| 9 | `reportGenerate` 状态流转→`persist` | `taskStore.js` L160、L169、L177、L185、L199 | running/done/fail 进度+结果 | 进度/结果不落库 | 关键 | 必反馈/重试 | 是（静默，走 #8 `persist`） |
| 10 | `removeTask`→`deleteTask` 后端 | `taskStore.js` L237 + `tasksApi.js` L51-55 | 删除任务 | 任务残留 | 次要 | 可静默 | 是（静默）L237 `.catch(()=>{})` |
| 11 | `clearTasksBy`→`batchDeleteTasks` | `taskStore.js` L348 + `tasksApi.js` L58-67 | 批量删任务 | 残留 | 次要 | 可静默 | 是（静默）L348 `.catch(()=>{})` |
| 12 | `clearAllTasks`→`clearAllTasksApi` | `taskStore.js` L355 + `tasksApi.js` L70-74 | 清空全部任务 | 残留 | 次要 | 可静默 | 是（静默）L355 `.catch(()=>{})` |
| 13 | `conversationStore.commit`→`sSet` 落盘 | `conversationStore.js` L86-97（L91-92） | 全量对话 `agent_conversations` + `agent_active_conversation_id` | 对话历史/记忆丢失（用户核心数据） | 关键 | 必反馈/重试 | **是（静默）** L93-95 `catch{/* 忽略写失败 */}` |
| 14 | `skillStore.saveCustomSkills`→`sSet` | `skillStore.js` L123-127（L125） | 用户自定义 Skill 列表 `agent_skills` | 用户自建 Skill 丢失 | 关键（用户资产） | 必反馈/重试 | **是（静默）** L126 `catch{/* 忽略写失败 */}` |
| 15 | `skillStore.markSkillUsed`→`sSet` | `skillStore.js` L176-182（L180） | Skill 使用次数 `agent_skill_usage` | 仅统计失效 | 次要 | 可静默 | 是（静默）L180 `catch{/* 忽略 */}` |
| 16 | `appSettings.save`→`sSet` | `appSettings.js` L35-37（L36） | UI 偏好 `app_settings` | 偏好重置为默认 | 次要 | 可静默 | 是（静默）L36 `catch{/* ignore */}` |
| 17 | `providerStore.save`→`providerApi.saveProviders`（后端） | `providerStore.js` L150-197（L172）+ `settingsApi.js` L7-18 `request` | API 供应商配置（key 脱敏） | API 配置丢失，无法生图 | 关键（功能阻断） | 必反馈/重试 | 否：`request` L14-15 非 2xx 抛错 → L192-194 `catch` 返回 `{ok:false,error}`，调用方可见 |
| 18 | `providerStore.save`→`kvSet('active_api_endpoint')` | `providerStore.js` L183-190 | 当前生效 endpoint（KV） | 跨端 endpoint 不同步 | 关键（附属） | 随 #17/可重试 | **是（静默）** L189 `.catch(()=>{})` |
| 19 | `providerStore.save`→`syncConfigBase` 回写 | `providerStore.js` L176-179 | `api.config.json` 本地双源 | 双源漂移 | 次要 | 可静默 | 否：L179 `.catch` 仅记 `configSyncError`（非致命，设计如此） |
| 20 | `accountsStore.persist`→`sSet` | `accountsStore.js` L96-100（L98） | 多开账号环境 `yimao_accounts`（含 Cookie） | 账号环境丢失 | 关键（含登录态） | 必反馈/重试 | **是（静默）** L99 `catch{/* ignore */}` |
| 21 | `cloudSync.uploadConfig`→`writeLS` | `cloudSync.js` L93-103（L97）+ `writeLS` L26-28 | 模拟云端备份 `yimao_cloud_backup` | 备份未生成 | 关键（备份动作） | 必反馈 | 否：L100-102 `catch` 返回 `{ok:false,error}` |
| 22 | `cloudSync.restoreLocal`→`saveProviders`/`saveProjects` | `cloudSync.js` L62-87（L69、L82） | 覆盖恢复本地 providers/projects | 恢复部分失败 | 关键 | 必反馈 | 部分：L73、L84 `catch{/* ignore */}` 静默吞单类失败（整体返回 `written` 计数） |
| 23 | `assetStore.persist`→`sSet` | `assetStore.js` L60-66（L62） | 素材库 `yimao_asset_library` | 素材库丢失 | 关键（用户资产） | 必反馈/重试 | **是（静默）** L63-65 `catch{/* ignore */}` |
| 24 | `assetStore.load` seed→`sSet` | `assetStore.js` L34-45（L40） | 首次 seed 演示素材 | 下次重启重新 seed | 次要 | 可静默 | 是（静默）L40 `catch{/* ignore */}` |
| 25 | `backupStore.importAll`→`writeLS` | `backupStore.js` L110-132（L117）+ `writeLS` L55-59 | 导入全量备份到 localStorage（各 `yimao_*` 键） | 导入不完整 | 关键（恢复动作） | 必反馈 | 部分：L117 `writeLS` 静默（L58 `catch{/* ignore */}`） |
| 26 | `backupStore.importAll`→`saveCanvasState` | `backupStore.js` L126 + `projectStore.js` L146-170 | 导入画布快照到 KV | 单画布恢复失败 | 关键（恢复动作） | 随 #5/必反馈 | 部分：L128 单画布失败静默 `catch` |
| 27 | `backupStore.exportAll`→只读打包 | `backupStore.js` L78-102 | 读取各 key 打包（非写） | — | — | — | 仅读，无写落盘 |
| 28 | `nodePrefs.useNodePrefs.set`→`sSet` | `nodePrefs.js` L61-75（L69） | 节点上次参数 `yimao_node_prefs` | 节点默认参数记忆丢失（重设成本） | 次要 | 可静默 | 是（静默）L70 `catch{/* ignore */}` |
| 29 | `promptManager.writeJSON`（savePresets） | `promptManager.js` L45-51（L47）+ `savePresets` L75-77 | 提示词预设 `yimao_preset_prompts` | 用户预设丢失 | 关键（用户资产） | 必反馈/重试 | **是（静默）** L48-50 `catch{/* 忽略 */}` |
| 30 | `promptManager.writeJSON`（recordRecent） | `promptManager.js` L96-100（L99） | 最近使用 `yimao_preset_recent` | 最近使用列表失效 | 次要 | 可静默 | 是（静默）L48-50 `catch{/* 忽略 */}` |
| 31 | `agentModelStore.saveAgentChatModel`→`sSet` | `agentModelStore.js` L24-28（L26） | AI 聊天模型 `agent_chat_model` | 聊天模型偏好丢失 | 次要 | 可静默 | 是（静默）L27 `catch{/* 忽略 */}` |
| 32 | `filesApi.saveResultToTasks`→`/api/files/upload` | `filesApi.js` L136-173（L148/L158 fetch） | 生成结果落盘 tasks 目录 | 生成面板看不到结果图/文 | 关键（生成产出） | 必反馈/重试 | 半静默：L149/L163/L169 `console.warn` + 返回 `null`，调用方无强制反馈 |
| 33 | `filesApi.saveInlineToLocal`→`/api/files/upload` | `filesApi.js` L44-66（L55 fetch） | 内联 dataURL 落盘 | 内联资源未转本地 URL | 次要 | 可静默 | 半静默：L56/L62 `console.warn` 返回 `null` |
| 34 | `filesApi.uploadFileToLocal`→`/api/files/upload` | `filesApi.js` L78-95（L84 fetch） | 拖拽/上传文件落盘 | 上传文件未落盘 | 关键（用户上传） | 必反馈/重试 | 半静默：L85/L91 `console.warn` 返回 `null` |
| 35 | `filesApi.saveTextToTasks`→`/api/files/upload` | `filesApi.js` L182-206（L195 fetch） | 纯文本结果落盘 txt | 文本结果未收录 | 关键（生成产出） | 必反馈/重试 | 半静默：L196/L202 `console.warn` 返回 `null` |
| 36 | `resourcesApi.saveResource`→`/api/resources/save` | `resourcesApi.js` L42-50 | 资源收藏/upsert（SQLite） | 收藏态丢失 | 次要 | 可静默 | 否：`request` 风格 L48 非 2xx 抛错（调用方需 `catch`；语义为非静默） |

---

## 四、「关键写入 + 当前被静默吞掉」汇总表（需 R1 治理修复）

| # | 关键写入 | 文件:行 | 静默证据 | 治理优先级 |
|---|---------|---------|----------|-----------|
| 1 | 存储地基 `sSet`/`sRemove` | `storageAdapter.js` L58/L62/L69/L73 | 裸 `catch {/* ignore */}` | 最高（地基，影响所有上层 #3/#13/#14/#20/#23/#28/#29/#31） |
| 2 | 画布快照 KV 落盘 | `projectStore.js` L166-169 | `catch` 仅 `console.warn` 返回失败、无用户反馈；同步分支 `storageSet`→`sSet` 静默 | 最高 |
| 3 | 对话历史落盘 | `conversationStore.js` L93-95 | `catch{/* 忽略写失败 */}` | 最高 |
| 4 | 任务记录后端落库 | `taskStore.js` L48 | `.catch(()=>{})` | 高 |
| 5 | 项目列表 localStorage + 后端 | `projectStore.js` L35-37、L60 | `catch{/*ignore*/}` + `.catch(()=>{})` | 高 |
| 6 | 账号环境落盘 | `accountsStore.js` L99 | `catch{/* ignore */}` | 高 |
| 7 | 素材库落盘 | `assetStore.js` L63-65 | `catch{/* ignore */}` | 中 |
| 8 | 用户自定义 Skill 落盘 | `skillStore.js` L126 | `catch{/* 忽略写失败 */}` | 中 |
| 9 | 提示词预设落盘 | `promptManager.js` L48-50 | `catch{/* 忽略 */}` | 中 |
| 10 | 当前生效 endpoint KV 落盘 | `providerStore.js` L189 | `.catch(()=>{})` | 中 |
| 11 | 生成结果落盘（4 处 filesApi） | `filesApi.js` L149/L163/L169、L56/L62、L85/L91、L196/L202 | `console.warn` + 返回 `null`，无用户反馈 | 高（生成产出丢） |
| 12 | 导入备份逐键覆盖 | `backupStore.js` L58（writeLS） | `catch{/* ignore */}` | 中 |

> 已正确**非静默**（不列入修复项）：#17 `providerStore.save` 后端（返回 error）、#21 `cloudSync.uploadConfig`（返回 error）、#36 `resourcesApi.saveResource`（抛错）、#19 `syncConfigBase`（记非致命 error）。
> #22 `restoreLocal`、#25/#26 `importAll` 为"部分静默"——建议治理时把单类失败的 `catch` 改为累加失败计数返回，让调用方区分恢复了几项/漏了几项。

---

## 五、R1 治理建议

### A. 必须走「统一上报 + 重试」（关键写入，当前静默=需修复，共 12 类）
1. **存储地基 `sSet`/`sRemove`**（`storageAdapter.js` L55-74）：引入统一写失败上报（toast + 错误事件总线）。非插件环境 `localStorage.setItem` 抛错（配额满/隐私模式）时反馈；插件环境应接 `chrome.storage.local.set` 的 callback 错误参而非裸 `try/catch`。
2. **画布快照**（`projectStore.js` L146-170）：用户核心资产，写入失败必须 toast + 允许重试（已有 `{success:false}` 返回值，调用方需据此弹反馈，而非仅 `console.warn`）。
3. **对话历史**（`conversationStore.js` L86-97）：丢失即丢全部记忆，写失败弹"本地存储已满/不可用"提示并提供导出兜底。
4. **任务记录后端**（`taskStore.js` L48）：改为"失败进内存重试队列 + toast"，至少标记"未保存"。
5. **项目列表 localStorage + 后端**（`projectStore.js` L54-61）：后端 `.catch` 改上报，localStorage 兜底失败提示。
6. **账号环境 / 素材库 / 自定义 Skill / 提示词预设**（`accountsStore.js` L99、`assetStore.js` L63、`skillStore.js` L126、`promptManager.js` L48）：用户资产，统一轻量 toast 上报。
7. **生成结果落盘（filesApi 4 处）**（`filesApi.js` L44-206）：生成产出丢失，落盘失败应 toast 提示（当前仅 `console.warn` + 返回 null，节点仍显示原始 URL 但生成面板/跨端看不到）。
8. **当前生效 endpoint KV**（`providerStore.js` L189）：随 #17 或独立重试。
9. **导入备份逐键覆盖**（`backupStore.js` L55-59）：改为上报失败键，让用户知道哪些没导入成功。

### B. 可保持静默（次要写入，丢失可重生成/默认兜底）
- `sRemove` 删除兜底（L69/L73）、画布快照删除 KV（L201-202）、任务删除/批量删/清空（L237/L348/L355）、Skill 使用次数（L180）、UI 偏好（L36）、节点上次参数（nodePrefs L70）、素材库 seed（L40）、最近使用预设（L48/L99 同函数静默）、AI 聊天模型偏好（agentModelStore L27）、`syncConfigBase` 双源回写（L179 已记非致命 error）、内联资源落盘（filesApi L56/L62 仅为优化、失败可保留 base64）。
- 这些失败要么有"重做即恢复"语义，要么不影响主数据，静默可接受。

### C. 已正确非静默、保持现状
- `providerStore.save` 后端（返回 `{ok:false,error}`）、`cloudSync.uploadConfig`（返回 error）、`resourcesApi.saveResource`（抛错由调用方处理）、`providerStore.syncConfigBase`（记 `configSyncError`）。
- 建议：把 #22 `restoreLocal`、#25/#26 `importAll` 的"部分静默 `catch`"改为累加失败计数返回，让调用方感知恢复完整性。

---

## 六、验收对照
1. ✅ 清单完整：36 条写入入口，每条带文件+行号+数据内容+关键性评级（覆盖全部探索起点 + 下游落库：projectsApi/tasksApi/settingsApi/resourcesApi/filesApi + nodePrefs/promptManager/agentModelStore）。
2. ✅ 区分关键/次要：关键 22 项（含地基与 4 处生成落盘），次要 14 项。
3. ✅ 每个关键写入标注当前是否静默：第四节汇总 12 类"关键且当前静默"，并单列已正确非静默项。
4. ✅ 亲自核实：所有行号来自本次实际打开文件（含二次审计补漏），非引用外部文档。
5. ✅ 无遗漏：经目录列举 `base/` + `base/settings/` 全量排查，补齐初版漏掉的 `nodePrefs/promptManager/agentModelStore/filesApi/resourcesApi` 共 9 条写入入口（#28-#36）。

> 探查说明：`providerStore.js` / `accountsStore.js` 位于 `src/components/base/settings/`（已 `search_file` 核实），行号以实际文件为准；初版误置于 `base/` 根，本次已校正。
