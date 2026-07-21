# 深五度：localTool 文件路由与缩略图实证（AI05）

> 对象：`localTool/src/routes/files.ts`（全文 369 行，本次首读源码，此前 P2 #8 仅据 ARCHITECTURE 描述）。
> 连同上一轮 `11` 节已读的 `resources.ts`，localTool 两个路由文件均已完成源码级实证。
> 红线：只读，不修改。

---

## 1. 文件路由总览（files.ts）

| 端点 | handler | 关键行为 |
|------|---------|---------|
| `POST /api/files/upload`（multipart） | `handleUploadFormData` L25 | 落盘 `uploads/{subfolder}/`，调 `tryGenerateThumbnail` |
| `POST /api/files/upload`（JSON） | `handleUploadJson` L74 | `fileUrl` 远程下载落盘，再生成缩略图 |
| `GET /api/files/read?path=` | `handleRead` L145 | 直读磁盘；支持 `X-Proxy-*` 头走 `handleReadProxy`(L189) 代理读 |
| `GET /api/files/thumbnail?url=&maxDim=&quality=` | `handleThumbnail` L224 | 返回 `{thumbnailUrl}`，**非**直接返回二进制 |
| `POST /api/files/mkdir` | `handleMkdir` L261 | 建目录 |
| `POST /api/files/move` | `handleMove` L277 | `fs.renameSync` |
| `GET /api/files/open` / `open-dir` | `handleOpen` L297 / `handleOpenDir` L317 | `execSync(explorer/open)` 系统打开目录 |
| `GET /api/files/list` | `handleList` L345 | 列目录，跳过 `.` 隐藏项（`.thumbnails` 因此不暴露） |

---

## 2. P2 #8「缩略图伪复制」实证（确认属实）

**两处生成逻辑均为 `fs.copyFileSync` 原样复制，无缩略/缩放**，与 ARCHITECTURE L2.4 描述一致：

### 2.1 上传时自动生成（tryGenerateThumbnail L121-142）
```121:142:localTool/src/routes/files.ts
async function tryGenerateThumbnail(filePath: string, urlPath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
  if (!imageExts.includes(ext)) return null;
  const thumbDir = path.join(path.dirname(filePath), '.thumbnails');
  if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
  const thumbPath = path.join(thumbDir, `thumb_${path.basename(filePath)}`);
  const thumbUrl = `/files/${path.relative(getUploadDir(), thumbDir).replace(/\\/g, '/')}/${path.basename(thumbPath)}`;
  // 简单复制原图作为缩略图（无 sharp 依赖时）
  try { fs.copyFileSync(filePath, thumbPath); return thumbUrl; }
  catch { return null; }
}
```
- 仅图片类扩展名才生成；非图片（视频/音频/PDF）返回 `null`，即**无缩略图**。
- 注释明言「简单复制原图作为缩略图（无 sharp 依赖时）；后续可接入 sharp 做真正的缩放」——**确为伪复制**。
- 缩略图与原图同尺寸，仅换目录 + `thumb_` 前缀。

### 2.2 按需生成（handleThumbnail L223-258）
```251:254:localTool/src/routes/files.ts
  // 简单复制（无 sharp 时）
  if (!fs.existsSync(thumbPath)) {
    fs.copyFileSync(filePath, thumbPath);
  }
```
- 入参 `maxDim`/`quality` 被解析（L230-231）但**完全未参与**生成——仅作文件名后缀（`thumb_${maxDim}x${quality}_${basename}`，L248），内容仍是原样复制。
- 返回 `json({thumbnailUrl})`，不返回 JPEG 二进制（与 ARCHITECTURE L2.4「返回 JSON 不返回二进制」一致）。

> **结论**：P2 #8 属实。缩略图 = 原图副本，尺寸未降。若前端依赖缩略图做性能优化（大图画廊），实际无收益；且大图场景下 `.thumbnails` 占用双倍磁盘。建议（仅记录，不改代码）：接入 sharp 真缩放，或删除伪复制逻辑改前端 CSS 缩放。

---

## 3. 关键边界契约（供交叉流审计缝合）

- **落盘路径统一**：所有上传走 `saveFile`(L104) → `uploads/{subfolder}/{Date.now()}-{safeName}`；`safeName` 经 `sanitizeFilename`(L117) 清洗非法字符。subfolder 默认 `canvas`，生图落 `tasks`（见 `04` 节 `ii(...,{subfolder:'tasks'})`）。
- **URL 返回格式**：`/files/{subfolder}/{basename}`（L38/L58/L91）——纯相对路径，**无 host**。前端须自行拼接 `http://localhost:18080`（即 P0 破图根因，host 硬编码兜底 `d5d48dd`）。
- **缩略图 URL 同理**：`/files/{relative thumbDir}/{basename}`，同样无 host。
- **代理读（handleReadProxy L189-221）**：支持 `X-Proxy-Url/Method/Headers/Cookie`，用于跨域资源转发；失败回 502。这是 03/04 节「生图落盘 18080 后前端如何取回」的读取侧支撑。
- **删除不删盘（与 11 节 P2 #6 呼应）**：`files.ts` 无独立删除路由；删除仅经 `resources.ts` `handleResourcesDelete`(L202) 删 DB。`handleResourcesClear`(L211) 已支持 `deleteFiles` 参数（真删盘解法已存在），但 `wv`(App.js@L42857) 未触发。

---

## 4. 与 11 节/网关的衔接

- localTool 侧「上传/缩略图/删除」三件套已全实证（`files.ts` + `resources.ts`）。
- 网关侧：music/audio 生成、TTS、转写均诚实 501（见 `11` 节 + 本轮 grep main.py L655/L659/L663）。

---

## 5. 本轮新发现的文档缺陷（追加到 07/校验报告）

### 5.1 apimart-gateway/README.md 与 main.py 自相矛盾（新增）
README L42-47 称：
- `POST /v1/music/generations` → `chat`（agent 处理音乐，异步 task）
- `POST /v1/audio/generations` → `chat`（音乐 agent 别名）

但实际 `main.py` L655/L659/L663 **直接 501 `not_supported_error`**，并不转发到 chat。README 描述与代码行为冲突。详见 `07` §2.4 / 校验报告三。

> 注：README L46-47 自己也注了 audio/speech、transcriptions 是 501，却把 music/audio generations 写成 chat——前后不一致。

---

## 6. 校验（门3）

| 引用 | 文件:行 | 命中 |
|------|---------|------|
| `tryGenerateThumbnail` 伪复制 | files.ts L121-142 | ✅ 实测 copyFileSync |
| `handleThumbnail` 伪复制 | files.ts L223-258 | ✅ 实测 copyFileSync，maxDim/quality 未参与 |
| `saveFile` 落盘 | files.ts L104-115 | ✅ |
| 缩略图无 host 相对 URL | files.ts L132/L249 | ✅ |
| handleReadProxy 502 | files.ts L189-221 | ✅ |
| music/audio 501 | main.py L655/L659/L663 | ✅ |
