/**
 * M4-C 主应用外壳 — 严格按照原版 App.js 布局结构
 */

import React, { useState } from 'react';
import { useUIStore } from './stores/uiStore';
import { useLocalToolStatus } from './hooks/useLocalToolStatus';
import CanvasPanel from './components/CanvasPanel';
import { APP_VERSION } from '../_engine/config.js';

// ── 图标组件（对齐原版 lucide-react 图标）──

function SettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MoreHorizontalIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function UploadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function GlobeIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// ── 项目选择器组件（对齐原版 App.js L44182-44215）──

interface Project {
  id: string;
  name: string;
}

function ProjectSelector({
  projects,
  currentProjectId,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
}: {
  projects: Project[];
  currentProjectId: string;
  onSwitchProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
}) {
  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <div className="flex items-center gap-1 group/project-selector relative">
      {/* 下拉触发按钮 */}
      <div className="relative group/project-dropdown cursor-pointer">
        <div className="flex items-center gap-1 bg-transparent text-gray-300 text-sm hover:text-white pl-2 pr-2 py-1 outline-none min-w-[100px] pb-1.5 z-10 relative">
          <span className="truncate max-w-[120px]">
            {currentProject?.name || '选择项目'}
          </span>
          <ChevronDownIcon size={14} />
        </div>
        {/* 底部下划线装饰 */}
        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-white/10 group-hover/project-dropdown:bg-white transition-colors pointer-events-none rounded-full" />

        {/* 下拉菜单 */}
        <div className="absolute left-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/project-dropdown:opacity-100 group-hover/project-dropdown:visible transition-all duration-200 z-[100] overflow-hidden py-1">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSwitchProject(project.id)}
              className={`px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2 hover:bg-[#333] transition-colors ${
                project.id === currentProjectId ? 'text-white bg-[#222]' : 'text-gray-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${project.id === currentProjectId ? 'bg-green-500' : 'bg-transparent'}`} />
              <span className="truncate">{project.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 新建项目按钮（对齐原版 L44216-44241） */}
      <button
        onClick={onCreateProject}
        className="text-gray-400 hover:text-white transition-colors p-1 ml-1"
        title="新建项目"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* 更多菜单（导入/导出/删除，对齐原版 L44241-44274） */}
      <div className="relative group/more-menu">
        <button
          className="text-gray-500 hover:text-white transition-colors p-1 flex items-center justify-center"
        >
          <MoreHorizontalIcon size={16} />
        </button>
        <div className="absolute right-0 top-full mt-2 w-44 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/more-menu:opacity-100 group-hover/more-menu:visible transition-all duration-200 z-[100] overflow-hidden py-1">
          {/* 导入项目 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('import-project'))}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2"
          >
            <UploadIcon size={14} />
            导入项目
          </button>
          {/* 导出项目 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('export-project'))}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2"
          >
            <DownloadIcon size={14} />
            导出项目
          </button>
          {/* 删除项目（仅项目数 > 1 时显示） */}
          {projects.length > 1 && (
            <button
              onClick={() => onDeleteProject(currentProjectId)}
              className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-[#333] hover:text-red-300 flex items-center gap-2"
            >
              <TrashIcon size={14} />
              删除项目
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 主应用外壳 ──

export default function AppShell() {
  const { activeTab, setActiveTab, showTaskCenter, setShowTaskCenter } = useUIStore();
  const engineStatus = useLocalToolStatus();
  const [loading, setLoading] = useState(true);

  // 项目数据（后续接入 projectStore）
  const [projects] = useState<Project[]>([{ id: 'default', name: '默认项目' }]);
  const [currentProjectId] = useState('default');

  const handleSwitchProject = (id: string) => {
    // TODO: 接入 projectStore
    console.log('[AppShell] 切换项目:', id);
  };

  const handleCreateProject = () => {
    // TODO: 接入 projectStore
    const name = prompt('项目名称:');
    if (name) {
      console.log('[AppShell] 新建项目:', name);
    }
  };

  const handleDeleteProject = (id: string) => {
    // TODO: 接入 projectStore
    console.log('[AppShell] 删除项目:', id);
  };

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0c0c]">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d0c0c] flex-col font-sans text-gray-200">
      {/* 顶部导航栏（对齐原版 App.js L44134） */}
      <div className="bg-[#0d0c0c] flex items-center justify-between px-4 relative z-20 flex-shrink-0 h-16 pt-2 pb-2">
        {/* 左: Logo "一毛AI" */}
        <div
          className="flex items-center gap-2 cursor-pointer relative group/logo"
          onClick={() => setActiveTab('canvas')}
          title="返回画布"
        >
          <span className="text-lg font-bold text-white">{APP_BRAND}</span>
        </div>

        {/* 中: Tab 按钮组 + 项目选择器（仅 canvas tab） */}
        <div className="flex items-center gap-2">
          {/* Tab 按钮组（对齐原版 L44167-44181） */}
          <div className="flex items-center bg-[#151414] rounded-full p-1">
            {([
              { key: 'canvas', label: '画布' },
              { key: 'transit', label: '资源' },
              { key: 'accounts', label: '多开' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeTab === key ? 'bg-white text-black' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 项目选择器（仅 canvas tab 显示，对齐原版 L44182-44274） */}
          {activeTab === 'canvas' && (
            <ProjectSelector
              projects={projects}
              currentProjectId={currentProjectId}
              onSwitchProject={handleSwitchProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </div>

        {/* 右: 设置 + 任务中心 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('settings')}
            className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525] ${
              activeTab === 'settings' ? 'bg-[#252525] text-white' : ''
            }`}
            title="设置"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={() => setShowTaskCenter(!showTaskCenter)}
            className="relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525]"
            title="任务中心"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 relative overflow-hidden bg-[#0d0c0c]">
        {/* accounts 面板 */}
        <div className={`absolute inset-0 flex flex-col ${activeTab === 'accounts' ? 'visible z-10' : 'invisible -z-10'}`}>
          <div className="flex items-center justify-center h-full text-gray-500">多开管理（开发中）</div>
        </div>

        {/* transit/资源 面板 */}
        <div className={`absolute inset-0 flex flex-col bg-[#0d0c0c] ${activeTab === 'transit' ? 'visible z-10' : 'invisible -z-10'}`}>
          <div className="flex items-center justify-center h-full text-gray-500">资源面板（开发中）</div>
        </div>

        {/* canvas 面板 */}
        <div className={`absolute inset-0 w-full h-full bg-[#0d0c0c] flex flex-col ${activeTab === 'canvas' ? 'visible z-10' : 'invisible -z-10'}`}>
          <CanvasPanel />
          {/* 引擎状态指示器（对齐原版 L44846-44892） */}
          <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/15 tabular-nums select-none leading-none" title="当前版本">
              v{APP_VERSION}
            </span>
            <div
              className={`flex items-center gap-2 rounded-full bg-[#151414] border shadow-lg transition-all ${
                engineStatus.isConnected
                  ? 'justify-center w-8 h-8 border-[#333]'
                  : 'px-3 py-1.5 border-red-500/30 bg-red-950/20'
              }`}
              title={engineStatus.isConnected ? '本地引擎已连接' : '本地引擎未启动'}
            >
              {engineStatus.isConnected ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="text-xs font-medium text-red-400 animate-pulse">本地引擎未启动</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* appcenter 面板 */}
        <div className={`absolute inset-0 ${activeTab === 'appcenter' ? 'visible z-10' : 'invisible -z-10'}`}>
          <div className="flex items-center justify-center h-full text-gray-500">应用中心（开发中）</div>
        </div>

        {/* settings 面板（对齐原版 L44976） */}
        <div className={`absolute inset-0 flex bg-[#0d0c0c] overflow-hidden ${activeTab === 'settings' ? 'visible z-10' : 'invisible -z-10'}`}>
          <div className="w-48 bg-[#0d0c0c] border-r-0 flex flex-col p-3 z-10 flex-shrink-0">
            <span className="text-gray-500 text-sm">设置（开发中）</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 relative pb-24 bg-[#0d0c0c]">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              <span className="text-gray-500">设置内容（开发中）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
