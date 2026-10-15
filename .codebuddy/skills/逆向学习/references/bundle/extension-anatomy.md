# 浏览器扩展解剖（判断目标是不是扩展 / 扩展结构清单）

> 用于目标为 **Chrome / Edge / Firefox 扩展**（`.crx` / `.xpi` / 解压目录）的场景。
> 若目标是**普通网页 JS**（签名/加密/风控），转 `references/runtime/overview.md`。
> 移植自通用逆向库的 `browser-extension-reverse`，已剥离其 MCP / 路由依赖。

---

## 1. 先判断目标类型

| 目标 | 走哪条 |
|---|---|
| 扩展包（`.crx`/`.xpi`/解压目录，有 `manifest.json`） | **本文件**（结构解剖）+ `SKILL.md` 主线（若产物是混淆 dist） |
| 普通网页 JS | `references/runtime/overview.md` |
| 恶意扩展 IOC / 供应链投毒调查 | 本文件 + 供应链安全方法论 |

---

## 2. 工作流

### 第 1 步 · 包体
```
□ crx 解压 / 从浏览器 profile 取扩展目录
□ manifest.json：permissions、host_permissions、background、content_scripts
□ 评估过度权限（<all_urls>、webRequest、debugger 是重点）
```

### 第 2 步 · 逻辑
```
□ service_worker / background 入口
□ content_script 注入点与执行世界（isolated / main）
□ chrome.storage / IndexedDB 里的密钥
□ 网络与消息传递：chrome.runtime.sendMessage / onMessage
```

### 第 3 步 · 动态
```
□ 开发者模式加载解压目录
□ chrome://extensions 检查错误
□ DevTools 附加 service worker（chrome://serviceworker-internals 辅助）
□ 必要时用 CDP / Playwright（本分支 `scripts/verifiers/AI01_ext/verify_ext.cjs` 已可加载 MV3 扩展并抓异常）
```

---

## 3. 工具链

| 工具 | 用途 |
|---|---|
| 解压工具 + `jq` | 读 manifest / 权限面 |
| Chrome DevTools | service worker / content script 调试 |
| CDP / Playwright | 自动化加载 + 抓 console / pageerror / sw 异常 |
| YARA | 恶意扩展特征规则 |

---

## 4. 自检清单

- [ ] 是否列出**权限面**与**入口脚本**？
- [ ] 是否还原关键**数据流**（storage / messaging / 网络）？
- [ ] 是否确认 `manifest_version`（MV2 / MV3 决定 background 形态）？
- [ ] MV3 是否检查了 `host_permissions` 与 `web_accessible_resources`？
