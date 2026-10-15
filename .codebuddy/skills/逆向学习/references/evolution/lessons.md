> 本文件是「逆向学习」技能的**经验库**（自我进化的沉淀层）。机制说明见 `references/evolution/overview.md`，入口见 `SKILL.md`。

# 经验库（lessons）

**读法**：开工前扫一遍下面的「活跃条目」表，优先看 `[确证]` 和「命中次数 ≥2」的行。

**写法**：一条一记录，**唯一键去重**（同键只累加命中次数，不新增行）。推荐用脚本：

```bash
node scripts/evolve.cjs add --branch <A|B|C|D|G> --type <坑|工具|判据|分支缺口|反模式> \
  --key <域/短名> --symptom "现象" --cause "根因" --fix "修法" --confidence <确证|推断|待验证>

node scripts/evolve.cjs hit     --key <唯一键>                              # 又遇到同一个坑
node scripts/evolve.cjs promote --key <唯一键> --target references/bundle/xxx.md
node scripts/evolve.cjs list    [--status 新增] [--branch B]
node scripts/evolve.cjs stats
node scripts/evolve.cjs archive                                             # 已归档/已废弃 → archive/
```

**状态机**：`新增` →（达标）→ `已晋升 → <目标文件>`；失效则 `已归档` / `已废弃`。
**晋升判据**：同键命中 ≥2 次并复现，或一次命中造成路径作废/数据损坏级事故。详见 `overview.md` 第 5 节。

---

## 活跃条目

| ID | 日期 | 分支 | 类型 | 唯一键 | 现象 | 根因 | 修法·判据 | 置信度 | 命中次数 | 状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| L-0001 | 2026-10-10 | G | 判据 | `skill/one-branch-at-a-time` | 一次任务里同时开多条分支（读源码 + 反混淆 + 抓签名），主上下文被占满，每条都停在半途 | 分流后没有锁定"本次主攻分支"，四条分支各自都有下一步 | Phase -1 定界时写明"本次主攻 X 分支，其余仅记台账不分头挖"；主攻分支收尾后再决定是否追加 | [推断] | 1 | 新增 |
| L-0002 | 2026-10-10 | G | 分支缺口 | `branch/gap-native-packaged` | 目标是 PyInstaller / Nuitka 打包的 Python 产物或移动端 App，四条分支（源码 / 混淆 bundle / JS 运行时 / Electron）都不覆盖 | 「场景分流」表只覆盖 web / JS / Electron 三类形态 | 临时按最接近分支扩展（A 的方法 + pycdc/uncompyle 反编译）；命中 ≥2 次则开分支 E 并新建 `references/<新分支>/overview.md`（带 `[待验证]` 标头） | [推断] | 1 | 新增 |
| L-0003 | 2026-10-10 | B | 坑 | `bundle/map-first` | 目标产物带 `.map` 却直接跑了整条反混淆流水线，白干数小时 | 分流后没先查 `.map` 就进入工具链 | 分流第一步先查 `.map`；命中则 `reverse-sourcemap` 直达源码，跳过整条流水线 | [确证] | 1 | 已晋升 → `references/bundle/toolchain.md` |
| L-0004 | 2026-10-10 | G | 反模式 | `skill/index-dangling-ref` | SKILL.md 索引表列了 3 个 Electron 参考文件，实际目录只有 overview.md 一个，照索引去读会落空 | 改分支时新增了索引行，但没有做「索引 ↔ 实际文件」对账 | 改索引后对账一遍：逐行核路径是否存在（列目录比对）；不存在的行要么补文件，要么摘掉 | [确证] | 1 | 新增 |
| L-0005 | 2026-10-10 | B | 判据 | `bundle/lib-app-separation` | 还原出的源码里库代码与应用代码内联在同一模块（shared.js 43k 行：库声明 1573 / 应用声明 727），直接拿去重写会被库代码淹没 | esbuild/rolldown 把依赖内联进业务 chunk，webcrack 拆分无法区分库与应用 | 还原后必须做库/应用分离：用 @license 横幅 + 库标记划出库区域，其余为应用，产出纯业务逻辑清单再重写 | [确证] | 1 | 新增 |
| L-0006 | 2026-10-10 | B | 坑 | `bundle/inlined-react-double-instance` | 构建通过但真机 TypeError: Cannot read properties of null (reading useEffect)，dispatcher 为 null | bundle 自带内联 React（18.3.1），02_split 却给组件注入 npm react，两份实例；内联 React 与应用代码同模块，无法靠 alias shim 缝合（循环依赖 TDZ） | 统一切到 npm React（版本与内联版对齐）：让 React 命名空间指向 npm react + 入口 bootstrap 换 npm react-dom/client + 组件还原为 import * as X from react | [确证] | 1 | 新增 |
| L-0007 | 2026-10-10 | B | 工具 | `bundle/webcrack-artifact-forms` | 构建报语法错：Object.prototype.function hasOwnProperty() { [native code] }.call / { function Object() { [native code] }: zl } | webcrack 伪迹不止 .NAME 与 NAME( 两种形态，还有对象属性名 NAME: 与裸形式 | 扩展 00_sanitize.cjs 覆盖 NAME: 与裸形式（Object 映射为 constructor） | [确证] | 1 | 新增 |
| L-0008 | 2026-10-10 | B | 工具 | `bundle/fix-esm-shared-component-refs` | 真机 ReferenceError: _Component48 is not defined（入口 render 调用落在 shared.js 里） | fix_esm.cjs 的组件引用改写只对非 shared 文件生效 | shared 文件也做组件改写，但用 topLevelBindings 跳过本地已定义符号 | [确证] | 1 | 新增 |
| L-0009 | 2026-10-10 | B | 判据 | `bundle/app-code-english-signals` | 应用代码 566/727 声明无中文串，只按中文串归类会漏掉大半 | 应用代码大量使用英文属性名（nodes/edges/vids/jobs/fingerprint） | 归类证据必须同时取中文串 + api.* 调用 + 高频英文标识符三者 | [确证] | 1 | 新增 |
| L-0010 | 2026-10-10 | G | 反模式 | `skill/docs-before-code` | 逆向文档没出全就动手写实现（搭骨架/定目录/写类型/mock），架构一被质疑就整段返工 | 把'准备工作'误解成'搭骨架'；文档只是第一步，架构与契约必须由文档推导、定稿后再动手 | 硬门禁：00~08 未出齐 + 架构与契约未定稿前，禁止写任何实现代码；动手前先过交付门禁清单 | [确证] | 1 | 已晋升 → `SKILL.md（执行约定 7 + 交付门禁）` |
| L-0011 | 2026-10-10 | G | 判据 | `skill/verify-docs-against-source` | 全由 AI 撰写的逆向文档存在内部错误：实测 12 组关键事实中 6 组需修正（桶归属 26.4% 误分、漏一整个子系统、localStorage 键少 4 个、降级链多算一条死通道） | 文档是转述产物必然有损耗；自动分类的正则是拟合出来的，存在不可消除误差 | 定架构前必须做交付门禁复审：列出架构依赖的关键事实，逐条回源核对（不是 doc-vs-doc 自证），并量化误差；自动分类结果只能当起点，不可直接当架构依据 | [确证] | 1 | 新增 |
| L-0012 | 2026-10-10 | G | 判据 | `arch/single-sync-point` | 画布状态(nodes/edges/library)与工程状态(projects[].data)各存一份；改画布没同步进工程 ⇒ 持久化写的是旧数据，刷新即丢（实测：内存 3 节点 / 落盘 1 节点） | 把「同一份数据」在两个地方各存一份（重复 state），却没有唯一的同步点；各 slice 自己管自己 ⇒ 必然漂移 | 跨 slice 的一致性只允许一个同步点：放在 store 的组合处（setPartial）做镜像；禁止在多个 slice 里各写一份同步逻辑。判据：任何「两份拷贝」都必须能指出唯一的同步位置 | [确证] | 1 | 已晋升 → `SKILL.md（重写阶段硬判据 1）` |
| L-0013 | 2026-10-10 | G | 反模式 | `verify/harness-false-failure` | 端到端测试报失败，但实现是对的：① addInitScript 每次导航都重跑，刷新时把数据重置回种子；② 双击坐标落在 MiniMap 浮层上，节点根本没创建 | 测试脚手架自身有状态/几何缺陷，被误读成产品缺陷 ⇒ 浪费排查时间，甚至改坏正确实现 | 写端到端测试时先自检脚手架：① 初始化脚本必须幂等（判空再写）；② 交互坐标必须排除浮层与已存在元素（网格扫描）；③ 失败断言不要耦合其它步骤的产物（否则失败相互掩盖） | [确证] | 1 | 已晋升 → `SKILL.md（重写阶段硬判据 2）` |

---

## 已归档 / 已废弃

> 主表活跃条目 > 80 行时，用 `node scripts/evolve.cjs archive` 把 `已归档` / `已废弃` 行移到这里（`archive/lessons-<yyyy>.md`）。

（暂无）
