# 猫猫 API 中转重建：可执行计划（地基优先）

> **原则**：先打地基、再盖楼。每阶段独立可验证，破坏性操作（删老链）放在最后且需确认。
> 配套文档：`00-猫猫项目架构总览.md`（全景）、`01-API中转架构-原仓库解剖与重建设计.md`（解剖+设计）。
> 最后更新：2026-09-02（注：实际执行日见 git）。

---

## 0. 总账：保留 / 迁移 / 删除 三张清单

### ✅ KEEP（地基，绝不删）
| 文件 | 角色 | 为什么留 |
|---|---|---|
| `localTool/src/db/database.ts` | SQLite 引擎 | 数据地基 |
| `localTool/src/paths.ts` | 运行路径真源 | 全局依赖 |
| `localTool/src/routes/files.ts` + `utils/fileStore.ts` | **文件落盘** | 你点名要保留；图/视频/音频结果落盘全靠它 |
| `localTool/src/utils/resolveLocalImages.ts` | **图生图参考内联** | 地基级能力：出站前把 `/files/` 图读盘压缩≤1920 内联 base64，等价于 `generation-json-image-data-urls` |
| `localTool/src/routes/{tasks,resources,projects,kv}.ts` | DB 支撑路由 | 任务/素材/项目/配置存储，新链复用 |
| `localTool/src/routes/{admin,official,platform,localPatch,logs,agentChat}.ts` | 其他 API | 非中转逻辑，保留 |
| `localTool/src/routes/passthrough.ts` | 官方兜底转发 | 保留 |
| `localTool/src/utils/{base64Externalize,helpers,logWriter,orphanGc,localPatchOps}.ts` | 工具 | 保留 |
| `localTool/src/utils/netProxy.ts` | 出站 fetch | **保留作 relay 底层 fetch 或与其并存**（见 Phase 1） |

### 📥 MOVE / ADOPT（把 PoC 搬进猫猫，成为新地基）
`download/ai-relay/src/*`（**已是 `.ts`**）→ `localTool/src/relay/*`（整包移入，纯新增）
- `catalog.ts` `baseUrl.ts` `connection.ts` `catalogFetch.ts` `transport.ts`（①②③④⑤）
- `protocol/`（13 文件，⑥ 声明式调用引擎）
- `generate/index.ts` `stream.ts`（各模态入口 + SSE）
- `manifests/`（xai/google/sora2u/runninghub 内置清单）
- `constants.ts` `index.ts`

> ⚠️ **TS 约定（重要）**：猫猫仓库是 TypeScript + `strict: true`，import 用 `.js` 扩展名对应 `.ts` 文件（bundler 解析）。
> `download/ai-relay` 的源文件**已从 `.js` 改名为 `.ts`**（`tsx` 跑测试 13/13 通过），但当前仅是「`.ts` 文件」，
> **尚未做 `strict` 类型标注**（参数/返回值多为隐式 `any`）。完整严格类型在 Phase 1 并入 `localTool/src/relay` 时补齐——
> localTool 的 `tsc --noEmit` 会强制，届时给每个导出函数补 `interface`/参数类型。
> **不要再写任何 `.js` 进仓库。**

### ❌ DELETE / REPLACE（老 API 中转，全删——但放最后阶段）
| 文件 | 处置 | 替代 |
|---|---|---|
| `localTool/src/routes/providers.ts` 的 `resolveProviderTarget`（apimart/openai/CLI 分支） | **删** | 被 `relay/catalog.js` 取代 |
| `localTool/src/routes/system.ts` 的 `handleProxy` 旧转发逻辑 | **改为薄壳** | 调 `relay/generate.ts` |
| 前端 `src/components/base/api/proxyGenerate.ts` 直连三个函数 | **改打 `/api/relay/*`** | 高层语义，不再拼 URL |
| `download/ai-relay/`（整目录） | 搬完后**归档或删除** | 已并入 `localTool/src/relay/` |
| `localTool/src/routes/protocolAdapters.ts` `requestModes.ts` | **待审查待删** | 疑似上次未落地 relay 尝试残骸，确认非依赖后删 |

> 注意：`routes/official.ts` `platform.ts` 也是 API 路由，但属账号/官方，**不是中转链，保留**。删的只是"老中转转发"那部分。

---

## 1. Phase 0 — 地基确认（不写代码，只核对）

- [ ] 确认 `db/database.ts`、`paths.ts`、`routes/files.ts`、`utils/resolveLocalImages.ts` 当前可正常运行（跑一次 `npm test` / 启动 localTool 看日志无错）。
- [ ] 这些是**不可动地基**：后续所有阶段都不改它们的对外行为，只新增调用方。
- ✅ 本阶段零风险，已完成即进入 Phase 1。

---

## 2. Phase 1 — 搬 relay 基地进 localTool（纯新增，不破坏老链）

**目标**：把 `download/ai-relay/src/*` 原样移入 `localTool/src/relay/`，老链继续跑、互不影响。

- [ ] 建目录 `localTool/src/relay/`。
- [ ] 移动文件（保持子结构，**已为 `.ts`，直接移**）：
  ```
  download/ai-relay/src/{catalog,baseUrl,connection,catalogFetch,transport,constants,index}.ts  → localTool/src/relay/
  download/ai-relay/src/protocol/   → localTool/src/relay/protocol/
  download/ai-relay/src/generate/   → localTool/src/relay/generate/
  download/ai-relay/src/stream.ts   → localTool/src/relay/stream.ts
  download/ai-relay/src/manifests/  → localTool/src/relay/manifests/
  ```
- [ ] 补 `strict` 类型（localTool 强制）：给每个导出函数/接口补参数与返回值类型，`import` 保持 `.js` 扩展名
  （对应 `.ts`，与 localTool 现有约定一致）。完成后 `cd localTool && npm run test`（首步 `tsc --noEmit`）必须零错。
- [ ] `relay/transport.js` 的 `corsSafeFetch` 复用 Node 原生 `fetch`；若想复用现有 `utils/netProxy.ts` 的代理/7897 逻辑，把 `netProxy.fetchWithProxy` 接成 transport 的底层（可选，Phase 1 可先直连原生 fetch）。
- [ ] `relay/index.js` 暴露 `createRelay` + `protocol` + `chat/streamChat/generateImage/generateVideo/generateAudio`（已有）。
- [ ] 验证：`node --test` 跑 `download/ai-relay/test/*`（13 个）确认引擎在 localTool 环境下仍通过。

**地基打法**：这一步只"把材料运进工地"，不拆老房子。完成后 `localTool/src/relay/` 是完整可用的中转引擎，但还没人调用它。

---

## 3. Phase 2 — 接 generate 入口 + 落盘闭环（盖第一层楼）

**目标**：让 relay 能真正生成，并把结果落盘（复用 Phase 0 地基）。

- [ ] 在 localTool 新增 `routes/relay.ts`，暴露：
  - `POST /api/relay/chat` `POST /api/relay/image` `POST /api/relay/video` `POST /api/relay/audio` → 调 `relay/generate.*`
  - `POST /api/relay/test` → 调 `relay/connection.testProviderConnection`（无副作用端点）
  - `GET  /api/relay/catalog` → 调 `relay/catalogFetch.fetchProviderModelCatalog`
- [ ] 请求体只收高层语义：`{ providerId, model, prompt, references?, variables?, signal? }`。**不收原始 URL/Header**（那是老链干的）。
- [ ] 图生图/图生视频：生成前对 `references` 调 `utils/resolveLocalImages.ts` 内联（地基已具备），再交给 `relay/generate`。
- [ ] 落盘闭环：generate 拿到结果 `url` 后，调 `routes/files.ts` 的 `saveResultToTasks`（复用 `filesApi` 同款落盘），写 `uploads/tasks`。**落盘逻辑零新建，全复用 Phase 0 地基**。
- [ ] 验证：起 mock 服务（复用 `download/ai-relay/test/relay.runtime.test.mjs` 思路）跑通 chat/image/video + 落盘回查。

---

## 4. Phase 3 — handleProxy 改薄壳（新旧并存过渡）

**目标**：新老链并行，前端可灰度切换，不一次性断。

- [ ] `routes/system.ts` 的 `handleProxy` 改为：识别请求里的 `catalogId`/`providerId`：
  - 命中新目录 → 转 `relay/generate.ts`（新链）。
  - 未命中（旧 apimart 直连等）→ 暂留旧 `resolveProviderTarget` 逻辑（过渡期）。
- [ ] 前端 `proxyGenerate.ts` 三个函数先加开关：默认仍可走旧 `/api/proxy`，但新增打 `/api/relay/*` 的分支，验证稳定后翻转默认。
- [ ] 验证：旧路径与新路径各自跑通，无回归。

---

## 5. Phase 4 — 拆老链（破坏性，需你确认后执行）

**目标**：老中转转发彻底退役。⚠️ 本阶段删除文件，执行前务必 `git commit` 当前进度。

- [ ] 删 `routes/providers.ts` 的 `resolveProviderTarget`（连同 apimart/openai/CLI 分支）；apimart 改为 `relay/catalog.js` 里的一个 `catalogAdapter:'openai-compatible'` 条目（保留 `apimart-gateway:9004` 作为其中一个 baseUrl）。
- [ ] `handleProxy` 旧分支删除，只留新链薄壳（或直接并入 `routes/relay.ts`）。
- [ ] 前端 `proxyGenerate.ts` 翻转默认到 `/api/relay/*`，删旧直连分支。
- [ ] `download/ai-relay/` 整目录删除（已并入 `localTool/src/relay/`）；或 `git mv` 归档到 `docs/archive/ai-relay-poc`。
- [ ] `routes/protocolAdapters.ts` `requestModes.ts`：确认非任何模块依赖后删除（上次未落地 relay 残骸）。
- [ ] 验证：全量 `npm test` + 启动 localTool + 前端跑一遍生图/生视频/图生图，确认无回归。

---

## 6. 阶段顺序回顾（地基 → 楼）

```
Phase 0  核对地基（DB/落盘/路径/图内联）        ← 不可动
Phase 1  搬 relay 基地进 localTool/src/relay/  ← 纯新增，老链照跑
Phase 2  接 /api/relay/* + 落盘闭环            ← 新链可用
Phase 3  handleProxy 薄壳，新旧并存            ← 灰度
Phase 4  删老链（需确认）                      ← 破坏性，最后做
```

**为什么这个顺序**：Phase 0/1 不动任何现存能力，万一新链有问题可随时回退；落盘（你点名要留）在 Phase 0 就锁定、Phase 2 直接复用，绝不被牵连；老链删放在最后，确保"楼盖好、验收过"才拆脚手架。

---

## 7. 你之前关心的三件事在计划里的落点

- **图生图 / 图生视频**：Phase 0 保留 `resolveLocalImages` 作地基；Phase 2 在 generate 前对 `references` 内联。
- **文件落盘**：Phase 0 保留 `routes/files.ts`；Phase 2 复用其 `saveResultToTasks`，零新建。
- **流式 / 异步轮询**：Phase 1 搬入的 `relay/stream.js` + `relay/protocol/poll.js` 已验证。

---

## 8. 开工检查单（Phase 0 → Phase 1 即可启动）

- [ ] `git add -A && git commit` 当前进度（任何破坏性操作前的硬底线）
- [ ] 执行 Phase 1：移动 `download/ai-relay/src` → `localTool/src/relay`
- [ ] 跑 `download/ai-relay/test/*` 确认引擎在 localTool 下仍过
- [ ] 回报结果，再决定 Phase 2
