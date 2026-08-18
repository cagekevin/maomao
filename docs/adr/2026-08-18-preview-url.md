# ADR-001 · 本地预览 URL 生命周期收口（previewUrl）

**日期**：2026-08-18
**状态**：已采纳
**来源**：架构5步法 · State 1-5（候选 1）

## 背景

`URL.createObjectURL` 散落各节点（TextNode / FaceMosaic / VideoExtract / VideoProcess / AgentPanel 等 ≥10 处），多数只 create 不 revoke（配对率约 40%），长期运行内存泄漏。

## 决策

新建 `src/components/base/previewUrl.js` 作为「本地预览 URL 生命周期」唯一入口：

- `createPreviewUrlManager(urlFactory = globalThis.URL)` → manager（纯类，可注入 fake URL 测试）
- `manager.create(blob)` → url|null（空安全；每次生成独立 url）
- `manager.release(url)` → void（引用减 1，减到 0 才真正 `revokeObjectURL`；已归零再 release 幂等不抛）
- `manager.clear()` → void（卸载兜底，一次清空）
- `manager.activeCount()` → number（调试/测试）
- 模块级默认导出 `previewUrls` 单例

## 依赖分类

**In-process**（纯浏览器内存态，无跨网络 I/O）。唯一外部依赖为全局 `URL`，经构造参数注入 fake 测试替身，**无需 Adapter**（单 Adapter 封装 = 假 Seam，已否决）。

## 收敛边界（明确不做，防过度收口）

| 场景 | 归属 | 理由 |
|------|------|------|
| 节点/面板**预览** Blob | `previewUrl` | 组件生命周期内展示 |
| **下载**（clipboard `downloadUrl/downloadBlob`） | `clipboard` | 一次性，已自带 revoke |
| **持久化降级**（`videoEngine.uploadResult` 临时 url） | `videoEngine` | 刷新失效为已知降级 |
| **跨节点产物**（`VideoProcessNode` GIF → spawn 节点源） | 保持原样 | 持久节点数据语义，非组件预览 |
| 外部仓库 `director3d` 3 处 | 保持原样 | 非本仓库代码 |

## 测试

`tests/unit/previewUrl.test.js`（9 用例）：create 空安全 / 独立 url / release 归零 revoke / 幂等 / clear 全量回收 / activeCount / 构造注入 fake URL。基于新 Interface 编写，未保留旧测试。

## 备选方案（未采纳）

- **方案 B（Hook 封装）**：只服务 React 组件，无法覆盖非组件纯函数场景（videoEngine），会逼出双接口，违背单一入口。
- **方案 C（WeakMap 同 blob 去重）**：blob 复用场景实际极少，为极低频引入复杂度和 dispose 闭包，Leverage 增益不成比例。
