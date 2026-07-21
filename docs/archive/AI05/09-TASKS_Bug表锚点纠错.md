# TASKS.md Bug 表锚点纠错（AI05 / 深二度审计）

> 目的：核对 `docs/TASKS.md`「建议修复清单」中各行的行号/函数名是否与 `src/_engine/App.js` 实际代码一致。
> 范围：仅审计 TASKS.md 与代码偏差。**不改任何文件**，回填建议见 `07`/本文件。

---

## 1. ⚠️ P0 修复方案锚点错误（修正版）：`toAbsoluteFileUrl` 存在于 localTool，非 App.js L43462

> **重要更正（深四度审计）**：初版 09 节称 `toAbsoluteFileUrl` "全代码 0 命中"——实为搜索范围仅限 `src/`（`localTool/` 不在其内）。深四度审计在 `localTool/src/routes/resources.ts` **L31-35 找到该函数真实定义**：
> ```ts
> const LOCAL_TOOL_BASE = 'http://127.0.0.1:18080';
> function toAbsoluteFileUrl(relativePath: string): string {
>   if (/^https?:\/\//i.test(relativePath)) return relativePath;
>   return `${LOCAL_TOOL_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
> }
> ```
> 它被 rescan 入库（L77/L95 `toAbsoluteFileUrl('/files/...')`）和理论上资源保存时调用，负责把相对路径补全为绝对路径。

| TASKS.md 说法 | 代码事实 |
|--------------|---------|
| P0 行33：「Sv() 保存前 `toAbsoluteFileUrl(i.url)` \| App.js **L43462**」 | ① `toAbsoluteFileUrl` **存在于 localTool**（`localTool/src/routes/resources.ts` L31），**不在 App.js**；② L43462 实际是 `Lr = \`{...}\`` 云存储 JSON 模板字符串，既非 Sv 调用点也非该函数 |

**真相**：
- P0 破图修复 = **localTool 侧** `toAbsoluteFileUrl`（rescan 入库补全绝对路径）+ **App.js 侧** host 硬编码 18080 兜底（`d5d48dd`），两侧共同完成。
- TASKS 的函数名**正确**，但**文件/行号标错**（应是 localTool resources.ts L31，不是 App.js L43462）。

**影响**：下一个 AI 若按 TASKS 去 App.js L43462 找会扑空，并可能误改设置面板 JSON 模板。正确查法是搜 `localTool/src/routes/resources.ts`。

**Sv 真实调用点**（App.js grep 命中，均无 toAbsoluteFileUrl 包装）：
- L5367 / L8775 / L43107 / L43552 / L44168 `await Sv({...url, folder:'migrated', id})`

## 2. ⚠️ P0 残留描述需精确化

TASKS P0 正文（L11）：「资源面板 URL 格式不统一破图（已 `d5d48dd` 修复，残留: host 硬编码 18080；中文目录/文件名 Latin1 乱码待修）」——此描述**准确**，与代码一致（Hr/vv/U_ 三处硬编码 18080，见 `02` 模块1 X4）。仅修复方案的"行33/L43462/toAbsoluteFileUrl" 那行错。

## 3. ✅ 其余修复清单行号核对

| TASKS 行 | 引用 | 代码核对 | 结果 |
|---------|------|---------|------|
| P1 #2 L29160-29179 | `B` 回调 URL 不落盘 | `B`@L29188 只 `O([{url,source:'drop'}])` 入内存 | ✅ 准确 |
| P1 #3 L29165-29166 | `R` 上传不入库 | `R`@L29149 仅转 dataURL 预览 | ✅ 准确 |
| P2 #6 L42778 | `wv()` 删不删盘 | `wv`@L42857 只 `POST /api/resources/delete` | ✅ 准确（行号 L42778 旧，实测 L42857，漂移但指向同一函数） |
| P2 #7 孤儿清理 | source='local-tool' | localTool resources.ts（ARCHITECTURE L2.4） | ✅ 准确（localTool 侧） |
| P2 #8 缩略图伪复制 | localTool files.ts L136 | copyFileSync 无真实缩放 | ✅ 准确（localTool 侧） |
| P2 统一 base URL L1732/L42729 | `Hr`/`vv` | var-mapping L117/L118 值恒等 18080 | ✅ 准确 |

> 注：除 P0 行33 外，TASKS Bug 表的行号虽有漂移（如 wv L42778→L42857），但均指向正确的函数，属行号快照过时，非逻辑错误。

## 4. 汇总：TASKS.md 需修正项

| 位置 | 错误 | 建议修正 |
|------|------|---------|
| P0 修复方案行33 | `toAbsoluteFileUrl(i.url)` @L43462 | 删除该行或改为「d5d48dd 已修复（host 硬编码 18080 兜底）；残留项：Hr/vv/U_ 三处硬编码 + 中文路径 Latin1」；并更正 L43462 实为云存储 JSON 模板 |
| P2 #6 行号 | `wv()` L42778 | 更新为 L42857（可选，非阻塞） |

## 5. 校验

- `toAbsoluteFileUrl` grep `src/` = 0（**仅限 src/ 范围**；深四度已在 `localTool/src/routes/resources.ts` L31 找到真身，见本文件 L8-18 修正）
- L43462 = `Lr = \`{...}\`` 云存储 JSON 模板 ✅
- Sv 调用点 L5367/L8775/L43107/L43552/L44168 全部命中 ✅
- `import-project`/`export-project` @L38534/L44706/L44712 命中 ✅（见 `08` 节更正）
