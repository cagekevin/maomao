# 函数体重写任务

9 agent，每人 3 个节点。**在 App.js 内重写**：局部变量语义化 + 段落注释。不改文件结构。

| Agent | 节点 |
|-------|------|
| AB01 | imageNode, promptNode, textNode |
| AB02 | cropNode, gridSplitNode, gridMergeNode |
| AB03 | videoNode, sd2VideoNode, discountVideoNode |
| AB04 | audioNode, audioPlayerNode, customNode |
| AB05 | rhWebappNode, videoExtractNode, videoToGifNode |
| AB06 | imageCompressNode, faceMosaicNode, compareNode |
| AB07 | textConcatNode, urlToImageNode, fileToUrlNode |
| AB08 | panoramaNode, director3dNode, imageBoxNode |
| AB09 | stickyNoteNode, group, ghostTarget |

改完一个节点 → `npm run build && node scripts/check-build.cjs` 验证。
