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
