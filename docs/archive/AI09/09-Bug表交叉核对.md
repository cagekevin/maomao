# AI09 · TASKS.md Bug 表交叉核对（T3.2）

> 对照 `docs/TASKS.md`「已知 Bug / 风险（P0–P2）」+「建议修复清单」，逐条用本次 grep 实测验证锚点真伪与结论是否成立。
> 红线：只审计、只派生；不修改 TASKS.md。
> 行号快照 2026-07-21，回填前请重 grep。

---

## 一、已知 Bug / 风险 逐条核对

| 项 | TASKS 原文锚点 | AI09 实测 | 核对结论 |
|----|------|------|------|
| **P0-1** 资源面板 URL 格式不统一破图（已 `d5d48dd` 修复；残留 host 硬编码 18080 + 中文路径 Latin1 乱码）| 无具体行 | host 硬编码 `LOCAL_ENGINE.host='127.0.0.1'`(config L13)；中文路径 Latin1 见 08 流三 P0 残留 | ✅ 残留项属实 |
| **P1-2** URL 拖入不落盘：`B` 回调 L29160–29179 只存状态不下载 | `B` L29160–29179 | `B`/`R` 是组件内多处局部重名，非模块级；URL 拖入真实落盘路径为 `ii({subfolder:'canvas/drop'})`(App.js L1888)。TASKS 用 `B` 作模块级符号**不准确**（与 AI05 结论一致，见 03 二）| ⚠️ 现象存疑/符号名错 |
| **P1-3** file input 上传不入库：`R` 回调 L29165–29166 上传后不调 Sv() | `R` L29165–29166 | 同上，`R` 非模块级；上传落盘走 `ii`(L1888)→`POST /api/files/upload`(index.ts L135)；入库 `Sv`(L42838)。TASKS 符号名错 | ⚠️ 符号名错 |
| **P1-4** handleUploadFormData fileUrl 跨域失败 — 实际不是问题 | 无 | Node fetch 不受 CORS 限制（localTool 服务端），属实 | ✅ 已正确标记非问题 |
| **P2-5** ResourceAdded base URL 不一致（仅 `USE_LOCAL_ENGINE=false` 触发）| 交叉点 3 | 08 流三已证：`Hr`(L1732)/`vv`(L42808)/`U_`(L41570) 三者均 = `LOCAL_ENGINE.base`，当前 `true` 不触发 | ✅ 当前不触发 |
| **P2-6** 资源删除不删磁盘：`wv()`(L42857) 只删 DB | `wv` L42857 | `wv` 实存(App.js L42857)；localTool `/api/resources` delete 路由**已支持 `deleteFiles` 参数**(localTool resources.ts L212/L217/L224)，但 `wv` 未传 → 长期孤儿文件 | ✅ 现象属实，且机制已具备（修复更轻）|
| **P2-7** Rescan 孤儿清理只清 `source='local-tool'` | 无 | 见 02 交叉流：孤儿清理 SQL 仅 `WHERE source='local-tool'`；`source='extension'` 不被清理 | ✅ 属实 |
| **P2-8** 缩略图伪复制：仅 copyFileSync，`thumb_{maxDim}x{quality}_` 误导 | files.ts L136 | localTool files.ts L248/L253：`thumb_${maxDim}x{quality}_${basename}` + `fs.copyFileSync`(L253)，无真实缩放 | ✅ 属实 |

---

## 二、建议修复清单 逐条核对

| 优先级 | TASKS 修复方案锚点 | AI09 实测 | 核对结论 |
|--------|------|------|------|
| P0 | `Sv()` 保存前 `toAbsoluteFileUrl(i.url)` @ App.js L43462 | `Sv` 实存(App.js L42838)；但全量 grep `toAbsoluteFileUrl` = **0 匹配**，L43462 处无此调用。P0 修复描述引用的符号/行号**不实** | ❌ 锚点失效，需重 grep 定位真实插入点 |
| P1 | 拖入 URL 调 `ii()`(L1888) 下载落盘 | `ii` 实存(App.js L1888) | ✅ 锚点正确 |
| P1 | `R`(files) 成功后调 `we()`/`Sv()` @ App.js L29133 | `R` 非模块级；`Sv` 实存(L42838)；`we` **非模块级函数**（TASKS L42834 处是 `Ev` 内部 fetch `/api/resources/rescan`，见下；`we` 实为组件作用域变量，被 L35845/L36253/L36295 等调用）。行号/符号需修正 | ⚠️ 符号名错 |
| P2 | `wv()` 加 deleteFiles 联动 @ App.js L42857 | `wv`(L42857) + localTool 已支持 `deleteFiles`(resources.ts L212) → 修复仅需 `wv` 传参 | ✅ 锚点正确，修复成本低 |
| P2 | 缩略图接入 sharp 真实缩放 @ localTool files.ts L136 | files.ts L131/L248 两处缩略图，L136 是第一处（无尺寸参数），L248 是带尺寸但仍 copyFileSync | ✅ 锚点方向正确（L136 为其中一处）|
| P2 | 统一 base URL：`Hr` 和 `vv` 用同一配置源 @ App.js L1732/L42729 | `Hr`=localToolStatusUrl(var-mapping L117)，`vv`=localToolBaseUrl(L118)，`U_`=localServiceBaseUrl(L233)——三者值均为 `http://127.0.0.1:18080`，已同源；L42729 一带需 grep 确认是否真有不一致代码 | ⚠️ 当前已同源，矛盾或仅在 false 分支 |

---

## 三、关键发现：`we`（rescan 触发器）符号澄清

- TASKS.md 将 rescan 主函数记为 `we`（L42834），但实测：
  - `we` **不是模块级函数**，而是组件作用域变量（被 L35845/L35901/L36253/L36295/L37878 调用，L44350 赋值 `Di.current = we`）。
  - 真正发起 `fetch(${vv}/api/resources/rescan)` 的是 **`Ev()`**(App.js L42883) 内部（L42885），以及 `rescanThrottledSync` 这个 useCallback(App.js L43028)。
  - TASKS T0.1 也把 `we` 当 rescan 主函数，且 `func-mapping.txt` **未收录 `we`**。
- 建议回填：rescan 触发器统一为 `Ev()`(L42883) + `rescanThrottledSync`(L43028)；`we` 降级为"组件内 rescan 调用点局部变量"，不再作权威符号。

---

## 四、给 TASKS.md 维护者的回填建议（不代改）

1. **P0 修复清单行33**：`toAbsoluteFileUrl` 在 App.js 全量 0 匹配，L43462 处无此调用 → 重 grep `Sv` 真实调用点，定位 `toAbsoluteFileUrl` 应插入位置（或该功能已在 `d5d48dd` 修复中通过别处实现，需注明）。
2. **P1-2 / P1-3 / 修复清单 P1 行35**：`B`/`R` 是组件内局部重名，非模块级 → 改用真实函数名（`ii` L1888 落盘、`Sv` L42838 入库），引用须带行号。
3. **修复清单 P1 行35 的 `we`**：改为 `Ev()`(L42883) 或 `rescanThrottledSync`(L43028)。
4. **P2-6**：localTool 已支持 `deleteFiles`，修复只需 `wv`(L42857) 传 `deleteFiles:true`，成本低。
5. 其余 P2-5/7/8 与「其他已知限制」经实测全部属实，无需改动结论。

> 汇总：TASKS Bug 表**现象结论基本成立**（仅 P1-2/P1-3 的机制描述待定），但**多处符号锚点（B/R/we/toAbsoluteFileUrl@L43462）不实**，是下一 AI 按图索骥的主要陷阱。
