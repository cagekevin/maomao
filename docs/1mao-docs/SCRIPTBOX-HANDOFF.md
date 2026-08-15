# 剧本盒子（scriptBoxNode）接入 HANDOFF

> 工程：`prototypes/react-nodes`（React + ReactFlow v11 + Vite + Tailwind 独立原型）
> 背景：复刻官方「剧本盒子」节点，严格按 `docs/剧本盒子/` 目录下的职责划分/契约文档实现。
> 状态：UI 三步全部可用（假引擎驱动），三道门（smoke/regression/build）全绿。

---

## 1. 职责铁律（违反任何一条都是错的）

详见 `docs/剧本盒子/剧本盒子职责划分.md`。核心：

1. **数据只存 `node.data`**。UI 绝不 `useState` 缓存 `shots/assets/story/globalStyle` 等数据。
2. **UI 编辑 → `updateData(patch)`**（内部用 ReactFlow `setNodes` 不可变写回）。
3. **UI 触发生成/连线 → 只调 `callbacks.onXxx?.(...)`**，UI 不做计算。
4. **引擎层**不依赖 UI，经 `getData()/updateData` 与节点交互。
5. **纯函数层**（`scriptBoxPrompts.js`）无副作用、无 React。
6. **依赖单向**：`UI → 引擎 → 纯函数`。
7. **参考图是下游的事**：剧本盒子只给 `@资产名` 软连接，下游 promptNode/discountVideoNode 负责。

---

## 2. 文件清单与职责

### 新增（剧本盒子）
| 文件 | 层 | 职责 |
|------|----|------|
| `src/components/base/scriptBoxPrompts.js` | 纯函数层 | `ZgPrompt`、`buildShotPrompts`、`buildShots`、`buildAssets`、`dialogueText`、`hlAt`（@高亮）、默认模板 `ASSET_TEMPLATES`/`SCRIPT_WRITER_SYSTEM`/`SHOT_DIRECTOR_SYSTEM`、候选下拉 `SHOT_TYPES/LIGHTS/SOUNDS/MOTIONS` |
| `src/components/base/useScriptBoxData.js` | 数据层 | `updateData(patch)`：用 `useReactFlow().setNodes` 不可变写回 `node.data` |
| `src/components/base/scriptBoxEngine.js` | 引擎层 | `createScriptBoxEngine({getData, updateData, addNodes})` → 9 个 `onXxx` 回调（假实现；接真引擎只改函数体） |
| `src/components/ScriptBoxNode.jsx` | UI 主组件 | 顶部标题栏 + 三步圆环导航 + 组装三步 + 引擎兜底注入 + 生成遮罩计时 + 全屏弹层 |
| `src/components/scriptbox/StepShots.jsx` | 步骤1 | 左栏（风格/剧情/镜头数/生成）+ 分镜表格（8 列、双击弹窗、对白编辑器、@高亮、增删、下拉） |
| `src/components/scriptbox/StepAssets.jsx` | 步骤2 | 三栏资产 + 资产卡（选中框/视频上传状态/more菜单）+ 工具栏（风格/模型/上传全部/批量生图带选中数）+ 抽屉 + 双击提示词面板 + 改名联动 |
| `src/components/scriptbox/StepPrompt.jsx` | 步骤3 | 列表/单镜头双视图 + 卡片（生图/生视频 prompt 双击编辑 + 宫格选择 + 生成）+ 批量连线 |
| `src/components/scriptbox/GearSettings.jsx` | 设置弹窗 | 画面比例 / 三全局约束 / 剧本提示词 / 分镜提示词 / 三资产参考图模板 |

### 修改
| 文件 | 改动 |
|------|------|
| `src/App.jsx` | nodeTypes 注册 `scriptBoxNode`；initialNodes 加演示实例 `script-1` |
| `src/components/base/NodePalette.jsx` | 「其他工具」加「剧本盒子」条目 |
| `src/components/base/NodeShell.jsx` | 新增 `style` prop（合并到根 div inline style，用于宽节点撑高） |

---

## 3. 数据模型（node.data 契约）

```js
{
  step, projectName, story, globalStyle, styleChips,
  shotCount('auto'|数字|'custom'), customCount,
  shots: [{ id,index,duration:'5s',description,shotType,lighting,
            dialogue:[{kind:'台词'|'旁白',role,text}], sound,motion,
            grid:0,prompt,videoPrompt,promptLoading,connImg,connVid }],
  assets: [{ id,category('character'|'scene'|'prop'),name,description,prompt,
             imageUrl,thumbnailUrl,has,loading,picked,
             videoStatus(''|'uploading'|'uploaded'|'failed') }],
  pickedCount, aspectRatio, customAspectRatio,
  imageGlobalConstraint, videoGlobalConstraint, customGlobalConstraint,
  customScriptPrompt, customShotPrompt,
  customAssetTemplates:{character,scene,prop},
  assetModelSettings:{globalModel,...},
  genMask, genSecs, connected,
  // 9 个引擎回调（App 创建时注入，ScriptBoxNode 兜底补齐）：
  onGenerateScript, onGenerateAssetImage, onGenerateAllAssetImages,
  onGenerateShotPrompts, onStopScriptItem, onRetryVideoAssetUpload,
  onUploadAllVideoAssets, onConnectShot, onConnectShots
}
```

**命名注意**：统一风格是 `globalStyle`（不是 `style`）；资产是 `category`/`description`（不是 `cat`/`desc`）。

---

## 4. 9 个引擎回调

| 回调 | 官方 | 作用 | 当前假实现 |
|------|------|------|-----------|
| `onGenerateScript` | Ar | 生成分镜+资产 | buildShots+buildAssets，800ms 写回 |
| `onGenerateAssetImage(id)` | Pr | 单资产参考图 | picsum 占位图，500ms 写回 |
| `onGenerateAllAssetImages` | Fr | 批量生成 | 逐个错开调单图 |
| `onGenerateShotPrompts(ids)` | Ir | 分镜提示词 | 标 promptLoading，500ms 清除 |
| `onStopScriptItem` | Un | 停止生成 | 空 |
| `onRetryVideoAssetUpload(id)` | oi | 重试上传 | uploading→uploaded，600ms |
| `onUploadAllVideoAssets` | ai | 上传全部 | 全标→uploaded，900ms |
| `onConnectShot(id)` | li | 单镜连下游 | addNodes 建 promptNode+discountVideoNode（需 App 传 addNodes） |
| `onConnectShots(ids)` | ui | 批量连下游 | 逐个调单镜 |

---

## 5. 验证

```bash
cd prototypes/react-nodes
npm run dev             # http://localhost:5180
npm run test:smoke
npm run test:regression
npm run build
```

手动：画布 `script-1` → 步骤1「生成分镜脚本」→ 表格出分镜 → 步骤2 三栏资产 → 步骤3 卡片。

---

## 6. 已知问题 / 待办

1. **ReactFlow wrapper 高度限制**（视觉不完美，功能正常）
   - `ScriptBoxNode` 传 `style={{height:680,width:900}}`，但 wrapper 实测约 420-484，内容溢出底部被截。
   - 根因：ReactFlow mount 时用 measured 高度覆盖 `node.height`；NodeShell 根 div inline style 改不到外层 wrapper。
   - 参考：`NodeShell.useNodeSize` 读 store `n.width/n.height`；需配合 `useUpdateNodeInternals` 或 initialNodes 的 style+measure 机制。
2. **真实引擎未接**：当前全假实现。接真链路只需替换 `scriptBoxEngine.js` 各回调函数体；回调注入应改由 `App.jsx`（有 setNodes/addNodes/坐标）创建引擎挂到 `node.data.onXxx`。
3. **可补细节**（对照 `docs/剧本盒子/剧本盒子原型.html`）：
   - 双击编辑器的 @资产插入按钮 + 排版按钮（加粗/斜体）
   - 步骤3 生图宫格（4/9 格）渲染（当前只显示单张 imageUrl）
   - 步骤3 真实连线落点（`onConnectShot` 需 App 用 `screenToFlowPosition` 算位置）
   - 对白编辑器富文本工具栏
   - 批量连线的位置分布

---

## 7. 踩过的坑

- **旧版实现全废弃**：曾用 `useState` 缓存数据、直接 `setShots` 改，违反铁律，已按职责架构重写。别走回头路。
- **字段命名**：`globalStyle` 不是 `style`；`category/description` 不是 `cat/desc`。
- **引擎回调经 `updateData` 写回**，不是直接改 props。
