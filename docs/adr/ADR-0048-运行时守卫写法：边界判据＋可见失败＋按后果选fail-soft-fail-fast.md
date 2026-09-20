# ADR-0048 · 运行时守卫写法：边界判据 ＋ 可见失败 ＋ 按后果选 fail-soft/fail-fast

- **状态**：生效
- **结论**：关键链路唯一入口处放置运行时守卫：判据用可机判事实、失败可见且精确定位、按后果选 fail-soft（剥离照存）或 fail-fast（早失败带指引）。守卫＝架构规则代码化。
- **日期**：2026-09-20
- **裁定人**：架构师（取证后自定）
- **触发**：用户原话"你看他这个守卫一下子就能找到 bug，所以我需要守卫"——指 `tasks.ts` 的 `upsertTask` 守卫（TD-08-38）。实证取自 TD-08-38 / TD-03-18 / TD-02-6 / TD-05-13 / TD-03-6③ 等多处运行时守卫。

## 背景

本仓已散落多个**运行时守卫**（代码里实时拦截/剥离/归一/告警，区别于 `scripts/check-arch.mjs` 那种 CI 期静态机器闸）：

- A. `tasks.ts:150-235` `upsertTask` + `EXECUTION_OWNED_COLUMNS`：前端越权写执行态列 → 剥离并 `console.warn`。
- B. `tasks.ts:89-134` `ALLOWED_TASK_COLUMNS` + `taskToRow`：过滤前端 Task 对象携带的 UI 字段（loading 等）。
- C. `useNodeData.ts:135-147` `patchData` + `normalizeChipFieldWrite`：写 `prompt/text` 时原子裁剪孤儿 `creativePresets`（字典 GC 不变式）。
- D. `providerStore.ts:182-227` `normalizeProvider` / `toRawModelList`：外部/API 来源收窄为 `Provider`，保留未知扩展字段。
- E. `filesApi.ts:319-335` `uploadFileToLocal` + `isKnownUploadDir`：写侧自查落盘目录未登记 → 立刻失败，后端仍独立强校验。
- F. `useResourceMoveToFolder.ts:66-71` `tryParse`：拖拽载荷非合法 JSON → 必留痕但本次拖拽优雅忽略。

这些守卫**各凭经验、写法不一**，缺统一配方：新人写守卫时常拿不准——判据用身份还是事实？失败静默还是告警？剥离还是拒绝？丢未知字段还是留？本 ADR 把"集大家所长"提炼成可复制配方，供后续在关键链路唯一入口处照搬。

**与静态 `check-arch` 的分工**：`check-arch` 管结构/分层（机器可判、CI 跑、`ADR-0041` 机器可判定性 + 反向判据哲学）；本 ADR 管**请求/写回/归一处的实时边界判据**。两者哲学相通（判据可机判、优先反向判据），落点不同——一个是"提交前拦结构漂移"，一个是"运行时拦数据越权"。

## 判据（它凭什么成立）

1. **守卫的价值已被实证**：A 因"用事实判据（`request_data._relayPoll` 存否）而非身份（前端一律禁）"，避免了文本/chat 任务被误伤卡在 running（A 注释 `tasks.ts:177-182` 自述一刀切会造回归）。E 因"写侧早失败"把报错点从后端 400 拉到最靠近调用处（filesApi.ts:327-329）。证据确凿。
2. **枚举白名单显"必漏"弱点**：B 的 `ALLOWED_TASK_COLUMNS` 注释自承"只有这些列才能写入"——每加一列要改名单（正是 `check-arch` 文件头 `:25` 说的"清单必漏：漏一个目录就要再改一次闸，这本身是母体"）。A 用谓词判据更抗演化。
3. **drop vs preserve 选错会丢数据**：D 用 `...p` 保留 `volcengine_*` 等合法扩展字段，避免 round-trip 丢数据；若按 B 的"白名单丢弃"思维会误删。未知=噪声才丢，=合法扩展则留。
4. **静默吞 = 不可见 bug**：F 注释"坏 JSON 必须留痕（写入侧 bug 不能静默）"；A 注释"失败必须可见"。与 `ADR-0011`（catch 禁静默吞退回判据层）、`ADR-0002`（压平必须留痕）同脉。

## 决议

写运行时守卫时，逐条对照：

1. **守卫内联在写点，使违规绕不开**。守卫必须是 mutation 内的一步，不是"注释提醒记得调"。
   - 例：C 的字典 GC 在 `setNodes` updater 内（`useNodeData.ts:138-144`），写 `prompt` 就不可能不带 GC；A 的剥离在 `upsertTask` 内（`tasks.ts:207-222`）。
2. **判据用可机判事实，不用身份/全局假定**。"谁是执行方"由可查事实定，不是"前端一律禁"。
   - 例：A 用 `hasRelayPollHandle` 查 `request_data._relayPoll` 存否（`tasks.ts:186-197`）；E 用 `isKnownUploadDir` 注册集判目录合法性。
3. **列/字段级粒度，非整行/整对象粒度**。只拦越权列，其余照存。
   - 例：A、B 都是列级 `Set`，前端非越权列（`prompt`/`custom_output_type`）照常落库。
4. **默认最小权限 + 显式 opt-in**。受限路径是"主动声明"，不是默认。
   - 例：A `opts.owner ?? 'poller'`——后端默认全权，前端须显式传 `client` 才进受限分支（`tasks.ts:204`）。
5. **失败必须可见 + 精确定位 + 给修复指引**。禁静默吞（上承 `ADR-0011`/`ADR-0002`）。
   - 例：A `console.warn('[upsertTask:client-blocked]', { task_id, cols: blocked })`（`tasks.ts:217-220`）；E 返回"落盘目录未登记：X（系统产物根下新增子目录须在 uploadDirs.ts 备案）"（`filesApi.ts:264-268`）——不仅说错，还告诉怎么改。
6. **留痕归"产生失败/拥有 UI"那层，中转层只转发**。避免重复留痕与噪声。
   - 例：filesApi.ts:221-223 删掉中转层多余 `logger.warn`（"消费者只转发，禁止自己加工"）；useAssetDropPaste 越权边界"消费者只转发不解释"。
7. **fail-soft 还是 fail-fast，按后果选**：
   - **可安全继续 → fail-soft**（剥离/归一后照存，数据不丢）：A、B 剥离越权列/UI 字段照存；C 字典 GC 后照写。
   - **继续会错/需早暴露 → fail-fast**（立即失败带精确信息）：E 目录未登记立即返回 `UploadOutcome{ok:false,message}`，比等后端 400 更近调用点（filesApi.ts:326-335）。
8. **drop-unknown 还是 preserve-unknown，按语义**：unknown = 噪声才丢（B 丢 `loading`）；unknown = 合法扩展则留（D `...p` 留 `volcengine_*`）。
9. **脏值 fail-open 并留痕，不据此夺权**。拿不到事实时不惩罚合法写方。
   - 例：A `hasRelayPollHandle` 解析不了 → 按"无句柄"处理 + 另打 `request_data-unparsable` 告警，不误剥前端写权（`tasks.ts:186-197`）。
10. **两层独立校验，不信任调用方/客户端**。前端查 + 后端再查（后端不信任客户端）。
    - 例：E 前端 `isKnownUploadDir` + 后端 `SUB_DIR_ALLOW` 各自强校验（filesApi.ts:329）。
11. **合并优先，不抹历史**。守卫用合并写，不覆盖式抹掉既有真相。
    - 例：A `{...existing, ...incoming}` UPSERT 合并，禁 `DELETE+INSERT` 抹掉已落库诊断字段（`tasks.ts:223`）。
12. **守卫注释自带"真相归谁 / 为什么 / 触发时怎么办"**。让守卫自解释、可维护。
    - 例：A 长注释写清"执行态归后端 relay-poll""旧后写者赢 corruption""频繁触发=补后端终态写而非放开判据"（`tasks.ts:136-149, 215-216`）——接手人一看就懂为何这样写、告警频现时该修哪。
13. **开放式集合优先"结构/反向判据"而非枚举白名单**（跨 `ADR-0041`/check-arch 反向判据）。能用结构特征判定（"是否含 `_relayPoll`""是否走唯一写入口"）就别枚举。
    - 反例：B 的 `ALLOWED_TASK_COLUMNS` 是枚举白名单，带"必漏"弱点；正例：A 谓词判据、check-arch 规则 18 用 `patchData({ images` 反向形态判定（`scripts/check-arch.mjs:2092-2132`）。

## 后果

- ✅ 关键链路唯一入口处可系统性复制"边界判据 + 可见失败"守卫，bug 在产生处即被精确定位（即用户欣赏的"一下子找到 bug"）。
- ✅ 与 `ADR-0041` 机器可判定性、`ADR-0045` 断环不造第二入口、`ADR-0016` 闸不许凌驾正确性形成"静态闸 + 运行时守卫 + 唯一入口"三层防线。
- ⚠️ **代价**：每个守卫需写判据 + 注释 + 失败出口，比裸写多几十行；但省下的是"后写者赢"式静默 corruption 的排查成本（A 注释 `tasks.ts:143-148` 载明的真实事故）。
- 📌 **复用入口**：新增守卫前先读 A（`tasks.ts:136-235`）作模板——它是本项目最完整的运行时守卫范例。

## 违反时的判据

1. 守卫只写注释、没内联在写点 → 可绕开（违反决议 1）。
2. 守卫按身份一刀切禁写（而非按事实） → 误伤合法写方、造回归（违反决议 2；A 已证伪）。
3. 守卫静默吞（无 warn / 无返回值表达失败） → 违规不可见（违反决议 5；`ADR-0011`/`ADR-0002`）。
4. 该 fail-fast 却 fail-soft（继续写错数据）或该 fail-soft 却 fail-fast（丢掉合法数据） → 后果错配（违反决议 7）。
5. 用枚举白名单管开放式集合、且未配反向判据 → 漏判（必漏，违反决议 13；`check-arch:25` 已证）。
6. 中转层重复留痕 / 消费者替生产者判定错误显示 → 噪声且越权（违反决议 6；`CLAUDE.md` §5.1 三铁律：生产者给全 · 消费者只转发 · 不越权）。
