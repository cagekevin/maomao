# Handoff — 2026-07-24 §8 注释化完成，§9 重命名完成，§10 拆解待

> **给下一位 AI**：先读 `CLAUDE.md`，再看 `docs/拆分计划.md` §11 终局路线图。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `main` @ latest |
| App.js | 43,768 行，287 函数全可读，27 节点已语义化 |
| 未推送 | 若干提交，等网络恢复 |

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

## 当前进行中：函数体重写（AB01-09）

9 个 agent，每人 3 个节点。在 App.js 内重写函数体（局部变量语义化 + 段落注释）。

**流程**：
1. agent 填 `docs/annotate-body-tasks/AB0X.md` 的代码块（**禁止直接改 App.js**）
2. `node scripts/merge-rewrites.cjs` 逐个验收并写入
3. 验收标准：有段落注释 + JSX 不丢 + 逐函数 build 通过
4. 自动备份+失败回退

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
