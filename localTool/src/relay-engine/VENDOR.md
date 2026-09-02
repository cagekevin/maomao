# VENDOR.md · relay-engine（vendored 协议引擎）

> **本目录是第三方代码（ai-relay-kit），禁止手改源码。** 需要改动 → 去上游改或在此目录外加适配层。

## 来源
- 上游：`/Users/kevin/Downloads/ai-relay-kit`
- 用途：声明式模型协议引擎（`submit/poll/response` 三段数据化），供 localTool 的 `/api/relay` 薄端点调用。
- vendoring 日期：2026-09-02
- vendoring 方式：`cp -R <kit>/src/. localTool/src/relay-engine/`（整包拷）

## 保留文件
- `protocol/` `core/` `types/` `generate/` `providers/` `capabilities.ts` `contract.ts` `index.ts` `relay.ts` `docs/` `share/` `stations/` `upstream/` `deps/`
- 以上由 kit 整包拷入。**核心链只用 `protocol/` `core/` `types/` `generate/`**（见下）；`docs/` `share/` `stations/` `upstream/` 被 kit 门面 `index.ts` re-export，编译期未剔除但 esbuild 打包时不被核心链引用则 tree-shake 不进产物。

## 浏览器 API 位置（勿被核心链拉到）
- `docs/reader.ts`、`upstream/imageUtils.ts`、`upstream/videoInputValidation.ts` 含 `window/document/FileReader` 等浏览器全局。
- 这些在边缘模块，**核心链（protocol/core/types/generate）不 import 它们**，esbuild 打包 `executeModelProtocol` 不会拉到。

## 真实入口（推荐）
- 直接 `import { executeModelProtocol } from './relay-engine/protocol/executor'`（逃生舱），**绕过门面 `index.ts`**（它 re-export docs/share/stations 等无关模块）。
- 真实签名（实测，非文档推测）：
  - `executeModelProtocol(options: ExecuteModelProtocolOptions): Promise<ExecuteModelProtocolResult>`（单对象入参）
  - `SubmitModelProtocolOptions = { apiKey, baseUrl, protocol, variables, signal? }`

## 禁止
- 禁止手改本目录任何 `.ts`。升级 = 重新 `cp -R` 覆盖（本文件保留更新 vendoring 日期）。
