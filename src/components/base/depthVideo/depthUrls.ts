/**
 * 本机推理（深度转视频）资源前缀 —— URL 单源收口（设计稿 §10.5-p1）。
 *
 * 铁律：
 *  - 深度资源 URL 一律以 `${API_BASE}/depth-video/...` 前缀拼出，绝不散写在业务代码里；
 *  - API_BASE 是主项目后端地址唯一来源（src/components/base/config.ts），本模块不设第二来源；
 *  - vendor/models 物理在 localTool/runtime-models/depth-video/（index.ts 静态分支把 URL 前缀
 *    /depth-video/ 映射到物理根），浏览器只按 URL 读，不进主项目 dist。
 *
 * 纯函数 buildRuntimeModels(apiBase) 供单测钉住「路径派生、无双斜杠」；默认常量 RUNTIME_MODELS
 * 由真实 API_BASE 派生。
 */

export interface RuntimeModelPaths {
  /** 资源根（无尾斜杠）：http://127.0.0.1:18080/depth-video */
  root: string;
  /** transformers.js 浏览器端入口（ESM），供运行时动态 import */
  transformers: string;
  /** 模型权重根（尾斜杠），env.localModelPath 指向 */
  modelRoot: string;
  /** onnxruntime wasmPaths（mjs + wasm），env.backends.onnx.wasm.wasmPaths 指向 */
  wasmPaths: { mjs: string; wasm: string };
  /** onnxruntime webgpu bundle（ESM 单文件，自包含 onnxruntime-common API）。
   *  用于运行时注入 import map：把 transformers 内部的裸说明符
   *  `onnxruntime-web/webgpu` / `onnxruntime-common` 映射到本地（对齐 depth-video-converter/index.html）。 */
  ortWebgpuBundle: string;
}

/**
 * 由 apiBase 派生资源路径（纯函数）。
 *
 * 【同源铁律】深度资源一律采用「同源根相对」路径：transformers / onnxruntime / 模型权重必须与
 * 页面同源。实证结论：用绝对 URL（如 http://127.0.0.1:18080/depth-video/...）让 transformers.js
 * 加载模型时，其内部 DPT 处理器组装会静默失败 → pipeline(); this.processor 为 null →
 * 推理抛 "this.processor is not a function"；改用相对路径后与参考实现（depth-video-converter）
 * 完全一致，处理器正常（function）。根相对路径在浏览器里按「当前页面 origin」解析——主项目前端
 * 恰由 localTool 18080 同源托管，故天然同源。apiBase 仅保留以兼容既有调用方，不再参与拼装。
 */
export function buildRuntimeModels(_apiBase: string): RuntimeModelPaths {
  const root = '/depth-video';
  return {
    root,
    transformers: `${root}/vendor/transformers/transformers.web.min.js`,
    modelRoot: `${root}/models/`,
    wasmPaths: {
      mjs: `${root}/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs`,
      wasm: `${root}/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm`,
    },
    ortWebgpuBundle: `${root}/vendor/onnxruntime/ort.webgpu.bundle.min.mjs`,
  };
}

/** 默认资源路径（同源根相对，页面 origin 即资源 origin） */
export const RUNTIME_MODELS: RuntimeModelPaths = buildRuntimeModels('');
