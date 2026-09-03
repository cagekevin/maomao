/**
 * DiscountVideoNode 补充深度测试（非 upstream 部分）。
 *
 * upstream 测试（DiscountVideoNode.upstream.test.jsx）已覆盖「上游文本/图片合并」。
 * 本文件补充其余高频交互，防止比例/分辨率/时长菜单、素材插入/断线、提示词落盘、
 * 展开收起、下载、删除视频等逻辑回归：
 *  - 空态/有视频态渲染（VideoThumbnail / 占位图标 / 工具栏按钮）
 *  - 比例/分辨率/时长菜单：展开、选择后界面更新并记忆到 prefs
 *  - 提示词输入写回 node.data.prompt（setNodes updater 精确断言）
 *  - 素材 @插入 → 提示词追加；断开连线 → setEdges 过滤该来源
 *  - 下载：文件名缺扩展名自动补 .mp4，调 downloadUrl
 *  - 删除视频：工具栏按钮消失
 *  - 点击主显示区 toggleExpanded → 写回 data.expanded
 *  - data.videoUrl 外部写入 → 同步本地 state 显示缩略图
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// 捕获 setNodes/setEdges 传入的 updater 并执行，得到更新后的 nodes/edges（供断言 data 变更）
const h = vi.hoisted(() => {
  const state = { nodes: [], edges: [] }
  const setNodesMock = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater
  })
  const setEdgesMock = vi.fn((updater) => {
    state.edges = typeof updater === 'function' ? updater(state.edges) : updater
  })
  const downloadUrl = vi.fn()
  const vidPrefsSet = vi.fn()
  const loggerInfo = vi.fn()
  return { state, setNodesMock, setEdgesMock, downloadUrl, vidPrefsSet, loggerInfo }
})

// 直接引用 h 的 mock 函数，不写 (...a) => h.x(...a)：后者因参数被推断成空元组 []
// 会报 TS2556（与 AgentPanel.test.tsx 同根因）。h 属性不会被重新赋值，延迟绑定语义不变。
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: h.setNodesMock,
    setEdges: h.setEdgesMock,
    getNodes: () => h.state.nodes,
    getEdges: () => h.state.edges,
  }),
  useStore: () => () => ({}),
}))

vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: ({ children }) => children }))
// HoverToolbar：渲染按钮数组，供点击下载/删除/发送到剪映
vi.mock('../../src/components/base/panels/HoverToolbar.tsx', () => ({
  default: ({ buttons }) => (
    <div data-testid="hover-toolbar">
      {buttons.map((b) => (
        <button key={b.key} type="button" title={b.title} onClick={b.onClick}>{b.title}</button>
      ))}
    </div>
  ),
}))
vi.mock('../../src/components/base/ui/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
// MaterialStrip：渲染可点的「插入素材」与「断开连线」按钮，透传回调
vi.mock('../../src/components/base/panels/MaterialStrip.tsx', () => ({
  default: ({ onInsert, onDisconnect }) => (
    <div data-testid="material-strip">
      <button type="button" data-testid="insert" onClick={() => onInsert('素材A')}>插入素材A</button>
      <button type="button" data-testid="disconnect" onClick={() => onDisconnect('s1')}>断开s1</button>
    </div>
  ),
}))
vi.mock('../../src/components/base/ui/GenerateButton.tsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/ui/ModelSelect.tsx', () => ({ default: () => null }))
// PromptInput：桩为 textarea，透传 value/onChange/placeholder；onReady 上抛一个
// 「追加 @label 文本」的插入函数（复刻旧 textarea 行为），避免测试耦合富文本内部实现。
// 富文本芯片本身的序列化/交互由 promptChips.test.js 与 PromptInput 自己的测试覆盖。
vi.mock('../../src/components/base/prompt/PromptInput.tsx', async (importOriginal) => {
  const ReactMock = (await import('react')).default
  // 桩组件的 props 形状（只声明被测用到的字段）。不声明的话 forwardRef 把 props 推断成 {}，
  // 解构 value/onChange/onReady 等会报 TS2339。
  interface MockPromptInputProps {
    value?: string
    onChange?: (v: string) => void
    onInsert?: unknown
    onReady?: (insert: (asset: unknown) => void) => void
    placeholder?: string
  }
  // importOriginal 返回 unknown，直接 spread 报 TS2698
  return {
    ...((await importOriginal()) as Record<string, unknown>),
    // 显式给 forwardRef 加泛型：否则 ref 是 ForwardedRef<unknown>，
    // 赋给 textarea 的 Ref<HTMLTextAreaElement> 报 TS2322
    default: ReactMock.forwardRef<HTMLTextAreaElement, MockPromptInputProps>(function MockPromptInput({ value, onChange, onInsert, onReady, placeholder }, ref) {
      ReactMock.useEffect(() => {
        onReady?.((asset) => {
          // asset 形参为 unknown，访问 label 前窄化（对象型才读 label）
          const label = typeof asset === 'string' ? asset : (asset && (asset as { label?: string }).label) || ''
          onChange(value ? `${value} @${label} ` : `@${label} `)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return (
        <textarea
          ref={ref}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )
    }),
  }
})
vi.mock('../../src/components/base/prompt/PromptLibraryButton.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/GeneratingOverlay.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/ResizeFullscreenHandle.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/panels/FullscreenModal.tsx', () => ({ default: ({ open, children }) => (open ? <div data-testid="fullscreen">{children}</div> : null) }))
vi.mock('../../src/components/base/ui/VideoThumbnail.tsx', () => ({ default: () => <div data-testid="video-thumb" /> }))

vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => ({ images: [], texts: [] }) }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({ useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))
vi.mock('../../src/hooks/useVideoPoster.ts', () => ({ useVideoPoster: () => null }))
vi.mock('../../src/components/base/canvas/nodePrefs.ts', () => ({
  useNodePrefs: () => ({ prefs: { model: '', size: '', resolution: '', seconds: '' }, set: (...a) => h.vidPrefsSet(...a) }),
}))
vi.mock('../../src/components/base/store/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(async () => {}) }))
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({ buildAllModels: () => [], resolveProviderModel: () => ({ provider: {}, modelId: 'm' }) }))
vi.mock('../../src/components/base/core/logger.ts', () => ({ logger: { info: (...a) => h.loggerInfo(...a), warn: () => {} } }))
vi.mock('../../src/components/base/utils/clipboard.ts', async (importOriginal) => {
  // importOriginal 返回 unknown，直接 spread 报 TS2698
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, downloadUrl: h.downloadUrl }
})
vi.mock('../../src/components/base/api/videoApi.ts', () => ({ generateVideo: vi.fn(async () => ({ url: 'http://gen.local/v.mp4' })) }))

// useNodeGeneration：记录 config，返回可控 loading/error。
// 桩复刻真实 hook 的声明式写回（resultKey + recoverable）以对齐 P0-2-c：
// 节点 onSuccess/onRecover 不再手写 patchData，data.videoUrl 由 resultKey/recoverable 自动写回。
let genConfig = null
let genLoading = false
vi.mock('../../src/hooks/useNodeGeneration.ts', () => ({
  useNodeGeneration: (config) => {
    genConfig = config
    // 复刻真实 hook 的广播 handler：recoverable + resultKey 且广播带 resultUrl 时自动写回 node.data
    const originalOnRecover = config.onRecover
    genConfig.onRecover = (d) => {
      if (config.recoverable && config.resultKey && d?.resultUrl) {
        h.setNodesMock((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: d.resultUrl } } : n)))
      }
      originalOnRecover?.(d)
    }
    return {
      loading: genLoading,
      error: null,
      stop: vi.fn(),
      // 复刻真实 start：跑 run → resultKey 自动写回 node.data → 回调 onSuccess（便于断言回填）
      start: vi.fn(async () => {
        const r = await config.run?.({ progress: () => {}, signal: { aborted: false } })
        if (config.resultKey && (r?.url || r?.doneUrl)) {
          const url = r.url || r.doneUrl
          h.setNodesMock((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: url } } : n)))
        }
        config.onSuccess?.(r)
        return r
      }),
    }
  },
}))

import DiscountVideoNode from '../../src/components/nodes/DiscountVideoNode.tsx'

const nodeId = 'n1'
function setup(data = {}) {
  h.state.nodes = [{ id: nodeId, data: { ...data } }]
  h.state.edges = []
  h.setNodesMock.mockClear()
  h.setEdgesMock.mockClear()
  h.downloadUrl.mockClear()
  h.vidPrefsSet.mockClear()
  h.loggerInfo.mockClear()
  genConfig = null
  genLoading = false
  return render(<DiscountVideoNode id={nodeId} data={{ ...data }} selected={false} />)
}
function nodeData() {
  return h.state.nodes.find((n) => n.id === nodeId)?.data
}

describe('DiscountVideoNode — 渲染', () => {
  it('空态：无视频时显示占位图标，无工具栏视频按钮', () => {
    setup()
    // 工具栏只保留「上传」按钮
    const toolbar = screen.getByTestId('hover-toolbar')
    expect(toolbar.textContent).toContain('上传图片、视频或音频素材')
    expect(toolbar.textContent).not.toContain('下载')
    expect(toolbar.textContent).not.toContain('删除')
  })

  it('有 videoUrl 时显示视频缩略图与完整工具栏', () => {
    setup({ videoUrl: 'http://gen.local/v.mp4' })
    expect(screen.getByTestId('video-thumb')).toBeTruthy()
    const toolbar = screen.getByTestId('hover-toolbar')
    expect(toolbar.textContent).toContain('下载')
    expect(toolbar.textContent).toContain('发送到剪映素材库')
    expect(toolbar.textContent).toContain('删除')
  })

  it('默认显示比例/分辨率/时长摘要', () => {
    setup()
    expect(screen.getByText('16:9 · 1080p · 10s')).toBeTruthy()
  })

  it('data.videoUrl 外部写入同步到本地 state（显示缩略图）', () => {
    setup({ videoUrl: 'http://gen.local/ext.mp4' })
    expect(screen.getByTestId('video-thumb')).toBeTruthy()
  })
})

describe('DiscountVideoNode — 比例/分辨率/时长菜单', () => {
  it('点击摘要按钮展开菜单，显示三组选项', () => {
    setup()
    fireEvent.click(screen.getByTitle('选择比例和时长'))
    expect(screen.getByText('比例')).toBeTruthy()
    expect(screen.getByText('分辨率')).toBeTruthy()
    expect(screen.getByText('时长 (秒)')).toBeTruthy()
    expect(screen.getByText('9:16')).toBeTruthy()
  })

  it('选择比例 9:16 → 摘要更新并记忆到 prefs', () => {
    setup()
    fireEvent.click(screen.getByTitle('选择比例和时长'))
    fireEvent.click(screen.getByText('9:16'))
    expect(screen.getByText('9:16 · 1080p · 10s')).toBeTruthy()
    expect(h.vidPrefsSet).toHaveBeenCalledWith({ size: '9:16' })
  })

  it('选择分辨率 720p → 摘要更新并记忆', () => {
    setup()
    fireEvent.click(screen.getByTitle('选择比例和时长'))
    fireEvent.click(screen.getByText('720p'))
    expect(screen.getByText('16:9 · 720p · 10s')).toBeTruthy()
    expect(h.vidPrefsSet).toHaveBeenCalledWith({ resolution: '720p' })
  })

  it('选择时长 6s → 摘要更新并记忆', () => {
    setup()
    fireEvent.click(screen.getByTitle('选择比例和时长'))
    // 时长已改为滑块（4~15s 自由选择），用 range 输入选择 6s
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } })
    expect(screen.getByText('16:9 · 1080p · 6s')).toBeTruthy()
    expect(h.vidPrefsSet).toHaveBeenCalledWith({ seconds: '6' })
  })
})

describe('DiscountVideoNode — 提示词与素材', () => {
  it('输入提示词写回 node.data.prompt（落盘）', () => {
    setup()
    const ta = screen.getByPlaceholderText('描述你想要的视频内容 (输入 @ 调出素材)...') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: '日落航拍' } })
    // P2：prompt 持续输入经 debouncedPatch（200ms）防抖写回 node.data
    return waitFor(() => expect(nodeData().prompt).toBe('日落航拍'))
  })

  it('点击素材 @插入 → 提示词追加 @素材A 并落盘', () => {
    setup()
    fireEvent.click(screen.getByTestId('insert'))
    const ta = screen.getByPlaceholderText('描述你想要的视频内容 (输入 @ 调出素材)...') as HTMLTextAreaElement
    expect(ta.value).toBe('@素材A ')
    // P2：插入后提示词经防抖写回 node.data
    return waitFor(() => expect(nodeData().prompt).toBe('@素材A '))
  })

  it('断开素材连线 → setEdges 过滤该来源节点到本节点的边', () => {
    setup()
    // 挂载后再注入连线状态（setup 会重置 edges）
    h.state.edges = [
      { source: 's1', target: nodeId, id: 'e1' },
      { source: 's2', target: nodeId, id: 'e2' },
      { source: 's1', target: 'other', id: 'e3' },
    ]
    h.setEdgesMock.mockClear()
    fireEvent.click(screen.getByTestId('disconnect'))
    expect(h.setEdgesMock).toHaveBeenCalled()
    // 执行 updater 后：e1（s1→n1）被删，e2/e3 保留
    expect(h.state.edges.map((e) => e.id)).toEqual(['e2', 'e3'])
  })
})

describe('DiscountVideoNode — 下载 / 删除 / 展开', () => {
  it('下载视频：label 无扩展名时自动补 .mp4 并调 downloadUrl', () => {
    setup({ videoUrl: 'http://gen.local/v.mp4', label: '特效视频' })
    fireEvent.click(screen.getByTitle('下载'))
    expect(h.downloadUrl).toHaveBeenCalledWith('http://gen.local/v.mp4', '特效视频.mp4')
  })

  it('下载视频：无 label 时用 URL 文件名', () => {
    setup({ videoUrl: 'http://gen.local/videos/abc.mp4' })
    fireEvent.click(screen.getByTitle('下载'))
    expect(h.downloadUrl).toHaveBeenCalledWith('http://gen.local/videos/abc.mp4', 'abc.mp4')
  })

  it('点击删除 → 视频清空、下载/删除按钮消失', () => {
    setup({ videoUrl: 'http://gen.local/v.mp4' })
    fireEvent.click(screen.getByTitle('删除'))
    const toolbar = screen.getByTestId('hover-toolbar')
    expect(toolbar.textContent).not.toContain('下载')
    expect(toolbar.textContent).not.toContain('删除')
  })

  it('点击主显示区 → toggleExpanded 写回 data.expanded', () => {
    const { container } = setup()
    // 主显示区：.group\/display 容器
    const display = container.querySelector('.group\\/display')
    fireEvent.click(display)
    expect(nodeData().expanded).toBe(false)
  })

  it('data.expanded=false 时初始为收起态，点击后展开', () => {
    setup({ expanded: false })
    expect(nodeData().expanded).toBe(false)
  })
})

describe('DiscountVideoNode — 生成成功回填 node.data（真相源契约）', () => {
  it('onSuccess 把生成结果写回 data.videoUrl（刷新不丢：节点持有结果副本）', async () => {
    setup()
    // 点生成 → mock start 走 run → onSuccess({url})；断言结果写回 node.data
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(nodeData().videoUrl).toBe('http://gen.local/v.mp4'))
  })
})
