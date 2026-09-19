/**
 * PromptPresetView —— 创作库「我的提示词」分区（第 5 分区）。
 *
 * 交互（§一.6）：提示词也统一为胶囊 —— 点卡片 → onApply(id, name, prompt) 立即追加一枚胶囊、关面板。
 * 数据源（§一.2.1）：局部 `promptManager`（localStorage），复用既有存储键/事件，不碰打包 catalog。
 * id 统一 `cp_prompt-<id>`（§一.2.1 消除 pp_/cp_ 双命名空间碰撞）。
 *
 * 视觉（对照 mockup/panel-kit-card）：纯文字简约卡，一排 3 格（.cl-grid.is-three）；
 * 卡片 hover 出右上角「⋯」→ 编辑 / 删除；编辑器为面板内浮层（.cl-editor）。
 *
 * @param onApply 点卡片回调 (id, name, prompt)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import {
  loadPresets,
  saveAndNotify,
  createPreset,
  searchCards,
  mapToLibraryCards,
  TYPE_LABEL,
} from '../promptManager';
import type { Preset } from '../promptManager';
import { isPresetId } from '../creativePresets';
import { subscribe } from '@/components/base/core/eventBus';
import { useOutsideClick } from '@/components/base/core/uiHooks';

/** 「我的提示词」胶囊 id 命名空间：`cp_prompt-<id>`（§一.2.1） */
export const PROMPT_PRESET_PREFIX = 'cp_prompt-';

/** 把 promptManager 条目 id 归一为创作库胶囊 id `cp_prompt-<id>`。 */
export function promptPresetChipId(managerId: string): string {
  return isPresetId(managerId) ? managerId : `${PROMPT_PRESET_PREFIX}${managerId}`;
}

export interface PromptPresetViewProps {
  onApply: (id: string, name: string, prompt: string) => void;
  /**
   * 编辑浮层的 portal 宿主（= 外层 .cl-card 元素）。
   * 由 CreativeLibrary 传入：浮层要盖住整个面板**含顶栏**，否则顶栏的关闭「×」
   * 会与本层的「×」同时可见（用户看到「上面有两个叉」）。
   * 宿主由持有 .cl-card 的父组件给，比子组件自己 closest 查找更可靠
   *（不依赖挂载时序，也避开回调 ref + setState 的重渲循环）。
   */
  editorHost?: HTMLElement | null;
  /**
   * 搜索关键词（由外壳 .cl-card 顶栏统一持有并下发）。
   * 搜索框唯一位置 = 顶栏右上角、5 分区共用，故本视图**不再自渲染搜索框**
   *（此前每个分区各放一个、位置形态都不同，用户要每页找一遍）。
   */
  keyword?: string;
}

const CATS = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '视频' },
];

export default function PromptPresetView({
  onApply,
  editorHost,
  keyword = '',
}: PromptPresetViewProps) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [cat, setCat] = useState<string>('all');
  const [editing, setEditing] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'all', prompt: '' });
  // 卡片「⋯」菜单：记录当前展开菜单的条目下标（同时只开一个）+ 锚点坐标。
  // 坐标由被点按钮实测（不再写死 top/right —— 网格列数随宽度变化，写死必错位）。
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(menuRef, menuIdx !== null, () => setMenuIdx(null));

  // 复用既有 presets-changed 事件同步
  useEffect(() => {
    return subscribe('presets-changed', (next) => {
      setPresets((next as Preset[] | null) || loadPresets());
    });
  }, []);

  const cards = useMemo(() => mapToLibraryCards(presets), [presets]);
  const display = useMemo(() => {
    let list = cards;
    if (cat !== 'all') list = list.filter((c) => c.category === cat);
    return searchCards(list, keyword);
  }, [cards, cat, keyword]);

  const countOf = (key: string) =>
    presets.filter((p) => p.enabled !== false && (key === 'all' || p.type === key)).length;

  const openEditor = (idx: number | null) => {
    const p = idx === null ? null : presets[idx];
    setEditing(idx);
    setForm(
      p
        ? { title: p.title || '', type: p.type || 'all', prompt: p.prompt || '' }
        : { title: '', type: cat === 'all' ? 'text' : cat, prompt: '' },
    );
    setMenuIdx(null);
    setShowEditor(true);
  };

  const save = () => {
    const title = form.title.trim() || '未命名提示词';
    if (!form.prompt.trim()) return;
    const next =
      editing === null
        ? [...presets, { ...createPreset(), title, type: form.type, prompt: form.prompt }]
        : presets.map((p, i) =>
            i === editing ? { ...p, title, type: form.type, prompt: form.prompt } : p,
          );
    saveAndNotify(next);
    setPresets(next);
    setShowEditor(false);
  };

  const remove = (idx: number) => {
    const next = presets.filter((_, i) => i !== idx);
    saveAndNotify(next);
    setPresets(next);
    setShowEditor(false);
    setMenuIdx(null);
  };

  return (
    <div className="cl-col">
      {/* 副条：分类 pills + 「新增预设」（搜索已统一到外壳顶栏右上角） */}
      <div className="cl-sub">
        <div className="cl-subrow">
          <div className="pk-pills">
            {CATS.map((c) => (
              <button
                key={c.key}
                type="button"
                className="pk-pill"
                aria-pressed={cat === c.key}
                onClick={() => setCat(c.key)}
              >
                {c.label} {countOf(c.key)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="cl-btn is-icon"
            title="新增预设"
            aria-label="新增预设"
            onClick={() => openEditor(null)}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* 网格：一排 3 格纯文字卡 */}
      <div className="cl-grid is-prompt-grid">
        {display.map((c) => (
          <article
            key={c.id}
            className="cl-card-item is-prompt"
            title={c.title || '(未命名)'}
            onClick={() =>
              onApply(promptPresetChipId(c.id), c.title || '(未命名)', c.content || '')
            }
          >
            <div className="cl-ptop">
              <p className="cl-ptitle">{c.title || '(未命名)'}</p>
              <span className="cl-ptag">
                {c.category && TYPE_LABEL[c.category] ? TYPE_LABEL[c.category] : '通用'}
              </span>
            </div>
            <p className="cl-pdesc">{c.content || ''}</p>
            <button
              type="button"
              className="cl-more"
              aria-label="编辑或删除"
              onClick={(e) => {
                e.stopPropagation();
                if (menuIdx === c.presetIndex) {
                  setMenuIdx(null);
                  return;
                }
                // 锚到按钮左下角（相对 .cl-col 定位的浮层坐标）
                const host = e.currentTarget.closest('.cl-col') as HTMLElement | null;
                const b = e.currentTarget.getBoundingClientRect();
                const h = host?.getBoundingClientRect();
                setMenuPos(
                  h
                    ? { top: b.bottom - h.top + 4, left: b.right - h.left - 108 }
                    : { top: 0, left: 0 },
                );
                setMenuIdx(c.presetIndex);
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </article>
        ))}
        {display.length === 0 && (
          <p className="cl-empty">
            {keyword ? '没有匹配的结果' : '暂无提示词，点击右上角「+」新增'}
          </p>
        )}
      </div>

      {/* 卡片「⋯」菜单：编辑 / 删除（锚在被点按钮的左下方；坐标实测，不写死 —— 
          网格列数随面板宽度变化，任何写死的 top/right 都会错位）。
          坐标经 CSS 自定义属性传入，**不用内联 style** —— 位置仍由 .cl-menu 的
          top/left 规则消费（样式分层归属清晰，不在 JSX 里散落布局值）。 */}
      {menuIdx !== null && menuPos && (
        <div
          className="cl-menu"
          ref={(el) => {
            // 把实测坐标写进 CSS 自定义属性（样式表 `.cl-menu` 的 top/left 消费它们）。
            // 不用内联 style 对象：布局规则仍归样式表，JS 只负责提供数值。
            menuRef.current = el;
            if (el) {
              el.style.setProperty('--menu-top', `${menuPos.top}px`);
              el.style.setProperty('--menu-left', `${menuPos.left}px`);
            }
          }}
        >
          <button type="button" onClick={() => openEditor(menuIdx)}>
            编辑
          </button>
          <button type="button" className="is-danger" onClick={() => remove(menuIdx)}>
            删除
          </button>
        </div>
      )}

      {/* 编辑器浮层：新增 / 编辑提示词。
          浮层用 portal 挂到 .cl-card 根部（不是留在 .cl-col 内）—— .cl-col 只覆盖
          副条以下区域，留它会把顶栏的关闭「×」露在外面，与本层的「×」重复。
          宿主由 CreativeLibrary 经 editorHost 传入（本组件不再自己 closest 查找）。 */}
      {showEditor &&
        editorHost &&
        createPortal(
          <div className="cl-editor">
            <div className="cl-ehd">
              <h3>{editing === null ? '新增提示词' : '编辑提示词'}</h3>
              <span className="cl-sp" />
              {/* 与顶栏关闭按钮同档（.cl-icon-btn 28px）：本面板内所有「×」应同尺寸，
                  不用 panel-kit 的 pk-icon-btn（30px 标准 / 26px 紧凑）两套尺度混用。 */}
              <button
                type="button"
                className="cl-icon-btn"
                title="关闭"
                onClick={() => setShowEditor(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="cl-erow2">
              <div className="cl-efield is-grow">
                <label>标题</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="例如：面部变真实"
                />
              </div>
              <div className="cl-efield is-type">
                <label>类型</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {CATS.filter((c) => c.key !== 'all').map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="cl-efield is-fill">
              <label>提示词</label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                placeholder="粘贴或撰写提示词内容…"
              />
            </div>
            <div className="cl-erow">
              {editing !== null && (
                <button type="button" className="cl-btn is-danger" onClick={() => remove(editing)}>
                  删除
                </button>
              )}
              <span className="cl-sp" />
              <button type="button" className="cl-btn" onClick={() => setShowEditor(false)}>
                取消
              </button>
              <button type="button" className="cl-btn is-primary" onClick={save}>
                保存
              </button>
            </div>
          </div>,
          editorHost,
        )}
    </div>
  );
}
