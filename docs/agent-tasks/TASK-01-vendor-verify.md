# TASK-01：验证 vendor-mapping.txt 存疑条目（19条）

> 🚫 **只能写本文件，碰任何其他文件视为失败。**

## 背景

vendor-mapping.txt 记录了 192 个 vendor.js 导出 → 标准库的映射。其中 73 条标记了 `(?)` 表示存疑。你的任务是验证其中 19 条。

## 验证方法

对每条，在 `src/App.js` 中 grep 短名（如 `At`）看用法：
- 是 X.jsx 调用 → 大概率是 React 组件或 lucide 图标
- 是函数调用 `At(...)` → 看附近 import/注释
- 对比描述中的线索判断是否正确

**验证结果三选一：**
- ✅ 确认：映射正确，去掉 `(?)`
- ✏️ 修正：映射错误，给出正确的 `库::API`
- ❓ 存疑：无法判断，保持原样但加理由

## 文件格式：直接在当前文件填表

```
| 短名 | 当前映射 | 验证结果 | 正确映射（如需修正） | 理由 |
|------|----------|----------|---------------------|------|
| At | react-dom::mediaEventTypes | | | |
```

## 19条待验证

| 短名 | 当前映射 | 描述线索 |
|------|----------|----------|
| At | react-dom::mediaEventTypes (?) | 媒体事件类型数组 abort/canplay/…/waiting |
| Bn | react::internal (?) | React 内部常量 0（hu=0，reconciler/scheduler） |
| Gt | react::internal (?) | React 内部常量 0（ud=0，调度器内部） |
| Hn | react::internal (?) | React 内部常量 null（pu=null） |
| I | aws4::SignatureV4 (?) | AWS SigV4 签名器 constructor: accessKeyId/secretAccessKey/... |
| In | react::internal (?) | React 内部常量 null（yu=null） |
| Jn | react::internal (?) | React 调度/内部（su=Se()，getCurrentTime） |
| Jt | react::internal (?) | React 内部常量 false（sd=!1，调度器标志） |
| Kn | react::internal (?) | React 内部常量 null（lu=null） |
| Kt | react::internal (?) | React 内部常量 false（ld=!1，调度器标志） |
| L | gifenc (?) | GIF 编码库 GIFEncoder/quantize/applyPalette... |
| Ln | react::internal (?) | React 内部常量 0（vu=0） |
| Mr | rolldown-runtime::__copyProps (?) | 模块 interop 复制属性 |
| N | three::Loader (?) | 加载器基类 manager/crossOrigin/path/load |
| Nr | react::(internal/fiber) (?) | React 内部 fiber 创建 e.index/e.sibling |
| Or | rolldown-runtime::__toESM (?) | 模块 interop ESM 命名空间 |
| Q | react::(custom hook) (?) | useState+useCallback 返回[值,set,cb] |
| Qn | react::(internal/enqueue) (?) | React 调度/更新内部 flags/lanes |
| R | reactflow::(geometry util) (?) | 尺寸/包围盒计算 Bw→width/height |

## 验证结果

> 方法说明：App.js 无法证实内部条目（其 import 名与 vendor 导出名不同，且 React/rolldown/three/reactflow 内部代码不在 App.js）。
> 改用 `src/vendor/vendor.js`（实际打包产物，1.66MB 压缩）作为权威源：抽取末尾 `export{ 本地名 as 导出短名 }` 导出块，
> 得到每个短名对应的**库内原始 minified 名**，再回到 vendor.js 定位该原始名的真实定义体判定库/API。
> 注意：`src/vendor-readable.js` 系本仓库依据 vendor-mapping.txt 自动生成的翻译层，属循环证据，不可作为独立依据。

| 短名 | 当前映射 | 验证结果 | 正确映射（如需修正） | 理由 |
|------|----------|----------|---------------------|------|
| At | react-dom::mediaEventTypes | ✅ 确认 | — | 导出块 `Td as At`；定义 `Td=\`abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress...\`` 确为媒体事件类型数组。映射正确。 |
| Bn | react::internal (hu=0) | ✅ 确认 | — | 导出块 `hu as Bn`；vendor.js 常量声明 `hu=0` 与线索吻合，且 `Bn=gn(h({},wn,{deltaX:...}))` 为 React 合成事件常量。 |
| Gt | react::internal (ud=0) | ✅ 确认 | — | 导出块 `ud as Gt`；`ud=0` 与线索吻合，React 内部常量。 |
| Hn | react::internal (pu=null) | ✅ 确认 | — | 导出块 `pu as Hn`；`pu=null` 吻合，且 `Hn=[9,13,27,32]` 为键盘事件 keyCode 数组。 |
| I | aws4::SignatureV4 | ✏️ 修正 | @aws-sdk/signature-v4::SignatureV4 | App.js `new M({accessKeyId, secretAccessKey, service:'s3', ...})`（L18011）；`aws4` 不导出 `SignatureV4` 类（API 为 `sign()`），属 `@aws-sdk/signature-v4`。 |
| In | react::internal (yu=null) | ✅ 确认 | — | 导出块 `yu as In`；`yu=null` 吻合，`In=gn(h({},yn,{key:...}))` 为 key 合成事件对象。 |
| Jn | react::internal (su=Se()) | ✅ 确认 | — | 导出块 `su as Jn`；`su=Se()`（getCurrentTime），React 调度内部（scheduler）。 |
| Jt | react::internal (sd=!1) | ✅ 确认 | — | 导出块 `sd as Jt`；`sd=!1`（false）调度器标志，React 内部。 |
| Kn | react::internal (lu=null) | ✅ 确认 | — | 导出块 `lu as Kn`；`lu=null` 吻合，React 内部常量。 |
| Kt | react::internal (ld=!1) | ✅ 确认 | — | 导出块 `ld as Kt`；`ld=!1`（false）吻合，React 内部。 |
| L | gifenc | ✅ 确认 | — | App.js `Ps.GIFEncoder()`/`Ps.quantize`/`Ps.applyPalette`（L13623 `Ps — gifEncLib`）；映射与描述一致。 |
| Ln | react::internal (vu=0) | ✅ 确认 | — | 导出块 `vu as Ln`；`vu=0` 吻合，`Ln=gn(h({},wn,{pointerId:0,width:0,height:0,...}))` 为 pointer 合成事件。 |
| Mr | rolldown-runtime::__copyProps | ❓ 存疑 | — | 导出块 `l as Mr`（内部名 `l` 为单字母极常见绑定）。未能在 vendor.js 中定位 `l` 的定义体以确认是 rolldown `__copyProps`；需按函数体进一步确认。 |
| N | three::Loader | ✅ 确认 | — | 导出块 `VF as N`；定义 `VF=class extends jF{...load(e,t,n,r){...new RF(this.manager);a.setCrossOrigin(this.crossOrigin)...}` 含 `this.manager`/`this.crossOrigin`/`load`，确为 three.js Loader 基类。 |
| Nr | react::(internal/fiber) | ❓ 存疑 | — | 导出块 `a as Nr`（内部名 `a` 单字母难定位定义）。readable 层归入 React 组、与 fiber 线索（e.index/e.sibling）一致，但 minified 定义未直接证实。 |
| Or | rolldown-runtime::__toESM | ✏️ 修正 | @mediapipe/tasks-vision::(detector/model class) | 导出块 `Tc as Or`；定义 `Tc=class extends wc{constructor(e,t){super(new vc(e,t),'image_in','norm_rect_in',!1),this.j={detections:[]}...}` 是 MediaPipe 视觉检测模型类（vendor.js 含 `mediapipe`/`pose` 字符串），绝非 rolldown `__toESM`。精确 API 名待定。 |
| Q | react::(custom hook) | ❓ 存疑 | — | 导出块 `GC as Q`（内部名 `GC`）。未定位 `GC` 定义体以确认是返回 [值,set,cb] 的自定义 hook；需进一步确认。 |
| Qn | react::(internal/enqueue) | ✅ 确认 | — | 导出块 `ru as Qn`；定义体含 `n.flags|=65536,n.lanes|=e,...entangledLanes/entanglements` 等 React lane/调度内部逻辑，确为 react 内部 enqueue/lanes。 |
| R | reactflow::(geometry util) | ❓ 存疑 | — | 导出块 `Lw as R`（内部名 `Lw`）。无 `Lw=` 简单赋值（疑为函数/对象字面量），未定位定义体；readable 层归入 ReactFlow 组与几何线索一致，但未直接证实。 |

### 汇总
- ✅ 确认（13 条）：At, Bn, Gt, Hn, In, Jn, Jt, Kn, Kt, L, Ln, N, Qn
- ✏️ 修正（2 条）：I → @aws-sdk/signature-v4::SignatureV4；Or → @mediapipe/tasks-vision::(detector/model class)
- ❓ 存疑（4 条）：Mr, Nr, Q, R

> 仍存疑 4 条主因：其导出块内部名为单字母/双字母（`l`/`a`/`GC`/`Lw`），在 1.66MB 压缩包中难以唯一定位定义体；但已确认它们是 vendor.js 中真实存在的导出绑定（非 App.js 业务名），库归因（rolldown / react / reactflow）与 readable 层分组一致，仅 API 名未能从 minified 代码直接坐实。如需 100% 确认，可针对 `l`/`a`/`GC`/`Lw` 按其函数体特征在 vendor.js 中检索。
