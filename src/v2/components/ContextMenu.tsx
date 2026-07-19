/**
 * 右键菜单组件
 * 严格按照原版 App.js L37279-37710 的菜单结构
 * 支持画布/连线右键、单节点右键、多选节点右键三种场景
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

// ====== 类型定义 ======

export interface MenuItem {
  label?: string;
  action?: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
  separator?: boolean;
  submenu?: MenuItem[];
  nodeType?: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: MenuItem[];
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
}

// ====== 子菜单组件 ======

interface SubMenuProps {
  items: MenuItem[];
  parentRect: DOMRect;
  onClose: () => void;
}

function SubMenu({ items, parentRect, onClose }: SubMenuProps) {
  const subRef = useRef<HTMLDivElement>(null);

  // 子菜单定位：在父菜单项右侧
  const subStyle = useMemo(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const subWidth = 200;
    const subHeight = items.length * 36;

    let left = parentRect.right;
    // 如果超出右侧，向左展开（放在父菜单左侧）
    if (left + subWidth > vw) {
      left = parentRect.left - subWidth;
    }

    let top = parentRect.top;
    // 如果超出底部，向上偏移
    if (top + subHeight > vh) {
      top = vh - subHeight - 8;
    }
    if (top < 8) top = 8;

    return { left, top };
  }, [parentRect, items.length]);

  return (
    <div
      ref={subRef}
      className="fixed bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl py-1 min-w-[180px] z-[10001]"
      style={{ left: subStyle.left, top: subStyle.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <MenuItemComponent key={index} item={item} onClose={onClose} />
      ))}
    </div>
  );
}

// ====== 菜单项组件 ======

interface MenuItemComponentProps {
  item: MenuItem;
  onClose: () => void;
}

function MenuItemComponent({ item, onClose }: MenuItemComponentProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [showSubmenu, setShowSubmenu] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (item.submenu) {
      setShowSubmenu(true);
    }
  }, [item.submenu]);

  const handleMouseLeave = useCallback(() => {
    if (item.submenu) {
      timeoutRef.current = setTimeout(() => setShowSubmenu(false), 150);
    }
  }, [item.submenu]);

  const handleClick = useCallback(() => {
    if (item.submenu) return; // 有子菜单时不触发点击
    if (item.action) {
      item.action();
    }
    onClose();
  }, [item, onClose]);

  // 分隔线
  if (item.separator) {
    return <div className="my-1 border-t border-[#333]" />;
  }

  return (
    <div className="relative">
      <div
        ref={itemRef}
        className="px-3 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white cursor-pointer flex items-center justify-between"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="flex items-center gap-2">
          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
          {item.label}
        </span>
        <span className="flex items-center gap-2">
          {item.shortcut && (
            <span className="text-xs text-gray-500 ml-4">{item.shortcut}</span>
          )}
          {item.submenu && (
            <svg
              className="w-3 h-3 text-gray-500 ml-1"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 2l4 4-4 4" />
            </svg>
          )}
        </span>
      </div>
      {showSubmenu && item.submenu && itemRef.current && (
        <SubMenu
          items={item.submenu}
          parentRect={itemRef.current.getBoundingClientRect()}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ====== 主右键菜单组件 ======

const ContextMenu: React.FC<ContextMenuProps> = ({ state, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 边界检测：计算菜单实际位置
  const menuPosition = useMemo(() => {
    if (!state.visible) return { left: 0, top: 0 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuWidth = 200;
    const menuHeight = Math.min(state.items.length * 36, vh - 16);

    let left = state.x;
    let top = state.y;

    // 超出右侧，向左展开
    if (left + menuWidth > vw) {
      left = vw - menuWidth - 8;
    }
    // 超出底部，向上展开
    if (top + menuHeight > vh) {
      top = vh - menuHeight - 8;
    }
    // 确保不超出顶部
    if (top < 8) top = 8;
    // 确保不超出左侧
    if (left < 8) left = 8;

    return { left, top };
  }, [state.visible, state.x, state.y, state.items]);

  // 点击外部关闭
  useEffect(() => {
    if (!state.visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 使用 mousedown 以便在 contextmenu 事件之前捕获
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [state.visible, onClose]);

  // ESC 键关闭
  useEffect(() => {
    if (!state.visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.visible, onClose]);

  if (!state.visible) return null;

  const menuContent = (
    <div
      ref={menuRef}
      className="bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl py-1 min-w-[180px] z-[10000]"
      style={{
        position: 'fixed',
        left: menuPosition.left,
        top: menuPosition.top,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      {state.items.map((item, index) => (
        <MenuItemComponent key={index} item={item} onClose={onClose} />
      ))}
    </div>
  );

  // 使用 Portal 渲染到 document.body
  return createPortal(menuContent, document.body);
};

// ====== 菜单构建工具函数 ======

/** 创建画布/连线右键菜单项 */
export function buildCanvasMenuItems(options: {
  onAddNode: (nodeType: string) => void;
  onUpload: () => void;
  onOpenTemplates: () => void;
  onImport: () => void;
}): MenuItem[] {
  const { onAddNode, onUpload, onOpenTemplates, onImport } = options;

  return [
    { label: '文本', shortcut: 'Q', nodeType: 'textNode', action: () => onAddNode('textNode') },
    { label: '图片', shortcut: 'W', nodeType: 'promptNode', action: () => onAddNode('promptNode') },
    { label: '视频', shortcut: 'E', nodeType: 'discountVideoNode', action: () => onAddNode('discountVideoNode') },
    { label: 'AI应用', nodeType: 'rhWebappNode', action: () => onAddNode('rhWebappNode') },
    { separator: true },
    {
      label: '小工具',
      submenu: [
        {
          label: '文本工具',
          submenu: [
            { label: '文本拼接', nodeType: 'textConcatNode', action: () => onAddNode('textConcatNode') },
            { label: '听音断句', nodeType: 'audioNode', action: () => onAddNode('audioNode') },
          ],
        },
        {
          label: '图片工具',
          submenu: [
            { label: '图片盒子', nodeType: 'imageBoxNode', action: () => onAddNode('imageBoxNode') },
            { label: '图片切分', nodeType: 'gridSplitNode', action: () => onAddNode('gridSplitNode') },
            { label: '图片拼图', nodeType: 'gridMergeNode', action: () => onAddNode('gridMergeNode') },
            { label: '全景图', nodeType: 'panoramaNode', action: () => onAddNode('panoramaNode') },
            { label: '裁剪', nodeType: 'cropNode', action: () => onAddNode('cropNode') },
            { label: '3D导演台', nodeType: 'director3dNode', action: () => onAddNode('director3dNode') },
            { label: '图片压缩', nodeType: 'imageCompressNode', action: () => onAddNode('imageCompressNode') },
            { label: '人脸打码', nodeType: 'faceMosaicNode', action: () => onAddNode('faceMosaicNode') },
            { label: '对比工具', nodeType: 'compareNode', action: () => onAddNode('compareNode') },
            { label: '网址转图片', nodeType: 'urlToImageNode', action: () => onAddNode('urlToImageNode') },
          ],
        },
        {
          label: '视频工具',
          submenu: [
            { label: '其他视频', nodeType: 'videoNode', action: () => onAddNode('videoNode') },
            { label: '视频抽帧', nodeType: 'videoExtractNode', action: () => onAddNode('videoExtractNode') },
            { label: '视频转GIF', nodeType: 'videoToGifNode', action: () => onAddNode('videoToGifNode') },
          ],
        },
        {
          label: '其他工具',
          submenu: [
            { label: '万能节点', nodeType: 'customNode', action: () => onAddNode('customNode') },
            { label: '便签', nodeType: 'stickyNoteNode', action: () => onAddNode('stickyNoteNode') },
            { label: '文件转链接', nodeType: 'fileToUrlNode', action: () => onAddNode('fileToUrlNode') },
          ],
        },
      ],
    },
    { separator: true },
    { label: '上传', action: onUpload },
    { label: '模板库', action: onOpenTemplates },
    { label: '导入', action: onImport },
  ];
}

/** 创建单节点右键菜单项 */
export function buildSingleNodeMenuItems(options: {
  onUngroup: () => void;
  onRunSequentially: () => void;
  onCopy: () => void;
  onCopyImage: () => void;
  onSplitImage: () => void;
  onDelete: () => void;
}): MenuItem[] {
  const { onUngroup, onRunSequentially, onCopy, onCopyImage, onSplitImage, onDelete } = options;

  return [
    { label: '取消编组', action: onUngroup },
    { label: '依次运行', action: onRunSequentially },
    { separator: true },
    { label: '复制', shortcut: 'Ctrl+C', action: onCopy },
    { label: '复制图片', action: onCopyImage },
    { label: '图片切分', action: onSplitImage },
    { separator: true },
    { label: '删除', shortcut: 'Del', action: onDelete },
  ];
}

/** 创建多选节点右键菜单项 */
export function buildMultiSelectMenuItems(options: {
  onCopy: () => void;
  onGroup: () => void;
  onCreateTemplate: () => void;
  onMultiConnect: () => void;
  onMergeToImageBox: () => void;
  onDelete: () => void;
}): MenuItem[] {
  const { onCopy, onGroup, onCreateTemplate, onMultiConnect, onMergeToImageBox, onDelete } = options;

  return [
    { label: '复制', shortcut: 'Ctrl+C', action: onCopy },
    { label: '组合', action: onGroup },
    { label: '创建模板', action: onCreateTemplate },
    { label: '多项连接', action: onMultiConnect },
    { label: '合并为图片盒子', action: onMergeToImageBox },
    { separator: true },
    { label: '删除', shortcut: 'Del', action: onDelete },
  ];
}

export default ContextMenu;
