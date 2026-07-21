# AI12 · 交叉流审计 T2.5.2 — Rescan 孤儿清理与资源入库一致性

> 状态：🟡 DRAFT（待门3校验 + 门4对抗审计）
> 行号快照：2026-07-21，grep `src/_engine/App.js` + `localTool/src/routes/resources.ts` 坐实
> 缝合模块：T2.2（本地数据层与Rescan）+ T2.3（AI生成落盘）+ T2.4（画布拖入）
> 方法学：沿边界契约接缝端到端追踪

---

## 一、端到端叙事（Rescan 全链路）

```
[1] 触发 rescan
    Ev()(App.js L42883) → POST /api/resources/rescan
    或 统一同步 effect 调 Di.current()=we()(L43015) → Ev()

[2] localTool 处理（resources.ts）
    handleResourcesRescan (resources.ts L37)
    ├─ 扫 uploadDir 子目录（排除 .thumbnails / '.'开头）(L46-53)
    ├─ 遍历 entry：
    │   文件夹 → type='folder', source='local-tool', id=`local-{folder}-{name}` (L67-86)
    │   文件 → extToFileType 映射 (L90-92)，失败跳过
    │         → url=toAbsoluteFileUrl('/files/{folder}/{name}') (L95)
    │         → source='local-tool', id=`local-{folder}-{name}` (L96)
    │   已存在同 id → skipped（保留收藏/元数据）(L99-103)
    │   否则 upsertResource (L115)
    ├─ 孤儿清理（L120-130）：
    │   取 source='local-tool' 全部记录
    │   磁盘不存在 → DELETE FROM resources (L127)
    │   ⚠️ source='extension' 记录不参与孤儿清理

[3] 返回 count → 前端 we()(L43015) → xv()(L42821) 刷新资源面板
```

---

## 二、接缝核对表（grep 可验证）

| 接缝 | 类型 | 位置 | 验证 |
|------|------|------|------|
| `Ev`(rescan API) | 函数 | `App.js:L42883` | ✅ |
| `we`(rescan+刷新) | useCallback | `App.js:L43015` | ✅ |
| `xv`(listResources) | 函数 | `App.js:L42821` | ✅ |
| `handleResourcesRescan` | 路由 | `localTool/src/routes/resources.ts:L37` | ✅ 文件存在 |
| 孤儿清理逻辑 | 代码 | `resources.ts:L120-130` | ✅ `WHERE source='local-tool'` |
| `toAbsoluteFileUrl` | 函数 | `resources.ts:L31-35` | ✅ 硬编码 18080 |
| `handleResourcesDelete` | 路由 | `resources.ts:L202-209` | ✅ 只删 DB |
| `handleResourcesClear` | 路由 | `resources.ts:L211-238` | ✅ deleteFiles 真删磁盘 |

---

## 三、跨层一致性风险（TASKS P2 坐实）

| 风险 | 证据 | 状态 |
|------|------|------|
| P2-6 删除不删磁盘 | `wv`@L42857 → `POST /api/resources/delete` → `handleResourcesDelete`(resources.ts L207 只 `DELETE FROM resources`) | ✅ 坐实：单删只删 DB |
| P2-6 修复路径已存在 | `handleResourcesClear`(L217/L224) 收 `deleteFiles:true` 真删磁盘；`Tv`@L42866 可传 `deleteFiles` | ✅ 修复入口存在，但 `wv`(单删) 未接 |
| P2-7 孤儿清理只清 local-tool | `resources.ts:L123` `WHERE source='local-tool'` | ✅ 坐实：extension 来源不被清理 |
| P0-1 host 硬编码 18080 | `resources.ts:L30` `LOCAL_TOOL_BASE='http://127.0.0.1:18080'` | ✅ 坐实（双处：config.js + 此处） |
| 割裂面：拖入 URL 不落盘 | T2.2 P1-1：`resourceAdded` 链对 extension 来源调 `Zr`(下载)@L1827 落盘；但若走 transitItems 仅存 URL → rescan 不扫（rescan 只扫磁盘，不扫内存 URL）→ 刷新丢失 | ⚠️ 存疑 |

---

## 四、门4 对抗审计（反向质询）

**Q1**：P2-6 说"删除不删磁盘产生孤儿文件"。那 clear(deleteFiles=true) 能清理吗？
→ 答：能。`handleResourcesClear`(L217/L224) 收到 `deleteFiles:true` 删磁盘。但**单条删除** `wv`@L42857 调 `handleResourcesDelete`（无 deleteFiles 参数，L207 只删 DB）→ 单删必留孤儿。修复建议：`wv` 增加可选 deleteFiles 参数透传。

**Q2**：P2-7 孤儿清理只清 local-tool，extension 来源的磁盘文件谁删？
→ 答：extension 来源的资源，其磁盘文件由**统一同步 effect / resourceAdded 链**通过 `Zr`(下载)@L1827 落盘到 `uploads/migrated/`，source 应记为 `local-tool`（见 L43533 `source: r?'local-tool':'extension'`，其中 r=source==='local-tool'）。即：extension 网页直链下载后 source 变 local-tool → 孤儿清理能覆盖。但 transitItems 纯 URL（未下载）的 extension 记录，磁盘无文件，无孤儿可言。**结论：P2-7 实际危害有限**，但代码逻辑上确实存在"extension 来源且磁盘有残留"的边界未清理。

**Q3**：rescan 的 id=`local-{folder}-{name}` 与前端 `resourceAdded` 链 id=`Date.now()` 冲突吗？
→ 答：会。`resourceAdded` 对 extension 来源下载后入库用 `id: String(i.id)`(L43554)，而 i.id 来自 background 的 `Date.now()`；rescan 用 `local-{folder}-{name}`。同一文件可能两条记录（一条 Date.now() 的 extension、一条 local- 的 local-tool）。印证 ARCHITECTURE X3.2 资源 ID 冲突风险。

---

## 五、结论
1. TASKS P2-6/P2-7 全部坐实，且发现 **P2-6 修复路径已存在**（`clear`+deleteFiles），仅单删 `wv` 未接。
2. P0-1 双处硬编码 18080 坐实（config.js + resources.ts L30）。
3. 资源 ID 冲突（X3.2）坐实：rescan 的 `local-` id 与 resourceAdded 的 `Date.now()` id 不一致。
4. `resourceAdded` 是 **chrome.runtime 消息，非 window CustomEvent**（修正 ARCHITECTURE X2 表述）。
