# TASK-001（AI02）· 撰写《模型调度机制》模块专题文档

> 本文件是【任务书】，复制下方"任务 prompt"整段发给执行 AI（AI02）即可。
> 产出文件名固定为 `docs/AI02/模型调度机制.md`，执行 AI 禁止改动其他文件或其他 AI 的目录。

---

## 任务 prompt（复制以下全部内容发给执行 AI）

你是一名资深前端代码文档工程师。请为开源项目「maomao」撰写一篇模块专题文档：《模型调度机制》。

===== 项目背景（直接采信）=====
- maomao 是基于 React + Vite 的前端画布 / AI 工作流应用。每个生成类节点（绘图/文生文/视频/sd2Video/折扣视频等）都要选一个"模型"去调用 API。
- 本项目里"模型选择"有两种形态，文档必须都覆盖并厘清关系：
  1) **普通模型选择**：节点的 `selectedModel` 是一个具体模型名（来自该节点类型对应的配置列表，如 `drawingModel`/`textModel`/`videoModel`/`sd2VideoModel`/`discountVideoModel`，这些是换行分隔的模型名字符串）。
  2) **模型调度（schedule）**：`selectedModel` 可为 `schedule:<id>` 形式的引用，指向一条"调度配置"。调度配置把多个模型按 steps（每步 `model` + `retries`）排成一条**失败重试 / 故障转移序列**，运行期按顺序逐个尝试，某个模型失败就自动切下一个。
- 调度配置由 `src/services/modelSchedules.js` 管理，存于 localStorage 键 `modelSchedules`（常量 `ta`），并随 GAS 云同步。

===== 硬性约束（最重要）=====
- ❌ 绝对禁止阅读、参考或引用 `docs/模块专题/模型调度机制.md` 这个现有文件，也不要照搬任何现成专题文档的结论。
- ❌ 禁止修改、覆盖项目里任何已有文件，尤其不要动其他 AI（AI01）目录下的文件。你只【新增】本 AI 自己的产出文件。
- ✅ 必须基于源码自行探索：grep 关键字（建议：`调度` / `schedule` / `modelSchedules` / `MODEL_SCHEDULES` / `schedule:` / `va(` / `_a(` / `mutiwindow-open-schedule-settings` / `modelSchedules:change` / `retries` / `steps` / `selectedModel` / `drawingModel` / `textModel` / `videoModel`），逐文件 Read，从代码事实重新推导。
- ✅ 可参考同目录其他模块专题文档（如 `会员与登录机制.md`、`画布模板生命周期.md`、`GAS云同步机制.md`、`中转站与素材.md`）的【写作格式与风格】，但内容必须独立从源码得出。

===== 探索起点（优先读，再顺藤摸瓜）=====
- `src/services/modelSchedules.js`（核心，全部导出函数逐一看）：
  - `ia` 重试数归一化（1–3）；`aa` steps 校验（最多 5 步、总 retries≤10）；`oa` 调度对象校验（category∈text/image/video，默认 image）；`sa` 生成 id（`sch_...`）；`ca` 算总重试数；
  - `la` 从 localStorage 读取、`ua` 写 localStorage+派发 `modelSchedules:change` 事件、`da` 写 localStorage+存储层 `Q.setObject`；`fa` 新增/更新、`pa` 删除、`ma` 启停；
  - `ha` 订阅（监听 `modelSchedules:change` 自定义事件 + `storage` 事件，跨标签页同步）；`ga` 拼 `schedule:` 前缀、`_a` 解析；`va` 把 steps 扁平化成"按 retries 重复的有序模型数组"（上限 10）；`ya`/`ba` 按 id 合并数组；
  - `xa` 启动时从存储层 `Q.getObject(ta)` 载入到 localStorage；`Sa` 从云拉取合并后保存（GAS pull 用）。
- `src/App.js`（关键行区参考，务必逐一确认并给行号）：
  - 约 L23：引入 modelSchedules 全部函数；
  - 约 L2119–2121 / L2141–2145：绘图节点 `_a(z)` 解析 `schedule:` → 找到调度对象 `le`；非调度时回退用 `drawingModel` 首项；
  - 约 L2890–2972：绘图节点模型选择器，"调度"徽标（`调度：${le.name}`）、"模型调度"入口、"配置 ›"按钮派发 `mutiwindow-open-schedule-settings`；
  - 约 L32335–32358：**运行期调度核心**——`va(t)` 扁平化 → `for` 循环逐个模型 `await n(a)` 尝试，日志 `调度「name」：尝试 i/n · model`；`_a(e)` 把 `schedule:<id>` 解析为一条 enabled 调度；
  - 约 L3414–3420 / L3834–3902：文生文节点同样的调度解析与选择器；
  - 约 L40882–40888：监听 `mutiwindow-open-schedule-settings` 打开设置面板；
  - 约 L37941–37955：调度设置面板里的 `schedule` 项（onEdit/onDelete/onToggle）；
  - 视频/sd2Video/折扣视频节点的模型选择器与调度徽标（搜索 `调度`/`schedule:`/`drawingModel` 等，列出每个节点类型出现处）；
  - GAS 同步：`syncToCloud` 推送键集合含 `modelSchedules`（约 L41062，含 `t === 'modelSchedules' ? la() : ...`），pull 合并用 `Sa`（约 L41132 附近，确认 modelSchedules 分支）；以及 `xr()`/`xa()` 启动加载。
- `src/config/storageKeys.js`（`MODEL_SCHEDULES = 'modelSchedules'`）、`src/config/constants.js`（`ta = 'modelSchedules'`）确认键名一致。
- `src/services/modelEntitlements.js`（模型权益）：调度只决定"尝试哪些模型及顺序"，最终每个模型能否调用仍受 entitlements 门控——说明两者衔接。

===== 内容必须覆盖的完整生命周期（缺一项不合格）=====
1. 这是什么：模型调度机制的定义；与普通模型选择的关系；一条调度 = 失败重试/故障转移序列；适用节点类型（绘图/文生文/视频等）。
2. 存储与数据结构：键 `modelSchedules`（`ta`）存于 localStorage + 存储层 `Q`；一条调度对象的字段（id/name/category∈text|image|video/enabled/steps[{model,retries}]/createdAt/updatedAt）；`schedule:<id>` 引用约定；steps 校验规则（最多5步、retries 1–3、总≤10，`aa`/`ia` 实现）。
3. 创建 / 编辑 / 删除 / 启停：调度设置面板（`mutiwindow-open-schedule-settings`）如何增删改；`fa`/`pa`/`ma` 对应操作；UI 项（`onEdit/onDelete/onToggle`）。
4. 选择调度：节点 `selectedModel` 为 `schedule:<id>` 时，`_a` 解析、`ga` 构造；模型选择器显示"调度"蓝色徽标（绘图 L2890、文生文 L3834 等）；非调度时回退用该类型默认模型列表首项。
5. 运行期调度逻辑（核心）：`va` 把 steps 扁平成有序模型数组（上限10）→ `for` 循环按序尝试 `await n(model)`，失败自动切下一个；日志格式；`_a(e)` 解析并只取 enabled 调度（L32356）。说明这就是"故障转移/重试"机制。
6. 与模型权益（modelEntitlements）的衔接：调度决定顺序，entitlements 决定单个模型是否可用；两者如何叠加。
7. 订阅与跨标签页 / 云同步：
   - `ha` 订阅 + `modelSchedules:change` 自定义事件 + `storage` 事件（跨标签页实时刷新）；
   - GAS 云同步：`syncToCloud` 推送 `modelSchedules`（用 `la()`）、pull 合并用 `Sa`（`ba`/`ya` 按 id 合并）；`xa` 启动加载。明确写出调度配置可跨设备同步。
8. 本地模式：调度是纯本地配置，本地模式下直接用模型名调用（结合 entitlements 的本地放行），不受官方账号影响。
9. 出现的所有地方（重点枚举）：每个节点类型（绘图/文生文/视频/sd2Video/折扣视频）的模型选择器与"调度"徽标、配置入口、运行期调度循环（L32335）、GAS 推送/合并点、订阅事件、启动加载——逐条给出文件路径+行号。
10. 改码前必查：键名一致性（`ta`/`MODEL_SCHEDULES`/`modelSchedules`）、`schedule:` 前缀编解码、retries 上限与 `va` 上限10、GAS 合并按 id 去重、自定义事件与 storage 事件订阅的移除避免泄漏。

===== 输出规范（沿用项目现有风格）=====
- 开头"事实锚点"块：说明基于 grep 哪些目录、行号快照日期，强调"行号随构建漂移，主引用用函数语义名 + 真实路径，动手前回源码复核"。
- 只写代码里【已存在】的机制，不写方案、不写待决策、不臆测未实现功能。
- 代码片段统一用 ```text 围栏，上方用 `路径:行号` 标注来源。
- 混淆变量名标注语义（如 `va = 扁平化调度序列`、`_a = 解析 schedule: id`、`la = 读取调度列表`、`fa = 新增/更新调度`、`ha = 订阅变更`）。
- 层级清晰，便于按需查阅；结尾给"改码前必查"。

===== ⚠️ 产出文件（铁律：唯一文件名，且只在自己 AI 文件夹内）=====
- 必须把文档写入：**`docs/AI02/模型调度机制.md`**
- 禁止写入、修改、删除 `docs/AI01/` 下任何文件，也禁止改动 `docs/模块专题/` 下任何已有文件。
- 若本文件已存在则在其基础上补充，不要清空重写（避免冲突）。

===== 验收标准 =====
- 未参考现有模型调度机制文档，但结论与源码一致。
- 覆盖上述 1–10 全部章节，第 9 章"出现的所有地方"枚举完整（用 grep 证明找全，尤其是每个节点类型的调度徽标与配置入口）。
- 第 5 章运行期调度循环必须用真实代码（L32335–32358）说明故障转移/重试顺序。
- 第 7 章对 GAS 同步给出明确结论（推送 `la()`、合并 `Sa`，带证据）。
- 每个关键结论带真实文件路径 + 行号，可二次复核。
- 产出文件名为指定的 `docs/AI02/模型调度机制.md`，未触碰其他文件/目录。
