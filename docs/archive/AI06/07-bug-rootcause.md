# AI06 · 阶段 4：已知 Bug 根因深挖（门4 对抗审计延伸）

> 审计日期：2026-07-21 ｜ 针对 `TASKS.md` P0–P2 做代码级根因坐实 + 修复影响面分析。
> 所有证据带 `file:line`，由 `search_content` 实 grep 取得。仅放 `docs/AI06/`，不动代码（红线§3.1）。
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist/原 docs。

## P0 — 必然导致问题

### P0.1 资源面板 URL 格式不统一破图（残留：host 硬编码 18080 / 中文目录 Latin1）
**根因（双向）**：
1. **localTool 返回相对路径**：`files.ts` L132 `thumbUrl = /files/${...}`、L248 同样返回 `/files/...` 相对路径（无 host）。前端 Chrome 扩展环境下被解析成 `chrome-extension://.../files/...` → `ERR_FILE_NOT_FOUND` → 重试刷日志（PROJECT_ORIGIN §8.6 实测单图 30449 行错误）。
2. **前端兜底**：App.js `ii`(L1888)/`uploadFile` 已补 `http://127.0.0.1:${Bc}` 前缀（Bc=LOCAL_ENGINE.port=18080, L19049），但**仅前端上传路径兜底**；rescan 返回的 URL、缩略图 API 返回的相对路径未必全覆盖。
3. **host 硬编码 18080**：`vv`@L42808 = `LOCAL_ENGINE.base` 是**写死常量** `http://127.0.0.1:18080`（仅用于资源记录，合理）；`Hr`@L1732 = `localEngineBase()` 是**动态函数**，随 `USE_LOCAL_ENGINE` 切换 18080/9004（非固定常量，详见 `12-crossflow-contracts.md` 纠正 `05` X3）。P0 残留真形态：`USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080 → false 模式配置死路。
4. **中文 Latin1 乱码**：`files.ts` 路径拼接用 `path.basename`/相对路径计算，中文目录/文件名在 Latin1 编码下乱码（windows 本地模式已知残留）。

**修复影响面**：
- 改 `files.ts` L132/L248 返回绝对路径 `http://127.0.0.1:${PORT}/files/...`（PORT 来自 index.ts L25 冲突检测同值）；
- 或保留前端兜底，但须确认 rescan/缩略图 API 全链路覆盖；
- host 硬编码建议改用 `config.js` 注入或 `process.env`，与 `USE_LOCAL_ENGINE` 联动。
- **风险**：前端兜底保留则双重前缀（`http://.../http://...`）需防重。改动须先证数据流（红线§3.3.10）。

**状态**：已 `d5d48dd` 部分修复（前端兜底），host 硬编码 + 中文 Latin1 待修。

---

## P1 — 特定条件触发

### P1.1 资源面板 URL 拖入不落盘（刷新丢失）
**根因**（已坐实 `B` 回调 @L29188）：
```js
let B = Y.useCallback(async e => {
  if (e.dataTransfer.files?.length > 0) {
    let t = await R(e.dataTransfer.files);   // 文件拖入→R 上传
    if (t.length > 0) { O(t.map(e=>({...e, source:'drop'}))); return; }  // 只存内存 O=setTransitItems
  }
  let t = e.dataTransfer.getData(`text/plain`) || e.dataTransfer.getData(`text/uri-list`);
  t && (t.startsWith(`http`) || t.startsWith(`data:image/`)) && O([{ url:t, source:'drop' }]);  // ← URL 拖入只存内存
}, [O, R, y]);
```
- L29203-29207：拖入 `http`/`data:image/` URL 时，仅 `O([{url:t, source:'drop'}])` 写入内存 `transitItems`(**O=setTransitItems**)，**不调 `ii()`/`Zr()` 下载落盘、不调 `Sv()` 入库**。
- `transitItems` 内存易失（ARCH X3.1），刷新即丢。
- 对比右键采集 `resourceAdded` 监听@L43527 → `Sv`(@L43552) 入库，此处缺对称处理。

**修复影响面**：拖入 URL 分支(L29204)应调 `Zr(url)`(上传从URL, L1827)→`Sv()` 入库，或提示"已加入传输区，手动保存到资源"。注意 `Zr` 重名（模块级=上传@L1827，logout 是局部@L43893），此处用模块级 `Zr`。

### P1.2 资源面板文件上传不自动入库（需手动 rescan）
**根因**（已坐实 `z` 回调 @L29159）：
```js
let z = Y.useCallback(async e => {
  let t = await R(e);                                   // R=上传文件，返回带 url 资源
  t.length !== 0 && O(t.map(e=>({...e, source:'upload'})));  // 只存内存 O
}, [O, R]);
```
- `R` 上传成功返回资源对象（含绝对 url），但只 `O(...)` 存内存 transitItems，**不调 `Sv()` 入库**。
- 须手动点"同步到本地"/rescan 才进 `resources` 持久表（对比 L43552 采集路径有 Sv）。

**修复影响面**：`z` 回调(L29160)成功后调 `Sv(t)` 入库（同 L43552 模式）。改动小，低风险。

---

## P2 — 逻辑/设计缺陷

### P2.1 资源删除不删磁盘文件（孤儿文件累积）
**根因**（前端 + localTool 双向坐实）：
- 前端 `wv` @L42857 → `fetch(${vv}/api/resources/delete?id=...)`（只发删除请求）。
- localTool `handleResourcesDelete` @L202：`run(db, 'DELETE FROM resources WHERE id = ?')` @L207，**只删 DB，无 `fs.unlink`**。
- 只有 `clear` 接口 `deleteFiles=true` 才删磁盘 @L217-219。

**修复影响面**：`wv`(L42857) 调用时传 `deleteFiles` 参数，或 localTool `handleResourcesDelete` 查资源 url→unlink 磁盘。需注意软删除 vs 硬删除语义、缩略图连带删除。

### P2.2 缩略图伪复制（无真实缩放）
**根因**（localTool `files.ts` @L121）：
```js
async function tryGenerateThumbnail(filePath, urlPath) {
  ...
  const thumbPath = path.join(thumbDir, `thumb_${path.basename(filePath)}`);
  // 简单复制原图作为缩略图（无 sharp 依赖时）
  fs.copyFileSync(filePath, thumbPath);   // ← L137 直接复制，无缩放
  return thumbUrl;
}
```
- `thumb_` 命名 @L131 有误导性（实际是原图副本，非缩略）；`handleThumbnail` @L248 也 `copyFileSync` @L253。
- 性能：大图当缩略图加载，浪费带宽/内存；P2 见 TASKS。

**修复影响面**：接入 `sharp` 做真实缩放（package.json 已列 `sharp ^0.35.3`，但未在 files.ts 用）。改 `tryGenerateThumbnail` 用 sharp resize。注意 WASM/Windows 原生模块兼容性。

### P2.3 Rescan 孤儿清理只清 source='local-tool'
**根因**（localTool `resources.ts` @L120）：
```js
// 孤儿清理：库中 source='local-tool' 但磁盘上对应路径已不存在的记录删除。
```
- 注释明说只清 `source='local-tool'`；`source='extension'`（右键采集入库）记录不被清理，即使磁盘文件已删也残留 DB 记录（ARCH L2.4 / X3.2）。

**修复影响面**：孤儿清理逻辑放宽到所有 source，或按 `source` 分类处理（extension 来源也校验磁盘存在性）。低风险。

### P2.4 统一 base URL 不一致（vv 写死 18080 / Hr 动态但 false 模式死路）
**根因**：`vv`@L42808 = `LOCAL_ENGINE.base` 是模块级**写死常量** `http://127.0.0.1:18080`（仅用于 `/api/resources/*`，硬编码合理）；`Hr`@L1732 = `localEngineBase()` 是**动态函数**，随 `USE_LOCAL_ENGINE` 切换（true→18080 / false→REMOTE_BASE=9004）。故"Hr/vv 双固定、开关无效"的假设**不成立**——真正问题在 `USE_LOCAL_ENGINE=false` 时 `Hr`→9004 但 localTool 路由只在 18080，是**配置死路**（无服务承接），非代码硬编码 bug（纠正详见 `12-crossflow-contracts.md`）。网关 base `R`(局部,=9004) 在生成回调内动态取。

**修复影响面**：统一 base URL 来源（config 注入），修 `USE_LOCAL_ENGINE=false` 分支使其指向真实可用服务，或明确本地模式仅支持 true。跨模块改动，须先证数据流（红线§3.3.10）。

---

## 其他已知限制（无害，非 Bug，不修）
- 音频/音乐生成 501（`/v1/music/generations`/`/v1/audio/*` 网关 L655/L659/L663 均 501）；
- 剪映发送占位（`Kn`→`/api/jianying/send` 只记日志，localTool system.ts L159）；
- 单任务 `pending_confirmation` 卡轮询（`AUTO_CONFIRM=false` 时，模块3 L32958）；
- 网关 404 噪音（内存任务库重启即丢，红线§3.3.8 无害）；
- `RootErrorBoundary` 的 `null` 异常（原版残留，红线§3.3.8 无害）；
- 18080 连不上功能受限不崩（前端降级）；
- V2 未启用。

---

## 校验门（门3 机器校验）
本文件引用的 `App.js:Lnnnn` / `localTool/...:Lnnn` 锚点均可由 `check-doc-citations.cjs` 校验（行号存在性）。
抽查：B@L29188 / z@L29159 / wv@L42857 / files.ts L132,L137,L248 / resources.ts L120,L207,L217 均命中 ✅。

## 结论
P0.1 / P1.1 / P1.2 / P2.1 / P2.2 / P2.3 / P2.4 根因全部代码级坐实，修复方案均有明确行号影响面。
所有修复均**只动 `App.js`(限修改区) / `localTool/*` / `config.js`**，不碰 vendor/dist（红线§3.1）。任何修复实施前须先证数据流（红线§3.3.10），并按 §3.1 命名规则用语义化命名。
