/**
 * 深度转视频 —— 模型运行时加载 / 释放（设计稿 §6.3 三道闸门：G1 动态 import / G3 释放收口，§6.4 GPU 回退链）。
 *
 * 设计契约：
 *  - 【G1 代码按需】本模块【不】做静态 import transformers/onnxruntime——transformers 运行时由组件层
 *    `import(/* @vite-ignore *\/ URL)` 动态加载后，以 `DepthRuntimeModule` 注入本模块；禁止在仓库任何文件
 *    静态 import 深度运行时（会打进首屏 chunk 污染所有环境）。此处注释里的 `@vite-ignore` 结字仅为说明。
 *  - 【G3 释放】disposeModel() 统一释放 module 级缓存的 pipe / RawImage，并清空加载缓存键；
 *    组件层在「转换结束 / 关弹窗 / 切到 fast」调用。
 *  - 【失败可见 D5】加载失败抛原样错误（不透传路径错误、不伪造泛化 Error）；最终落到哪个 device
 *    经 hooks.onStatus 如实告知（不静默切换）。推理中途 GPU 掉线的降级不在此模块做（见组件层，显式上报）。
 */

import { clampInt } from './engine.ts'
import type { RuntimeModelPaths } from './path.ts'
import { logger } from '../logger.ts'

/** 注入的 transformers.js 运行时（组件层动态 import 后传入） */
export interface DepthRuntimeModule {
  env: any
  pipeline: any
  RawImage: any
}

export interface ModelOptions {
  model: string
  device: 'webgpu' | 'wasm'
}

export interface LoadHooks {
  onProgress?: (pct: number) => void
  onStatus?: (text: string) => void
}

/** 加载完成后持有的推理句柄 */
export interface LoadedModel {
  pipe: { run?: (input: any) => Promise<any> } | null
  RawImage: any
  device: 'webgpu' | 'wasm'
}

// 模块级缓存：同一 model::device::dtype 幂等复用（同 id 已 load 不重复 load）；disposeModel 统一清空。
let pipe: any = null
let RawImage: any = null
let loadedModelKey = ''

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 运行时注入 import map（静态宿主必需，对齐 depth-video-converter/index.html）：
 * transformers.js 的 web ESM 构建内部用裸说明符 `onnxruntime-web/webgpu` 与 `onnxruntime-common`，
 * 而浏览器只能解析相对/绝对 URL，没有 bundler/script 声明的裸包。这两个名字没有任何运行时提供——
 * 用 import map 把它们映射到本地自包含的 ort.webgpu.bundle.min.mjs（该单文件内联了 onnxruntime-common API，
 * 与参考项目 `"onnxruntime-common": "./vendor/onnxruntime/ort.webgpu.bundle.min.mjs"` 完全一致）。
 *
 * 幂等（module 级布尔 + DOM 标记）：不重复插入；必须在组件层 `import(transformersURL)` 之前调用，
 * 浏览器对随后发起的动态 import() 实时读当前 import map，即可解析 transformers 内部裸导入。
 * URL 由 path.ts 基于 API_BASE 派生，不硬编码。
 */
let _importMapInjected = false
export function ensureRuntimeImportMap(paths: RuntimeModelPaths): void {
  if (_importMapInjected || typeof document === 'undefined') return
  let el = document.querySelector<HTMLScriptElement>('script[data-depth-importmap]')
  if (!el) {
    el = document.createElement('script')
    el.type = 'importmap'
    el.setAttribute('data-depth-importmap', '1')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify({
    imports: {
      'onnxruntime-web/webgpu': paths.ortWebgpuBundle,
      'onnxruntime-common': paths.ortWebgpuBundle,
    },
  })
  _importMapInjected = true
}

/** 配置 transformers env（注入 runtime，改其本地模型/vendor 路径）。纯函数，便于测试。 */
export function configureEnv(runtime: DepthRuntimeModule, paths: RuntimeModelPaths): void {
  runtime.env.allowLocalModels = true
  runtime.env.allowRemoteModels = false
  runtime.env.localModelPath = paths.modelRoot
  if (runtime.env.backends?.onnx?.wasm) {
    runtime.env.backends.onnx.wasm.wasmPaths = { ...paths.wasmPaths }
  }
  if (runtime.env.backends?.onnx?.webgpu) {
    runtime.env.backends.onnx.webgpu.powerPreference = 'high-performance'
    runtime.env.backends.onnx.webgpu.forceFallbackAdapter = false
  }
}

/**
 * WebGPU 高性能适配器预取失败则返回 false，调用方降级到 wasm（仅影响「初始加载走哪一档」）。
 * 失败仍然可见：hooks.onStatus 会说明未拿到高性能显卡。
 */
async function prepareHighPerformanceGpu(runtime: DepthRuntimeModule, hooks: LoadHooks): Promise<boolean> {
  const webgpu = runtime.env?.backends?.onnx?.webgpu
  const gpu = (typeof navigator !== 'undefined' ? (navigator as any).gpu : null) as
    | { requestAdapter(opts?: Record<string, unknown>): Promise<any> }
    | null
  if (!gpu || !webgpu) return false
  try {
    hooks.onStatus?.('正在请求高性能显卡。')
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance', forceFallbackAdapter: false })
    if (!adapter || adapter.isFallbackAdapter) return false
    webgpu.adapter = adapter
    webgpu.powerPreference = 'high-performance'
    webgpu.forceFallbackAdapter = false
    return true
  } catch {
    hooks.onStatus?.('未拿到高性能显卡，准备改用 CPU。')
    return false
  }
}

/**
 * 加载深度模型管道。返回最终落到的 device（如实告知，不静默）。失败抛原样错误。
 * 调用前提（G2）：仅在「depthOpen ∧ engine==='ai' ∧ 用户点「开始转换」」时由组件层调用；fast 模式不调用。
 */
export async function ensureModel(
  runtime: DepthRuntimeModule,
  options: ModelOptions,
  paths: RuntimeModelPaths,
  hooks: LoadHooks = {}
): Promise<LoadedModel> {
  configureEnv(runtime, paths)
  RawImage = runtime.RawImage

  let preferredDevice: 'webgpu' | 'wasm' = options.device === 'webgpu' ? 'webgpu' : 'wasm'
  if (preferredDevice === 'webgpu') {
    const gpu = (typeof navigator !== 'undefined' ? (navigator as any).gpu : null)
    if (!gpu) {
      hooks.onStatus?.('这个浏览器没有打开 GPU 通道，改用 CPU。')
      preferredDevice = 'wasm'
    } else {
      const ok = await prepareHighPerformanceGpu(runtime, hooks)
      if (!ok) preferredDevice = 'wasm'
    }
  }

  const loadForDevice = async (device: 'webgpu' | 'wasm', dtype: string): Promise<void> => {
    const key = `${options.model}::${device}::${dtype}`
    if (pipe && key === loadedModelKey) return
    hooks.onStatus?.(`正在准备内置 AI 模型（${device === 'webgpu' ? 'GPU' : 'CPU'}）。`)
    hooks.onProgress?.(2)
    const nextPipe = await runtime.pipeline('depth-estimation', options.model, {
      local_files_only: true,
      device,
      dtype,
      progress_callback: (progress: any) => {
        if (progress?.status === 'progress') {
          const pct = progress.total ? (progress.loaded / progress.total) * 45 : 8
          hooks.onProgress?.(clampInt(3 + pct, 3, 48))
        } else if (progress?.status) {
          hooks.onStatus?.(`正在准备 AI 模型：${progress.status}`)
        }
      },
    })
    pipe = nextPipe
    RawImage = runtime.RawImage
    loadedModelKey = key
  }

  const attempts: Array<{ device: 'webgpu' | 'wasm'; dtype: string }> =
    preferredDevice === 'webgpu'
      ? [
          { device: 'webgpu', dtype: 'q4f16' },
          { device: 'webgpu', dtype: 'q8' },
          { device: 'wasm', dtype: 'q8' },
        ]
      : [{ device: 'wasm', dtype: 'q8' }]

  let lastError: unknown = null
  let latest: 'webgpu' | 'wasm' = 'wasm'
  for (const attempt of attempts) {
    try {
      await loadForDevice(attempt.device, attempt.dtype)
      latest = attempt.device
      break
    } catch (error) {
      lastError = error
      pipe = null
      RawImage = runtime.RawImage
      loadedModelKey = ''
      // 排障埋点（debug 级别，非 info）：暴露每个 attempt 的失败（device/dtype）+ 原始 stack，
      // 便于定位 transformers/onnxruntime 动态子模块的真实来源。受 DEBUG_MODULES 'depth' 位 / 总开关控制，
      // 默认安静、不上报后端（属排查噪音）。真正错误仍通过 hooks.onStatus + 组件层状态条如实告知用户。
      logger.debug(
        '深度转视频',
        '模型加载失败',
        { attempt: `${attempt.device}/${attempt.dtype}`, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
        { module: 'depth' }
      )
      if (attempt.device === 'webgpu') {
        hooks.onStatus?.('GPU 方式没有跑起来，正在尝试备用方式。')
        await sleep(250)
      }
    }
  }

  if (!pipe) throw lastError instanceof Error ? lastError : new Error('AI 模型加载失败。')
  if (latest === 'wasm' && options.device === 'webgpu') {
    hooks.onStatus?.('GPU 不可用，已用 CPU（wasm）加载模型。')
  } else {
    hooks.onStatus?.(`AI 模型已准备好（${latest === 'webgpu' ? 'GPU' : 'CPU'}）。`)
  }
  return { pipe, RawImage, device: latest }
}

/** 释放模型运行时（G3）：切换 fast / 转换结束 / 弹窗关闭时调用，并 revoke 可回收句柄。 */
export function disposeModel(): void {
  pipe = null
  RawImage = null
  loadedModelKey = ''
}