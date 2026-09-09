# 生成资产提示词标签 实施计划

> **给 Claude 看：** 必需子技能：使用 executing-plans 按任务逐条执行本计划。

**目标：** 仅为今后在当前项目中生成并成功落盘的媒体资产，从生成提示词本地提取标签并持久化，且不覆盖已有标签。

**架构：** 新增独立的资产标签服务，使用浏览器内置分词能力提取有限数量的短标签，并通过现有稳定资产索引写入 `assetMetaV2`。节点生成复用输出历史记录入口触发，对话媒体生成在文件保存后触发；标签失败不改变生成结果。

**技术栈：** TypeScript 6、IndexedDB、Tauri 文件元数据、Vitest

---

### 任务 1：本地标签提取与持久化

**涉及文件：**
- 新建：`src/services/fs/generatedAssetTags.ts`
- 新建：`tests/services/generatedAssetTags.test.ts`

**步骤 1：编写失败的测试**

覆盖中文和英文提示词提取、模型引用与 URL 过滤、数量限制、已有标签不覆盖，以及新资产标签持久化。

**步骤 2：运行测试验证其失败**

运行：`npx vitest run tests/services/generatedAssetTags.test.ts`

预期：FAIL，因为 `generatedAssetTags.ts` 尚不存在。

**步骤 3：编写最小实现**

实现 `extractGeneratedAssetTags(prompt)` 与 `tagGeneratedProjectAsset({ filePath, projectId, prompt })`。使用 `Intl.Segmenter`，不可用时回退到正则分词；最多保留 6 个标签。资产已有标签时直接跳过。

**步骤 4：运行测试验证其通过**

运行：`npx vitest run tests/services/generatedAssetTags.test.ts`

预期：PASS。

### 任务 2：接入统一生成边界

**涉及文件：**
- 修改：`src/store/store.historyRecord.ts`
- 修改：`src/services/ai/generationRuntime.ts`
- 测试：`tests/services/generatedAssetTags.test.ts`

**步骤 1：补充集成预期**

验证只有成功、带 `filePath`、带非空提示词的记录会触发标签；对话图片、视频、音频保存成功后触发同一服务。

**步骤 2：实现最小钩子**

节点生成在输出历史成功持久化后异步标记；对话生成在媒体文件保存成功后标记。捕获标签错误并输出不含提示词和路径的固定警告。

**步骤 3：运行针对性验证**

运行：`npx vitest run tests/services/generatedAssetTags.test.ts tests/services/generationRuntime.test.ts`

预期：PASS。

### 任务 3：静态与差异检查

**涉及文件：**
- 校验上述全部文件

**步骤 1：运行静态检查**

运行：`npm run typecheck`

运行：`npm run test:typecheck`

运行：`npx eslint src/services/fs/generatedAssetTags.ts src/store/store.historyRecord.ts src/services/ai/generationRuntime.ts tests/services/generatedAssetTags.test.ts`

**步骤 2：运行仓库检查**

运行：`git diff --check`

对全部修改文本执行严格 UTF-8 解码并扫描常见乱码字符。
