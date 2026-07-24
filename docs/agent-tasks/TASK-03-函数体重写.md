# TASK-03 — 节点函数体重写（3 个）

> 🚫 **禁止直接修改 src/App.js！只在本文件列出的 AB0X.md 代码块中提交。**

## 你的输出文件
- **docs/annotate-body-tasks/AB09.md** — 填入 3 个代码块: GroupNodeComp, Nh, StickyNoteNodeComp

## ⚠️ 铁律（违反算失败）
1. 🚫 只填代码块，不碰 App.js
2. 🚫 不写脚本
3. 🚫 不改逻辑和 JSX，只改局部变量名 + 加段落注释
4. ✅ 先跑 `node scripts/summarize.cjs <组件名>` 看原函数摘要再动手

## 提交格式
每个函数一块：
```
| 节点类型 | 组件变量名 |
```js
// ── 状态 ──
const [loading, setLoading] = Y.useState(false);
// ... 重写后的完整函数体（不含外层 function / Y.memo 签名）
```
|
```

---

## 输出文件: docs/annotate-body-tasks/AB09.md

### 1. GroupNodeComp（编组节点 — 可折叠容器、双击重命名、拖入子节点）

- **位置**: App.js L26324，`function GroupNodeComp`
- **运行**: `node scripts/summarize.cjs GroupNodeComp` 查看原函数
- **参数**: `e`→`id`, `t`→`data`, `n`→`selected`

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `r` | `updateNodeData` |
| `i` | `setNodes` |
| `a` | `editing` |
| `o` | `setEditing` |
| `s` | `name` |
| `c` | `setName` |
| `l` | `inputRef` |
| `u` | `collapsed` |
| `d` | `onNameChange` |
| `f` | `onNameCommit` |
| `p` | `onNameKeyDown` |
| `m` | `onToggleCollapse` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| group | GroupNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 2. Nh（幽灵目标节点 — 透明占位 handle 用于连线路由）

- **位置**: App.js L26771，`function Nh`
- **运行**: `node scripts/summarize.cjs Nh` 查看原函数

#### 变量映射表（照这个改）

无局部变量，只有 return JSX。直接加段落注释即可。

#### 代码块

```
| ghostTarget | Nh |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 3. StickyNoteNodeComp（便利贴节点 — 富文本编辑、字号/颜色/背景、表情插入、拖拽缩放）

- **位置**: App.js L27558，`function StickyNoteNodeComp`
- **运行**: `node scripts/summarize.cjs StickyNoteNodeComp` 查看原函数
- **参数**: `e`→`id`, `t`→`data`

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `r` | `updateNodeData` |
| `i` | `html` |
| `a` | `setHtml` |
| `o` | `fontSize` |
| `s` | `setFontSize` |
| `c` | `bold` |
| `l` | `setBold` |
| `u` | `color` |
| `d` | `setColor` |
| `f` | `bgColor` |
| `p` | `setBgColor` |
| `m` | `width` |
| `h` | `setWidth` |
| `g` | `height` |
| `_` | `setHeight` |
| `v` | `isEditing` |
| `y` | `setIsEditing` |
| `b` | `menuPos` |
| `x` | `setMenuPos` |
| `S` | `showEmoji` |
| `C` | `setShowEmoji` |
| `w` | `showBg` |
| `T` | `setShowBg` |
| `E` | `editorRef` |
| `D` | `resizeRef` |
| `O` | `commitData` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| stickyNoteNode | StickyNoteNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

## 验收自查

改完每个函数后跑一下：
```bash
npm run build 2>&1 | grep -E "(error|✓ built)"
```
必须看到 `✓ built`。如果报错说明变量改漏或改错了。
