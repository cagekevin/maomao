# runtime-models · 本机模型资产根

> **一模型一目录**：`localTool/runtime-models/<模型名>/`。
> 浏览器按 `/models/<模型名>/文件名` 取件；仓库里**只存每个模型的 `MANIFEST.json` + `README.md`**，
> 模型文件本身不进 git（规则见 `localTool/.gitignore`）。

> 🚀 **换机 / 重装 → 直接跳到「零」**：三条命令，照做即可（成功判据也写在那里）。
> 「二」是定义与边界（含**不用做的事**与**已知现象**），出异常时才需要读。

---

## 零、换机 / 重装后要跑什么 —— **就这三条**

```bash
# ① 一次性前置：扫码登录（登录态持久化在 ~/.aligo，之后免登）
pip install aligo
python localTool/scripts/aliyun-models.py login

# ② 还原全部模型（一条命令：云端有什么就还原什么）
python localTool/scripts/aliyun-models.py download all

# ③ 校验（唯一的「文件损坏」防线，还原后必跑）
node localTool/scripts/runtime-model.mjs doctor
```

**成功判据**：第 ③ 条结尾出现 `结论：✅ 全部就绪`，且 `失败/缺失 0`。
**看到这行就结束了** —— 模型已可直接使用。不需要再手工校验、不需要回滚/恢复任何文件、
不需要把模型拷到别处（理由见「二」的**负面清单**与**已知现象**）。

> 判据很明确：**先照「零」做**；只有当输出与「零」或「2.5 已知现象」不符时，才需要往下读「二」。

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

## 二、还原 / 上传 —— 定义、边界与已知现象

### 2.1 真相分工（谁归谁，一次弄清）

| 东西 | 真源 | 怎么到手上 |
|---|---|---|
| 模型二进制（`.onnx` / `.tflite` / `.glb` / `.wasm` / 运行时 js…） | 阿里云盘**资源盘** `/runtime-models/<模型名>.zip` | `aliyun-models.py download all` |
| `MANIFEST.json` · `README.md`（**任意层级**，含 `vendor/onnxruntime/README.md`） | **git**（仓库自带） | `git clone` |
| 取件 URL 前缀 `/models/` | 代码：后端 `localOnlyPaths.ts` ↔ 前端 `runtimeModelUrl.ts` | `check:arch` 逐字对账 |

⇒ **网盘只管二进制**，清单/说明只有 git 一份真相。

### 2.2 前置（只需一次）

```bash
pip install aligo
python localTool/scripts/aliyun-models.py login   # 扫码；登录态持久化在 ~/.aligo，之后免登
```

缺依赖时脚本会明确报「缺少依赖 aligo」并给出修复命令（不裸甩 traceback）。

### 2.3 配套命令

| 想干什么 | 命令 |
|---|---|
| 看云端都有什么 | `python localTool/scripts/aliyun-models.py ls` |
| 只还原一个 | `python localTool/scripts/aliyun-models.py download <模型名>` |
| 本机模型改动后传上去 | `python localTool/scripts/aliyun-models.py upload <模型名>` |
| 有 `source` URL 的模型可不走网盘 | `node localTool/scripts/fetch-runtime-models.mjs`（不加名字 = 拉全部）|

### 2.4 这些事**不用做**（负面清单 —— 免得白忙、白担心）

- ❌ **不用**手工 `git checkout` / 回滚任何 `MANIFEST.json`、`README.md`：`aliyun-models.py`
  **打包时排除、解压时跳过**（2026-09-28 修）⇒ 网盘包**碰不到**这两类文件。
  实测：`download` 之后 `git status localTool/runtime-models` **零改动**。
- ❌ **不用**逐个模型 `download`：`download all` 就是「云端有什么还原什么」。
- ❌ **不用**担心漏模型：**网盘是唯一真相**，云端没有的包不会被还原（如实报错，不猜清单）。
- ❌ **不用**下载后手工核 sha256：`doctor` 干的就是这件事（唯一的「文件损坏」防线）。
- ❌ **不用**把模型拷进 `public/` 或 `dist/`：由 localTool 托管（见「四」）。

### 2.5 已知现象（看到这些**是正常的**，不要当故障排查）

| 现象 | 解释 |
|---|---|
| 解压前打印「本地已存在同大小 `xxx.zip`，直接解压」 | `<模型名>.zip` 是**本地缓存**：与云端同大小 → 跳过下载只解压（省流量）；云端更新过 → 尺寸不同 → 自动重下。缓存可删，删了下次重下 |
| 下载很慢 | 下行实测 ~33 kB/s 量级；**上传反而快**（~1~2.6 MB/s）⇒ 模型改动后「传上去」比「重下」划算 |
| 解压打印「ℹ️ 已保留本地仓库版 N 份清单/说明」 | **旧包**时代的正常提示（旧包内带着清单/说明）。用新打的包不会有这一行 |
| `depth-video` 解压出 23 个文件，而清单只列 22 条 | 多的是 `vendor/transformers/LICENSE`（tracked 附带件，不在清单内，无影响） |
| `doctor` 报某文件缺失 | 该模型**从没传过网盘**，或包不全 —— 如实报错，按提示 `upload` / 重下 |

### 2.6 上传（本机模型改动后）

```bash
python localTool/scripts/aliyun-models.py upload <模型名>
```

- **覆盖语义**：脚本显式传 `check_name_mode='overwrite'`。aligo 默认是 `auto_rename`，
  会新建 `<模型名> (1).zip` 而**不替换**旧文件（「以为替换成功、其实两份并存」）—— 已修，
  云端每个包**恒为一份**（= 本机目录镜像）。
- 打包**不含** `MANIFEST.json` / `README.md`（git 真源，见 2.1）。

### 2.7 怎么算「能用」

- 二进制齐 + `doctor` 全绿 ⇒ **模型侧就绪**（运行时零联网，加载器不回落公网）。
- 但**跑起来还需要 localTool(18080) 在**：模型由它托管 `/models/*`（dev 由 `vite.config.ts`
  的 `/models` proxy 转发到 18080）。模型**不进** `dist/` ⇒「解压完就脱离 localTool 单独跑」不成立。

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
⇒「clone 完就自带模型」不成立，换机后必须显式跑一次「零」那三条命令。
（这条判据只约束**运行时**；还原模型是**命令行**的事，与"运行时零联网"不冲突。）

## 六、相关真源

- 体系方案：`docs/plan/147-本机模型资产统一方案-2026-09-23.md`
- 落点判据：`docs/adr/ADR-0062-本机模型资产的落点判据*.md`
- 落点代码真源：`localTool/src/paths.ts::getRuntimeModelDir`
- 前缀真源：后端 `localTool/src/utils/localOnlyPaths.ts` ↔ 前端 `src/components/base/core/runtimeModelUrl.ts`（`check:arch` 逐字对账）