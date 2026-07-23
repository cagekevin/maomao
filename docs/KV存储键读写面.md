# KV 存储键读写面

### `app_settings`
| 属性 | 值 |
|------|----|
| 写 | `App.js` 防抖 useEffect（约 L40990 `Q.setObject(Z.APP_SETTINGS, e)`）；`syncAllToLocalTool`（L41913 `await Q.setObject(Z.APP_SETTINGS, e)`） |
| 读 | `App.js` 初始化 useEffect（L40552 `Q.getObject(Z.APP_SETTINGS).then(...)`） |
| GAS同步 | 是（在 `syncToCloud` 键集合 L41344 中） |
| 数据结构 | object：`{ globalPollingInterval, globalMaxPollingDuration, globalSyncTimeout, transitGridCols, defaultTextModel, defaultDrawingModel, defaultVideoModel, defaultSd2VideoModel, videoDurations, defaultAudioModel, textApiConfigId, imageApiConfigId, videoApiConfigId, sd2VideoApiConfigId, audioApiConfigId, sd2Token, useThumbnail, panPerformanceMode }` |

### `api_configs`
| 属性 | 值 |
|------|----|
| 写 | `App.js` 防抖 useEffect（L40964 `Q.setObject(Z.API_CONFIGS, e)`，e = 非 readonly 的配置）；`syncAllToLocalTool`（L41918） |
| 读 | `App.js` 初始化 useEffect（L40539 `Q.getObject(Z.API_CONFIGS).then(...)`，映射并合并 readonly 项） |
| GAS同步 | 是（在 `syncToCloud` 键集合 L41344 中） |
| 数据结构 | array，元素为 API 配置对象，典型字段：`{ id, name, baseUrl, apiKey, model, readonly, showKey, ... }` |

### `users`
| 属性 | 值 |
|------|----|
| 写 | 防抖 useEffect（L40962 `Q.setObject(Z.USERS, ze)`）；用户保存函数（L41178 `Q.setObject(Z.USERS, e)`）；`syncAllToLocalTool`（L41918） |
| 读 | 初始化 useEffect（L40474 `Q.getObject(Z.USERS).then(...)`，非空则 `Be(e)` 否则用默认 `Av`） |
| GAS同步 | 是（在 `syncToCloud` 键集合 L41344 中） |
| 数据结构 | array，元素字段见 L40438：`{ id, nickname, avatar, membershipType, balance, modelApiTokenKey, membershipExpiryDate, hasUnlimitedMembership, hasPassword }` |

### `membership`
| 属性 | 值 |
|------|----|
| 写 | 登录/刷新回调（L40468 `Q.setObject(Z.MEMBERSHIP, {type, expiry, code})`）；过期时 `Q.remove(Z.MEMBERSHIP)`（L40560） |
| 读 | 初始化 useEffect（L40554 `Q.getObject(Z.MEMBERSHIP).then(...)`，过期则降级为 FREE 并 remove） |
| GAS同步 | 是（在 `syncToCloud` 键集合 L41344 中） |
| 数据结构 | object：`{ type, expiry, code }`（type 如 `FREE`/`VIP`，expiry 为时间戳） |

### `old_membership`
| 属性 | 值 |
|------|----|
| 写 | 代码中未发现显式 `setObject(Z.OLD_MEMBERSHIP)`（疑似历史遗留键）；仅在迁移/备份相关列表中被引用 |
| 读 | 备份导出（L41947-41950 `Q.getObject('old_membership')` 并入 `kvStore`） |
| GAS同步 | 否（不在 `syncToCloud` 键集合 L41344 中；仅出现在 `syncAllToLocalTool` 迁移列表 L323 与备份导出列表 L41947） |
| 数据结构 | 推测同 `membership`：`{ type, expiry, code }`（历史遗留，当前无读写实例佐证） |

### `projects`
| 属性 | 值 |
|------|----|
| 写 | App.js:41726（创建 `bi`：`[...ur, e]`）、App.js:41735（删除 `xi`）、App.js:40962（防抖自动保存 `ur` 状态）、App.js:41918（syncAllToLocalTool 全量保存）、App.js:41991（importData 老格式兼容 `a[Z.PROJECTS]=t.projects`） |
| 读 | App.js:40510（`Q.getObject(Z.PROJECTS).then(...)` → `dr()` 启动加载） |
| GAS同步 | 是（syncToCloud 推送键集合含 `projects`，App.js:41344） |
| 数据结构 | `[{id, name}, ...]`；最小字段 `{id, name}`，`id` 形如 `proj-`+Date.now()（App.js:41722）。每个项目 id 对应 localforage 画布键 `canvas-state-v1-${id}` |

### `lastOpenedProject`
| 属性 | 值 |
|------|----|
| 写 | App.js:40876（`Q.setConfig(Z.LAST_OPENED_PROJECT, fr)`）—— 注意用 `setConfig` 存**字符串**，不是 `setObject` |
| 读 | App.js:40511（`Q.getConfig(Z.LAST_OPENED_PROJECT)`，恢复上次打开项目） |
| GAS同步 | 否（syncToCloud 键集合不含该键） |
| 数据结构 | 字符串（当前打开的项目 id） |

### `customNodeTemplates`
| 属性 | 值 |
|------|----|
| 写 | App.js:41741（保存 `Si`：`[...wn, e]`）、App.js:41746（删除 `Ci`）、App.js:40964（防抖自动保存 `wn`）、App.js:41918（syncAll）、App.js:41991（import 兼容 `a[Z.CUSTOM_NODE_TEMPLATES]=t.customNodeTemplates`） |
| 读 | App.js:40537（`Q.getObject(Z.CUSTOM_NODE_TEMPLATES).then(...)` → `Tn()` 启动加载） |
| GAS同步 | 是（syncToCloud 键集合含 `customNodeTemplates`，App.js:41344） |
| 数据结构 | `[{id, ...}, ...]`；元素至少含 `id`（创建时 `e.id ||= Date.now().toString()`，App.js:41739），实际为自定义节点模板对象（含 graphData 等节点定义） |

### `presetPrompts`
| 属性 | 值 |
|------|----|
| 写 | promptManager.js:32（`savePresets` → `Q.setObject(Z.PRESET_PROMPTS, presets)`）、App.js:40964（防抖保存 `jr`）、App.js:41918（syncAll）、App.js:41991（import 兼容 `a[Z.PRESET_PROMPTS]=t.presetPrompts`） |
| 读 | promptManager.js:20（`loadPresets` → `Q.getObject(Z.PRESET_PROMPTS)`）、App.js:40514（启动加载 → `Mr()`） |
| GAS同步 | 是（syncToCloud 键集合含 `presetPrompts`，App.js:41344） |
| 数据结构 | `[{id, title, type, prompt, enabled}, ...]`；`createPreset` 默认 `type='all'`、`enabled=true`（promptManager.js:36-44），旧数据缺 `id` 时由 `ensureIds` 补 |

### `modelSchedules`
| 属性 | 值 |
|------|----|
| 写 | modelSchedules.js:77（`da()` → `Q.setObject(ta, e)`，先写 window.localStorage 再落 KV）；由 `fa()`（upsert）、`pa()`（删除）、`ma()`（切换 enabled）、`Sa()`（pull 合并写回）调用。注：存储键用的是 constants.js 的 `ta='modelSchedules'`，与 `Z.MODEL_SCHEDULES` 同值 |
| 读 | modelSchedules.js:133（`xa()` 启动加载 → `Q.getObject(ta)`）；另 `la()`（modelSchedules.js:54）从 `window.localStorage` 现读，为 syncToCloud 推送源 |
| GAS同步 | 是（syncToCloud 分支 `t === 'modelSchedules' ? la()`，App.js:41344-41345；pull 合并用 `Sa` 按 id 去重写回） |
| 数据结构 | `[{id, name, category, enabled, steps, createdAt, updatedAt}, ...]`；其中 `category` ∈ `text`/`image`/`video`，`steps` 为 `[{model, retries}, ...]`（每调度最多 5 步、retry 合计 ≤10），结构由 `oa()` 归一化（modelSchedules.js:35-43） |

### `cloud_storage_config`
| 属性 | 值 |
|------|----|
| 写 | `Q.setObject(Z.CLOUD_STORAGE_CONFIG, o)` — `App.js:40964`（根状态防抖保存 effect，依赖 `o`=cloudStorageConfig）；`App.js:41918`（syncAllToLocalTool 全量落盘）。导入兼容时亦写：`App.js:41991`(`t.cloudStorageConfig`→`a[Z.CLOUD_STORAGE_CONFIG]`)。 |
| 读 | `Q.getObject(Z.CLOUD_STORAGE_CONFIG)` — `App.js:40550`（启动恢复注入 setCloudStorageConfig `s`）；合并对象分支 `e.cloudStorageConfig && s(e.cloudStorageConfig)` — `App.js:40738`。 |
| GAS同步 | 是（`syncToCloud` 键集合 `App.js:41344` 含 `cloud_storage_config`，随配置推送到 GAS）。 |
| 数据结构 | 对象（S3 兼容对象存储凭据）：`{accessKey, secretKey, bucket, endpoint, domain(自定义域名), region(派生), ...}`。`Kc()` 校验需 `accessKey`/`secretKey`/`bucket`/`endpoint`（`App.js:17123`）。 |

### `transitResources`
| 属性 | 值 |
|------|----|
| 写 | App.js 内**无直接 setObject 写入口**（无 `Q.setObject(Z.TRANSIT_RESOURCES)`）。由 `background.ts:99` 采集链路写入 `chrome.storage.local['transitResources']`（最多保留 5 条），再经 `storage/index.js:313` `syncToLocalTool` 同步进 localTool/localforage。App 内仅经 `addTransitResource`(gi) 更新 React state 并落 SQLite：`App.js:41587,41604`（调 `Sv`）。 |
| 读 | `Q.getObject(Z.TRANSIT_RESOURCES)` — `App.js:3458`、`App.js:6828`（资源面板加载）；`App.js:40479`（启动播种，合并 `Sr.default.getItem` 的 localforage 副本与 localTool 副本）。 |
| GAS同步 | 否（不在 `syncToCloud` 键集合）。注：`storage/index.js:323` 的 syncAllToLocalTool 读取列表包含它，但那只同步到 localTool，不进 GAS。 |
| 数据结构 | 数组 `[{id, url, type, timestamp, pageUrl, pageTitle, source, folder}, ...]`（`TransitResource`；`source` 取 `pasted`/`generated` 等，`folder` 取 `migrated`/`tasks` 等）。 |

### `transit_grid_cols`
| 属性 | 值 |
|------|----|
| 写 | 当前 App.js **无对 `transit_grid_cols` 键的写入口**（grep 不到 `setObject/setConfig(Z.TRANSIT_GRID_COLS)`）。该值实际经 `Z.APP_SETTINGS.transitGridCols` 持久化：写 `App.js:40984`、`App.js:41910`；读 `App.js:40553`(`e.transitGridCols`)。`transit_grid_cols` 为**遗留只读键**。 |
| 读 | `Q.getConfig(Z.TRANSIT_GRID_COLS)` — `App.js:40505`（若存在则 `parseInt` 覆盖 `setTransitGridCols`(`re`)）。 |
| GAS同步 | 否（不在 `syncToCloud` 键集合；仅 `syncAllToLocalTool` 读取列表含之）。 |
| 数据结构 | number（中转站网格列数，如 2/3/4）。 |

### `globalTasks`
| 属性 | 值 |
|------|----|
| 写 | App.js 内**无对 `globalTasks` KV 键的 setObject 写入口**（grep 不到 `Q.setObject(Z.GLOBAL_TASKS)`）。任务为内存 React state（`updateGlobalTasks`），启动后由 `App.js:40516` 读取并播种进 SQLite（`Y_` 函数，受 `Ov` 标记位保护）。`storage/index.js:323` 读取列表含之但无对应写。 |
| 读 | `Q.getObject(Z.GLOBAL_TASKS)` — `App.js:40516`（启动播种历史任务到 SQLite）。运行时任务状态变更走 `d.updateGlobalTasks?.(...)`（如 `App.js:13212,13222,13232,13322,13332`）。 |
| GAS同步 | 否（不在 `syncToCloud` 键集合）。 |
| 数据结构 | 数组 `[{taskId, nodeId, status(QUEUED/RUNNING/running/completed/failed), type(video/audio/text/image), errorMsg, errorMessage, loading, responseData, lastResultTaskId, preDeductAmount, ...}, ...]`。 |

### `canvas-state-v1-`
| 属性 | 值 |
|------|----|
| 写 | 经 `Q.saveCanvasStateWithVersion(projectId, state, version)`（`storage/index.js:364`），由画布自动保存 handler 调用：`App.js:29513`（`saveCanvasStateWithVersion(en.current, r, t)`）；另有 `Q.saveCanvasState`（`storage/index.js:356`）。删除：`Q.deleteCanvasState` / `Sr.default.removeItem('canvas-state-v1-'+id)` — `App.js:41735`、`storage/index.js:390`。键名由 `Cr(projectId)=`canvas-state-v1-${id}``（`storage/index.js:7`）生成。 |
| 读 | `Q.loadCanvasState(projectId)`（`storage/index.js:360`）/ `Q.getObject(Cr(projectId))`；启动迁移读 `App.js:41921-41924`（`Sr.default.getItem(Cr(e.id))`，回退 localStorage）；版本冲突回读 `App.js:29516-29517`。 |
| GAS同步 | 否（按 projectId 分键，未进 `syncToCloud` 列表；仅 `syncAllToLocalTool` 会将其同步进 localTool）。 |
| 数据结构 | 对象 `{nodes:[...画布节点...], edges:[...连线...]}`；另带隐式版本键 ``canvas-state-v1-<id>_version``（`storage/index.js:370`）。`setObject` 拒绝保存无 `nodes` 的空画布（`storage/index.js:243,245`）。 |

### `device_id`
| 属性 | 值 |
|------|----|
| 写 | App.js `Fg()`（getDeviceId）：缺失时 `Pg()` 生成并 `localStorage.setItem(Z.DEVICE_ID, e)`（L36173-36176） |
| 读 | App.js `Fg()`：`localStorage.getItem(Z.DEVICE_ID)`；主组件 `Nv`(App) 初始化时调用 `Fg()`（L40328） |
| GAS同步 | 否（不在 syncToCloud 键集合 `['app_settings','api_configs','users','membership','projects','presetPrompts','customNodeTemplates','modelSchedules','cloud_storage_config','local_templates']` 中） |
| 数据结构 | 字符串 UUID（如 `10000000-1000-4000-8000-100000000000`，由 `Pg()` 随机生成） |

### `current_user_id`
| 属性 | 值 |
|------|----|
| 写 | 无（`storageKeys.js` 仍定义 `Z.CURRENT_USER_ID`，但运行时已无任何写入；随会员/登录机制删除，见 docs/PROJECT_LOG/删除会员计划20260723.md） |
| 读 | 无（运行时无任何 `Z.CURRENT_USER_ID` 读取） |
| GAS同步 | 否（亦无写入/读取，且不在该键集合） |
| 数据结构 | 字符串（用户 id）；当前为已废弃的死键，未被使用 |

### `video_size`
| 属性 | 值 |
|------|----|
| 写 | App.js `Do`(VideoNode) 比例选择 `onClick`：`Q.setConfig(Z.VIDEO_SIZE, t.value)`（L7457） |
| 读 | App.js `Do`(VideoNode) `useEffect`：`Q.getConfig(Z.VIDEO_SIZE)`（L6793） |
| GAS同步 | 否（不在 syncToCloud 键集合） |
| 数据结构 | 字符串，宽高比取值：`16:9` / `9:16` / `1:1` / `4:3` / `custom`（来自 `Eo` 选项 L6720） |

### `video_seconds`
| 属性 | 值 |
|------|----|
| 写 | App.js `Do`(VideoNode) 时长选择 `onClick`：`Q.setConfig(Z.VIDEO_SECONDS, t)`（L7505） |
| 读 | App.js `Do`(VideoNode) `useEffect`：`Q.getConfig(Z.VIDEO_SECONDS)`（L6797） |
| GAS同步 | 否（不在 syncToCloud 键集合） |
| 数据结构 | 字符串数字（秒），如 `10`，来自 `l.videoDurations` 按行拆分选项 |

### `video_model`
| 属性 | 值 |
|------|----|
| 写 | App.js `Do`(VideoNode) 模型选择 `onClick`：`Q.setConfig(Z.VIDEO_MODEL, t)`（L7549） |
| 读 | App.js `Do`(VideoNode) `useEffect`：`Q.getConfig(Z.VIDEO_MODEL)`（L6801） |
| GAS同步 | 否（不在 syncToCloud 键集合） |
| 数据结构 | 字符串，模型 id（如内置 `wan2.1` 或第三方模型名），来自 `l.videoModel` 按行拆分选项 |

### `sync_version`
| 属性 | 值 |
|------|----|
| 写 | 无（仅在 `src/config/storageKeys.js` 定义 `Z.SYNC_VERSION = 'sync_version'`，全代码无写入） |
| 读 | 无 |
| GAS同步 | 否（`syncToCloud` 键集合不含此键，见 `src/App.js:41344`） |
| 数据结构 | 未使用（死键，仅常量定义，无任何读写入口） |

### `last_sync_time`
| 属性 | 值 |
|------|----|
| 写 | 无（仅在 `src/config/storageKeys.js` 定义 `Z.LAST_SYNC_TIME = 'last_sync_time'`，全代码无写入） |
| 读 | 无 |
| GAS同步 | 否（`syncToCloud` 键集合不含此键，见 `src/App.js:41344`） |
| 数据结构 | 未使用（死键，仅常量定义，无任何读写入口） |

### `auth_token`
| 属性 | 值 |
|------|----|
| 写 | `src/services/auth.js` `ka(e)` → `localStorage.setItem(Ca, e)` + `Q.setConfig(Ca, e)`；另 `src/App.js:41284` 登出时 `ka(``)` 清空、`Q.remove(Z.AUTH_TOKEN)` |
| 读 | `src/services/auth.js` `Oa()` → `localStorage.getItem(Ca) \|\| 'local-mode-token'`（`Ca = 'auth_token'`，见 `src/config/constants.js:17`） |
| GAS同步 | 否（不在 `syncToCloud` 同步键集合中，见 `src/App.js:41344`） |
| 数据结构 | 字符串（鉴权 token 凭据，明文存于 localStorage 与 KV 存储） |

