import React from 'react';
import {
  X,
  Check,
  Image as ImageIcon,
  MessageSquare,
  Video as VideoIcon,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RawModel } from '@/components/base/utils/providerModels';

/**
 * 拉取模型结果弹窗（勾选式保存）。
 * 拉取成功后不直接全量填进 provider，而是让用户勾选要保留的模型，点「确定」才写入。
 * 三栏（生图/聊天/视频）各自可全选/取消，顶部带搜索过滤。
 *
 * props：
 *  - open: boolean
 *  - fetched: { image_models, chat_models, video_models }  后端拉回的原始分类结果
 *  - existing: { image_models, chat_models, video_models }  当前 provider 已存的模型（用于默认勾选）
 *  - fetching: boolean                                      拉取中（弹窗内展示 loading 态）
 *  - onClose: () => void                                    取消（不写入）
 *  - onConfirm: (selected) => void                          selected = { image_models, chat_models, video_models }
 */

type ModelCatKey = 'image_models' | 'chat_models' | 'video_models';

export interface FetchedModelGroup {
  image_models?: RawModel[];
  chat_models?: RawModel[];
  video_models?: RawModel[];
}

const CATS: Array<{ key: ModelCatKey; label: string; Icon: LucideIcon }> = [
  { key: 'chat_models', label: '聊天模型', Icon: MessageSquare },
  { key: 'image_models', label: '生图模型', Icon: ImageIcon },
  { key: 'video_models', label: '视频模型', Icon: VideoIcon },
];

const modelId = (m: RawModel) => (m && (m.id || m.label)) || '';
const modelLabel = (m: RawModel) => (m && (m.label || m.id)) || '';

interface FetchModelsModalProps {
  open: boolean;
  fetched: FetchedModelGroup | null;
  existing: FetchedModelGroup | null;
  fetching: boolean;
  onClose: () => void;
  onConfirm: (selected: FetchedModelGroup) => void;
}

export default function FetchModelsModal({
  open,
  fetched,
  existing,
  fetching: _fetching,
  onClose,
  onConfirm,
}: FetchModelsModalProps) {
  // selected: { [catKey]: Set<modelId> }，仅存勾选中的 id 集合
  const [selected, setSelected] = React.useState({
    image_models: new Set<string>(),
    chat_models: new Set<string>(),
    video_models: new Set<string>(),
  });
  const [keyword, setKeyword] = React.useState('');
  const [tabKey, setTabKey] = React.useState('image_models');

  // 每次打开 / fetched 变化时，初始化为空（默认全不选，由用户自己勾）。
  React.useEffect(() => {
    if (!open || !fetched) return;
    setSelected({ image_models: new Set(), chat_models: new Set(), video_models: new Set() });
    setKeyword('');
    // 默认切到第一个有数据的分类 tab
    const first = CATS.find((c) => (fetched[c.key] || []).length > 0);
    setTabKey(first ? first.key : 'image_models');
  }, [open, fetched]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const fetchedList = fetched || { image_models: [], chat_models: [], video_models: [] };
  const kw = keyword.trim().toLowerCase();

  const toggle = (catKey: ModelCatKey, id: string) => {
    setSelected((prev) => {
      const next = new Set(prev[catKey]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [catKey]: next };
    });
  };

  const setCatAll = (catKey: ModelCatKey, on: boolean) => {
    setSelected((prev) => {
      const ids = (fetchedList[catKey] || []).map(modelId);
      const next = new Set(prev[catKey]);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...prev, [catKey]: next };
    });
  };

  const totalSelected = CATS.reduce((n, c) => n + selected[c.key].size, 0);
  const totalAll = CATS.reduce((n, c) => n + (fetchedList[c.key] || []).length, 0);

  const handleConfirm = () => {
    // 合并：勾选的 = 本次拉到的且勾选的 ∪ 已存在但本次未拉到的且仍勾选的
    const out: FetchedModelGroup = {};
    for (const cat of CATS) {
      const existMap = new Map((existing?.[cat.key] || []).map((m) => [modelId(m), m]));
      const fetchedMap = new Map((fetchedList[cat.key] || []).map((m) => [modelId(m), m]));
      new Set([
        ...(fetchedList[cat.key] || []).map(modelId),
        ...selected[cat.key], // 含已存在但本次未拉到的（它们未必在 fetchedList 里）
      ]);
      const list: RawModel[] = [];
      for (const id of selected[cat.key]) {
        list.push(fetchedMap.get(id) || existMap.get(id) || { id, label: id });
      }
      out[cat.key] = list;
    }
    onConfirm(out);
  };

  return (
    <div className="st-overlay" onClick={onClose}>
      <div className="st-modal" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="st-modal-head">
          <span className="st-icon-badge">
            <Check size={18} />
          </span>
          <div className="st-grow">
            <h3 className="st-card-title">选择要保存的模型</h3>
            <p className="st-card-sub">默认不勾选，勾选需要保留的模型，点「确定」才写入</p>
          </div>
          <button className="st-icon-btn" type="button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        {/* 搜索 + 已选统计 */}
        <div className="st-modal-bar">
          <div className="st-search st-grow">
            <Search size={14} />
            <input
              className="st-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="过滤模型名…"
            />
          </div>
          <span className="st-hint">
            已选 <span className="st-strong">{totalSelected}</span> / 共 {totalAll}
          </span>
        </div>

        {/* tab 栏 */}
        <div className="st-modal-bar">
          <div className="st-tabs">
            {CATS.map((cat) => {
              const Icon = cat.Icon;
              const cnt = (fetchedList[cat.key] || []).length;
              return (
                <button
                  key={cat.key}
                  className={`st-tab${tabKey === cat.key ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setTabKey(cat.key)}
                >
                  <Icon size={14} />
                  {cat.label}
                  <span className="st-tab-count">{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* body：当前 tab 的表格 */}
        <div className="st-modal-body">
          {CATS.filter((c) => c.key === tabKey).map((cat) => {
            const all = fetchedList[cat.key] || [];
            const filtered = kw
              ? all.filter(
                  (m) =>
                    modelId(m).toLowerCase().includes(kw) ||
                    modelLabel(m).toLowerCase().includes(kw),
                )
              : all;
            const selCount = selected[cat.key].size;
            const allChecked =
              all.length > 0 && all.every((m) => selected[cat.key].has(modelId(m)));
            return (
              <div key={cat.key} className="st-stack st-stack--sm">
                <div className="st-between">
                  <label className="st-inline">
                    <input
                      className="st-check"
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => setCatAll(cat.key, e.target.checked)}
                      disabled={all.length === 0}
                    />
                    <span className="st-label">全选本类</span>
                  </label>
                  <span className="st-hint">
                    已选 {selCount} / {all.length}
                  </span>
                </div>
                {all.length === 0 ? (
                  <div className="st-empty">无此类模型</div>
                ) : (
                  <table className="st-table">
                    <thead>
                      <tr>
                        <th>选</th>
                        <th>模型名</th>
                        <th>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => {
                        const id = modelId(m);
                        const checked = selected[cat.key].has(id);
                        return (
                          <tr key={id} className="is-clickable" onClick={() => toggle(cat.key, id)}>
                            <td>
                              <span className={`st-check-box${checked ? ' is-on' : ''}`}>
                                {checked && <Check size={12} />}
                              </span>
                            </td>
                            <td>{modelLabel(m)}</td>
                            <td className="st-mono">{id}</td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={3} className="st-hint">
                            无匹配「{keyword}」的模型
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="st-modal-foot">
          <span className="st-grow" />
          <button className="st-btn" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="st-btn st-btn--primary"
            type="button"
            onClick={handleConfirm}
            disabled={totalSelected === 0}
          >
            <Check size={14} /> 确定保存（{totalSelected}）
          </button>
        </div>
      </div>
    </div>
  );
}
