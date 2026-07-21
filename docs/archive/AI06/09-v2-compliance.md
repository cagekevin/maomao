# AI06 · 模块6：V2 状态与红线合规审计

> 审计日期：2026-07-21 ｜ 验证 V2 确实只作归档、无运行路径，确认 CLAUDE.md §3/§4 红线未被违反。
> 放置范围：仅 `docs/AI06/`，未触碰 src/v2/ 或任何代码（红线§3.1）。

## 1. 审计目标
按 CLAUDE.md §4「V2 永久暂停，别碰也别接」+ ARCHITECTURE L4.4，验证：
1. V2 无运行路径（main.tsx 不 import V2 App）
2. src/v2/ 现存文件均为 V1 真实依赖或归档，无混入运行逻辑
3. 红线§3.1（修改范围）、§3.2（版本锁定）未被违反

## 2. 运行入口实证（已坐实）
`src/main.tsx` 全文（61 行）：
- L7 `import './v2/react-bridge.ts';` —— **V1 真实依赖**（React 实例桥接）
- L16 `import { ErrorBoundary } from './v2/components/ErrorBoundary';` —— **V1 真实依赖**（兜底边界）
- L41 `const App = React.lazy(() => import('./_engine/App.js'));` —— **唯一运行路径**，指向 V1 引擎
- 无任何 `import('./v2/App.js')` 或 `import AppShell` 的运行路径

**结论**：V2 的 AppShell/App 无运行路径 import，与 CLAUDE.md §8.1 铁证一致 ✅。

## 3. src/v2/ 现存文件清单（已坐实，list_dir）
```
src/v2/
├── components/
│   └── ErrorBoundary.tsx   # V1 真实依赖（main.tsx L16 引用）
├── react-bridge.ts         # V1 真实依赖（main.tsx L7 引用）
├── vite-env.d.ts           # TS 环境声明（构建必需）
└── 归档.zip                # V2 源码归档（勿在 src 内解析）
```
- 与 CLAUDE.md §4 描述完全一致：`react-bridge.ts`/`ErrorBoundary.tsx`/`vite-env.d.ts` 为 V1 依赖，`归档.zip` 为暂停归档。
- 无 `App.tsx`/`AppShell.tsx`/`stores/`/`nodes(30)` 等 V2 源码（已压缩归档进 zip）。

## 4. 红线合规核对
| 红线 | 要求 | 现状 | 结论 |
|------|------|------|------|
| §3.1.1 修改范围 | 只改 App.js/config.js | V2 文件未被改（本审计也未碰） | ✅ 合规 |
| §3.1.2 禁改 vendor/dist/css | 不碰第三方产物 | 未触碰 | ✅ 合规 |
| §3.2 版本锁定 | 严格 V1，不引入 V2 逻辑 | main.tsx L41 仅 V1；V2 仅 react-bridge/ErrorBoundary 兜底 | ✅ 合规 |
| §4 V2 暂停 | 别碰别接 | 无运行路径 import，归档在 zip | ✅ 合规 |
| §3.1.3 命名红线 | 不改混淆短名 | 审计只 grep 不改名 | ✅ 合规 |
| §3.3.8 无视已知噪音 | 不修 RootErrorBoundary null | 未动 | ✅ 合规 |

## 5. 切回 V2 的路径（仅记录，不执行）
按 CLAUDE.md §4：解压 `归档.zip` 恢复 V2 源码 → 把 main.tsx L41 改为 `import('./v2/App.js')`。当前未执行，保持 V1。

## 6. 风险提醒（防误改）
- `react-bridge.ts` / `ErrorBoundary.tsx` 虽在 `src/v2/` 目录，但属 **V1 运行必需**，删除会崩（CLAUDE.md §4 已标"勿删"）。
- `归档.zip` 在 `src/` 内，**不要在 src 内解压**（会污染 V1 工作区）；切 V2 须解压到临时位置。
- AI 接手时若见 `src/v2/` 有运行代码，先核对 main.tsx L41 是否仍为 V1——本审计已确认是 V1。

## 7. 校验门
- main.tsx L7/L16/L41 由 grep 坐实 ✅
- src/v2/ 目录结构由 list_dir 坐实 ✅
- 红线合规结论基于 CLAUDE.md §3/§4 原文比对 ✅

## 8. 结论
V2 永久暂停状态属实，无运行路径，红线§3/§4 全部合规。AI06 审计未触碰 src/v2/，符合"别碰别接"约束。
