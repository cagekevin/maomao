// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import JianyingIcon from '../../src/components/JianyingIcon.jsx'

describe('JianyingIcon', () => {
  it('渲染一个 svg 图标', () => {
    const { container } = render(<JianyingIcon />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('默认尺寸 14', () => {
    const { container } = render(<JianyingIcon />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('14')
    expect(svg.getAttribute('height')).toBe('14')
  })

  it('自定义尺寸生效', () => {
    const { container } = render(<JianyingIcon size={24} />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('24')
  })

  it('对屏幕阅读器隐藏（aria-hidden）', () => {
    const { container } = render(<JianyingIcon />)
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
  })
})
