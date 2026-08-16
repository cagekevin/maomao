/* 合并 5 个「节点样式一致性审计」agent 的产出（阶段一）→ 统一差异总表（阶段二输入）
 *
 * 用法：node scripts/merge-node-audit.cjs
 * 产出：docs/agent 批量任务/节点样式审计-汇总.md（含全部差异 + 统一建议，供阶段二统一实现用）
 *
 * 原理：从每个 TASK-030~034 文件读取 agent 填的「差异汇总表」，解析「偏离」单元格，
 *      汇总成一份总表 + 统计每类差异出现的频次（找共性根因）。
 */
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'docs', 'agent 批量任务')
const OUT = path.join(DIR, '节点样式审计-汇总.md')

const FILES = [
  'TASK-030-节点样式审计-生图文本类.md',
  'TASK-031-节点样式审计-图片工具类.md',
  'TASK-032-节点样式审计-视频3D类.md',
  'TASK-033-节点样式审计-复合特殊类.md',
  'TASK-034-节点样式审计-公共基座组件.md',
]

// 8 个审计维度列名
const DIM_HEADERS = ['标题距离', '右上角', '下拉/select', '端口', '底色边框', '字号颜色', '主显示区', 'hover/选中态']

function readGroup(f) {
  const p = path.join(DIR, f)
  if (!fs.existsSync(p)) return { file: f, rows: [] }
  const txt = fs.readFileSync(p, 'utf8')
  // 提取 5.1 差异汇总表：匹配表头后的一行行 | 节点 | 8个格子 |
  const lines = txt.split('\n')
  const rows = []
  let inTable = false
  for (const line of lines) {
    if (/^\| 节点文件 \|/.test(line)) { inTable = true; continue }
    if (inTable && /^\|[- ]+\|$/.test(line.trim())) continue // 分隔行
    if (inTable && line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim())
      // cells[0]=节点文件，cells[1..8]=8维度
      if (cells.length >= 9 && cells[0]) {
        rows.push({ node: cells[0], dims: cells.slice(1, 9) })
      }
    }
    if (inTable && !line.trim().startsWith('|')) inTable = false
  }
  return { file: f, rows }
}

const allRows = []
for (const f of FILES) {
  const g = readGroup(f)
  allRows.push(...g.rows)
}

// 统计每个维度的「偏离」频次
const dimCount = DIM_HEADERS.map((_, i) => ({ dim: DIM_HEADERS[i], deviate: 0, total: 0 }))
for (const r of allRows) {
  r.dims.forEach((v, i) => {
    if (i < 8 && v) {
      dimCount[i].total++
      if (!/^一致$/.test(v)) dimCount[i].deviate++
    }
  })
}

let md = `# 节点样式一致性审计 — 汇总（阶段一产出）

> 由 5 个并行审计任务（TASK-030~034）的差异报告合并而成。**阶段二（统一实现）以此为依据。**

## 一、汇总统计（每个维度有多少节点偏离）

| 维度 | 偏离 / 已审计 | 是否高发 |
|---|---|---|
${dimCount.map((d) => `| ${d.dim} | ${d.deviate} / ${d.total} | ${d.deviate / Math.max(1, d.total) > 0.5 ? '⚠️ 高发' : d.deviate > 0 ? '中等' : '低'}`).join('\n')}

## 二、全部差异明细（按节点）

| 节点文件 | 来源 | ${DIM_HEADERS.join(' | ')} |
|---|---|---|
${allRows.map((r) => `| ${r.node} | ${r.file.replace(/^TASK-(\d+).*/, 'TASK-$1')} | ${r.dims.map((v) => v || '').join(' | ')} |`).join('\n')}

## 三、各任务详细报告（原文，含证据与统一建议）

- [TASK-030 生图文本类](TASK-030-节点样式审计-生图文本类.md)
- [TASK-031 图片工具类](TASK-031-节点样式审计-图片工具类.md)
- [TASK-032 视频3D类](TASK-032-节点样式审计-视频3D类.md)
- [TASK-033 复合特殊类](TASK-033-节点样式审计-复合特殊类.md)
- [TASK-034 公共基座组件](TASK-034-节点样式审计-公共基座组件.md)

## 四、阶段二提示（统一实现方向）

1. 优先解决「高发」维度（见 §一 标 ⚠️ 的）。
2. 统一方案应优先收敛到 **base 公共组件**（NodeShell/NodeTitle/ModelSelect/统一 select class），而不是逐节点打补丁。
3. 注意区分「可统一」（如 select 样式、titleRight 边距）与「必须保留差异」（如 ScriptBox 大画布、Group 无端口）。
4. 若发现 NODE-DESIGN-SPEC.md 本身有盲区/需补充，应在统一时同步更新规范。
`

fs.writeFileSync(OUT, md)
console.log('汇总已生成:', OUT)
console.log(`共 ${allRows.length} 个节点参与审计`)
