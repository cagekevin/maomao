# whisper-tiny · 本机模型资产目录

> **转写（语音转字幕）** 用的 whisper-tiny（总计约 192 MB = 模型 118 + ORT wasm 74）：剪辑器「字幕」面板的语音识别。
> 只有 `MANIFEST.json` 与 `README.md` 入库 —— 其余文件不入库（规则见 `localTool/.gitignore`；
> 体系规范见 `docs/plan/147`）。

| 文件 | 说明 |
|---|---|
| `onnx/encoder_model.onnx`（31.4 MB） | encoder，**fp32** |
| `onnx/decoder_model_merged_q4.onnx`（82.7 MB） | decoder，**q4** |
| `config.json` · `generation_config.json` · `preprocessor_config.json` | 模型/生成/特征提取配置 |
| `tokenizer*.json` · `vocab.json` · `merges.txt` · `normalizer.json` · `special_tokens_map.json` · `added_tokens.json` | 分词器与文本规范化（whisper 的英文规范化要 `normalizer.json`）|
| `quantize_config.json` | 量化工具链元数据（推理不读；随仓库一并接管）|
| `vendor/onnxruntime/ort-wasm-simd-threaded{,asyncify,jsep,jspi}.{mjs,wasm}`（**8 个**） | **onnxruntime-web 的 wasm 运行时**，`1.26.0-dev.20260416-b7804b056c`（与本仓依赖 `onnxruntime-web` 同版）|

**来源**：模型来自 `onnx-community/whisper-tiny`（revision 钉死 `ff4177021cc4`）；ORT wasm 取自本仓依赖
`onnxruntime-web@1.26.0-dev.20260416-b7804b056c` 的 `dist/`（与库默认 CDN 同版）。各条 `source` 见 MANIFEST。

### 为什么 ORT wasm 要带 **4 个变体**

`transformers.js` 里**没有 `jsep` 的分支判断** —— 它默认只按"是不是 Safari"选一对。我们改用**字符串前缀**让 **ORT 自己选**，
所以把候选全带上，**不猜也不复制库的判断**：

| 变体 | 用途 |
|---|---|
| `…threaded.jsep.*` | WebGPU / JSEP 执行后端（本链路 `device: 'webgpu'` 走它）|
| `…threaded.asyncify.*` | 常规 wasm（库默认非 Safari）|
| `…threaded.jspi.*` | JSPI（新式 wasm 异步）|
| `…threaded.*` | 无 asyncify（库默认 Safari）|

---

## 取件（浏览器）

前端**不拼字面量** —— 库按 `env.localModelPath + modelId + /file` 自行拼：

| 项 | 值 |
|---|---|
| `env.localModelPath` | `PREFIX_MODELS`（= `/models/`，真源 `base/core/runtimeModelUrl.ts`）|
| `env.backends.onnx.wasm.wasmPaths` | `/models/whisper-tiny/vendor/onnxruntime/`（**字符串前缀**，让 ORT 自选变体）|
| `modelId` | `whisper-tiny`（= 本目录名，见 `transcription-constants.ts::TRANSCRIPTION_MODEL`）|
| 实际 URL | `/models/whisper-tiny/onnx/encoder_model.onnx`、`/models/whisper-tiny/vendor/onnxruntime/…` |
| 远端 | **模型与 ORT wasm 均禁用/指向本机** ⇒ **运行时零联网** ✅ |

配置落点：`videoEditor/engine/services/transcription/modelEnv.ts`（形态与 `depthVideo/loader.ts::configureEnv` 一致）。

> **缺文件时**：库会明确报 `env.allowRemoteModels=false, but attempted to load a remote file from …`
> 或 `file was not found locally at …` —— **不静默回落公网**。此时跑 `download all` 或本目录的还原命令。
> 另：若库版本改变了 `env.backends.onnx.wasm` 的结构，`configureTranscriptionModelEnv` 会**直接抛错**
> （宁可响亮失败，也不静默回落 CDN）。

## 还原本目录

```bash
# ① 首次：把本机现有资源打包上传网盘（若网盘还没有 whisper-tiny.zip）
python localTool/scripts/aliyun-models.py upload whisper-tiny

# ② 换机 / 丢失后
python localTool/scripts/aliyun-models.py download whisper-tiny

# ③ 校验 sha256（唯一防线）
node localTool/scripts/runtime-model.mjs doctor whisper-tiny
```

## 完整性

模型与 ORT wasm **都**在本目录 ⇒ **运行时零联网**（此前 ORT wasm 走 `cdn.jsdelivr.net`，是"以为离线其实没离线"的假离线）。

> 与 `depth-video/vendor/onnxruntime/` 是**同一套 ORT 文件**（各自自包含）。若将来要省体积，可提到共享落点 ——
> 但按现行「一模型一目录」口径，各自带一份更简单（`docs/plan/147` §七 已裁定暂不建共享 `_vendor/` 层）。

## 变更留痕

- 2026-09-24 落地（此前该链路为「HF 直连 → `/api/hf/*` 代理 + 浏览器缓存」）。
  因模型已本机化，`/api/hf/*` 代理与其前端模块 `hf-proxy.ts` **失去消费者，已删除**（`ADR-0030`）；
  环境配置改为 `modelEnv.ts`（禁远端）。
- 同日用户裁定：转写**不再可选模型**，固定 tiny（原 5 选项清单已删）。
- 同日补齐 **ORT wasm 本地化**（用户："做事情要做全套"）：8 个变体入 `vendor/onnxruntime/`，
  `wasmPaths` 改指本机 ⇒ 至此转写链路**完全离线**。