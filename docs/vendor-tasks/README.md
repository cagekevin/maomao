# vendor.js 导出标注任务

199 个导出 + 1 个 rolldown 导出，分 5 个 agent。

| Agent | 文件 | 数量 |
|-------|------|------|
| VA01 | [VA01.md](VA01.md) | 40 |
| VA02 | [VA02.md](VA02.md) | 40 |
| VA03 | [VA03.md](VA03.md) | 40 |
| VA04 | [VA04.md](VA04.md) | 40 |
| VA05 | [VA05.md](VA05.md) | 39 |

## 完成后
1. 合并到 vendormap（新建 `docs/vendor-mapping.txt`）
2. 格式: `导出名 = 库::API # App.js中用法`
3. 之后 grep Nr → 直接知道是 createPortal

## rolldown-runtime.js 导出
`l` — 这些是构建工具生成的，直接标注即可。
