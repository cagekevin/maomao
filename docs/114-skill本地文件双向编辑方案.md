# 114 · Skill 本地文件双向编辑方案（完整计划 · 修订版 v3）

> 状态：计划（待评审实施）
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
> 2. **不新增端点**：仍成立（路由不动、`apiRegistry` 不动），但**要改 3 处落盘逻辑**（§3.2）。
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
- **不新增 localTool 端点**（路由/契约不动），但**要改 3 处落盘逻辑**（§3.2）。
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
3. **不新增端点，但落盘语义要精确化**：路由与 `apiRegistry` 不动（`router.ts:164-171`），但 `skills/` 域必须绕过 `UPLOAD_ROOT_ALLOW` 与时间戳前缀（§3.2 三处改动）。理由：localTool 仅 127.0.0.1 监听（`CLAUDE.md` §四.2），新增端点要付 router 注册 + `apiRegistry` 登记 + `check:api` 双向校验三笔成本 → **奥卡姆剃刀，不增实体**（`CLAUDE.md` §5.5）。
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
│   │   ├── SKILL.md                   ← frontmatter(元数据) + 正文（= 原 content 的角色）
│   │   ├── references/                ← 参考资料（本期只保留文件，不做懒加载）
│   │   │   ├── workflow.md
│   │   │   └── art-styles/manga.md
│   │   ├── scripts/                   ← 可选：可执行脚本
│   │   └── .maomao.json               ← 猫猫私有元数据（id/enabled/usage/createdAt）
│   └── 小红书图片/
│       └── SKILL.md
├── 视频类/
│   └── 视频创作/
│       └── SKILL.md
└── _未分类/                            ← 兜底：导入时未指定分类的落这里
    └── 电商详情页套图/
        └── SKILL.md
```

**与标准 skill 包的差异**：多一层"分类目录" + 一个 `.maomao.json`；**skill 包本身**与 `Documents/skills/baoyu/*` **完全同构**，可直接互拷。

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
| `id` / `enabled` / `usage` / `createdAt` | localStorage + `.maomao.json` 双写 | `agent_skills` / `agent_skill_enabled` / `.maomao.json` |
| `references/**` | **本地文件**（本期只存不读） | `<分类>/<slug>/references/**` |

> `name/description` v2 放在 localStorage，v3 **移入 frontmatter**——因为外部 skill 包本来就把它们写在 frontmatter，导包时必须以文件为准，否则每次 hydrate 都要靠 localStorage 兜底名称，反而两头不靠。`id` 用**目录名 slug**，`enabled/usage` 这两个"纯猫猫运行时状态"（外部编辑器不关心）留 localStorage，同时冗余写 `.maomao.json` 便于整目录拷走后保状态。**`category` 用目录名承载**，这样在 Finder 里拖拽归类 = 改分类，零额外配置。

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
}
```

---

## 3. localTool 改造（实测结论：**必须改，且改动很小**）

### 3.1 实测结果：三条通道全部被"根白名单"挡死 🔴

我在写代码前把三条路都验证了一遍，**结论是 v2/v3 早先"零后端改动"的假设不成立**：

**① 写：`POST /api/files/upload` → `skills` 是未登记顶层根，直接失败**

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

`handleUploadFormData` 的 `file` 分支（`files.ts:120`）走的正是这个函数 → 落盘名恒为 `<时间戳>-SKILL.md`。**每次保存都生成新文件，`<slug>/SKILL.md` 永远不存在**——双向编辑的根基（按 `<slug>/SKILL.md` 定位）直接不成立。

**③ 读：`GET /api/files/read` 的 basename 二次包夹**

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
| 2 | `localTool/src/routes/files.ts`（`handleUploadFormData`） | 新增**精确路径写**分支：当 `subfolder` 以 `skills/` 开头时，走 `writeUploadBufferAt`（不加时间戳）而非 `writeUploadBuffer` | 否则 `SKILL.md` 永远带时间戳前缀，按名定位不成立 |
| 3 | `localTool/src/utils/fileStore.ts`（`resolveUploadTarget`） | 让 `skills/` 根**保留多级路径**（`savedPath` 用 `resolveUploadFile` 那套 `path.resolve` + 防逃逸，而非 `sanitizeFilename` 拍平） | 否则 `references/a/b.md` 结构被拍平 |

> **改动 2 的两种实现**（择一，见 §12 决策点）：
> - **A（推荐，最小）**：`handleUploadFormData` 里判断 `subfolder.startsWith('skills/') || subfolder === 'skills'`，命中则 `writeUploadBufferAt(subfolder, saveName, data)`。**只影响 skills 域，零回归风险。**
> - **B（更通用）**：`handleUpload` 增加 `?exact=1` 查询参数表示"按精确文件名落盘"，任何域都能选。改动面更大，但语义更干净。

**路由无需改**：`POST /api/files/upload` 已在 `router.ts:164` 注册，只是"怎么落盘"变了，不新增端点、不动 `apiRegistry`。

### 3.3 各端点改造后可用性（实测）

| 需求 | 端点 | 结论 |
|---|---|---|
| 写任意文件（含多级） | `POST /api/files/upload` | ⚠️ 改 1+2 后可用 |
| 读任意文件 | `GET /api/files/read?path=` | ✅ **可直接用**（`handleRead` 收的是绝对路径，不走 `resolveUploadTarget`）——**注意**：这是 `files.ts:331` 的 `path` 参数路径，与上面 ③ 是两条不同分支 |
| 列目录（hydrate 必需） | `GET /api/files/list?subfolder=` | ⚠️ **不递归**（见下），需逐层调用 |
| 建目录 | `POST /api/files/mkdir` | ⚠️ 需 `folder` 以白名单根开头 → 改 1 后可用（`handleMkdir` 用 `path.join(uploadDir, folder)` + `ensureDir`，**无包夹**，天然支持多级） |
| 移动（删除走 `trash/`） | `POST /api/files/move` | ⚠️ `applyResourceIdentityChange` 面向**文件**（`renameSync`），**不支持目录** → 见 §3.5 |
| 打开所在目录 | `GET /api/files/open?subfolder=` | ⚠️ 走 `normalizeSubfolder` → 改 1 后可用 |

**`handleList` 不递归**（实测 `files.ts:603` 只 `readdirSync` 一层，返回 `{files, folders}`）→ hydrate 需**按已知分类逐层 list**（分类是有限枚举，可接受）。这也正好支撑 §2.6 的分类方案。

### 3.4 前端新增能力（`src/components/base/api/filesApi.ts`，文件域单点）

```ts
/** 写 skill 包内任意文件：relPath 如 `漫画生成/references/workflow.md` */
export async function saveSkillFile(relPath: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const r = await saveTextFile(`skills/${relPath}`, content);  // 复用既有 saveTextToTasks 同款 multipart 手法
  return r;
}

/** 读 skill 包内任意文件（含 SKILL.md 与 references/*） */
export async function readSkillFile(relPath: string): Promise<string | null> { /* GET /api/files/read?path= */ }

/**
 * 列出 skills/ 下的分类与 skill 包。
 * 【实测】/api/files/list 不递归 → 按已知分类逐层 list（分类是有限枚举，见 §2.6）。
 * 返回 [{ category, slug, files:['SKILL.md','references/a.md',…] }]
 */
export async function listSkillPackages(): Promise<Array<{ category: string; slug: string; files: string[] }>> { /* … */ }
```

**技术先例**：`filesApi.ts:332` 的 `saveTextToTasks` 已用同一手法（multipart + `subfolder` + `filename`），本方案照抄（差别仅在落盘是否加时间戳，见 §3.1 改动 2）。

**编码注意**：`handleRead` 对 `.md` 无 `mimeMap` 命中 → 回落 `application/octet-stream`（`files.ts:352`），返回**原始文本流**。前端用 `parseJson:false` 取 `res.text()` 即可，**不需要后端改 mime**。

### 3.5 删除 skill（实测：`handleMove` 不支持目录 ⚠️）

`handleMove` → `applyResourceIdentityChange`（`resources.ts:453`）内部是 **`fs.renameSync`** + resources 表行重建，面向**文件**（入参 `oldRel`/`newRel` 是文件相对路径，单据 §449 注释"新行 id 必须走 `resourceIdOf`"）。**移动整个目录不在其语义内。**

三种处理，按推荐排序：

1. **推荐**：删除时**逐个文件** `moveFile` 到 `skills/.trash/<分类>/<slug>/…`（用 `handleList` 拿到的文件清单枚举）。几十个文件对本机 127.0.0.1 是毫秒级，可接受；`.trash` 前缀 `_` 或 `.` 让 hydrate 跳过。
2. **可接受**：删除只删 localStorage 记录、保留磁盘目录（用户手动清理），并在 UI 提示"文件已保留在 `skills/<…>`"。缺点是 hydrate 会"复活"该 skill → 需配合"忽略清单"或方案 1。
3. **不推荐**：新增 `POST /api/files/delete`（破"不增端点"原则 + 契约登记 + 双向校验成本）。

> **本期取方案 1。** 若后续觉得逐文件 move 太啰嗦，再考虑给 `handleMove` 加"目录模式"（那是一次有意的端点增强，不是本方案默认项）。

### 3.6 可选（Phase 3）：文件变更实时推送

复用 `localTool/src/routes/logs.ts` 的 SSE 模式新增 `GET /api/skills/watch`（`fs.watch`）——但要新增端点 + 契约登记。Phase 1 用 `focus` 检测 + 手动"重新加载"按钮已够用。**不阻塞。**

---

## 4. 前端 `skillStore` 改造（`src/components/base/store/skillStore.ts`）

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
> }
> ```
> 现有消费方（`agentCore.SkillItem` 只读 `name/content`、`AgentPanel` 只传 `{id,name,description,content}`）**全部不受影响**。

### 4.2 核心：**同步缓存优先，落盘是叠加副作用**（v2 关键修正，v3 保留）

用户诉求是「**保存后立刻能用**」。`AgentPanel.tsx:308` 已经订阅了 `SKILLS_KEY`：

```308:309:src/components/panels/AgentPanel.tsx
    const unsubSkills = contentSubscribe(SKILLS_KEY, resync);
    const unsubEnabled = contentSubscribe(ENABLED_KEY, resync);
```

并会把已选 skill 的 `content` 按 id 回填（`AgentPanel.tsx:301`）。所以**只要保存时同步调用 `saveCustomSkills`（内部 `contentSet` 会 notify），UI 就地刷新**——落盘不应参与这条链路的时序判断。

```ts
// ① 保存：同步写缓存（触发 contentSubscribe → UI 立刻可用），再异步落盘
export function upsertCustomSkill(skill: Partial<Skill>): Skill | null {
  // …（原有校验 + repairMojibakeText 不变）
  const res = saveCustomSkills(list);        // ← 同步；notify → AgentPanel 立即重读
  if (!res.ok) { logger.warn(...); return null; }
  void persistSkillFile(clean.id, clean.content);   // ← 异步落盘，不 await、不改返回语义
  return clean;
}
```

```ts
// ② 落盘（fire-and-forget）：失败不改 UI 状态，只 toast/日志提示，缓存仍有效
async function persistSkillFile(id: string, content: string): Promise<void> {
  const r = await saveSkillFile(id, content);
  if (!r.ok) {
    logger.warn('skillStore', 'Skill 未落盘（仅存于浏览器缓存）', id, r.error);
    // 提示走 toastStore；注意：此处不得回滚缓存，否则用户"刚保存的内容"消失
  }
}
```

**为什么 `upsertCustomSkill` 保持同步返回**：`SkillSettings.tsx:140`（`handleSave`）、`SkillSettings.tsx:225`（.md 导入）都按同步返回值判成败并立即 `refreshAll()`。改为 `async` 会连带改这两个调用点 + 返回值语义（`Skill | null` → `Promise<...>`）。**保持签名不变 = 零破坏**，落盘作为副作用——这正是"同步缓存 + 异步落盘"的价值。

> v1 §4.3 说"`upsert/delete` 内部改调 `persistSkillToFile`（异步）"，并自评风险"个别调用方若误用会导致竞态"。v2 用"不 await、不改签名"消掉了这个风险。

### 4.3 启动 hydrate（v3：读 skill 包目录）

```ts
/** 启动时从本地 skill 包目录刷新缓存。失败保留 localStorage（离线降级）。 */
export async function hydrateSkillsFromFile(): Promise<{ ok: boolean; loaded: number; error?: string }> {
  try {
    // [{ category:'图片类', slug:'漫画生成', files:['SKILL.md','references/a.md',…] }]
    const packs = await listSkillPackages();
    if (!packs.length) return { ok: true, loaded: 0 };  // ★ 空目录：绝不覆盖既有 localStorage
    const cache = new Map(getCustomSkills().map((s) => [s.id, s]));   // 取 enabled/usage 等运行态
    const merged: Skill[] = [];
    for (const p of packs) {
      if (p.slug.startsWith('.') || p.slug.startsWith('_')) continue;  // 跳过 .trash/ 与 _未分类 占位
      const raw = await readSkillFile(`${p.category}/${p.slug}/SKILL.md`);  // ★ 两级路径
      if (raw == null) continue;                        // ★ 单包读失败：跳过，绝不写空
      const { meta, body } = parseSkillMarkdown(raw);   // frontmatter + 正文（§2.2）
      const id = keyOf(p.category, p.slug);             // id = `${category}/${slug}`（稳定唯一）
      const prev = cache.get(id);
      merged.push({
        id,
        category: p.category,                           // ★ 分类来自目录名（§2.6）
        slug: p.slug,
        name: meta.name || prev?.name || p.slug,         // frontmatter 优先 → 缓存 → slug 兜底
        description: meta.description || prev?.description || '',
        content: body,                                  // ★ 只取正文，保证与注入 LLM 的内容一致
        references: p.files.filter((f) => f.startsWith('references/')).map((f) => f.slice('references/'.length)),
        createdAt: prev?.createdAt, updatedAt: prev?.updatedAt,
      });
    }
    saveCustomSkills(merged);                           // 仅在有包时覆盖缓存
    return { ok: true, loaded: merged.length };
  } catch (e) {
    logger.warn('skillStore', 'Skill 从文件加载失败，沿用本地缓存', e);
    return { ok: false, loaded: 0, error: (e as Error).message };
  }
}
```

> **`id` 的取值（重要）**：改为 `${category}/${slug}`，因为 `slug` 在跨分类时可能重名（如"图片类/封面生成"与"视频类/封面生成"）。**id 变更会破坏既有 localStorage 里的旧 id** → 迁移时按 `name` 匹配旧记录，重新生成 id（§7）。

**两道关键防线**（对应 §0.4/§1.4 不丢数据原则）：
1. `packs.length === 0` → **直接 return，不调 `saveCustomSkills([])`**。否则"目录暂时为空 / localTool 刚起"会把 localStorage 里的 skill 全清空——正是 `skillStore.ts:134` 那段 JSDoc 反复强调的"一保存就真删"陷阱。
2. 单包 `SKILL.md` 读失败 → 跳过该包，**不用空值覆盖**。
3. `parseSkillMarkdown` 解析失败 → 退化：`{ meta: {}, body: raw }`（整个文件当正文），**不丢内容**。

### 4.4 外部变更检测（Phase 2）

```ts
// 记录每个 skill 包已同步的内容签名（含 references 文件名清单；用 hash 而非 mtime——
// 复制/搬目录会改 mtime 但内容不变，会让检测误报）
const packHashes = new Map<string, string>();
```
- 触发时机（任选，建议都做）：`focus` / `visibilitychange` 时；或定时轮询（5s，Phase 2）。
- 检测到差异 → 走 §5.3 冲突处理。

---

## 5. 双向同步策略

### 5.1 Web → 文件（用户从网页保存）
- 点保存 → `upsertCustomSkill` → **同步**写缓存（UI 立刻可用）→ **异步**把 `SKILL.md`（frontmatter + 正文）落盘到 `<分类>/<slug>/SKILL.md`。
- 落盘失败 → **不回滚缓存**（内容仍在，可用可重试），明确提示"仅存于浏览器缓存，未落盘"，不谎报成功。
- **注意**：网页保存**只写 `SKILL.md`**，**不动 `references/`**。否则用户在 VS Code 里新增的参考文件会被网页保存抹掉。
- **改分类**（拖拽）→ 逐文件 `moveFile` 到新分类目录（语义同 §3.5），完成后更新缓存 + 重载。

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
3. **"从文件重新载入"按钮**：手动触发 `hydrateSkillsFromFile()`，方便 VS Code 改完立刻拉进来。
4. **外部变更横幅**（Phase 2）：`detectExternalChanges()` 非空时列表顶部提示"本地文件已被外部修改，是否重载？[重载] [忽略]"。
5. **编辑体验增强（顺带）**：`content` textarea（`SkillSettings.tsx:475`）已是 `min-h-[340px]`；可加 `resize-y` 允许拖拽放大。真正的舒适编辑仍是 VS Code 改文件。
6. **路径提示**：设置页展示 `~/.maomao-localtool/skills/<分类>/<slug>/SKILL.md`，并给"打开所在目录"按钮（复用 `filesApi.openFileDir` / `openLocalFolder('skills')`）。
7. **导入 skill 包**：`<input type="file" webkitdirectory>` 选目录 → 递归读全部文件 → 落盘到 `skills/<分类>/<slug>/…`。把 `SkillSettings.tsx:215` 的 `handleMdImport` 升级为目录导入（`.md` 单文件导入保留兼容，默认落 `_未分类/`）。
8. **导出 skill 包**：列表项菜单加"导出整个包"（原 `handleMdExport` 只导出 `content` 文本，`SkillSettings.tsx:255`）。逐文件下载本期可接受（**见 §12 决策点 5**）。

---

## 7. 迁移方案（localStorage → 文件）

- **首次启动**（`hydrateSkillsFromFile` 内）：若 `skills/` 目录**为空**（含无任何分类目录）且 localStorage 有旧 `agent_skills` 数据 → 逐条写 `_未分类/<slug>/SKILL.md`（`serializeSkillMarkdown(skill)`），完成迁移；之后文件为准。
  - ⚠️ 迁移是**写文件**，不是"清 localStorage"。迁移在"目录为空"分支执行；若目录已存在则只读不写（避免把网页旧数据倒灌覆盖 VS Code 的新内容）。
  - ⚠️ **旧数据无 `category`** → 统一落 `_未分类/`，用户在 UI 里或 Finder 里再归类（不强猜分类）。
- **旧 `id` 与新增 `category/slug` 的对应**：旧 id 形如 `skill_1700000000000`，新 id 是 `${category}/${slug}` → 迁移时**按 `name` 匹配旧记录**，把 `enabled`/`usage`/`createdAt` 继承过来（`agent_skill_enabled` / `agent_skill_usage` 的旧 id 键需一并改写成新 id，否则用户的启用状态和统计会丢）。
- **`slug` 生成**：由 `name` 清洗而来（`safeFileName`）；**同一分类内重名**时加序号 `-2`、`-3`。
- 迁移失败不删 localStorage（数据双保险）。
- 提供"导出全部 skill 到文件"的兜底按钮，防极端情况下文件丢失可重建。

---

## 8. 安全与边界

- **localTool 改动面极小且收窄**（§3.2 三处）：只放行 `skills` 一个顶层根，其余白名单原样；`skills/` 域走 `resolveUploadFile` 那套 `path.resolve` + 防逃逸（`fileStore.ts:94-110`），比 `sanitizeFilename` 拍平更安全。**新增的写分支不放开任意路径。**
- **路径清洗（逐级）**：`category` / `slug` / `references` 下的每级目录名均来自用户输入，写文件前**逐级清洗**，防 `../` 穿越。
- **导入外部包时的额外防线**：递归读入的 `File` 的 `webkitRelativePath` 可能含 `..`（恶意包）→ 落盘前**丢弃任何含 `..` 的段**。
- **分类名也需清洗**：用户可输入新分类名 → 同样过 `safeFileName`（防 `/`、`..`）。
- 文件内容仅文本（`references/` 若含二进制本期按文本处理，损坏则跳过并 warn）。
- 现有 `handleRead` 的任意路径读是**既有行为**（登记 `RESERVED`、前端零消费，`contracts.ts:743`）；localTool 仅 127.0.0.1 监听 + 单用户本机进程（`CLAUDE.md` §四.2）。
- 若未来 localTool 暴露到更广网络，再考虑收窄 `handleRead`——**现在不做**。

---

## 9. 实施分阶段

### Phase 0 · 后端 3 处小改（前置，必须先做）
- [ ] `fileStore.ts:39`：`UPLOAD_ROOT_ALLOW` 加 `'skills'`。
- [ ] `fileStore.ts`：`skills/` 域保留多级路径（不拍平）。
- [ ] `files.ts handleUploadFormData`：`skills/` 域走精确文件名落盘（`writeUploadBufferAt`，不加时间戳）。**实现 A（skills 专用判断，推荐）或 B（`?exact=1`）见 §12 决策点 8。**
- [ ] **验收**：`upload({subfolder:'skills/图片类/漫画生成', filename:'SKILL.md'})` → 磁盘出现 `skills/图片类/漫画生成/SKILL.md`（无时间戳前缀）；`read` 能读回。
- [ ] **回归**：跑 `cd localTool && npm test`（`CLAUDE.md` §3.3 硬要求）；确认 `tasks/web/canvas/migrated/director3d` 行为逐字不变。

### Phase 1 · skill 包落盘 + 分类 + 双向编辑（本期核心）
- [ ] `skillStore.ts`：`Skill` 加 `category?` / `slug?` / `references?`（可选，零破坏）；新增 `parseSkillMarkdown` / `serializeSkillMarkdown`（纯函数，**必须补单测**）+ `hydrateSkillsFromFile`（§4.3，含空目录防线）。
- [ ] `filesApi.ts`：新增 `saveSkillFile(relPath, content)` / `readSkillFile(relPath)` / `listSkillPackages()`（按分类逐层 list，§3.4）。
- [ ] `skillStore.ts`：`upsertCustomSkill` 保持同步签名 + 追加 `void persistSkillFile(...)`；`deleteCustomSkill` 逐文件 move 入 `skills/.trash/`。
- [ ] **分类能力**：默认分类表（`图片类`/`视频类`/`文档类`/`自动化`/`_未分类`）；`SkillSettings` 分类树 + 拖拽换分类 + 新建时选分类。
- [ ] 启动挂载：hydrate 在应用启动早期调用。
- [ ] `SkillSettings`：保存提示 + "从文件重新载入" + 展示包路径 + 导入/导出整个包。
- [ ] **云同步适配（§11.5，决策 10/11）**：`agent_skills` 瘦身去 `content`（`contracts.ts:247` note 同步改）+ 新增 `agent_skill_cache` 存正文缓存并加入 `cloudSync.SYNC_EXCLUDE`；确认 `enabled` 仍跨设备同步。
- [ ] 迁移：首次把 localStorage 旧数据导出为 `_未分类/<slug>/`。
- **验收**：① 网页改 → `skills/<分类>/<slug>/SKILL.md` 更新且 **AgentPanel 立刻能用新内容**；② 导入你现有的 `漫画生成-Comic`（含 `references/` 几十个文件）→ **一个不丢**；③ 技能列表按分类分组显示；④ 点"重载" → 磁盘改动进网页；⑤ **云同步手动跑一次，确认不报错、`agent_skills` 里无正文、`enabled` 状态跨设备可见**。

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
- **风险 4 · 落盘与缓存不一致**：落盘失败但缓存有值 → 用户以为已存。缓解：toast 明确区分"已落盘/仅缓存"，不回滚缓存。
- **风险 5 · 路径穿越**：`category` / `slug` / `references` 未清洗直接拼。缓解：逐级 `safeFileName` + 丢弃 `..` 段 + 单测。
- **风险 6 · 网页保存抹掉 `references/`**：若保存实现成"整目录覆盖"。缓解：§5.1 明确"只写 `SKILL.md`"，加测试断言。
- **风险 7 · frontmatter 解析失败丢元数据**：缓解：解析失败退化"整文件当正文"，不丢内容（名称缺省用 slug）。
- **风险 8 · 分类被 hydrate 当成 skill**：`skills/图片类/` 若被误读为 skill 包会报错。缓解：两级固定结构（分类/skill），`SKILL.md` 不存在则跳过。
- **风险 9 · 删除复活**：删除只删缓存不删文件 → 下次 hydrate 复活。缓解：§3.5 移入 `.trash/`。
- **风险 10 · 大目录导入慢**：几十个 `references/` 文件逐个 HTTP 上传。缓解：可接受（本机 127.0.0.1，毫秒级）。
- **风险 11 · 云同步把 skills 推空/推旧**（§11.5）：`agent_skills` 瘦身后若旧设备（未升级）推上带 `content` 的旧结构，或新设备拉不到文件 → skill 显示为"有记录无内容"。缓解：① `agent_skills` 只存索引，`content` 缺失时 UI 明确提示"本机无文件，请拷贝 `skills/` 目录"而非静默显示空；② `agent_skill_cache` 进 `SYNC_EXCLUDE` 杜绝正文上云；③ 升级时跑一次本地迁移再同步。
- **风险 12 · 存储键契约变更漏改**：`agent_skills` 结构变更 + 新增 `agent_skill_cache` 属 `CLAUDE.md` §5.5 P0 红线。缓解：`contracts.ts` 登记 + `npm run check:keys` + 全量 grep 消费方（`skillStore`/`AgentPanel`）。
- **回滚**：① 前端加配置开关 `SKILLS_PERSIST=0` 退回纯 localStorage；② 后端三处改动均为**新增分支**，把 `'skills'` 移出白名单即回到改前行为；③ 云同步侧：把 `agent_skill_cache` 从 `SYNC_EXCLUDE` 移除 + `agent_skills` 恢复带 `content`，即回到现状。

---

## 11.5 云同步 / 备份怎么办（用户提问：会不会用不了？）

**结论：不会用不了，而且比现在更好——但需要一次"瘦身"改动。**

### 现状（实测）

| 机制 | 覆盖 `agent_skills` 吗 | 位置 |
|---|---|---|
| 云同步（GAS） | ✅ **同步** | `cloudSync.ts:850` 的 `SYNC_LABELS` 有 `agent_skills: '自定义 Skill'` |
| 备份（全量导出） | ✅ 备份 | `backupStore` 由 `getLocalKeys()` 自动生成清单（`contracts.ts:449`） |
| 云同步覆盖 `agent_skill_enabled` | ✅ | `SYNC_LABELS:852` |
| 云同步覆盖 `agent_skill_usage` | ❌ **已在 `SYNC_EXCLUDE`** | `cloudSync.ts:834` |

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

- `contracts.ts:247` 的 `note` 要同步改（`note: '用户自定义 Skill 列表 [{id, name, description, content}]'` → 去掉 `content`）。
- 消费方：`skillStore` 自身、`AgentPanel.tsx:259/299`（都只读 name/description/content，需改为"从缓存读，缓存由 hydrate 填 content"）。
- **`content` 不进 `agent_skills`，但仍进 localStorage 缓存**——这一层要分清：**缓存键与同步键可以是同一个键，但缓存里的 `content` 不该被上传**。两种实现（见 §12 决策点 11）。

**② 跨设备（换电脑）怎么带 skill**

| 方式 | 说明 |
|---|---|
| **文件拷贝（推荐，主路径）** | 把 `~/.maomao-localtool/skills/` 拷到新机器同路径即可。目录形态决定了这是**最自然**的迁移方式（整个目录 zip 走） |
| 云同步（辅助） | 只带 `enabled` 状态 + 索引；新机器上若没有对应文件，UI 显示"该 skill 在云端有记录但本机无文件"，提示用户拷贝目录 |
| 导出/导入包 | §6 的导出/导入功能，逐个包走 |

> ⚠️ **不能只依赖云同步带 skill 了**——这是本方案**唯一的功能性代价**。但换来的是：正文不再明文上云 + 目录结构完整保留（云同步的 JSON 里塞 `references/` 几十个文件本来就不现实）。**净收益为正。**

**③ 备份（`backupStore`）不受影响，但要加一项**

`backupStore` 的清单来自 `getLocalKeys()`（`contracts.ts:449`），`agent_skills` 仍在表里 → 备份**自动继续包含它**（瘦身后的索引）。
但**skill 包文件在磁盘、不在 localStorage，不会被备份包住** → 建议**备份时一并把 `skills/` 目录打进 zip**（`backupStore.exportAll` 增加 `skills` 字段；`importAll` 时写回）。这是**新增能力，本期可做可不做**（§12 决策点 12）。

### 一句话回答

**云同步照用，不会坏；只是从"同步 skill 正文"改成"同步 skill 索引 + 启用状态"，正文改走文件。** 换设备时拷 `~/.maomao-localtool/skills/` 目录。顺带把 skill 正文从明文上云这个问题解决了。

---

## 12. 决策点（**已全部拍板**，用户 2026-09-10 授权按推荐执行）

| # | 决策 | 定论 | 理由 |
|---|---|---|---|
| 1 | 包目录命名 | **`slug` = `name`**（如 `漫画生成`） | 可读、与外部包一致；id 存 `.maomao.json`，改名不影响 |
| 2 | `references/` 本期用法 | **只落盘、不读取** | 用户明确（§2.4）；懒加载归 Phase 3 |
| 3 | frontmatter 解析 | **零依赖手写顶层 `key: value`** | 你现有包只用 `name`/`description`；`metadata:` 块原样保留不解析。避免为两个字段引 `gray-matter`（`CLAUDE.md` §5.5 奥卡姆剃刀） |
| 4 | 删除语义 | **逐文件 move 入 `skills/.trash/`** | 可恢复；避免"删了又被 hydrate 复活"（§3.5） |
| 5 | 导出形态 | **逐文件下载（本期）** | 零依赖；单 skill 包通常十几个文件，可接受。体验不够再加 zip（留作 Phase 2 增强） |
| 6 | skills 目录 | **`~/.maomao-localtool/skills/`** | 与 `providers`/`uploads` 同级、跟随 `MAOMAO_DATA_DIR` 隔离；运行期用户数据不入 git 工作区 |
| 7 | Phase 1 是否含自动检测 | **否**，只做 `focus` + 手动"重载"按钮 | 避免过度工程；轮询/SSE 后置 |
| 8 | 后端落盘精确化实现 | **A：skills 专用分支** | 改动限定在 `skills/` 前缀，对既有 `tasks/web/canvas/migrated/director3d` **零影响**（回归风险最低） |
| 9 | 默认分类表 | **`图片类` / `视频类` / `文档类` / `自动化` / `_未分类`** | 只是默认值 + 新建时的下拉建议；用户可自由增删改（目录名即分类） |
| 10 | 云同步 `agent_skills` 瘦身 | **做**（去 `content`，保 `enabled`）；`contracts.ts` note 同步改（§11.5） | skill 正文不再明文上云；避免正文双写不一致 |
| 11 | `content` 缓存与同步的拆法 | **A：缓存键与同步键分离**（`agent_skills` 只存索引进云同步；`content` 缓存放新键 `agent_skill_cache` 并加入 `SYNC_EXCLUDE`） | 语义最干净：**该上云的键不含正文，含正文的键不上云**。改动：新增 1 个存储键（须在 `contracts.ts` 登记，`CLAUDE.md` §5.5 P0）+ `cloudSync.SYNC_EXCLUDE` 加一项 |
| 12 | 备份是否含 `skills/` 目录 | **本期不做**，留 Phase 2 | 备份是 localStorage 快照机制，塞目录要改 `exportAll`/`importAll` 结构；先靠"手动拷目录"兜底，不阻塞主线 |

> 用户原话："你说这几个决策点我又不懂，只能按你说的。" → 上表即最终执行口径，**实施时不再回头确认这些点**。
>
> **决策 11 的取舍**：也可以偷懒只在 `SYNC_EXCLUDE` 加 `agent_skills`（一个键都不加），但那样**连"哪些 skill 存在 + 是否启用"也不跨设备同步了**，属于功能倒退。分离两个键成本很小（登记一个键），体验不倒退、隐私还变好，故选 A。

> **v3 相对 v2 的实质变化**：一期即落地 **分类 / skill 包目录**（`<分类>/<slug>/SKILL.md` + `references/` + `scripts/`），消除"导包丢 90% 内容"的结构错配；`name/description` 移入 frontmatter 对齐外部包；**`references/` 只保留文件、不做读取**（已确认）；归类用**目录名**承载（零配置、Finder 与网页双向一致）；并**修正了 v2"零后端改动"的错误假设**——实测三条通道全被 `UPLOAD_ROOT_ALLOW` 与时间戳前缀挡死，必须改后端 3 处极小改动（§3.2）。
