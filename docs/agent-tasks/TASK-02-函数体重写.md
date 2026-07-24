# TASK-02 — 节点函数体重写（5 个）

> 🚫 **禁止直接修改 src/App.js！只在本文件列出的 AB0X.md 代码块中提交。**

## 你的输出文件
- **docs/annotate-body-tasks/AB02.md** — 填入 1 个代码块: CropNodeComp
- **docs/annotate-body-tasks/AB04.md** — 填入 1 个代码块: CustomNodeComp
- **docs/annotate-body-tasks/AB07.md** — 填入 3 个代码块: TextConcatNodeComp, UrlToImageNodeComp, FileToUrlNodeComp

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

## 输出文件: docs/annotate-body-tasks/AB02.md

### 1. CropNodeComp（图片裁剪节点 — 拖拽选区裁剪图片并输出）

- **位置**: App.js L4077，`function CropNodeComp`
- **运行**: `node scripts/summarize.cjs CropNodeComp` 查看原函数
- **参数**: `e`→`id`, `t`→`data`, `n`→`selected`

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `r` | `crop` |
| `i` | `setCrop` |
| `a` | `croppedPixels` |
| `o` | `setCroppedPixels` |
| `s` | `imgRef` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| cropNode | CropNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

## 输出文件: docs/annotate-body-tasks/AB04.md

### 2. CustomNodeComp（万能节点 — 自定义 API 调用（编辑/工作双模式、AI 辅助配置、变量提取、同步/异步执行））

- **位置**: App.js L11708，`CustomNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs CustomNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `r` | `updateNodeData` |
| `i` | `nodeData` |
| `a` | `configMode` |
| `o` | `setConfigMode` |
| `s` | `variables` |
| `c` | `setVariables` |
| `l` | `extractedVars` |
| `u` | `setExtractedVars` |
| `d` | `config` |
| `f` | `setConfig` |
| `p` | `aiPrompt` |
| `m` | `setAiPrompt` |
| `h` | `aiLoading` |
| `g` | `setAiLoading` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| customNode | CustomNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

## 输出文件: docs/annotate-body-tasks/AB07.md

### 3. TextConcatNodeComp（文本拼接节点 — 多输入文本按分隔符拼接）

- **位置**: App.js L16563，`TextConcatNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs TextConcatNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `i` | `updateNodeData` |
| `a` | `setEdges` |
| `o` | `separator` |
| `s` | `setSeparator` |
| `c` | `prefix` |
| `l` | `setPrefix` |
| `u` | `suffix` |
| `d` | `setSuffix` |
| `f` | `text` |
| `p` | `setText` |
| `m` | `targetHandles` |
| `h` | `sourceNodes` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| textConcatNode | TextConcatNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 4. UrlToImageNodeComp（URL 转图片节点 — 输入 URL 下载并展示图片）

- **位置**: App.js L16984，`UrlToImageNodeComp = Y.memo`
- **运行**: `node scripts/summarize.cjs UrlToImageNodeComp` 查看原函数

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `i` | `updateNodeData` |
| `a` | `setNodes` |
| `o` | `setEdges` |
| `s` | `getNode` |
| `c` | `inputUrl` |
| `l` | `setInputUrl` |
| `u` | `text` |
| `d` | `setText` |
| `f` | `status` |
| `p` | `setStatus` |
| `m` | `blob` |
| `h` | `setBlob` |
| `g` | `resultUrl` |
| `_` | `setResultUrl` |
| `v` | `targetEdges` |
| `y` | `sourceInfo` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| urlToImageNode | UrlToImageNodeComp |
\`\`\`js
// ── 状态 ──
// 在这里填重写后的函数体...
\`\`\`
|
```

---

### 5. FileToUrlNodeComp（文件转链接节点 — 将上游媒体文件转为可下载链接）

- **位置**: App.js L17164，`function FileToUrlNodeComp`
- **运行**: `node scripts/summarize.cjs FileToUrlNodeComp` 查看原函数
- **参数**: `e`→`id`, `n`→`data`, `r`→`selected`

#### 变量映射表（照这个改）

| 原名 | 改成 |
|------|------|
| `i` | `upstreamNodes` |
| `a` | `cloudStorageConfig` |
| `o` | `showToast` |
| `s` | `message` |
| `c` | `errorMsg` |
| `l` | `resultUrl` |
| `u` | `mediaType` |
| `d` | `mediaUrl` |

> 只改映射表里的变量。映射表没列出的不用动。如果函数体内有同名字面量（如 JSX 中的 `"data"`），不碰。

#### 代码块

```
| fileToUrlNode | FileToUrlNodeComp |
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
