// ============================================================
// StickyNoteNode - 便签节点
// 严格 1:1 复刻原版 App.js Uh 函数
// ============================================================
import { memo, useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import type { AppNode } from '../types';

// ====== 常量数据 ======

const BG_COLORS = [
  { name: `暗黄`, value: `rgba(180,160,60,0.25)` },
  { name: `暗绿`, value: `rgba(60,160,80,0.2)` },
  { name: `暗蓝`, value: `rgba(60,120,200,0.2)` },
  { name: `暗红`, value: `rgba(200,60,60,0.2)` },
  { name: `暗紫`, value: `rgba(140,80,200,0.2)` },
  { name: `深灰`, value: `rgba(100,100,100,0.25)` },
  { name: `透明`, value: `transparent` },
];

const TEXT_COLORS = [
  { name: `白`, value: `#ffffffea` },
  { name: `浅灰`, value: `#cccccccc` },
  { name: `黄`, value: `#ffe650f2` },
  { name: `红`, value: `#ff6464e6` },
  { name: `绿`, value: `#64dc78e6` },
  { name: `蓝`, value: `#64b4ffe6` },
  { name: `橙`, value: `#ffb43ce6` },
  { name: `紫`, value: `#b482ffe6` },
];

const FONT_SIZES = [10, 12, 14, 18, 24, 32, 48, 64, 80, 96, 128];

const EMOJIS = [
  `➡️`, `⬅️`, `⬆️`, `⬇️`, `↗️`, `↘️`, `✅`, `❌`, `⭐`, `💡`, `🔥`, `📌`, `⚡`, `🎯`, `👇`, `👆`, `🔴`, `🟢`, `🔵`, `🟡`, `⚠️`, `❗`, `📍`, `🏷️`,
];

// ====== 工具函数 ======

// TODO: implement - 从背景色计算左边框高亮色
function getBorderColor(bgColor: string): string {
  if (bgColor === `transparent`) return `transparent`;
  let m = bgColor.match(/rgba?\((\d+),(\d+),(\d+)/);
  if (!m) return `#888`;
  let [, r, g, b] = m.map(Number);
  return `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},0.7)`;
}

// TODO: implement - 纯文本转 HTML（转义 + 换行）
function escapeHtml(text: string): string {
  return text.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(/\n/g, `<br>`);
}

// ====== 组件 ======

function StickyNoteNode({ id, data }: NodeProps<AppNode>) {
  let d = data;
  let { updateNodeData } = useReactFlow();

  let [html, setHtml] = useState(d.html ?? (d.text ? escapeHtml(d.text as string) : ``));
  let [fontSize, setFontSize] = useState(d.fontSize ?? 24);
  let [bold, setBold] = useState(d.bold ?? false);
  let [color, setColor] = useState(d.color ?? TEXT_COLORS[0].value);
  let [bgColor, setBgColor] = useState(d.bgColor ?? BG_COLORS[0].value);
  let [width, setWidth] = useState(d.width ?? 400);
  let [height, setHeight] = useState(d.height ?? 400);
  let [editing, setEditing] = useState(false);
  let [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  let [showEmojiPicker, setShowEmojiPicker] = useState(false);
  let [showBgPicker, setShowBgPicker] = useState(false);

  let editorRef = useRef<HTMLDivElement>(null);
  let dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  let syncData = useCallback(
    (patch: Record<string, unknown>) => {
      updateNodeData(id, patch);
    },
    [id, updateNodeData]
  );

  useEffect(() => {
    syncData({
      html,
      fontSize,
      bold,
      color,
      bgColor,
      width,
      height,
    });
  }, [html, fontSize, bold, color, bgColor, width, height, syncData]);

  let isTransparent = bgColor === `transparent`;
  let borderColor = getBorderColor(bgColor);

  let startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => {
      let el = editorRef.current;
      if (el) {
        el.innerHTML = html;
        el.focus();
        let range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        let sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 50);
  };

  let finishEditing = () => {
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
    setEditing(false);
    setContextMenu(null);
    setShowEmojiPicker(false);
    setShowBgPicker(false);
  };

  let onBlur = () => {
    finishEditing();
  };

  let onContextMenu = (e: React.MouseEvent) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    let rect = (e.currentTarget as HTMLElement).closest(`.react-flow__node`)?.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    });
  };

  let syncEditorHtml = () => {
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
  };

  let hasSelection = (): boolean => {
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    let el = editorRef.current;
    return el ? el.contains(sel.anchorNode) && el.contains(sel.focusNode) : false;
  };

  let applyStyleToSelection = (style: React.CSSProperties) => {
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    let range = sel.getRangeAt(0);
    let span = document.createElement(`span`);
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      let contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    let newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
    syncEditorHtml();
  };

  let applyFontSize = (size: number) => {
    if (editing && hasSelection()) {
      applyStyleToSelection({ fontSize: `${size}px` });
    } else {
      setFontSize(size);
    }
    setContextMenu(null);
  };

  let applyColor = (c: string) => {
    if (editing && hasSelection()) {
      applyStyleToSelection({ color: c });
    } else {
      setColor(c);
    }
    setContextMenu(null);
  };

  let toggleBold = () => {
    if (editing && hasSelection()) {
      applyStyleToSelection({ fontWeight: `700` });
    } else {
      setBold((prev: boolean) => !prev);
    }
    setContextMenu(null);
  };

  let adjustFontSize = (delta: number) => {
    let idx = FONT_SIZES.indexOf(fontSize);
    let n = idx === -1 ? FONT_SIZES.findIndex((s) => s >= fontSize) : idx;
    applyFontSize(FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, (n === -1 ? FONT_SIZES.length - 1 : n) + delta))]);
  };

  let insertEmoji = (emoji: string) => {
    let el = editorRef.current;
    if (el) {
      el.focus();
      document.execCommand(`insertText`, false, emoji);
      syncEditorHtml();
    }
    setShowEmojiPicker(false);
  };

  let onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
    };
    let onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      let newW = Math.max(200, dragRef.current.startW + ev.clientX - dragRef.current.startX);
      let newH = Math.max(150, dragRef.current.startH + ev.clientY - dragRef.current.startY);
      setWidth(newW);
      setHeight(newH);
    };
    let onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener(`mousemove`, onMouseMove);
      window.removeEventListener(`mouseup`, onMouseUp);
    };
    window.addEventListener(`mousemove`, onMouseMove);
    window.addEventListener(`mouseup`, onMouseUp);
  };

  let lineHeight = (fontSize: number): number => {
    return fontSize >= 96 ? 1.08 : fontSize >= 64 ? 1.12 : fontSize >= 32 ? 1.16 : fontSize >= 18 ? 1.22 : 1.28;
  };

  let textStyle: React.CSSProperties = {
    fontSize,
    color,
    fontWeight: bold ? 700 : 400,
    lineHeight: lineHeight(fontSize),
  };

  return (
    <Fragment>
      <style>{`.sticky-editor:empty:before{content:attr(data-placeholder);color:#666;pointer-events:none;}`}</style>
      <div
        className={`relative group/sticky select-none ${editing ? `nodrag nopan nowheel` : ``}`}
        style={{
          width,
          minHeight: height,
          background: bgColor,
          borderRadius: isTransparent ? 0 : 8,
          padding: isTransparent ? `4px 0` : `16px 20px`,
          borderLeft: isTransparent ? `none` : `4px solid ${borderColor}`,
        }}
        onDoubleClick={startEditing}
        onClick={() => {
          setContextMenu(null);
        }}
        onContextMenu={onContextMenu}
      >
        {!editing && (
          <div
            className={`w-full whitespace-pre-wrap break-words`}
            style={{
              ...textStyle,
              minHeight: 60,
              cursor: `grab`,
            }}
          >
            {html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <span style={{ color: `#666` }}>双击编辑...</span>
            )}
          </div>
        )}

        {editing && (
          <Fragment>
            <div
              ref={editorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              className={`sticky-editor w-full bg-transparent border-none outline-none whitespace-pre-wrap break-words nopan nowheel nodrag`}
              style={{
                ...textStyle,
                minHeight: Math.max(100, height - 80),
                overflow: `hidden`,
              }}
              onInput={syncEditorHtml}
              onBlur={onBlur}
              onKeyDown={(e) => {
                e.key === `Escape` && finishEditing();
              }}
              data-placeholder={`输入内容...`}
            />
            <div
              className={`flex items-center gap-2 mt-2 pt-2 border-t border-white/10 nodrag nopan`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* 背景色选择按钮 */}
              <div className={`relative`}>
                <button
                  className={`w-6 h-6 rounded border border-white/20 cursor-pointer`}
                  style={{
                    background: isTransparent
                      ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px`
                      : bgColor,
                  }}
                  onClick={() => {
                    setShowBgPicker(!showBgPicker);
                    setShowEmojiPicker(false);
                  }}
                  title={`便签底色`}
                />
                {showBgPicker && (
                  <div
                    className={`absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 flex gap-1.5 shadow-xl`}
                  >
                    {BG_COLORS.map((c) => (
                      <button
                        key={c.name}
                        className={`w-6 h-6 rounded border transition-all cursor-pointer ${bgColor === c.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`}
                        style={{
                          background:
                            c.value === `transparent`
                              ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px`
                              : c.value,
                        }}
                        onClick={() => {
                          setBgColor(c.value);
                          setShowBgPicker(false);
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Emoji 选择按钮 */}
              <div className={`relative`}>
                <button
                  className={`text-sm px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 cursor-pointer`}
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowBgPicker(false);
                  }}
                >
                  😀
                </button>
                {showEmojiPicker && (
                  <div
                    className={`absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 grid grid-cols-6 gap-1 w-[180px] shadow-xl`}
                  >
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        className={`text-base w-7 h-7 flex items-center justify-center rounded hover:bg-[#444] cursor-pointer`}
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 加粗按钮 */}
              <button
                className={`w-7 h-7 rounded font-bold cursor-pointer transition-colors ${bold ? `bg-white/20 text-white` : `bg-white/5 text-gray-400 hover:bg-white/10`}`}
                onClick={toggleBold}
                title={`加粗（选中文字则只改选中部分）`}
              >
                B
              </button>

              {/* 字号调节 */}
              <div className={`flex items-center gap-0.5`}>
                <button
                  className={`w-6 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-xs cursor-pointer`}
                  onClick={() => adjustFontSize(-1)}
                  title={`减小字号`}
                >
                  A-
                </button>
                <button
                  className={`w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-sm cursor-pointer`}
                  onClick={() => adjustFontSize(1)}
                  title={`增大字号`}
                >
                  A+
                </button>
              </div>

              {/* 文字颜色快选 */}
              <div className={`flex items-center gap-0.5 ml-1`}>
                {TEXT_COLORS.slice(0, 5).map((c) => (
                  <button
                    key={c.name}
                    className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${color === c.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`}
                    style={{ background: c.value }}
                    onClick={() => applyColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </Fragment>
        )}

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            className={`absolute z-[9999] bg-[#222]/95 backdrop-blur border border-[#444] rounded-xl shadow-2xl p-2 min-w-[160px] nodrag nopan`}
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className={`text-[10px] text-gray-500 px-2 mb-1`}>文字（选中后仅改选中部分）</div>
            <div className={`flex items-center gap-1 px-2 mb-2`}>
              <button
                className={`w-6 h-6 rounded font-bold text-xs cursor-pointer ${bold ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`}
                onClick={toggleBold}
                title={`加粗`}
              >
                B
              </button>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${color === c.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`}
                  style={{ background: c.value }}
                  onClick={() => applyColor(c.value)}
                  title={c.name}
                />
              ))}
            </div>
            <div className={`text-[10px] text-gray-500 px-2 mb-1`}>字号</div>
            <div className={`flex items-center gap-1 px-2 flex-wrap mb-2`}>
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${fontSize === size ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`}
                  onClick={() => applyFontSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className={`h-px bg-[#444] my-1.5`} />
            <div className={`text-[10px] text-gray-500 px-2 mb-1`}>便签底色</div>
            <div className={`flex items-center gap-1 px-2`}>
              {BG_COLORS.map((c) => (
                <button
                  key={c.name}
                  className={`w-5 h-5 rounded border transition-all cursor-pointer ${bgColor === c.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`}
                  style={{
                    background:
                      c.value === `transparent`
                        ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px`
                        : c.value,
                  }}
                  onClick={() => {
                    setBgColor(c.value);
                    setContextMenu(null);
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* 右下角拖拽调整大小手柄 */}
        <div
          className={`absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/sticky:opacity-60 transition-opacity nodrag`}
          onMouseDown={onResizeMouseDown}
          title={`拖拽调整大小`}
        >
          <svg width={`16`} height={`16`} viewBox={`0 0 16 16`} fill={`none`}>
            <path
              d={`M14 2L2 14M14 6L6 14M14 10L10 14`}
              stroke={`#888`}
              strokeWidth={`1.5`}
              strokeLinecap={`round`}
            />
          </svg>
        </div>
      </div>
    </Fragment>
  );
}

export default memo(StickyNoteNode);