# 一毛 AI 画布（maomao · yimao-ai-canvas）

一个 Chrome 扩展画布工具，集成 AI 图片 / 视频 / 文本工作流。由闭源原版反编译魔改为**脱离官方的本地模式**：前端跑本地引擎，AI 请求走自研网关，文件与数据走自研本地服务。当前只跑 V1，V2 已永久废弃。

> 架构师工作手册见 [`CLAUDE.md`](./CLAUDE.md)（最高红线、目录职责、修复规约均在其中）。改码前必读。

## 三大进程

| 进程 | 端口 | 职责 | 启动方式 |
|------|------|------|----------|
| 前端扩展 | `dist/` | V1 画布 UI，加载到 Chrome | 见下方「构建」 |
| localTool 本地服务 | `127.0.0.1:18080` | KV / 文件 / 任务 / 资源 / 代理存储（sql.js WASM） | `cd localTool && npm run build && npm start` |
| apimart-gateway 网关 | `127.0.0.1:9004` | OpenAI 风格接口 → Lovart 调用，处理图文视频生成 | `cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004` |

前端唯一入口为 `src/entry.js`（`index.html` 直接引用）；`src/main.tsx` 已删除，请勿重建或引用。

## 构建（前端）

本项目 `build` 已通过 `cross-env` 跨平台化，Windows / Mac 统一用：

```bash
npm install      # 安装依赖（含 cross-env）
npm run build    # 输出到 dist/
```

> 历史说明：旧版 `build` 为 bash 内联写法，Windows 下无法直接 `npm run build`。现已修复。

## 红线摘要（详见 CLAUDE.md §3）

- **可改**：`src/App.js` 及已解耦子模块（`src/config/`、`src/utils/`、`src/services/`、`src/components/`、`src/hooks/`、`src/contexts/`）、`src/config.js`、`src/entry.js`、`localTool/src/**`、`apimart-gateway/**`。
- **别碰**：`dist/`、`src/vendor/`（含 `vendor.js`/`rolldown-runtime.js`）、`captureVideoFrame-*.js`、`*.css`、`reference/App.original.js`。
- **别修（已知噪音）**：`9004` 未实现 API 的 `404`、`RootErrorBoundary` 的 `null` 异常。
- 严格运行 V1，禁止引入 V2 代码或逻辑。

## 工程规范

- 构建：`npm run build`（`cross-env` 跨平台统一）。
- 一键联调：`npm run dev:all` 同时拉起前端 vite + localTool(:18080) + 网关(:9004)。
- 质量门控（AI 改码后必跑）：前端 `npx eslint <安全区>`；网关 `cd apimart-gateway && ruff check .`。`src/App.js` / `src/vendor` 已被忽略。
- 提交：小步提交，信息清晰（`feat(...)` / `fix(...)` / `docs: ...`）。
- 恢复基线：`git checkout -- src/App.js`（改坏核心时唯一恢复手段）。
