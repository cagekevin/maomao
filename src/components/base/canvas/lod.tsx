import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from '@xyflow/react';

/**
 * LOD（Level of Detail）性能降级深模块（合并原 LodProvider / useLod / LodListener 三碎片）。
 *
 * 原三文件各只做一步：useLod.js 仅声明 context、LodProvider.jsx 仅把外部 value 透传、
 * LodListener.jsx 仅监听缩放并回调 level——调用方须自己串联「监听→state→注入」，属浅碎片。
 * 现合并为单一深模块：Provider 内部自带缩放监听，自动算 lodLevel 并注入 context，
 * 调用方只声明 enablePerformanceMode，零编排。
 *
 * 字段含义：
 *  - lodLevel            视口缩放等级 0/1/2/3（越大越缩小）
 *  - viewportMoving      视口是否在移动
 *  - nodeCount           当前节点数
 *  - handleFollowLimit   启用 handle 鼠标跟随的最大节点数
 *  - edgeFxLimit         启用边特效的最大边数
 *  - useThumbnail        是否用缩略图替代原图（性能模式）
 *
 * 消费端（如 ConnectionLine / useMediaDegrade）用 useLod() 读 lodLevel 据此关特效。
 * 降级 CSS 契约：给 .react-flow 容器加 lod-1/2/3 / zoomed-out-lod class（index.css 依赖，勿改）。
 */

// 阈值集中为命名常量（CONTEXT §一.C 配置集中，消除裸数字 60/50）
const LOD_LIMITS = { handleFollow: 60, edgeFx: 50 };

const DEFAULT_LOD = {
  lodLevel: 0,
  viewportMoving: false,
  nodeCount: 0,
  handleFollowLimit: LOD_LIMITS.handleFollow,
  edgeFxLimit: LOD_LIMITS.edgeFx,
  useThumbnail: false,
};

export const LodContext = createContext(DEFAULT_LOD);

/**
 * 消费端 hook：读取当前 LOD 值。
 * 用法：const { lodLevel } = useLod()
 */
export function useLod() {
  return useContext(LodContext);
}

/**
 * LOD Provider（深模块）：内部监听 ReactFlow 视口缩放，自动算 lodLevel 并注入 context。
 *
 * @param props
 *  - enablePerformanceMode 默认 true；false 时清空 lod class 并令 lodLevel=0（关性能模式天然关闭降级）
 *  - nodeCount 当前节点数（可选，供消费端判断，默认 0）
 *  - children
 */
export default function LodProvider({ enablePerformanceMode = true, nodeCount = 0, children }) {
  // 监听 viewport.transform[2]（缩放值）的变化
  const zoom = useStore((s) => s.transform?.[2] ?? 1);
  const [lodLevel, setLodLevel] = useState(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const container = document.querySelector('.react-flow');

    if (!enablePerformanceMode) {
      if (lastRef.current !== 0) {
        lastRef.current = 0;
        setLodLevel(0);
        container?.classList.remove('lod-1', 'lod-2', 'lod-3', 'zoomed-out-lod');
      }
      return;
    }

    // 计算 lodLevel（复刻 H_.jsx:11548）：zoom<=0.2→3，<=0.3→2，<=0.5→1，否则 0
    const level = zoom <= 0.2 ? 3 : zoom <= 0.3 ? 2 : zoom <= 0.5 ? 1 : 0;
    if (level === lastRef.current) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      container?.classList.remove('lod-1', 'lod-2', 'lod-3', 'zoomed-out-lod');
      if (level >= 1) container?.classList.add('lod-1');
      if (level >= 2) container?.classList.add('lod-2');
      if (level >= 3) {
        container?.classList.add('lod-3');
        container?.classList.add('zoomed-out-lod');
      }
      lastRef.current = level;
      setLodLevel(level);
    });
  }, [zoom, enablePerformanceMode]);

  const v = {
    lodLevel,
    viewportMoving: false,
    nodeCount,
    handleFollowLimit: LOD_LIMITS.handleFollow,
    edgeFxLimit: LOD_LIMITS.edgeFx,
    useThumbnail: false,
  };
  const memoValue = React.useMemo(
    () => v,
    [v.lodLevel, v.viewportMoving, v.nodeCount, v.handleFollowLimit, v.edgeFxLimit, v.useThumbnail],
  );
  return <LodContext.Provider value={memoValue}>{children}</LodContext.Provider>;
}
