# mediapipe · 本机模型资产目录

> 存放 **MediaPipe 视觉任务运行时（wasm）+ 人脸检测模型**（约 21 MB），供
> `src/components/image/lib/faceMosaic.ts` 的人脸打码使用。
> **只有 `MANIFEST.json` 与 `README.md` 入库** —— 其余文件不入库（规则见 `localTool/.gitignore`；
> 体系规范见 `docs/plan/147`）。

---

## 取件（浏览器）

前端**不拼字面量**，一律走唯一出口 `src/components/base/core/runtimeModelUrl.ts`：

| 用途 | URL |
|---|---|
| wasm 运行时根（`FilesetResolver.forVisionTasks` 的参数） | `/models/mediapipe/wasm` |
| 人脸检测模型（`FaceDetector.createFromOptions` 的 `modelAssetPath`） | `/models/mediapipe/blaze_face_short_range.tflite` |

- **生产**：页面本身由 localTool 18080 托管 `dist/` ⇒ `/models/*` 与页面**同源**，零配置。
- **开发**：`vite.config.ts` 的 `server.proxy` 把 `/models` 转发到 18080 —— 保持同源，不切换绝对 URL
  （绝对 URL 会让模型取件静默失败，实证见 `runtimeModelUrl.ts` 头注）。

## 还原本目录

```bash
# ① 首次：把本机现有资源打包上传网盘（若网盘还没有 mediapipe.zip）
python localTool/scripts/aliyun-models.py upload mediapipe

# ② 换机 / 丢失后：从网盘下载并解压到 localTool/runtime-models/
python localTool/scripts/aliyun-models.py download mediapipe

# ③ 校验 sha256（唯一防线）
node localTool/scripts/fetch-runtime-models.mjs mediapipe --check
node localTool/scripts/runtime-model.mjs doctor mediapipe             # 同上 + 锚点自检
```

> ⚠️ **网盘上这一步必须先 `upload` 过一次** —— `download` 在云端没有该 zip 时会明确报
> 「云端没有 mediapipe.zip，请先 upload」，不会假装成功。
> 各条 `source` 留空：这组文件没有可稳定直取的单文件 URL（原先就随仓库而来），故离线还原靠网盘镜像。
> **下载/还原后必须先 `--check`** —— 这是"文件损坏"的唯一防线。

## 变更留痕（本目录从哪来）

- 原在 `public/mediapipe/`（随仓库走、随 dist 分发、扩展下经 `chrome.runtime.getURL` 解析）。
- 2026-09-24 按 `docs/plan/147` §4.1 迁入本机模型宿主 ⇒ **不再入库、不再进 dist**（`dist/` 少 21 MB）。
- **已知代价**：Chrome 扩展形态不再可用 —— 扩展包内已无此目录，且 `public/manifest.json` 的 CSP
  `script-src 'self'` 也不允许从 localhost 加载 wasm 脚本。**Web 形态（dev / 18080）不受影响**。
  代价为用户 2026-09-24 明示接受，见 plan 147 §4.1 与 §十。