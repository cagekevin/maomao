# monoform 依赖兼容说明

> 记录 monoform-previs-studio 接入 maomao 后的依赖兼容情况。
> 结论：**当前全部兼容，无需升级任何依赖。**

## 背景

monoform（白膜预演工具）作为画布 overlay 嵌入 maomao 后，**复用 maomao 的 node_modules**，不重复安装。
由于 monoform 独立仓库的 package.json 声明的版本与 maomao 存在差异，本文档记录差异与兼容性结论。

## 依赖版本对照

| 包 | maomao 实际版本 | monoform 声明 | 差异 | 兼容结论 |
|---|---|---|---|---|
| three | 0.185.1 | ^0.170 | 更高 | ✅ 已跑通，向后兼容 |
| @react-three/fiber | 9.7.0 | ^9.7.0 | 一致 | ✅ |
| @react-three/drei | 10.7.8 | ^10.7.7 | 微高 | ✅ |
| react | 19.2.8 | ^19.2.8 | 一致 | ✅ |
| react-dom | 19.2.8 | ^19.2.8 | 一致 | ✅ |
| lucide-react | 0.451.0 | ^1.28.0 | **大版本差** | ✅ 图标实测全兼容 |
| mediabunny | 1.54.0 | ^1.52.2 | 微高 | ✅ |
| vite | 5.4.21 | ^8.2.0 | **大版本差** | ✅ dev/build 已跑通 |
| @vitejs/plugin-react | 4.7.0 | ^6.0.5 | **大版本差** | ✅ |

## 兼容性验证

- **构建**：`vite build` 通过，monoform 代码已正确打入 bundle。
- **lucide-react**：monoform 用到的全部 47 个图标，在 maomao 的 lucide-react@0.451.0 中均已验证存在（`ALL_ICONS_OK`）。
- **运行时**：overlay 打开、交互、导出均正常。
- **单一实例**：所有依赖在 maomao `node_modules` 下仅一份，无重复安装。

## 为何不升级

| 包 | 升级风险 | 收益 |
|---|---|---|
| lucide-react (→1.x) | **高危**：maomao 有 58 个文件依赖它，1.x 有破坏性变更（图标命名/导出变化），升级需全面回归 | 零（当前图标全兼容） |
| vite (→8.x) | **高危**：重大版本升级，需同步升级 plugin-react 等插件，波及构建链/tailwind/postcss/playwright | 零 |
| @vitejs/plugin-react (→6.x) | 高：依赖 vite 8，需和 vite 一起升 | 零 |
| three (→0.170) | 方向反了：maomao 0.185 比 0.170 更新，属降级 | 零 |

**核心原则**：monoform **适配 maomao 的现有依赖版本**，而非反过来升级 maomao。

## 潜在风险点（当前无影响）

- `lucide-react` 版本差最大。若未来 monoform 新增了 **1.x 才引入**的图标，可能在 maomao 0.451 下缺失。
  - 应对：新增图标时验证其在 lucide-react@0.451 中存在；缺失则换用等价旧图标。

## 相关文件

- `src/components/monoform/App.jsx` — 主界面
- `src/components/monoform/Viewport.jsx` — 3D 视口
- `src/components/monoform/MonoformOverlay.jsx` — 画布接入外壳
- `src/components/monoform/styles.css` — 样式
- `src/components/monoform/rig.js` — 骨骼/动作
- `src/components/monoform/ShotsPanel.jsx` — 镜头列表
