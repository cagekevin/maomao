# localTool 与网关实证（AI05 / 深四度审计）

> 目的：把 ARCHITECTURE / TASKS 中依赖"描述"的 localTool 侧事实，回 `localTool/src/` 源码实证；并核网关 501 链路。
> 范围：仅审计，不改任何文件。回填见 `07`。

---

## 1. ✅ localTool rescan 孤儿清理实证（TASKS P2 #7 / ARCHITECTURE X3.2）

`localTool/src/routes/resources.ts` `handleResourcesRescan`(@L37)：
- L46-53 遍历 `uploadDir` 子目录（排除 `.thumbnails`）。
- L67-86 目录 → `type='folder'`，`source='local-tool'`，`id='local-{folder}-{name}'`。
- L89-117 文件 → `extToFileType(ext)` 映射（L12-21 扩展名表），`source='local-tool'`。
- **L120-130 孤儿清理**：
  ```ts
  const localRows = queryAll(db, `SELECT ... FROM resources WHERE source = 'local-tool'`);
  for (const row of localRows) {
    const diskPath = path.join(uploadDir, row.folder, row.name);
    if (!fs.existsSync(diskPath)) { run(db, `DELETE ...`, [row.id]); orphanDeleted++; }
  }
  ```
- ✅ 确认：**孤儿清理只清 `source='local-tool'`**（TASKS P2 #7 属实）；`source='extension'` 记录（前端采集）不被清理，符合设计。

## 2. ✅ `toAbsoluteFileUrl` 真实存在于 localTool（修正 09 节）

`localTool/src/routes/resources.ts` L30-35：
```ts
const LOCAL_TOOL_BASE = 'http://127.0.0.1:18080';
function toAbsoluteFileUrl(relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${LOCAL_TOOL_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}
```
- 被 rescan 入库调用（L77 `toAbsoluteFileUrl('/files/...')`、L95 同）。
- 这与 ARCHITECTURE L2.4「rescan 补全绝对路径」一致 ✅。
- **纠正**：TASKS P0 修复方案的函数名正确，但标"App.js L43462"是文件/行号错误——真实在 `localTool/src/routes/resources.ts` L31。

## 3. ✅ 资源删除不删磁盘（TASKS P2 #6）— 解法其实已存在

- `handleResourcesDelete`(@L202)：`run(db, 'DELETE FROM resources WHERE id = ?', [id])` —— **只删 DB**（与 App.js `wv`@L42857 一致，P2 #6 属实）。
- **但** `handleResourcesClear`(@L211) 已支持 `deleteFiles` 参数：
  ```ts
  if (body?.folder) {
    run(db, 'DELETE FROM resources WHERE folder = ?', [body.folder]);
    if (body.deleteFiles) fs.rmSync(path.join(getUploadDir(), body.folder), {recursive:true, force:true});
  }
  ```
- 即"删磁盘"的正确机制**已在 localTool 实现**，只是 App.js 的 `wv()`(@L42857) 调用 `DELETE /api/resources/delete` 时**没传 deleteFiles 语义**（该端点无 deleteFiles 参数，仅按 id 删）。修复路径：要么 `wv` 改用 clear 带 deleteFiles，要么给 delete 端点加 deleteFiles 参数。

## 4. ⚠️ 网关 501 链路（音乐/音频，TASKS 其他已知限制）

ARCHITECTURE L3.2：
- `/v1/music/generations` L655 **501**
- `/v1/audio/generations` L659 **501**
- `/v1/audio/speech` L663 **501(TTS)**

属"已知限制非 bug"，前端调用会收到 501。本次未读 gateway 源码（仅依据 ARCHITECTURE 引用，需在 9004 侧实证，建议后续核 `apimart-gateway/main.py` L655/L659/L663）。

## 5. 累计 localTool 侧审计结论

| 文档断言 | localTool 实证 | 结果 |
|---------|--------------|------|
| rescan 只清 source='local-tool' | resources.ts L120-130 | ✅ |
| rescan 补全绝对路径 | `toAbsoluteFileUrl` L31 + L77/L95 | ✅ |
| 删除只删 DB 不删盘 | handleResourcesDelete L202-208 | ✅ |
| 删盘机制缺失但有解 | handleResourcesClear L211 deleteFiles | ✅ 解法已存在 |
| 扩展名→类型映射 | RESCAN_FILE_TYPE L12-21 | ✅ 与 ARCHITECTURE L2.6 一致 |
| 缩略图伪复制（P2 #8） | 需核 files.ts（本审计未读） | ⏳ 待核 |

## 6. 校验

- rescan 孤儿清理 `source='local-tool'` @L123 ✅
- `toAbsoluteFileUrl` localTool resources.ts L31 ✅
- handleResourcesDelete 只删 DB @L207 ✅
- handleResourcesClear deleteFiles @L217 ✅
- 扩展名表 L12-21 ✅
