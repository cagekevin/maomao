/**
 * M4-A + M4-B 画布面板 — React Flow 画布容器
 * 严格按照原版 App.js 配置
 * nodeTypes 注册 27 种类型（对齐原版 App.js L31046-31074）
 *
 * 集成：
 * - ContextMenu 右键菜单（画布/连线/单节点/多选节点）
 * - useCanvasShortcuts 快捷键系统（Q/W/E/Ctrl+Z/Y/C/V）
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type OnConnect,
  type Connection,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import type { AppNode } from '../types';
import '@xyflow/react/dist/style.css';

// 导入已有节点组件
import GroupNode from '../nodes/GroupNode';
import ImageNode from '../nodes/ImageNode';
import PromptNode from '../nodes/PromptNode';
import TextNode from '../nodes/TextNode';
import CropNode from '../nodes/CropNode';
import GridSplitNode from '../nodes/GridSplitNode';
import GridMergeNode from '../nodes/GridMergeNode';
import VideoNode from '../nodes/VideoNode';
import CustomNode from '../nodes/CustomNode';
import VideoExtractNode from '../nodes/VideoExtractNode';
import UrlToImageNode from '../nodes/UrlToImageNode';
import FileToUrlNode from '../nodes/FileToUrlNode';
import PanoramaNode from '../nodes/PanoramaNode';
import ImageBoxNode from '../nodes/ImageBoxNode';
import StickyNoteNode from '../nodes/StickyNoteNode';
import Sd2VideoNode from '../nodes/Sd2VideoNode';
import DiscountVideoNode from '../nodes/DiscountVideoNode';
import AudioNode from '../nodes/AudioNode';
import AudioPlayerNode from '../nodes/AudioPlayerNode';
import VideoToGifNode from '../nodes/VideoToGifNode';
import ImageCompressNode from '../nodes/ImageCompressNode';
import FaceMosaicNode from '../nodes/FaceMosaicNode';
import CompareNode from '../nodes/CompareNode';
import TextConcatNode from '../nodes/TextConcatNode';
import RhWebappNode from '../nodes/RhWebappNode';
import Director3dNode from '../nodes/Director3dNode';
import GhostTarget from '../nodes/GhostTarget';

// 导入右键菜单和快捷键
import ContextMenu, {
  type ContextMenuState,
  buildCanvasMenuItems,
  buildSingleNodeMenuItems,
  buildMultiSelectMenuItems,
} from './ContextMenu';
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts';

// nodeTypes 注册表（27种，对齐原版 App.js L31046-31074）
const nodeTypes: NodeTypes = {
  group: GroupNode,
  imageNode: ImageNode,
  promptNode: PromptNode,
  textNode: TextNode,
  cropNode: CropNode,
  gridSplitNode: GridSplitNode,
  gridMergeNode: GridMergeNode,
  videoNode: VideoNode,
  sd2VideoNode: Sd2VideoNode,
  discountVideoNode: DiscountVideoNode,
  audioNode: AudioNode,
  audioPlayerNode: AudioPlayerNode,
  customNode: CustomNode,
  rhWebappNode: RhWebappNode,
  videoExtractNode: VideoExtractNode,
  videoToGifNode: VideoToGifNode,
  imageCompressNode: ImageCompressNode,
  faceMosaicNode: FaceMosaicNode,
  compareNode: CompareNode,
  textConcatNode: TextConcatNode,
  urlToImageNode: UrlToImageNode,
  fileToUrlNode: FileToUrlNode,
  panoramaNode: PanoramaNode,
  director3dNode: Director3dNode,
  imageBoxNode: ImageBoxNode,
  stickyNoteNode: StickyNoteNode,
  ghostTarget: GhostTarget,
};

// ====== 节点类型到默认数据的映射 ======

const NODE_TYPE_DEFAULTS: Record<string, Partial<AppNode['data']>> = {
  textNode: { label: '文本' },
  promptNode: { label: '图片' },
  discountVideoNode: { label: '视频' },
  rhWebappNode: { label: 'AI应用' },
  textConcatNode: { label: '文本拼接' },
  audioNode: { label: '听音断句' },
  imageBoxNode: { label: '图片盒子' },
  gridSplitNode: { label: '图片切分', rows: 2, cols: 2 },
  gridMergeNode: { label: '图片拼图' },
  panoramaNode: { label: '全景图' },
  cropNode: { label: '裁剪' },
  director3dNode: { label: '3D导演台' },
  imageCompressNode: { label: '图片压缩' },
  faceMosaicNode: { label: '人脸打码' },
  compareNode: { label: '对比工具' },
  urlToImageNode: { label: '网址转图片' },
  videoNode: { label: '其他视频' },
  videoExtractNode: { label: '视频抽帧' },
  videoToGifNode: { label: '视频转GIF' },
  customNode: { label: '万能节点' },
  stickyNoteNode: { label: '便签' },
  fileToUrlNode: { label: '文件转链接' },
};

function CanvasPanelInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // ====== 右键菜单状态 ======
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });

  // 记录右键点击位置（flow 坐标），用于在该位置创建节点
  const contextMenuFlowPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // ====== 节点创建 ======

  const addNodeAtPosition = useCallback(
    (nodeType: string, position: { x: number; y: number }) => {
      const id = `${nodeType}-${Date.now()}`;
      const defaultData = NODE_TYPE_DEFAULTS[nodeType] || { label: nodeType };
      const newNode: AppNode = {
        id,
        type: nodeType,
        position,
        data: { ...defaultData },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // ====== 画布右键菜单处理 ======

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();

      // 将屏幕坐标转换为 flow 坐标，用于后续创建节点
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      contextMenuFlowPos.current = flowPos;

      const items = buildCanvasMenuItems({
        onAddNode: (nodeType: string) => {
          addNodeAtPosition(nodeType, flowPos);
        },
        onUpload: () => {
          // TODO: 打开文件选择器
          console.log('[ContextMenu] 上传');
        },
        onOpenTemplates: () => {
          // TODO: 打开模板库
          console.log('[ContextMenu] 模板库');
        },
        onImport: () => {
          // TODO: 打开资源导入面板
          console.log('[ContextMenu] 导入');
        },
      });

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        items,
      });
    },
    [screenToFlowPosition, addNodeAtPosition],
  );

  // ====== 连线右键菜单处理 ======

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();

      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      contextMenuFlowPos.current = flowPos;

      // 连线右键显示与画布相同的创建菜单
      const items = buildCanvasMenuItems({
        onAddNode: (nodeType: string) => {
          addNodeAtPosition(nodeType, flowPos);
        },
        onUpload: () => {
          console.log('[ContextMenu] 上传');
        },
        onOpenTemplates: () => {
          console.log('[ContextMenu] 模板库');
        },
        onImport: () => {
          console.log('[ContextMenu] 导入');
        },
      });

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        items,
      });
    },
    [screenToFlowPosition, addNodeAtPosition],
  );

  // ====== 节点右键菜单处理 ======

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      event.stopPropagation();

      // 获取选中的节点
      const selectedNodes = nodes.filter((n) => n.selected);
      const isMultiSelect = selectedNodes.length > 1;

      let items;
      if (isMultiSelect) {
        // 多选节点菜单
        items = buildMultiSelectMenuItems({
          onCopy: () => console.log('[ContextMenu] 多选复制'),
          onGroup: () => console.log('[ContextMenu] 组合'),
          onCreateTemplate: () => console.log('[ContextMenu] 创建模板'),
          onMultiConnect: () => console.log('[ContextMenu] 多项连接'),
          onMergeToImageBox: () => console.log('[ContextMenu] 合并为图片盒子'),
          onDelete: () => {
            const ids = new Set(selectedNodes.map((n) => n.id));
            setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
            setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
          },
        });
      } else {
        // 单节点菜单
        items = buildSingleNodeMenuItems({
          onUngroup: () => console.log('[ContextMenu] 取消编组'),
          onRunSequentially: () => console.log('[ContextMenu] 依次运行'),
          onCopy: () => console.log('[ContextMenu] 复制'),
          onCopyImage: () => console.log('[ContextMenu] 复制图片'),
          onSplitImage: () => console.log('[ContextMenu] 图片切分'),
          onDelete: () => {
            setNodes((nds) => nds.filter((n) => n.id !== node.id));
            setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
          },
        });
      }

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        items,
      });
    },
    [nodes, setNodes, setEdges],
  );

  // ====== 快捷键回调 ======

  const handleShortcutAddNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      addNodeAtPosition(type, position);
    },
    [addNodeAtPosition],
  );

  const handleCopy = useCallback(() => {
    console.log('[Shortcut] Ctrl+C 复制');
  }, []);

  const handlePaste = useCallback(() => {
    console.log('[Shortcut] Ctrl+V 粘贴');
  }, []);

  const handleUndo = useCallback(() => {
    console.log('[Shortcut] Ctrl+Z 撤销');
  }, []);

  const handleRedo = useCallback(() => {
    console.log('[Shortcut] Ctrl+Y 重做');
  }, []);

  // 挂载快捷键 hook
  useCanvasShortcuts({
    onAddNode: handleShortcutAddNode,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onUndo: handleUndo,
    onRedo: handleRedo,
    enabled: true,
  });

  // ====== 其他事件 ======

  const onConnect = useCallback<OnConnect>((connection: Connection) => {
    setEdges((eds) => [...eds, { ...connection, id: `edge-${Date.now()}`, type: 'default' }]);
  }, [setEdges]);

  const onEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
  }, [setEdges]);

  // 拖放上传
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // 暂不实现拖放逻辑
  }, []);

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneContextMenu={handlePaneContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        connectionRadius={60}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
        minZoom={0.05}
        maxZoom={4}
        nodeOrigin={[0, 0]}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect={false}
        onlyRenderVisibleElements={nodes.length > 20}
        nodesDraggable={true}
        nodesConnectable={true}
        selectionOnDrag={nodes.length <= 80}
        panOnDrag={true}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0d0c0c]"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* 右键菜单（Portal 渲染到 document.body） */}
      <ContextMenu state={contextMenu} onClose={closeContextMenu} />
    </div>
  );
}

export default function CanvasPanel() {
  return (
    <ReactFlowProvider>
      <CanvasPanelInner />
    </ReactFlowProvider>
  );
}
