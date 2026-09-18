# 121 · Skill 系统合并 · 最终裁决文档（114 v4 × 116 合并 · 裁决心法 v1）

> **状态：裁决（已拍板基底，待实施）**
> **性质**：本文档不是第三份方案，而是**对 `114-skill本地文件双向编辑方案`(v3→v4) 与 `116-skill系统合并方案`(本地文件双向编辑 × 运行时消费) 的裁决性收敛**。116 是在 114 v3 地基上写的，而 114 其后被架构师复盘修订为 v4，v4 推翻了若干 116 仍在其上重建的地基。本文的任务就是**把两套仍互相矛盾的地基拉齐，并锁定唯一生效的版本**。
>
> **裁决总纲（一句话）**：**文件层以 114 v4 为准（它已清除"你最讨厌的护栏"），消费层以 116 为准（它补齐了运行时空白）；但 116 中所有仍依赖 v3 旧地基的条款，一律按 114 v4 重裁。**
>
> 外部参考仓库 `AI-Canvas-skill-reference` 已实测核对（见附录 A），其设计原则作为"抄什么"的依据，但**底座差异（IndexedDB vs localStorage、只读上传 vs 网页可编辑）必须明确改写**。

---

## 0. 裁决前提：为什么需要这份文档

| 输入 | 角色 | 现状 |
|---|---|---|
| 114 v3 | 文件层自有方案 | 已被架构师复盘推翻为 **v4**（§14 整章自我修正） |
| 114 v4 | 文件层修正版 | 删 `.maomao.json`、UUID 解耦 id、fail-loud 单真相源、skills facade、持久化 contentHash、清"缓存独有项保留"等 5 条护栏 |
| 116 | 文件层(v3 地基) + 消费层 | 消费层是真正的增量价值；但文件层多处仍写的是 v3 已被推翻的地基（`.maomao.json`、`id=路径兜底`、"落盘失败不回滚缓存"、"3 处小改不增端点"） |

**致命矛盾**：116 §0.5 自承"v3 文件层 0% 落地"，即 116 = 从零建 v3 + 消费层。但 114 v4 已经证明 **v3 的地基本身是错的**（护栏把不确定性封进系统）。若照 116 落地，等于把 v4 刚清掉的 5 条护栏又埋回去。

**裁决动作**：把 116 的文件层条款逐条对照 114 v4 重裁（见 §1 六处地基分歧表），消费层原样保留并 rebase 到 v4 地基（见 §4）。**债 6（两份并存架构）在此强制二选一**（§5）。

---

## 1. 六处地基分歧 · 逐条裁决

> 下表是本文档的唯一生效裁决。任何实施代码以本表"裁决"列为准，114 v4 / 116 中与之冲突的原文一律作废。

| # | 地基点 | 114 v4（已修正） | 116（仍写 v3 旧地基） | **裁决** | 理由（架构师视角） |
|---|---|---|---|---|---|
| D-1 | `.maomao.json` | **已删除**（§4.0.2/§2.3/§14.3⑥） | **仍保留**（§1/§3.1/§3.3/§7/§9 写 `{id,enabled,usage,syncedHash,source}`） | **跟 114 v4：彻底删除**。116 的元数据全部改落点 | 116 的 `.maomao.json` 与 114 §14.5 债 5 自我矛盾：文件内 id 与路径 id 分叉、enabled 上云它不上云。REF 也证明无此冗余文件（附录 A）。116 的 `id/enabled/usage/source/syncedHash` 改落：**id→`SKILL.md` frontmatter；enabled/usage→localStorage（原键不变）；source→`agent_skills` 索引；syncedHash→索引 `contentHash`** |
| D-2 | `id` 方案 | **稳定 UUID，与 `category/slug` 完全解耦**（§4.0.5）；改名换类不动 id | `id = .maomao.json` 里的 uuid，**缺失回落 `${category}/${slug}`**（§1/§3.3） | **跟 114 v4：UUID 写入 `SKILL.md` frontmatter，无任何路径兜底**。116 的"路径兜底"= 114 §14.5 债 1 原封不动重造 | "路径兜底"意味着改名即 id 变、旧键失效、绑定断裂——这正是 114 v4 最该消灭的。UUID 一经创建永不变；磁盘 `category/slug` 仅展示/布局。`skill_read_file` 的 id→路径反查走内存 `id→{category,slug}` 映射（hydrate 时从 frontmatter 建，见 §4.6/P-3A） |
| D-3 | 落盘语义（缓存 vs 磁盘） | **fail-loud 单真相源：先落盘成功，才回写缓存；落盘失败缓存不更新 + UI 报"未保存"**（§4.2，INV-2） | **"落盘失败不回滚缓存"，toast 区分"已落盘/仅缓存"**（§4.4/§4.5） | **跟 114 v4：杀掉"不回滚缓存"护栏**。保留 toast 文案区分，但**缓存必须在落盘成功后才写** | "落盘失败不回滚缓存"= 114 §14.6 点名的"你最讨厌的护栏"——把"没存上"伪装成"缓存里有就算成功"，制造灰色状态。猫猫落盘是同机 127.0.0.1 写，await 后 notify 延迟毫秒级，完全满足"保存后立刻能用"且真相诚实 |
| D-4 | 后端落地 | **新增独立 `skills` facade + 极薄路由**（`POST/GET/DELETE /api/skills/...`），与媒体 `fileStore` 抽象完全隔离（§14.4③） | **3 处极小改动（`UPLOAD_ROOT_ALLOW`+`writeUploadBufferAt`+保留多级），不新增端点**（§4.1，决策 11=A） | **跟 114 v4：做 facade**。116 的"3 处小改"降级为"工期极端受限时的过渡兜底"，不写入正式契约 | 在"单文件时间戳"抽象（`fileStore.ts`）上埋 skills 特例，会与防污染/防逃逸/回退 canvas 护栏隐性耦合（114 §14.4②）。REF 给 skill 独立 `catalogRepository`（附录 A）正是正确做法。奥卡姆剃刀的正确运用是"用正确抽象切开两领域"，不是"硬不增端点把特例塞进通用路径" |
| D-5 | 变更检测指纹 | **持久化 `contentHash` 进 `agent_skills` 索引项**，重启不依赖易失内存 Map（§4.0.6/§4.4） | **`.maomao.json` 的 `syncedHash` + 内存 Map**（§4.6） | **跟 114 v4：持久化 contentHash**。116 的 hash+version 双记录保留，但 hash 真相源改为索引项，version 取自 frontmatter | 内存 hash 重启即失（114 §14.5 债 7）；version 单独提示"v1→v2"是好的增量，保留 |
| D-6 | "缓存独有项保留" | **已删除**（§4.3 v4，INV-2：落盘失败则缓存不更新，未落盘项本就不该在缓存） | 防线 1"空目录直接 return，绝不 saveCustomSkills([])"（§4.5）——**此处与 v4 一致** | **一致，保留 116 防线 1**（它与 v4 不冲突：空目录=未决，不写空、不保留灰色缓存） | 116 的"空目录 return"即 v4 的"未决"语义，二者同源，无需裁 |

**裁决结论**：116 文件层条款中，凡触及 D-1/D-2/D-3/D-4/D-5 的（§1 差异表、§3.1 目录图、§3.3 元数据归属、§4.1 后端、§4.4 落盘、§4.6 检测、§9 迁移）一律**按上表重写**；116 §3.2（frontmatter 严格解析）、§3.4（references/scripts 边界）、§5/§6 消费层、§7 UI 改造、§8 云同步**原样保留并 rebase**。

---

## 2. 合并后的目标架构（唯一生效视图）

### 2.1 三层 + 两个契约

```
┌──────────────────────────────────────────────────────────────────────┐
│ ① 存储层（磁盘 · 真相源）                                              │
│   ~/.maomao-localtool/skills/<分类>/<slug>/                           │
│     ├── SKILL.md        ← frontmatter(id/name/description/when-to-use/│
│     │                      version/allowed-tools) + 正文 ＝ 内容真相   │
│     ├── references/**   ← 只读资料（Phase 4 经 skill_read_file 消费）  │
│     └── scripts/**      ← 落盘但永不可被模型读取                       │
│   （无 .maomao.json；元数据真相分两块：SKILL.md frontmatter = 内容侧，   │
│    localStorage = 运行态侧）                                           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ skills facade（新增，极薄路由 /api/skills/...）
                            │ POST/GET/DELETE + 整包原子写/删 + 返回 Promise
┌───────────────────────────▼──────────────────────────────────────────┐
│ ② 缓存/索引层（localStorage · 非第二真相源）                          │
│   agent_skills       = 索引（去 content，进云同步）                    │
│                      = [{id(UUID),category,slug,name,description,      │
│                         whenToUse?,version?,contentHash,aliases?,      │
│                         source?}]                                       │
│   agent_skill_cache  = { [id]: content }（SYNC_EXCLUDE，仅本机）       │
│   agent_skill_enabled / agent_skill_usage = 运行态（跨设备同步）        │
│   skillRepository 是这两个键的【唯一成对写入口】（见 §3.4 债 2 护栏）   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ RuntimeSkill[]（= builtin ∪ user）
┌───────────────────────────▼──────────────────────────────────────────┐
│ ③ 消费层（116 增量 · 手动选中专用）                                    │
│   skillManifest.ts  严格解析（只解析不执行，安全字段禁多行）            │
│   skillCatalog.ts   sanitizeSkillLabel / truncateSkillContent /        │
│                    assertSafeSkillRelativePath / 预算                   │
│   SkillBinding      发送时冻结（含 contentHash/version/origin）         │
│   SKILL_EXECUTION_RULES  追加"不可信"条款                              │
│   skill_read_file   Phase 4 按需读 reference（清单来自正文反引号引用）  │
└──────────────────────────────────────────────────────────────────────┘
```

**两个契约（全局唯一）**：
- **一个稳定 id（UUID）**：缓存在 frontmatter（内容侧）+ `agent_skills` 索引（索引侧），启用态/用量/冻结绑定全靠它；改名换类不丢。
- **一个包内相对路径命名空间**（`references/xxx.md`，无绝对/`..`）：读资料唯一入口，且**只有 SKILL.md 正文反引号显式写出**的才可读。

### 2.2 与 REF 的底座差异（必须改写，不可照抄）

| REF 前提 | 猫猫现实 | 改写 |
|---|---|---|
| IndexedDB 持久化、`UserSkill` 记录含 `content` 为真相 | localStorage + localTool 落盘；且**网页可编辑** | 磁盘 `SKILL.md` 为内容真相；每次编辑**必须回写磁盘**（REF 的 `updateSkillContent` 只改 DB 不回写磁盘文件，是 REF 自身隐患——猫猫因网页可编辑必须规避，见附录 A） |
| 上传即只读，不监听文件变化 | VS Code 直接改文件需收敛回网页 | 新增 `hydrate` + 变更检测（focus/手动）；这正是 REF 缺失、猫猫独有 |
| 无跨设备云同步 | 有 GAS 云同步 | 索引上云（去 content）+ 正文走 `agent_skill_cache`(SYNC_EXCLUDE)，换设备拷 `skills/` 目录 |

---

## 3. 文件层（rebase 到 114 v4 后的生效规格）

### 3.1 目录形态（采纳 116 §3.1，删 `.maomao.json`）

```
~/.maomao-localtool/skills/
├── 图片类/
│   └── 漫画生成/
│       ├── SKILL.md              ← frontmatter(声明) + 正文   ← 内容真相源
│       ├── references/           ← 本期落盘保全，Phase 4 按需读
│       │   ├── workflow.md
│       │   └── art-styles/manga.md
│       └── scripts/              ← 落盘但永不可被模型读取
├── 视频类/
└── _未分类/
```
**无 `.maomao.json`**。id 写入 `SKILL.md` frontmatter（见 §3.3）。

### 3.2 `SKILL.md` frontmatter（采纳 116 §3.2 严格解析，落点改 frontmatter）

字段表（116 §3.2 全部保留）：`name` / `description` / `when-to-use`(新增) / `version`(新增) / `allowed-tools`(解析不生效) / `user-invocable`/`disable-model-invocation`(解析不生效) / **`id`(UUID，由本方案写入，不在用户手填)** / 其他未知字段忽略原样保留。

解析规则（116 §3.2 5 条全部保留，含安全字段禁多行、标签脱敏 `sanitizeSkillLabel`、安全阀退化整文件当正文）。

`serializeSkillMarkdown`（114 §4.0.4）**扩展**：frontmatter 输出增加 `when-to-use` / `version` / `id` / `allowed-tools`（如存在），正文附后。往返幂等（§10 验收）。

### 3.3 元数据归属（裁决版 · 取代 116 §3.3）

| 数据 | 真相源 | 落点（取代 116 的 `.maomao.json` 列） |
|---|---|---|
| `content` / `name` / `description` / `when-to-use` / `version` | 本地文件 | `SKILL.md` frontmatter + 正文 |
| `id`（UUID） | 创建时生成，永不变 | `SKILL.md` frontmatter `id:`；同时在 `agent_skills` 索引登记 |
| `category` / `slug` | 本地文件（目录名） | 仅展示/布局；改名换类不动 id |
| `enabled` / `usage` | localStorage（跨设备同步） | `agent_skill_enabled` / `agent_skill_usage`（**键用 UUID，旧 `skill_*` 键作为 `aliases` 保留可解析，不改写**，见 §3.5） |
| `source`（sourceRepo/commit/importedAt） | localStorage（跨设备同步，无正文） | `agent_skills` 索引项 `source?` 字段 |
| `contentHash` | 本地文件指纹 | 持久化进 `agent_skills` 索引项（变更检测权威） |
| `references/**` | 本地文件 | 只可读，永不被网页保存覆盖 |

### 3.4 双键缓存（债 2 护栏 · 采纳 114 §14.5.1 补强）

- `agent_skills`（索引，去 content，进云同步）+ `agent_skill_cache`（正文，SYNC_EXCLUDE）的拆分**保留**（隐私收益：正文不再明文上云）。
- **强制护栏**：新增 `skillRepository.writeSkill(skill)` 为**唯一成对写入口**，原子写两键 + 写 `schemaVersion`；**禁止任何调用方单写一键**。消 114 §14.5 债 2 的"半截 skill"窗口。
- `getAllSkills()` / `findSkill(idOrAlias)`：读索引 → 按 id 从 `agent_skill_cache` 补 content → 返回完整 `RuntimeSkill`；`findSkill` 含 `aliases` 解析（旧 `skill_*` id 永久可解析）。

### 3.5 迁移（裁决版 · 取代 116 §9 / 114 §7）

前提（116 §0.5.3 实测）：114 从未落地，旧 id 只有 `skill_${now}` 一种。

1. 首次启动、`skills/` 为空且 localStorage 有旧 `agent_skills` → 逐条写 `_未分类/<slug>/SKILL.md`（含 frontmatter `id: <新UUID>`）；
2. **新 id = UUID；旧 `skill_*` id 登记进索引项 `aliases: string[]`，不改写、不删除旧 `agent_skill_enabled/usage` 键**（运行时按 alias 命中）。**这推翻 116 §9 的"按 name 匹配 + 改写旧键"**——改写键是身份断裂风险，aliases 方案从根消灭（114 §14.5 债 1 根除，无"启用态兜底"）；
3. `slug` 由 `name` 清洗，同分类重名加 `-2/-3`；
4. 迁移是写文件不是清 localStorage；失败不删旧数据。

### 3.6 后端 facade（裁决版 · 取代 116 §4.1）

- 新增 `localTool/src/routes/skills.ts` facade：`POST /api/skills/<category>/<slug>`（整包原子写，先写临时目录全成再 rename）、`GET /api/skills/<category>/<slug>`（返回整包文件树）、`DELETE /api/skills/<category>/<slug>`（整包 rename 进 `.trash/<id>/`，全有或全无）。
- facade 复用 `getUploadDir()`，自带稳定命名 + 层级保留 + 落盘返回 Promise + 整包原子删；与媒体 `fileStore` 零耦合。
- `filesApi.ts` 对应三个函数 `saveSkillFile/readSkillFile/listSkillPackages` 改调 facade。
- **过渡兜底**（仅工期极端受限）：114 §3.2 的 3 处特例（A 实现）可作降级路径，但**不写入正式契约、不在验收里作为目标态**。

### 3.7 删除（裁决版 · 取代 116 §4.3）

走 facade `DELETE` 整包原子删（114 §3.5 v4）；过渡期才允许逐文件 move 且必须：先 list 全清单 → 全在才搬 → 任一失败整体回滚（非 404 跳过）。

### 3.8 hydrate + 变更检测（裁决版）

- `hydrateSkillsFromFile`（114 §4.3 v4）：磁盘为真相；空目录=未决不写空；单包读失败跳过不写空；解析失败退化整文件当正文；**无"缓存独有项保留"**；hydrate 时建内存 `id→{category,slug}` 映射供 `skill_read_file` 反查。
- 变更检测（114 §4.4 v4 + 116 §4.6 的 hash+version 双记录）：权威基线=索引项持久化 `contentHash`；version 变→提示"v1→v2"，hash 变 version 未变→提示"文件已修改"；触发 Phase 1 仅 focus+手动按钮，Phase 3 加轮询/SSE。

---

## 4. 消费层（116 原样保留 · rebase 到 v4 地基）

以下条款经裁决**原样生效**，仅把"id"理解为 v4 的 UUID：

- **§3.4 references/scripts 边界**：`references/**` 仅反引号显式引用可读；`scripts/**` 永不读（扩展名白名单拒绝）。
- **§5.1 现状问题**：全文塞 system 无预算 → 分类+导入大包后必爆上下文（保留诊断）。
- **§5.2 二段式注入**：显式绑定展开（冻结快照）+ `skill_read_file` 按需读；**无摘要索引、无 `skill_search`**（手动选中专用，模型不自发现）。
- **§5.3 冻结快照 `SkillBinding`**：发送时冻结 `{skillId(UUID),name,version,contentHash,content,origin,category?,slug?}`；UI 显示"文件已更新·点此刷新"，不静默覆盖。
- **§5.4 不可信隔离**：`SKILL_EXECUTION_RULES` 追加不可信条款（116 原文照抄）。
- **§5.5 预算常量**：`SKILL_CONTENT_LIMITS` / `SKILL_CATALOG_LIMITS` 照抄（设置页可调），超限截断+中文提示。
- **§5.6 路径安全**：写侧 `safeFileName` + 读侧 `assertSafeSkillRelativePath` 叠加（读侧与 REF 逐字一致，附录 A）。
- **§6 `skill_read_file`**（Phase 4）：仅此一工具；`resourcePaths` 随绑定注入 system；授权基于"id 在 frontmatter + 路径在反引号清单"；内置 skill 无包目录→拒绝。
- **§6.3 资料清单显式引用**：从正文反引号（兼容 markdown 链接 `](references/x.md)` 与裸 `references/...`，见 116 P-3B）提取，经 `assertSafeSkillRelativePath` 校验。
- **§7 UI 改造**、**§8 云同步**、**§11 测试**、**§12 决策点**（除涉及 D-1~D-5 的已重裁）原样保留。

---

## 5. 债 6 的强制裁决：地基先行，还是功能先行

> 114 §14.5 债 6 是两份文档并存架构（§13 分层重构 vs §4 原地改）**唯一未裁决项**。本文强制二选一。

**裁决：先地基（分层 + 判别联合 + facade + UUID），再在其上落文件层与消费层。** 理由：
- 116 §0.5 已证实 v3 文件层 0% 落地——即"在神模块上原地改"的沉没成本为零，不存在"先跑通功能"的既得利益需要保护。
- 若先按 114 §4 落地（神模块膨胀），§13 的 P0 地基会永远"下一期再做"，导致 §13.4 的 6 条底层验收永久不达标（114 §14.6 末句警告的结局）。

**分期（地基嵌入顺序）**：

| 阶段 | 内容 | 对应原文档 | 地基依赖 |
|---|---|---|---|
| **P0 · 地基** | ① `skills` facade（§3.6）；② `skillRepository` 抽离（§3.4 双键唯一写入口）；③ 判别联合 `RuntimeSkill = UserSkill`（`skillTypes.ts`，`Skill` 标 `@deprecated` alias）；④ `newSkillId()` UUID + frontmatter 写 id（§3.3/§3.5）；⑤ `parseSkillMarkdown`/`serializeSkillMarkdown` 纯函数 + 单测 | 114 §13 P0 + §14.4③ + §4.0 | 无 |
| **P1 · 文件层** | hydrate（§3.8）+ 双键缓存 + 分类树 UI + 目录导入导出 + 云同步瘦身 + 迁移（§3.5）；消费层便宜部分：`skillManifest` 严格解析、`sanitizeSkillLabel`/`truncateSkillContent`/`assertSafeSkillRelativePath`、`SKILL_EXECUTION_RULES` 不可信条款、注入长度上限 | 114 §9 Phase 1 + 116 Phase 1 | 依赖 P0 |
| **P2 · 冻结 + 变更检测** | `SkillBinding` 发送时冻结 + chip"文件已更新"标记 + 替换 `AgentPanel` 静默 resync + 会话快照改用 `SkillBinding[]`（解决 116 P-F4/P-F5 根因坑）；hash+version 双记录检测 | 116 Phase 2 | 依赖 P0/P1 |
| **P3 · 预算配额** | `maxExplicitBindings` 落地（先单选 budget=1，多选 UI 补齐后升 4，见 §7 D1） | 116 D1 | 依赖 P2 |
| **P4 · `skill_read_file`** | 按需读 reference（id→路径映射走 P0 内存映射）；`resourcePaths` 注入；任务级预算 | 116 Phase 3 | 依赖 P0/P2 |

**验收门槛（合并 114 §13.4 + 116 §10）**：
1. 快照隔离：发送后改磁盘 SKILL.md，已发内容不变（P2）；
2. 判别联合：新增 `agent-package` 来源时 `RuntimeSkill` 主结构零改动（P0）；
3. 分层：`skillStore` 不再直读直写 localStorage/GAS，只经 `skillRepository`（P0）；
4. 真相源：落盘失败 → 缓存不更新 + UI"未保存"（D-3）；
5. 投影：注入 LLM 内容来自 `projectSkillForLlm`/`truncateSkillContent`，密钥/路径不进 prompt（P1）；
6. 预算：13001 字 skill 被截断+标红（P1）；
7. 路径：导入含 `..` 段恶意包 → 该段丢弃，磁盘无越权写（P0/P1）；
8. 跨设备：换设备拷 `skills/` 目录后 skill 可用；无目录时 UI 显式提示"本机无文件，请拷贝"，不静默空跑（P1/P-F2）。

---

## 6. 合并决策表（唯一生效 · 取代 114 §12 / 116 §13）

| # | 决策 | 定论 | 来源 |
|---|---|---|---|
| 1 | id 方案 | **稳定 UUID 写入 frontmatter，与路径解耦，无路径兜底** | 114 §4.0.5（推翻 116 §1/§3.3） |
| 2 | `.maomao.json` | **删除**；元数据改落 frontmatter + 索引 | 114 §14.3⑥（推翻 116 全文件层） |
| 3 | 落盘语义 | **先落盘后缓存，fail-loud；落盘失败缓存不更新** | 114 §4.2（推翻 116 §4.4） |
| 4 | 后端落地 | **skills facade + 极薄路由**；3 处特例仅过渡兜底 | 114 §14.4③（推翻 116 §4.1） |
| 5 | 变更指纹 | **持久化 contentHash 进索引**；hash+version 双记录 | 114 §4.4（改 116 §4.6） |
| 6 | 双键缓存 | 保留拆分 + `skillRepository` 唯一写入口 + `schemaVersion` | 114 §14.5.1 债 2 补强 |
| 7 | 迁移 | UUID + 旧 id 登记 `aliases`，**不改写旧键** | 114 §7 v4（改 116 §9） |
| 8 | references 本期 | 只落盘不读；Phase 4 经 `skill_read_file` | 114 §2.4 / 116 §2 |
| 9 | frontmatter 解析 | 零依赖手写 + 字段白名单 + 安全字段禁多行 + 标签脱敏 + `when-to-use`/`version` | 116 §3.2 |
| 10 | 注入形态 | 二段式：显式绑定冻结 + `skill_read_file`；无摘要索引/无 `skill_search` | 116 §5.2/§13 |
| 11 | 冻结时机 | **发送时**冻结 `SkillBinding` | 116 §5.3 决策 4 |
| 12 | 文件已改行为 | 显式"刷新"提示，不静默覆盖 | 116 §5.3 决策 5 |
| 13 | `allowed-tools` 等 | 解析不生效（已有 `agent_skill_enabled` 为唯一开关） | 116 §3.2 决策 6 |
| 14 | `scripts/` 可读 | 否（永不） | 116 §3.4 决策 8 |
| 15 | 资料可读范围 | 仅正文反引号显式引用路径 | 116 §6.3 决策 9 |
| 16 | 云同步 | `agent_skills` 去 content + `agent_skill_cache` SYNC_EXCLUDE | 114 §11.5 = 116 §8 |
| 17 | 备份含 `skills/` | 本期不做 | 一致 |
| 18 | 分期顺序 | **P0 地基 → P1 文件层 → P2 冻结 → P3 预算 → P4 工具** | 本文 §5（裁决债 6） |

---

## 7. 仍需用户拍板的开放决策（落地前定清）

| # | 问题 | 推荐 | 影响 |
|---|---|---|---|
| D1 | 多选 UI 是否本期补齐？ | P2 先单选（budget=1）；多选 chip + budget=4 放 P3 | 决定 P2/P3 预算常量与 AgentPanel chip 工作量 |
| D2 | `skill_read_file` 本期做？ | 114 已拍板"Reference 本期不做" → 留 P4 | 决定是否碰工具注册中心 |
| D3 | 预算初值（中文 1 字≈1 token） | 先照抄 12000/24000/4，设置页暴露可调；观察一轮后可能下调 8000/16000 | 上下文安全 |
| D4 | facade 工期若不可接受，是否启用 3 处特例过渡兜底？ | 仅工期极端受限时启用，不写入正式契约 | 回归风险面 |

> 除上述 D1~D4，114/116 其余决策点均已在上表拍板，**实施时不再回头确认**。

---

## 8. 技术债账本（强制 · 架构师交付物）

| 决策点 / 妥协点 | 归类 | 爆炸半径 | 增债理由（客观红线，非偷懒） | 偿还计划 |
|---|---|---|---|---|
| 删 `.maomao.json`，元数据分落 frontmatter + 索引 | **还债** | 消除 116 全文件层冗余真相源（5+ 处） | 无 | 已结清 |
| `id` 改 UUID 解耦路径 + aliases 迁移 | **还债** | 消除 114 债 1（身份断裂） | 无 | 已结清 |
| 落盘失败缓存不更新（杀护栏） | **还债** | 消除 114 债 3（灰色状态） | 无 | 已结清 |
| skills facade 替代 3 处特例 | **还债** | 消除 114 §14.4② 隐性耦合 | 无 | 已结清 |
| 持久化 contentHash（杀内存 Map） | **还债** | 消除 114 债 7 | 无 | 已结清 |
| 双键拆分（索引 + cache） | **增债** | 2 处·`skillRepository`+所有消费方·中息 | 隐私红线：正文不得明文上云（GAS 无鉴权无加密，现状已泄露） | **P0 落地 `skillRepository.writeSkill` 唯一成对写入口 + `schemaVersion`**（114 §14.5.1 债 2）；禁止单写一键 |
| references 引用断裂（网页保存只写 SKILL.md） | **增债** | 1 处·hydrate·低息（P4 才暴露） | 保结构完整性优先于引用校验（用户明确"本期只存不读"） | **P4 落地时静态扫正文反引号引用，缺失即 hydrate 报警**（114 §14.3③） |
| 导入无事务（逐文件上传） | **持平→还债** | facade 路径已原子；过渡兜底期才有 | — | facade 落地即原子；过渡期加"导入前先清同名旧包" |
| 分期 P0 地基先行（债 6 裁决） | **还债** | 消除 114 债 6 双架构并存 | 无 | 已结清（§5 强制排序） |
| 会话快照 vs 冻结根因坑（P-F5） | **增债（待还）** | 1 处·`AgentPanel` 会话快照·高息 | 现有 `activeSkills` 双向同步快照链路与冻结重叠，需 P2 同改 | **P2 设计即定清**：`SkillBinding[]` 为快照 `skills` 新结构，恢复时快照优先于 store，发送即定稿 |

> **红线声明**：凡标"增债"且无"偿还计划"的方案一律不合格。上表增债项均带明确触发动作（P0/P4/P2），可接受。

---

## 附录 A · 外部参考仓库实测核对（裁决依据）

仓库 `/Users/kevin/Downloads/AI-Canvas-skill-reference/`，结论以代码为准：

| 114/116 引用 REF 的断言 | 实测代码 | 裁决采纳？ |
|---|---|---|
| REF `id` 是稳定 UUID（`generateId()`），路径不参与身份 | `store/store.skills.ts:44` `id: generateId()`；`storagePath` 仅存储位置 | ✅ 采纳 → 114 v4 UUID 方案正确 |
| REF 无 `.maomao.json` 冗余文件 | `storageService.saveSkill` 写 `SkillRecord`(id/name/content/manifest/storagePath) 进 IndexedDB；磁盘仅 `storagePath` 源文件夹 | ✅ 采纳 → 删 `.maomao.json` |
| REF 冻结快照在任务创建时 | README §3 ⑤ `captureExplicitSkillBindings`；glue `conversationExecutionController.ts` | ✅ 采纳 → 116 改"发送时冻结"（单轮对话收窄，合理） |
| REF `assertSafeSkillRelativePath` 拒绝绝对/`..`/scheme/非文本扩展名 | `fs/skillFiles.ts:214-230` 逐字一致 | ✅ 采纳 → 116 §5.6 |
| REF 磁盘文件与库记录可能分叉（DB content 改、磁盘不回写） | `store.skills.ts:84-102` `updateSkillContent` 只 `set`+`fileService.saveSkill`(DB)，**不重写 `storagePath` 磁盘源文件** | ⚠️ **猫猫必须改写**：因网页可编辑，磁盘 `SKILL.md` 必须是可写真相源，每次编辑回写磁盘（规避 REF 此隐患） |
| REF 无"文件即真相源"层（上传后只读） | `store.skills.loadSkills` 只从 DB 读，不监听文件 | ⚠️ 猫猫独有需求：新增 hydrate + 变更检测 |
| REF 无跨设备云同步 | 全本地 IndexedDB | ⚠️ 猫猫独有：索引上云 + 正文 SYNC_EXCLUDE |

---

## 附录 B · 114 v4 / 116 被本文推翻的原文清单（作废标记）

- **114 v3（已被 114 v4 推翻，本文不再引用）**：原 §2.3 `.maomao.json` 双写、§4.0.2 schema、§4.0.5 `keyOf=category/slug`、§4.2"不回滚缓存"、§4.3"缓存独有项保留"、§3.2"3 处特例为目标"、§7"按 name 猜 + 启用态兜底"。
- **116 被本文重裁（D-1~D-5）**：§1 差异表 id 列 / `.maomao.json` 列、§3.1 目录图含 `.maomao.json`、§3.3 元数据归属（`.maomao.json` 列）、§4.1 后端"3 处小改不增端点"、§4.4 落盘"不回滚缓存"、§4.6 `.maomao.json` syncedHash、§9 迁移"按 name 改写旧键"。以上一律以本文 §1/§3 为准。
- **114 §13 与 §4 双架构并存（债 6）**：本文 §5 已强制裁决（地基先行），§13 的 D-1/D-3 进入 P0，不再与 §4 并存。
