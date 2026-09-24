# depth-video · 本机推理资源目录

> 本目录存放浏览器端深度视频转换所需的**大体积二进制**（模型权重 + 推理运行时，约 470 MB）。
> 体系规范见 `docs/plan/147`（原 `docs/95` 的落点口径已被它取代）。

**仓库只追踪**：`MANIFEST.json`（文件清单 + sha256 校验）、`README.md`（本说明）。
> 其余**全部不入库**，规则只有一条（`localTool/.gitignore`）：`runtime-models/*/*` 整体忽略，
> 仅 `MANIFEST.json` 与 `README.md` 例外。
> 历史遗留（**已追踪**，不受忽略规则影响 —— gitignore 不追溯已入库文件）：
> `vendor/onnxruntime/README.md`、`vendor/transformers/LICENSE`。其余全部靠
> `fetch-runtime-models.mjs` 按 MANIFEST 重建。

> 本目录是这套体系的**首个样板**（有 MANIFEST、已在正确落点），故 2026-09-24 落点统一时**零改动** ——
> 连 URL 前缀 `/depth-video/*` 也作为历史别名保留（与 `/models/depth-video/*` 指向同一物理根，见 plan 147 §4）。

---

## 怎么把缺的资源下载回来

二进制靠 `localTool/scripts/fetch-runtime-models.mjs` 按 `MANIFEST.json` 重建（零依赖，Node ≥ 20.4）。
在**仓库根目录**或 `localTool/` 目录下执行：

```bash
# 1) 还原本工具（depth-video）全部资源（已存在且校验一致的文件会跳过）
node localTool/scripts/fetch-runtime-models.mjs depth-video

# 2) 仅校验是否已就绪，不下载（适合启动前 / CI 自检）
node localTool/scripts/fetch-runtime-models.mjs depth-video --check
```

### 从哪里拉取（优先级）
0. **阿里云盘镜像（推荐，已上传）**：整套资源压成单个 `depth-video.zip`（约 377 MB）放在资源盘 `/runtime-models/`。
   需先 `pip install aligo` 并 `python localTool/scripts/aliyun-models.py login` 扫码一次（登录态持久化）。
   ```bash
   # 换机一键还原：下载 zip 并解压到 localTool/runtime-models/（已存在同大小则跳过）
   python localTool/scripts/aliyun-models.py download depth-video
   # 解压后建议校验：node localTool/scripts/fetch-runtime-models.mjs depth-video --check

   # 本地资源有更新时，重新打包上传：
   python localTool/scripts/aliyun-models.py upload depth-video
   ```
   zip 内结构为 `depth-video/models/...` 与 `depth-video/vendor/...`，解压即还原，sha256 由 MANIFEST 兜底。
1. **本地集成源**（与你磁盘现有字节一致）：默认 `C:/Users/xinye/Downloads/depth-video-converter`，或环境变量 `DEPTH_VIDEO_SRC`，或用 `--from` 指定：
   ```bash
   node localTool/scripts/fetch-runtime-models.mjs depth-video --from "D:/some/depth-video-converter"
   ```
2. **CDN**（无本地镜像时自动走）：模型来自 HuggingFace（`onnx-community` / `Xenova`），运行时来自 jsDelivr。
   若 sha256 不符（CDN 版本漂移），钉版本重拉：
   ```bash
   TRANSFORMERS_VERSION=3.5.2 ONNXRUNTIME_VERSION=1.20.1 node localTool/scripts/fetch-runtime-models.mjs depth-video
   ```

### 脚本行为
- 每文件：已存在且 `size` + `sha256` 一致 → 跳过；否则本地镜像 → CDN；落盘后再 sha256 校验，不符即报错指路，不静默覆盖。
- 拉取后会校验 22 个文件；`--check` 只报「就绪 / 缺失」不下载。

---

## 换机 / 新 clone 流程
```bash
git clone <repo>
node localTool/scripts/fetch-runtime-models.mjs depth-video   # 重建 ~470MB 资源
node localTool/scripts/fetch-runtime-models.mjs depth-video --check  # 确认就绪
```

## 新增模型
两种做法：
- **接管已下载好的文件**（推荐）：`node localTool/scripts/runtime-model.mjs init <modelId> --from <文件>`
  —— 自动扫目录生成 `MANIFEST.json` 骨架（含 `size` + `sha256`），你只补 `source` 与用途说明。
- **手改清单**：往 `MANIFEST.json` 加对应条目（`path` / `size` / `sha256` / `source`），再跑上面的还原命令。

```bash
node localTool/scripts/runtime-model.mjs list          # 看全部模型（现算磁盘事实）
node localTool/scripts/runtime-model.mjs doctor        # 排查锚点/清单/就绪度
```

脚本会自动扫描 `localTool/runtime-models/*/MANIFEST.json`，不加工具名则拉全部。
