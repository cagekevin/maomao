import React from 'react';
import { Settings as SettingsIcon, Bot, Sliders, HardDrive, type LucideIcon } from 'lucide-react';
import ApiSettings from '@/components/settings/sections/ApiSettings';
import AgentChatSettings from '@/components/settings/sections/AgentChatSettings';
import OtherSettings from '@/components/settings/sections/OtherSettings';
import StorageMonitor from '@/components/settings/sections/StorageMonitor';
// 设置页专属样式层（用户 2026-09-23 裁定：与画布原子类解耦，整页视觉收在此文件）
import './settings.css';

/**
 * 设置主框架（侧栏 + 舞台）。
 *
 * 【样式现状 · 2026-09-23 重写】原写「风格照抄官方 Vr.jsx 设置页：容器 bg-canvas / 侧栏 w-48 /
 * 导航项激活 text-blue-500 font-bold / 内容区 max-w-4xl」——**该描述已失效**：用户裁定设置页
 * 整体重写为苹果式简约，且**辅助色只允许红与绿、不准出现蓝色**，原 `text-blue-500` 正违反此条。
 * 现全部样式移入 `settings.css`（前缀 `st-`），本文件只留结构类名；改外观去 settings.css。
 */
/** 侧栏导航项（icon 用 lucide 组件，comp 是对应 section 组件名，供 renderSection 分发）。 */
interface SectionNav {
  key: string;
  label: string;
  icon: LucideIcon;
  comp: 'ApiSettings' | 'AgentChatSettings' | 'OtherSettings' | 'StorageMonitor';
}

const SECTIONS: SectionNav[] = [
  // 2026-08-18：AI 助手改得频繁，提到第一个，默认选中它
  { key: 'agent', label: 'AI 助手', icon: Bot, comp: 'AgentChatSettings' },
  { key: 'api', label: '第三方API配置', icon: SettingsIcon, comp: 'ApiSettings' },
  // 2026-08-21：其他设置（画布显示/图片偏好收口）
  { key: 'other', label: '其他设置', icon: Sliders, comp: 'OtherSettings' },
  // 2026-08-27：存储监控从"更多设置"折叠组移出，独立成项
  { key: 'storage', label: '存储监控', icon: HardDrive, comp: 'StorageMonitor' },
];

export default function SettingsFrame() {
  const [active, setActive] = React.useState('agent');

  return (
    <div className="st-root">
      {/* 左侧栏 */}
      <aside className="st-side">
        <div className="st-side-head">
          <span className="st-side-title">设置</span>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`st-nav-item${active === s.key ? ' is-active' : ''}`}
            >
              <Icon size={16} className="st-nav-icon" />
              <span className="st-nav-label">{s.label}</span>
            </button>
          );
        })}
      </aside>

      {/* 内容区 */}
      <main className="st-main nowheel nopan nodrag">
        <div className="st-main-inner">{renderSection(active)}</div>
      </main>
    </div>
  );
}

function renderSection(key: string) {
  switch (key) {
    case 'api':
      return <ApiSettings />;
    case 'agent':
      return <AgentChatSettings />;
    case 'other':
      return <OtherSettings />;
    case 'storage':
      return <StorageMonitor />;
    default:
      return <div className="st-empty">该设置分区尚未实现</div>;
  }
}
