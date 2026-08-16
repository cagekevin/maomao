# TASK-005 — Skill 系统深度：内容深度 + mojibake 修复 + .md 导入导出 + / 快捷

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自本次实际打开文件核实结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论贴「文件 + 行号 + 关键代码片段」。
4. **自包含**：本文件已含所有探索起点。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验 Skill 系统的四个细节：mojibake 修复、Skill 内容深度、.md 导入导出、/ 快捷与空态 chips。

## 二、核验文件清单（本次实际打开核实）
- 大雄后端：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/backend.py`
- 大雄内置 Skill：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/builtin_skills/universal-detail-pages.json`
- 大雄前端：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`、`web/agent-panel.html`、`web/i18n.js`
- 我们 Skill store：`/Users/kevin/Documents/maomao/src/components/base/skillStore.js`
- 我们设置页：`/Users/kevin/Documents/maomao/src/components/base/settings/sections/SkillSettings.jsx`（注意：任务提示路径 `settings/SkillSettings.jsx` 与实际不符，真实路径在 `settings/sections/` 下，已核实）
- 我们面板：`/Users/kevin/Documents/maomao/src/components/AgentPanel.jsx`

---

## 三、覆盖清单逐项核验

### 1. mojibake 修复

#### 大雄怎么做（代码证据）
大雄在后端 `backend.py` 完整实现了 mojibake（UTF-8 被误解码为 Latin-1/CP1252 的乱码）检测与修复，并在所有 Skill 读写入口强制调用：

- **CP1252 反向映射表**：`backend.py L155-160`
  ```python
  _CP1252_REVERSE = {
      0x20AC: 0x80, 0x201A: 0x82, ... 0x0178: 0x9F,
  }
  ```
- **乱码判定 `_looks_like_mojibake`**：`backend.py L162-175`
  ```python
  @staticmethod
  def _looks_like_mojibake(text: str) -> bool:
      s = str(text or "")
      cjk = sum(1 for ch in s if "一" <= ch <= "鿿")
      latin_high = sum(1 for ch in s if "À" <= ch <= "ɏ" or "Ḁ" <= ch <= "ỿ")
      cp1252_marks = sum(1 for ch in s if ord(ch) in CanvasAgentPlugin._CP1252_REVERSE)
      score = latin_high + cp1252_marks
      if score >= 2 and cjk == 0: return True
      if score >= 3 and score > cjk: return True
      return False
  ```
- **字符转回原始错误字节 `_text_to_misdecoded_bytes`**：`backend.py L177-189`
- **递归修复 `_repair_mojibake_text`**：`backend.py L191-208`（把误解码字节按 utf-8 重新解，递归最多 2 层）
- **字段级清洗 `_normalize_skill_fields`**：`backend.py L210-218`，对 `name/description/content` 三个字段逐一 `_repair_mojibake_text`
- **写入前清洗 `_clean_skill`**：`backend.py L236-256`，`name` 修复后截断 80、`content` 截断 100000、`description` 截断 300
- **读入时清洗 `_read_skills_unlocked`**：`backend.py L220-228`，加载 skills.json 后逐条 `_normalize_skill_fields`
- **前端也修复**：`canvas-agent.js L3678` 渲染 Skill 名时 `agentRepairMojibakeText(skill.name || 'skill.md')`；`canvas-agent.js L3891` 顺手修复历史消息里缓存的乱码 skill 名

#### 我们现状（代码证据）
- `skillStore.js` 的读取入口 `getCustomSkills`（`skillStore.js L47-55`）：
  ```js
  const raw = sGet(SKILLS_KEY)
  const arr = raw ? JSON.parse(raw) : []
  ```
  直接 `JSON.parse`，**无任何 mojibake 检测/修复**。
- `upsertCustomSkill`（`skillStore.js L75-92`）写入时 `JSON.stringify` 直接落盘，**无清洗**。
- 设置页 `SkillSettings.jsx` 编辑/保存（`handleSave` L53-64）直接透传 form 内容，无修复。
- 面板 `AgentPanel.jsx` 的 `applySkill`（L155-161）、`allSkills` 渲染（L494-514）同样无修复逻辑。

#### 结论：我们是否需加
**建议加，但优先级低于内容深度与导入导出。** 我们的数据来自 localStorage 直读直写，理论上用户手动输入不乱码，但 Content 可能由复制粘贴带入乱码（如从大雄导出的 .md 再导入），且 `.md 导入` 是 TASK 要求新增的入口——一旦做导入，mojibake 风险即从「无」变为「有」。因此**应在 `.md 导入落点` 处（见第 3 节）加一次安全解析**，而非像大雄那样贯穿全链路。
- 最低可行：在 `skillStore.js` 的 `upsertCustomSkill`（L80-87 构造 `clean` 处）对 `name/description/content` 做一次轻量 mojibake 解码（copy 大雄 `_repair_mojibake_text` 逻辑到 JS）。
- 落点：`/Users/kevin/Documents/maomao/src/components/base/skillStore.js` `upsertCustomSkill` 函数内（L80-87）；如需读入口防御，加在 `getCustomSkills`（L47-55）解析后。

---

### 2. Skill 内容深度

#### 大雄怎么做（代码证据）
内置 Skill `universal-detail-pages.json`（11.64 KB，单 content 字段就占满 L6 整行）是一份**极详尽的电商视觉策划书**，结构化如下（来自 `content` 字段逐段）：
- **前端输入说明**：基本产品信息/产品图（三视图优先级最高，产品一致性 14 条禁令）/参考风格图（只控风格不控产品，强绑定规则）/语言。
- **核心任务**：自动识别品类、匹配视觉重点、提炼价值感、统一风格、输出 5 主图 + 8 详情页，每页含「页面作用/画面内容/版式结构/文案层级/AI 提示词/文案排版说明」。
- **设计原则 + 广告合规规则**（极限词/违规词禁用）。
- **五大品类自动判断**（户外车载/居家母婴/消费电子/美妆个护），每类给重点。
- **文案排版规则**：AI 直接生成复杂长文案易乱码，强制「短标题/短标签/模块化短句 + 明确版式结构」。
- **逐页模板（核心深度）**：
  - 通用 5 页主图结构（L6 第七部分）：首屏主视觉→核心卖点图文结合→材质工艺细节→真实使用场景/痛点→参数尺寸包装。
  - 通用 8 页详情页结构（L6 第八部分）：视觉首屏情绪共鸣→核心优势速览矩阵→痛点痛击场景引入→材质工艺深度解析→核心结构功能拆解→真实场景沉浸→贴心细节信任状→参数全家福购买指南。
- **统一输出格式**（L6 第九部分）：视觉整体定位（产品类型/调性/参考风格总结/比例/语言/色调/版式/表达重点）+ 每页固定字段模板。
- **统一风格提示词规则 + 统一负面提示词规则**（L6 第十部分）：每页提示词前默认加入基调、强制「参考风格图的色调/光影/构图/背景材质/留白/字体气质/版式关系」；负面词禁止改变产品外观/结构/颜色、禁止虚构认证、禁止过暗/促销牛皮癣/变形/透视错误/缺图文排版结构。
- 元字段完整：`schema_version/created_at/updated_at/usage_count/last_used_at`（`universal-detail-pages.json` L2-11）。

#### 我们现状（代码证据）
内置 Skill `skill_ecommerce_detail`（`skillStore.js L16-39`，`content` 在 L22-37）：
- 结构只有：执行方式（调 `execute_plan`）→ 规划规则（每张图一个 generation、比例、产品一致性用 `depends_on_previous`）→ 主图结构（4 句）→ 详情页结构（5 句）→ 合规（1 句）→ 输出格式。
- **对比大雄，缺失字段清单**：
  1. **前端输入说明**（产品图三视图优先级、产品一致性 14 条禁令、参考风格图强绑定规则、语言要求）——我们只有一句「产品外观一致性（严格参考产品图）」。
  2. **品类自动判断**：我们完全没有「按品类匹配视觉重点」的逻辑。
  3. **文案排版规则**：我们未强调「短标题/短标签 + 明确版式结构，避免 AI 长文案乱码」这一关键约束。
  4. **逐页模板**：我们只有主图 4 点 + 详情页 5 点「结构名」，缺少大雄每页的「页面作用 + 画面内容 + 版式结构 + 主副标题 + 卖点标签 + AI 提示词 + 文案排版说明」完整模板。
  5. **统一风格提示词规则**：我们缺失「每页提示词前默认加基调 + 强制继承参考风格图七要素」。
  6. **统一负面提示词规则**：我们只有「不编造参数、不用极限词、不夸大功效」三句，缺大雄的「不改外观/结构/颜色、不虚构认证、不过暗/牛皮癣/变形/透视错误/缺版式」等。
  7. **统一输出格式模板**：我们缺「视觉整体定位 + 每页固定字段骨架」。

#### 结论：追平落点
- **主体落点**：`/Users/kevin/Documents/maomao/src/components/base/skillStore.js` 的 `BUILTIN_SKILLS` 内 `skill_ecommerce_detail.content`（L22-37）。
- **可执行**：把大雄 `universal-detail-pages.json` 的「第七部分主图模板 + 第八部分详情页模板 + 第十部分统一风格/负面提示词规则 + 文案排版规则 + 品类判断」翻译成中文、改造为适配我们 `execute_plan` 执行契约的版本，扩充进 L22-37 的 content 字符串。保留我们已有的 `execute_plan` 调用约定（大雄无此约定，是我们差异化能力，需保留）。
- 元字段：我们 `BUILTIN_SKILLS` 已有 `builtin:true`（L21），但缺 `usage_count/last_used_at`——`skillStore.js` 的 `markSkillUsed`（L111-117）与 `getSkillUsage`（L119-121）已用独立 `USAGE_KEY` 实现，等价于大雄的 `usage_count/last_used_at`，**此项已追平，无需改**。

---

### 3. Skill .md 导入导出 + / 快捷 + 空态 chips

#### 大雄怎么做（代码证据）
- **.md 导入（拖拽/选择）**：
  - 文件输入接受 `.md/.markdown/.txt`：`agent-panel.html L102` `<input id="agentImageInput" accept="image/*,.md,.markdown,.txt" hidden>`；`canvas-agent.js L945` `agentImageInput.accept = imageMode ? 'image/*' : 'image/*,.md,.markdown,.txt'`。
  - 拖拽区文案：`i18n.js L4` `"smart.agentSkillDrop": {zh:"拖入 Skill（.md）或点击选择"…}`。
  - 导入处理 `setAgentSkillFile`：`canvas-agent.js L3652-3664`，`FileReader` 读文本，push 到 `agentState.skills`（{name:文件名, content:文本}），超限 `AGENT_SKILL_MAX_BYTES` 报错。
  - 批量识别：`canvas-agent.js` `agentAttachFiles`（L3704 起），其中 `skillFiles = allFiles.filter(f => name.endsWith('.md'/.markdown/.txt))` 定义在 **L3707-3710**，L3712 `skillFiles.forEach(f => setAgentSkillFile(f))` 逐文件导入。
  - 导入后可「保存为预设」：`canvas-agent.js L3691-3700`，点 bookmark 按钮 `openAgentSkillManager` 把 content 填进 Skill 编辑器。
- **.md 导出**：经全量搜索 `download/exportSkill/toBlob/导出`，大雄侧**无 Skill 导出功能**（仅 L4830 附近是复制消息到剪贴板，与 Skill 无关）。**结论：大雄只有导入，没有导出**。
- **/ 快捷**：`agent-panel.html L99` `<div id="agentSkillSlashPanel" …>`；`canvas-agent.js L9303-9347` `showAgentSkillSlash`/`hideAgentSkillSlash`/`agentSkillSlashKeydown`，输入 `/` 拉起 Skill 列表，键盘上下选择回车应用。
- **空态 chips**：`agentEmptyStateHtml`（`canvas-agent.js L3947-3955`）：非图像模式时取 `agentSkillPresets` 前 8 个渲染 `<button class="agent-empty-skill" data-agent-empty-skill=…>`，外加「所有 Skills」按钮；无预设时回退到 `i18n.js L18` `smart.agentEmpty` 文案。

#### 我们现状（代码证据）
- **.md 导入**：`AgentPanel.jsx` 文件输入 `fileRef`（`L779`）`accept="image/*"` 且 `handleFiles`（L332-353）只处理 `f.type.startsWith('image/')`，**完全不支持 .md 导入**。设置页 `SkillSettings.jsx` 也无导入按钮。
- **.md 导出**：无（与大雄一致，可暂时不做）。
- **/ 快捷**：`AgentPanel.jsx` 已有 `skillSlashOpen`（L143）、`onChange` 中 `setSkillSlashOpen(v === '/')`（L603）、下拉渲染 `skillSlashOpen &&` 块（L617-635）、`Esc` 关闭（L606）、点击应用 `applySkill(s)`（L626）。**此项已追平，且与大雄行为一致。**
- **空态 chips**：`AgentPanel.jsx` 空态（`messages.length === 0`，L477-516）已有横向 shortcuts（L482-493，来自 `SHORTCUTS` L58-63），并在 `allSkills.length > 0` 时渲染 Skill chips（`allSkills.slice(0,3)` 循环 L496-511），末尾提示「输入 / 可快速调用更多 Skill」（L512）。**此项已追平且比大雄多了一位：我们还展示了 4 个通用 SHORTCUTS，大雄空态只有 Skills。**

#### 结论：追平落点
- **/ 快捷**：已具备（`AgentPanel.jsx L143, L603, L617-635`），无需改。
- **空态 chips**：已具备（`AgentPanel.jsx L494-514`），无需改。
- **.md 导入（唯一缺口）**：
  - 落点 A（面板直接拖拽/选 .md 注入对话）：改 `AgentPanel.jsx` `handleFiles`（L332-353）增加 `.md/.markdown/.txt` 分支——`FileReader.readAsText` 后 `applySkill({ id, name:file.name, description:'', content:text })`（复用现有 `applySkill`，L155-161）；并把 `fileRef` 的 `accept`（L779）改为 `image/*,.md,.markdown,.txt`。
  - 落点 B（设置页导入为自定义预设）：在 `SkillSettings.jsx` 新增「导入 .md」按钮 + 隐藏 file input，读取后 `upsertCustomSkill`（L58 已有）写入。建议与落点 A 二选一或都做，落点 B 更贴近大雄「保存为预设」语义。
  - 配合第 1 节 mojibake：`upsertCustomSkill`（`skillStore.js L80-87`）导入 content 时做一次 JS 版 `_repair_mojibake_text`。
- **.md 导出**：大雄也无，可维持「不做」；若要做，落点同 `SkillSettings.jsx` 加「导出」按钮，`Blob` + `createObjectURL` 下载 `name + '.md'`。

---

### 4. 结论：四项分别改哪些文件哪些行（可执行汇总）

| 项 | 大雄是否有 | 我们现状 | 是否需改 | 精确落点（文件 L行） |
|---|---|---|---|---|
| ① mojibake 修复 | 有，全链路（backend.py L155-208, L236-256, L220-228；前端 L3678,L3891） | 无（skillStore.js L47-55, L75-92 直读直写） | 建议加（导入入口处） | `skillStore.js` `upsertCustomSkill` L80-87（清洗 content）；可选 `getCustomSkills` L47-55 |
| ② Skill 内容深度 | 极详尽（universal-detail-pages.json L6 第七~十部分） | 精简版（skillStore.js L22-37） | 需扩充 | `skillStore.js` `BUILTIN_SKILLS` 的 `skill_ecommerce_detail.content` L22-37 |
| ③ .md 导入 | 有（canvas-agent.js L3652-3664, L3705-3712, L945；panel L102；i18n L4） | 无（AgentPanel.jsx L332-353 仅 image；L779 accept=image/*） | 需加 | `AgentPanel.jsx` `handleFiles` L332-353 + `accept` L779；或 `SkillSettings.jsx` 新增导入按钮 |
| ③ .md 导出 | 无 | 无 | 维持不做（与大雄一致） | — |
| ③ / 快捷 | 有（canvas-agent.js L9303-9347；panel L99） | 已有（AgentPanel.jsx L143, L603, L617-635） | 无需改 | — |
| ③ 空态 chips | 有（canvas-agent.js L3947-3955） | 已有（AgentPanel.jsx L494-514，且多 4 个 SHORTCUTS） | 无需改 | — |

**优先级建议**：② 内容深度 > ③ .md 导入 > ① mojibake（随导入入口落地）> ③ 导出（不做）。

---

## 四、验收标准自检
1. **mojibake**：大雄逻辑已贴 `_repair_mojibake_text`（`backend.py L191-208`）全链路；我们 `skillStore.js` 经确认无修复，结论为「建议在导入入口加」。✅
2. **Skill 内容**：缺失字段清单已列（输入说明/品类判断/文案排版规则/逐页完整模板/统一风格词/统一负面词/输出格式模板），对照 `universal-detail-pages.json` L6 与大雄第七~十部分。✅
3. **落点落到具体文件+行号**：见第三节与第四节表格，全部为本次实际打开核实行号。✅

## 五、铁律文件名
本文件即唯一产出，未改动任何其他文件。
