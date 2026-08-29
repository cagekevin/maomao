# vendor/ — 上游 Lovart 客户端（只读参考快照）

本目录**不参与 gateway 运行**，仅作为审计与 provenance 的对照基准。

## 文件

- `agent_skill.py` — Lovart 官方上游客户端（**真源**，sync / urllib，零依赖 `AgentSkill` 类）。
- `SKILL.md` — 上游技能描述文件（含完整模型表与调用规则）。
- `lovart 官方资料.md` — 上游官方参考说明，审计时对照参考。
- **只读**：请勿修改，请勿被 gateway import。

## 与运行代码的关系

| 文件 | 角色 | 是否运行 |
|---|---|---|
| `vendor/agent_skill.py` | 上游真源（sync / urllib） | 否，仅参考 |
| `lovart_client.py` | vendored 副本（async / httpx） | **是，gateway 实际调用** |

`lovart_client.py` 从 `vendor/agent_skill.py` vendored 而来，改造点：

1. **sync → async**：`urllib` 请求改为 `httpx.AsyncClient`。
2. **网关适配**：业务错误翻译 `_biz_code_to_http`、对外错误形状 `lovart_err_to_response`。
3. **封装**：`set_mode` / `query_mode` / `confirm` / `upload_file` 等网关所需能力。
4. 签名算法（HMAC-SHA256）与上游**完全一致**，未改动。

## 用法（审计）

需要「gateway → 上游」真实 diff 时，对照 `lovart_client.py` 与 `vendor/agent_skill.py`：

```bash
diff vendor/agent_skill.py lovart_client.py   # 看 vendored 漂移
```

上游更新后，重新 `cp` 覆盖本文件即可刷新基准，再跑 `python3 verify_gateway.py`。

---

# 上游官方文档（Lovart Agent OpenAPI Skill）

> 以下内容整理自上游 `README_CN.md`，用于说明客户端能力。凭证与环境变量与 gateway 一致。

## 功能

- 🖼️ **图片生成** — 海报、Logo、插画、Banner、Mockup 等
- 🎬 **视频生成** — 短片、动画、产品视频
- 🎵 **音频生成** — BGM、歌曲、音效
- ✂️ **图片/视频编辑** — 超分辨率、重构图、风格迁移
- 🧊 **3D 生成** — 从文本或图片生成 3D 模型
- 📁 **项目与会话管理** — 多项目支持，本地状态持久化

## 凭证

```bash
export LOVART_ACCESS_KEY="ak_xxx"
export LOVART_SECRET_KEY="sk_xxx"
```

在 Lovart 平台获取 AK/SK（头像菜单 -> AK/SK 管理）。无第三方依赖，仅 Python 标准库。

## 快速开始

```bash
# 生成图片
python3 scripts/agent_skill.py chat --prompt "赛博朋克风格的猫，霓虹城市背景" --json --download

# 生成视频
python3 scripts/agent_skill.py chat --prompt "海浪拍打岩石，电影感" --json --download

# 生成 BGM
python3 scripts/agent_skill.py chat --prompt "lofi hip-hop, chill, study vibes" --json --download
```

## 命令一览

### 生成

| 命令 | 说明 |
|------|------|
| `chat` | 发送 prompt，等待全部完成后一次性返回结果。主命令。 |
| `watch` | 发送 prompt 并流式返回 artifacts（NDJSON，生成一张交付一张） |
| `send` | 发送 prompt，不等待（立即返回 thread_id） |
| `confirm` | 确认高消耗操作（如视频生成），然后等待完成 |
| `result` | 获取会话结果 |
| `status` | 查询会话状态 |

### 项目管理

| 命令 | 说明 |
|------|------|
| `projects` | 列出所有项目 |
| `project-add` | 添加并切换到一个项目 |
| `project-switch` | 切换当前项目（支持前缀匹配） |
| `project-rename` | 重命名项目 |
| `project-remove` | 删除项目及其会话 |
| `create-project` | 在服务端创建新空项目 |

### 配置

| 命令 | 说明 |
|------|------|
| `config` | 查看/更新本地配置（`~/.lovart/state.json`） |
| `threads` | 列出保存的会话历史 |
| `set-mode` | 切换快速（消耗积分）/ 无限（排队）模式 |
| `query-mode` | 查询当前生成模式 |

### 文件操作

| 命令 | 说明 |
|------|------|
| `upload` | 上传本地文件到 CDN（返回 URL） |
| `upload-artifact` | 上传 URL 资产到项目 |
| `download` | 从 URL 下载资产 |

## 生成模式（MUST use API，not prompt）

```bash
python3 scripts/agent_skill.py set-mode --fast        # 快速模式 — 消耗积分，无需排队
python3 scripts/agent_skill.py set-mode --unlimited   # 无限模式 — 免费，可能排队
python3 scripts/agent_skill.py query-mode             # 查询当前模式
```

## 频率限制

| 档位 | 接口 | 每分钟 | 每小时 |
|------|------|-------|-------|
| **Chat**（写接口） | `/chat`、`/chat/confirm` | 60 | 600 |
| **Query**（读接口） | `/chat/status`、`/chat/result`、`/project/*`、`/mode/*` 等 | 300 | 3000 |

超出返回 `HTTP 429`，响应头带 `Retry-After: 60`。每个 thread 同一时间只能运行一个生成任务，冲突返回 `HTTP 409`。Skill 对网络瞬时错误自动重试（3 次退避），频率限制和计费错误直接返回。

## 安全与隐私

- **本地状态**：读写 `~/.lovart/state.json`，不访问其他文件
- **外部请求**：只调用 Lovart API (`https://lgw.lovart.ai`) 和 Lovart CDN
- **API 密钥**：AK/SK 从环境变量读取，HMAC-SHA256 签名，密钥不落盘、不打印
- **TLS**：默认启用证书校验；仅公司代理/VPN 拦截 TLS 时，设置 `LOVART_INSECURE_SSL=1` 关闭

## 架构

```
用户 -> OpenClaw / Hermes Agent / Claude Code / 其他 AI 助手
         -> scripts/agent_skill.py (本 skill)
           -> Lovart OpenAPI (AK/SK HMAC-SHA256 签名认证)
             -> Lovart AI Agent (模型选择、流程编排)
               -> 生成的图片 / 视频 / 音频
```
