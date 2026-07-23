// ============================================================
// 猫猫AI画布 - Service Worker (background.js)
// 职责：右键菜单、资源采集存储、侧边栏管理
// ============================================================

// -------- 扩展安装/启动时注册右键菜单 --------
function initContextMenu() {
  chrome.contextMenus.create(
    {
      id: 'save-to-transit',
      title: '发送到资源',
      contexts: ['image', 'video', 'audio', 'selection'],
    },
    () => {
      if (chrome.runtime.lastError) {
        // 忽略已存在的错误
      }
    }
  );
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    initContextMenu();
  });
});

chrome.runtime.onStartup.addListener(() => {
  initContextMenu();
});

// 确保右键菜单始终存在（开发模式下可能漏掉 onInstalled）
initContextMenu();

// -------- 扩展更新时自动重载 --------
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Update available:', details.version);
  chrome.runtime.reload();
});

// -------- 扩展图标点击 -> 打开侧边栏 --------
chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.windowId && chrome.sidePanel?.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

// -------- 右键菜单点击 -> 采集资源 --------
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save-to-transit') {
    handleSaveToTransit(info, tab);
  }
});

interface TransitResource {
  id: string;
  url: string;
  type: string;
  timestamp: number;
  pageUrl: string | undefined;
  pageTitle: string | undefined;
  source: string;
}

async function handleSaveToTransit(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab | undefined
) {
  let resourceUrl = info.srcUrl || '';
  let type: string = info.mediaType || 'image';

  // 文本选择
  if (info.selectionText) {
    type = 'text';
    resourceUrl = info.selectionText;
  }

  if (!resourceUrl) return;

  // 直接使用原始 URL，不再经过本地引擎上传
  const newResource: TransitResource = {
    id: Date.now().toString(),
    url: resourceUrl,
    type: type,
    timestamp: Date.now(),
    pageUrl: info.pageUrl,
    pageTitle: tab ? tab.title : '未知页面',
    source: 'extension',
  };

  // 保持 storage.local 最多 5 条（避免 OOM），App 侧会用 localforage 接管
  chrome.storage.local.get(['transitResources'], (result: { transitResources?: unknown }) => {
    let resources: TransitResource[] = [];
    const raw = result.transitResources;
    if (Array.isArray(raw)) resources = raw as TransitResource[];

    resources = [newResource, ...resources].slice(0, 5);

    chrome.storage.local.set({ transitResources: resources }, () => {
      // 通知侧边栏
      chrome.runtime.sendMessage(
        { action: 'resourceAdded', resource: newResource },
        () => {
          if (chrome.runtime.lastError) {
            // 侧边栏未打开时忽略
          }
        }
      );

      // 尝试打开侧边栏
      if (tab && tab.windowId && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      }
    });
  });
}