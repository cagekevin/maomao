# 114 · Skill 本地文件双向编辑方案（完整计划 · 修订版 v3）

> 状态：**可执行规格（已拍板，待实施）**
> 可执行性说明：本版在 v3 决策全部保留的前提下，补齐了此前"被引用但未定义"的落地符号（`parseSkillMarkdown` / `serializeSkillMarkdown` / `safeFileName`，见 §4.0），并确立**底层设计对齐为首要目标（§13）**——抄的是参考项目 `AI-Canvas-skill-reference` 的**架构**，而非表面字段：判别联合 `RuntimeSkill`、任务级**不可变 `AgentSkillBinding` 快照**、四层分离（`types/` ↔ `services/` ↔ `store/` ↔ `indexedDb/`）、renderer-safe 投影、revision/etag 缓存失效、规范化迁移、显式预算信封、资源边界沙箱。此前补的 `version`/`allowedTools`/`contentHash`（§4.0）只是这些设计原则的**自然产物**，不是目的本身；字段可以不要，架构不能没有。（注：原 `.maomao.json` schema / `keyOf` 已在 v4 删除，见 §4.0.2 / §4.0.5 / §14.6。）
>
> 🔴 **v4 修订（2026-09-11，架构师复盘）**：经底层架构师视角复盘（§0.4 / §14），**推翻并修正了 v3 中若干"用兜底护栏掩盖错误"的设计**。核心变更：① **删除 `.maomao.json` 冗余真相源**（§2.3 / §4.0.2）；② **`id` 改为稳定 UUID，与磁盘路径解耦**（§4.0.5，不再 `category/slug` 当 id）；③ **推翻"同步缓存优先、落盘失败不回滚"→ fail-loud 单真相源：先落盘成功才回写缓存**（§4.2）；④ **删除 `hydrate` 的"缓存独有项保留"兜底**（§4.3）；⑤ **删除迁移的"按 name 猜 + 启用态兜底"，改 UUID + `aliases` 永久登记**（§7）；⑥ **后端落地从"3 处特例"升级为独立 `skills` facade**（§3.2 / §14.4③）；⑦ **变更检测改用持久化 `contentHash`，不再依赖易失内存 Map**（§4.4）。本修订贯彻一条原则：**错误要大声暴露（fail-loud），而不是用兜底护栏把不确定性封进系统内部**。下面 v3 原文仍保留，凡被 v4 推翻处均标 🔴 v4 修正。
> 关联：前序讨论 —— 猫猫 Agent skill 当前为"纯文本 `content` + 浏览器 localStorage"模型；用户希望在本地用 VS Code 等编辑器直接改 skill，且网页与本地文件能互相同步。
> 范围：**用户自定义 skill**（内置 `builtin` skill 仍保留为代码常量，不在本方案内）；文件格式**对齐标准 skill 包**（`<name>/SKILL.md` + `references/`）。
>
> **v3 修订（2026-09-10）**：用户三条明确指示 —— ① "不能只弄单文件，要对齐 skill 包"；② "**Reference 本期不做，本期只读 skill 文件**"；③ "**技能全是散落的，想做归类**（视频类/图片类）"。据此：
> - **推翻 v2 的"单文件 + 整文件即 content"**（§2），改为**一期就落地分类 / skill 包目录形态** —— 消除"导你现有 baoyu 包会丢 90% 内容"的结构错配。
> - **`references/` 只保留文件、不做读取**（§2.4，已拍板），懒加载归 Phase 3。
> - **新增分类方案**（§2.6）：`skills/<分类>/<slug>/`，**分类 = 目录名**，零配置、Finder 与网页双向一致。
> - 🔴 **修正 v2"零后端改动"的错误假设**：实测发现 `UPLOAD_ROOT_ALLOW` 白名单 + `writeUploadBuffer` 时间戳前缀**把三条通道全挡死**，必须改后端 3 处极小改动（§3.1/§3.2）。
>
> **v2 已确认且仍然成立的点**：
> 1. **落盘目录**：`getDataDir()/skills/`（即 `~/.maomao-localtool/skills/`）。**不放项目根**（运行期用户数据 ≠ 源码，勿混入 git 工作区）。
> 2. ~~**不新增端点**：仍成立（路由不动、`apiRegistry` 不动），但**要改 3 处落盘逻辑**（§3.2）。~~ 🔴 **v4 修正**：skill 是结构化独立领域，应新增独立 `skills` facade + 极薄路由（§3.2 / §14.4③）；媒体资产域仍守"不增端点"。原"3 处特例改动"降级为过渡兜底。
> 3. **前端即时可用**：保存必须**同步写 localStorage 缓存**（触发 `contentSubscribe` → UI 立刻可用），落盘是叠加的异步副作用（见 §4、§5）。
> 4. **不丢数据优先**：读失败/文件为空时**绝不覆盖**既有数据（见 §4.3 空目录防线）。

---

## 0. 背景与目标

### 0.1 痛点
- 当前 skill 只能在网页 `SkillSettings` 的文本框里编辑（`src/components/base/panels/sections/SkillSettings.tsx:475` 的 `content` textarea），窗口小、编辑不舒服。
- skill 数据存在**浏览器 localStorage**（`skillStore.ts:32` 的 `SKILLS_KEY='agent_skills'`），浏览器清缓存、换设备即丢失，且无法用真正的编辑器/版本管理（git）维护。

### 0.2 目标：双向编辑（Web ↔ 本地文件）
```
        ┌─────────────┐   POST /api/files/upload    ┌──────────────────┐   写磁盘   ┌────────────────────────────────┐
        │  网页 Skill  │ ──────────────────────────► │  localTool 后端   │ ─────────► │ ~/.maomao-localtool/skills/     │
        │  Settings UI │ ◄────────────────────────── │ (Node, 本机运行)  │ ◄───────── │   <分类>/<slug>/SKILL.md        │
        └─────────────┘   GET  /api/files/read      └──────────────────┘   读磁盘   │   <分类>/<slug>/references/**   │
                              （唯一文件入口，已有）                                    └────────────────────────────────┘
                                                                                            ↑ 用户在 VS Code 直接改
```
- **Web → 文件**：网页里增删改 skill、拖拽换分类，保存即写入本地磁盘（write-through，叠加在 localStorage 同步写之后）。
- **文件 → Web**：用户在 VS Code / Finder 里直接改 `SKILL.md`、增删 `references/**`、**拖拽改分类**，网页能感知并同步进来（`focus` / `visibilitychange` 触发检测 + 手动"重新加载"按钮）。
- **唯一真相源 = 本地文件**；localStorage 作**运行期同步缓存**（读接口仍同步返回，保 UI 即时性）。

### 0.3 非目标（本期不做）
- **不实现 `references/` 的按需懒加载**（`read_skill_reference` 工具）。本期**只落盘、不读取**（用户已拍板，见 §2.4）。
- 不改内置 `builtin` skill 的来源方式（`skillStore.ts:83` 的 `BUILTIN_SKILLS` 代码常量不动）。
- ~~**不新增 localTool 端点**（路由/契约不动），但**要改 3 处落盘逻辑**（§3.2）。~~ 🔴 **v4 修正**：skill 走独立 `skills` facade + 极薄路由（§3.2 / §14.4③）；媒体资产域仍守"不增端点"。
- **不做分类的嵌套层级**（只做"分类/skill"两级，见 §2.6）——避免无限层级带来的 UI 与路径复杂度。

### 0.4 为什么必须一期就对齐 skill 包（v3 核心动因）

你的真实 skill 包长这样（实测 `/Users/kevin/Documents/skills/baoyu/漫画生成-Comic`）：

```
漫画生成-Comic/
├── SKILL.md                    ← frontmatter(name/description/version/metadata) + 正文
├── references/                 ← 深层参考资料，SKILL.md 正文按需引用
│   ├── analysis-framework.md   workflow.md   partial-workflows.md
│   ├── art-styles/chalk.md  ink-brush.md  manga.md  realistic.md …
│   ├── layouts/four-panel.md  webtoon.md  cinematic.md …
│   ├── tones/…  presets/…  config/first-time-setup.md …
└── scripts/                    ← 可执行脚本
```

`SKILL.md` 正文本身很短（是**索引 + 方法论**），真正的知识量在 `references/` 下的几十个文件里。

**v2 的"每 skill 一个 `<id>.md`"方案 → 导你这个包会静默丢掉全部 `references/`（内容损失 >90%）**，且 `scripts/` 无处安放。这不是"未来增强"，是**当下就存在的数据结构错配**。故一期即按目录形态落盘。

> 补充：`/Users/kevin/Documents/skills/` 下还有 `skills-manager.db`、`分类目录`（工作效率类/工程类技能/…），说明你已有一套外部 skill 管理器。**本方案的目标是让猫猫能导入/导出这种目录**，不接管那套管理器（见 §2.5 互操作）。

---

## 1. 总体设计原则

1. **文件即真相源**：所有用户 skill 以 **分类 / skill 包目录**持久化在 `getDataDir()/skills/<分类>/<slug>/`（`SKILL.md` + `references/**`）；localStorage 作运行期缓存 / 离线降级。
2. **同步接口零破坏**：`skillStore` 现有同步 API（`getAllSkills / findSkill / upsertCustomSkill / deleteCustomSkill / getCustomSkills / readCustomSkills / saveCustomSkills`）调用方众多（`SkillSettings.tsx`、`AgentPanel.tsx`、`agentCore.ts`）。改动采用「**启动时 hydrate + 保存时 write-through + 缓存兜底**」，**对外签名保持不变**（`Skill` 类型只加可选字段）。
3. ~~**不新增端点，但落盘语义要精确化**：路由与 `apiRegistry` 不动（`router.ts:164-171`），但 `skills/` 域必须绕过 `UPLOAD_ROOT_ALLOW` 与时间戳前缀（§3.2 三处改动）。理由：localTool 仅 127.0.0.1 监听（`CLAUDE.md` §四.2），新增端点要付 router 注册 + `apiRegistry` 登记 + `check:api` 双向校验三笔成本 → **奥卡姆剃刀，不增实体**（`CLAUDE.md` §5.5）。~~ 🔴 **v4 修正**：skill 是结构化独立领域，正确做法是**新增独立 `skills` facade + 极薄路由**（§14.4③），而非在"单文件时间戳"抽象上埋特例。奥卡姆剃刀的正确运用是"用正确抽象切开两个领域"，不是"硬不增端点把特例塞进通用路径"。媒体资产域仍守此原则。
4. **不丢数据优先**：任何解析/同步失败都不得覆盖既有数据；宁可保留旧值 + 打 warn，不可静默清空（§4.3 三道防线）。
5. **对齐外部标准**：目录/文件形态**与外部 skill 包同构**（`SKILL.md` + `references/` + `scripts/`），可直接互拷，不搞私有格式。
6. **分类即目录（零配置）**：归类不引入配置文件/存储键，**目录名就是分类**（§2.6）——Finder 里拖拽与网页里拖拽等价，两条路径天然一致。
7. **离线可降级**：localTool 不可达时，回退纯 localStorage，网页功能不中断；恢复后下次保存再落盘。

---

## 2. 本地文件格式（v3：对齐标准 skill 包）

### 2.1 目录形态：**分类 / skill 包** 两级

```
~/.maomao-localtool/skills/           ← path.join(getDataDir(), 'skills')
├── 图片类/                            ← 分类目录（用户自定义，见 §2.6）
│   ├── 漫画生成/                       ← skill 包：目录名 = slug（可读，来自 name）
│   │   ├── SKILL.md                   ← frontmatter(含 id/name/description 等元数据) + 正文（= 原 content 的角色）
│   │   ├── references/                ← 参考资料（本期只保留文件，不做懒加载）
│   │   │   ├── workflow.md
│   │   │   └── art-styles/manga.md
│   │   └── scripts/                   ← 可选：可执行脚本
│   │   （🔴 v4：不写 `.maomao.json`；所有元数据真相只在 localStorage，见 §2.3 / §4.0.2）
│   └── 小红书图片/
│       └── SKILL.md
├── 视频类/
│   └── 视频创作/
│       └── SKILL.md
└── _未分类/                            ← 兜底：导入时未指定分类的落这里
    └── 电商详情页套图/
        └── SKILL.md
```

**与标准 skill 包的差异**：多一层"分类目录"；**skill 包本身**与 `Documents/skills/baoyu/*` **完全同构**，可直接互拷。🔴 v4：不再有 `.maomao.json`（§2.3 / §4.0.2 已删除）。

> `_未分类` 用下划线前缀（与 `.trash` 的点前缀区分）——既让 hydrate 能识别、又排在列表末尾。分类名总表见 §2.6，**分类本身不落盘为配置文件**（就是目录名，用户可直接在 Finder/VS Code 里改）。

### 2.2 `SKILL.md`：frontmatter + 正文

```markdown
---
name: 漫画生成
description: Knowledge comic creator supporting multiple art styles and tones...
---

# Knowledge Comic Creator

（正文……）
```

- **`content` 的映射规则（关键，保证"无损"）**：

| 方向 | 规则 |
|---|---|
| 读文件 → `content` | **只取 frontmatter 之后的正文**（`---` 到第二个 `---` 之间是元数据，丢弃） |
| 写文件 → 磁盘 | `<id> 的 name/description>` 序列化成 frontmatter + `content` 原文追加在后 |

**为什么这里用 frontmatter，而 v2 说"不用 frontmatter"？** 两者不矛盾——v2 反对的是"**把 frontmatter 当作唯一容器、且要自定义脆弱解析器**"（当时的场景是自建格式，解析器写错就丢内容）。v3 的场景不同：**frontmatter 是外部既有标准**（baoyu 包就这么写的），解析它不是为了自造格式，而是为了**互操作**。实现上优先复用成熟解析：

- 若允许加依赖 → `gray-matter`（业界标准，1 个轻依赖）。
- 若要零依赖 → 只支持**顶层 `key: value` 平铺**（`name` / `description` / `version`），嵌套的 `metadata:` 块**原样保留、不解析、写回时不动**。因为你现有的包只用到 `name/description` 两个字段（`metadata` 是 `openclaw` 私有命名空间，猫猫不消费）。
- **安全阀（必须实现）**：解析失败 / 无 frontmatter → **把整个文件当 `content`**，不报错、不丢内容（退化行为，见 §4.3 不丢数据原则）。

### 2.3 元数据归属（修正 v2 表格）

| 数据 | 真相源 | 位置 |
|---|---|---|
| `content`（正文） | **本地文件** | `<分类>/<slug>/SKILL.md` frontmatter 之后的正文 |
| `name` / `description` | **本地文件**（frontmatter） | 同上 |
| `category`（分类） | **本地文件**（目录名） | `<分类>/` ——**目录即分类**，改目录名 = 改分类 |
| `id` | **创建时生成的稳定 UUID**（见 §4.0.5，与路径解耦） | 仅在 `agent_skills` 索引登记；旧 id 作 `aliases` |
| `enabled` / `usage` / `createdAt` | localStorage（单一真相） | `agent_skill_enabled` / `agent_skill_usage` / `agent_skills` |
| `references/**` | **本地文件**（本期只存不读） | `<分类>/<slug>/references/**` |
| 磁盘路径（`category/slug`） | **仅展示与布局**，不参与身份 | `<分类>/<slug>/` 目录名；改名换目录不影响 `id` |

> `name/description` v2 放在 localStorage，v3 **移入 frontmatter**——因为外部 skill 包本来就把它们写在 frontmatter，导包时必须以文件为准，否则每次 hydrate 都要靠 localStorage 兜底名称，反而两头不靠。
>
> **🔴 v4 修正（2026-09-11）：删除 `.maomao.json` 冗余真相源**。原 §2.3 / §4.0.2 设计"`.maomao.json` 双写 localStorage 运行时状态"，经 §14.3⑥ / §14.5 债 5 论证为**自我矛盾的冗余真相源**（文件内 id vs 路径 id 分叉、enabled 上云它不上云）。现改为：**磁盘只承载内容（`SKILL.md` + `references/`），所有元数据真相只在 localStorage（`agent_skills` 索引 + `agent_skill_enabled`/`agent_skill_usage`）**。整目录拷走时元数据随云同步 `agent_skills` 索引带走（见 §11.5 ②）；纯本机无云场景靠"拷 `skills/` 目录 + 导出索引"兜底。
>
> **🔴 v4 修正：`id` 不再等于 `category/slug`**。原方案用 `category/slug` 当 id（§4.0.5 `keyOf`），但 Finder 拖拽归类（§2.6 主推交互）改一次目录就导致 id 变更、旧键失效、`.maomao.json` 过期（§14.5 债 1）。现改为：**`id` 是创建时生成的稳定 UUID，与磁盘路径完全解耦**；`category/slug` 只是展示层与磁盘布局，改名换分类只改目录、不动 id，旧 `enabled`/`usage`/`skillBindings` 天然跟着 id 走，无需"按 name 猜"迁移。

### 2.4 `references/` 本期怎么用（**已定：只保留文件，不读**）

> 用户已明确：**"Reference 本期是不做的，本期只读 skill 文件。"**（2026-09-10）

| 做法 | 本期 | 说明 |
|---|---|---|
| **结构对齐 + 导入导出完整保留** | ✅ **做** | 目录形态、`references/` 文件完整落盘与读回，**一个字不丢** |
| `references/` 内容注入 LLM / 工具动态读取 | ❌ **不做** | 归 Phase 3（`read_skill_reference`），见 §9 |

**本期策略**：`references/` 全部落盘、完整保留、可编辑可版本管理；**注入 LLM 的只有 `SKILL.md` 正文**，与现状（`agentCore.ts:334` 的 `content` 原文注入）完全一致。

**为什么"只存不读"仍必须一期做目录形态**：不是为了读，而是为了**不丢**。导你现有的 `漫画生成-Comic`（`references/` 下几十个文件），单文件方案会静默丢掉 >90% 内容。**结构完整性是数据保全问题，读取能力是能力问题**——两者解耦，前者一期做、后者三期做。

**Phase 3 的落点**：`read_skill_reference` 工具（需定工具 schema + 路径白名单 + 错误降级）。届时正文里的 `references/xxx.md` 引用才真正能被模型读取。

### 2.5 与外部 skill 管理器互操作

你 `~/Documents/skills/` 下已有 `skills-manager.db` + 分类目录（`工作效率类`/`工程类技能`/`开发中技能`…）。本方案**不接管它**，只做两件事：

1. **导入**：把外部 skill 目录（`漫画生成-Comic/`）整个读入 → 在 `~/.maomao-localtool/skills/<分类>/<slug>/` 落一份。
2. **导出**：把猫猫的 `<分类>/<slug>/` 目录原样拷出，可直接放进外部管理器的分类目录。

> **导入实现（已定）**：前端用 `<input type="file" webkitdirectory>` 选中目录（浏览器原生支持，拿到全部 `File` 列表，含 `webkitRelativePath`），再逐个 `upload` 到 `skills/<分类>/<slug>/...`。**本期不加"整目录导入"后端端点**（不增端点原则，§3.2 的 3 处改动仍必需，因为写入通道本身要修）；几十个文件对本机 127.0.0.1 是毫秒级，可接受。
>
> ⚠️ **安全**：`webkitRelativePath` 可能含 `..`（恶意包）→ 落盘前**丢弃任何含 `..` 的段**（§8）。

### 2.6 分类（归类）方案

**你的诉求**：现在 skill 散落，想归类成"视频类 / 图片类"这样。

**方案：分类 = 目录名（零配置、文件即真相源）**

```
skills/
├── 图片类/       ← 分类
├── 视频类/
├── 文档类/
└── _未分类/      ← 兜底
```

**为什么用目录名而不是配置文件**：
- 你在 Finder / VS Code 里**拖拽目录 = 改分类**，无需在网页里操作，也无需同步任何 `categories.json`。
- 与外部 skill 管理器（`工作效率类`/`工程类技能`…）的组织方式**天然一致**，互拷即归类。
- 零新增存储键、零新增端点、零迁移。

**默认分类（可改，用户可自由新增/改名）**：`图片类` / `视频类` / `文档类` / `自动化` / `_未分类`。

**分类与 localTool 白名单的配合（重要）**：
- 白名单（`UPLOAD_ROOT_ALLOW`）只加顶层根 `'skills'`，**分类是第二层，不需要逐个登记**——这与 `fileStore.ts:35-37` 注释说明的"白名单针对顶层根，动态分类目录放行"的设计**完全吻合**（`migrated/人物`、`migrated/脚本/尾帧变体` 就是同类用法）。
- 即：**不要为每个分类开一个新顶层根**（那要改白名单、且每次加分类都要动代码）。

**UI 呈现**（`SkillSettings.tsx` 左栏，见 §6）：
- 侧栏由现在的「个人 / 官方」两段，扩展为 **「分类树 + 官方」**：分类可折叠、可拖动 skill 换分类（拖拽走 `moveFile` 逐个文件搬，语义同 §3.5 删除）。
- 搜索跨分类（现有 `debouncedKeyword` 逻辑保留）。
- 新建 skill 时可选分类（下拉 + 可输入新分类名）。
- **未分类 skill 自动落 `_未分类/`**；若用户从不建分类，行为与现在单层列表无异（分类树退化为一层）。

**`category` 在 `Skill` 结构里的字段**（可选，零破坏）：
```ts
export interface Skill {
  // …原字段
  category?: string;   // 分类目录名；缺省 '_未分类'
  slug?: string;       // 包目录名
  references?: string[];
  // —— 收购对齐增强（可选零破坏，见 §4.0.2 / §13）——
  version?: string;          // 语义化版本；任务快照据此锁定
  allowedTools?: string[];   // 该 skill 启用时放开的工具白名单
  contentHash?: string;      // SKILL.md 正文 sha256 前 12 位
}
```

---

## 3. localTool 改造（实测结论：**必须改，且改动很小**）

### 3.1 实测结果：三条通道全部被"根白名单"挡死 🔴

我在写代码前把三条路都验证了一遍，**结论是 v2/v3 早先"零后端改动"的假设不成立**（但**不是"全部通道都死"**——读通道的 `GET /api/files/read?path=` 绝对路径分支本就可用，见 §3.3 ③ 处说明；真正被挡死的是**写通道的落盘形态**与**多级路径保留**）：

**① 写：`POST /api/files/upload` → `skills` 是未登记顶层根，静默错位（不报错）**

```39:39:localTool/src/utils/fileStore.ts
const UPLOAD_ROOT_ALLOW = new Set(['tasks', 'web', 'canvas', 'migrated', 'director3d']);
```
```70:70:localTool/src/utils/fileStore.ts
  const safeSub = normalizeSubfolder(subfolder) ?? 'canvas'; // 非法子目录回退默认根，杜绝越根写
```

`normalizeSubfolder('skills')` 返回 `null`（`skills` 不在白名单）→ `resolveUploadTarget` **静默回退到 `canvas`**。也就是说 `subfolder='skills'` 不会报错，而是**把 skill 文件默默写进 `uploads/canvas/`**——静默错位，比报错更糟。

**② 命门：`writeUploadBuffer` 强行加时间戳前缀**

```113:122:localTool/src/utils/fileStore.ts
export function writeUploadBuffer(
  subfolder: string,
  filename: string,
  data: Buffer,
): { savedPath: string; urlPath: string } {
  const { dir, savedPath, urlPath } = resolveUploadTarget(subfolder, `${Date.now()}-${filename}`);
  ensureDir(dir);
  fs.writeFileSync(savedPath, data);
  return { savedPath, urlPath };
}
```

> ⚠️ **已核实修正**：`fileStore.ts` 里**已经存在** `writeUploadBufferAt(subfolder, stableName, data)`（`:125-134`），它走的是**同一套 `resolveUploadTarget`（不加时间戳）**——也就是说"精确文件名落盘"能力后端**早已具备**，只是前端上传路径（`handleUploadFormData` → `saveFile` → `writeUploadBuffer`）**没有接线到它**。因此 §3.2 改动 2 不是"新增函数"，而是"在 `saveFile`/`handleUploadFormData` 里按 `skills/` 前缀改走 `writeUploadBufferAt`"。

`handleUploadFormData` 的 `file` 分支（`files.ts:120`）走的正是这个函数 → 落盘名恒为 `<时间戳>-SKILL.md`。**每次保存都生成新文件，`<slug>/SKILL.md` 永远不存在**——双向编辑的根基（按 `<slug>/SKILL.md` 定位）直接不成立。

**③ 读：`GET /api/files/read` 的多级 basename 分支被拍平**（注意：该接口的**另一分支**——`read?path=<绝对路径>`——走 `resolveUploadFile` 不做 basename 拍平，**本就可用**，见 §3.3；被挡死的是"传 `subfolder`+`filename` 的相对读"分支）

```69:74:localTool/src/utils/fileStore.ts
): { dir: string; savedPath: string; urlPath: string } {
  const safeSub = normalizeSubfolder(subfolder) ?? 'canvas'; // 非法子目录回退默认根，杜绝越根写
  const dir = path.join(getUploadDir(), safeSub);
  const savedPath = path.join(dir, sanitizeFilename(filename));
```

`handleRead` 走 `resolveUploadTarget` 同一条包夹：多级路径会被拍成 basename 落到 `canvas/`。**`skills/漫画生成/references/workflow.md` 读不到。**

**④ 路径分隔符也过不去**：`normalizeSubfolder` 只放行白名单根（多级子目录可以，因为 `parts[0]` 是合法根），而 `sanitizeFilename` 会把 `/` 全部替换成 `_`（`fileStore.ts:28` 的 `[<>:"/\\|?*]`）→ `references/workflow.md` 变成 `references_workflow.md`，**目录结构被拍平**。

**⑤ 分类目录会踩的坑（与你的分类需求冲突）**：`migrated/人物`、`migrated/脚本/尾帧变体` 这类**动态分类目录**在 `applyResourceIdentityChange` 里有明确注释说明"不能做成精确值全量禁止"（`fileStore.ts:35-37`）。所以白名单是**按顶层根**设计的，分类只能做某一层的子目录——这正是为什么"分类"应该建在 `skills/<分类>/<skill>/`（分类在第二层）而不是"给每个分类开一个新顶层根"。

### 3.2 结论：改 3 处（都是极小改动）

| # | 文件 | 改什么 | 为什么必须改 |
|---|---|---|---|
| 1 | `localTool/src/utils/fileStore.ts:39` | `UPLOAD_ROOT_ALLOW` 增加 `'skills'` | 否则写/读被静默回退到 `canvas` |
| 2 | `localTool/src/routes/files.ts`（`handleUploadFormData` → `saveFile`，约 `:194`） | 当 `subfolder` 以 `skills/` 开头（或 `=== 'skills'`）时，**改走已存在的 `writeUploadBufferAt`**（不加时间戳）而非 `writeUploadBuffer`（带时间戳） | 否则 `SKILL.md` 永远带时间戳前缀，按名定位不成立。`writeUploadBufferAt` 已在 `fileStore.ts:125` 存在，此处只是接线，非新增函数 |
| 3 | `localTool/src/utils/fileStore.ts`（`resolveUploadTarget`） | 让 `skills/` 根**保留多级路径**（`savedPath` 用 `resolveUploadFile` 那套 `path.resolve` + 防逃逸，而非 `sanitizeFilename` 拍平） | 否则 `references/a/b.md` 结构被拍平 |

> **改动 2 的两种实现**（择一，见 §12 决策点）：
> - **A（推荐，最小）**：`handleUploadFormData` → `saveFile`（`:194`）里判断 `subfolder.startsWith('skills/') || subfolder === 'skills'`，命中则 `writeUploadBufferAt(subfolder, saveName, data)`（函数已存在）。**只影响 skills 域，零回归风险。**
> - **B（更通用）**：`handleUpload` 增加 `?exact=1` 查询参数表示"按精确文件名落盘"，任何域都能选。改动面更大，但语义更干净。

**路由无需改（过渡期）**：`POST /api/files/upload` 已在 `router.ts:164` 注册，只是"怎么落盘"变了，不新增端点、不动 `apiRegistry`。

> 🔴 **v4 升级（2026-09-11，见 §14.4③）**：上述 3 处特例改动**仅作为"工期极端受限时的过渡兜底"**。正式目标形态是 **localTool 内新增独立 `skills` facade + 极薄路由**（`POST/GET/DELETE /api/skills/...`），它复用 `getUploadDir()` 但自带"稳定命名 + 层级保留 + 落盘返回 Promise + 整包原子删"语义，与媒体 `fileStore` 抽象完全隔离。理由：在"单文件时间戳"抽象上埋 `skills/` 特例，会与 `fileStore` 的防污染/防逃逸/回退 `canvas` 护栏产生隐性耦合（§14.4②）。**§9 Phase 0 改写为"优先做 facade，特例方案为降级路径"。**

### 3.3 各端点改造后可用性（实测）

| 需求 | 端点 | 结论 |
|---|---|---|
| 写任意文件（含多级） | `POST /api/files/upload` | ⚠️ 改 1+2 后可用 |
| 读任意文件 | `GET /api/files/read?path=` | ✅ **可直接用**（`handleRead` 收的是绝对路径，不走 `resolveUploadTarget`）——**注意**：这是 `files.ts:331` 的 `path` 参数路径，与上面 ③ 是两条不同分支 |
| 列目录（hydrate 必需） | `GET /api/files/list?subfolder=` | ⚠️ **不递归**（见下），需逐层调用 |
| 建目录 | `POST /api/files/mkdir` | ⚠️ 需 `folder` 以白名单根开头 → 改 1 后可用（`handleMkdir` 用 `path.join(uploadDir, folder)` + `ensureDir`，**无包夹**，天然支持多级） |
| 移动（删除走 `trash/`） | `POST /api/files/move` | ⚠️ `applyResourceIdentityChange` 面向**文件**（`renameSync`），**不支持目录** → 见 §3.5 |
| 打开所在目录 | `GET /api/files/open?subfolder=` | ⚠️ 走 `normalizeSubfolder` → 改 1 后可用 |

**`handleList` 不递归**（实测 `files.ts:588` 只 `readdirSync` 一层，返回 `{files, folders}`）→ hydrate 需**先 list `skills/` 拿一级子目录（即分类），再逐分类 list 其下 skill 包**：
- **分类来源 = 扫描 `skills/` 下的一级子目录**，排除 `.` 前缀的系统目录（`.trash`/`.thumbnails`（注意：`_未分类` 是**合法兜底分类**，带 `_` 前缀但必须加载，不在此排除列）。这与 §2.6「分类即目录名、用户可自由新增/改名」一致——**分类是动态扫描、不是硬编码枚举**（原稿"分类是有限枚举"措辞有误，已纠正）。
- 每个分类目录内再 list 一级得到 skill 包（`SKILL.md` 存在的才算），`references/` 子目录单独 list 以构造 `references` 清单。

### 3.4 前端新增能力（`src/components/base/api/filesApi.ts`，文件域单点）

```ts
/** 写 skill 包内任意文件：relPath 如 `漫画生成/references/workflow.md` */
export async function saveSkillFile(relPath: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const r = await saveTextFile(`skills/${relPath}`, content);  // 复用既有 saveTextToTasks 同款 multipart 手法
  return r;
}

/** 读 skill 包内任意文件（含 SKILL.md 与 references/*） */
export async function readSkillFile(relPath: string): Promise<string | null> {
  // ⚠️ 关键：必须走「绝对路径分支」GET /api/files/read?path=<uploadDir>/skills/<relPath>，
  //    不能走「subfolder+filename 相对分支」——后者经 resolveUploadTarget 会被 basename 拍平（§3.1 ③），
  //    多级路径读不到。uploadDir 由前端通过已有接口（如 GET /api/files/base 或配置注入）取得；
  //    若前端拿不到 uploadDir，则在 filesApi.ts 新增一个「skills 专用读」把 relPath 拼成绝对路径再调 read?path=。
}

/**
 * 列出 skills/ 下的分类与 skill 包。
 * 【实测】/api/files/list 不递归 → 按已知分类逐层 list（分类是有限枚举，见 §2.6）。
 * 返回 [{ category, slug, files:['SKILL.md','references/a.md',…] }]
 */
export async function listSkillPackages(): Promise<Array<{ category: string; slug: string; files: string[] }>> { /* … */ }
```

**技术先例**：`filesApi.ts:380` 的 `saveTextToTasks` 已用同一手法（multipart + `subfolder` + `filename`），本方案照抄（差别仅在落盘是否加时间戳，见 §3.1 改动 2）。

**编码注意**：`handleRead` 对 `.md` 无 `mimeMap` 命中 → 回落 `application/octet-stream`（`files.ts:352`），返回**原始文本流**。前端用 `parseJson:false` 取 `res.text()` 即可，**不需要后端改 mime**。

### 3.5 删除 skill（🔴 v4：走 facade 整包原子删除，不再逐文件 + 404 兜底）

> **v4 修正（2026-09-11）**：原"逐个文件 move 到 `.trash` + 404 跳过兜底"被 §14.5 债 8 判定为**无事务的兜底护栏**——传到一半/删到一半失败就留半截包，且"404 跳过"把"磁盘无文件"伪装成"删除成功"。现改为 **§14.4③ 的 `skills` facade 整包原子删除**：`DELETE /api/skills/<category>/<slug>` 后端一次性 `rename` 整个目录到 `.trash/<id>/`，全有或全无；失败即报错，不"跳过兜底"。

`handleMove` → `applyResourceIdentityChange`（`resources.ts:453`）面向**文件**，**不支持目录**——这正说明通用 `move` 端点不该承载 skill 删除。skill 删除走独立 facade（§14.4③），与媒体 `handleMove` 完全隔离。

- **原子性**：后端 `fs.renameSync(dir, trashDir/<id>)` 一条系统调用搬整个目录；`.trash` 前缀 `.` 让 hydrate 跳过（§4.3 跳过规则）。
- **失败 fail-loud**：rename 抛错 → 接口返回非 0 → 前端 toast "删除失败，请重试"，**不**假装成功、不 404 跳过。
- **顺带消除 §14.5 债 8 的导入半截包问题**：导入同样走 facade 整包原子写（先写临时目录，全成再 rename），失败整体回滚。

> 若 Phase 0 暂未落地 facade（§14.4③ 降级为特例方案时），过渡期才允许"逐文件 move"，但**必须**：① 先 `list` 出完整清单，② 全清单存在才搬、任一处失败则整体回滚（而非 404 跳过），③ 从缓存删除记录与磁盘搬移**任一失败都报错**。过渡期方案不写入 v4 正式契约。

### 3.6 可选（Phase 3）：文件变更实时推送

复用 `localTool/src/routes/logs.ts` 的 SSE 模式新增 `GET /api/skills/watch`（`fs.watch`）——但要新增端点 + 契约登记。Phase 1 用 `focus` 检测 + 手动"重新加载"按钮已够用。**不阻塞。**

---

## 4. 前端 `skillStore` 改造（`src/components/base/store/skillStore.ts`）

### 4.0 存储层与解析的精确规格（可执行 · 落地直接照抄）

本小节把所有被 §4.1-§4.3、§7、§10 引用却未定义的符号写成可抄代码形式，消除"接口黑洞"。全部为纯函数，必须有单测（§10）。

#### 4.0.1 磁盘布局

```
skills/<category>/<slug>/
├── SKILL.md          # frontmatter(id/name/description/version/allowedTools) + 正文
├── references/**     # 本期只落盘不读（结构保全，见 §2.4）
└── scripts/**        # 可选：可执行脚本（本期不消费）
# 🔴 v4：不写 .maomao.json；元数据真相只在 localStorage（见 §2.3 / §4.0.2 已删）
```

#### 4.0.2 ~~`.maomao.json` schema~~（**v4 已删除，本节作废**）

> **🔴 v4 删除说明（2026-09-11）**：原 `.maomao.json` 设计经 §14.3⑥ / §14.5 债 5 论证为**冗余真相源 + 文档自相矛盾**（正文拍板写、补充章节说不该写；文件内 id 与路径 id 分叉；enabled 上云它不上云；usage 本地它却存盘）。现**彻底删除**：磁盘只承载 `SKILL.md` + `references/`，所有元数据（`id`/`enabled`/`usage`/`createdAt`/`version`/`contentHash`）真相只在 localStorage（`agent_skills` 索引 + `agent_skill_enabled`/`agent_skill_usage`/新键 `agent_skill_cache`）。原本节 schema 全部作废，下列读取/写入 `.maomao.json` 的代码段（`persistSkillFile` 写 meta、`readMaomaoMeta`、`hydrate` 读 meta）一并删除。

<details><summary>原 §4.0.2 内容（已作废，仅供追溯）</summary>

```ts
// 猫猫私有元数据，双写 localStorage 运行时状态，便于整目录拷走后保状态。
export interface MaomaoSkillMeta {
  id: string;            // 原设计：稳定唯一 id = `${category}/${slug}`（见 keyOf）；🔴 v4 已改为 UUID，见 §4.0.5
  enabled: boolean;      // 运行时启用态（也冗余进 agent_skill_enabled，跨设备同步）
  usage: number;         // 调用计数（本地，不入云同步）
  createdAt: number;
  updatedAt: number;
  version?: string;
  allowedTools?: string[];
  contentHash?: string;
}
```
</details>

#### 4.0.3 `parseSkillMarkdown(raw): { meta, body }`

```ts
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillMarkdown(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(FM_RE);
  if (!m) return { meta: {}, body: raw };   // 安全阀：无 frontmatter → 整文件当正文
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim(); // 顶层 key:value 平铺；嵌套块（metadata:）不解析、原样保留
  }
  return { meta, body: m[2] };
}
```

- 解析失败 / 无 `---` 包裹 → 退化 `{ meta: {}, body: raw }`（**不丢内容**，§1.4 原则）。
- `metadata:` 等嵌套命名空间块：**不解析、原样保留在正文之后**；写回时整体附在 body 后。

#### 4.0.4 `serializeSkillMarkdown(skill): string`

```ts
export function serializeSkillMarkdown(skill: Skill): string {
  const fm: string[] = [];
  if (skill.name) fm.push(`name: ${skill.name}`);
  if (skill.description) fm.push(`description: ${skill.description}`);
  if (skill.version) fm.push(`version: ${skill.version}`);
  if (skill.allowedTools?.length) fm.push(`allowedTools: [${skill.allowedTools.join(', ')}]`);
  const head = fm.length ? `---\n${fm.join('\n')}\n---\n\n` : '';
  return `${head}${skill.content ?? ''}`;
}
```

- 往返幂等：`parse → serialize → parse` 后 `name/description/content` 三者稳定（§10 验收项）。
- 纯文本 frontmatter（零依赖，决策 3）。

#### 4.0.5 命名 / 路径 / 身份工具

```ts
// 🔴 v4：id 是创建时生成的稳定 UUID，与磁盘路径完全解耦（§14.3② / §14.5 债 1）。
//   改名 / 换分类只改磁盘目录，不动 id；旧 localStorage 数据迁移时旧 id 登记进 aliases。
import { crypto } from 'node:crypto'; // 浏览器侧用 crypto.randomUUID()
export function newSkillId(): string {
  return crypto.randomUUID(); // 形如 '9f1c…'，全局唯一、永不随文件名变化
}

// 类别/路径信息不再编码进 id；Skill 记录上单独存 category/slug 字段（仅展示/布局）。
// “按 id 反查路径”走对象上的 category/slug 字段，不再从 id 字符串切分：
export interface SkillPathRef { category: string; slug: string; }
// 兼容性：旧数据可能残留 `category/slug` 形如的 id，迁移时转成 UUID 并把原串记入 aliases。

// 文件名清洗：去 .. 段、去非法字符、空白转 _，截断 80
export function safeFileName(name: string): string {
  return name.replace(/\.\.+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'skill';
}

// 分类名清洗（目录即分类）：同 safeFileName，但允许中文，禁止 / 与 ..
export function sanitizeCategory(dir: string): string {
  const s = dir.replace(/\.\.+/g, '_').replace(/[\\/]/g, '_').trim();
  return s || '_未分类';
}

// slug 生成：同分类重名追加 -2 / -3（slug 只是目录名，不参与身份）
export function uniqueSlug(category: string, base: string, taken: Set<string>): string {
  let s = safeFileName(base);
  if (!taken.has(s)) return s;
  let n = 2;
  while (taken.has(`${s}-${n}`)) n++;
  return `${s}-${n}`;
}
```

- 导入外部包时，`webkitRelativePath` 任何含 `..` 的段**直接丢弃该文件**（§8 安全）。
- **身份与路径解耦**：任务绑定、启用态、统计一律用 `id`（UUID）索引；磁盘 `category/slug` 仅用于定位文件，改名换目录不改 `id`，故**不存在"旧 id→新 id 迁移"问题**（§14.3②）。

#### 4.0.6 存储双层（解决 §11.5 的 content/缓存一致性矛盾）

| 存储键 | 内容 | 云同步 |
|---|---|---|
| `agent_skills` | 索引 `[{id(UUID),category,slug,name,description,version?,allowedTools?,usage?,contentHash?,aliases?}]`（**去 content**） | ✅ 同步（启用态经 `agent_skill_enabled`）；`contentHash` 随索引上云，用于跨设备变更比对 |
| `agent_skill_cache` | `{ [id]: content }` 正文缓存（hydrate/保存时填，**仅本机**，不上云） | ❌ `SYNC_EXCLUDE` |

- `getAllSkills()`：读 `agent_skills` 索引，再按 id 从 `agent_skill_cache` 补 `content` → 返回完整 `Skill[]`（本机无缓存键时 content 为空字符串，UI 提示"本机无文件，请拷贝 skills/ 目录"）。
- **`contentHash` 持久化进 `agent_skills` 索引项**（不仅是内存 Map），作为"磁盘 vs 缓存/跨设备"比对的**权威指纹**（修正 §4.4 / §14.5 债 7：不再依赖重启即失的 `syncedContentHash` 内存 Map）。
- `upsertCustomSkill`：**先落盘、落盘成功才写双键缓存**（fail-loud 单真相源，见 §4.2 v4 修正），返回 `Promise` 暴露落盘成败，调用方据以 toast。

> **配套函数约定（纯封装，直读直写对应 key，均经 `contentSet/contentGet` 并 notify）**：
> - `saveSkillIndex(idx: Skill[])` → 写 `agent_skills`（去 content，§4.0.6 表）；`getSkillIndexEntry(id)` → 读 `agent_skills` 索引单条（返回 `{name, description, category, slug, ...}` 或 null，不含 content）。
> - `saveSkillContentCache(id, content)` / `saveSkillContentCacheBulk(list)` → 写 `agent_skill_cache`（**仅 content**，SYNC_EXCLUDE）；`readSkillContentCache(id)` → 读 `agent_skill_cache` 单条（返回 `{content: string, contentHash?: string}` 或 null）。
> - ⚠️ 字段归属边界：`name/description/category/slug` **只存 `agent_skills` 索引**；`content` **只存 `agent_skill_cache`**。二者在 `getAllSkills` 合并、`persistSkillFile` 落盘时按需拼回完整 `Skill`，不要混写。

#### 4.0.7 正文预算（收购对齐 · SKILL_CONTENT_LIMITS）

`references/` 本期不注入 LLM，故 `SKILL.md` 正文是 LLM 实际看到的全部。对齐参考项目预算：

```
SKILL_CONTENT_LIMITS = { singleSkillChars: 12000, warnAt: 8000 }
```

- 保存/导入时若 `body.length > warnAt` → UI 黄条提示"正文偏长，建议把细节拆进 references/（本期不自动注入）"。
- 不强制截断（用户自决），仅提示；硬上限 12000 超出则标红但放行。

### 4.1 两类数据源

| 数据 | 来源 | 持久化 |
|---|---|---|
| 内置 skill | 代码常量 `BUILTIN_SKILLS`（`skillStore.ts:83`） | 不变 |
| 用户 skill 包（`SKILL.md` + `references/**`） | **本地文件**（真相源） | `~/.maomao-localtool/skills/<slug>/` |
| 运行期缓存（列表 + content） | localStorage | `agent_skills`（保留，作同步缓存） |

> **`Skill` 结构扩展（向后兼容，可选字段）**：
> ```ts
> export interface Skill {
>   id: string; name: string; description: string; content: string;
>   createdAt?: number; updatedAt?: number; builtin?: boolean;
>   // v3 新增（均可选，旧数据/内置 skill 不填，零破坏）
>   category?: string;          // 分类目录名；缺省 '_未分类'（见 §2.6）
>   slug?: string;              // 包目录名；缺省时由 id 兜底
>   references?: string[];      // 相对 `references/` 的文件清单（本期只记录，不读取，见 §2.4）
>   // —— 收购对齐增强（可选零破坏，见 §4.0.2 / §13）——
>   version?: string;           // 语义化版本；任务快照据此锁定
>   allowedTools?: string[];    // 该 skill 启用时放开的工具白名单
>   contentHash?: string;       // SKILL.md 正文 sha256 前 12 位，外部改文件检测用
> }
> ```
> 现有消费方（`agentCore.SkillItem` 只读 `name/content`、`AgentPanel` 只传 `{id,name,description,content}`）**全部不受影响**。

### 4.2 核心：**文件是唯一真相源，落盘成功才更新缓存**（🔴 v4 推翻"同步缓存优先"）

> **v4 修正（2026-09-11）**：原方案"同步缓存优先、落盘是叠加副作用、失败不回滚缓存"被 §14.5 债 3 判定为**把你最讨厌的"兜底护栏"写进了契约**——它把"落盘失败"消化成"缓存成就算赢"的灰色状态，让系统长期停留在"缓存与磁盘分歧"且无法收敛。现改为 **fail-loud 单真相源**：**磁盘 `SKILL.md` 是真相，缓存只是缓存；保存时必须先落盘成功，再回写缓存并 notify；落盘失败 → 缓存不更新 + UI 明确报错"未保存"，绝不假装成功。**

用户诉求"保存后立刻能用"**仍满足**：落盘是本地同机写（localTool 127.0.0.1），`await` 后同步 notify，延迟在毫秒级，`AgentPanel.tsx:308` 的 `contentSubscribe` 链路照常即时刷新。

```ts
// ① 保存：先落盘（真相源），成功才写双键缓存并 notify；失败抛错，缓存不动
export async function upsertCustomSkill(skill: Partial<Skill>): Promise<Skill> {
  // …（原有校验 + repairMojibakeText 不变；id 用 newSkillId() 生成，见 §4.0.5）
  const diskOk = await persistSkillFile(clean);   // ★ await 落盘，throw if fail
  if (!diskOk) throw new Error('Skill 未落盘（本地文件写入失败）');
  const idx = list.map(({ content: _c, ...rest }) => rest);        // 索引去 content（§4.0.6）
  const res = saveSkillIndex(idx);                                 // ← agent_skills（同步 notify）
  const resCache = saveSkillContentCache(clean.id, clean.content); // ← agent_skill_cache（SYNC_EXCLUDE）
  if (!res.ok || !resCache.ok) {
    // 极端：落盘成、缓存写失败 → 下次 hydrate 会从磁盘重新填缓存，不丢数据；仅记 warn
    logger.warn('skillStore', '落盘成功但缓存写入失败，下次启动将从磁盘恢复', clean.id);
  }
  return clean;
}
```

```ts
// ② 落盘（真相源写入）：SKILL.md（frontmatter+正文）；contentHash 算后写回 agent_skills 索引项（§4.0.6）。
//    🔴 v4：不再写 .maomao.json（§4.0.2 已删）。失败返回 false（由调用方决定抛错/提示），不静默。
async function persistSkillFile(skill: Skill): Promise<boolean> {
  const { category, slug } = skill;   // ★ 路径来自对象字段，不再 splitKey(id)
  const md = serializeSkillMarkdown({
    name: skill.name || '',
    description: skill.description || '',
    version: skill.version,
    allowedTools: skill.allowedTools,
    content: skill.content ?? '',
  }); // §4.0.4
  const r1 = await saveSkillFile(`${category}/${slug}/SKILL.md`, md);
  if (!r1.ok) return false;
  const hash = await sha256Head12(skill.content ?? '');
  // contentHash 持久化进 agent_skills 索引项（权威指纹，修正 §4.4 / §14.5 债 7）
  await patchSkillIndexEntry(skill.id, { contentHash: hash, updatedAt: Date.now() });
  return true;
}
```

**为什么改成 `async` 并 `await` 落盘**：原"保持同步签名 = 零破坏"是把"不报错"伪装成"成功"。`SkillSettings.tsx:140`（`handleSave`）、`:225`（.md 导入）只需 `await` 返回值并据异常显示"未保存"即可，改动 2 个调用点、代价极小，换来**真相源的诚实**。这是 §14.3① 的核心修正。

> **不变式（INV，由 §10 单测钉死）**：
> - **INV-1**：`agent_skills` 索引里出现的每个 `id`，磁盘上必有对应 `<category>/<slug>/SKILL.md`；否则启动即报错（不"跳过该包当没看见"）。
> - **INV-2**：缓存（`agent_skill_cache`）里的 content 仅代表"本机已落盘副本"；**绝不**在落盘失败时被当作已保存真相消费。

### 4.3 启动 hydrate（v3：读 skill 包目录）

```ts
/** 启动时从本地 skill 包目录刷新缓存。磁盘是真相源；磁盘无此 skill 则不留存（fail-loud，不"缓存独有项保留"）。 */
export async function hydrateSkillsFromFile(): Promise<{ ok: boolean; loaded: number; error?: string }> {
  // 启动时序（与云同步竞态）：本函数读的是「当前 localStorage 里的 agent_skills 索引」+ 磁盘 packs。
  //   若云同步（GAS 拉取）在本函数之后才写入 agent_skills，云写入会 notify SKILLS_KEY → AgentPanel
  //   的 resync 重跑 getAllSkills 纳入云端索引。本函数不依赖"先云后本地"的严格顺序。
  //   🔴 v4：不再有"缓存独有项保留"——磁盘上没有的 skill，缓存里也不该留下（否则就是 §14.5 债 3 的灰色状态）。
  try {
    const packs = await listSkillPackages();
    if (!packs.length) {
      // ★ 空目录：不急着清空缓存（可能 localTool 刚起 / 暂时不可达）。但也不"保留缓存独有项"——
      //   改用「标记待校验」：本次 hydrate 视为未决，待 localTool 可用后下一次 hydrate 再据磁盘裁决。
      return { ok: true, loaded: 0, error: '本地 skills 目录为空或暂不可达，缓存维持现状待下次校验' };
    }
    const cache = new Map(getAllSkills().map((s) => [s.id, s]));   // 双键合并（§4.0.6），仅用于补 enabled/usage
    const merged: Skill[] = [];
    for (const p of packs) {
      // ★ 系统目录跳过：仅 `.` 前缀的目录（.trash / .thumbnails 等）是内部系统桶，其下 SKILL.md 不得被误读。
      //   注意：`_未分类` 是**合法兜底分类**（§2.6），必须正常加载。跳过规则只针对 `.`（点）前缀。
      if (p.category.startsWith('.')) continue;
      if (p.slug.startsWith('.') || p.slug.startsWith('_')) continue;  // 防 .DS_Store 等非包目录
      const raw = await readSkillFile(`${p.category}/${p.slug}/SKILL.md`);
      if (raw == null) continue;                        // ★ 单包读失败：跳过，绝不写空
      const { meta, body } = parseSkillMarkdown(raw);   // frontmatter + 正文（§2.2）
      // 🔴 v4：id 是磁盘 SKILL.md 里 frontmatter 的 `id`（UUID）优先；无则按 cache 里 category+slug 匹配到的 id；
      //   仍无则新生成 UUID 并写回 frontmatter（一次性规范化，见 §14.3②）。
      const id = meta.id || matchIdByPath(cache, p.category, p.slug) || newSkillId();
      const prev = cache.get(id);
      const contentHash = sha256Head12(body);           // ★ 权威指纹，持久化进 agent_skills 索引项（§4.0.6）
      merged.push({
        id,
        category: p.category,                           // ★ 分类来自目录名（§2.6），仅展示/布局
        slug: p.slug,
        name: meta.name || prev?.name || p.slug,         // frontmatter 优先 → 缓存 → slug 兜底
        description: meta.description || prev?.description || '',
        content: body,                                  // ★ 只取正文，保证与注入 LLM 的内容一致
        contentHash,                                    // ★ 写入索引项（非易失内存 Map）
        references: p.files.filter((f) => f.startsWith('references/')).map((f) => f.slice('references/'.length)),
        createdAt: prev?.createdAt, updatedAt: prev?.updatedAt,
      });
    }
    // ★ 磁盘为真相：只保留磁盘上存在的 skill。缓存里"磁盘无对应文件"的项不写入（违反则 INV-1）。
    saveSkillIndex(merged.map(({ content: _c, ...rest }) => rest)); // 索引键 agent_skills（去 content）
    saveSkillContentCacheBulk(merged);                            // 正文键 agent_skill_cache（SYNC_EXCLUDE）
    return { ok: true, loaded: merged.length };
  } catch (e) {
    // 🔴 v4：hydrate 整体失败 → 报错而非"沿用本地缓存"假装成功。缓存可能过期，但至少不让错误被吞。
    logger.error('skillStore', 'Skill 从文件加载失败', e);
    return { ok: false, loaded: 0, error: (e as Error).message };
  }
}
```

> **`id` 的取值（v4 修正）**：`id` 是创建时生成的稳定 UUID（§4.0.5），**不再等于 `category/slug`**。磁盘 `SKILL.md` 的 frontmatter 里携带 `id`；hydrate 时优先用文件里的 `id`，无则按 `category+slug` 匹配缓存已有 id，再无则新生成并回写 frontmatter（一次性规范化）。**改名换分类只改目录，不动 id**，因此不存在"旧 id→新 id 迁移"问题（见 §14.3②）。

**关键防线**（对应 §0.4/§1.4 不丢数据原则；🔴 v4 删除"缓存独有项保留"这条你最讨厌的兜底护栏）：
1. `packs.length === 0` → **不写空、不保留灰色缓存**。返回"未决"状态，等 localTool 可用后下次 hydrate 据磁盘裁决。绝不把"磁盘无"伪装成"缓存有即真相"。
2. 单包 `SKILL.md` 读失败 → 跳过该包，**不用空值覆盖**。
3. `parseSkillMarkdown` 解析失败 → 退化：`{ meta: {}, body: raw }`（整个文件当正文），**不丢内容**。
4. **（已删除）原"缓存独有项保留"**：该设计把"网页新建未落盘的 skill"永久养成灰色真相（§14.5 债 3），已被 **INV-2**（落盘失败则缓存不更新）取代——未落盘的改动本就不该留在缓存里。

### 4.4 外部变更检测（Phase 2，升级为 contentHash 比对）

```ts
// 记录每个 skill 包「上次已知磁盘内容」的 contentHash 指纹。
// 用内容 hash 而非 mtime——复制/搬目录会改 mtime 但内容不变，会让检测误报。
// 🔴 v4：权威指纹来自 **agent_skills 索引项里持久化的 contentHash**（§4.0.6），而非易失内存 Map。
//   内存 `syncedContentHash` 仅作本次会话缓存，重启后从索引项重新载入，杜绝 §14.5 债 7 的"重启即失"误报。
const syncedContentHash = new Map<string, string>(); // 仅会话缓存；真相在 agent_skills.contentHash

async function detectExternalChanges(): Promise<string[]> {
  const changed: string[] = [];
  for (const s of getAllSkills()) {
    if (!s.category || !s.slug) continue;             // 缺路径信息（纯缓存孤儿）跳过
    const disk = await readSkillFile(`${s.category}/${s.slug}/SKILL.md`).catch(() => null);
    // 权威基线：优先内存缓存，回退索引项持久化 contentHash
    const baseline = syncedContentHash.get(s.id) ?? s.contentHash;
    if (disk == null) {
      // 文件被删：若 baseline 存在（此前确有此文件）→ 报删除，由调用方走删除流程（§3.5）。
      if (baseline) changed.push(`__deleted__:${s.id}`);
      continue;
    }
    const now = await sha256Head12(disk);             // 见 §4.0.2 contentHash
    syncedContentHash.set(s.id, now);                 // 更新会话缓存
    if (baseline !== now) changed.push(s.id);         // 与权威指纹比对，不等即外部改过
  }
  return changed;
}
```

> **衔接 §4.3 / §4.0.6（v4 修正）**：`hydrateSkillsFromFile` 已把磁盘 hash 写入 `agent_skills` 索引项的 `contentHash`（持久化），`upsertCustomSkill` 落盘成功也 `patchSkillIndexEntry(id,{contentHash})`。故 `detectExternalChanges` 即便会话缓存（`syncedContentHash`）为空，也能回退到索引项里的持久化 `contentHash`，**重启不再误报**（修正 §14.5 债 7）。
- 触发时机（任选，建议都做）：`focus` / `visibilitychange` 时；或定时轮询（5s，Phase 2）。
- 分类目录被改名/搬家 → `id`（UUID）**不变**，磁盘路径变 → 按新 `category/slug` 读取比对，id 稳定故绑定/启用态不受影响（修正 §14.5 债 1）。
- 检测到差异 → 走 §5.3 冲突处理。

---

## 5. 双向同步策略

### 5.1 Web → 文件（用户从网页保存）
- 点保存 → `upsertCustomSkill`（**async**）→ **先落盘** `SKILL.md`（frontmatter + 正文）到 `<分类>/<slug>/SKILL.md`，**落盘成功才回写缓存并 notify**（UI 立刻可用，见 §4.2 v4）。
- 落盘失败 → **缓存不更新** + UI 明确报"未保存，请重试"（fail-loud，不假装成功，不把脏数据养在缓存里）。
- **注意**：网页保存**只写 `SKILL.md`**，**不动 `references/`**。否则用户在 VS Code 里新增的参考文件会被网页保存抹掉。
- **改分类**（拖拽）→ facade 整包 move 到新分类目录（语义同 §3.5 v4，原子删+写），完成后更新缓存 + 重载；**`id`（UUID）不变**，启用态/绑定不丢。

### 5.2 文件 → Web（用户在 VS Code / Finder 改）
- 检测到 `<分类>/<slug>/SKILL.md`、`references/` 变更，**或分类目录被改名/搬家** → 提示用户（§5.3）；或用户点"重新加载"按钮主动拉取。
- 确认后 `readSkillFile(<分类>/<slug>/SKILL.md)` → 更新缓存 → `contentSet` notify → `AgentPanel` 自动刷新（既有订阅链路，无需新代码）。

### 5.3 冲突处理（两者都改了）
判定：网页有**未保存的内存改动** `dirty`，且磁盘文件自网页加载后**已被外部修改** `externalChanged`。
- 弹窗二选一（不静默覆盖）：
  - **以本地文件为准（重载）**：丢弃网页未保存改动，载入磁盘版本。
  - **以网页为准（覆盖）**：用网页当前内容落盘覆盖磁盘。
- 若网页无未保存改动 → 直接静默/轻提示重载，不弹窗打扰。

### 5.4 一致性不变量
- `content` / `name` / `description` 的真相源是 `SKILL.md`；缓存仅在"hydrate 成功有包"或"save 成功"后被更新。
- 缓存永远**不因"读到空"而被清空**（§4.3 防线）。
- 网页保存**只碰 `SKILL.md`，不碰 `references/`**（§5.1），避免抹掉用户在编辑器里新增的参考文件。
- `builtin` skill 永不被文件读写影响。

---

## 6. UI 改造（`SkillSettings.tsx`）

1. **分类树（v3 新增，你的归类诉求）**：左栏由现在的「个人 / 官方」两段（`SkillSettings.tsx:332-388`）扩展为 **「分类树 + 官方」**：
   - 分类可折叠；**拖 skill 到另一分类 = 改分类**（走 `moveFile` 逐个文件搬，同 §3.5 删除语义）。
   - 新建 skill 时可选分类（下拉 + 可输入新分类名）；未选 → `_未分类/`。
   - 分类目录名即分类名（§2.6），**在 Finder 里拖拽同样生效**，两侧天然一致。
   - 搜索跨分类（现有 `debouncedKeyword` 逻辑保留，`SkillSettings.tsx:79-91`）。
2. **保存落盘提示**：`handleSave` 保持现状（同步判断 `saved`，`SkillSettings.tsx:140`），toast 文案按落盘结果补一句（`已保存` → `已保存并写入本地文件` / `已保存到浏览器缓存（未落盘）`）。
3. **"从文件重新载入"按钮**：手动触发 `hydrateSkillsFromFile()`（全量从磁盘刷新缓存，§4.3 三道防线仍生效），方便 VS Code 改完立刻拉进来。⚠️ 注意：`hydrateSkillsFromFile` 是**全量 merge**（非空目录时整体覆盖缓存），若网页里有"尚未落盘到文件"的新建/修改 skill（仅存于 localStorage 缓存），会被磁盘内容覆盖——这与 §4.3 "不丢数据"防线不冲突（磁盘为准本就是真相源），但 UI 应在重载前提示"未落盘改动将丢失"。Phase 2 的 `detectExternalChanges`（§4.4）可先比对再决定是否需要用户确认（§5.3）。
4. **外部变更横幅**（Phase 2）：`detectExternalChanges()` 非空时列表顶部提示"本地文件已被外部修改，是否重载？[重载] [忽略]"。
5. **编辑体验增强（顺带）**：`content` textarea（`SkillSettings.tsx:475`）已是 `min-h-[340px]`；可加 `resize-y` 允许拖拽放大。真正的舒适编辑仍是 VS Code 改文件。
6. **路径提示**：设置页展示 `~/.maomao-localtool/skills/<分类>/<slug>/SKILL.md`，并给"打开所在目录"按钮（复用 `filesApi.openFileDir` / `openLocalFolder('skills')`）。
7. **导入 skill 包**：`<input type="file" webkitdirectory>` 选目录 → 递归读全部文件 → 落盘到 `skills/<分类>/<slug>/…`。把 `SkillSettings.tsx:215` 的 `handleMdImport` 升级为目录导入（`.md` 单文件导入保留兼容，默认落 `_未分类/`）。
   - ⚠️ **目录 → 分类/slug 映射（流程缺口，明确如下）**：用户用 `webkitdirectory` 选中的顶层目录名（即 `webkitRelativePath` 的第一段，如 `漫画生成-Comic`）**作为 `slug` 落盘**，`SKILL.md` 与 `references/` 等保持原相对结构；**分类**由导入对话框的下拉/输入框决定（默认 `_未分类`，用户可选/填已有或新分类）。即落盘路径 = `skills/<所选分类>/<目录名(slug)>/…`。若用户想"整包原样导入到某分类"，目录名就是 slug，分类单独选——不与外部管理器的分类目录名强绑定（外部 `工作效率类/漫画生成` 导入时，用户选 `图片类` 分类、slug 取 `漫画生成` 即可，目录形态对齐 §2.1）。
   - ⚠️ **安全**：每个 `File` 的 `webkitRelativePath` 分段若含 `..` 或绝对段 → **丢弃该文件**（§8）；`slug` 过 `safeFileName`、分类过 `sanitizeCategory`。
8. **导出 skill 包**：列表项菜单加"导出整个包"（原 `handleMdExport` 只导出 `content` 文本，`SkillSettings.tsx:255`）。逐文件下载本期可接受（**见 §12 决策点 5**）。

---

## 7. 迁移方案（localStorage → 文件）

> ⚠️ **与 §4.0.6 瘦身的时序约束（关键）**：迁移必须读取**旧结构**（含 `content` 的原始 `agent_skills` 数组）。瘦身后 `getCustomSkills()` 返回的已是"去 content 索引"，无法提供正文。故迁移**不走 `getCustomSkills()`**，而是用底层 `contentGet('agent_skills')` 直读原始数组（含 content），且**在 `getAllSkills` 任何瘦身合并逻辑之前**执行（hydrate 函数开头优先判断迁移，再做磁盘 hydrate）。迁移完成后写新结构（索引 + 缓存），旧原始记录保留不删（双保险）。

> 🔴 **v4 迁移修正（2026-09-11）**：原"按 `name` 猜新 id + 启用态兜底防全灰"被 §14.5 债 1 / 债 6 判定为**身份断裂的兜底护栏**。现改为 **稳定 UUID 身份 + 旧 id 永久登记进 `aliases`**：旧 `skill_*` 时间戳 id 不再被"猜完改写删掉"，而是作为不可变别名写入索引项，运行时按 id 或任一 alias 都能解析。启用态/统计天然跟随 UUID，无需"兜底默认启用"。

- **首次启动**：若 `skills/` 目录**为空**（含无任何分类目录）且底层 `contentGet('agent_skills')` 旧结构数组非空 → 进入迁移：
  1. 读旧原始数组（每条含 `id`形如`skill_1700000000`、`name`、`description`、`content`）。
  2. 逐条：`newId = newSkillId()`（**UUID，§4.0.5**）；`slug = uniqueSlug('_未分类', skill.name, taken)`；写磁盘 `skills/_未分类/<slug>/SKILL.md`（`serializeSkillMarkdown`，含 content 作正文 + name/description 作 frontmatter + **frontmatter 写入 `id: <newId>`**）。
  3. **旧 id 登记为 alias（不删不改写）**：索引项写 `{ id: newId, aliases: [skill.id], category:'_未分类', slug, ... }`；`agent_skill_enabled[skill.id]` 与 `agent_skill_usage[skill.id]` **保留原键不动**（运行时按 alias 命中），或复制为 `agent_skill_enabled[newId]` 并保留旧键作 alias——总之**旧键不删**，避免身份断裂。
  4. 写新结构：把每条转成索引项（去 content、含 `id`+`aliases`）存入 `agent_skills`，正文存入 `agent_skill_cache`。
  - ⚠️ 迁移是**写文件**，不是"清 localStorage"。若 `skills/` 目录已存在则**跳过迁移、只读不写**（避免把网页旧数据倒灌覆盖 VS Code 的新内容）。
  - ⚠️ **旧数据无 `category`** → 统一落 `_未分类/`，用户在 UI 里或 Finder 里再归类（不强猜分类）。
- **`slug` 生成**：由 `name` 清洗而来（`safeFileName`）；**同一分类内重名**时加序号 `-2`、`-3`（slug 仅目录名，不参与身份）。
- **身份解析**：`findSkill(idOrAlias)` 先按 `id` 查，未命中再遍历 `aliases` 匹配——旧 `skill_*` id 永久可解析，**不存在"全灰"风险**，故删除原"启用态兜底"那段（§14.5 债 1 根除）。
- 迁移失败不删 localStorage（数据双保险）。
- 提供"导出全部 skill 到文件"的兜底按钮，防极端情况下文件丢失可重建。

> ❌ **（已删除）原"启用态兜底"段落**：`getAllSkills` 回退查旧键 + 默认启用，是把"迁移身份对齐没做扎实"伪装成"不会全灰"。v4 用稳定 UUID + aliases 从根上消灭身份断裂，不再需要该兜底。

---

## 8. 安全与边界

- **localTool 改动面极小且收窄**（§3.2 三处）：只放行 `skills` 一个顶层根，其余白名单原样；`skills/` 域走 `resolveUploadFile` 那套 `path.resolve` + 防逃逸（`fileStore.ts:94-110`），比 `sanitizeFilename` 拍平更安全。**新增的写分支不放开任意路径。**
- **路径清洗（逐级）**：`category` / `slug` / `references` 下的每级目录名均来自用户输入，写文件前**逐级清洗**，防 `../` 穿越。
- **导入外部包时的额外防线**：递归读入的 `File` 的 `webkitRelativePath` 可能含 `..`（恶意包）→ 落盘前**丢弃任何含 `..` 的段**。
- **分类名也需清洗**：用户可输入新分类名 → 同样过 `safeFileName`（防 `/`、`..`）。
- 文件内容仅文本（`references/` 若含二进制本期按文本处理，损坏则跳过并 warn）。
- 现有 `handleRead` 的任意路径读是**既有行为**（登记 `RESERVED`、前端零消费，`src/components/base/core/contracts.ts` 的 `RESERVED` 集合）；localTool 仅 127.0.0.1 监听 + 单用户本机进程（`CLAUDE.md` §四.2）。
- 若未来 localTool 暴露到更广网络，再考虑收窄 `handleRead`——**现在不做**。

---

## 9. 实施分阶段

### Phase 0 · 后端：优先做 skills facade（前置，必须先做）
- [ ] **🟢 正式路径（§14.4③）**：localTool 内新增独立 `skills.ts` facade（复用 `getUploadDir()`，自带"稳定命名 + 层级保留 + 落盘返回 Promise + 整包原子删"语义），加极薄路由 `POST/GET/DELETE /api/skills/<category>/<slug>`。
- [ ] **🔴 过渡兜底（仅当 facade 工期不可接受时）**：`fileStore.ts:39` 加 `'skills'`；`skills/` 域保留多级路径；`handleUploadFormData` 的 `skills/` 域走 `writeUploadBufferAt`（不加时间戳，实现 A）。验收同下。
- [ ] **验收**：保存后磁盘出现 `skills/图片类/漫画生成/SKILL.md`（无时间戳前缀），`read` / `delete` 整包可用；`npm test` 确认 `tasks/web/canvas/migrated/director3d` 行为逐字不变。

### Phase 1 · skill 包落盘 + 分类 + 双向编辑（本期核心）
- [ ] `skillStore.ts`：`Skill` 加 `id`(UUID) / `category?` / `slug?` / `references?` + `aliases?`；新增 `newSkillId()`（§4.0.5）、`parseSkillMarkdown` / `serializeSkillMarkdown`（纯函数，**必须补单测**）+ `hydrateSkillsFromFile`（§4.3 v4：磁盘为真相，删"缓存独有项保留"）。
- [ ] `filesApi.ts`：新增 `saveSkillFile` / `readSkillFile` / `listSkillPackages`（facade 路径，§3.4）。
- [ ] `skillStore.ts`：**改写读取链为双键合并**（被低估的必需项）：`getAllSkills()` / `findSkill(idOrAlias)`（含 alias 解析）内部改为「读 `agent_skills` 索引（去 content）→ 按 id 从 `agent_skill_cache` 补 `content` → 返回完整 `Skill[]`」；`readCustomSkills()` **保留损坏告警语义**。消费面仅 3 文件 26 处，改两函数内部即零破坏调用方。
- [ ] `skillStore.ts`：**`upsertCustomSkill` 改为 `async` 且先落盘后缓存**（§4.2 v4 fail-loud 单真相源）；`deleteCustomSkill` 走 facade 整包原子删（§3.5 v4）。**调用方 `SkillSettings.handleSave/.md` 导入改为 `await` 并据异常提示"未保存"。**
- [ ] **分类能力**：默认分类表（`图片类`/`视频类`/`文档类`/`自动化`/`_未分类`）；`SkillSettings` 分类树 + 拖拽换分类（改名换目录**不动 id**）+ 新建时选分类。
- [ ] 启动挂载：hydrate 在应用启动早期调用（**迁移优先于磁盘 hydrate**，见 §7 时序约束）。
- [ ] `SkillSettings`：保存提示（**落盘失败明确"未保存"**）+ "从文件重新载入" + 展示包路径 + 导入/导出整个包。
- [ ] **云同步适配（§11.5，决策 10/11）**：`agent_skills` 瘦身去 `content` + `contentHash` 随索引上云；新增 `agent_skill_cache` 存正文缓存并 `SYNC_EXCLUDE`；确认 `enabled` 仍跨设备同步。
- [ ] 迁移：首次把 localStorage 旧数据导出为 `_未分类/<slug>/`，**旧 `skill_*` id 登记进 `aliases`**（§7 v4，无"按 name 猜"、无"启用态兜底"）。
- **验收**：① 网页改 → `skills/<分类>/<slug>/SKILL.md` 更新且 **AgentPanel 立刻能用新内容**；② 导入 `漫画生成-Comic`（含 `references/` 几十个文件）→ **一个不丢**；③ 技能列表按分类分组；④ 点"重载" → 磁盘改动进网页；⑤ **落盘失败 → UI 明确"未保存"、缓存不更新（INV-2）**；⑥ **云同步手动跑一次，确认 `agent_skills` 无正文、`contentHash` 随索引上云、`enabled` 跨设备可见**；⑦ **Finder 拖拽改名分类 → id 不变、启用态/绑定不丢（INV-1）**。

### Phase 2 · 自动双向同步
- [ ] `detectExternalChanges()`：`focus` + 定时轮询（5s），签名含分类 + `references/` 文件清单（**目录改名 = 分类变更**，一并检出）。
- [ ] "外部变更"横幅 + 冲突弹窗（§5.3）。
- [ ] 离线降级与恢复后的自动落盘补偿。

### Phase 3 · 依赖懒加载 + 实时化（可选）
- [ ] **`read_skill_reference` 工具**：agent 按需读 `references/xxx.md`（需定工具 schema + 路径白名单 + 错误降级）。**本期明确不做**（§2.4）。
- [ ] `localTool` `GET /api/skills/watch`（SSE，`fs.watch`），取代轮询。

---

## 10. 测试要点

- **落盘**：网页新增/编辑 skill → `skills/<分类>/<slug>/SKILL.md` 创建/更新（frontmatter + 正文格式正确、**无时间戳前缀**）；刷新网页数据仍在。
- **即时可用**（本期核心）：网页保存后**立即**在 AgentPanel 的 `/` 列表和已选 chip 里看到新 `content`；无需刷新页面。
- **包完整性**：导入 `漫画生成-Comic` → `references/` 全部文件落盘；导出后与原目录**逐文件比对一致**。
- **分类（本期新增）**：新建时选分类 → 落对目录；拖 skill 换分类 → 目录搬迁 + 列表刷新；在 Finder 里新建分类目录 + 放 skill → 重载后 UI 出现该分类；分类名含 `/`/`..` → 被清洗。
- **同分类重名**：两个 skill 都叫「封面生成」→ slug 自动 `封面生成`、`封面生成-2`，不互相覆盖。
- **frontmatter 往返**：`parse → serialize → parse` 后 `name/description/content` 三者稳定（幂等）。
- **frontmatter 容错**：无 frontmatter / 格式错误 / `content` 内含 `---` → 不丢内容（退化为整文件当正文）。
- **外部改 → 网页**：VS Code 改 `SKILL.md` → 点"重载" → 网页同步。
- **空目录防线**：删空 `skills/` 但保留 localStorage → 启动 hydrate **不得清空**网页里的 skill。
- **`references/` 不被误删**：网页保存 `SKILL.md` 后，磁盘上 `references/` 文件仍在。
- **冲突**：网页改未存 + 磁盘被外部改 → 弹窗二选一，均不静默丢数据。
- **安全**：`slug`/分类名 含 `../` / 绝对路径 → 被清洗；导入含 `..` 段的恶意包 → 该段被丢弃，磁盘无越权写。
- **离线**：关掉 localTool → 网页仍可用（localStorage）；恢复后保存能落盘。
- **删除**：删除 skill → 整个包进 `skills/.trash/`（非硬删）；重新加载列表不含已删项。
- **后端回归（P0）**：`cd localTool && npm test` 全绿；`tasks/web/canvas/migrated/director3d` 落盘行为与改前**逐字一致**（尤其 `canvas` 回退逻辑没被 skills 分支影响）。
- **前端回归**：`builtin` skill 行为不受影响；`getAllSkills/findSkill` 调用方无破坏；`AgentPanel.test.jsx` 的 Skill 应用/移除用例不回归。

---

## 11. 风险与回滚

- **风险 1 · 后端改动波及既有落盘**（新增，最高危）：`UPLOAD_ROOT_ALLOW` 与 `handleUploadFormData` 是**全站文件落盘的共用路径**，改错会打爆拖图/生成落盘。缓解：改动严格限定在 `skills/` 前缀分支（实现 A），加 `localTool/test` 对 `tasks/web/canvas` 的断言，跑 `cd localTool && npm test`。
- **风险 2 · 缓存被清空**：hydrate 在目录为空/读失败时误调 `saveCustomSkills([])`。缓解：§4.3 三道防线 + 单测覆盖。
- **风险 3 · 旧 id → 新 id 迁移遗漏**：`agent_skill_enabled` / `agent_skill_usage` 的旧 id 键不改写 → 用户启用状态与统计丢失。缓解：§7 明确按 `name` 匹配并改写两处存储键 + 单测。
- **风险 4 · 落盘与缓存不一致**：落盘失败但缓存有值 → 用户以为已存。缓解（v4）：**落盘失败则缓存不更新**（§4.2 fail-loud 单真相源），UI 明确报"未保存"，INV-2 钉死"缓存只在落盘成功后代表真相"。
- **风险 5 · 路径穿越**：`category` / `slug` / `references` 未清洗直接拼。缓解：逐级 `safeFileName` + 丢弃 `..` 段 + 单测。
- **风险 6 · 网页保存抹掉 `references/`**：若保存实现成"整目录覆盖"。缓解：§5.1 明确"只写 `SKILL.md`"，加测试断言。
- **风险 7 · frontmatter 解析失败丢元数据**：缓解：解析失败退化"整文件当正文"，不丢内容（名称缺省用 slug）。
- **风险 8 · 分类被 hydrate 当成 skill**：`skills/图片类/` 若被误读为 skill 包会报错。缓解：两级固定结构（分类/skill），`SKILL.md` 不存在则跳过。
- **风险 9 · 删除复活**：删除只删缓存不删文件 → 下次 hydrate 复活。缓解：§3.5 移入 `.trash/`（` .` 前缀，hydrate 跳过规则仅排除 `.` 前缀系统目录，见 §4.3）。
- **风险 10 · 大目录导入慢**：几十个 `references/` 文件逐个 HTTP 上传。缓解：可接受（本机 127.0.0.1，毫秒级）。
- **风险 11 · 云同步把 skills 推空/推旧**（§11.5）：`agent_skills` 瘦身后若旧设备（未升级）推上带 `content` 的旧结构，或新设备拉不到文件 → skill 显示为"有记录无内容"。缓解：① `agent_skills` 只存索引，`content` 缺失时 UI 明确提示"本机无文件，请拷贝 `skills/` 目录"而非静默显示空；② `agent_skill_cache` 进 `SYNC_EXCLUDE` 杜绝正文上云；③ 升级时跑一次本地迁移再同步。
- **风险 12 · 存储键契约变更漏改**：`agent_skills` 结构变更 + 新增 `agent_skill_cache` 属 `CLAUDE.md` §5.5 P0 红线。缓解：`src/components/base/core/contracts.ts` 登记 + `npm run check:keys` + 全量 grep 消费方（`skillStore`/`AgentPanel`/`SkillSettings`）。
- **风险 13 · hydrate 整体覆盖清掉网页新建未落盘 skill**：原 §4.3 把 merged 仅来自磁盘 packs、整体覆盖 `agent_skills`，会清掉"缓存有、磁盘无"的网页新建/修改 skill。缓解（v4）：**落盘失败则缓存本就不含该 skill**（§4.2 INV-2），故"缓存有磁盘无"不再是合法状态；空目录走"未决"而非清空（§4.3 防线 1），磁盘为唯一真相。
- **风险 14 · 迁移与瘦身时序矛盾**：瘦身后 `getCustomSkills()` 返回去 content 索引，迁移若读它则拿不到正文无法落盘。缓解：§7 明确迁移用底层 `contentGet('agent_skills')` 直读**旧原始数组**（含 content），且在任何瘦身合并逻辑之前执行；迁移失败不删旧数据。
- **风险 15 · 启用态因 id 变更全灰**：旧方案 `id=category/slug`，改名即 id 变、旧键失效。缓解（v4）：**`id` 改为稳定 UUID**（§4.0.5），改名换分类不动 id；旧 `skill_*` id 登记进 `aliases`（§7 v4），`findSkill` 含 alias 解析，**从根消灭"全灰"**，不再需要启用态兜底。
- **风险 16 · `.trash`/`.thumbnails` 误读为 skill 包**：`.trash/漫画生成/SKILL.md` 会被按 `category=.trash, slug=漫画生成` 误读。缓解：§4.3 跳过规则**仅排除 `.` 前缀分类目录**（不动 `_未分类` 合法兜底分类）；`readSkillFile` 走绝对路径分支避免 basename 拍平。
- **风险 17 · 删除时磁盘文件不存在导致删除失效**：落盘失败过的 skill 磁盘无文件 → `moveFile` 全 404 → 删除按钮形同虚设。缓解：§3.5 降级分支——404 跳过搬移、仍从缓存删记录。
- **风险 18 · 外部变更检测首轮误报/失效**：`detectExternalChanges` 依赖 `syncedContentHash`，若 hydrate 未填充则首轮全误判；且 `s.contentHash` 未写入缓存会恒 undefined。缓解：§4.3 hydrate 时 `syncedContentHash.set(id, hash)` + 缓存项写 `contentHash`；§4.4 比对仅用 `syncedContentHash` 权威指纹。
- **风险 19 · 启动时序竞态（hydrate vs 云同步）**：hydrate 读 agent_skills 时云同步尚未写入 → 漏掉云端索引。缓解：§4.3 注释——云同步写 agent_skills 必须 notify SKILLS_KEY，AgentPanel 的 resync 后续收敛；hydrate 不依赖严格先后顺序。
- **回滚**：① 前端加配置开关 `SKILLS_PERSIST=0` 退回纯 localStorage；② 后端三处改动均为**新增分支**，把 `'skills'` 移出白名单即回到改前行为；③ 云同步侧：把 `agent_skill_cache` 从 `SYNC_EXCLUDE` 移除 + `agent_skills` 恢复带 `content`，即回到现状。

---

## 11.5 云同步 / 备份怎么办（用户提问：会不会用不了？）

**结论：不会用不了，而且比现在更好——但需要一次"瘦身"改动。**

### 现状（实测）

| 机制 | 覆盖 `agent_skills` 吗 | 位置 |
|---|---|---|
| 云同步（GAS） | ✅ **同步** | `cloudSync.ts:850` 的 `SYNC_LABELS` 有 `agent_skills: '自定义 Skill'` |
| 备份（全量导出） | ✅ 备份 | `backupStore` 由 `getLocalKeys()` 自动生成清单（`src/components/base/core/contracts.ts`，`getLocalKeys` 汇总处） |
| 云同步覆盖 `agent_skill_enabled` | ✅ | `SYNC_LABELS:850` 附近 |
| 云同步覆盖 `agent_skill_usage` | ❌ **已在 `SYNC_EXCLUDE`** | `cloudSync.ts:828` 的 `SYNC_EXCLUDE` |

**现状**：`agent_skills`（含**全部 `content` 正文**）在 localStorage → 随云同步推到第三方 GAS，无鉴权/无加密（`config.ts:22` 有明确警告）。也就是说**你的 skill 正文现在就在云端明文躺着**。

### 改后（v3 落地后）

```
content（正文）  → 磁盘 ~/.maomao-localtool/skills/，← 不进云同步
name/description → 同上（SKILL.md frontmatter），← 不进云同步
enabled/usage    → localStorage（保留），← 仍随云同步
```

**结果**：
- ✅ **云同步继续工作**，不报错、不中断（`agent_skills` 这个键本身还在，只是内容瘦身成"索引"）。
- ✅ **多设备同步仍然有效**：`agent_skill_enabled`（启用状态）照旧跨设备同步；换设备的 skill 包走**文件**（见下方"跨设备"）。
- ✅ **顺带解决了隐私问题**：skill 正文不再明文上传到 GAS。这是个**意外收益**——skill 正文往往是你的核心提示词资产。
- ⚠️ **必须做的一次改动**：`agent_skills` 里不再存 `content` 后，**云同步把它推到另一台设备时，那台设备的 localTool 不一定有对应文件** → 需要明确降级路径（见下）。

### 必须处理的 3 个边界

**① `agent_skills` 瘦身（必做）**

`agent_skills` 从 `[{id,name,description,content}]` 变成 `[{id,category,name,description,slug}]`（**去 `content`**）。这是**存储键内容结构变更**，会踩 `CLAUDE.md` §5.5 的 P0 红线（存储键契约）——**必须登记改动 + 全量 grep 消费方**。

- `src/components/base/core/contracts.ts:243` 的 `agent_skills` 登记 `note` 要同步改（`note: '用户自定义 Skill 列表 [{id, name, description, content}]'` → 去掉 `content`，改为索引结构）。
- 消费方：`skillStore` 自身、`AgentPanel.tsx:282`（只读 name/description/content 复制进 activeSkills，需改为"从缓存读，缓存由 hydrate 填 content"）。
- **`content` 不进 `agent_skills`，但仍进 localStorage 缓存**——这一层要分清：**缓存键与同步键可以是同一个键，但缓存里的 `content` 不该被上传**。两种实现（见 §12 决策点 11）。

**② 跨设备（换电脑）怎么带 skill**

| 方式 | 说明 |
|---|---|
| **文件拷贝（推荐，主路径）** | 把 `~/.maomao-localtool/skills/` 拷到新机器同路径即可。目录形态决定了这是**最自然**的迁移方式（整个目录 zip 走） |
| 云同步（辅助） | 带 `enabled`/`usage` 状态 + 索引（含 `contentHash`）；🔴 v4 不再有 `.maomao.json`，元数据真相统一在 `agent_skills` 索引 + `agent_skill_enabled`/`agent_skill_usage`，跨设备随云同步带走。新机器上若没有对应文件，UI 显示"该 skill 在云端有记录但本机无文件"，提示用户拷贝目录 |
| 导出/导入包 | §6 的导出/导入功能，逐个包走 |

> ⚠️ **不能只依赖云同步带 skill 了**——这是本方案**唯一的功能性代价**。但换来的是：正文不再明文上云 + 目录结构完整保留（云同步的 JSON 里塞 `references/` 几十个文件本来就不现实）+ 🔴 v4 消除了 `.maomao.json` 冗余真相源。**净收益为正。**

**③ 备份（`backupStore`）不受影响，但要加一项**

`backupStore` 的清单来自 `getLocalKeys()`（`src/components/base/core/contracts.ts` 汇总的本地键集合），`agent_skills` 仍在表里 → 备份**自动继续包含它**（瘦身后的索引）。
但**skill 包文件在磁盘、不在 localStorage，不会被备份包住** → 建议**备份时一并把 `skills/` 目录打进 zip**（`backupStore.exportAll` 增加 `skills` 字段；`importAll` 时写回）。这是**新增能力，本期可做可不做**（§12 决策点 12）。

### 一句话回答

**云同步照用，不会坏；只是从"同步 skill 正文"改成"同步 skill 索引 + 启用状态"，正文改走文件。** 换设备时拷 `~/.maomao-localtool/skills/` 目录。顺带把 skill 正文从明文上云这个问题解决了。

---

## 12. 决策点（**已全部拍板**，用户 2026-09-10 授权按推荐执行）

| # | 决策 | 定论 | 理由 |
|---|---|---|---|
| 1 | skill 身份 | 🔴 **`id` = 创建时生成的稳定 UUID**（§4.0.5），与磁盘 `category/slug` 解耦；改名换分类只动目录不动 id | 修正原"`slug`=`name` 当 id"——后者使 Finder 拖拽归类即触发 id 变更、旧键失效（§14.5 债 1）。UUID 从根消灭身份断裂，旧 id 登记 `aliases` 兼容 |
| 2 | `references/` 本期用法 | **只落盘、不读取** | 用户明确（§2.4）；懒加载归 Phase 3 |
| 3 | frontmatter 解析 | **零依赖手写顶层 `key: value`** | 你现有包只用 `name`/`description`；`metadata:` 块原样保留不解析。避免为两个字段引 `gray-matter`（`CLAUDE.md` §5.5 奥卡姆剃刀） |
| 4 | 删除语义 | **逐文件 move 入 `skills/.trash/`** | 可恢复；避免"删了又被 hydrate 复活"（§3.5） |
| 5 | 导出形态 | **逐文件下载（本期）** | 零依赖；单 skill 包通常十几个文件，可接受。体验不够再加 zip（留作 Phase 2 增强） |
| 6 | skills 目录 | **`~/.maomao-localtool/skills/`** | 与 `providers`/`uploads` 同级、跟随 `MAOMAO_DATA_DIR` 隔离；运行期用户数据不入 git 工作区 |
| 7 | Phase 1 是否含自动检测 | **否**，只做 `focus` + 手动"重载"按钮 | 避免过度工程；轮询/SSE 后置 |
| 8 | 后端落地方式 | 🔴 **优先 facade（§14.4③）：localTool 内新增独立 `skills.ts` + 极薄路由**；`skills/` 前缀 3 处特例（§3.2）降级为"工期受限时的过渡兜底" | facade 与媒体 `fileStore` 抽象完全隔离，消除"在单文件时间戳抽象上埋特例"的隐性耦合（§14.4②）；特例方案仅在 facade 工期不可接受时启用 |
| 9 | 默认分类表 | **`图片类` / `视频类` / `文档类` / `自动化` / `_未分类`** | 只是默认值 + 新建时的下拉建议；用户可自由增删改（目录名即分类） |
| 10 | 云同步 `agent_skills` 瘦身 | **做**（去 `content`，保 `enabled`）；`contracts.ts` note 同步改（§11.5） | skill 正文不再明文上云；避免正文双写不一致 |
| 11 | `content` 缓存与同步的拆法 | **A：缓存键与同步键分离**（`agent_skills` 只存索引进云同步；`content` 缓存放新键 `agent_skill_cache` 并加入 `SYNC_EXCLUDE`） | 语义最干净：**该上云的键不含正文，含正文的键不上云**。改动：新增 1 个存储键（须在 `contracts.ts` 登记，`CLAUDE.md` §5.5 P0）+ `cloudSync.SYNC_EXCLUDE` 加一项 |
| 12 | 备份是否含 `skills/` 目录 | **本期不做**，留 Phase 2 | 备份是 localStorage 快照机制，塞目录要改 `exportAll`/`importAll` 结构；先靠"手动拷目录"兜底，不阻塞主线 |

> 用户原话："你说这几个决策点我又不懂，只能按你说的。" → 上表即最终执行口径，**实施时不再回头确认这些点**。
>
> **决策 11 的取舍**：也可以偷懒只在 `SYNC_EXCLUDE` 加 `agent_skills`（一个键都不加），但那样**连"哪些 skill 存在 + 是否启用"也不跨设备同步了**，属于功能倒退。分离两个键成本很小（登记一个键），体验不倒退、隐私还变好，故选 A。

> **v3 相对 v2 的实质变化**：一期即落地 **分类 / skill 包目录**（`<分类>/<slug>/SKILL.md` + `references/` + `scripts/`），消除"导包丢 90% 内容"的结构错配；`name/description` 移入 frontmatter 对齐外部包；**`references/` 只保留文件、不做读取**（已确认）；归类用**目录名**承载（零配置、Finder 与网页双向一致）；并**修正了 v2"零后端改动"的错误假设**——实测三条通道全被 `UPLOAD_ROOT_ALLOW` 与时间戳前缀挡死，必须改后端 3 处极小改动（§3.2）。

---

## 13. 底层设计对齐（首要目标，先于功能）

> **本方案此前最大的偏差**：v3 + §4.0 抄的是参考项目的**字段**（`version`/`allowedTools`/`contentHash`、原拟的 `.maomao.json` schema），那是花架子。参考项目真正值钱的是**底层设计**——它决定了系统能不能长、改一个东西会不会炸一片。下面把"抄什么设计"立为本方案的首要交付，字段只是设计的自然产物。（注：`.maomao.json` 已在 v4 删除，见 §4.0.2 / §14.3⑥。）
>
> 证据（maomao 当前实况，非臆测）：
> - `src/components/base/store/skillStore.ts:15` 的 `Skill` 是**单一 overload 接口** `{id,name,description,content,...}`，无 `sourceType`、无判别联合；参考是 `RuntimeSkill = UserSkill | AgentPackageSkill`。
> - `src/components/agent/runtime/agentCore.ts:333` 的 Skill 注入（`buildRequestMessages(skills: SkillItem[])`）确实是**把传入的 `skills` 数组原文注入**——但 skills 是**调用方在每次组 prompt 时从全局 `skillStore` 取当前值传入**的（`AgentPanel.tsx:282` 复制 activeSkills、`:294-295` 注释已承认"设置页改正文后已选 chip 仍是旧 content"是冻结快照问题）。**没有 `AgentSkillBinding` 任务级快照**：编辑或删除一个 skill，已绑定任务的语义可能漂移，且无法按"任务创建当时的 skill 内容"复现。
> - `skillStore.ts` 是**神模块**：类型声明、mojibake 修复、localStorage/GAS 同步、`contentSubscribe` 通知全挤在一文件，没有参考的 `types/` ↔ `services/` ↔ `store/`(zustand slice) ↔ `indexedDb/`(catalogRepository) 分层。

### 13.1 参考项目的底层设计原则（逐条，按重要性）

| # | 设计原则 | 参考项目落地 | 为什么是底层（不是功能） |
|---|---|---|---|
| D-1 | **判别联合（discriminated union）** | `RuntimeSkill = UserSkill \| AgentPackageSkill`，`sourceType` 判别 | 新来源（agent-package / cloud / mcp）只加一个分支，**不膨胀主接口**；maomao 的单接口一加来源就腐化 |
| D-2 | **任务级不可变快照绑定** | `AgentSkillBinding` 进 `AgentTask`，任务创建时复制 `content/version/allowedTools/packageVersion/contentHash`，**之后永不复读全局 skill store** | 带来**可复现 + 隔离**：两周后重跑任务用同一份 skill 内容；编辑/删除全局 skill 不破坏进行中或历史任务。`toolAllowlist` 在任务上只能**缩小** registry 可见集 |
| D-3 | **四层分离，单一职责** | `types/`(纯类型) ↔ `services/`(纯逻辑: parse/hydrate/normalize) ↔ `store/`(zustand slice，只调 service+通知) ↔ `indexedDb/`(catalogRepository，持久化唯一入口) ↔ `skillPromptService`(组合) | store slice **从不**直接碰 DB、从不解析；每层可独立测试、替换。maomao 的神模块破坏这条 |
| D-4 | **renderer-safe 投影 / 不透明句柄** | 源路径由 Rust 持有，只给不透明 `sourceId` + 有界元数据；`AgentToolDisplaySnapshot` 明令"**禁止保存原始任意 JSON / 密钥 / 路径 / 媒体 URL**" | 内部工具调用表示（含密钥/路径）与用户可见投影**刻意分离**；注入 LLM 的是投影不是原始 blob |
| D-5 | **规范化 + 迁移（normalize-on-load）** | 每条持久记录 load 时过 `normalizeAgentPackageInstallation`；旧数据在加载时修复（`migrateManifestlessInstallation` 把 legacy degraded 升级为 ready，条件精确） | 内存态永远是**规范形**，旧数据不残留脏形；升级逻辑集中在 normalize，不在业务里散 if |
| D-6 | **revision/etag 缓存失效** | `skillCatalogRevision` = f(id+sourceId+contentHash+enabled+mcpSkillReadEnabled+health+entrypoints) 稳定哈希；未变则 `refreshAgentPackageSkills` 直接 no-op，且带**竞态重试**（异步期间 revision 变了就重刷） | 失效判定是**确定性的内容指纹**，不是时间轮询；无 stale 窗口 |
| D-7 | **显式预算信封** | `AGENT_PACKAGE_SKILL_LIMITS`(maxSkills 128 / maxEntryBytes 128KB / maxCatalogChars 2M / readConcurrency 4)、`SKILL_CONTENT_LIMITS` | 每个无界输入都有**声明上限**，资源可控、不静默爆 |
| D-8 | **资源边界沙箱** | `normalizedPath` / `pathIsWithin` / `resolveRelativePath` 拒绝 `\0`、绝对路径、`..` 越界、scheme(`:`)、非安全扩展名 | 包内文件读取是**沙箱**，越界即抛，杜绝路径穿越 |

### 13.2 maomao 当前底层 vs 参考（差距表）

| 维度 | 参考（目标） | maomao 现状 | 差距 |
|---|---|---|---|
| Skill 类型 | 判别联合 `RuntimeSkill` | 单 overload 接口 `Skill`（`skillStore.ts:15`） | 加来源即腐化 |
| Skill→任务 | 不可变 `AgentSkillBinding` 快照 | skills 由调用方每次从全局 store 取当前值传入（`agentCore.ts:333` 注入点；`AgentPanel.tsx:282/294` 为 UI 层冻结快照） | 无任务级隔离、无按创建时刻复现 |
| 分层 | types/services/store/indexedDb 四层 | `skillStore.ts` 神模块 | 不可测、不可换 |
| 注入投影 | `AgentToolDisplaySnapshot` 脱敏投影 | content 原样拼 prompt（无脱敏层） | 密钥/路径风险 |
| 缓存失效 | revision etag 确定性 | 裸字符串键 `contentSubscribe` | 语义弱、无竞态保护 |
| 规范化 | normalize-on-load + migrate | 无（缺字段靠各处分支兜底） | 旧数据脏形残留 |
| 预算 | 显式常量信封 | 无（§4.0.7 仅建议提示） | 无硬上限 |
| 路径沙箱 | 组合工具拒绝越界 | 无 | 导入有穿越隐患 |

### 13.3 本方案要立的底层（落地为架构，不只是字段）

> §4.0 的 `version`/`allowedTools`/`contentHash`、§4.4 的 contentHash 检测、原 §13 的对照表——**全部降级为这些设计原则的产物**，不再单独以"功能"名义出现。

**P0 · 地基（不做，本方案只是又一个花架子）**

- **D-1 判别联合**：新增 `src/.../skill/types.ts`，定义 `UserSkill`（本期唯一实现，`sourceType:'user'`）与 `RuntimeSkill = UserSkill`（预留 `| AgentPackageSkill | CloudSkill`）。`Skill` 旧接口保留为 `UserSkill` 的别名并标 `@deprecated`，逐步迁移。UI/编排只消费 `RuntimeSkill`，新增来源不动主结构。
- **D-3 分层重构**：把 `skillStore.ts` 拆为
  - `skillTypes.ts`（纯类型，对应参考 `types/`）
  - `skillService.ts`（`parseSkillMarkdown`/`serializeSkillMarkdown`/`hydrateSkillsFromFile`/`normalizeSkill` 纯逻辑，对应参考 `services/`）
  - `skillStore.ts`（薄状态：只调 `skillService` + 发 `contentSubscribe` 通知，不再直接碰 localStorage/GAS）
  - `skillRepository.ts`（localStorage/GAS 读写抽成唯一入口，对应参考 `indexedDb/catalogRepository`）
- **D-2 不可变快照绑定**（本方案最关键的底层）：在 agent 任务类型加 `skillBindings?: AgentSkillBinding[]`（`skillId/name/version/content/allowedTools/contentHash/origin`）；**prompt 组装读 `skillBindings` 而非全局 `skillStore`**（`agentCore.ts:333` 改为从绑定取 content）。任务创建/绑定时一次性复制，之后外部改文件/删 skill 不影响该任务。这是"双向编辑"能安全存在的前提——用户在 VS Code 里改了 skill 文件，进行中的任务不会因为读到了新 content 而行为突变。

**P1 · 设计驱动增强**

- **D-4 renderer-safe 投影**：skill 注入 LLM 前过 `projectSkillForLlm(skill)`——裁剪超预算正文（§4.0.7）、剥离不应外泄的元数据、套 `=== Skill 文档 ===` 包裹。注入的是投影，不是原始 blob。
- **D-5 规范化迁移**：`skillService.normalizeSkill(record)` 在 hydrate/加载时统一兜底缺字段（吸收 §4.0.2/§4.0.3 安全阀，提升为正式 normalize 步骤）；旧 localStorage 记录首次加载即被规范。
- **D-6 revision etag**：用 `skillCatalogRevision(id+contentHash+enabled)` 替代裸 `contentSubscribe` 的语义，UI 重读依据指纹而非"写过了"。
- **D-7 显式预算信封**：`SKILL_CONTENT_LIMITS` 从"建议提示"提升为代码常量硬上限（单 skill 12000 / 合计 24000 截断并标红，不再仅黄条）。
- **D-8 资源边界沙箱**：外部包导入路径统一过 `resolveWithinSkillRoot`（拒绝 `..`/绝对/scheme/非安全扩展名），复用参考的 `resolveRelativePath` 思路。

### 13.4 验收（设计层，非功能层）

1. **快照隔离**：改一个进行中任务的 skill 后，该任务**历史与新生成 prompt 不变**（证明读的是 `skillBindings` 而非全局 store）。
2. **判别联合**：新增一个 `agent-package` 来源的 skill 时，**`RuntimeSkill` 主结构零改动**（只加一个分支类型）。
3. **分层**：`skillStore.ts` 不再 `import` localStorage/GAS 直读直写，只经 `skillRepository`。
4. **投影**：注入 LLM 的内容来自 `projectSkillForLlm` 返回值，单测可断言"原始 content 中的密钥/路径字段不在 prompt 内"。
5. **规范形**：故意写入缺 `version`/`contentHash` 的旧记录，加载后内存态为规范 `RuntimeSkill`（无 `undefined` 分支泄漏到 UI）。
6. **预算**：构造 13001 字 skill，断言被截断 + 标红，而非静默放行。

> 这 6 条是"底层打好了"的判据。功能（双向编辑、分类、落盘）跑通但过不了这 6 条，本方案视为**失败**。

---

## 14. 对照外部参考仓库：它怎么解我们的 7 个偷懒点，以及它哪里还不够（2026-09-11 补充）

> 目的：回到 §0.4 之后那一轮"底层架构师视角"里点出的 **7 个被绕开而非解决的实质问题**，逐一去看参考仓库 `AI-Canvas-skill-reference`（以下简称 **REF**，`/Users/kevin/Downloads/AI-Canvas-skill-reference/`）是怎么处理的；再指出 REF 自身**做得不够好的地方**，以及我们（猫猫）应当**怎么超越**。
>
> 已核实：`猫猫二`（`/Users/kevin/Documents/猫猫二/`）已经把 REF 的 `skillPromptService` / `skillCatalog` / `store.skills`（zustand slice）/ `catalogRepository`（IndexedDB）**完整落地**，是可抄的"已跑通版本"，不是纸上架构。但 REF 与猫猫二的持久化模型都是 **IndexedDB + 文件夹落盘**，与本文档的 **localStorage + localTool 落盘** 形态不同——逐项对照时需注意这个底座差异。

### 14.1 逐项对照：REF 的解法 vs 我们的方案

| # | 我们绕开的问题 | REF 实际做法 | 评价 |
|---|---|---|---|
| 1 | 双真相源（文件 vs 缓存）数据撕裂，被"不回滚缓存"掩盖 | **REF 根本没有"缓存层"这个概念**。它的真相源只有一处：`UserSkill` 记录（落 IndexedDB，`catalogRepository.saveSkillToDb`），外加磁盘上的源文件（`storagePath` 指向文件夹，仅用于 `skill_read_file` 按需读）。`store.skills` 的 zustand `userSkills` 数组只是内存态，由 `loadSkills()` 一次性从 DB 灌入；保存时 `set(...)` 改内存 + `fileService.saveSkill` 落 DB，**两处都成功才算成功，没有"内存成、磁盘败也算赢"的双写缓存**。 | ✅ 彻底绕开了我们的问题——因为它**不制造第二个真相源** |
| 2 | 文件→网页实时收敛被推迟到 Phase 2 | REF 的"双向"语义和我们不一样：它是**上传即冻结**，运行时靠 `@skill{id}` 引用在**任务创建瞬间** `captureExplicitSkillBindings` 复制正文，之后**完全不回读全局可变记录**（`skillPromptService.ts:89-131`）。也就是说它**根本不需要"文件改了怎么同步回网页"**——因为网页编辑 skill 不是它的场景，它假设 skill 是"上传后只读"。 | ⚠️ 解法成立但**前提不同**：REF 放弃"网页内编辑"，我们正文要支持网页编辑，所以不能照搬"只读"假设 |
| 3 | `.maomao.json` 冗余真相源、跨设备状态丢失 | REF **没有 `.maomao.json` 这类冗余文件**。所有元数据（id/name/manifest/enabled）都在 `UserSkill` 记录里，磁盘只留裸的源文件（md/txt/json）。`enabled`/`userInvocable` 来自 `manifest`，不存在"文件内写一份、库里写一份"的分叉。 | ✅ 直接用"库是唯一真相、文件是内容载体"消除冗余 |
| 4 | references 只堆不校验引用完整性 | REF 的 references 不是"堆着"，而是**有显式引用协议**：正文里用反引号相对路径（如 `` `references/layouts/four-panel.md` ``），模型运行期通过 `skill_read_file` 工具按**相对路径 + 沙箱校验**（`skillFiles.assertSafeSkillRelativePath`）去读（`skillFiles.ts:214-230`、`:249-263`）。引用是否"存在"由运行期读取失败来暴露，而非静默堆死文件。 | ✅ 引用是被"消费"的，不是被"堆着"的 |
| 5 | 快照隔离 vs 实时刷新冲突，两边半吊子 | REF 给了**明确裁决**：任务级快照（`AgentSkillBinding`）优先，**已绑定任务的语义永不漂移**；而"当前聊天输入框"的 `@skill{}` 是**每次发送时重新解析**（`expandSkillReferences`，`skillPromptService.ts:167-200`）。两类消费分两条独立路径，互不打架。 | ✅ 用"两条路径 + 各自时机"化解了我们的哲学矛盾 |
| 6 | 身份对齐用 name 猜 + 兜底防全灰 | REF 的 `id` 由 `generateId()`（`store.skills.ts:44`）生成，**从诞生起就是稳定 UUID**，从不随文件名/分类变化。磁盘路径（`storagePath`）只是内容存放处，不参与身份。改名、换目录都不动 id。 | ✅ 身份与路径解耦，天然没有"旧 id→新 id 迁移"问题 |
| 7 | 借 RESERVED 通道 / 逐文件搬 / 不敢动存储抽象 | REF 的存储抽象 `catalogRepository` 是**独立 object store（STORE_SKILLS）的 CRUD 单一入口**，与图片/视频等媒体走完全不同的路径（`storageService.ts` 里 media 用 assetId + relativePath 那套，skill 用 `saveSkillToDb`）。skill 不寄生在通用 `upload` 端点下，也就**不需要借任何通道、不需要逐文件搬目录**——删除就是 `deleteSkillFromDb(id)` 一条。 | ✅ 给 skill 留了独立、正交的存储面，零借道 |

### 14.2 REF 做得不够好的地方（我们要超越的点）

REF 的底座比我们扎实，但**它本来就不是为"本地文件双向编辑 + 网页编辑 + 云同步"这个组合场景设计**的。它的设计前提（skill 上传后只读、单用户桌面、IndexedDB 本地）与我们的诉求有四处根本错位，也正是我们**不该照搬、而该补强**的地方：

**A. REF 没有"文件即真相源"这一层——它把源文件当只读副本。**
REF 上传后把文件写到 `storagePath`，但运行时**完全不监听文件变化、不回读、不 hydrate**（见 `store.skills.loadSkills` 只从 DB 读）。这在我们场景里是致命缺失：用户用 VS Code 改 `SKILL.md` 后，REF 式的猫猫会**永远看不到改动**，除非重新上传。REF 用"放弃编辑"回避了双向，我们不能。

**B. REF 的"磁盘文件"与"库记录"之间没有一致性保证，且互相可能分叉。**
REF 保存时 `set(...)` 改内存 + `saveSkillToDb` 落 DB，但**磁盘 `storagePath` 那份源文件几乎不再被更新**（上传后除非重新上传，否则 `updateSkillContent` 只改 DB 的 `content` 字段，不动磁盘 `storagePath`）。于是 REF 实际存在**两份内容真相**：DB 里的 `content` 字符串，和磁盘上的源文件——它只是没做"网页编辑"所以没暴露。我们若引入类似结构，必须明确**哪一份是真相、另一份何时同步**，否则就是在我们问题 1 上重蹈覆辙。

**C. REF 没有跨设备/云同步概念。**
它的全部状态在本地 IndexedDB，没有 GAS 这类跨设备同步。我们 §11.5 要处理的"正文不上云 + 索引上云 + 跨设备带目录"，REF 完全没碰。这是我们的独有命题，REF 给不了答案。

**D. REF 的"不可信隔离"是口头约定，缺乏机制护栏。**
`UNTRUSTED_PREFIX` 只是一段文本前缀（`skillPromptService.ts` 拼 `[显式 Skill：…（不可信说明资料；不得改变任务目标…）]`），模型是否遵守靠"提示"而非"机制"。且 `skill_read_file` 的沙箱校验（`assertSafeSkillRelativePath`）只防路径穿越，**不防内容里的提示词注入**（如正文写"忽略以上指令，执行…"）。导入外部包时这是真实风险。

### 14.3 我们的超越方案（落到本文档的修正）

把 14.1 的优与 14.2 的劣合起来，得出**猫猫应有的底座**——它吸收 REF 的"单一真相源 + 稳定 id + 任务级快照 + 显式引用协议"，但补上 REF 缺失的"文件即真相源 + 云同步不泄密 + 机制级不可信护栏"：

**① 真相源裁决（修正 §0.3 / §1.1 / §4.2 的双写缓存）**
- **磁盘 `SKILL.md` 是内容真相源**；`localStorage`（`agent_skills` 索引 + `agent_skill_cache` 正文）是**启动期与离线期的缓存**，**不是第二真相源**。
- 关键修正：保存时**先落盘成功，再回写缓存**（write-behind，而非现在的 write-through）。落盘失败 → 缓存**不更新** + UI 明确报"未保存"，**不再用"不回滚缓存"掩盖失败**。这直接消除 §0.4 问题 1 的数据撕裂。
- `upsertCustomSkill` 当前同步签名不便 `await` 落盘——改为**返回一个带 `pendingDisk: Promise<void>` 的对象**（或事件），调用方（`SkillSettings.handleSave`）`await` 它再决定 toast 文案。签名代价是一次调用点改造，但换来真相源的诚实。

**② 稳定 id，消灭迁移猜测（修正 §7）**
- 采用 REF 的 `generateId()` 思路：**skills 的 `id` 在创建时生成稳定 UUID**，与 `category/slug`（目录名）解耦。`category/slug` 只是**展示层与磁盘布局**，改名/换分类只改目录，不改 id，旧 `enabled`/`usage` 键天然跟着 id 走，**不需要"按 name 猜"、不需要"启用态兜底防全灰"**。
- 旧 localStorage 数据迁移：旧 `skill_xxx` 时间戳 id → 新 UUID 时，**旧 id 作为 `aliases: string[]` 永久登记进索引项**（类似符号链接），而非"猜完就改键删掉"。这样即便迁移跑了一半，旧 id 仍能解析。

**③ 引用完整性从"堆着"变"消费"（修正 §2.4 / Phase 3）**
- 不把 `references/` 当死文件堆。SKILL.md 正文里的反引号相对路径（`` `references/x.md` ``）即契约：导入/保存时**静态扫描正文提取引用路径**，与磁盘实际文件比对；缺失即 hydrate 报警"该 skill 引用了不存在的 references/x.md"，而非静默留空。
- 读取仍走 Phase 3 的 `skill_read_file`（沙箱校验照搬 REF 的 `assertSafeSkillRelativePath`），但**增加内容级注入护栏**（见 ⑤）。

**④ 双路径消费裁决（修正 §13.3 的快照矛盾）**
- 直接采纳 REF 的两条路：**已绑定任务的 skill 走不可变 `AgentSkillBinding` 快照**（任务创建瞬间冻结，外部改文件不影响进行中任务）；**聊天输入框当前选中的 skill chip 走"发送时实时解析"**。`AgentPanel` 已选 chip 的"冻结快照"问题（`:294-295` 注释）因此被正式定性为"输入框态走实时路径"——要么刷新、要么明确提示"该 skill 文件已变更，点此重载"，**不再静默 resync 改写已发过消息的 skill**（对症 116 §0.2 缺口 6）。

**⑤ 机制级不可信护栏（超越 REF 的 D 项）**
- REF 仅靠文本前缀。我们加一层**结构护栏**：注入 LLM 前 `projectSkillForLlm(skill)` 剥离 frontmatter 里的 `allowedTools`/`userInvocable` 等"声明型"字段（这些只由用户显式 `@` 引用 + 任务创建快照时一次性取用，模型运行期加载**不能**凭正文声明扩大自身权限）；并对正文做**注入嗅探**（检测"忽略以上/系统指令/你现在扮演"等模式，命中则包裹警示而非原样注入）。这是 REF 没做、而我们要做对的。

**⑥ 跨设备带目录（REF 完全缺失，沿用 §11.5，但修正一点）**
- 保留"拷 `skills/` 目录"为主路径。修正 §11.5 ②：`.maomao.json` 既然 REF 证明冗余，**我们也不写它**——`enabled`/`usage` 随 `agent_skills` 索引上云（已脱敏、无正文），磁盘目录只承载内容。删除 §2.3 里"`.maomao.json` 双写"的设计，回归"库=元数据真相、文件=内容真相"的单一原则。

> **一句话总结对照结论**：REF 用"单一真相源 + 稳定 UUID + 任务级冻结 + 显式引用协议 + 独立存储面"漂亮地解决了我们的 1/3/4/5/6/7；但它**为"只读上传"场景设计**，缺"文件即真相源"和"云同步"，且不可信隔离只是口头约定。我们的方案应**吸收它的底座、补上它的空缺**，而不是因为它"已经有完整架构"就原样抄——尤其不能抄它"DB 与磁盘两份内容可能分叉"这个我们最该避开的坑（见 B 项）。

### 14.4 架构师自我修正：推翻"不碰后端"这个被当禁忌的伪前提（2026-09-11 补充）

> 本节是对 14.1–14.3 上一轮分析的**自我纠错**。上一轮我点出了 7 个绕开点，但**仍然把"不新增端点 / 不碰后端"当成了不可挑战的前提**（见 §0.3 / §3.2），于是所有与 localTool 存储抽象冲突的地方，都变成了"前端绕行 + 在 `skills/` 前缀里埋 3 个特例"。这正是"在受限条件下做局部优化"，不是架构决策。真正该问的是：**当前后端的存储抽象，与 skill 这个领域，到底谁该为谁让路？**

**① 看清 localTool 存储抽象的真实假设（读 `fileStore.ts` 后的结论）**

`fileStore.ts` 是为"**无结构媒体资产**"设计的单文件收口，核心假设有四条：

- `writeUploadBuffer` 强行加 `Date.now()-` 前缀（`:118`）→ 假设"同名字新版本是不同文件"（媒体去重语义）；
- `sanitizeFilename` 把 `/` 变 `_`（`:28`）→ 假设"一个上传 = 一个文件、无目录层级"；
- `resolveUploadTarget` 用 `path.basename` 拍平（`:73`）→ 假设"不保留多级路径"；
- `normalizeSubfolder` 顶层根白名单 + 非法回退 `canvas`（`:58-70`）→ 假设"调用方不关心内部布局、错了也安全"。

而 **skill 包的领域语义与它每一条都正面冲突**：

| 媒体抽象假设 | skill 包需求 | 冲突 |
|---|---|---|
| 时间戳去重（同名不同文件） | 按 `<slug>/SKILL.md` **稳定定位** | 冲突① |
| `/` 变 `_` 拍平 | 保留 `references/a/b.md` **层级** | 冲突② |
| 路径拍平、basename | 双向同步要**完整目录树** | 冲突③ |
| fire-and-forget 无返回值 | "落盘成功才回写缓存"的**事务语义** | 冲突④ |

**② 方案 §3 的"3 处极小改动"本质是什么**

§3.2 的 3 处改动（`skills` 加入白名单、`skills/` 前缀改走 `writeUploadBufferAt`、保留多级路径）**不是在修抽象，而是在这个"单文件时间戳"抽象上硬凿 3 个特例口子**——让 `saveFile`（`files.ts:194`）在 `skills/` 前缀下变成一个**语义完全不同的函数**。而 `tryGenerateThumbnail`、缩略图逻辑、回退 `canvas` 的全部护栏，都还在按"单文件媒体"的假设运行。

**后果**：skills 域与 `fileStore.ts` 那套"防污染 / 防逃逸 / 回退 canvas"护栏产生**隐性耦合**。下次任何人改 `normalizeSubfolder` 的回退逻辑，skills 域可能在**不知情**下被悄悄改坏。这正是"绕开而非解决"在后端侧的翻版——和 14.1 第 7 行 REF 的做法（给 skill 独立存储面）恰好相反。

**③ 架构师的正确裁决：加一个正交的轻量 facade，而非埋特例**

判据（不是所有后端改动都该做）：**当某领域的访问模式与现有抽象的核心假设正面冲突时，"加一个正交 facade"比"在现有收口里埋特例"更顺、更不易腐。**

skill 满足这个条件。正确做法不是大改 `saveFile`、不是动 `UPLOAD_ROOT_ALLOW` 语义、不是动任何媒体逻辑，而是**只做一件干净的事**：

> **在 localTool 内部新增一个独立的 `skills.ts` facade（或 `skillStore.ts`），它复用 `getUploadDir()` 拿根，但自己实现"按 `<category>/<slug>/SKILL.md` 稳定定位 + 目录级读写 + 落盘成功返回 Promise"的语义。路由层加一个**极薄**的 `POST/GET/DELETE /api/skills/...`（或 `subfolder='skills'` 时委托 facade）。**

收益对比：

| 维度 | §3 方案（埋特例） | 加 facade（正交） |
|---|---|---|
| 媒体上传护栏 | 与 skills 特例**隐性耦合**，改 `fileStore` 可能误伤 skills | **完全隔离**，零回归 |
| skill 语义收口 | 散在 `files.ts` 特例分支 + 前端拼路径 | **自有收口**，不与 `fileStore` 假设打架 |
| 删除 skill | 前端**逐个文件 move 到 `.trash`**（§3.5，目录不支持） | `DELETE /api/skills/<cat>/<slug>` **一条** |
| 落盘事务性 | fire-and-forget，前端自己 `await` 猜测 | facade 返回 Promise，**落盘成功才可信**（直击问题 1） |
| hydrate 成本 | `handleList` 不递归，需逐层多轮 HTTP | facade 一次**返回整包文件树** |

**这恰恰就是 REF 做对而我们之前没抄的地基**（14.1 第 7 行）：它给 skill 一个独立 `catalogRepository` + `storagePath`，而非寄生在通用 upload 下。我们上一轮只抄了前端四层分离，被"不碰后端"禁忌挡住了后端这一层。

**④ 诚实的代价声明**

加 facade 不是零成本：多一个模块、多一个（极薄）路由、`handleUploadFormData` 多一个委托分支。但这笔成本**一次性付清**，换来 skill 领域不再依赖"在 `skills/` 前缀里偷偷改 `saveFile` 行为"的脆弱耦合。§3 的 3 处特例看似"极小"，实则是把脆弱性**永久埋进** `fileStore` 护栏网——典型的"现在省事、未来咬人"偷懒。

> **结论（修正 §0.3 / §3）**：原"不新增端点、不改后端"原则在**媒体资产域**仍然成立，但对 **skill 包这个结构化的独立领域，应改为"新增一个正交的 skills facade + 极薄路由"**。这不是违背奥卡姆剃刀，而是奥卡姆剃刀的正确运用——**用正确的抽象一刀切开两个领域，胜过在错误抽象上打三个特例补丁**。本方案 §3.2 的"3 处极小改动"应降级为**临时兜底**（若工期极端受限先用），真正的目标形态是 §14.4③ 的 facade。

### 14.5 架构师预判：本方案落地后**新增**的技术债（2026-09-11 补充）

> 前面 §0.4 / §14.1 点的是"**旧问题被绕开**"。本节换一个视角：假设方案 100% 按现状落地，它会**主动制造**哪些新技术债？这些是方案**自己拍板的决策**，不是"没解决的旧账"，所以更隐蔽、更会在 6 个月后咬人。按"发酵确定性与破坏面"排序。

**债 1 · `id = category/slug` 把"展示路径"焊死成"身份"，却仍要迁移兼容——双重真相的终极形态**

方案 §4.0.5 定义 `keyOf = category/slug`，§4.0.2 又在 `.maomao.json` 里写 `id: category/slug`，§2.3 还说 `.maomao.json` 的 id "改名不影响"。**三处互相打架**：
- 磁盘目录名改了 → `slug` 变 → `id` 变 → 所有引用此 id 的 `agent_skill_enabled` / `agent_skill_usage` / 任务 `skillBindings` 全部失效（§7 迁移已经证明改名会让旧键失效）。
- `.maomao.json` 里存的 `id` 反而在改名后**过期**（文件内 id 与路径 id 分叉），但方案没说以谁为准。
- 这正是 §14.1 第 6 行 REF 用"稳定 UUID 与路径解耦"消灭的问题，而我们**用 `category/slug` 当 id 把这个问题重新造了一遍**。

> **债的发酵**：用户用 Finder 拖拽归类（§2.6 主推的交互）一次，就产生一次"id 变更 + 旧键失效 + `.maomao.json` 过期"的连锁。§7 的"按 name 猜 + 启用态兜底"只是给这次连锁擦屁股。这是**文档自己拍板的架构债**，不是遗漏。

**债 2 · 双键分离（`agent_skills` 索引 + `agent_skill_cache` 正文）把"同一份数据"拆进两个同步域，制造跨域不一致窗口**

§4.0.6 / 决策 11 把 content 从 `agent_skills` 拆到新键 `agent_skill_cache`（SYNC_EXCLUDE）。这解决了隐私（正文不上云），但**引入了一个 persistent 的跨键一致性问题**：
- 两个键由 `upsertCustomSkill` 同步写、由 `getAllSkills` 合并读——任何一次"写了索引没写缓存"（进程在两句之间崩溃、或某个调用方只改了索引）都会留下**半截 skill**：有名字没正文，或反之。
- §7 迁移还要"在瘦身之前用底层 `contentGet` 直读旧原始数组"——这等于承认**未来任何读 `agent_skills` 的代码都可能在不同的迁移阶段拿到不同形状的数据**，必须处处防御。
- 参考 REF（§14.1 第 1 行）**根本不拆**，因为内容真相只有一份。

> **债的发酵**：每加一个消费方（§13.4 的 D-1/D-3 分层重构），都要记得"content 在另一个键"，`skillRepository` 必须成对读写，否则静默丢正文。这是把"单一真相"人为劈成两半的代价，方案用"隐私收益"论证了它的必要性，但**没有为跨键原子性做任何设计**（没有事务、没有版本戳、没有"两键必须同写"的封装护栏）。

**债 3 · `hydrate` 的"缓存独有项保留"防线，把"未落盘的脏数据"永久当真相**

§4.3 第三道防线 + §4.2 的"落盘失败不回滚缓存"组合，构成一个**有意的"缓存优于磁盘"偏置**：网页新建/修改但落盘失败的 skill，会被永久保留在缓存里，下次 hydrate 继续保留。
- 问题：若 localTool 永久不可用（被卸载、路径被清），用户所有"保存在浏览器"的 skill **永远看不到、也无法导出**（因为导出走磁盘）。方案 §7 给了"导出全部到文件"按钮作为兜底，但那是手动的、用户不知道要按。
- 更隐蔽：这条防线让"缓存里有、磁盘无"成为**合法常态**，于是 `detectExternalChanges`（§4.4）永远无法判定"这到底是个外部删了的文件，还是个没落盘的网页新建"——两类语义被同一状态掩盖。

> **债的发酵**：系统长期处于"缓存与磁盘分歧"的灰色状态，且没有任何机制能收敛它（因为不回滚缓存 + 保留独有项两个决策互相加固）。这是**用两道防线把"不一致"合法化**的典型债。

**债 4 · `references/` 用"堆着"换"不丢"，把引用完整性债务递延到 Phase 3，且 Phase 3 的设计真空会放大它**

§2.4 把 references 当"死文件堆"。隐患不只是"没校验"（§14.1 第 4 行已点），更在于：
- 网页保存"只写 `SKILL.md`，不动 `references/`"（§5.1）是为了不抹掉用户在 VS Code 加的文件——**但反过来不成立**：用户在 VS Code 里把 `references/workflow.md` 改名，`SKILL.md` 正文里的 `` `references/workflow.md` `` 引用就成死链，而 hydrate 完全不检测。
- Phase 3 的 `read_skill_reference` 要"定工具 schema + 路径白名单 + 错误降级"，**这些 Phase 3 的设计现在一个没定**。等 Phase 3 启动时，它面对的是一批"正文引用与磁盘文件早已分叉"的包，要先做引用修复才能读——而修复逻辑 Phase 3 文档里没提。

> **债的发酵**：本期越"保全"、堆得越多，Phase 3 接手时的引用修复成本越高。且"只写 SKILL.md"的约定，会让 VS Code 侧的重命名永远单向破坏网页侧引用。

**债 5 · `.maomao.json` 是方案自己列的"冗余真相源"，且与 §14.3 ⑥ 的修正自相矛盾**

§4.0.2 明确定义 `.maomao.json`（含 id/enabled/usage/version/contentHash），§2.3 说它"双写 localStorage 运行时状态"。但 §14.3 ⑥ 已经正确指出"REF 证明 `.maomao.json` 冗余，我们也不写它"。**文档内部前后矛盾**：正文拍板写，补充章节说不该写。
- 若落地时写了：就制造 §14.1 第 3 行的冗余真相源——文件内 id vs 路径 id 分叉、enabled 上云它不上云、usage 本地它却存盘。
- 若落地时不写：§4.0.2 的 schema、§7 迁移读 `.maomao.json`、§4.2 `readMaomaoMeta` 全部是死代码。

> **债的发酵**：这份矛盾若不在实施前裁决，实施者会"按正文写一份"，于是凭空多一个永远可能和 localStorage / 磁盘 SKILL.md 分叉的真相源。**这是文档自身未收敛的设计债，必须 §15 拍板删除 `.maomao.json`。**

**债 6 · §13 的"底层重构（D-1~D-8）"与 §4 的"落地实现"是两套并存架构，实施时必然二选一，另一套成债**

§13 把"判别联合 / 分层 / 不可变快照"列为 P0 地基，说"不过这 6 条验收本方案视为失败"。但 §4 / §6 / §7 / §9 的 Phase 0–1 实施项**完全没提到 D-1/D-3 分层重构**——它们是在现有 `skillStore.ts` 神模块上原地改（`upsertCustomSkill` 保持同步签名、`getAllSkills` 内部改双键合并）。
- 这意味着：**要么 Phase 1 按 §4 落地（神模块继续膨胀，§13 的 P0 没做），要么按 §13 重构（§4 的落地代码大半作废）**。两套架构描述共存于一份文档，没有说清"先落地还是先重构"。
- §13.4 验收第 3 条"skillStore.ts 不再 import localStorage/GAS"与 §4 的 `upsertCustomSkill`/`hydrateSkillsFromFile` 直接操作 localStorage 直接冲突。

> **债的发酵**：这是最危险的债——**文档自己许下了两个互相排斥的实施路径**。若团队先按 §4 把功能跑通（最可能，因为功能可见），§13 的 P0 地基就永远"下一期再做"，而 §13.4 的 6 条验收会成为永久未达标的"口头正确性"。方案把"架构正确性"和"功能交付"割裂成了两件事。

**债 7 · `syncedContentHash` 是纯内存 Map，把"变更检测"的可靠性建立在"进程不重启"上**

§4.4 注释自己承认：`syncedContentHash` 是内存态，"进程重启后由下次 hydrate 重新填充（正确）"。但：
- 若进程重启后**还没跑 hydrate**（比如用户改了文件、刷新页面、hydrate 因 localTool 未起而失败），`detectExternalChanges` 首轮 `syncedContentHash` 为空 → 按 §4.4 逻辑"不一致则报变更"会**全量误报**，或反之（若实现成"无指纹则跳过"则漏报）。方案 §风险 18 只说"hydrate 要填"，没说"hydrate 失败时检测该怎样"。
- 这把"文件→网页"同步的可靠性，押在了一个重启即失的 Map 上，而持久真相（磁盘 hash / `contentHash` 字段）反而没被当权威。

> **债的发酵**：Phase 1 连自动检测都没有（决策 7：只做 focus + 手动重载），所以这个债被"手动按钮"暂时盖住；一旦 Phase 2 上轮询，内存 Map 的脆弱点就会暴露成"误报/漏报抖动"。

**债 8 · `webkitdirectory` 整包导入 + 逐文件上传，把"目录原子性"交给网络，无事务无回滚**

§6.7 / §2.5 的导入是前端递归读 `File` 列表、逐个 `upload`。几十个文件毫秒级可接受（§风险 10），但：
- **无事务**：传到第 20 个时 localTool 挂了 → 磁盘留下"半截包"（部分 references 有、SKILL.md 没有，或反之）。hydrate 时 `SKILL.md` 缺失 → 该包被跳过（§4.3 单包读失败跳过），但**那 19 个已落盘的文件成了孤儿**，下次同名导入会与之混合。
- **无校验**：导入不校验"导入后磁盘内容 === 原目录"，§10 测试要求"逐文件比对一致"但运行时不做。
- 这与 §14.4③ 的 facade 方案（一次请求整包、后端原子写）直接冲突——§3.4 的逐文件上传是 facade 没做时的替代债。

> **债的发酵**：导入是一次性动作，债不常发作，但一旦发作（导入中断、磁盘满、localTool 重启），留下的半截包需要用户手动进 Finder 清理，且无法被系统自检发现。

### 14.5.1 技术债处置建议（落地前必须裁决）

| 债 | 处置 | 是否推翻现有拍板 |
|---|---|---|
| 1 id=category/slug | 改采 §14.3② 稳定 UUID（目录名仅展示/布局），旧 id 登记 `aliases` | ✅ 推翻决策 1 的 `slug=name` 与 §4.0.5 |
| 2 双键跨域不一致 | 封装 `skillRepository.writeSkill()` 成对原子写 + 加 `schemaVersion` 字段；禁止任何调用方单写一键 | ⚠️ 补强，不推翻拆分本身（隐私收益保留） |
| 3 缓存独有项合法化 | 加"未落盘项"显式标记 + 启动横幅"N 个 skill 仅存浏览器，请导出"；落盘成功才从"待落盘"集合移除 | ⚠️ 补强防线语义 |
| 4 references 引用断裂 | 导入/保存时静态扫正文反引号引用，缺失即 hydrate 报警（§14.3③） | ✅ 推翻"只堆不校验" |
| 5 `.maomao.json` 自相矛盾 | **拍板删除**（采纳 §14.3⑥），§4.0.2/§7 相关读写作废 | ✅ 推翻 §4.0.2/§2.3 |
| 6 §13 与 §4 双架构并存 | 二选一写进 Phase 顺序：**先 §13 P0 地基（分层+判别联合+快照），再 §4 在其上落地**；或明确"本期只做 §4、§13 标为 v4 独立项目" | ✅ 必须二选一 |
| 7 内存 hash 易失 | 持久化 `contentHash` 进 `agent_skills` 索引项，`detectExternalChanges` 以磁盘 hash vs 索引 hash 为权威，内存 Map 仅缓存 | ⚠️ 补强 |
| 8 导入无事务 | 落地 §14.4③ facade 后，导入改"整包一次请求 + 后端原子写 + 失败回滚"；过渡期加"导入前先清同名旧包" | ✅ 依赖 facade |

> **架构师结论**：这 8 条里，**债 1、5、6 是方案自己拍板决策制造的结构性债，必须在实施前推翻/裁决**（不是"未来再优化"）；债 2、3、4、7、8 是"为赶工期/奥卡姆剃刀而接受"的已知妥协，需用 §14.5.1 的"补强护栏"在落地时一并埋好，否则会从"已知妥协"滑向"隐性故障"。**尤其债 6（两份并存架构）若不裁决，整个方案会陷入"功能跑通但底层验收永不达标"的永久半吊子状态——这正是 §0.4 最该避免的结局。**

### 14.6 架构哲学：你最讨厌的护栏，与我要的护栏（v4 落地的根本原则）

> 前面所有修正（§14.3 / §14.4 / §14.5.1）落到最后，是一条贯穿全方案的哲学：**错误要大声暴露，而不是用护栏把不确定性封进系统内部。**

**你最讨厌的护栏（本方案 v3 一度写满、v4 已全部清除）的特征**：

它们不是"让系统正确"，而是"让系统在出错时**看起来没崩**"。每一个兜底背后，都站着一个**本该被正视、却被消化掉的错误**：
- "落盘失败**不回滚缓存**" → 把"没存上"伪装成"缓存里有就算成功"，制造灰色状态。
- "**三/四道防线**防清空 localStorage" → 用层层 if 把"读到空"这件事绕过，而非断言"空目录必有原因"。
- "**启用态兜底**查不到新键就查旧键 + 默认启用，防全灰" → 用"默认启用"掩盖身份断裂，而非把身份对齐做扎实。
- "**缓存独有项保留**：磁盘没有就以缓存为准" → 把"没落盘的脏数据"永久养成真相。
- "**降级分支**：moveFile 返回 404 就跳过，不阻断删除" → 把"磁盘无文件"伪装成"删除成功"。
- "**兜底**：读 `.maomao.json` 失败就忽略，按内存态走" → 用另一份真相掩盖读取失败。

> 这些护栏的共性：**积累债**——灰色状态越积越多，最后谁都不知道系统里哪个数据是真的。系统变成一个"出错也不报错、但也永远不对"的黑箱。

**我要的护栏（fail-loud 不变式护栏，v4 已写入正文）**：

1. **真相源唯一性**：磁盘 `SKILL.md` 是唯一真相，缓存只是缓存。落盘失败 → 缓存不更新 + UI 报"未保存"。没有"不回滚"、没有"缓存独有项保留"（§4.2 / §4.3 v4）。
2. **身份稳定 + 迁移一次性对齐，不兜底**：`id` 是创建时 UUID（§4.0.5），改名换目录不动 id；旧 id 登记 `aliases` 永久可解析（§7 v4）。没有"按 name 猜"、没有"默认启用防全灰"。
3. **不变式（INV）而非防护性 if**：
   - **INV-1**：`agent_skills` 索引里每个 id，磁盘必有 `SKILL.md`，否则启动即报错（不"跳过该包当没看见"）。
   - **INV-2**：缓存里的 content 仅代表"已落盘副本"，落盘失败时绝不被当真相消费。
   - 这两条由 §10 单测钉死，让错误在最快时刻暴露，而非被防线稀释。
4. **导入/删除原子性**：整包一次请求、后端先写临时目录全成再 rename，任一失败整体回滚（§3.5 v4）。没有"404 跳过"。
5. **变更检测权威持久化**：`contentHash` 持久化进 `agent_skills` 索引项，重启不依赖易失内存 Map（§4.4 v4）。

> **一句话区别**：你讨厌的护栏 = "错了也别让用户/开发者知道，我帮你兜着"；我要的护栏 = "错了就大声报错，并把'正确'定义成一条能被测试钉死的不变式"。前者把债积累在系统内部，后者**把债消灭在产生之前**——因为错误根本没机会被藏起来。

**v4 修订对 §14.5 八条债的消除情况**：
- ✅ **债 1（id=category/slug）**：已消除 → UUID（§4.0.5 / 决策 1）。
- ✅ **债 5（`.maomao.json` 自相矛盾）**：已消除 → 删除（§4.0.2 / §2.3）。
- ✅ **债 3（缓存独有项合法化）**：已消除 → 删防线 + INV-2（§4.3 / §4.2）。
- ✅ **债 7（内存 hash 易失）**：已消除 → 持久化 contentHash（§4.4）。
- ✅ **债 8（导入无事务）**：已消除（facade 路径）→ 整包原子（§3.5 / §14.4③）。
- ⚠️ **债 2（双键跨域不一致）**：部分缓解 → 封装成对原子写 + `schemaVersion`（建议落地时补，§14.5.1）。
- ⚠️ **债 4（references 引用断裂）**：部分缓解 → 静态扫引用报警（建议落地时补，§14.3③）。
- 🔴 **债 6（§13 与 §4 双架构并存）**：**必须实施前裁决**（§14.5.1 已列二选一路径，尚未在 Phase 顺序里二选一落地，见 §9 待补强）。

> **最后一句**：债 6 是八条里唯一尚未在正文里被强制裁决的。若团队先按 §4 把功能跑通（最可能），§13 的 P0 地基会永远"下一期再做"。**强烈建议实施前在 §9 明确写入"先 §13 P0 地基、再 §4 在其上落地"或"本期只做 §4、§13 标为独立 v5 项目"二选一**——否则本方案会重蹈"功能跑通但底层验收永不达标"的覆辙（§0.4 最该避免的结局）。
