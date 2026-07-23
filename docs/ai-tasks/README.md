# @ai-check 任务索引

共 107 个 App.js 待确认函数，分 5 个 agent 并行识别。

| Agent | 文件 | 函数数 | 状态 |
|-------|------|--------|------|
| AI01 | [AI01.md](AI01.md) | 22 | ⚠️ 待执行 |
| AI02 | [AI02.md](AI02.md) | 22 | ⚠️ 待执行 |
| AI03 | [AI03.md](AI03.md) | 22 | ⚠️ 待执行 |
| AI04 | [AI04.md](AI04.md) | 22 | ⚠️ 待执行 |
| AI05 | [AI05.md](AI05.md) | 18 | ⚠️ 待执行 |

## 完成后

1. 各 agent 输出映射行 → 你汇总合并到 `docs/func-mapping.txt` / `docs/var-mapping.txt`
2. 运行 `node scripts/annotate.cjs --run --force` 更新 App.js 注释
3. 所有 `⚠️` 升为 `✔`，App.js 函数名 100% 可读
4. 之后再考虑用脚本反向替换混淆名为可读名
