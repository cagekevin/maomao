# 95 · 本机推理模型资源 GitHub 规范（runtime-models 不入仓）

> 状态：规范定稿，已落地（`.gitignore` + `MANIFEST.json` + `fetch-runtime-models.mjs`）。
> 日期：2026-09-03
> 关联：`docs/94-深度视频转换-去iframe-集成设计.md` §5.1（模型存放定案）、§10（本机推理注册表前瞻）

---

## 1. 问题背景

`localTool/runtime-models/` 存放浏览器端本机推理所需的大体积二进制：

| 类别 | 内容 | 体积（约） |
|------|------|-----------|
| 模型权重 `models/**/*.onnx` | depth-anything-v2-small / depth-anything-small-hf / dpt-hybrid-midas | **~420 MB**（最大单文件 dpt-hybrid-midas `model_quantized.onnx` = 198 MB） |
| 推理运行时 `vendor/**` | transformers.js + onnxruntime-web（wasm / mjs / js） | **~50 MB** |
| **合计** | | **~470 MB** |

这些文件的本质：**可从公开源重新拉取**（模型来自 HuggingFace `onnx-community` / `Xenova`，运行时来自 npm CDN）。把它们入库会：

- 让 git 仓库永久膨胀（且历史不可自动瘦身）；
- 拖慢 clone / CI，污染远端；
- 与 `docs/94` §5.1「`models/` 进 `.gitignore`、不入库/CI」的定案冲突。

→ **结论：二进制一律不入库；仓库只追踪「清单 + 文档 + 小体积配置」，二进制靠脚本重建。**

---

## 2. 核心原则（铁律）

1. **二进制不入库**：`*.onnx` / `*.wasm` / `transformers*.js` / `ort*.mjs` 全部忽略（见 `.gitignore`）。
2. **清单是唯一来源**：`runtime-models/<tool>/MANIFEST.json` 记录每个文件的 `path / size / sha256 / source`，并带 sha256 校验，保证跨机器字节一致、可复现。
3. **MANIFEST 是唯一来源**：`models/**` 下所有文件（含 `config.json` / `preprocessor_config.json` / `quantize_config.json`）与 `vendor/**` 大文件，都被嵌套的 `localTool/.gitignore`（`runtime-models/depth-video/models/` 与 `vendor/` 两条规则）**整目录忽略，不入库**；其中 `vendor/onnxruntime/README.md`、`vendor/transformers/LICENSE` 因较早提交处于「已追踪」状态而保留在 git。其余一律靠 `fetch-runtime-models.mjs` 按 MANIFEST 重建（含 9 个模型小配置文件，已补进 MANIFEST，确保 `models/` 整目录可下载）。
4. **绝不手改二进制**：缺资源用脚本拉，不 `git add` 大文件。
5. **测试/CI 隔离**：CI 不拉模型（见 §7），UI 自动化默认走 `fast`/无模型路径（`docs/94` §6.3 G1–G3）。

---

## 3. 目录约定

```
localTool/runtime-models/                  ← 本机推理资源命名空间（前瞻可加 rembg/ 等工具子目录）
  <tool>/                                  ← 每个工具一个子目录（当前：depth-video）
    MANIFEST.json                          ← ★ 入库：文件清单 + sha256 + 来源（本规范的锚）
    vendor/                                ← 推理运行时（二进制，不入库，脚本重建）
      transformers/transformers.web.min.js
      onnxruntime/*.wasm / *.mjs
    models/                                ← 模型权重（二进制，不入库，脚本重建）
      onnx-community/depth-anything-v2-small/
      Xenova/depth-anything-small-hf/
      Xenova/dpt-hybrid-midas/
```

> **物理路径 ≠ URL 路径**：磁盘在 `runtime-models/depth-video/`，浏览器 URL 仍是简短的 `${API_BASE}/depth-video/...`（`docs/94` §5.1）。本规范只管「磁盘资源如何来」，不改前端 URL 约定。

---

## 4. .gitignore 规则

已在仓库根 `.gitignore` 追加：

```gitignore
# 本机推理模型资源（体积大/可重拉，不入库；仅 MANIFEST 与文档入库）
localTool/runtime-models/**/*.onnx
localTool/runtime-models/**/*.wasm
localTool/runtime-models/**/transformers*.js
localTool/runtime-models/**/ort*.mjs
```

> 注意：`config.json` / `*.md` / `LICENSE` 等**不**在此列，仍正常入库。

---

## 5. MANIFEST 结构

```jsonc
{
  "tool": "depth-video",
  "localMirror": { "env": "DEPTH_VIDEO_SRC", "default": "C:/Users/xinye/Downloads/depth-video-converter" },
  "vendor": {
    "transformers":  { "cdn": "https://cdn.jsdelivr.net/npm/@huggingface/transformers",  "versionEnv": "TRANSFORMERS_VERSION" },
    "onnxruntime":   { "cdn": "https://cdn.jsdelivr.net/npm/onnxruntime-web",            "versionEnv": "ONNXRUNTIME_VERSION" }
  },
  "files": [
    {
      "path":   "depth-video/models/.../model_q4f16.onnx",  // 相对 localTool/runtime-models/
      "source": "https://huggingface.co/.../resolve/main/...", // 模型走 HuggingFace；vendor 可省略，由 group+cdn 拼出
      "group":  "onnxruntime",                               // vendor 用：拼 CDN URL
      "dist":   "dist/ort-wasm-simd-threaded.asyncify.wasm", // vendor 用：CDN 内路径
      "size":   19126267,
      "sha256": "ECA7..."                                     // 校验锚，大小写不敏感（脚本统一转大写比对）
    }
  ]
}
```

- **模型文件**：填 `source`（HuggingFace `resolve/main`，稳定可复现）。
- **vendor 文件**：填 `group` + `dist`，脚本按 `cdn[@版本]/dist` 拼 URL；`versionEnv` 可钉版本防漂移。
- 每个文件**必须**有 `size` + `sha256`，否则校验无意义。

---

## 6. 拉取脚本用法

脚本：`localTool/scripts/fetch-runtime-models.mjs`（Node ≥ 20.4，零依赖，用内置 `fetch`）。

```bash
# 拉取全部工具（默认会扫描 runtime-models/*/MANIFEST.json）
node localTool/scripts/fetch-runtime-models.mjs
# 或
node localTool/scripts/fetch-runtime-models.mjs

# 仅拉取某个工具
node localTool/scripts/fetch-runtime-models.mjs depth-video

# 仅校验是否已就绪（不下载），CI/启动前自检
node localTool/scripts/fetch-runtime-models.mjs --check

# 从本地集成源目录拷贝（默认 C:/Users/xinye/Downloads/depth-video-converter，或 env DEPTH_VIDEO_SRC）
node localTool/scripts/fetch-runtime-models.mjs --from "D:/some/depth-video-converter"

# 钉死 vendor CDN 版本（避免 latest 漂移导致 sha 不匹配）
TRANSFORMERS_VERSION=3.5.2 ONNXRUNTIME_VERSION=1.20.1 node localTool/scripts/fetch-runtime-models.mjs
```

**拉取策略（每文件）：**
1. 已存在且 `size` + `sha256` 一致 → 跳过；
2. 否则优先从**本地镜像**（`--from` / `DEPTH_VIDEO_SRC` / MANIFEST 默认值）拷贝——保证与你磁盘现有字节一致；
3. 镜像缺失则走 **CDN 下载**（模型 HuggingFace，vendor jsDelivr）；
4. 落盘后再校验 `sha256`，不符即报错并提示钉版本/提供镜像（不静默覆盖）。

---

## 6.1 阿里云盘镜像（首选自托管源，已落地）

整套资源压成单个 `depth-video.zip`（约 377 MB，含 `depth-video/models/` 与 `depth-video/vendor/`）放在**资源盘** `/runtime-models/`。
依赖 `pip install aligo`，首次 `python localTool/scripts/aliyun-models.py login` 扫码（登录态持久化 `~/.aligo`）。

```bash
# 换机一键还原：下载 zip → 解压到 localTool/runtime-models/
python localTool/scripts/aliyun-models.py download depth-video
# 本地资源更新后重新打包上传：
python localTool/scripts/aliyun-models.py upload depth-video
# 其它：ls 列出云端文件 / reset 清空云端（移入回收站）
python localTool/scripts/aliyun-models.py ls
python localTool/scripts/aliyun-models.py reset
```

> 选 zip 而非逐文件上传，是为绕开阿里云盘「请求太频繁」限流；解压即还原，sha256 由 MANIFEST 兜底校验。
> 已实测：云端下载 → 解压 → 与 MANIFEST 22 个文件大小全部一致。

---

## 7. 工作流

### 7.1 首次 / 换机 / 新 clone
```bash
git clone <repo>
python localTool/scripts/aliyun-models.py download depth-video   # 从资源盘还原 ~377MB zip（推荐）
node localTool/scripts/fetch-runtime-models.mjs depth-video --check   # 确认就绪
```

### 7.2 CI / 测试环境
- **CI 不拉模型**（仓库本就不含、且 `docs/94` §6.3 要求测试不触发模型下载）。
- 若某 CI 步骤需要资源存在性校验，跑 `node localTool/scripts/fetch-runtime-models.mjs --check` 并允许「缺失即跳过」而非失败——模型缺失只影响本地 `ai` 深度模式，不影响主流程与 `fast` 模式。

### 7.3 localTool 启动校验（建议守卫）
- `localTool` 启动时应确认 `getDepthVideoDir()` 存在且关键文件就绪；缺失则**明确报错**（如「本地深度模型缺失，请运行 `node localTool/scripts/fetch-runtime-models.mjs`」），不要等浏览器 import 时才 404（呼应 `docs/94` R1 / §5.1）。
- 轻量实现：启动期调用 `fetch-runtime-models.mjs --check`，非零退出即告警并指路脚本，但不阻断其它功能。

---

## 8. 可选：Git LFS 替代方案（何时用）

本规范默认「**不入库 + 脚本重建**」。若未来需要一个团队共享、且希望「clone 即带模型」的形态，可改用 **Git LFS**：

```bash
git lfs install
git lfs track "localTool/runtime-models/**/*.onnx" "localTool/runtime-models/**/*.wasm"
```

- 优点：clone 自动带资源、版本可追溯。
- 代价：占用 LFS 配额（470MB/次）；单文件 >100MB 仍受平台限制（dpt-hybrid-midas 198MB 需确认平台上限）。
- **当前不采用**：本工具由个人跨机使用，镜像 + CDN 已可完全复现，LFS 收益有限、运维更重。

---

## 9. 新增模型 / 工具的步骤（对齐 §10 注册表前瞻）

1. 在 `localTool/runtime-models/<new-tool>/` 铺好 `vendor/` + `models/`；
2. 生成该工具的 `MANIFEST.json`（逐文件 `path/size/sha256/source`）；
   - 生成 sha256：`Get-FileHash -Algorithm SHA256 <file>`（PowerShell）或 `sha256sum <file>`；
3. 若新工具需独立运行时，在 MANIFEST `vendor` 增加 group + CDN；
4. 确认 `.gitignore` 规则已覆盖新工具的二进制扩展名（当前通配已覆盖 `*.onnx/*.wasm` 等，新扩展名需补）；
5. `node localTool/scripts/fetch-runtime-models.mjs <new-tool>` 自检；
6. 前端按 `docs/94` §10.3 铁律：资源前缀收口到单一常量、加载/释放提纯函数、不散写 URL。

---

## 10. 历史清理（重要）

本仓此前已把 `runtime-models` 的二进制**误提交**进了本地 3 个未推送 commit。当前 `.gitignore` + 以下操作可**停止继续追踪**（文件仍留在磁盘）：

```bash
# 从索引移除大文件（保留工作区文件），下一步提交即不再追踪
git ls-files localTool/runtime-models | Where-Object {
  $_ -match '\.(onnx|wasm)$' -or $_ -match 'transformers.*\.js$' -or $_ -match 'ort.*\.mjs$'
} | ForEach-Object { git rm --cached --ignore-unmatch $_ }

git commit -m "chore: 停止追踪 runtime-models 大体积二进制，改为 MANIFEST+脚本重建"
```

> ⚠️ 上述只让**未来** commit 不再含这些文件；它们仍残留在已提交的 3 个本地 commit 历史里（仓库体积未立即下降，但**未推送远端**，不影响他人）。
> 若要彻底从历史抹除、缩小 `.git`：在确认无需保留这 3 个 commit 的历史后，用 `git filter-repo --path localTool/runtime-models --invert-paths`（**破坏性、重写历史**，且需本地备份；未推送时才安全）。是否执行请显式确认。
