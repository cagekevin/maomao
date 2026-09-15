/**
 * CreativeLibrary —— 创作库面板（半屏卡片 760×560，5 分区：风格 / 滤镜 / 运镜 / MJ码图 / 我的提示词）。
 *
 * 视觉与交互的唯一基准 = `mockup/panel-kit-card/index.html`（§三）。本壳做「半屏卡片外壳 + 顶层 tab」，
 * 各分区渲染交给 `views/`；面板样式复用本仓 `panel-kit.css`（pk-seg / .pk-seg-item / .pk-pill / pk-search）
 * 而非 mockup CSS。
 *
 * 职责边界（壳不碰胶囊 / 字典 / 节点 data）：
 *   - 持「当前分区 tab」状态 + initialTab；顶部搜索（风格/滤镜/运镜分区）下传；
 *   - 任一分区点卡片经统一 `onApply(preset, fragment)` 上抛 —— 落地胶囊 / 写 data.creativePresets /
 *     关闭面板全由宿主节点完成。MJ 分区内部自有详情态，点「插入正文」才走 onApply。
 *
 * 交互（§一.6，mockup 为准）：
 *   - 风格 / 滤镜 / 运镜 / 提示词：点卡片 → 立即追加一枚胶囊 → 宿主关闭面板；
 *   - MJ：点卡片进详情 → 点「插入正文」→ onApply(preset, modeText)。
 *
 * 数据：catalog 4 类由 `creativeCatalog.ts`（217/17/51/493）；「我的提示词」由 `promptManager`（本目录）。
 * 不落盘字段（§一.2）面板内使用，宿主落字典前经 `trimPreset` 裁剪。
 */

import { useMemo, useState } from 'react';
import { PanelSubBar, PanelListFoot } from '../panels/PanelBar.tsx';
import { STYLE_PRESETS, FILTER_PRESETS, MOTION_PRESETS, MJ_PRESETS } from './creativeCatalog.ts';
import type { MjPreset } from './creativeCatalog.ts';
import type { CreativePreset, PresetKind } from './creativePresets.ts';
import PresetGridView from './views/PresetGridView.tsx';
import MjStyleBrowser from './views/MjStyleBrowser.tsx';
import PromptPresetView from './views/PromptPresetView.tsx';

export type CreativeTab = 'style' | 'filter' | 'motion' | 'mj' | 'prompt';

/** 五个分区的最小条目描述（host 落胶囊所需，preview 属落盘字段合法带入） */
export interface CreativeApplyItem {
  id: string;
  kind: PresetKind;
  name: string;
  prompt: string;
  /** 预览图路径（胶囊缩略图，可选） */
  preview?: string;
}

export interface CreativeLibraryProps {
  /** 初始分区（由入口按钮按节点类型传入；缺省 style） */
  initialTab?: CreativeTab;
  /**
   * 统一应用回调：点卡片（生成一枚胶囊）时触发。
   * @param item 分区内选中的条目（id 已带 cp_ 前缀）
   * @param fragment 合成时替换胶囊的片段文本（MJ 详情态 = 选定模式文本；其余 = item.prompt）
   */
  onApply: (item: CreativeApplyItem, fragment: string) => void;
}

const TAB_LABEL: Record<CreativeTab, string> = {
  style: '风格',
  filter: '滤镜',
  motion: '运镜',
  mj: 'MJ码图',
  prompt: '提示词',
};

/** 分类真值 pill（风格 3 / 滤镜 2 / 运镜 3，§一.5） */
function categoryPills(
  list: { category: string }[],
): { key: string; label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const p of list) m.set(p.category, (m.get(p.category) || 0) + 1);
  return [...m.entries()].map(([k, v]) => ({ key: k, label: k, total: v }));
}

export default function CreativeLibrary({ initialTab = 'style', onApply }: CreativeLibraryProps) {
  const [tab, setTab] = useState<CreativeTab>(initialTab);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const switchTab = (t: CreativeTab) => {
    setTab(t);
    setCat(null);
    setQ('');
  };

  const catalog3: Record<'style' | 'filter' | 'motion', CreativePreset[]> = {
    style: STYLE_PRESETS,
    filter: FILTER_PRESETS,
    motion: MOTION_PRESETS,
  };

  const pills =
    tab === 'style' || tab === 'filter' || tab === 'motion' ? categoryPills(catalog3[tab]) : [];

  const gridPresets = useMemo(() => {
    if (tab === 'mj' || tab === 'prompt') return [] as CreativePreset[];
    let list = catalog3[tab as 'style' | 'filter' | 'motion'];
    if (cat) list = list.filter((p) => p.category === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(k) || (p.prompt || '').toLowerCase().includes(k),
      );
    }
    return list;
  }, [tab, cat, q, catalog3]);

  const applyFromPreset = (p: CreativePreset) =>
    onApply(
      { id: p.id, kind: p.kind, name: p.name, prompt: p.prompt, preview: p.preview },
      p.prompt,
    );

  return (
    <div className="w-[760px] h-[560px] flex flex-col overflow-hidden bg-input border border-edge-faint rounded-2xl shadow-2xl">
      {/* 顶栏 tab */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-0 flex-shrink-0">
        <div className="pk-seg" role="tablist" aria-label="创作库分区">
          {(Object.keys(TAB_LABEL) as CreativeTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className="pk-seg-item"
              onClick={() => switchTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="flex-1" />
      </div>

      {/* 搜索 + 分类 pills（仅 风格/滤镜/运镜） */}
      {(tab === 'style' || tab === 'filter' || tab === 'motion') && (
        <PanelSubBar>
          <label className="pk-search" style={{ height: 30 }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCat(null);
              }}
              placeholder="搜索当前分区"
            />
          </label>
          <div className="pk-pills">
            <button
              type="button"
              className="pk-pill"
              aria-pressed={!cat}
              onClick={() => setCat(null)}
            >
              全部 {gridPresets.length}
            </button>
            {pills.map((p) => (
              <button
                key={p.key}
                type="button"
                className="pk-pill"
                aria-pressed={cat === p.key}
                onClick={() => setCat(p.key)}
              >
                {p.label} {p.total}
              </button>
            ))}
          </div>
        </PanelSubBar>
      )}

      {/* 主体 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'prompt' && (
          <PromptPresetView
            onApply={(id, name, prompt) => onApply({ id, kind: 'prompt', name, prompt }, prompt)}
          />
        )}
        {tab === 'mj' && (
          <MjStyleBrowser
            mjPresets={MJ_PRESETS}
            onApply={(p: MjPreset, modeText: string) =>
              onApply(
                { id: p.id, kind: 'mj', name: p.name, prompt: modeText, preview: p.preview },
                modeText,
              )
            }
          />
        )}
        {(tab === 'style' || tab === 'filter' || tab === 'motion') && (
          <PresetGridView presets={gridPresets} onApply={applyFromPreset} />
        )}
      </div>

      {/* 底栏计数 */}
      {(tab === 'style' || tab === 'filter' || tab === 'motion') && (
        <PanelListFoot>
          {q
            ? `搜索「${q}」· 匹配 ${gridPresets.length} 个`
            : `${cat || '全部'} · 共 ${gridPresets.length} 个`}
        </PanelListFoot>
      )}
    </div>
  );
}
