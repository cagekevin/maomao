# `agent/skill` —— Skill 能力片（模块内部说明）

> 施工文档：`docs/plan/140-skill系统-可执行最终方案-2026-09-21.md`（唯一施工入口）。
> 本文件只讲**模块内部结构与不变量**，供后续 AI 就地读懂；判据的"为什么"在 140 与 `docs/adr/`。

## 1. 这个模块负责什么

Skill 的**全部**：磁盘技能包的读写、`SKILL.md` frontmatter 解析、分组、注入预算与路径安全、
发送给模型时把 skill 组织成两块提示文本、以及技能库的后端调用。

## 2. 文件职责（内部件，域外**不得** import）

> **目录分组（2026-09-22）** —— 判据 =「**变更理由 + IO 边界**」：
>
> | 目录 | 判据 | 装了谁 |
> | --- | --- | --- |
> | `rules/` | 纯规则：无 IO、无状态、可单测 | `skillManifest` · `skillEntry` · `skillDirName` · `skillGroup` · `skillResourcePath` · `skillText` |
> | `store/` | 有后端 / 存储 IO | `skillRepository` · `skillApi` · `skillHydrate` · `skillMigration` |
> | `view/` | 界面判定纯函数（事实 → 界面形状） | `skillLibraryView` · `skillPickerView` |
> | `write/` | 有副作用（落盘 / 网络），且必须"先落盘成功才回写缓存" | `skillPersist` · `skillImport` · `skillCloudSync` |
> | `model/` | 给模型：文本从哪来、给多少 | `skillBuiltins` · `skillRegistry` · `skillBudget` · `skillInject` · `skillInjectText` · `skillResource` |
> | （顶层） | **门面** 与 **类型真源**（域外 import 路径不变 = `@/components/agent/skill`） | `index.ts` · `skillTypes.ts` |
>
> 下表按「文件 → 职责」列；**文件名不带目录前缀**，目录见上表。
>
> ⚠️ **本表不写用例编号**：编号是**导出面的分类**，其唯一真源是门面 `index.ts` 的头注释
> （ADR-0044 §8：导出面按用例定义）。此处再抄一份就是第二份真相 —— 2026-09-22 实证：
> 同一张表里 `skillInject` 与 `skillLibraryView` **都被标成 ①**，而门面用的是另一套编号。
> 要查"哪个文件服务哪个用例"，从门面那份清单反查即可（信息不丢）。

| 文件 | 职责 |
|---|---|
| `skillTypes.ts` | 类型真源：`SkillBinding`（P2 冻结）· `SkillConfig` · 包数据形状 · `SkillApiResult`（`RuntimeSkill` 判别联合已按 ADR-0053 删除 —— 零消费者不许预留） |
| `skillBuiltins.ts` | **内置 Skill 的唯一家**（代码常量）。冻结要按 id 找正文 ⇒ 内置与缓存必须**都在模块可达范围内**（它此前住 legacy 层，那正是 P4 装配断裂的根） |
| `skillRegistry.ts` | **「当前全部可用 Skill」的唯一组合点**：缓存 ∪ 内置（缓存优先）；连**读失败**一起给（`{ok,list,error}`，TD-11-66）。内置身份由**它在哪个循环里**决定（不靠字段标记，见不变量 27） |
| `skillManifest.ts` | `SKILL.md` frontmatter 解析/序列化（零依赖手写 · **已知字段只有 `id`/`name`/`description`/`version`**，其余一律走 `unknown` 原样保留 · 解析失败整文件当正文） |
| `skillBudget.ts` | 纯函数：**注入预算**（`SKILL_CONTENT_LIMITS` / `SKILL_LIMIT_SUGGESTED_MAX` / `SKILL_INDEX_LIMITS`）+ 截断（`truncateSkillContent`，`limit<=0` = 一点都不给）。只管"给多少" |
| `skillInjectText.ts` | 纯函数：**发给模型的两块文本**（块① 可用清单 / 块② 本次启用正文）+ 不可信条款（唯一一份字面文本，与「读资料」工具描述共用）。只管"怎么写" |
| `skillResourcePath.ts` | 纯函数：**包内相对路径的准入**。`isTextPackageFile` = **读侧与导入侧共用的那一条**（段合法 + 扩展名白名单）；`assertSafeSkillRelativePath` = 它 ∧ 不危险 ∧ 非 `scripts/**`（读侧专有）；+ `TEXT_RESOURCE_EXT`（唯一扩展名表）+ `extractResourcePaths`（**"带目录才算引用"这条口径在提取侧**，见不变量 4） |
| `skillText.ts` | 纯函数：**文本的取值与清洗** —— `asText`（`unknown` → string 的**唯一实现**，全模块共用）+ `repairMojibakeText`（外部导入的 `.md` 编码修复，含"勿加阈值"实测教训） |
| `skillDirName.ts` | 纯函数：**磁盘目录名规则**（`slugifySkillName` 新造 / `isLegalDirSegment` 围栏 / `uniqueSlugIn` 去重）—— 与后端 `isSafeSegment` 同族，必须被它接受 |
| `skillGroup.ts` | **分组的唯一语义家**：`UNSORTED_GROUP` · 两个伪组哨兵（**门下不转发**）· `SkillGroupKind` · `labelOfGroup`（完整措辞）· `kindOfGroup` · `categoryInputOf` · `orderOfGroup` + `compareSkillGroups`（**组序位次也在这里**，见不变量 24）。列表与下拉**共用**它 |
| `skillApi.ts` | 技能库后端 facade 的调用层（6 端点，返回判别联合，不抛） |
| `skillRepository.ts` | `agent_skills` / `agent_skill_enabled` / `agent_skill_config` 三个键的**唯一读写口**（`agent_skill_usage` 已于 2026-09-22 退役：读侧零显示点，见 `docs/plan/142 §3.10`） |
| `skillHydrate.ts` | 磁盘 → 缓存的收敛（含"空目录=未决不写空"）+ 「补齐 frontmatter id」 |
| `skillPersist.ts` | 网页保存/删除/导入/导出 → **先落盘成功才回写缓存**；换分组 = 新位置写成功后才删旧包；`packageFiles` = **整包导入**语义（提交集合即最终状态） |
| `skillImport.ts` | 整目录导入：按「谁直接含 `SKILL.md`」切包 → 交给 `saveSkillToDisk` 的整包语义写盘（`isImportablePackageFile` = 准入唯一判据；**扩展名表与读侧共用 `TEXT_RESOURCE_EXT`**、单文件上限 = 跨栈常量 `SKILL_MAX_FILE_BYTES`，由 `check:arch` 对账） |
| `skillMigration.ts` | localStorage → 磁盘的一次性迁移（幂等 · 不改写旧键 · 失败原样保留） |
| `skillInject.ts` | `getSkillIndexText`（块① 可用清单）+ `freezeSkillTurn`（块②：发送起点**冻结**，正文与留痕同源；**入参只有 id**） |
| `skillResource.ts` | `setSkillTurnBindings`（发送起点写/结束清）+ `readSkillResource`（模型按需读**本轮启用**且**正文显式引用**的文本资料；拒绝时说清是哪条口径拒的） |
| `skillCloudSync.ts` | `applyCloudSkillsToDisk`（云拉取后把正文**写回磁盘**，让磁盘/缓存/云收敛；`protectIds` 保护未回灌的本地磁盘改动） |
| `skillLibraryView.ts` | **列表视图纯函数** —— "行 = 磁盘包 ∪ 索引状态"的唯一判定中枢（行状态全集 · 组三态 · 组计数 · 可用性判据）。只管"行怎么判、组怎么摆" |
| `skillPickerView.ts` | **选用入口（AI 面板下拉）的分组** —— 与列表同一套 `kind`/`label`（面板不再自己造官方组）；"选得动" = `usable` × `enabled`，**两半都在它这里判**。只管"选得动的那些怎么摆" |
| `skillEntry.ts` | 包**入口文件**（`SKILL.md`）的唯一口径：`SKILL_ENTRY_FILE`（跨栈协议名，与后端对账）+ `findSkillEntryFile` + `skillEntryRelPath`（TD-11-59） |
| `index.ts` | **唯一门面**：按「用例」编排导出（**用例编号的唯一真源 = 它的头注释**），域外只准 import 它 |

> 已退役：`SkillLibraryPanel.tsx`（2026-09-22 · TD-11-44）—— 它把技能画成了**第二个列表**，
> 职责已全部并进设置页的「一个列表 + 工具条 + 右栏」（列表并进列表、按钮进工具条、每包详情进右栏）。

## 3. 不变量（改这个模块前先读）

1. **磁盘 `SKILL.md` 是内容的唯一真相源**；localStorage 是缓存，云同步是副本。
   ⇒ 保存必须"先落盘成功才回写缓存"，落盘失败缓存不更新 + UI「未保存」。
2. **`id` 是 UUID，与目录名解耦**：改名、换组不动 id（否则启用态/绑定会断）。
3. **`scripts/**` 永不进模型视野**：`assertSafeSkillRelativePath` 拒它，后端 `scope=content` 也拒它（两道）。
4. **只有正文反引号/markdown 链接里显式写出的路径才可读**，不是"包内任意文件可读"。
   且**只收"带目录"的引用**（`references/**`，见 `docs/plan/140 §1.1/§1.4`）：包根与 `SKILL.md` 同级的
   裸文件名**不算资料**（否则正文里随手写的 `` `foo.md` `` 会被当成引用）。这条口径**在提取侧**
   （`extractResourcePaths`），**不在安全侧**（`assertSafeSkillRelativePath` 只管"危不危险"，
   它必须放行 `SKILL.md` 这个入口名）—— 两道合取才是"能不能读"，拒绝时**必须说清是哪一道拒的**
   （TD-11-77：从前一律报"正文里没有引用这个文件"，而包根资料其实是被口径拒的 ⇒ **原因说谎**）。
5. **本轮零绑定 ⇒ 块②不出现**：模型据此判断"这次用户有没有发 skill"。块①（清单）默认关且**不含正文**。
6. **组 = 技能库一级目录，一个 skill 只属于一个组**（一维）；组**不存自己的开关状态** ——
   组头显示态（全开/全关/部分）从成员派生，组级开关 = 批量写 `agent_skill_enabled`。
7. **`limit <= 0` = 一点都不给**（**不再有"0 = 不限"那个反直觉约定**，TD-11-26）：`truncateSkillContent`
   返回**空内容 + `truncated:true`**（真空输入才 `false` —— "本来没有"与"有内容但没额度"必须分开）。
   `buildBoundSkillBlocks` 仍先判剩余额度：没额度就不注入并**在尾注点名**（不静默丢、也不假装注入）。
8. **一轮发送只有一份冻结**：`freezeSkillTurn` 在 `send` 起点跑一次，本次发送的**所有**工具轮次
   共用它的 `docs`（否则生成中途的重选/重读会让同一轮对话的前后轮次拿到不同正文）。
   `bindings[].content` 存**全文**（留痕，不可截断），`docs` 才截断 —— 两者同源，不许各算一份。
9. **漂移只提示、不擅动**：`detectSkillDrift` 只读比对（缓存空 ⇒ 无基线不拉盘；后端失败 ⇒ `ok:false`），
   改不改由用户点「重新载入」决定。
10. **两种写语义必须显式区分**（不许靠"磁盘上有没有旧文件"猜）：
    `packageFiles` 给了 = **整包导入**（提交集合即最终状态）；
    没给 = **改这一份**（读旧包、只换 `SKILL.md`、附带文件原样保留）。
    猜错的两种后果都不可预测：导入把旧 `references` 删了 / 更新把别人的 `references` 并进来了。
11. **导入只收文本**：`isImportablePackageFile` 拒隐藏段（`.DS_Store` 会让后端**整包** 400）与二进制
    （模型侧本来读不到，且读成文本会静默损坏内容）。跳过的东西由调用方**如实告知**用户。
12. **模型读资料的边界 = 本轮启用 × 正文显式引用**（`readSkillResource`）：两道缺一不可 ——
    少了"本轮启用"就是"能读用户没启用的技能"，少了"正文引用"就是"能枚举包内所有文件"，两条都是真攻击面。
    绑定由 `send` 起点写入、`finally` 清空（**不清就会串轮**：下一轮没选 Skill 仍能读上一轮的文件）。
13. **云写回不覆盖用户的本地磁盘改动**（`applyCloudSkillsToDisk`）：磁盘内容与缓存不一致 = 用户改过
    但没点「重读」⇒ **跳过写回并如实上报**（"不静默丢用户数据"优先于"三副本一致"）。
    写回仍只经 `saveSkillToDisk` 一条路，本模块不自己碰磁盘/缓存。
14. **`SKILL.md` 是整文件重建的，所以更新必须带过磁盘上原有的 frontmatter**（含 `x-*` 未知字段）——
    不带过就等于"一次保存静默删字段"。
15. **界面上的"技能库"只有一个列表，且骨架 = 磁盘包**（`buildSkillLibraryView`，TD-11-44）：
   索引（缓存）只负责**给行补状态**，永不作为骨架 —— 否则"磁盘上已删除的包"会以正常行出现、
   "磁盘有而索引没有"的包只能在别处冒出来（那就是从前"两个列表"的根）。
   行状态全集：`ok` / `缺 id` / `未纳入索引` / `读不到 SKILL.md` / `仅索引（磁盘上已删除）`；
   提醒（与状态正交）：无描述、引用缺失。空分组（刚建的 / Finder 里建好的）照样列出。
   `_未分类` 只在**有成员**时出现且恒排最后；磁盘读不到时是**未决**（按索引显示 + 显式说明），
   绝不用空清单否定真值。
16. **组名：磁盘上已存在的一律原样使用**，只有**新名字**才过 `slugifySkillName`（`skillPersist.resolveGroupName`）。
   给一个真实存在的目录改名 = 技能落到另一个目录（"明明有这个分组却进了别处"）；`*?"<>|` 这类
   slugify 会剥掉的字符，POSIX/Finder 都能建出来（TD-11-25）。另：`slugifySkillName` 产出后必须再 trim
   一次 —— 截断切在空格上会被后端判"前后空白"直接 400。
17. **frontmatter 空值行 = 不存在**（解析与序列化**同一口径**，`unknown` 也一样）：`version:`（空）
   解析成 `undefined`、序列化省略它 ⇒ 语义幂等对空值样例也成立（TD-11-37：此前只守了已知字段、
   `unknown` 照写带尾空格的空占位，且口径声明的强于实现）。
   注：`when-to-use` / `allowed-tools` / `user-invocable` / `disable-model-invocation` 已于 2026-09-22
   退役为 `unknown`（`docs/plan/142 §3.10`），本口径对它们同样成立（空值不占位）。
18. **能编辑的行，磁盘上一定存在**（`row.editable = state === 'ok'`）：界面保存 = 直接写那个包；
   `saveSkillToDisk` 的"磁盘上没有这个包 ⇒ 按新建写"这一支在界面上**不可达** ⇒ 结构上不存在
   "点保存把已删的技能静默重建"。仅索引的行只能**显式**「恢复（写回磁盘）」或「丢弃」。
19. **保存不静默覆盖外部改动**：给 `baselineHash`（界面渲染时那一版的正文指纹）时，磁盘当前正文
   与它不同 ⇒ 返回 `conflict`（一个字都不写），由界面问「覆盖 / 放弃并加载磁盘版」。
   两个写者（人用编辑器、界面编辑器）真实存在，这是"界面直接编辑磁盘"必须付的成本。
20. **组语义由 `kind` 携带，哨兵值不出门**（TD-11-62）：界面分支读 `SkillGroupView.kind` /
   `SkillPickGroup.kind`（`official` / `index-only` / `normal`），**不许**比较 `name`；
   两个组哨兵（`__official` / `__index-only`）**不导出**，且由架构闸保证"字面量只许住本文件"。
   组名→显示名的映射与输入框预填值（`SkillRow.categoryInput`）也都由视图层给 ⇒ 消费者不认识任何内部名。
   （此前设置页比哨兵、面板**手写**哨兵组 ⇒ 改哨兵值即静默失效，无类型错也无测试拦。）
21. **入口文件名（`SKILL.md`）只经 `skillEntry.ts` 引用**（TD-11-59）：它是**跨栈协议名**（前端建包/解析、
   后端落盘/供数都按它找文件）⇒ ① 取入口文件一律 `findSkillEntryFile(files)`（不许再抄
   `f.relPath === 'SKILL.md'`：散 7 遍时任一处写错就是**一个包静默消失**）；② 拼路径一律
   `skillEntryRelPath(category, slug)`；③ 两侧各留一份常量（两个独立构建产物无法共享模块）由
   `check:arch` 的 `CROSS_STACK_CONSTS` **对账**，并由同一份闸禁止"字面量在定义文件之外再出现"。
22. **组合层连"读失败"一起给**（TD-11-66）：`listAllSkills()` 返回 `{ok, list, error}` —— 缓存读不到时
   `list` 仍然只有内置那批（**降级允许**），但 `ok:false` + 原因必须传出去（**静默不允许**）：
   否则消费者看到的只是"我的技能没了"（真相是"读不到"）。据此：注入侧直接拦住并回报、面板画横幅、
   **且不许拿"只剩内置"的清单去剔已选 id**（一次瞬时读失败 = 用户的选择被抹掉，那是最坏的一种"静默"）。
23. **导出 = 磁盘那个文件逐字**（TD-11-70）：`skillMarkdownForExport` **读磁盘**的 `SKILL.md` 原样给出，
   不从缓存重拼 —— 缓存只留 4 个字段，重拼会让 `unknown`（含已退役的 `when-to-use`/`allowed-tools` 等）静默消失，
   于是"导出→再导入"一轮就缺声明（而导入侧明明"原样带过"，两侧不对称）。读不到 ⇒ `null`，由调用方
   **如实说**降级（"仅正文：frontmatter 声明已丢"），不许悄悄给一份残缺 frontmatter。
24. **组序位次只有一处**（TD-11-74）：官方段 < 普通磁盘组（本地中文序）< `_未分类` < 仅索引收纳段，
   全在 `skillGroup.orderOfGroup`；视图层只"按位次排"。**视图层不许自己认任何哨兵的位次** ——
   否则想改"官方组排第几"的人按 `skillGroup.ts` 头注释进去找不到，会另写一份（判据两个出生地）。
25. **用例编号的唯一真源 = 门面 `index.ts` 的头注释**（TD-11-72/73）：**任何别处都不写编号** ——
   `README §2`、`docs/plan/*`、以及**模块内各文件的头注释**都只写**用例名**（名字自解释；编号要查，
   且抄一份必漂移）。实证：三处编号互不一致，README 表里同一张表把两个文件都标成 ①，
   连模块内 `skillResource` / `skillInject` 的头注释也各挂着旧编号 ⇒ 引用失效。
26. **"本层不判"不许用"缺省值/省略"表达**（TD-11-75）：`rowFromIndex` 的 `state` **无默认值**、
   `buildSkillLibraryView` 的 `enabledMap` **必填**、`buildSkillPickerGroups` 的 `disk`/`enabledMap`
   **都必填**。两条歧路都实证过、都不许走：① 传 `{}` 表达"不判" = **编值**（类型层说这是启用态）；
   ② 改成可选参数 = **危险默认值**（漏传 ⇒ 静默"全部启用"）。正确形态 = 调用方拿**真值**，
   或由**入口**表达（要判的那个入口才收它）。
   推论：**"能不能选"只有一处判** —— `buildSkillPickerGroups` 里 `usable`（结构）× `enabled`（开关），
   调用方只转发真值、不预过滤（同一条判据劈成两半住两层才是真复杂度）。
27. **"取值原语"与"路径准入"各只有一处**（2026-09-22 收口）：`unknown → string` 一律用
   `rules/skillText.asText`（**不许再写本地 `str`/`const x = typeof …`** —— 实测曾有两份：视图层一份、
   `skillRegistry` 一份）；"包内路径段合法 + 扩展名白名单"一律用 `rules/skillResourcePath.isTextPackageFile`
   （读侧与导入侧共用，**差异只在用途**：读侧另拒 `scripts/**`）。两处都是"两侧各写一份 ⇒ 改一处必漂移"。
   推论：**内置身份不靠字段标记** —— `AllSkill.builtin` 由 `listAllSkills` 按"它在哪个循环里"产出；
   别再给 `BuiltinSkillDef` 加 `builtin` 字段（实测那个字段**只写不读**，注释却声称 UI 靠它分组）。

## 4. 门面纪律

- 域外（`settings/`、`agent/panels/` 等）**只准** `import ... from '@/components/agent/skill'`；
  禁引 `.../skill/skillManifest.ts` 之类内部件 —— 否则等于绕过用例编排。
- `agent/index.ts`（域门面）**不做并集转发**（ADR-0044 §7），skill 的出口只在本模块门面。
- 门面导出面**按用例定义**（ADR-0044 §8）—— **用例清单与编号的唯一真源 = `index.ts` 的头注释**，
  本节不复述（复述即第二份真相，见不变量 25）；**不按"当前谁在用"挑符号**；
  但**未实现的用例不许预置空壳**（ADR-0053）。
- ✅ **`runtime/skillStore.ts` 转发壳已删除（2026-09-22）** —— **"域外只走门面"这条纪律从此无例外**。
  过程：TD-11-19（2026-09-21）先让它**不再深引** `skillRepository`（读/写全走本门面，它成纯转发壳）；
  TD-11-50/51/52 把域内实现（`isSkillEnabledIn` / `listAllSkills` / 单文件白名单 / `repairMojibakeText`）
  全部搬进模块并由门面导出；**最后一步删壳**：唯一消费者 `AgentPanel` 的 4 个符号改走门面 ——
  两个订阅键（`SKILLS_KEY`/`ENABLED_KEY`）门面本就转发；`isSkillEnabled(id)` → `isSkillEnabledIn(map,id)`
  （面板**读一次** map、判 N 次，比原来每次调用各读一次更省）；`findSkill(id)` → 面板已持有的
  `skillsRead.list.find(...)`。**能力零损失、门面零新增导出**；`legacy Skill` 形状随之消失。
  ⚠️ `plan142` 原把这一步"排在 B 批之后"——那**只是排序**（B1–B4 动 `SkillSettings`，与面板不撞车），
  不是依赖 ⇒ 前提并未被 B 批锁住，故本轮直接做掉（`ADR-0053` 删前四关全过）。

## 5. 遗留与已结清（逐条带状态；✅ = 已结清，⚠️ = 仍未做）

- ✅ **取用面与列表同源（2026-09-22 · TD-11-55/75）**：AI 面板下拉不再只按索引 —— 面板打开时读一次
  **磁盘现状**（`readDiskSkillPackages`：每包只取入口文件），连同**技能全集**与**真启用态**
  （`readSkillEnabledMap()`）一起交给 `buildSkillPickerGroups(all, disk, enabledMap)`；
  "能不能选"（`usable` × `enabled`）在**那里一处判**，面板不再预过滤（从前"启用"由面板判、
  "可用"由 picker 判 ⇒ 同一条判据劈两半）。"磁盘上已删除（仅索引）"的条目因此**不进下拉**。
  读不到磁盘 ⇒ 快照保持**未决** ⇒ 按索引列出（**不把下拉变空**：读不到 ≠ 磁盘上没有技能）。
- ✅ **旧写路径已删除、壳本体也已删除（2026-09-21 / 2026-09-22）**：壳里曾有
  `upsertCustomSkill` / `deleteCustomSkill` / `saveCustomSkills`（只写缓存不碰磁盘 = 能绕过真相源的写入口）
  —— 那一批先删；**壳本体**（`runtime/skillStore.ts`）随后一并删除，见 §4 最后一条。
  现在写路径只剩本模块门面，域外任何一处都不再有"第二个入口"。
- ✅ **两个"什么都能放"的文件已按变更理由拆开（2026-09-22 · TD-11-60/68）**：
  `skillCatalog.ts`（332 行 / 五类）→ `skillBudget` · `skillInjectText` · `skillResourcePath` · `skillDirName`（+ 组那类并入 `skillGroup`）；
  `skillLibraryView.ts`（518 行 / 行机＋组语义＋选择器）→ `skillLibraryView`（行机）· `skillGroup`（组语义，**两个用例共用**）· `skillPickerView`（选择器）。
  判据 = **"它的变更理由从此与谁无关"**：调预算不再碰块文案、改读权限不再碰目录名、改下拉契约不再碰行状态机。
  ⚠️ 这是**改动半径**的减（不是行数减：逻辑 0 新增，头注释净增）—— 别把它当成"复杂度净减"来引用。
- ✅ **面板「选文件」入口已接回并锁住（2026-09-22 · TD-11-63）**：工具栏「+」→ 隐藏 input
  （`accept` 从模块白名单 `SKILL_IMPORT_ACCEPT` 派生）→ `handleFiles`；`.md` 走模块用例
  `importSkillText` **真落盘**后才选中它（从前把正文交给 `applySkill(对象)` ⇒ 没人接住 + 谎报"已导入"）。
  四条判据由组件测试锁住（`tests/unit/AgentPanel.test.tsx` 的 `选文件（参考图／导入 Skill · TD-11-63）`）：
  走模块用例 / 失败不谎报 / 跳过不静默（超限的**不读进内存**）/ 选完复位 `input.value`。
- ✅ **内置 Skill 已迁进本模块**（`model/skillBuiltins.ts`，2026-09-21）：它此前住 `runtime/skillStore.ts`，
  而冻结（`freezeSkillTurn`）要按 id 找正文 ⇒ 模块自己看不到内置 skill，只能由 UI 把正文镜像着传进来 ——
  这正是 P4「按需读资料」装配断裂（TD-11-16）的根。
  内置常量的消费者（`skillRegistry`、`SkillSettings`、测试）一律从**门面**取。
- `BuiltinSkill` / `RuntimeSkill` / `isUserSkill`（判别联合与收窄）**仍按 ADR-0053 保持删除状态**：
  到现在仍无消费者（模块内用 `BuiltinSkillDef` / `UserSkill` / `AllSkill`；UI 侧见下条）
  ⇒ **与第一个真实消费者同批加回**，不预先找回。
- 导入目前只收文本（`isImportablePackageFile` 只放行 `TEXT_RESOURCE_EXT`）；真要保全二进制资料（图片/字体）
  时再做 base64 通道（ADR-0053：不提前预留。`SkillPackageFile.encoding` 里的 `base64` 是**读侧**形状，
  用来如实标出"这个文件读不成文本"，不是导入通道）。
- ✅ **legacy `Skill` 形状已消失（2026-09-22）**：它随壳（`runtime/skillStore.ts`）一起删掉 ——
  面板不再经任何"legacy 形状"取数据（`skillsRead` 给的就是模块的 `AllSkill`）。
  ⇒ 将来 UI 要改用模块类型时，`RuntimeSkill` 族的**第一个真实消费者**位置是空着的（不预先找回）。
