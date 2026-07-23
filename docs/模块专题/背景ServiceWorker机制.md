# 背景 Service Worker 机制（待补全）

> 本文件为占位骨架。请按 `docs/模块专题/` 现有文档风格补全内容。
> 核心要求：**所有 `文件:行号` 与函数名必须先在 `src/` 里 grep 验证，再写入**，不要凭空编造。

## 补全指引（请据此 grep 后展开正文）

- Service Worker 源码：`src/background.ts`（请读全文）。说明它在 Chrome 扩展里的角色（后台常驻、消息中转、定时任务、`chrome.alarms` / `chrome.runtime` 消息监听等）。
- 与其通信的前端入口：grep `chrome.runtime` / `sendMessage` / `background` 在 `src/App.js`、`src/entry.js` 等处的调用点（确认消息协议：前端发什么、SW 回什么）。
- 与「云同步 / 中转 / 生成轮询」是否有关：确认 SW 是否参与这些流程，还是仅做保活/通知。
- 与 `manifest.json`（扩展配置）的关系：SW 的注册方式、权限声明。

## 文档规范

- 中文、分节、用 grep 验证过的 `文件:行号` 引用 + 少量 verbatim 代码片段。
- 注意 `background.ts` 是 TypeScript，确认导出符号与调用点。
- 不改动任何源码，只产出本 `.md`。
- 写完后把本文件顶部「待补全」字样删除，并说明已补全。

（完成后请通知主 AI 审计，并同步更新 `README.md` 与 `审计与覆盖清单.md`。）
