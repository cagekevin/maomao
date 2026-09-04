// @vitest-environment jsdom
/**
 * nodeRuntimeStore 单测（节点瞬态运行态 store · 阶段二收口）。
 * 覆盖三个关键契约：
 *  1. 写统一走 updateNodeRuntime（整对象替换，幂等），不同 nodeId 隔离；
 *  2. 未初始化条目读缺省态（loading:false/error:''/progress:0），不返 undefined；
 *  3. clearNodeRuntime 清理条目（节点卸载/删除时防内存残留）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
// jest-dom matchers via import from _testUtils not required; use plain expect
import {
  getNodeRuntime,
  updateNodeRuntime,
  clearNodeRuntime,
} from '../../src/components/base/store/nodeRuntimeStore.ts'

// 真实模块级 Map 在测试进程共享，beforeEach 清理防用例间串扰
beforeEach(() => {
  clearNodeRuntime('a')
  clearNodeRuntime('b')
})

describe('nodeRuntimeStore — 瞬态统一拥有者（阶段二）', () => {
  it('未初始化条目读缺省态，不返 undefined', () => {
    expect(getNodeRuntime('a')).toEqual({ loading: false, error: '', progress: 0 })
  })

  it('updateNodeRuntime 写后 getNodeRuntime 读到更新值', () => {
    updateNodeRuntime('a', { loading: true })
    expect(getNodeRuntime('a').loading).toBe(true)
  })

  it('不同 nodeId 状态互相隔离，互不影响', () => {
    updateNodeRuntime('a', { loading: true, progress: 40 })
    expect(getNodeRuntime('a').loading).toBe(true)
    expect(getNodeRuntime('a').progress).toBe(40)
    // b 未被写，保持缺省
    expect(getNodeRuntime('b')).toEqual({ loading: false, error: '', progress: 0 })
  })

  it('updateNodeRuntime 只改 patch 指向字段，其余保留（整对象合并，幂等）', () => {
    updateNodeRuntime('a', { loading: true, error: 'err', progress: 50 })
    updateNodeRuntime('a', { progress: 80 }) // 只改 progress
    const s = getNodeRuntime('a')
    expect(s.loading).toBe(true) // 保留
    expect(s.error).toBe('err') // 保留
    expect(s.progress).toBe(80) // 更新
  })

  it('clearNodeRuntime 后条目清理，重读回缺省态', () => {
    updateNodeRuntime('a', { loading: true })
    clearNodeRuntime('a')
    expect(getNodeRuntime('a')).toEqual({ loading: false, error: '', progress: 0 })
  })
})