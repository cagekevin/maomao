/**
 * MjStyleBrowser —— 创作库「MJ 码图」分区视图（两根轴 + 详情态 4 模式）。
 *
 * - 副条 = 素材类型轴（全部 + 角色人像/场景环境/巨物怪兽，即 mj.group char/scene/juwu）
 * - 左栏 = 题材六大组 → 分类（可折叠）
 * - 点卡片 → 详情态：medium + 4 插入模式（风格码/风格＋参数/完整提示词/色调描述）+ textarea + 复制 / 插入正文
 *
 * ⚠️ P-2 裁决（2026-09-15）：4 模式全可用、不加复杂度/不禁字段（本仓无 MJ 模型，codes 可复制不本地消费）。
 *
 * 视觉：左栏 .cl-nav · 卡片 .cl-grid/.cl-card-item · 详情 .cl-mj-detail（见 creative-library.css）。
 *
 * @param mjPresets 归一化后的 MJ 目录
 * @param onApply   点「插入正文」→ (preset, modeText)
 */

import { useMemo, useState } from 'react';
import { ArrowLeft, Copy } from 'lucide-react';
import LazyImage from '@/components/base/ui/LazyImage';
import type { MjPreset } from '../creativeCatalog';

export interface MjStyleBrowserProps {
  mjPresets: MjPreset[];
  onApply: (preset: MjPreset, modeText: string) => void;
  /**
   * 搜索关键词（由外壳顶栏统一持有并下发）。
   * 搜索框唯一位置 = 顶栏右上角、5 分区共用，故本视图**不再自渲染搜索框**。
   */
  keyword?: string;
}

const GROUP_LABEL: Record<string, string> = {
  char: '角色人像',
  scene: '场景环境',
  juwu: '巨物怪兽',
};

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

export default function MjStyleBrowser({ mjPresets, onApply, keyword = '' }: MjStyleBrowserProps) {
  const { groupCount, catGroup, catItems } = useMemo(() => buildIndex(mjPresets), [mjPresets]);
  const [group, setGroup] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [detail, setDetail] = useState<MjPreset | null>(null);
  const [mode, setMode] = useState<ModeKey>('codes');
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const topics = useMemo(
    () =>
      MJ_TOPICS.map((t) => ({
        ...t,
        cats: t.cats.filter((c) => catItems[c] && (!group || catGroup[c] === group)),
      })).filter((t) => t.cats.length > 0),
    [group, catItems, catGroup],
  );

  const displayItems = useMemo(() => {
    if (detail) return [];
    let list = cat
      ? catItems[cat] || []
      : mjPresets.filter((m) => !group || catGroup[m.category] === group);
    // 搜索：按名称/媒介/分类过滤（顶栏统一搜索，各分区共用同一关键词）
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(kw) ||
          (m.medium || '').toLowerCase().includes(kw) ||
          m.category.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [detail, cat, catItems, mjPresets, group, catGroup, keyword]);

  // ── 详情态：左大图 + 右信息（4 模式 + textarea + 复制/插入正文）──
  if (detail) {
    const modeText = detail[mode] || '';
    const big = detail.bigPreview || detail.preview;
    return (
      <div className="cl-mj-detail">
        <div className="cl-big">
          {/* ⚠️ 边框/圆角/底色落在 LazyImage 的**外层 div**（className），不是内部 img：
              LazyImage 渲染的是 `<div><img/></div>`，内部 img 由 imgClassName 控制 object-fit。
              此前把 flex-1/border 写在 CSS 的 `.cl-big img` 上，而 img 并非 .cl-big 的直接子级，
              弹性计算落到了外层 div 上 → 大图高度失控（2026-09-15 用户报「右边全跑下面去了」）。 */}
          {big ? (
            <LazyImage
              src={big}
              alt={detail.name}
              className="cl-big-img"
              imgClassName="w-full h-full object-contain"
            />
          ) : null}
          <p>
            {detail.medium || ''} · {detail.id.toUpperCase()}
            {detail.mixed ? ' · 混码组合' : ' · 单码'}
          </p>
        </div>
        <div className="cl-side">
          <h3>{detail.name}</h3>
          <p className="cl-desc">
            {detail.mixed
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
          <textarea value={modeText} readOnly />
          <div className="cl-row">
            <button type="button" className="cl-btn" onClick={() => setDetail(null)}>
              <ArrowLeft size={12} />
              返回列表
            </button>
            <span className="cl-sp" />
            <button
              type="button"
              className="cl-btn"
              onClick={() => {
                void navigator.clipboard?.writeText(modeText);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
            >
              <Copy size={12} />
              {copied ? '已复制' : '复制'}
            </button>
            <button
              type="button"
              className="cl-btn is-primary"
              onClick={() => onApply(detail, modeText)}
            >
              插入正文
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 列表态：左栏题材分类 + 右侧网格 ──
  return (
    <>
      <nav className="cl-nav" aria-label="MJ 码图分类">
        <p className="cl-navlbl">按题材浏览</p>
        {topics.map((t) => {
          const open = !closedGroups.includes(t.name);
          const sum = t.cats.reduce((n, c) => n + (catItems[c]?.length || 0), 0);
          return (
            <div key={t.name}>
              <button
                type="button"
                className="cl-grp"
                onClick={() =>
                  setClosedGroups((s) => (open ? [...s, t.name] : s.filter((x) => x !== t.name)))
                }
              >
                <span>
                  {open ? '▾ ' : '▸ '}
                  {t.name}
                </span>
                <span className="cl-n">{sum}</span>
              </button>
              {open &&
                t.cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="cl-cat"
                    aria-current={cat === c}
                    onClick={() => setCat(c)}
                  >
                    <span className="cl-t">{c}</span>
                    <span className="cl-n">{catItems[c]?.length || 0}</span>
                  </button>
                ))}
            </div>
          );
        })}
      </nav>
      <div className="cl-col cl-mj-body">
        {/* 素材类型轴（副条位置已由外壳占用，这里作为内容区第一行的 pills）。
            padding 走 .cl-mj-body > .cl-subrow（样式表），不再内联写死 ——
            内联值脱离样式表，改左栏留白时这里不跟随，两侧就会错位。 */}
        <div className="cl-subrow">
          <div className="pk-pills">
            <button
              type="button"
              className="pk-pill"
              aria-pressed={!group}
              onClick={() => {
                setGroup(null);
                setCat(null);
              }}
            >
              全部 {mjPresets.length}
            </button>
            {Object.keys(groupCount).map((g) => (
              <button
                key={g}
                type="button"
                className="pk-pill"
                aria-pressed={group === g}
                onClick={() => {
                  setGroup(g);
                  setCat(null);
                }}
              >
                {GROUP_LABEL[g] || g} {groupCount[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="cl-grid">
          {displayItems.map((m) => (
            <article
              key={m.id}
              className="cl-card-item"
              title={m.name}
              onClick={() => {
                setCat(m.category);
                setDetail(m);
                setMode('codes');
              }}
            >
              {m.preview && <LazyImage src={m.preview} alt={m.name} className="absolute inset-0" />}
              <div className="cl-name">
                <p>{m.name}</p>
              </div>
            </article>
          ))}
          {displayItems.length === 0 && <p className="cl-empty">先在左栏选一个题材分类</p>}
        </div>
      </div>
    </>
  );
}
