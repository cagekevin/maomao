# AI_NAVIGATION.md · AI 改代码第一站（极简导航）

> 自动生成（scripts/gen_bundle_map.cjs）。**改 `src/bundle/` 前先看本表**，别凭混淆文件名猜。

## 一、遇到"X 是啥" → 只记这一条命令（必用）

```
npm run ask -- symbol <短名>      # 查符号：用途 + 落点 + 同名影子警示
npm run ask -- contract <键>      # 查契约：影响哪些文件/端
npm run ask -- file <关键词>      # 查功能/特征：进哪个文件
```

改码前不确定任何东西，先跑 `npm run ask`，答案秒出，不用自己翻大文件。

## 二、改动完成验证

```
npm run test:smoke    # 契约漂移/React单实例/chunk完整性
npm run build        # 回灌 dist/
```

## 三、铁律速记

- **运行时只认 `dist/`**，改前端一律改 `src/bundle/` 后 `npm run build` 回灌。
- **BUNDLE_MAP.md / symbol_map.json / CONTRACTS.md 是自动生成物，禁止手改**（`npm run map` / `npm run contracts` 重建）。
- **React 单实例不可破**（`_react_shim.js`/`_jsx_runtime.js`/`vendor` 勿改）；**字符串契约零损伤**。
