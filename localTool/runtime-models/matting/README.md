# matting · 本机模型资产目录

> **AI 抠图（交互式分割）**：SAM-HQ ViT-Tiny，浏览器端 onnxruntime-web 推理。
> 上传图片 → 左键点物体（正提示点）· 右键点背景（负提示点）→ 生成 mask → 输出透明 PNG。
> 图片不出本地，**全程浏览器推理**，运行时零联网。
> 只有 `MANIFEST.json` 与 `README.md` 入库 —— 其余文件不入库（规则见 `localTool/.gitignore`；体系规范见 `docs/plan/147`）。

### 推理必需（接入主应用只取这三类）

| 文件 | 说明 |
|---|---|
| `static/models/sam_hq_vit_t_encoder.onnx`（26.7 MB） | SAM-HQ ViT-Tiny **encoder**：图片 → `image_embeddings` + `interm_embeddings` |
| `static/models/sam_hq_vit_t_decoder.onnx`（17.5 MB） | SAM-HQ ViT-Tiny **decoder**：embedding + 提示点 → 原图尺寸 mask |
| `static/ort/ort.bundle.min.mjs`（457 KB） | onnxruntime-web **主入口**（前端按取件 URL 动态 import）|
| `static/ort/ort-wasm-simd-threaded.{mjs,wasm}`（11 MB） | ORT 的 **wasm 运行时**（threaded；需 `SharedArrayBuffer`）|

> **运行时为什么在本目录**：它**由后端托管、前端按 URL 取** —— 与 `depth-video/vendor/onnxruntime/`、
> `whisper-tiny/vendor/onnxruntime/` **是同一个角色的东西**，只是目录名不同（见下「同物异名」）。
> 前端**不**从主项目依赖取 ORT（那是 `@huggingface/transformers` 的间接依赖，且违背「运行时由后端出」）。

### 演示件（**非推理必需**，接入主应用不引用）

| 文件 | 说明 |
|---|---|
| `index.html` | 演示页：正/负点操作 · 结果透明 PNG 下载 |
| `index.js` · `package.json` | 演示用静态服务器（带 COOP/COEP 头）|

> ⚠️ **这 3 个是演示件，不是模型的一部分**。它们被 `MANIFEST.json` 一并记录（按目录扫描，同目录文件都记），
> 但**推理链路完全不依赖它们** —— 接入主应用时**只用**上面「推理必需」那四条。
>
> ⚠️ **演示页只从磁盘直接开，不经宿主**：`/models/matting/index.html` **不能**用来打开演示页 ——
> 宿主的**域专用 MIME 表**（`localTool/src/index.ts::handleRuntimeModelResource`）只登记模型与推理运行时格式，
> `.html` 未登记 ⇒ 按 `application/octet-stream` 返回 ⇒ 浏览器**下载**而非渲染。
> **这是有意为之**（模型目录里的 HTML 若能渲染 = 攻击面），**不是缺陷**。要跑演示：
>
> ```bash
> cd localTool/runtime-models/matting && node index.js   # → http://localhost:8000
> ```

**来源**：encoder/decoder 为本机 `scripts/export-onnx.py` 导出的 SAM-HQ ViT-Tiny ⇒ **无稳定直取的单文件 URL**，`source` 留空、换机还原走网盘镜像。
ORT 运行时取自 **jsDelivr `onnxruntime-web@1.20.1/dist/`**（三条 source 已按字节钉死）。

> ⚠️ **`scripts/export-onnx.py` 已不存在**（全盘搜不到）⇒ **本模型当前无法在本机重新导出**。
> 该脚本名及其所在的 `scripts/` 目录**从未随模型一起过来**（演示页报错文案里的那句"跑 python scripts/export-onnx.py"是失效指引）。
> ⇒ 要改模型结构（如为兼容 `transformers.js` 的 `SamModel` 重导）**必须先找回或重建导出脚本**。

---

### 同物异名：本目录的 `static/ort/` = 别处的 `vendor/onnxruntime/`

仓内三处都放着**同一角色的东西（ORT wasm 运行时）**，但目录名各不相同：

| 模型目录 | 运行时目录名 |
|---|---|
| `depth-video/` | `vendor/onnxruntime/` |
| `whisper-tiny/` | `vendor/onnxruntime/` |
| **`matting/`** | **`static/ort/`** ← 本目录（自带演示页的原始结构）|

**它们是同一个东西，不是三套不同机制。** 差异只来自各模型的**原始目录结构**：

- `depth-video` / `whisper-tiny` 的运行时是**按体系规范**摆进 `vendor/onnxruntime/` 的（`docs/plan/147` 一模型一目录）；
- `matting` 的运行时**随演示页一起长这样**（`static/ort/` —— 演示页 `index.html` 里写死的相对路径）。

**按 `ADR-0062` 的落点判据**：这份资源的**物理落点**合规（在 `runtime-models/<modelId>/` 内）、**URL 取件**合规（经 `/models/matting/*` 宿主）、**且不随前端构建分发** ⇒ **落点判据已满足**。
目录名叫 `static/ort` 而不是 `vendor/onnxruntime` **不构成违规** —— `runtime-models/README.md` 明确「`<模型名>` 就是目录名，随便起」，**体系未对目录内部结构做强制**。

> **为什么不拉平改名为 `vendor/onnxruntime/`**：改动要动演示页内写死的相对路径 + 重算 `MANIFEST.json` 的 8 条 `path`，
> 而`ADR-0053` 第 0 关要求「删/改必须答出复杂度降在哪一项」—— **答不出**（拉平只让"看起来像"，系统复杂度零下降）⇒ **不改**。

---

## 取件（浏览器）

前端取件走唯一出口 —— **不拼字面量**：

```ts
import { runtimeModelUrl } from '@/components/base/core/runtimeModelUrl';
runtimeModelUrl('matting', 'static/models/sam_hq_vit_t_encoder.onnx');
// → /models/matting/static/models/sam_hq_vit_t_encoder.onnx
```

| 项 | 值 |
|---|---|
| URL 前缀 | `/models/matting/`（真源 `base/core/runtimeModelUrl.ts`）|
| 实际 URL | `/models/matting/static/models/sam_hq_vit_t_encoder.onnx`、`/models/matting/static/ort/…` |
| 宿主 | localTool（`index.ts` → `paths.ts::getRuntimeModelDir('matting')` → `runtime-models/matting/`）|
| 远端 | 模型与 ORT wasm 均指向本机 ⇒ **运行时零联网** |

> **COOP/COEP 依赖**：ORT threaded wasm 要 `SharedArrayBuffer`，页面必须 cross-origin isolated。
> 独立演示（`index.js`）自带 `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` 头；
> 接进主应用时，宿主页需同样带上这两个头（plan 147 §六 dev/prod 均同源托管）。

## 还原本目录

```bash
# ① 首次：把本机现有资源打包上传网盘（若网盘还没有 matting.zip）
python localTool/scripts/aliyun-models.py upload matting

# ② 换机 / 丢失后
python localTool/scripts/aliyun-models.py download matting

# ③ 校验 sha256（唯一防线）
node localTool/scripts/runtime-model.mjs doctor matting
```

> ORT 三条文件有 `source` ⇒ 也可直接 `node localTool/scripts/fetch-runtime-models.mjs matting` 从 jsDelivr 拉回；
> encoder/decoder 无 `source`，只能走网盘。

## 完整性

模型权重与 ORT wasm **都在本目录** ⇒ **运行时零联网**（不回落 `cdn.jsdelivr.net`）。

## 变更留痕

- 2026-09-24 落地：把磁盘上已有的 SAM-HQ 抠图演示纳入本机模型资产体系。
  动作：清理 `.DS_Store` 与演示自带 `.gitignore`（非模型资产）→ `runtime-model.mjs init` 生成清单 →
  补 `description`/`sourceNote` → ORT 三条按 jsDelivr `onnxruntime-web@1.20.1` 钉死 source。
- 同日改名：目录名由临时名 `21` → **`matting`**（体系方案 `docs/plan/147` §2.2/§2.4 既定的抠图 modelId；
  与 `depth-video`/`mediapipe`/`three`/`whisper-tiny` 的语义化命名一致）。改名时**尚无代码引用**，故零成本。
  **未改代码**：`<modelId>` = 目录名 `matting` 零配置，`/models/matting/*` 由既有宿主直接可服务。
- 同日补 README 三类澄清（**未改任何代码**）：
  ① **文件分两栏**（推理必需 / 演示件）—— 原表把 `index.html` 与 ONNX 权重并列，读者会误以为演示页是模型的一部分；
  ② **演示页不经宿主** —— 实测经 `/models/matting/index.html` 取回 `application/octet-stream`（宿主域专用 MIME 表未登记 `.html`）。
     裁定**不加 `.html` 映射**（模型目录里的 HTML 若能渲染 = 攻击面），演示只从磁盘 `node index.js` 开；
  ③ **同物异名** —— 本节 `static/ort/` 与 `depth-video/vendor/onnxruntime/`、`whisper-tiny/vendor/onnxruntime/` 是**同一角色**，名字差异属各模型原始结构，**不影响落点判据**（`ADR-0062`）。
