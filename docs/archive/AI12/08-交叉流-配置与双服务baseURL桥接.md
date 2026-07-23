# AI12 · 交叉流审计 T2.5.3 — 配置加载与双服务 base URL 桥接

> 状态：🟡 DRAFT（待门3校验 + 门4对抗审计）
> 行号快照：2026-07-21，grep `src/_engine/App.js` + `src/_engine/config.js` + `localTool/src/routes/resources.ts` 坐实
> 缝合模块：T2.1（配置层）+ T2.2（本地数据层）+ T2.3（网关层）
> 方法学：沿 base URL 接缝追踪（config 开关 → 各层实际请求地址）

---

## 一、端到端叙事（base URL 桥接）

```
config.js（静态）：
  USE_LOCAL_ENGINE = true (L36)
    → localEngineBase() = LOCAL_ENGINE.base = http://127.0.0.1:18080 (L12-18, L42-44)
    → REMOTE_BASE = http://127.0.0.1:9004 (L39)  ← USE_LOCAL_ENGINE=false 时才用

前端请求地址分两路：
  [数据/文件层] → localTool :18080
    Hr (= localToolStatusUrl) = 'http://127.0.0.1:18080' (var-mapping L117)
    vv (= localToolBaseUrl)    = 'http://127.0.0.1:18080' (var-mapping L118)
    → Sv/wv/Ev/xv 等用 vv (App.js L42840/L42859/L42885/L42827)
    → ii/Xr/Zr 用 Hr (L1871/L1832/L1828)

  [AI 生成层] → 网关 :9004
    DEFAULT_ENDPOINT = 'http://127.0.0.1:9004' (config.js L30)
    R (网关 base, 生图作用域局部) = ${R}/v1/tasks/{id} (App.js L33005)
    → 由 config ENDPOINTS[0].url 注入（T2.3 轮询-3 待查赋值点）
```

---

## 二、base URL 来源矩阵（grep 可验证）

| 用途 | 变量 | 值 | 位置 | 硬编码? |
|------|------|-----|------|---------|
| localTool 状态/数据 | `Hr` | 127.0.0.1:18080 | var-mapping L117 | ✅ 写死 |
| localTool 数据请求 | `vv` | 127.0.0.1:18080 | var-mapping L118 | ✅ 写死 |
| localTool 端口字符串 | `Bc`/`Wn` | '18080' | var-mapping L120/L121 | ✅ 写死 |
| localTool 轮询间隔 | `Gr` | 3000ms | var-mapping L119 | — |
| 网关默认端点 | `DEFAULT_ENDPOINT` | 127.0.0.1:9004 | config.js L30 | ✅ 写死 |
| 网关接入点列表 | `ENDPOINTS` | [{url:9004}] | config.js L25-27 | ✅ 写死 |
| 远程基址(关本地引擎) | `REMOTE_BASE` | 127.0.0.1:9004 | config.js L39 | ✅ 写死 |
| localTool rescan 补全 | `LOCAL_TOOL_BASE` | 127.0.0.1:18080 | resources.ts L30 | ✅ 写死 |
| API base 规范化 | `tr`(withApiSuffix) | 基于 `$n`(apiBaseUrl) | App.js L846 | 依赖 $n |
| API base 解析 | `ar`(resolveApiUrl) | localhost/127 规则 | App.js L863 | 依赖 $n |

---

## 三、跨层一致性风险（TASKS P0 + 红线 §3.2）

| 风险 | 证据 | 状态 |
|------|------|------|
| P0-1 host 硬编码 18080 | `Hr`/`vv`/`Bc`/`Wn`/`LOCAL_TOOL_BASE` 五处写死 18080 | ✅ 坐实（五处冗余） |
| P0-1 中文路径 Latin1 乱码 | localTool 侧（非 base URL 问题） | ⚠️ 待查（超出本次范围） |
| X3.3 base URL 不一致 | `ar`/`tr` 基于 `$n`(官方 API base)；`Hr`/`vv` 基于 18080。USE_LOCAL_ENGINE=false 时文件请求走 9004(`REMOTE_BASE`) 无 `/api/files/upload` 路由 → 失败 | ✅ 坐实（已知限制） |
| 配置-1 dev 代理死分支 | `ar`(L868-871) 仅当 `$n` 非 localhost/127 时把 localhost:3000 导向 `$n`；本地模式 `$n`=127.0.0.1 → 分支不触发 | ⚠️ 待查 `$n` 赋值 |

---

## 四、门4 对抗审计（反向质询）

**Q1**：`USE_LOCAL_ENGINE=false` 时，文件请求走哪？
→ 答：config.js `localEngineBase()`(L42) 返回 `REMOTE_BASE`(9004)。但前端 `Hr`/`vv` 是**写死 18080 的常量**（var-mapping），不读 `localEngineBase()`。即：config 开关与实际请求地址**脱钩**——`USE_LOCAL_ENGINE` 只影响 `localEngineBase()` 返回值，但 `Hr`/`vv` 常量忽略它。这会导致 false 时文件请求仍打 18080（若 localTool 没跑则失败），或按 TASKS X3.3 描述走 9004 无路由。需确认 `Hr`/`vv` 是否在某处被 `localEngineBase()` 覆盖（grep 未见，标注待查）。

**Q2**：五个 18080 硬编码点，改端口要改几处？
→ 答：至少 5 处（Hr/vv/Bc/Wn/resources.ts LOCAL_TOOL_BASE）+ config.js LOCAL_ENGINE。共 6 处。漏改即部分功能连错端口。建议抽env(`MAOMAO_DATA_DIR` 模式)统一。

**Q3**：`$n`(apiBaseUrl=Vn()) 真实值？
→ 答：func-mapping 标注"疑在 engine 包/外部，App.js 内未见声明"。本地模式应指向 9004 或空。单遍无法坐实，标注待上游确认（影响 `ar`/`tr` 行为）。

---

## 五、结论
1. TASKS P0-1（host 硬编码 18080）坐实且范围扩大至**五处前端常量 + config.js + localTool 共 6 处**。
2. **关键发现**：`USE_LOCAL_ENGINE` 开关与 `Hr`/`vv` 实际请求地址**脱钩**——config 的 `localEngineBase()` 不被文件请求层消费，存在配置失效风险。建议统一走 `localEngineBase()`。
3. `$n`(apiBaseUrl) 赋值在 engine 包，本模块无法单遍坐实，标注待查。
4. 网关 9004 地址同样硬编码（config.js + `R` 生图 base），但网关端口变更概率低，风险较小。
