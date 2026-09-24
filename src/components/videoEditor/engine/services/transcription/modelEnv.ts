import { PREFIX_MODELS } from '@/components/base/core/runtimeModelUrl.ts';

/**
 * 转写模型的环境配置 —— **本机模型目录 + 本机 ORT wasm + 禁远端**（形态与 `video/depthVideo/loader.ts` 一致）。
 *
 * 【为什么从「hf 代理」改成这个】原先这里的机制是 `applyHfProxyHost`：把库的 `env.remoteHost`
 * 指向 localTool 的 `/api/hf/*` 代理（TD-22-57），让公网直连收口到唯一出站口。
 * 2026-09-24 起 whisper-tiny **已落地本机**（`localTool/runtime-models/whisper-tiny/`），
 * 模型文件**不再出站** ⇒ 代理那一层随之失去消费者，已删除（`ADR-0030`：零生产消费的实现不许预留）。
 *
 * 【形态对齐】`allowLocalModels=true` + `allowRemoteModels=false` + `localModelPath`，
 * 与 `depthVideo/loader.ts::configureEnv` 完全一致 —— 全仓「模型已落地」的链路只有这一种形态。
 * **缺文件即明确报错并指路**（库会报 `env.allowRemoteModels=false, but attempted to load a remote file from …`
 * 或 `file was not found locally at …`），**不静默回落公网**。
 *
 * 【ORT wasm 也走本机（2026-09-24 补齐）】库默认会把 `env.backends.onnx.wasm.wasmPaths` 设为
 * `https://cdn.jsdelivr.net/npm/onnxruntime-web@<ver>/dist/` ⇒ 只本地化模型、不本地化 wasm 的话，
 * **首次运行仍要联网**（即"以为离线其实没离线"的假成功）。这里把它改指本机目录。
 *
 * 【为什么用**字符串前缀**而不是 `{mjs, wasm}` 对象】库默认是对象（非 Safari 用 `asyncify` 变体、
 * Safari 用无后缀变体），但那要求我们不重复库的分支判断。改成字符串前缀后，**由 ORT 按自身能力
 * 选择变体**（webgpu/线程/jspi/Safari），我们只需把候选变体都备齐 —— 见 `vendor/onnxruntime/` 的 4 组
 * `simd-threaded` 变体（mjs+wasm 共 8 个文件）。这样不猜、也不复制库的判断逻辑。
 *
 * 【路径真源复用】两处路径都取 `runtimeModelUrl.ts` 的 `PREFIX_MODELS`（= `/models/`），不写第二份字面量。
 */

/** transformers.js 中本模块要用到的 env 面（只声明用到的字段，避免把库类型拖进主包）。
 *  `wasmPaths` 的宽松形状（`string | {mjs?, wasm?}`，值可为 `URL`）**照库的 `WasmPrefixOrFilePaths` 声明** ——
 *  声明窄了会导致库的 `env` 无法赋值进来（我们只是往它写字，不改变它的形状）。 */
export interface TranscriptionModelEnv {
  allowLocalModels?: boolean;
  allowRemoteModels?: boolean;
  localModelPath?: string;
  backends?: {
    onnx?: {
      wasm?: {
        wasmPaths?: string | { mjs?: string | URL; wasm?: string | URL };
      };
    };
  };
}

/**
 * 把 transformers.js 指向本机模型目录 + 本机 ORT wasm，并禁止远端拉取（幂等：重复调用无副作用）。
 *
 * @param env transformers.js 的 `env` 对象（由调用方从库 import，避免主包静态依赖）
 * @param modelId 本机模型目录名（与传给 `pipeline()` 的 model id **同一个值** —— 保证模型与 wasm 同源）
 * @throws 当库的 `env` 里没有 `backends.onnx.wasm` 时 —— **宁可响亮失败，也不静默回落 CDN**
 *   （静默跳过 = 走 `cdn.jsdelivr.net` = "以为离线其实没离线"，正是本函数要消灭的假成功）。
 */
export function configureTranscriptionModelEnv(env: TranscriptionModelEnv, modelId: string): void {
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = PREFIX_MODELS;

  const wasm = env.backends?.onnx?.wasm;
  if (!wasm) {
    throw new Error(
      'transformers.js env 缺少 backends.onnx.wasm —— 无法把 ORT wasm 指到本机；' +
        '继续跑会从 cdn.jsdelivr.net 取（假离线）。请检查库版本是否变更了这一结构。',
    );
  }
  wasm.wasmPaths = `${PREFIX_MODELS}${modelId}/vendor/onnxruntime/`;
}
