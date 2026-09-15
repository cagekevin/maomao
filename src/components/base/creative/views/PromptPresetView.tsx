/**
 * PromptPresetView —— 创作库「我的提示词」分区（第 5 分区）。
 *
 * 数据源（§一.2.1 SSOT）：本地 `promptManager`（localStorage，可增删），复用既有实现、
 * 已有存储键 `yimao_preset_prompts` / `yimao_preset_recent`、事件 `presets-changed`。
 * 不碰打包 catalog，不新增存储键 / 事件（门禁 2/3 满足）。
 *
 * 交互（§一.6，2026-09-15 第三轮决策）：提示词也统一为胶囊 —— 点卡片 → onApply(preset) 立即追加一枚胶囊、
 * 关闭面板（与风格/滤镜/运镜完全一致）。原 PromptLibrary 的 onUse/onAppend（整段写正文/新建文本节点）本次不沿用；
 * 卡片 hover 出「⋯」提供 编辑 / 删除（mockup 卡片右上角），编辑器为面板内浮层。
 *
 * 类型过滤（mockup）：全部 / 文本 / 生图 / 视频 四档（'all' / text / image / video）。
 * id 统一 `cp_prompt-<id>`（§一.2.1 消除 pp_/cp_ 双命名空间碰撞）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, Search } from 'lucide-react';
import { PanelSubBar, PanelPills } from '../../panels/PanelBar.tsx';
import {
  loadPresets,
  saveAndNotify,
  createPreset,
  searchCards,
  mapToLibraryCards,
  TYPE_LABEL,
} from '../promptManager.ts';
import type { Preset } from '../promptManager.ts';
import { isPresetId } from '../creativePresets.ts';
import { subscribe } from '../../core/eventBus.ts';

/**
 * 「我的提示词」胶囊 id 命名空间（§一.2.1）：`cp_prompt-<id>`。
 * promptManager 的 id 是 `pp_<n>`，插入胶囊时统一补 `cp_prompt-` 前缀对齐 5 分区 `cp_*` 键。
 */
export const PROMPT_PRESET_PREFIX = 'cp_prompt-';

/** 把 promptManager 条目 id（`pp_*`，可能已带其他前缀）归一为创作库胶囊 id `cp_prompt-<id>`。 */
export function promptPresetChipId(managerId: string): string {
  return isPresetId(managerId) ? managerId : `${PROMPT_PRESET_PREFIX}${managerId}`;
}

export interface PromptPresetViewProps {
  /** 点卡片（应用一枚胶囊）回调 */
  onApply: (id: string, name: string, prompt: string) => void;
}

const CATS = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文本' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '视频' },
];

export default function PromptPresetView({ onApply }: PromptPresetViewProps) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [cat, setCat] = useState<string>('all');
  const [kw, setKw] = useState('');

  // 监听 presets-changed 同步（与 PromptLibrary 一致）
  useEffect(() => {
    return subscribe('presets-changed', (next) => {
      setPresets((next as Preset[] | null) || loadPresets());
    });
  }, []);

  // 编辑器文案（浮层内）
  const [editing, setEditing] = useState<number | null>(null); // preset index，null=新建
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'all', prompt: '' });

  const cards = useMemo(() => mapToLibraryCards(presets), [presets]);
  const display = useMemo(() => {
    let list = cards;
    if (cat !== 'all') list = list.filter((c) => c.category === cat);
    return searchCards(list, kw);
  }, [cards, cat, kw]);

  const openEditor = (idx: number | null) => {
    const p = idx === null ? null : presets[idx];
    setEditing(idx);
    setForm(
      p
        ? { title: p.title || '', type: p.type || 'all', prompt: p.prompt || '' }
        : { title: '', type: cat === 'all' ? 'text' : cat, prompt: '' },
    );
    setShowEditor(true);
  };

  const save = () => {
    const title = form.title.trim() || '未命名提示词';
    if (!form.prompt.trim()) return; // 空内容不保存
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
  };

  return (
    <>
      <PanelSubBar>
        <label className="flex items-center gap-1.5 h-[30px] flex-1 px-2.5 bg-surface border border-edge rounded-lg text-faint">
          <Search size={12} />
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜索标题或内容"
            className="flex-1 min-w-0 bg-transparent border-0 outline-0 text-xs text-body placeholder:text-faint"
          />
        </label>
        <button
          type="button"
          className="pk-btn add-ico"
          title="新增预设"
          aria-label="新增预设"
          onClick={() => openEditor(null)}
        >
          <Plus size={14} />
        </button>
      </PanelSubBar>
      <PanelSubBar>
        <PanelPills
          items={CATS.map((c) => ({
            key: c.key,
            label: `${c.label} ${c.key === 'all' ? presets.filter((p) => p.enabled !== false).length : presets.filter((p) => p.enabled !== false && p.type === c.key).length}`,
          }))}
          value={cat}
          onChange={setCat}
        />
      </PanelSubBar>

      {/* 网格：纯文字简约卡，一排 3 格 */}
      <div className="flex-1 min-h-0 overflow-auto px-3 py-2 grid grid-cols-3 gap-3 align-stretch custom-scrollbar">
        {display.map((c) => (
          <button
            key={c.id}
            type="button"
            className="relative flex flex-col gap-2 rounded-xl border border-edge bg-surface p-3 text-left cursor-pointer transition-colors hover:border-edge-raised hover:bg-surface-hover min-h-[110px]"
            onClick={() => {
              // 应用一枚胶囊：promptManager 条目的 pp_* id → cp_prompt- 命名空间
              onApply(promptPresetChipId(c.id), c.title || '(未命名)', c.content || '');
            }}
          >
            <span
              role="presentation"
              className="opacity-0 group-hover:opacity-100 absolute top-1.5 right-1.5 flex gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-md bg-transparent hover:bg-surface-hover-strong text-subtle hover:text-primary cursor-pointer">
                <Pencil size={12} onClick={() => openEditor(c.presetIndex)} />
              </span>
              <span className="w-5 h-5 flex items-center justify-center rounded-md bg-transparent hover:bg-red-500/10 text-subtle hover:text-red-400 cursor-pointer">
                <Trash2 size={12} onClick={() => remove(c.presetIndex)} />
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="m-0 text-xs font-semibold text-strong leading-[1.4] truncate">
                {c.title || '(未命名)'}
              </span>
              <span className="flex-shrink-0 text-2xs leading-none px-1.5 py-[3px] rounded-md text-secondary bg-surface-2 border border-edge-faint">
                {c.category && TYPE_LABEL[c.category] ? TYPE_LABEL[c.category] : '通用'}
              </span>
            </span>
            <span className="m-0 text-2xs text-muted leading-[1.65] line-clamp-2 break-all">
              {c.content || ''}
            </span>
          </button>
        ))}
        {display.length === 0 && (
          <div className="col-span-full py-8 text-center text-faint text-2xs">
            {kw ? '没有匹配的结果' : '暂无提示词，点右上角「+」新增'}
          </div>
        )}
      </div>

      {/* 编辑器浮层 */}
      {showEditor && (
        <div className="absolute inset-0 z-30 flex flex-col bg-input rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-strong m-0">
              {editing === null ? '新增提示词' : '编辑提示词'}
            </h3>
            <button
              type="button"
              className="pk-icon-btn"
              onClick={() => setShowEditor(false)}
              aria-label="关闭"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2.5 items-start">
            <label className="flex flex-col gap-1 mb-3 flex-1 min-w-0">
              <span className="text-2xs text-muted">标题</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="例如：面部变真实"
                className="h-[34px] border border-edge rounded-lg bg-surface px-2.5 text-xs text-body outline-none focus:border-accent/50 box-border"
              />
            </label>
            <label className="flex flex-col gap-1 mb-3 w-[118px] flex-none">
              <span className="text-2xs text-muted">类型</span>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="h-[34px] border border-edge rounded-lg bg-surface px-2 text-xs text-body outline-none box-border"
              >
                {CATS.filter((c) => c.key !== 'all').map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 flex-1 min-h-0">
            <span className="text-2xs text-muted">提示词</span>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder="粘贴或撰写提示词内容…"
              className="flex-1 min-h-[96px] w-full resize-none rounded-lg border border-edge bg-surface p-2.5 text-xs text-body outline-none focus:border-accent/50 leading-[1.6] box-border"
            />
          </label>
          <div className="flex items-center gap-2 mt-2">
            {editing !== null && (
              <button type="button" className="pk-btn danger" onClick={() => remove(editing)}>
                删除
              </button>
            )}
            <span className="flex-1" />
            <button type="button" className="pk-btn" onClick={() => setShowEditor(false)}>
              取消
            </button>
            <button type="button" className="pk-btn primary" onClick={save}>
              保存
            </button>
          </div>
        </div>
      )}
    </>
  );
}
