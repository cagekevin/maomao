/**
 * CreativeLibrary —— 创作库面板：5 分区（风格 / 滤镜 / 运镜 / MJ码图 / 我的提示词）。
 *
 * 【形态裁决 2026-09-15】全屏层（FullscreenModal）+ 创作库私有视觉（creative-library.css）。
 *   · 为什么不是节点内面板（IECT/ExpandablePanel）：节点宽度 ≤900px，卡片只能单列，
 *     而本库是 217 风格 / 493 MJ 的「看图选风格」浏览型 UI，宽度是收益项。
 *   · 为什么不是任务中心那套 330px 侧栏：330px 放不下 300px 起跳的双列大卡。
 *   · 为什么尺寸不硬编码：面板是独占交互的全屏层，固定 px 会在大屏上浪费空间；
 *     故宽度走 widthRatio=0.9（≈92vw）+ maxWidth 上限，列数由 auto-fill 自动决定。
 *     上限现值 = **1120px**（2026-09-15 用户裁定收窄：1560 会把卡片拉成超长横条、密度过低；
 *     1120 在 300px 最小卡宽下稳定 3 列）。真源在 `CreativeLibraryButton` 的 `maxWidth` prop。
 *
 * 职责边界（壳不碰胶囊 / 字典 / 节点 data）：
 *   - 持分区 tab 状态 + initialTab；
 *   - 任一分区点卡片经统一 `onApply(item)` 上抛——落胶囊 / 写 data.creativePresets / 关面板由入口组件
 *     `CreativeLibraryButton` 完成（它持有 `open` state；本壳只经 `onClose` 请求关闭）。
 *
 * 交互（§一.6，mockup 为准）：风格/滤镜/运镜/提示词点卡片 → 立即追加胶囊 → 关面板；MJ 进详情 → 插入正文才 onApply。
 */

import { useCallback, useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import '../base/panels/panel-kit.css';
import '../base/panels/creative-library.css';
import { catalogByKind, MJ_PRESETS } from './creativeCatalog.ts';
import type { MjPreset } from './creativeCatalog.ts';
import type { CreativePreset } from './creativePresets.ts';
import PresetGridView from './views/PresetGridView.tsx';
import MjStyleBrowser from './views/MjStyleBrowser.tsx';
import PromptPresetView from './views/PromptPresetView.tsx';

export type CreativeTab = 'style' | 'filter' | 'motion' | 'mj' | 'prompt';

/** 主网格 3 分区（catalog 的前 3 类；mj / prompt 各有专属视图，不走 PresetGridView）。 */
type PrimaryTab = 'style' | 'filter' | 'motion';
/** 判定是否为主网格分区（收窄 tab 用，避免三处手写同一三元表达式）。 */
const isPrimaryTab = (t: CreativeTab): t is PrimaryTab =>
  t === 'style' || t === 'filter' || t === 'motion';

/**
 * 面板 → 宿主的应用契约 = 创作库唯一实体 `CreativePreset`（TD-05-12 母体收口）。
 * 【为什么删掉原 `CreativeApplyItem`】它是同一实体的**第三份形状**（比 `CreativePreset` 少
 * `category`/`video`，`kind` 却与之一致）——多一份形状就多一处漂移点：节点写字典时
 * 既要认识 `CreativeApplyItem` 又要认识 `CreativePreset`，`toDictEntry` 便接不上。
 * 现统一为 `CreativePreset`：三个视图产出的对象本就直接由 catalog 条目派生，无需再裁一层。
 */
export interface CreativeLibraryProps {
  initialTab?: CreativeTab;
  onClose?: () => void;
  onApply: (item: CreativePreset) => void;
}

const TAB_LABEL: Record<CreativeTab, string> = {
  style: '风格',
  filter: '滤镜',
  motion: '运镜',
  mj: 'MJ码图',
  prompt: '提示词',
};

/** 各分区的底部统计单位（与 mockup 文案一致） */
const TAB_UNIT: Record<CreativeTab, string> = {
  style: '个风格预设',
  filter: '个滤镜预设',
  motion: '个运镜预设',
  mj: '组码图',
  prompt: '条提示词',
};

function categoryPills(
  list: { category: string }[],
): { key: string; label: string; total: number }[] {
  const m = new Map<string, number>();
  for (const p of list) m.set(p.category, (m.get(p.category) || 0) + 1);
  return [...m.entries()].map(([k, v]) => ({ key: k, label: k, total: v }));
}

export default function CreativeLibrary({
  initialTab = 'style',
  onClose,
  onApply,
}: CreativeLibraryProps) {
  const [tab, setTab] = useState<CreativeTab>(initialTab);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // 编辑浮层的 portal 宿主（= 本组件根 .cl-card）。用回调 ref 落 state：
  // 首次渲染时 DOM 还不存在，必须等挂载后才能把它交给子组件（否则 editorHost 恒 null，
  // 「编辑」浮层不渲染 —— 表现为「点编辑没反应」）。
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const cardRef = useCallback((el: HTMLDivElement | null) => setCardEl(el), []);

  const switchTab = (t: CreativeTab) => {
    setTab(t);
    setCat(null);
    setQ('');
  };

  const primary = isPrimaryTab(tab);

  // 分类 pills：直接取自 catalog 单一入口（此前手写 catalog3 且组件体内每 render 重建）
  const pills = primary ? categoryPills(catalogByKind(tab)) : [];

  // ⚠️ 依赖必须是**稳定引用**：catalogByKind 返回模块级常量（STYLE_PRESETS 等），
  //    故 deps 用 `tab` 而非「catalog 数组」——原实现把手写 catalog3 放进 deps，
  //    该对象每 render 新建 → memo 恒失效（假 memo，217 项过滤每帧重跑）。
  const gridPresets = useMemo(() => {
    if (!primary) return [] as CreativePreset[];
    let list = catalogByKind(tab);
    if (cat) list = list.filter((p) => p.category === cat);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(k) || (p.prompt || '').toLowerCase().includes(k),
      );
    }
    return list;
  }, [primary, tab, cat, q]);

  const applyFromPreset = (p: CreativePreset) => onApply(p);

  // 底栏总数：只列当前分区全量（供「全部 N」pill 与统计行复用）
  const sectionTotal = primary
    ? pills.reduce((n, p) => n + p.total, 0)
    : tab === 'mj'
      ? MJ_PRESETS.length
      : 0;

  const footText = q
    ? `搜索「${q}」· 匹配 ${gridPresets.length} ${TAB_UNIT[tab]}`
    : primary
      ? `${cat || '全部'} · 共 ${cat ? gridPresets.length : sectionTotal} ${TAB_UNIT[tab]}`
      : tab === 'mj'
        ? `共 ${MJ_PRESETS.length} 组码图 · 在左栏选一个分类`
        : `共 ${gridPresets.length} ${TAB_UNIT[tab]}`;

  return (
    <div className="cl-card" ref={cardRef}>
      {/* 顶栏：纯文字 tab + 关闭
          ⚠️ 用 .cl-tab 而不是 panel-kit 的 .pk-seg-item：后者未激活项会收起文字只留图标，
          而本面板 5 个分区**无图标**，套用后未选中分区全部消失（只剩当前项可见）。
          详见 creative-library.css 的 .cl-tabs 注释。 */}
      <div className="pk-head">
        <div className="cl-tabs" role="tablist" aria-label="创作库分区">
          {(Object.keys(TAB_LABEL) as CreativeTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className="cl-tab"
              onClick={() => switchTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {/* 搜索：**唯一位置 = 顶栏右上角，5 个分区共用**（2026-09-15 用户裁定）。
           此前每个分区各写各的搜索（风格/滤镜/运镜在副条、MJ 在内容区、提示词在副条），
            位置与形态各不相同，用户要「每页找一遍搜索框」。
           现由外壳统一持有 q，经 props 下发各视图；子视图不再自渲染搜索框。 */}
        <span className="pk-head-spacer" />
        <label className="cl-search cl-search-top">
          <Search size={13} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCat(null);
            }}
            placeholder="搜索当前分区"
          />
        </label>
        {/* 关闭按钮：走本面板自己的 .cl-icon-btn（= 搜索框同档 28px），
            不用 panel-kit 的 .pk-icon-btn 标准档（30px）—— 那是给 330px 窄面板
            48px 顶栏定的尺度，在 40px 顶栏里比搜索框还高、显得「比别的都大」（用户指出）。 */}
        <button type="button" className="cl-icon-btn" onClick={onClose} title="关闭创作库（Esc）">
          <X size={14} />
        </button>
      </div>

      {/* 副条：仅分类 pills（搜索已并入顶栏） */}
      {primary && (
        <div className="cl-sub">
          <div className="cl-subrow">
            <div className="pk-pills">
              <button
                type="button"
                className="pk-pill"
                aria-pressed={!cat}
                onClick={() => setCat(null)}
              >
                全部 {sectionTotal}
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
          </div>
        </div>
      )}

      {/* 主体 */}
      <div className="cl-main">
        {tab === 'prompt' && (
          <PromptPresetView
            editorHost={cardEl}
            keyword={q}
            onApply={(id, name, prompt) =>
              onApply({ id, kind: 'prompt', category: '', name, prompt })
            }
          />
        )}
        {tab === 'mj' && (
          <MjStyleBrowser
            mjPresets={MJ_PRESETS}
            keyword={q}
            onApply={(p: MjPreset, modeText: string) => onApply({ ...p, prompt: modeText })}
          />
        )}
        {primary && <PresetGridView presets={gridPresets} onApply={applyFromPreset} />}
      </div>

      {/* 底栏计数 */}
      <div className="pk-list-foot">{footText}</div>
    </div>
  );
}
