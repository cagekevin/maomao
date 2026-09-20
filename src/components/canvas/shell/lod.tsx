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
 *  - lodLevel  视口缩放等级 0/1/2/3（越大越缩小）—— **唯一真实字段**
 *
 * 【TD-04-22 清理】原 context 还声明了 viewportMoving / nodeCount / handleFollowLimit /
 * edgeFxLimit / useThumbnail 五个字段：前四者恒为常量或零消费端读取，useThumbnail 恒 false——
 * 它们只是「当年以为要做、后来没做」的占位，而测试还在断言其存在（= 给假实现背书）。
 * 已连同 `LOD_LIMITS` 常量与 LodProvider 的 `nodeCount` prop 一并删除。
 * **若将来真要做「handle 跟随上限 / 边特效上限 / 缩略图降级」，请新写实现并同时接上消费端**，
 * 而不是复活这些空字段（否则又是一轮「声明了但没实现」）。
 *
 * 消费端（如 ConnectionLine / useAssetDegrade）用 useLod() 读 lodLevel 据此关特效。
 * 降级 CSS 契约：给 .react-flow 容器加 lod-1/2/3 / zoomed-out-lod class（index.css 依赖，勿改）。
 */

const DEFAULT_LOD = { lodLevel: 0 };

export const LodContext = createContext(DEFAULT_LOD);

/**
 * 消费端 hook：读取当前 LOD 值。
 * 用法：const { lodLevel } = useLod()
 */
export function useLod() {
  return useContext(LodContext);
}

/** LodProvider props */
export interface LodProviderProps {
  /** 性能模式开关（默认 true）；false 时清空 lod class 并令 lodLevel=0（关性能模式天然关闭降级） */
  enablePerformanceMode?: boolean;
  children: React.ReactNode;
}

/**
 * LOD Provider（深模块）：内部监听 ReactFlow 视口缩放，自动算 lodLevel 并注入 context。
 *
 * @param props 见 LodProviderProps
 */
export default function LodProvider({ enablePerformanceMode = true, children }: LodProviderProps) {
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

    // 计算 lodLevel：zoom<=0.2→3，<=0.3→2，<=0.5→1，否则 0
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

  const memoValue = React.useMemo(() => ({ lodLevel }), [lodLevel]);
  return <LodContext.Provider value={memoValue}>{children}</LodContext.Provider>;
}
