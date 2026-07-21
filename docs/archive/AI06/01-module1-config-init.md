# AI06 · 模块1：系统初始化与配置层

> 审计日期：2026-07-21 ｜ 行号快照会漂移，动手前重 grep。
> 边界契约见 §5；交叉缝合见 `06-cross-flows.md`。

## 1. 运转图景
前端启动：`src/main.tsx` lazy 加载 `src/_engine/App.js` → 配置层 `config.js` 提供端点/开关 → `Oa()` 去登录拿本地 token → `Q`(StorageManager) 编排本地存储 → 建立 localTool 连接 → 恢复画布/localforage → 注册事件监听。

## 2. 核心混淆字典（已坐实）
| 混淆名 | 可读名 | 行号 | 作用 |
|--------|--------|------|------|
| `Oa` | getAuthToken | L3543 | 返回 `localStorage.auth_token \|\| 'local-mode-token'`，去登录核心，永远非空 |
| `ka` | setAuthToken | L3547 | 写 token + `Q.setConfig` |
| `Aa` | clearAuthToken | L3552 | 清 token（logout 局部 `Zr`@L43893 调用它） |
| `tr` | withApiSuffix | L846 | 规范成带 `/api` 基址 |
| `ar` | resolveApiUrl | L863 | 按 localhost/127 选最终 API 基址 |
| `Cr` | canvasStateKey | func-mapping L15 | `canvas-state-v1-{id}` 键构造 |
| `Nr` | localStorageBackend | func-mapping L152 @L1383 | 存储后端封装 |
| `Pr` | localforageBackend | func-mapping L153 @L1411 | 存储后端封装 |
| `jr` | cachedGet | func-mapping L157 @L1310 | 带缓存读取（底层 StorageManager.getConfig） |
| `Q` | StorageManager | var-mapping L20 @L1441 | 编排器：getConfig/setConfig/saveCanvasState... |
| `Z` | StorageKeys | var-mapping L21 @L1233 | 键枚举 |
| `Ca` | authTokenKey | var-mapping L102 | `'auth_token'` |

## 3. 关键数据流
- **去登录**：`Oa()`(L3543) 永远返回本地 token → 所有 `getCurrentToken()` 拦截放行（PROJECT_ORIGIN §4.5）。
- **配置加载**：`config.js` 导出 `USE_LOCAL_ENGINE=true` → `localEngineBase()` 返 18080；`DEFAULT_ENDPOINT=9004` 网关。
- **双服务 base URL**：`Hr`@L1732=`localEngineBase()`（**动态**，随 `USE_LOCAL_ENGINE` 切 18080/9004）vs `vv`@L42808=`LOCAL_ENGINE.base`（**写死** 18080，仅资源记录）vs `R`/`_`/`g`(局部, =9004 网关) 在生成回调内解析（模块3）。详见 `12-crossflow-contracts.md` 纠正。

## 4. 存疑 Bug / 雷
- **P0 残留**：`vv`@L42808 写死 18080（资源记录，合理）；`Hr`@L1732 动态解析，`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080 → false 模式文件功能配置死路（ARCHITECTURE X3.3，已纠正原"Hr/vv 双固定"假设，见 `12`）。
- `Ba`(hasAuthToken, L?)= `!!Oa()` 永远 true，登录态判断在本地模式无意义，但无副作用。

## 5. 边界契约
| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| config 开关 | `USE_LOCAL_ENGINE` | `config.js` L36 | true→18080，false→9004 |
| config 导出 | `LOCAL_ENGINE.base` | `config.js` L15 | `http://127.0.0.1:18080` |
| config 导出 | `DEFAULT_ENDPOINT` | `config.js` L30 | `http://127.0.0.1:9004` |
| HTTP 路由 | `/api/kv/get|set` | localTool `routes/kv.ts` | KV 读写 |
| 存储键 | `auth_token` | `Ca`=var-mapping L102 | localStorage |
| 存储键 | `canvas-state-v1-{id}` | `Cr`/L1283 | 画布状态 |

## 6. 校验门
所有行号由 `search_content` 在 App.js 实 grep 取得 ✅。逻辑一致性门4 复核无矛盾。
