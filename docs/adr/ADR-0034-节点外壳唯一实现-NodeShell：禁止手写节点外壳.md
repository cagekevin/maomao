# ADR-0034 · 节点外壳唯一实现 NodeShell：禁止手写节点外壳

- **状态**：生效
- **结论**：节点 UI 外壳统一走 NodeShell（选中态/边框/端口/工具栏同址）；UI 用 useState(data.xxx)、写回用 setNodes 不可变更新、上游数据走 useConnectedInputs。禁止手写外壳。
- **日期**：2026-09-19
- **裁定人**：架构师（归位取证；规则原文见 `spec/CONTEXT.md:103`）
- **触发**：TD-18-20 —— 该判决句长期只存在于 CONTEXT，`adr.mjs search` **0 命中**（违反 ADR-0025 判据 1）
- **与 ADR-0009 的边界（2026-09-20 补）**：本条管「**UI 编辑写回**」（`setNodes` 不可变更新）；**生成结果回填**的唯一路径是 **ADR-0009** 的声明式 `resultKey`，不走本条。

## 背景

「外壳用 `NodeShell`（禁止手写外壳）」此前只写在 `spec/CONTEXT.md:103`。没有 ADR ⇒ 没有违反判据、
没有检索入口；新人只能靠"看到别人都这么写"来继承。

**这条规则其实已被 100% 执行**（2026-09-19 取证）：

- `src/components/nodes/` 下 **17 个 `.tsx`**，其中 **16 个** import `NodeShell`；
- 未引用的 2 个是 `GhostTargetNode.tsx`（拖拽落点的**幽灵靶标**，不是节点 UI）与
  `useImageHoverActions.tsx`（**hook 文件**，不是节点）⇒ **真实节点组件全覆盖**；
- 样式亦已同址：`src/index.css:238`「只保留 NodeShell 的灰色 border-edge-strong 边框，与其它节点一致」；
- 写回约束同址：`src/App.tsx:760`「P0-B 红线：`setNodes` 不可变更新（见 `NodeShell.tsx` 头注释），禁止原地 mutation」。

⇒ 本条是**把既成事实写成判据**，不是新立规矩；目的是让它**可被引用、可被发现违反**。

## 判据（它凭什么成立）

1. **外壳是 N 份同质复杂度**：选中高亮、边框、端口挂载点、悬浮工具栏、展开面板——每个节点都要，
   手写 ⇒ 17 个节点 17 份实现，**任一视觉/交互约定变更都要改 17 处**（本仓单一规则原则的直接实例）。
2. **端口定位基准易错且错得隐蔽**：`ScriptBoxNode.tsx:140-143` 实证 —— 输入端口经 `NodeShell` 的
   `overlayHandles` 插槽挂在**整个节点**上（定位基准含标题栏）；手写外壳极易把基准算错，
   表现为"端口位置差几像素"这类**看不出根因**的缺陷。
3. **唯一实现已存在并被验证**：`base/ui/NodeShell.tsx`，且已覆盖全部真实节点 ⇒ 收敛成本≈0。

## 决议

1. **唯一实现**：`src/components/base/ui/NodeShell.tsx`。新建节点一律用它，禁止手写 wrapper 外壳。
2. **配套三条同址约束**（与外壳同属「节点统一范式」）：
   - UI 状态：`useState(data.xxx)`；
   - 写回：`setNodes` **不可变更新**（禁止原地 mutation）；
   - 上游数据：`useConnectedInputs`（禁止各节点旁路取上游）。
3. **CONTEXT 只留一行指针**（不抄判据正文）—— 见 ADR-0025。

## 后果

- ✅ 判据有了主场与检索入口；违反时可被下面的 grep 判据发现。
- ✅ 存量**零违反**（真实节点 16/16 已遵守）⇒ 本条是"立判据"而非"改代码"，**零行为变化**。
- ⚠️ **回潮风险**：新节点从"最像的那个旧节点"复制 ⇒ 若那个旧节点某天绕过 `NodeShell`，
  复制链会一次性扩散。防线是下面的判据 1（新增节点组件必须命中 `NodeShell`）。
- ⚠️ **边界（例外）**：`GhostTargetNode`（幽灵靶标）与纯 hook 文件**不适用**本条 —— 它们没有节点外壳语义。

📌 **违反时的判据（怎么发现"又回去了"）**：

1. `src/components/nodes/**` 出现**未** import `NodeShell` 的**节点组件**（`GhostTargetNode` 与 hook 文件除外）；
2. 节点组件里出现自建的 `border / shadow / rounded` 外壳容器 —— 反例见 `VideoGenerate.tsx:326` 的注释
   「背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为」；
3. 节点内出现原地 mutation 式写回（如 `n.data.x = v` 后同引用返回）；
4. 节点绕过 `useConnectedInputs` 自行取上游数据。

- ⚠️ **诚实边界（2026-09-21 实测）**：上列 **只有一部分有机器防线** ——
  `scripts/check-node-handles.mjs` 守「`showHandles={false}` 时禁止裸写 `<CustomHandle>`」（即**端口渲染**必须走 NodeShell 标准路径），
  负例会红；**判据 1（未 import NodeShell）、2（自建边框/阴影容器）、3（原地 mutation）、4（绕过 useConnectedInputs）均无闸**。
  ⇒ **本条未毕业、不许整体判毕业**（`ADR-0052` 第 6 级：不能机器判定的部分必须写明"不能"，不许硬凑 grep）。
- **毕业的门槛**：`check-node-handles.mjs` 覆盖到"外壳容器 / 写回方式"为止；在此之前本条**占编号但不毕业**。
