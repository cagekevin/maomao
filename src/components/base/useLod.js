import { createContext, useContext } from 'react'

/**
 * LOD（Level of Detail）context 定义（复刻 _Component131.jsx 的 vr Provider）。
 *
 * 大画布性能降级的公共数据源：向节点/边提供当前视口缩放等级，
 * 消费端（如 ConnectionLine）据此关掉高耗能的粒子/辉光特效。
 *
 * 字段含义：
 *  - lodLevel            视口缩放等级 0/1/2/3（越大越缩小）
 *  - viewportMoving      视口是否在移动
 *  - nodeCount           当前节点数
 *  - handleFollowLimit   启用 handle 鼠标跟随的最大节点数
 *  - edgeFxLimit         启用边特效的最大边数
 *  - useThumbnail        是否用缩略图替代原图（性能模式）
 */

const DEFAULT_LOD = {
  lodLevel: 0,
  viewportMoving: false,
  nodeCount: 0,
  handleFollowLimit: 60,
  edgeFxLimit: 50,
  useThumbnail: false
}

export const LodContext = createContext(DEFAULT_LOD)

/**
 * 消费端 hook：读取当前 LOD 值。
 * 用法：const { lodLevel } = useLod()
 */
export function useLod() {
  return useContext(LodContext)
}
