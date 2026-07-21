// background.js
// 监听扩展图标点击事件，打开侧边栏
chrome.action.onClicked.addListener(tab => {
  // Chrome 114+ supports opening side panel via action click
  if (tab && tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({
      windowId: tab.windowId
    }).catch(() => {});
  }
});

// 创建右键菜单的函数
const initContextMenu = () => {
  chrome.contextMenus.create({
    id: "save-to-transit",
    title: "发送到资源",
    contexts: ["image", "video", "audio", "selection"]
  }, () => {
    if (chrome.runtime.lastError) {/* ignore already exists error */}
  });
};

// 安装或更新时重新创建
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    initContextMenu();
  });
});

// 浏览器启动时确保存在
chrome.runtime.onStartup.addListener(() => {
  initContextMenu();
});

// 开发模式下（加载已解压的扩展程序）经常会漏掉 onInstalled，
// 所以在 service worker 顶层也尝试注册一次，确保随时可用。
initContextMenu();

// 监听扩展更新，强制立即生效，避免一直提示“正在更新”
chrome.runtime.onUpdateAvailable.addListener(details => {
  console.log("Update available: ", details.version);
  chrome.runtime.reload();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-transit") {
    let resourceUrl = info.srcUrl;
    let type = info.mediaType || "image"; // 'image', 'video', 'audio'

    // Check if it is text selection
    if (info.selectionText) {
      type = "text";
      resourceUrl = info.selectionText;
    }

    // 保存到 storage
    // 因为 transitResources 在 App.tsx 中已经迁移到 localforage (IndexedDB)，
    // 这里如果继续用 chrome.storage.local 存储大 Base64 可能会导致 OOM 或超限闪退 (QUOTA_BYTES_PER_ITEM).
    // 由于 service worker 无法直接使用 localforage，我们限制只在这里存最新的一条或只发送消息。
    // 为了不撑爆 storage，我们控制 storage.local.transitResources 最多只保留最新 5 条。
    chrome.storage.local.get(["transitResources"], async result => {
      let resources = result.transitResources || [];
      if (!Array.isArray(resources)) resources = [];
      console.log(">>>>>>>>>>>>>>>>>>>>>>chrome.storage.local");

      // 尝试调用本地引擎接口保存文件到 migrated 目录
      let finalUrl = resourceUrl;
      let finalSource = "extension";
      try {
        // 如果资源是 URL 或者 data URL，尝试直接下载并发送到本地引擎
        if (resourceUrl.startsWith("http") || resourceUrl.startsWith("data:") || resourceUrl.startsWith("blob:")) {
          const res = await fetch(resourceUrl);
          const blob = await res.blob();
          const ext = type === "image" ? "png" : type === "video" ? "mp4" : "mp3";
          const filename = `extension_capture_${Date.now()}.${ext}`;
          const formData = new FormData();
          formData.append("file", blob, filename);
          formData.append("subfolder", "migrated");
          const uploadRes = await fetch("http://127.0.0.1:18080/api/files/upload", {
            method: "POST",
            body: formData
          });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            finalUrl = data.url;
            finalSource = "local-tool";
          }
        }
      } catch (e) {
        console.log("Local engine upload failed or unavailable, fallback to base64/url", e);
      }
      const newResource = {
        id: Date.now().toString(),
        url: finalUrl,
        type: type,
        timestamp: Date.now(),
        pageUrl: info.pageUrl,
        pageTitle: tab ? tab.title : "未知页面",
        source: finalSource
      };

      // Keep only the latest 5 to avoid storage bloat/crash in extension background
      resources = [newResource, ...resources].slice(0, 5);
      chrome.storage.local.set({
        transitResources: resources
      }, () => {
        // 通知侧边栏更新 (App.tsx 会接管并存入不限容量的 localforage)
        // 使用 callback 并读取 chrome.runtime.lastError，避免侧边栏未打开或接收端未响应时在控制台产生
        // "Unchecked runtime.lastError: The message port closed before a response was received."
        chrome.runtime.sendMessage({
          action: "resourceAdded",
          resource: newResource
        }, () => {
          if (chrome.runtime.lastError) {
            // Ignore error if side panel is not open to receive message
            void chrome.runtime.lastError.message;
          }
        });

        // 尝试打开侧边栏 (如果未打开)
        if (tab && tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
          chrome.sidePanel.open({
            windowId: tab.windowId
          }).catch(() => {});
        }
      });
    });
  }
});