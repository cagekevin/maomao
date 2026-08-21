# 28-R6 · providerStore / cloudSync 深化核对（可执行）

> 配套售后计划：`docs/27-API中转层售后收口计划-2026-08-22.md`（R6）。
> 定位：**确认 + 补边角**，非大改造。providerStore/cloudSync 对 providers 新形态（`{code:0,data:{providers}}`）的消费已在 B3 核对并测试通过（27 用例），本项只补遗漏分支。

---

## 1. 现状（已确认）

### 1.1 providerStore（`src/components/base/settings/providerStore.js`）
已正确适配 `{code:0,data}` 新形态：
- `load()` :93 `data?.data?.providers` ✅
- `save()` :250 `data?.data?.providers` ✅
- `fetchModels()` :174 `data?.data` + 读 `m.image_models` ✅
- `test()` :149 `!data?.ok`（probe 豁免域，不剥壳）✅

**测试覆盖**（`tests/unit/providerStore.test.js`，17 用例）：load/test/probe/fetchModels/save 主要分支已覆盖。

### 1.2 cloudSync（`src/components/base/cloudSync.js`）
- `collectLocal()` :133-135 `const {data:pd} = await providerApi.getProviders()` + `pd?.providers` ✅
- `saveProviders(ls.providers)` :163 直接传数组 ✅

**测试覆盖**（`tests/unit/cloudSync.test.js`，11 用例）：已覆盖同步/恢复主路径。

---

## 2. 待补的边角（核对后确认是否需要）

| 候选 | 现状 | 是否需要补 |
|---|---|---|
| providerStore `test()` 的 apimart 异步嗅探失败分支 | :149-158 已覆盖（测试 `probe-async 补全诊断`） | 已覆盖 ✅ |
| providerStore `fetchModels()` 缺字段返回 | :207 已覆盖 | 已覆盖 ✅ |
| cloudSync 同步时 localTool 未连（catch 跳过） | `collectLocal` 有 try/catch | 可补一条断言 |
| providerStore 空 providers 时 `save()` 的 `active_api_endpoint` | :259-267 | 可补 |

---

## 3. 执行步骤

1. 核对上述 4 个边角是否有测试断言；缺的补
2. 重点补：cloudSync 未连 localTool 的降级路径（catch 静默跳过）
3. 跑 `npm run test:unit` 确认

---

## 4. 验收

- [x] 4 个边角都有断言（或明确标注"已覆盖"）
- [x] `tests/unit/providerStore.test.js` + `tests/unit/cloudSync.test.js` 全绿
- [x] `npm test` 全绿

---

## 4.1 执行结果（2026-08-22）

4 边角核对与补断言：

| 边角 | 现状 | 处理 |
|---|---|---|
| providerStore `test()` apimart 异步嗅探失败分支 | 仅覆盖 probe-async 成功补全；catch 保留原始信息分支（:156-158）无断言 | ✅ 补 1 条：probe-async 抛错时 testResult 保留 test-connection 原始信息 |
| providerStore `fetchModels()` 缺字段返回 | 已覆盖（`返回结构缺字段返回 ok=false`） | ✅ 已覆盖 |
| cloudSync 同步时 localTool 未连（catch 跳过） | `collectLocal` try/catch 降级（:132-136）无显式断言；原 mock 缺 getProviders 靠隐式抛错 | ✅ 补 1 条：getProviders 抛错 → 仍成功上传且 data 不含 providers |
| providerStore 空 providers 时 `save()` 的 `active_api_endpoint` | `if (primary)` 保护（:259-267）无"不写 KV"断言 | ✅ 补 1 条：空 providers save 成功且不写 KV |

- 测试：`cloudSync.test.js` 12 用例、`providerStore.test.js` 18 用例，全绿（30/30）。

---

## 5. 文件清单

| 文件 | 改动 |
|---|---|
| `tests/unit/cloudSync.test.js` | 补未连 localTool 降级断言 |
| `tests/unit/providerStore.test.js` | 视核对结果补空 providers 边角 |

---

## 5.1 代码审计修订（2026-08-22，code-explorer 实测）

> 实际读取 `providerStore.js`/`cloudSync.js`/测试文件后修正：

- load():93 / save():250 / fetchModels():173-175 / test():149 行号与分支**全部属实** ✅。
- cloudSync collectLocal():133-135 / saveProviders():163 **属实** ✅；未连 localTool 的 `catch {}` 降级（:132-136）真实存在 ✅。
- **⚠️ 用例数修正**：`tests/unit/providerStore.test.js` 实为 **16 条 `it`**（文档写"17"多算 1）；`tests/unit/cloudSync.test.js` 确为 **11 条 `it`** ✅。
- 测试覆盖分支（load/test/probe-async/fetchModels/save）与文档描述一致，R6 仅补 cloudSync 未连降级 + providerStore 空 providers 边角断言即可。

## 6. 边界

- **低价值**：这是"确认 + 补边角"，不作为阻塞任务，可在改 provider/cloudSync 相关功能时顺手做
- 不新增 mock 复杂度，只在现有测试框架内补断言
