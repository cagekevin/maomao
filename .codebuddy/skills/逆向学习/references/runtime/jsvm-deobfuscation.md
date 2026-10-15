# JS 自定义虚拟机（JSVMP）还原

> 移植自通用逆向库的 `dsl-vm-reverse`，已剥离路由 / field-journal 依赖。
> 用于逆向基于 JavaScript 实现的**自定义 WASM 虚拟机 / 风控引擎**（不是标准 WASM，也不是普通 webpack）。
> 工具选型（含栈帧式 JSVMP 工具链 **Twisted**）见 `references/bundle/toolchain.md`。

---

## 1. 识别特征（命中任意即用本文件）

| # | 特征 | 说明 |
|---|---|---|
| 1 | IIFE 开头 + 大量单字母变量名 | `!function(){var U=void 0,y=parseInt,E0=Function,...}` |
| 2 | 含 `DG()` 或类似函数带 **switch-case 主循环** | 解释器主循环，`d[7]&31` 解码 opcode |
| 3 | 大文件（500KB+）但**零字节占比 < 1%** | 非标准 WASM，纯 JS |
| 4 | 含 `C[number]` 常量表引用 | `C[9][xxx]` 函数表 / 字符串表 |
| 5 | 单行压缩代码 | 583KB 单行，混淆变量名 |

### 排除规则
| 条件 | 转至 |
|---|---|
| 文件以 `\x00asm` 开头 | 标准 WASM 二进制 → IDA/Ghidra |
| 含 `Uint8Array([0,97,115,109])` 魔术字 | 提取 `.wasm` 后转二进制工具 |
| 标准 webpack 打包（`function(e,t,n){...}`） | `references/bundle/overview.md` |
| 零字节占比 > 20% | WASM 二进制 → 二进制工具 |

---

## 2. Opcode 编码格式

每条指令编码为 32 位整数：
```
bit 0-4:   opcode (0-N)
bit 5-9:   sub-operation (0-31)
bit 10-31: operand / 立即数

解码:
  aE = d[7] & 31        → opcode
  O  = d[7] >> 5 & 31   → sub-operation
  d[other] = d[7] >> 10 → operand
```

---

## 3. 逆向工作流

### Phase 1 · 文件分类（5 分钟）
检查 WASM 魔术字 + 零字节占比 + 是否 `!function(){var U=void 0...}` 单字母模式。

### Phase 2 · 变量映射表提取（10 分钟）
正则提取开头 `var X=数字` 的常量映射（数字常量被映射成变量名，替代原始数字）。

### Phase 3 · Opcode 提取与分类（15 分钟）
- 正则提取所有 `case N:` → 统计唯一 opcode
- 按 snippet 特征分类：`BRANCH`（`d[7]=xxx`）/ `RETURN` / `CALL`（`W(C[`）/ `ALLOC`（`new`）/ `EXCEPTION`（`try/catch`）/ 其余 `ARITH/STORE`

### Phase 4 · 常量表分析（30 分钟）
统计 `C[9][n]` 引用范围与上下文（函数索引 / 字符串常量）。

### Phase 5 · 导出函数追踪（1-2 小时）
```
1. 找 register() 或类似注册调用
2. 确定注册的模块和工厂函数
3. 找工厂函数返回的对象 → 导出函数定义位置
4. 若函数名不在 JS 中 → 在常量表中作字节码存储
5. 追调用链：xxx.getToken() → W(C[函数索引],null,...) → DG() 解释器执行编码指令
```

### Phase 6 · 运行时注入（纯静态不够时）
注入最小兼容环境（伪造 register/模块表），执行 VM 代码后取出导出函数。

---

## 4. 参考 opcode 对照表（基于已有案例）

| Opcode | 类型 | 特征 |
|---|---|---|
| 0 | BRANCH | `d[7]=xxx` 无条件跳转 |
| 1 | CALL | `W(C[Y],null,function(){...})` |
| 2/3/5 | ARITH | 赋值 / 比较 / 算术 |
| 4/12/21 | STORE | 属性访问 / 数据传递 / 安全取值 |
| 6/15 | RETURN | `return` / `throw` |
| 7/10/16/17 | ALLOC | 数组 / 调用栈 / 局部变量 / 静态数组 |
| 8/23 | BRANCH | 条件跳转 |
| 9/11/14/22 | STRING | 字符串 / 正则 |
| 13/24 | CALL | 模块初始化 / 多参数调用 |
| 18 | TABLE | 函数表 / 类型表初始化 |
| 19/25 | EXCEPTION | try-catch |
| 20 | DOM | DOM 操作 |

---

## 5. 运行时捕获方案

| 方案 | 说明 | 成功率 |
|---|---|---|
| **A. Selenium + CDP 原生事件** | 注入反检测 + 用 CDP 原生鼠标事件（`Input.dispatchMouseEvent`）绕过 JS 层检测 | **最高（推荐）** |
| **B. Playwright** | 拦截路由 + `waitForFunction` 等 VM 初始化后操作 | 中 |
| **C. 纯协议验证** | 脱离浏览器重放 | **极低**——token 常与浏览器上下文强绑定（TLS JA3 / IP / Cookie / 请求头），服务端可检测 |

> **结论：不要走纯协议方案**，优先 CDP 原生事件。

---

## 6. 常见状态码（风控引擎示例）

| Code | 含义 | 处理 |
|---|---|---|
| 0 | 验证通过 | 取出 sessionId + sig |
| 300 | 风控拦截 | 无法通过 |
| 8778 / 8776 | 验证失败 / 太快，需重试 | 重试（后者加延迟） |
| 69634 | 通用失败 | 检查参数 |

---

## 7. 自检清单

- [ ] 是否完成 JSVMP 识别（IIFE + 单字母变量 + 解释器主循环）？
- [ ] 是否提取了变量映射表？
- [ ] 是否提取并分类了 opcode？
- [ ] 是否分析了常量表引用范围？
- [ ] 是否定位了导出函数注册点？
- [ ] 纯静态不够时，是否尝试了运行时注入？
