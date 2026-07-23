# @ai-check 任务索引

共 106 个待确认函数，分 5 个 agent。**每个函数由 2 个 agent 独立识别**，交叉验证。

| Agent | 函数数 | 文件 | 重叠组 |
|-------|--------|------|--------|
| AI01 | 42 | [AI01.md](AI01.md) | 第1组 + 第2组 |
| AI02 | 42 | [AI02.md](AI02.md) | 第2组 + 第3组 |
| AI03 | 42 | [AI03.md](AI03.md) | 第3组 + 第4组 |
| AI04 | 43 | [AI04.md](AI04.md) | 第4组 + 第5组 |
| AI05 | 43 | [AI05.md](AI05.md) | 第5组 + 第1组 |

## 完成后
1. 对比每组的 2 个 agent 结果：一致 → 直接采纳；不一致 → 人工裁决
2. 合并到 `docs/func-mapping.txt` / `docs/var-mapping.txt`
3. `node scripts/annotate.cjs --run --force` 刷新 App.js 注释
