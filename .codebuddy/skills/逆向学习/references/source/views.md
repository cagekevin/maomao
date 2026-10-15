# 交叉视角清单（Phase 4 查表用）

> **为什么需要**：单一视角（只看 AI 能力边界）一定看漏东西。用 15 个视角交叉验证，每个视角揭示不同的架构信息。
> **执行顺序**：先做 P0 五个视角（必做），P1 / P2 按需。
> **验收标准**：见 `SKILL.md` 的 Phase 4（本文件只负责"查清单"，不重复写验收）。

| 优先级 | 视角 | 回答什么架构问题 | 怎么挖 |
|---|---|---|---|
| **P0** | 状态机 | 每个实体有多少状态？怎么转？ | 搜索所有 `status=` 赋值，按实体分组，画状态转换图 |
| **P0** | 数据模型关系 | 表和表什么时候 JOIN？谁依赖谁？ | 搜索所有 SQL JOIN / WHERE 外键关联，画 ER 图 |
| **P0** | 异步边界 | 哪些同步/哪些队列/哪些 background？ | 搜索 `asyncio.create_task\|asyncio.gather\|queue_worker\|_main_loop` |
| **P0** | 长任务生命周期 | 任务从提交到终态经历什么？进度/取消/超时/重启恢复怎么办？ | 搜索 `progress\|cancel\|abort\|checkpoint\|resume\|restart`，画任务时间轴 |
| **P0** | 失败降级链路 | 模型/上游挂了怎么兜底？谁重试、谁降级、谁人工介入？ | 搜索 `fallback\|except.*provider\|retry\|dead_letter\|DLQ\|manual` |
| **P1** | 时序链路 | 从用户点击到落库经历哪些调用？ | 选一个完整流程（如"生成分镜→视频"），从 API 入口追到最终 UPDATE |
| **P1** | 错误处理分层 | 业务错误/上游错误/系统错误怎么分？ | 搜索所有 `try/except`，按错误类型分组，看谁重试谁不重试 |
| **P1** | 并发模型 | 全系统哪些锁？粒度是什么？ | 搜索 `BEGIN IMMEDIATE\|revision=\|_hash\|Event.set()`，画竞争点清单 |
| **P1** | 成本与配额 | 一次操作花多少 token/钱？有限流/配额吗？ | 搜索 `quota\|limit\|rate_limit\|budget\|cost\|price`，估算单位成本 |
| **P1** | 可观测性 | 出问题怎么定位？有日志/追踪/指标吗？ | 搜索 `logger\|logging\|trace\|span\|metric\|sentry`，看日志结构与级别 |
| **P2** | 前端映射与实时反馈 | 每个 Skill 对应哪个前端交互？进度怎么回传？ | 扫路由对照前端按钮；搜索 `WebSocket\|SSE\|EventSource\|poll\|setInterval` |
| **P2** | 部署运行时 | 怎么跑起来？端口？进程间通信？ | 读 main.py / Dockerfile / package.json，看启动顺序 |
| **P2** | 安全边界 | 哪些 API 要鉴权？输入在哪校验？ | 搜索 `Depends(get_current_user)\|HTTPException(401)\|validation` |
| **P2** | 数据与资产生命周期 | 数据怎么迁移/清理/归档？图片视频存哪？ | 搜索 `migration\|vacuum\|cleanup\|archive\|upload\|cdn\|thumb` |
| **P2** | 演进历史 | 为什么这么写？有没有废弃方案 / workaround？ | 读 git log / commit message，找"修复/临时/回滚"痕迹 |
