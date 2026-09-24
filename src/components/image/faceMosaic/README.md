# image/faceMosaic · 人像打码能力片

> **一个能力片 = 节点态 + 编辑器态 + 算法，同居一处**（对齐 `video/depthVideo/` 范式）。

## 为什么是目录而不是散在三处（2026-09-25 重组）

重组前，同一个"人像打码"能力被**按形态拆到 3 个目录**：

| 重组前 | 重组后 |
|---|---|
| `image/nodes/FaceMosaicNode.tsx` | `faceMosaic/FaceMosaicNode.tsx` |
| `image/editors/FaceMosaicEditor.tsx` | `faceMosaic/FaceMosaicEditor.tsx` |
| `image/lib/faceMosaic.ts`（算法）| `faceMosaic/faceMosaic.ts` |

**问题**：节点与它的编辑器互为**唯一配对**（`FaceMosaicNode` 是 `FaceMosaicEditor` 的唯一消费者），
却被拆到 `nodes/` 与 `editors/` 两个**按形态命名**的目录，靠 `../editors` 跨目录引用。

**判据**（`ADR-0042` D6）：**深构对象是「域内一个个能力」，不是按"节点/编辑器"这种「形态」切。**
⇒ 「人像打码」是一个能力 ⇒ 该聚成一处。

**范本**：`video/depthVideo/`（`DepthVideoModal` + `engine` + `loader` + `spawn` + `depthUrls` 同居）。

## 本目录**不建** `index.ts` 门面（有意的）

按 `ADR-0044` §9 ②：「**门面不是必需的** —— 无用例可承载 ⇒ 消费者**直连能力片**」。

- 本能力片的唯一域外消费者是 `canvas/shell/NodePalette.ts`（节点注册表）；
- 它要的是**具体符号**（`FaceMosaicNode` 组件），不是"做某件事"的用例 ⇒ **无具名用例可承载**；
- ⇒ 直连 `faceMosaic/FaceMosaicNode.tsx`，**不建转发门面**。

> ⚠️ **后来者勿"补门面"**：`ADR-0039` N5「域目录必须有 index.ts」**已作废**（`ADR-0044` §9）。
> 强制补门面只会新增纯转发层 —— 本仓 5 处纯中转门面就是这么来的（`ADR-0044` §3-b 的实测翻车）。
> **要建门面的判据是「有具名用例可承载」，不是「目录里有没有 index.ts」。**

## 内部依赖方向

```
FaceMosaicNode.tsx ──import──▶ FaceMosaicEditor.tsx   （节点开编辑器）
        │                              │
        └──────────┬───────────────────┘
                   ▼
             faceMosaic.ts   （算法：detectFaces / applyMosaic / 模式常量）
```

- 三者**同目录**，故内部 import 一律 `./`（不用 `@/` 别名，也不用跨目录 `../`）。
- `faceMosaic.ts` 的**唯一真源注释**原本写着"模型落在本机模型宿主 `runtime-models/mediapipe/`" —— 仍成立。

## 相关

- 重组决策与凭证：`docs/plan/148-AI抠图接入-照抄深度视频形态-2026-09-24.md` §十一
- 落点判据：`ADR-0042` D6（粒度＝能力片）· `ADR-0044` §2（D2 子域门槛）/ §8（门面按用例）· `ADR-0040`（归属看界面位置与数据落点）
- 待重审的同类件：`image/editors/PanoViewer.tsx`（宿主 `PanoramaNode`）· `image/editors/OverlayEditor.tsx`（宿主 `GridMergeNode`）
