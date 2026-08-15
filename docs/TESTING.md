# 原型测试地基（react-nodes）

> 本目录的测试体系，作为原型（`prototypes/react-nodes`）开发 / 提交 / 交付前的质量门禁。
> 借鉴了 1mao（根目录 `scripts/`）的 health-check / safety-net 思想，并按原型（jsx + vite + 插件）做了适配。

## 一、快速上手

```bash
npm test                 # 等价 npm run test:all：跑统一测试门禁（推荐）
npm run check:health     # 工程健康度全量检查（含构建 + 测试 + TDZ + dist 基线）
npm run build            # 构建插件包（dist/）
```

日常改代码后，提交前跑一次 `npm test` 即可。

## 二、命令总览

| 命令 | 说明 | 阻塞? |
|---|---|---|
| `npm run test:smoke` | 静态检查：JSX 语法 / ReactFlow API 误用 / 节点注册 / 依赖 | 是 |
| `npm run test:regression` | SSR 渲染 4 个核心节点 + 断言关键结构 class（能渲染不崩） | 是 |
| `npm run test:tools` | Agent 工具层验证（create/delete/update/connect/read_canvas） | 是 |
| `npm run test:all` | **统一门禁**：上面三者一次跑完，任一失败退出码 1 | 是 |
| `npm test` | 等价 `test:all` | 是 |
| `npm run check:health` | **工程健康度全量检查**（见下节） | 是 |

## 三、check:health 检查项

`scripts/health-check.cjs` 一键检查 6 大项：

1. **文件存在性** —— 16 个关键文件（源码 / 插件 manifest / background / 图标 / 测试脚本）
2. **npm scripts 完整性** —— `dev/build/test:*` 是否齐全
3. **构建** —— `npm run build` 能否成功
4. **统一测试门禁** —— `test:all` 是否通过
5. **TDZ 风险扫描** —— 扫 `src` 下所有 `.jsx/.js` 的 TDZ / 未定义 / 非函数调用（防 `Cannot access 'x' before initialization`）
6. **dist 构建产物基线** —— 借鉴 1mao `safety-net.cjs`：对比 `dist/` 各文件大小，防意外增删 / 体积异常（基线存于 `scripts/dist-snapshot.json`，dist 有意义的更新后需重新生成基线）

> ⚠️ **dist 基线**：首次运行自动生成快照（仅记录）。之后每次对比；若你**刻意改了构建产物**（新增资源/插件文件），运行后会有差异提示，确认没问题后删除 `scripts/dist-snapshot.json` 重新生成即可。

## 四、测试文件结构

```
scripts/
├── smoke_test.cjs          # 冒烟：静态检查（调用 _smoke_checks.cjs）
├── _smoke_checks.cjs       # 冒烟检查明细（含 ReactFlow useReactFlow 白名单等）
├── regression_test.cjs     # 回归：SSR 渲染节点 + class 断言
├── test_agent_tools.cjs    # Agent 工具单测
├── run_all_tests.cjs       # 统一门禁聚合脚本
├── health-check.cjs        # 工程健康度全量检查
└── dist-snapshot.json      # dist 基线快照（自动生成，勿手改）
```

## 五、常见问题

### 1. 改了节点外观，regression 报 class 找不到
回归测试断言的是节点**根 / 主容器的关键 class**（如 `bg-surface-raised`、`rounded-xl`、`border-edge`、`cust-handle`）。
如果你改动了 NodeShell 外壳 / 节点外观，同步更新 `scripts/regression_test.cjs` 里对应节点的 `expect` 数组。

### 2. 用了新的 ReactFlow API，smoke 报 warning
`_smoke_checks.cjs` 里有 `allowedFromUseReactFlow` 白名单。React Flow 12 的 `useReactFlow()` 返回值若不在白名单会 warning。
确认是合法 API 后，把方法名加进白名单（如 `deleteElements`）。

### 3. 改代码触发 TDZ / 未定义
`check:health` 的 TDZ 扫描会提示。典型场景：在 `const x = useState(...)` 定义前就 `useXxx(x)` 调用（参考 DiscountVideoNode 的修复：把依赖的 hook 调用移到 state 定义之后）。

## 六、后续可补（非必须）

- **Playwright E2E**：真实浏览器验证画布交互（节点拖拽 / 连线 / 编组拖入拖出 / 折叠展开）。依赖已装，但尚未配置用例。对画布类应用价值最高，是 SSR 测不到的层。
- **纯函数单测**：`groupNodes`（编组算法）、`imageApi.resolveImagePixel`（尺寸像素表）、`useConnectedInputs`（group 聚合）等纯逻辑值得针对性单测。
