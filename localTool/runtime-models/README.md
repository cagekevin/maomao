# runtime-models · 本机模型资产根

> **一模型一目录**：`localTool/runtime-models/<模型名>/`。
> 浏览器按 `/models/<模型名>/文件名` 取件；仓库里**只存每个模型的 `MANIFEST.json` + `README.md`**，
> 模型文件本身不进 git（规则见 `localTool/.gitignore`）。

---

## 一、装一个新模型 —— 就这 4 步

```bash
# 1) 把文件收进模型目录（自动算 size/sha256、生成清单骨架）
node localTool/scripts/runtime-model.mjs init <模型名> --from ~/Downloads/xxx.onnx

# 2) 补 localTool/runtime-models/<模型名>/MANIFEST.json 里的两项
#    description → 这模型干嘛用的
#    source      → 能直取的下载 URL；没有就留空 ""（留空 = 走网盘还原，"下载后必跑 --check"）

# 3) 校验（唯一的"文件损坏"防线；下载 / 还原后必跑）
node localTool/scripts/runtime-model.mjs doctor <模型名>

# 4) 看全部模型 / 缺什么
node localTool/scripts/runtime-model.mjs list
```

`<模型名>` 就是目录名，随便起（`super-res`、`matting`…）。
**加模型不用改代码、不用改 `.gitignore`** —— 这就是"一模型一目录"的收益。

## 二、把模型全部同步下来（换机 / 文件丢了）

> **前置（只需一次）**：`pip install aligo`，再 `python localTool/scripts/aliyun-models.py login` 扫码登录一次
> （登录态持久化在 `~/.aligo/`，之后免登）。缺 aligo 时脚本会明确报「缺少依赖 aligo」并给出修复命令。

```bash
python localTool/scripts/aliyun-models.py download all   # ★ 一条：云端全部模型包逐个下载 + 解压
node localTool/scripts/runtime-model.mjs doctor          # 校验（不带模型名 = 查全部）
```

配套命令：

| 想干什么 | 命令 |
|---|---|
| 看云端都有什么 | `python localTool/scripts/aliyun-models.py ls` |
| 只还原一个 | `python localTool/scripts/aliyun-models.py download <模型名>` |
| 首次把本机模型传到网盘 | `python localTool/scripts/aliyun-models.py upload <模型名>` |
| 有 `source` URL 的模型可不走网盘 | `node localTool/scripts/fetch-runtime-models.mjs`（不加名字 = 拉全部） |

> ⚠️ **网盘是唯一真相**：`download all` 只还原云端**实际存在**的 `<模型名>.zip`，不猜清单。
> 某个新模型若从没 `upload` 过，它就不会被还原 —— 这是**如实报错**，不是静默漏掉。

## 三、现在有哪些模型

`node localTool/scripts/runtime-model.mjs list` **现算磁盘事实**。
本文件**不维护模型清单副本**（那会是第二份真相，必然漂移）。

## 四、前端怎么取模型文件

不许自己拼路径，走唯一出口：

```ts
import { runtimeModelUrl } from '@/components/base/core/runtimeModelUrl';
runtimeModelUrl('three', 'xbot-animated-lod.glb'); // → /models/three/xbot-animated-lod.glb
```

- **生产**：页面由 localTool(18080) 托管 `dist/` ⇒ 模型与页面**同源**，零配置。
- **开发**：`vite.config.ts` 的 `server.proxy` 把 `/models` 转发到 18080 ⇒ 同样同源。
- 所以取路径**永远长这样，不分环境**（绝对 URL 会让模型取件静默失败，见 `runtimeModelUrl.ts` 头注）。

## 五、为什么不自动下载

**运行时零联网**是已裁定的判据（`TD-08-26`）：加载器不得联网拉模型，缺模型要**明确报错 + 指路**。
⇒ "clone 完就自带模型"不成立，换机后必须显式跑一次上面的同步命令。

## 六、相关真源

- 体系方案：`docs/plan/147-本机模型资产统一方案-2026-09-23.md`
- 落点判据：`docs/adr/ADR-0062-本机模型资产的落点判据*.md`
- 落点代码真源：`localTool/src/paths.ts::getRuntimeModelDir`
- 前缀真源：后端 `localTool/src/utils/localOnlyPaths.ts` ↔ 前端 `src/components/base/core/runtimeModelUrl.ts`（`check:arch` 逐字对账）