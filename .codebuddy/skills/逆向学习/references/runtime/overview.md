> 本文件是「逆向学习」技能的一个分支指南。**入口与场景分流见技能根目录的 `SKILL.md`**。


# JS 运行时逆向（运行时抓取 → 本地复现）

> **相关分支**：`references/bundle/overview.md`（"静态还原产物"）↔ 本分支（"动态抓运行时"）。
> **适用**：定位接口签名 / 加密参数 / 风控字段；观察请求链路；运行时抓函数入参与返回值；把页面证据带回 Node 补环境复现。
> **不适用**：目标是二进制 / APK / PE / ELF（用 IDA / radare2 类工具）。

---

## 一、场景分流

| 你要做的 | 走哪条 |
|---|---|
| 把混淆 `dist` 还原成可读源码 | `references/bundle/overview.md` |
| **运行时**抓签名/加密参数、Node 补环境复现 | **本分支** |
| JS 自定义 VM（JSVMP）/ 风控引擎逆向 | 本分支 + `references/runtime/jsvm-deobfuscation.md` |

---

## 二、核心原则（顺序不能颠倒）

- **Observe-first**：先页面观察，不猜环境
- **Hook-preferred**：优先 Hook，其次断点
- **Breakpoint-last**：断点是最后手段
- **Rebuild-oriented**：一切为了本地可复现
- **Evidence-first**：每步留证据，不空想

> 一句话：**先页面观察 → 最小化采样 → 本地补环境**，不要跳过取证直接猜环境。

---

## 三、五阶段工作流

### 1. Observe（观察）
- 打开目标页面 → 找目标请求 → 回溯 initiator → 缩小可疑脚本范围
- **必须产出**：目标请求 URL/特征、initiator 线索、可疑脚本 URL、任务记录

### 2. Capture（采样）
- 对目标请求做**最小侵入**采样：拿参数样例、调用顺序、运行时证据
- 优先"请求断点"，其次"轻量运行时求值"，最后才"文本断点"

### 3. Rebuild（重建）
- 把页面证据整理成**本地可迭代的 Node 复现材料**
- **禁止空想式补** `window/document/navigator/crypto/storage`——必须有页面观测依据

### 4. Patch（补环境）
- 按报错和 **first divergence** 驱动补环境，直到本地脚本稳定跑出目标参数
- 一次只做一个最小补丁，补完立即复测并记录

### 5. DeepDive（深挖）
- 本地跑通后，再做去混淆、控制流还原、业务逻辑提纯
- 只出签名可降级；要**长期复用算法链路**则必须做

> 详细操作 + 具体手法见 `references/runtime/runtime-signing.md`。

---

## 四、工具映射（按你环境里有的选）

| 能力 | 常见实现 |
|---|---|
| 页面/脚本/网络观察 | 浏览器 DevTools、CDP、Playwright |
| 请求断点 / 运行时求值 | DevTools Sources、CDP `Debugger`、注入 Hook |
| 抓包 | 抓包代理（HTTP/WS） |
| 若环境已接入 MCP | `js-reverse_*`（list_scripts / break_on_xhr / evaluate_script / get_paused_info / list_network_requests / get_request_initiator / get_websocket_messages …）；更强浏览器/Hook 面可用 `jshookmcp` |

> 原则：**优先用现成的调试/取证能力，不要先写脚本重造能力**；无法解释为什么要调某个工具时，就别调。

---

## 五、产出与证据化

- 所有重要步骤写入**本地任务产物**（命令 / 脚本 / 截图 / 报告）
- 本地补环境**每次只记录一个最小因果补丁决策**
- 输出结构见 `references/runtime/runtime-signing.md` 的"证据化输出"

---

## 六、参考文件索引

| 文件 | 什么时候读 |
|---|---|
| `references/runtime/runtime-signing.md` | 定位签名/加密参数、Node 补环境、证据化输出 |
| `references/runtime/jsvm-deobfuscation.md` | 目标含 JS 自定义 VM（JSVMP）/ 风控引擎 |

> 移植自通用逆向库的 `js-reverse` 与 `dsl-vm-reverse`，已剥离其 MCP / 路由 / 自举依赖。
