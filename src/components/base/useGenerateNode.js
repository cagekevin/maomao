import { useEffect, useMemo, useRef } from 'react'
import { useProviders } from './settings/providerStore.js'
import { buildAllModels } from './providerModels.js'
import { useSyncNodeData } from './useSyncNodeData.js'
import { useNodeGeneration } from './useNodeGeneration.js'

/**
 * ════════════════════════════════════════════════════════════════
 * 统一「生成节点」编排 hook（useGenerateNode）—— P0-2 收口（68+71 行）
 * ════════════════════════════════════════════════════════════════
 *
 * 【它收敛什么】（对比 usNodeGeneration：那个只收敛「提交→进度→成败→retry」契约；
 *   本 hook 再把生成节点反复同写的管理切片一并收进，节点只需给差异部分）
 *  - 供应商/模型：useProviders + primary + buildAllModels(providers, type)，
 *    给出模型下拉数据与「选 provider」所需的 providers/primary（注入 ctx）。
 *  - 默认模型回填：providers 加载后，若「无记忆 + 节点未显式指定」→ 取第一个模型并记忆 prefs。
 *  - useSyncNodeData 收编（第71行）：外部 data 字段 → 本地 state 桥，节点不再手写。
 *  - useNodeGeneration 委托：resultKey:resultField 自动写回 + recoverable 回填。
 *
 * 【ctx 注入】节点的 run/onSuccess/onRecover/validate 以 ctx 拿 provider 管理态：
 *   ctx = { providers, primary, models, selectedModel, prefs, setPrefs }
 * 节点自有的生成参数（imageSize/count/aspectRatio/quality/effectivePrompt 等）仍走闭包，
 * 保持 run 主体结构不变（避免过度抽象、规避记忆「over-abstraction」教训）。
 *
 * 【契约（与 useNodeGeneration 完全一致，仅回调多收一个 ctx）】
 *   validate(ctx) → 错误文案或空串
 *   run({progress,signal}, ctx) → { ok:true,url?,content?,doneUrl? } | { ok:false,error }
 *   onSuccess(r, ctx)   → UI state + 业务记忆（data[resultField] 已由声明式写回）
 *   onRecover(d, ctx)   → UI state + 重建等（data[resultField] 已由 recoverable 回填）
 *
 * 【为什么 prefs/selectedModel 由节点持有并传入】
 *   aspectRatio/imageSize 等参数用 useState(data.x || prefs.x || 默认) 初始化，
 *   需在 hook 之前拿到 prefs；而 useSyncNodeData 的 sync 又要引用这些参数的 setter。
 *   若 prefs 由本 hook 持有会形成「参数初始化 ⟷ 参数 setter」排序死锁。
 *   故 prefs/selectedModel 由节点声明并传入，hook 复用它们做默认模型回填 + ctx 注入，
 *   既无死锁又逐字节对齐现状（非破坏）。
 */
export function useGenerateNode({
  nodeId,
  type,          // 'image' | 'chat' | 'video'（buildAllModels 模型域）
  reportType,    // 任务上报用的节点类型（type 与上报类型不一致时用，缺省 = type）
                 // 例：TextNode 模型域是 'chat'，但上报 type 是 'text'，故 reportType:'text'。
  prompt,        // 任务上报用的有效提示词（节点的 effectivePrompt）
  data,          // 节点当前 data（供 useSyncNodeData 与默认模型守卫）
  prefs,         // 节点 useNodePrefs().prefs
  setPrefs,      // 节点 useNodePrefs().set
  selectedModel, // 节点 selectedModel state
  setSelectedModel,
  sync = {},     // { data字段: setState } → 收编 useSyncNodeData（第71行）
  resultField,   // 成功/广播自动写回的 data 字段（如 'imageUrl'/'videoUrl'）；文本节点不传
  recoverable = false,
  validate,
  run,
  onSuccess,
  onRecover,
}) {
  // ── 供应商/模型（统一选 provider / 模型下拉数据）──
  const { providers } = useProviders()
  const primary = providers?.find((p) => p.primary) || providers?.[0] || null
  const models = buildAllModels(providers, type)

  // ── 收编 useSyncNodeData（第71行）：外部 data 变更 → 本地 state ──
  useSyncNodeData(data, sync)

  // ── providers 加载后默认模型回填（记忆空 + 节点未显式指定 → 取第一个并记忆）──
  const defaultFromProvider = models[0]?.id
  useEffect(() => {
    if (!defaultFromProvider) return
    if (prefs?.model) return // 已有记忆，不覆盖
    if (data?.selectedModel) return // 节点显式指定，不覆盖
    setSelectedModel(defaultFromProvider)
    setPrefs({ model: defaultFromProvider })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFromProvider])

  // ── ctx：注入给 submit/生成回调的 provider 管理态 ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(
    () => ({ providers, primary, models, selectedModel, prefs, setPrefs }),
    [providers, primary, models, selectedModel, prefs, setPrefs]
  )
  // 用 ref 存回调，确保 useNodeGeneration 内部恒调用最新版并带上最新 ctx
  const validateRef = useRef(validate); validateRef.current = validate
  const runRef = useRef(run); runRef.current = run
  const onSuccessRef = useRef(onSuccess); onSuccessRef.current = onSuccess
  const onRecoverRef = useRef(onRecover); onRecoverRef.current = onRecover

  // ── 委托底层契约：resultKey 自动写回 + recoverable 自动回填 ──
  const gen = useNodeGeneration({
    nodeId,
    type: { type: reportType || type, prompt, modelName: selectedModel },
    validate: () => validateRef.current?.(ctx),
    run: (args) => runRef.current?.(args, ctx),
    onSuccess: (r) => onSuccessRef.current?.(r, ctx),
    onRecover: (d) => onRecoverRef.current?.(d, ctx),
    resultKey: resultField,
    recoverable,
  })

  return { providers, primary, models, ...gen }
}