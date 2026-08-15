# vendor/ — 上游 Lovart 客户端（只读参考快照）

本目录**不参与 gateway 运行**，仅作为审计与 provenance 的对照基准。

## 文件

- `agent_skill.py` — Lovart 官方上游客户端（**真源**）。
- `lovart 官方资料.md` — 上游官方 `README.md`（原文件名，已改名），含端点/字段/用法说明，审计时对照参考。
- `SKILL.md` — 上游技能描述文件（坚果云目录另有，未复制；如需可补）。
  - 来源：`/Users/kevin/Nutstore Files/我的坚果云/技能仓库/skills/lovart/agent_skill.py`
  - 形态：sync、`urllib` 实现、零依赖、`AgentSkill` 类。
  - 快照日期：2026-07-16
  - **只读**：请勿修改，请勿被 gateway import。

## 与运行代码的关系

| 文件 | 角色 | 是否运行 |
|---|---|---|
| `vendor/agent_skill.py` | 上游真源（sync / urllib） | 否，仅参考 |
| `lovart_client.py` | vendored 副本（async / httpx） | **是，gateway 实际调用** |

`lovart_client.py` 从本文件 vendored 而来，改造点：

1. **sync → async**：`urllib` 请求改为 `httpx.AsyncClient`。
2. **网关适配**：业务错误翻译 `_biz_code_to_http`、对外错误形状 `lovart_err_to_response`。
3. **封装**：`set_mode` / `query_mode` / `confirm` / `upload_file` 等网关所需能力。
4. 签名算法（HMAC-SHA256）与上游**完全一致**，未改动。

## 用法（审计）

需要「gateway → 上游」真实 diff 时，对照 `lovart_client.py` 与 `vendor/agent_skill.py`：

```bash
diff vendor/agent_skill.py lovart_client.py   # 看 vendored 漂移
```

上游在坚果云更新后，重新 `cp` 覆盖本文件即可刷新基准，再跑 `python3 verify_gateway.py`。
