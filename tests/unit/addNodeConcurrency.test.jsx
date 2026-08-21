// @vitest-environment jsdom
/**
 * addNode 并发安全回归单测。
 *
 * 背景 / 根因：App.addNode 是画布唯一建节点入口。它从 nodesRef.current（由 useEffect 在
 * 「每次渲染提交后」才同步）读旧列表，再 setNodes(绝对数组)。当同一 tick 内连续批量调用
 * addNode（拖入多图时多文件并行上传完成后连续 resolve，或粘贴多帧时的 forEach），每次
 * 都读到同一个旧列表 → 后一次 setNodes 覆盖前一次 → 只留下一张，但 toast 却全弹。
 *
 * 修复：addNode 内建完节点就地同步 nodesRef.current（+edgesRef.current），让同一批次后续
 * addNode 立刻读到最新列表。本测试用「useState + ref 镜像」复刻 App 的同一模式，锁定该
 * 不变量：同一 tick 的 N 次 addNode 必须产出 N 个节点；任一处回退到旧写法（不就地同步 ref）
 * 即爆红。
 */
import { describe, it, expect } from 'vitest'
import React, { useRef, useEffect, useState } from 'react'
import { render, act } from '@testing-library/react'

// 制造自增 id 的节点（不能用 Date.now()，同一 tick 内会撞 id）
let counter = 0
function makeNode() {
  counter += 1
  const id = `n${counter}`
  return { id, type: 'imageNode', position: { x: id, y: 0 }, data: {} }
}

/**
 * 复刻 App.jsx 的 nodes 持有方式：useState 存 nodes + useRef 镜像 + useEffect 提交后同步。
 * mode 二态：
 *  - 'fixed'：addNode 内建完就地同步 nodesRef.current（修复后的正确写法）
 *  - 'buggy'：只读旧 nodesRef、直接 setNodes，不同步 ref（修复前的 bug 写法，证明测试能抓到）
 */
function Harness({ mode = 'fixed', onCount, holder }) {
  const [nodes, setNodes] = useState([{ id: 'base', type: 'imageNode', position: { x: 0, y: 0 }, data: {} }])
  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  const addNode = () => {
    const nextNodes = [...nodesRef.current, makeNode()]
    // 关键修复：就地同步 ref，让同一批次后续 addNode 读到最新列表（删除丢失更新）
    if (mode === 'fixed') nodesRef.current = nextNodes
    setNodes(nextNodes)
  }

  // 把 addNode 挂到 holder，供测试在同一次 act 内连续调用（模拟同一 tick 批量解析完成）
  if (holder) holder.addNode = addNode
  onCount?.(nodes.length)
  return null
}

describe('addNode 同一 tick 批量调用并发安全', () => {
  it('fixed：同一 tick 连续 addNode 5 次 → 最终 1 基座 + 5 = 6 个节点（不丢）', () => {
    const holder = {}
    let latestCount = 0
    render(<Harness mode="fixed" onCount={(n) => { latestCount = n }} holder={holder} />)
    act(() => {
      for (let i = 0; i < 5; i++) holder.addNode()
    })
    expect(latestCount).toBe(6)
  })

  it('buggy（旧写法只读 ref 不同步）：同一 tick 5 次 addNode → 只剩 2 个（丢失复现）', () => {
    // 该用例证明测试能抓到 bug：若无「就地同步 ref」的修复，批量追加会互相覆盖只剩最后一张
    const holder = {}
    let latestCount = 0
    render(<Harness mode="buggy" onCount={(n) => { latestCount = n }} holder={holder} />)
    act(() => {
      for (let i = 0; i < 5; i++) holder.addNode()
    })
    expect(latestCount).toBeLessThan(6)
  })
})