# Handoff — 2026-07-24 C 阶段 16/26 已合并，剩余 11 待补

> **给下一位 AI**：先读 `CLAUDE.md`，再看 `docs/拆分计划.md` §11 终局路线图。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `main` @ `60a1c1a`（已推送） |
| App.js | 43,768 行，16 个函数体已语义化（a,b,c→updateNodeData,loading...） |
| 剩余 | 11 个函数体待重写，3 份任务书在 `docs/agent-tasks/` 等待执行 |

---

## 本周完成

### A. 注释化（§8 ✅）
- 287 个模块级函数全部标注中文说明
- 6 本字典建成：func-mapping(271) + var-mapping(301) + vendor-mapping(199) + 节点契约 + 事件字典 + KV读写面

### B. 重命名（§9 ✅）
- 27 个节点组件名全部语义化：`li→ImageNodeComp`, `Ya→PromptNodeComp`...
- 翻车点：逗号链声明无 `var` 前缀，sed 漏匹配；`\bword\b` 在 macOS sed 不认

### C. 安全网（新建）
- `scripts/safety-net.cjs`：3 层验证（文件大小 + 26 节点 JSX 结构 + 构建哈希）

---

## 5 个常驻脚本

```
safety-net    — --snapshot 建基线 / --check 3层验证
check-build   — 不用 Chrome 的静态分析（错误签名/注释/TDZ/语法）
vendor-lookup — 查 vendor 混淆名来源（如 Dj→Three.Texture）
summarize     — 单函数摘要（参数/hook/依赖/JSX 骨架）
annotate      — 基于映射表刷新 App.js 注释
status        — 项目状态速览
```

---

## 当前进行中：函数体重写（C 阶段）

### 已完成（16/26，已合并到 App.js）
AB02(gridSplit,gridMerge) AB03(全3) AB04(audio,audioPlayer) AB05(全3) AB06(全3) AB08(全3)

### 待补（11 个函数，3 份任务书）
| 任务书 | 函数 |
|--------|------|
| `docs/agent-tasks/TASK-01` | AB01: ImageNodeComp, PromptNodeComp, TextNodeComp |
| `docs/agent-tasks/TASK-02` | AB02-CropNodeComp + AB04-CustomNodeComp + AB07 全3|
| `docs/agent-tasks/TASK-03` | AB09: GroupNodeComp, Nh, StickyNoteNodeComp |

每份任务书已内嵌变量映射表 + 行号 + 代码块模板（填空题，不是探索题）。

### 合并流程
1. agent 填各自产出文件的代码块
2. `node scripts/merge-rewrites.cjs` 逐函数验收 + 全量 check-build
3. 自动备份 + 失败回退

### 教训（已写入 `.codebuddy/commands/任务安排工作流.md` §八）
- 不给映射表+行号 → agent 写脚本自动化（返工 2 轮）
- 先跑合并看结果，别人工判断谁完成谁没完成
- 任务书必须自包含，agent 不知道别人存在就无从抄袭

## 终局路线图（`docs/拆分计划.md` §11）

```
C.函数体重写 🚧 → D.vendor翻译层 ⏸️ → E.新代码直连 ⏸️ → F.旧代码替换 ⏸️
```

D 阶段：建 `vendor-readable.js`（199 导出→标准库翻译层），vendor.js 原样不动。

---

## 改码标准流程

```
1. status          了解当前状态
2. safety-net --snapshot  建基线
3. 改代码
4. safety-net      3层验证
5. build + check-build  编译+静态分析
6. 提交
```
