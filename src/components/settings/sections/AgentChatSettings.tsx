/**
 * 设置分区（由 `SettingsFrame` 静态 import 装配）。
 *
 * @public 跨边界消费者：src/components/settings/SettingsFrame.tsx
 */
import React from 'react';
import { Bot, Check } from 'lucide-react';
import { useProviders, load } from '@/components/settings/providerStore';
import { logger } from '@/components/base/core/log/logger';
import { showToast } from '@/components/base/core/event/toastStore';
import {
  loadAgentChatModel,
  saveAgentChatModel,
  loadAgentHistoryTurns,
  saveAgentHistoryTurns,
  type AgentStreamMode,
} from '@/components/agent/runtime/agentModelStore';
import SkillSettings from './SkillSettings';

/**
 * 设置分区 · AI 助手。
 *  - 聊天模型：全局指定 AI 助手对话用哪个供应商 + 模型
 *  - Skill 管理：合并在此分区（左列表 + 右编辑）
 * 更新(2026-09-23)：原写「样式对齐 SkillSettings 的 zinc 黑白系 / 仅样式统一到 Skill 面板风格」
 *   已失效 —— 设置页视觉整体重写，统一由 `settings.css`（前缀 `st-`）承担，本文件只写结构类名。
 */
export default function AgentChatSettings() {
  const { providers } = useProviders();
  const saved = loadAgentChatModel();
  const [providerId, setProviderId] = React.useState(saved?.providerId || '');
  const [modelId, setModelId] = React.useState(saved?.modelId || '');
  const [streamMode, setStreamMode] = React.useState(saved?.streamMode || 'stream');
  const [historyTurns, setHistoryTurns] = React.useState(() => String(loadAgentHistoryTurns())); // 历史回传轮数（数字输入，存字符串便于自由输入）

  React.useEffect(() => {
    if (!providers || providers.length === 0)
      load().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 可作聊天用的供应商 = 已启用(enabled)且有 chat_models 或 primary（排除未启用的内置厂商——
  // 避免显示内置 manifest 的模型，只显示用户实际配置/启用的厂商模型，与全局「配置的才显示」一致）。
  const chatProviders = (providers || []).filter((p) => {
    const hasChat = Array.isArray(p.chat_models) && p.chat_models.length > 0;
    return (hasChat || p.primary) && p.enabled !== false;
  });

  const selectedProvider =
    chatProviders.find((p) => p.id === providerId) || chatProviders[0] || null;
  const chatModels = (selectedProvider?.chat_models || [])
    .map((m) => m.id || m.label || '')
    .filter(Boolean);
  const modelOptions = Array.from(new Set(chatModels)) as string[];
  const effectiveModelId = modelOptions.includes(modelId) ? modelId : modelOptions[0] || '';

  const handleProviderChange = (pid: string) => {
    setProviderId(pid);
    const p = chatProviders.find((x) => x.id === pid);
    const models = (p?.chat_models || []).map((m) => m.id || m.label || '').filter(Boolean);
    const first = models[0] || '';
    setModelId(first);
    if (pid && first) {
      saveAgentChatModel({ providerId: pid, modelId: first, streamMode });
      showToast(`AI 聊天模型已设为 ${first}`, { type: 'success' });
    }
  };

  const handleModelChange = (mid: string) => {
    setModelId(mid);
    if (providerId && mid) {
      saveAgentChatModel({ providerId, modelId: mid, streamMode });
      showToast(`AI 聊天模型已设为 ${mid}`, { type: 'success' });
    }
  };

  const handleStreamModeChange = (mode: AgentStreamMode) => {
    setStreamMode(mode);
    saveAgentChatModel({ providerId, modelId, streamMode: mode });
    showToast(mode === 'non-stream' ? '已设为非流式（不支持工具调用，仅对话）' : '已设为流式', {
      type: 'success',
    });
  };

  // 【过渡方案·2026-08-18】历史回传轮数：0=不回传、1=只上一轮、任意大=尽量多（≈不限）。
  // 允许自由输入任意非负整数；非法输入忽略不保存。实时读，下次发送立即生效。
  const handleHistoryTurnsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHistoryTurns(raw); // 保留用户输入，允许临时为空/半输入
    if (raw === '') return; // 空：暂存，不保存（等填完）
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return; // 非法（负号/非数字）不保存
    saveAgentHistoryTurns(Math.floor(n));
    showToast(
      n === 0
        ? '已设为不回传历史'
        : n === 1
          ? '已设为只回传上一轮'
          : `已设为回传最近 ${Math.floor(n)} 轮`,
      { type: 'success' },
    );
  };

  return (
    <>
      <section className="st-section">
        <div>
          <h3 className="st-section-title">
            <Bot size={15} /> AI 助手聊天模型
          </h3>
          <p className="st-section-sub">选择画布 AI 助手的对话模型</p>
        </div>
        <div className="st-card">
          <p className="st-hint">
            AI
            助手在画布右侧面板的对话会用这里指定的模型。默认取聊天供应商的第一个模型；可在此手动指定。
          </p>

          {chatProviders.length === 0 ? (
            <div className="st-notice">
              暂无可用的聊天供应商，请先在「第三方 API 配置」添加并拉取聊天模型
            </div>
          ) : (
            <div className="st-fields">
              <label className="st-field">
                <span className="st-label">聊天供应商</span>
                <select
                  className="st-select"
                  value={selectedProvider?.id || ''}
                  onChange={(e) => handleProviderChange(e.target.value)}
                >
                  {chatProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                      {p.primary ? '（主）' : ''}
                    </option>
                  ))}
                </select>
                {selectedProvider && modelOptions.length === 0 && (
                  <span className="st-hint">该供应商暂无聊天模型，请先在模型清单中添加</span>
                )}
              </label>

              <label className="st-field">
                <span className="st-label">聊天模型</span>
                <select
                  className="st-select"
                  value={effectiveModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={modelOptions.length === 0}
                >
                  {modelOptions.length === 0 ? (
                    <option value="">暂无模型</option>
                  ) : (
                    modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="st-field">
                <span className="st-label">响应方式</span>
                <select
                  className="st-select"
                  value={streamMode}
                  onChange={(e) => handleStreamModeChange(e.target.value as AgentStreamMode)}
                >
                  <option value="stream">流式（推荐，支持工具调用）</option>
                  <option value="non-stream">非流式（仅对话，不支持工具）</option>
                </select>
              </label>
            </div>
          )}

          {providerId && modelId && (
            <div className="st-chip st-chip--ok">
              <Check size={12} /> 当前 AI 聊天模型：{modelId}
            </div>
          )}
        </div>
      </section>

      {/* 历史回传轮数（过渡方案·2026-08-18）：解决纯文字对话失忆 */}
      <section className="st-section">
        <div>
          <h3 className="st-section-title">
            <Bot size={15} /> 历史回传轮数
          </h3>
          <p className="st-section-sub">让 AI 记得上一轮说过什么（仅文字）</p>
        </div>
        <div className="st-card">
          <p className="st-hint">
            AI 助手默认只处理你最新的一句话（fresh-task
            机制），可能导致「先反推提示词、再让它优化」时它忘了上文。这里可让它回传最近 N 轮对话的
            <b>文字</b>
            。图片始终以编号引用、不会真图进上下文，不影响出图安全。
          </p>
          <div className="st-inline">
            <input
              className="st-input st-input--num"
              type="number"
              min="0"
              step="1"
              value={historyTurns}
              onChange={handleHistoryTurnsChange}
            />
            <span className="st-hint">
              0 = 不回传（默认行为）· 1 = 只上一轮 · 任意大 = 尽量多（约等于不限）
            </span>
          </div>
        </div>
      </section>

      {/* Skill 管理（与 AI 助手设置合并）：左列表 + 右编辑同屏 */}
      <SkillSettings />
    </>
  );
}
