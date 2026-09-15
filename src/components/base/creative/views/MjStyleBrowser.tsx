/**
 * MjStyleBrowser —— 创作库「MJ 码图」分区视图（两根轴 + 详情态 4 模式）。
 *
 * 视觉/交互对照 `mockup/panel-kit-card/index.html`（视觉基准）：
 *   - 副条 pills = 素材类型轴（全部 + 角色人像/场景环境/巨物怪兽，即 mj.group char/scene/juwu）
 *   - 左栏 = 题材六大组 → 34 个分类（可折叠）
 *   - 点卡片 → 进详情态：大图 + medium + 4 种插入模式（风格码/风格＋参数/完整提示词/色调描述）
 *     + textarea + 复制 / 插入正文。
 *
 * 两轴交叉过滤（2026-09-15 真值）：34 个分类每个唯一属于一个素材类型组（multigroup=0），
 * 故选中题材分类即确定素材类型；副条 pills 是「素材类型」轴，交叉后左栏只留该组分类。
 *
 * 交互（§一.6）：MJ 点卡片不立即关闭，先进详情；点「插入正文」→ onApply(preset, modeText) 才落胶囊。
 * ⚠️ P-2 裁决（2026-09-15）：本仓无 Midjourney 模型，但用户确认 **4 模式全可用、不加任何复杂度/禁字段**，
 *   故 codes/parameters 照常渲染、可复制可插入，不作置灰。
 */

import React, { useMemo, useState } from 'react';
import { PanelPills, PanelSubBar } from '../../panels/PanelBar.tsx';
import type { MjPreset } from '../creativeCatalog.ts';

export interface MjStyleBrowserProps {
  mjPresets: MjPreset[];
  onApply: (preset: MjPreset, modeText: string) => void;
}

/** 素材类型组名（mj.group → 展示名，2026-09-15 真值） */
const GROUP_LABEL: Record<string, string> = {
  char: '角色人像',
  scene: '场景环境',
  juwu: '巨物怪兽',
};

/** 题材六大组 → 34 分类（mockup TOPICS，逐个数据校验过） */
const MJ_TOPICS: { name: string; cats: string[] }[] = [
  {
    name: '东方古风',
    cats: [
      '东方古风·武侠',
      '东方神话·仙侠奇观',
      '东方古装·史诗',
      '古风室内·殿堂楼阁',
      '古镇村落·俯瞰',
      '仙侠天宫·奇观',
      '古建·祠庙宫殿',
    ],
  },
  {
    name: '现代影像',
    cats: [
      '现代都市·电影人文',
      '现代写实人像·生活流',
      '时尚编辑·商业广告',
      '日韩系·影像',
      '现代都市·街景',
      '现代室内·生活空间',
    ],
  },
  {
    name: '科幻幻想',
    cats: [
      '科幻·机甲',
      '游戏CG·动漫角色',
      '东方赛博·武侠朋克',
      '西方奇幻·神话史诗',
      '科幻·未来场景',
      '西幻·城堡秘境',
    ],
  },
  { name: '自然氛围', cats: ['自然奇观·山水云海', '光影空镜·氛围', '风格化与实验'] },
  {
    name: '暗黑废墟',
    cats: ['国风暗黑·志怪恐怖', '废墟·古代战场', '废墟末世·战场', '暗黑异兽·克苏鲁'],
  },
  {
    name: '巨物传说',
    cats: [
      '巨物·尺度压迫',
      '巨型机甲·超级机器人',
      '怪兽特摄·哥斯拉系',
      '超尺度奇观·巨物崇拜',
      '东方神龙·仙兽',
      '西方巨龙·翼兽',
      '深海巨兽·海怪',
      '上古神祇·泰坦巨人',
    ],
  },
];

type ModeKey = 'codes' | 'parameters' | 'prompt' | 'vibe';
const MODES: { key: ModeKey; label: string }[] = [
  { key: 'codes', label: '风格码' },
  { key: 'parameters', label: '风格＋参数' },
  { key: 'prompt', label: '完整提示词' },
  { key: 'vibe', label: '色调描述' },
];

/** 预处理：group 计数 + category→group 映射 + category→items。 */
function buildIndex(mjPresets: MjPreset[]) {
  const groupCount: Record<string, number> = {};
  const catGroup: Record<string, string> = {};
  const catItems: Record<string, MjPreset[]> = {};
  for (const m of mjPresets) {
    const g = m.group && GROUP_LABEL[m.group] ? m.group : 'char';
    groupCount[g] = (groupCount[g] || 0) + 1;
    catGroup[m.category] = g;
    (catItems[m.category] = catItems[m.category] || []).push(m);
  }
  return { groupCount, catGroup, catItems };
}

/** 卡片（图 + 底部名条） */
function MjCard({ preset, onClick }: { preset: MjPreset; onClick: () => void }) {
  return (
    <button
      type="button"
      className="relative overflow-hidden cursor-pointer rounded-xl border border-edge hover:border-edge-raised bg-surface text-left"
      style={{ aspectRatio: '16/12' }}
      onClick={onClick}
    >
      {preset.preview && (
        <img
          src={preset.preview}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 px-3 pt-5 pb-2.5 bg-gradient-to-t from-black/70 to-transparent">
        <p className="m-0 text-xs text-white/[0.92] truncate">{preset.name}</p>
      </div>
    </button>
  );
}

/** 详情态 */
function Detail({
  preset,
  onBack,
  onApply,
}: {
  preset: MjPreset;
  onBack: () => void;
  onApply: (modeText: string) => void;
}) {
  const [mode, setMode] = useState<ModeKey>('codes');
  const modeText = preset[mode] || '';
  return (
    <div className="flex-1 min-h-0 flex gap-3 px-3 py-2 overflow-auto">
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {(preset.bigPreview || preset.preview) && (
          <img
            src={preset.bigPreview || preset.preview}
            alt={preset.name}
            className="w-full flex-1 min-h-[120px] object-contain rounded-lg bg-surface-sunken border border-edge-faint"
          />
        )}
        <p className="text-2xs text-faint m-0">
          {preset.medium || ''} · {preset.id.toUpperCase()}
          {preset.mixed ? ' · 混码组合' : ' · 单码'}
        </p>
      </div>
      <div className="w-[330px] flex-shrink-0 flex flex-col gap-2 min-w-0">
        <h3 className="text-sm font-semibold text-strong m-0">{preset.name}</h3>
        <p className="text-2xs text-muted leading-[1.7] m-0">
          {preset.mixed
            ? '这是混码组合，整组使用才能保留示例风格。'
            : '单码风格，可搭配你自己的主体描述。'}
        </p>
        <div className="pk-pills">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="pk-pill"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          className="flex-1 min-h-[96px] w-full resize-none rounded-lg p-2 bg-input border border-edge-muted text-body text-2xs leading-[1.7] outline-none focus:border-accent/50 box-border"
          value={modeText}
          readOnly
        />
        <div className="flex items-center gap-1.5">
          <span className="flex-1" />
          <button type="button" className="pk-btn" onClick={onBack}>
            返回列表
          </button>
          <button
            type="button"
            className="pk-btn"
            onClick={() => {
              if (navigator.clipboard) void navigator.clipboard.writeText(modeText);
            }}
          >
            复制
          </button>
          <button type="button" className="pk-btn primary" onClick={() => onApply(modeText)}>
            插入正文
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MjStyleBrowser({ mjPresets, onApply }: MjStyleBrowserProps) {
  const { groupCount, catGroup, catItems } = useMemo(() => buildIndex(mjPresets), [mjPresets]);
  // 两轴：素材类型 group（null=全部）+ 题材分类 cat
  const [group, setGroup] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [detail, setDetail] = useState<MjPreset | null>(null);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  const mjTotal = mjPresets.length;

  // 当前类型组下可显示的题材分类（交叉过滤：分类唯一属组）
  const topics = useMemo(
    () =>
      MJ_TOPICS.map((t) => ({
        ...t,
        cats: t.cats.filter((c) => catItems[c] && (!group || catGroup[c] === group)),
      })).filter((t) => t.cats.length > 0),
    [group, catItems, catGroup],
  );

  // 当前显示的条目：详情态直接返回；列表态按「题材分类」过滤（pills 已把类型组纳入交叉）
  const displayItems = useMemo(() => {
    if (detail) return [];
    if (cat) return catItems[cat] || [];
    return mjPresets.filter((m) => !group || catGroup[m.category] === group);
  }, [detail, cat, catItems, mjPresets, group, catGroup]);

  // 详情态
  if (detail) {
    return (
      <Detail
        preset={detail}
        onBack={() => setDetail(null)}
        onApply={(modeText) => {
          onApply(detail, modeText);
          setDetail(null);
        }}
      />
    );
  }

  return (
    <>
      <PanelSubBar>
        <PanelPills
          items={[
            { key: 'all', label: `全部 ${mjTotal}` },
            ...Object.keys(groupCount).map((g) => ({
              key: g,
              label: `${GROUP_LABEL[g] || g} ${groupCount[g]}`,
            })),
          ]}
          value={group || 'all'}
          onChange={(k) => {
            setGroup(k === 'all' ? null : k);
            setCat(null);
            setDetail(null);
          }}
        />
      </PanelSubBar>
      <div className="flex-1 min-h-0 flex">
        {/* 左栏：题材六大组 → 分类 */}
        <nav className="w-[178px] flex-shrink-0 overflow-y-auto py-1.5 px-1.5 bg-surface-deep border-r border-edge-faint thin-scroll">
          {topics.map((t) => {
            const open = !closedGroups.includes(t.name);
            const sum = t.cats.reduce((n, c) => n + (catItems[c]?.length || 0), 0);
            return (
              <React.Fragment key={t.name}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-1.5 h-[26px] px-1.5 mt-0.5 rounded-md bg-transparent text-faint text-2xs cursor-pointer text-left border-none hover:bg-surface-hover hover:text-secondary"
                  onClick={() =>
                    setClosedGroups((s) => (open ? [...s, t.name] : s.filter((x) => x !== t.name)))
                  }
                >
                  <span>
                    {open ? '▾ ' : '▸ '}
                    {t.name}
                  </span>
                  <span className="text-2xs text-subtle">{sum}</span>
                </button>
                {open &&
                  t.cats.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-current={cat === c}
                      className="flex w-full items-center justify-between gap-1.5 h-6 px-1.5 pl-[14px] rounded-md bg-transparent text-muted text-2xs cursor-pointer text-left border-none hover:bg-surface-hover hover:text-primary"
                      onClick={() => {
                        setCat(c);
                        setDetail(null);
                      }}
                    >
                      <span className="truncate">{c}</span>
                      <span className="text-2xs text-subtle">{catItems[c]?.length || 0}</span>
                    </button>
                  ))}
              </React.Fragment>
            );
          })}
          {topics.length === 0 && (
            <div className="py-6 text-center text-faint text-2xs">该素材类型下暂无题材</div>
          )}
        </nav>
        {/* 右列：网格 */}
        <div className="flex-1 min-w-0 overflow-auto grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 align-start px-3 py-2 custom-scrollbar">
          {displayItems.map((m) => (
            <MjCard
              key={m.id}
              preset={m}
              onClick={() => {
                setCat(m.category);
                setDetail(m);
              }}
            />
          ))}
          {displayItems.length === 0 && (
            <div className="col-span-full py-8 text-center text-faint text-2xs">
              先在左栏选一个题材分类
            </div>
          )}
        </div>
      </div>
    </>
  );
}
