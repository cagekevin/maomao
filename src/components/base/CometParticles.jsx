import React from 'react'

/**
 * 边粒子流光公共组件（彗星拖尾 + 辉光 + 发光头）。
 *
 * 抽离自 Comet.jsx / ConnectionLine.jsx 两处完全重复的视觉逻辑，统一维护：
 *  - 辉光 filter（feGaussianBlur 1.4 + feMerge）
 *  - 16 个拖尾圆点（半径 4.6→0.6，透明度 1→0.05，begin 逐点错开 18ms）
 *  - 1 个发光头（白 + 蓝双 drop-shadow）
 *
 * 纯 SVG，粒子沿 `<mpath>` 指向的 pathId 运动，dur 1.8s。
 *
 * @param props
 *  - pathId      要沿着的隐藏 <path id={pathId}> 的 id（粒子用 <mpath href=#pathId>）
 *  - uid         唯一标识（用于生成 filter id，避免多个实例冲突）
 *  - headRadius  发光头半径（Comet 用 3.4，ConnectionLine 用 3.6）
 */
export default function CometParticles({ pathId, uid, headRadius = 3.4 }) {
  const dur = '1.8s'
  const filterId = `cust-particles-filter-${uid}`

  // 16 个拖尾点：半径 4.6→0.6，透明度 1→0.05，begin 逐点错开 18ms
  const dots = []
  for (let e = 0; e < 16; e++) {
    const t = e / 15
    const r = 4.6 - t * 4
    const op = Math.max(0.05, 1 - t * 1.05)
    const begin = e * 18
    dots.push([r, op, begin])
  }

  return (
    <g aria-hidden={true}>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {dots.map(([r, op, begin], o) => (
          <circle r={r} fill="#ffffff" opacity={op} key={`${uid}-c-${o}`}>
            <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin={`-${begin}ms`}>
              <mpath xlinkHref={`#${pathId}`} />
            </animateMotion>
          </circle>
        ))}
      </g>
      {/* 头部主光点：白 + 蓝双 drop-shadow 发光 */}
      <circle
        r={headRadius}
        fill="#ffffff"
        opacity={1}
        style={{
          filter:
            'drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))'
        }}
      >
        <animateMotion dur={dur} repeatCount="indefinite" rotate="auto" begin="0s">
          <mpath xlinkHref={`#${pathId}`} />
        </animateMotion>
      </circle>
    </g>
  )
}
