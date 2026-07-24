# TASK-01 — 节点函数体重写（3 个）

> 🚫 **禁止直接修改 src/App.js！只在本文件列出的 AB0X.md 代码块中提交。**

## 你的输出文件
- **docs/annotate-body-tasks/AB01.md** — 填入 3 个代码块: ImageNodeComp, PromptNodeComp, TextNodeComp

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

## 输出文件: docs/annotate-body-tasks/AB01.md

### 1. ImageNodeComp（图片展示节点 — 支持图片/视频/音频预览、缩放、右键菜单）

- **位置**: App.js L1287，`ImageNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs ImageNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `i` | `updateNodeData` |
| `a` | `imgRef` |
| `o` | `isHovering` |
| `s` | `setIsHovering` |
| `c` | `useThumbnail` |
| `l` | `imageUrl` |
| `u` | `imageUrlRef` |
| `d` | `thumbnailUrl` |
| `f` | `imageAvailable` |
| `p` | `scaledWidth` |
| `m` | `mediaType` |
| `h` | `displayUrl` |
| `g` | `thumbUrl` |
| `_` | `fileBaseName` |
| `v` | `urlTrackingRef` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| imageNode | ImageNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 2. PromptNodeComp（文生图/图生图/视频生成节点 — 提示词输入、模型选择、参数配置、生成调度）

- **位置**: App.js L2088，`PromptNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs PromptNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `a` | `updateNodeData` |
| `o` | `setEdges` |
| `s` | `setNodes` |
| `c` | `getNode` |
| `l` | `promptInputRef` |
| `u` | `prompt` |
| `d` | `setPrompt` |
| `f` | `aspectRatio` |
| `p` | `setAspectRatio` |
| `m` | `imageSize` |
| `h` | `setImageSize` |
| `g` | `selectedModel` |
| `_` | `setSelectedModel` |
| `v` | `drawingModel` |
| `y` | `setDrawingModel` |
| `b` | `selectedContextResources` |
| `x` | `setSelectedContextResources` |
| `S` | `isGenerating` |
| `C` | `setIsGenerating` |
| `w` | `showImage` |
| `T` | `setShowImage` |
| `E` | `showVideo` |
| `D` | `setShowVideo` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| promptNode | PromptNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 3. TextNodeComp（文生文节点 — 文本输入、模型选择、自动拆分、生成调度）

- **位置**: App.js L3420，`TextNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs TextNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `i` | `updateNodeData` |
| `a` | `setEdges` |
| `o` | `prompt` |
| `s` | `setPrompt` |
| `c` | `text` |
| `l` | `setText` |
| `u` | `autoSplit` |
| `d` | `setAutoSplit` |
| `f` | `expanded` |
| `p` | `setExpanded` |
| `m` | `isGenerating` |
| `h` | `setIsGenerating` |
| `g` | `showImage` |
| `_` | `setShowImage` |
| `v` | `showVideo` |
| `y` | `setShowVideo` |
| `b` | `selectedContextResources` |
| `x` | `setSelectedContextResources` |
| `S` | `presetPrompts` |
| `C` | `selectedModel` |
| `w` | `setSelectedModel` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| textNode | TextNodeComp |
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
