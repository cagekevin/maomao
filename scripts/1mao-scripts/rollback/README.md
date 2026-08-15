# scripts/rollback · 改名/构建失败回退安全网（任务书 line 254 / 263）

> 作用域精确改名（`apply_rename_to_bundle.cjs`）或重构若引入隐蔽错误、构建失败，
> 用本目录的快照/回退工具一键回到改名前状态，或重跑 `beautify.cjs` 重生。

- `snapshot.cjs`：把当前 `src/bundle/` + `public/` 复制到 `scripts/rollback/snapshot-<时间戳>/`，作为回退点。
  - 建议在**首次跑 `apply_rename_to_bundle.cjs` 之前**先 `node scripts/rollback/snapshot.cjs` 打点。
- `restore.cjs`：把指定快照目录恢复回 `src/bundle/` + `public/`。
  - 用法：`node scripts/rollback/restore.cjs scripts/rollback/snapshot-<时间戳>`
- 安全约束：本回退只动 `src/bundle/` 与 `public/`，**不碰** `dist/`（dist 随时可 `npm run build` 重生）。
- 1.4.0 当前 `name_rules.cjs` 返回空规则，`apply_rename` 为安全 no-op，理论上无需回退；此工具为后续启用语义命名时兜底。
