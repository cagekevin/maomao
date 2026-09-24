# three · 本机模型资产目录

> 存放 **3D 模型素材**（three.js / GLTFLoader 取件，约 5.4 MB）。
> **只有 `MANIFEST.json` 与 `README.md` 入库** —— 其余文件不入库（规则见 `localTool/.gitignore`；
> 体系规范见 `docs/plan/147`）。

| 文件 | 状态 |
|---|---|
| `xbot-animated-lod.glb`（2.9 MB） | **在用** —— director3d 内置人物（减面版 49k→15k 三角，蒙皮/骨骼/动画全保留） |
| `ue-mannequin-retopology.glb`（750 KB） | 备用素材（`src/` 零引用；UE 人形移植预留，见 `docs/plan/50`） |
| `x-bot.fbx`（1.75 MB） | 备用素材（`src/` 零引用，见 `docs/plan/51`） |

> 已删：`xbot-animated.glb`（3.7 MB，**死文件**）—— `docs/plan/50` 已证全仓零引用（注释声称"作回退"，
> 而真正的回退是 `ModelErrorBoundary` 的程序化胶囊体）。删除前已按 `ADR-0053` 复验：代码/字符串/白名单/测试
> 四口径零引用。

---

## 取件（浏览器）

前端**不拼字面量**，一律走唯一出口 `src/components/base/core/runtimeModelUrl.ts`：

```ts
runtimeModelUrl('three', 'xbot-animated-lod.glb')  // → /models/three/xbot-animated-lod.glb
```

由 `src/components/director3d/models.tsx` 的 `BUILT_IN_MODEL_URL` 消费（`useGLTF`）。
生产同源（页面由 localTool 18080 托管 `dist/`）；开发由 `vite.config.ts` 的 `server.proxy` 转发 `/models`。

## 还原本目录

```bash
# ① 首次：把本机现有资源打包上传网盘（若网盘还没有 three.zip）
python localTool/scripts/aliyun-models.py upload three

# ② 换机 / 丢失后：从网盘下载并解压到 localTool/runtime-models/
python localTool/scripts/aliyun-models.py download three

# ③ 校验 sha256（唯一防线）
node localTool/scripts/fetch-runtime-models.mjs three --check
node localTool/scripts/runtime-model.mjs doctor three
```

> ⚠️ **网盘上这一步必须先 `upload` 过一次** —— `download` 在云端没有该 zip 时会明确报
> 「云端没有 three.zip，请先 upload」，不会假装成功。
> 各条 `source` 留空：这组文件没有可稳定直取的单文件 URL（原先就随仓库而来），故离线还原靠网盘镜像。
> **下载/还原后必须先 `--check`**。

## 变更留痕（本目录从哪来）

- 原在 `public/models/`（随仓库走、随 dist 分发）。
- 2026-09-24 按 `docs/plan/147` §4.1 迁入本机模型宿主 ⇒ **不再入库、不再进 dist**（`dist/` 少 8.8 MB）。
- 迁移与删除均为**用户可感知的变化**（clone 后不再自带这些模型，需先取件），已显式声明于 plan 147 §4.1。