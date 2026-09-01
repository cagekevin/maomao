# 75 · M1 错误全貌（只读扫描，零工作区污染）

- 生成时间：2026-09-01T05:24:34.308Z
- 方法：复制 tests/unit → gitignored tmp/unit，副本剥离 @ts-nocheck，临时 tsconfig 跑 tsc
- 总计错误：**777**（tests/unit 777 / src 0）
- 涉及文件：tests 99 个 / src 0 个

## 错误码分布

| 错误码 | 数量 |
|---|---|
| TS2339 | 390 |
| TS2345 | 135 |
| TS2322 | 42 |
| TS2741 | 37 |
| TS2493 | 31 |
| TS2554 | 29 |
| TS2556 | 27 |
| TS18048 | 25 |
| TS2353 | 19 |
| TS2698 | 11 |
| TS2532 | 9 |
| TS2739 | 7 |
| TS2740 | 7 |
| TS2349 | 2 |
| TS2551 | 2 |
| TS2786 | 2 |
| TS2304 | 1 |
| TS2559 | 1 |

## tests/unit 各文件（错误数降序）

| 文件 | 错误数 | 错误码分布 |
|---|---|---|
| `tests/unit/useAgentChat.hook.test.ts` | 73 | TS2339×25, TS2554×23, TS2345×22, TS2322×2, TS2349×1 |
| `tests/unit/canvasAgentTools.test.ts` | 55 | TS2339×51, TS2345×3, TS2698×1 |
| `tests/unit/creditGateModes.test.ts` | 35 | TS2339×33, TS2698×2 |
| `tests/unit/agentMessages.test.ts` | 33 | TS2339×33 |
| `tests/unit/useAssetDropPaste.test.tsx` | 33 | TS2345×28, TS2339×3, TS2556×2 |
| `tests/unit/canvasPlanExecutor.test.ts` | 31 | TS2741×22, TS2339×5, TS2353×4 |
| `tests/unit/CustomHandle.test.tsx` | 18 | TS2339×18 |
| `tests/unit/scriptBoxEngine.deep.test.ts` | 18 | TS2339×18 |
| `tests/unit/useLocalToolStatus.test.ts` | 17 | TS2339×17 |
| `tests/unit/agentLogic.test.ts` | 16 | TS2345×13, TS2339×3 |
| `tests/unit/pollTask.test.ts` | 16 | TS2345×13, TS2339×2, TS2493×1 |
| `tests/unit/resourcesApi.test.ts` | 16 | TS2493×11, TS18048×4, TS2532×1 |
| `tests/unit/scriptBoxEngine.test.ts` | 16 | TS2339×13, TS2322×2, TS2345×1 |
| `tests/unit/kvStore.test.ts` | 13 | TS2339×11, TS2345×2 |
| `tests/unit/TextNode.upstream.test.tsx` | 13 | TS2493×5, TS18048×5, TS2532×2, TS2556×1 |
| `tests/unit/canvasHooks.test.ts` | 12 | TS2322×10, TS2339×1, TS2345×1 |
| `tests/unit/memoryRetrieval.test.ts` | 12 | TS2345×6, TS2339×2, TS2741×2, TS2698×1, TS2739×1 |
| `tests/unit/PromptNode.upstream.test.tsx` | 12 | TS2493×4, TS18048×4, TS2532×2, TS2322×1, TS2556×1 |
| `tests/unit/TemplateNode.upstream.test.tsx` | 12 | TS18048×5, TS2493×4, TS2532×2, TS2556×1 |
| `tests/unit/AgentPanel.test.tsx` | 11 | TS2339×6, TS2556×5 |
| `tests/unit/DiscountVideoNode.upstream.test.tsx` | 11 | TS2493×4, TS18048×4, TS2532×2, TS2556×1 |
| `tests/unit/imageUrl.test.ts` | 11 | TS2339×7, TS2345×1, TS2353×1, TS2554×1, TS2739×1 |
| `tests/unit/DiscountVideoNode.test.tsx` | 10 | TS2339×6, TS2556×2, TS2322×1, TS2698×1 |
| `tests/unit/proxyGenerate.test.ts` | 10 | TS2339×10 |
| `tests/unit/FaceMosaicNode.test.tsx` | 9 | TS2345×5, TS2556×3, TS2339×1 |
| `tests/unit/scriptBoxPlaybookIO.test.ts` | 9 | TS2339×9 |
| `tests/unit/useAssetMoveToFolder.test.tsx` | 9 | TS2345×5, TS2339×3, TS2698×1 |
| `tests/unit/agentRuntime.test.ts` | 8 | TS2353×3, TS2740×3, TS2339×1, TS2345×1 |
| `tests/unit/channelContract.test.ts` | 8 | TS2339×5, TS2345×3 |
| `tests/unit/config.test.ts` | 8 | TS2339×7, TS2322×1 |
| `tests/unit/contextCompression.test.ts` | 8 | TS2339×8 |
| `tests/unit/faceMosaic.test.ts` | 8 | TS2345×5, TS2339×3 |
| `tests/unit/mediaTools.test.ts` | 8 | TS2339×7, TS2322×1 |
| `tests/unit/taskStore.test.ts` | 8 | TS2339×8 |
| `tests/unit/useAssetCardDragProps.test.ts` | 8 | TS2339×6, TS2353×2 |
| `tests/unit/canvasPlanExecutor.deps.test.ts` | 7 | TS2741×6, TS2353×1 |
| `tests/unit/clipboard.test.ts` | 7 | TS2339×5, TS2322×1, TS2741×1 |
| `tests/unit/mediaType.test.ts` | 7 | TS2345×6, TS2554×1 |
| `tests/unit/NodeTitle.test.tsx` | 7 | TS2339×7 |
| `tests/unit/ScriptBoxNode.test.tsx` | 7 | TS2322×4, TS2339×1, TS2556×1, TS2698×1 |
| `tests/unit/scriptBoxPrompts.test.ts` | 7 | TS2741×3, TS2345×2, TS2322×1, TS2339×1 |
| `tests/unit/historyStack.test.ts` | 6 | TS2339×6 |
| `tests/unit/workflowState.test.ts` | 6 | TS2339×6 |
| `tests/unit/agentPersistRecovery.test.ts` | 5 | TS2339×3, TS2554×2 |
| `tests/unit/assetMove.test.ts` | 5 | TS18048×3, TS2493×2 |
| `tests/unit/promptManager.test.ts` | 5 | TS2345×5 |
| `tests/unit/useCanvasHistory.test.ts` | 5 | TS2345×4, TS2322×1 |
| `tests/unit/addNodeConcurrency.test.tsx` | 4 | TS2339×2, TS2322×1, TS2345×1 |
| `tests/unit/asyncGuard.test.ts` | 4 | TS2322×4 |
| `tests/unit/hooks.test.ts` | 4 | TS2353×4 |
| `tests/unit/taskStore.concurrency.test.ts` | 4 | TS2339×3, TS2554×1 |
| `tests/unit/useAssetDragToCanvas.test.ts` | 4 | TS2739×4 |
| `tests/unit/useCanvasSync.test.ts` | 4 | TS2339×2, TS2551×2 |
| `tests/unit/useStoreSelector.test.tsx` | 4 | TS2741×3, TS2349×1 |
| `tests/unit/accountsStore.test.ts` | 3 | TS2339×2, TS2304×1 |
| `tests/unit/appSettings.test.ts` | 3 | TS2339×2, TS2353×1 |
| `tests/unit/channelPath.test.ts` | 3 | TS2339×3 |
| `tests/unit/cloudSync.test.ts` | 3 | TS2339×3 |
| `tests/unit/nodeTypes.test.ts` | 3 | TS2339×3 |
| `tests/unit/PromptNode.imgMenu.test.tsx` | 3 | TS2556×2, TS2322×1 |
| `tests/unit/TemplateNode.test.tsx` | 3 | TS2339×2, TS2556×1 |
| `tests/unit/useScriptBoxEngine.test.ts` | 3 | TS2556×3 |
| `tests/unit/channelEvaluation.test.ts` | 2 | TS2339×2 |
| `tests/unit/channelWrite.test.ts` | 2 | TS2339×2 |
| `tests/unit/ConnectionLine.test.tsx` | 2 | TS2740×2 |
| `tests/unit/error-envelope.test.ts` | 2 | TS2339×2 |
| `tests/unit/errorBoundary.test.tsx` | 2 | TS2786×2 |
| `tests/unit/externalizeInline.test.ts` | 2 | TS2339×1, TS2345×1 |
| `tests/unit/ImageBoxNode.test.tsx` | 2 | TS2345×1, TS2556×1 |
| `tests/unit/LazyImage.test.tsx` | 2 | TS2322×1, TS2339×1 |
| `tests/unit/promptChips.test.ts` | 2 | TS2339×2 |
| `tests/unit/PromptNode.hoverToolbar.test.tsx` | 2 | TS2322×1, TS2698×1 |
| `tests/unit/proxy-outbound.test.ts` | 2 | TS2339×1, TS2698×1 |
| `tests/unit/StepShots.upstream.test.tsx` | 2 | TS2740×2 |
| `tests/unit/TaskCenter.test.tsx` | 2 | TS2556×2 |
| `tests/unit/toolRegistry.test.ts` | 2 | TS2345×2 |
| `tests/unit/useCanvasShortcuts.test.tsx` | 2 | TS2322×2 |
| `tests/unit/useContextMenu.test.ts` | 2 | TS2339×1, TS2353×1 |
| `tests/unit/useFitNodeRatio.test.ts` | 2 | TS2322×2 |
| `tests/unit/utils.test.ts` | 2 | TS2353×2 |
| `tests/unit/volumePolicy.test.ts` | 2 | TS2339×1, TS2559×1 |
| `tests/unit/agentAttachments.test.ts` | 1 | TS2339×1 |
| `tests/unit/agentModelStore.test.ts` | 1 | TS2322×1 |
| `tests/unit/backupStore.test.ts` | 1 | TS2339×1 |
| `tests/unit/CustomEdge.test.tsx` | 1 | TS2739×1 |
| `tests/unit/imageCompress.test.ts` | 1 | TS2322×1 |
| `tests/unit/imageModeSplit.test.ts` | 1 | TS2345×1 |
| `tests/unit/imageUpscale.test.ts` | 1 | TS2322×1 |
| `tests/unit/lazyNode.test.tsx` | 1 | TS2345×1 |
| `tests/unit/logger.test.ts` | 1 | TS2339×1 |
| `tests/unit/LoopNode.test.tsx` | 1 | TS2554×1 |
| `tests/unit/projectMemoryStore.test.ts` | 1 | TS2322×1 |
| `tests/unit/projectPath.test.ts` | 1 | TS2345×1 |
| `tests/unit/refToken.test.ts` | 1 | TS2345×1 |
| `tests/unit/runModeRegistry.test.ts` | 1 | TS2698×1 |
| `tests/unit/ScriptBoxModal.test.tsx` | 1 | TS2339×1 |
| `tests/unit/useVideoPoster.test.ts` | 1 | TS2322×1 |
| `tests/unit/VideoExtractNode.test.tsx` | 1 | TS2556×1 |
| `tests/unit/VideoProcessNode.test.tsx` | 1 | TS2698×1 |

## src 连带错：0 个 ✓