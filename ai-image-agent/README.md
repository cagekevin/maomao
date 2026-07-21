# AI 生图 Agent（独立版）

一个从 Infinite-Canvas 画布中解耦出来的 **AI 生图对话 Agent**。完全独立运行，不依赖原画布项目，不回写画布，会话本地落盘。

- 直接模式：输入描述 → 立即生图
- 思维模式：多轮提问收集维度 → 生成提示词 → 生图
- 支持参考图 / 附件上传 / 提示词确认 / 修改上一轮图 / 刷新后恢复中断任务

---

## 一、环境要求

- Python 3.10+
- 依赖：`fastapi`、`uvicorn`、`httpx`、`pydantic`

```bash
pip install fastapi uvicorn httpx pydantic
```

---

## 二、配置 provider（必须）

Agent 只走 **OpenAI 兼容协议**（`/v1/images/generations` 与 `/v1/chat/completions`）。

1. 复制示例配置：

```bash
cd agent
cp api_providers.example.json api_providers.json
```

2. 编辑 `agent/api_providers.json`，填入你的 endpoint 与模型：

```json
[
  {
    "id": "my-service",
    "name": "我的生图服务",
    "base_url": "https://your-openai-compatible-endpoint.example.com/v1",
    "protocol": "openai",
    "enabled": true,
    "primary": true,
    "image_models": ["gpt-image-1", "your-image-model"],
    "chat_models": ["gpt-4o", "your-chat-model"],
    "api_key": ""
  }
]
```

- `base_url`：OpenAI 兼容服务的 base（带 `/v1` 或不带均可）
- `image_models`：生图模型列表（直接模式 / 思维模式生图用）
- `chat_models`：对话模型列表（思维模式理解用户意图用）
- `api_key`：可留空，改在 `.env` 里配置（见下）

3.（可选）用 `.env` 存 key，避免明文写进 json：

```bash
cp agent/.env.example agent/.env
# 编辑 .env：API_PROVIDER_MY_SERVICE_KEY=sk-xxxx
```

key 变量名规则：`API_PROVIDER_<PROVIDER_ID 大写，非字母数字转下划线>_KEY`，例如 id 为 `my-service` → `API_PROVIDER_MY_SERVICE_KEY`。

> 优先级：json 里的 `api_key` > 环境变量/`.env` 同名字段。

---

## 三、启动

在 `ai-image-agent/` 目录下：

```bash
python agent_server.py
# 或自定义端口
python agent_server.py --port 8788 --host 0.0.0.0
# 或用 uvicorn
uvicorn agent.app:app --port 8788
```

启动后浏览器打开：**http://localhost:8788/**

---

## 四、目录结构

```
ai-image-agent/
├── agent_server.py              # 启动入口
├── README.md
└── agent/
    ├── __init__.py
    ├── config.py                # 读取 api_providers.json + .env
    ├── client.py                # OpenAI 兼容生图/LLM 轻量客户端
    ├── backend.py               # Agent 业务逻辑（会话/编排引擎/状态机/路由）
    ├── app.py                   # 独立 FastAPI 应用
    ├── api_providers.example.json
    ├── .env.example
    ├── static/                  # 前端（完全自带，不依赖外部）
    │   ├── agent.html
    │   ├── agent.js
    │   ├── agent.css
    │   ├── vendor/js/lucide.js
    │   ├── js/theme.js
    │   └── images/logo.png
    ├── data/agent/{user_id}/    # 会话落盘（JSON）
    ├── output/                  # 生图结果图片（/agent/output/ 可访问）
    └── uploads/                 # 用户上传附件（/agent/uploads/ 可访问）
```

本文件夹可整体拷贝到任意机器，只需满足「环境要求」并配好 `api_providers.json` 即可运行。

---

## 五、API 速览

所有接口需带请求头 `X-User-Id`（用于隔离不同用户会话）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agent/conversations` | 会话列表 |
| POST | `/api/agent/conversations` | 新建会话 `{"title":"新对话"}` |
| GET | `/api/agent/conversations/{id}` | 打开会话 |
| DELETE | `/api/agent/conversations/{id}` | 删除会话 |
| POST | `/api/agent/conversations/{id}/messages` | 发消息 `{"text","attachments","bypassThinking"}` |
| POST | `.../prompts/confirm` | 确认单条提示词 |
| POST | `.../prompts/confirm-all` | 确认全部提示词 |
| POST | `.../prompts/cancel-all` | 取消全部 |
| POST | `.../prompts/edit` | 编辑提示词 |
| POST | `.../prompts/save-edit` | 保存编辑 |
| POST | `.../prompts/cancel-edit` | 取消编辑 |
| POST | `.../prompts/reopen` | 重新打开提示词 |
| POST | `.../prompts/regenerate` | 重新生成提示词 |
| POST | `.../recover` | 恢复中断的生图任务 |
| PUT | `.../settings` | 更新设置（genProvider/genModel/genRatio/.../thinkingMode/chatProvider/chatModel/skills） |
| POST | `/api/upload` | 附件上传（form-data `file`），返回 `{"url"}` |
| WS | `/ws/agent` | 实时推送（生图完成 / LLM 完成） |

---

## 六、设计说明（解耦边界）

- **不依赖原画布项目**：`backend.py` 不 `import` 原 `main.py`；生图/LLM 由自带 `client.py` 直调 OpenAI 兼容接口；provider 由 `config.py` 从 `agent/api_providers.json` 读取。
- **T3 不回写画布**：生图结果只写入 Agent 会话，绝不创建/修改画布节点。
- **T4 会话落盘**：会话存 `agent/data/agent/{user_id}/{id}.json`，刷新/重启可恢复。
- **T6 不重构**：业务逻辑（思维模式/提示词状态机/确认流程/生图编排/恢复）从原 Agent 实现逐字搬运，仅替换底层依赖。
- **WebSocket**：自带 `AgentWSManager`，仅广播 `agent_llm_done` / `agent_gen_done` 事件。

---

## 七、常见问题

**Q：发消息返回「未配置生图模型」？**
A：`api_providers.json` 里没有 `enabled` 且含 `image_models` 的 provider，或没配 `base_url`/`api_key`。

**Q：生图没反应 / 报错？**
A：检查 `base_url` 是否为 OpenAI 兼容、模型名是否在 `image_models` 内、key 是否有效。日志会打印接口错误详情。

**Q：思维模式需要额外配置吗？**
A：需要 provider 同时配了 `chat_models`（理解模型）和 `image_models`（生图模型）。

**Q：参考图/附件怎么用？**
A：页面点上传按钮，或直接把图片拖进输入框；生图时按提示选择引用上一轮图或附件。
