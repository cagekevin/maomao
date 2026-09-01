/**
 * ts-tests.mjs — 测试类型「渐进消化」高级作战系统 (Windows 修复版)
 *
 * 命令集：
 *   node scripts/ts-tests.mjs check <file>       # [日常] 查看单文件错误
 *   node scripts/ts-tests.mjs verify <file>      # [安全] 移除nocheck -> 跑tsc -> 跑单测，全过才保留
 *   node scripts/ts-tests.mjs status [--export]  # [追踪] 统计全局进度，支持导出 CSV 和 交接 Markdown
 *   node scripts/ts-tests.mjs add-nocheck <dir>  # [基建] 批量加 nocheck (幂等)
 *   node scripts/ts-tests.mjs rm-nocheck <file>  # [基建] 强制删 nocheck (仅删顶部)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const TESTS_TSCONFIG = resolve(root, 'tests', 'tsconfig.json')

// ===================== 状态安全管理 (解决 Ctrl+C 弄脏工作区的问题) =====================
const restoreMap = new Map()
let isRestoring = false

function restoreAll() {
  if (isRestoring) return
  isRestoring = true
  if (restoreMap.size > 0) {
    console.log(`\n[系统保护] 检测到进程即将退出，正在还原 ${restoreMap.size} 个文件的 @ts-nocheck 状态...`)
    for (const [file, originalSrc] of restoreMap.entries()) {
      try { writeFileSync(file, originalSrc, 'utf8') } catch (e) { /* 忽略个别写入异常 */ }
    }
    restoreMap.clear()
    console.log(`[系统保护] 还原完成。工作区安全。`)
  }
}

// 捕获中断信号和致命异常
process.on('SIGINT', () => { restoreAll(); process.exit(1) })
process.on('SIGTERM', () => { restoreAll(); process.exit(1) })
process.on('uncaughtException', (err) => { 
  console.error('\n[致命错误]', err)
  restoreAll()
  process.exit(1)
})

// ===================== 辅助函数 =====================

/** 递归获取目录下所有 .ts 和 .tsx 文件 */
function walkDir(dir, fileList = []) {
  if (!existsSync(dir)) return fileList
  const files = readdirSync(dir)
  for (const file of files) {
    const abs = join(dir, file)
    if (statSync(abs).isDirectory()) walkDir(abs, fileList)
    else if (abs.endsWith('.ts') || abs.endsWith('.tsx')) fileList.push(abs)
  }
  return fileList
}

/** 剥离顶部的 @ts-nocheck (保留 vitest 环境注解) */
function stripTsNoCheck(src) {
  const lines = src.split('\n')
  let removed = false
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (/^\s*\/\/\s*@ts-nocheck\s*$/.test(lines[i])) {
      lines.splice(i, 1)
      removed = true
      break
    }
  }
  return { src: lines.join('\n'), removed }
}

/** 安全地插入 @ts-nocheck (避开 vitest 注解) */
function ensureTsNoCheck(src) {
  if (/^\s*\/\/\s*@ts-nocheck\s*$/m.test(src)) return src
  const lines = src.split('\n')
  const marker = '// @ts-nocheck'
  if (/@vitest-environment/.test(lines[0] || '')) lines.splice(1, 0, marker)
  else lines.unshift(marker)
  return lines.join('\n')
}

// ===================== CLI 参数解析 =====================
const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: { export: { type: 'boolean' } },
  allowPositionals: true,
})
const cmd = positionals[0]
const fileArg = positionals[1]

if (!cmd) {
  console.error(`✖ 缺少命令。可用命令: add-nocheck, rm-nocheck, check, verify, status`)
  process.exit(1)
}

// ===================== 子命令: add-nocheck =====================
if (cmd === 'add-nocheck') {
  if (!fileArg) { console.error('用法：node scripts/ts-tests.mjs add-nocheck <dir>'); process.exit(1) }
  const targetDir = resolve(root, fileArg)
  const files = walkDir(targetDir)
  let added = 0, skipped = 0

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const newSrc = ensureTsNoCheck(src)
    if (src !== newSrc) {
      writeFileSync(file, newSrc, 'utf8')
      added++
    } else {
      skipped++
    }
  }
  console.log(`✔ add-nocheck 完成：处理 ${files.length} 个文件 (新增 ${added} 个，跳过 ${skipped} 个)`)
  process.exit(0)
}

// ===================== 子命令: rm-nocheck =====================
if (cmd === 'rm-nocheck') {
  if (!fileArg) { console.error('用法：node scripts/ts-tests.mjs rm-nocheck <file>'); process.exit(1) }
  const abs = resolve(root, fileArg)
  if (!existsSync(abs)) { console.error(`✖ 文件不存在：${fileArg}`); process.exit(1) }

  const src = readFileSync(abs, 'utf8')
  const { src: newSrc, removed } = stripTsNoCheck(src)
  if (removed) {
    writeFileSync(abs, newSrc, 'utf8')
    console.log(`✔ 已移除 ${fileArg} 顶部的 @ts-nocheck`)
  } else {
    console.log(`ℹ ${fileArg} 没有顶部的 @ts-nocheck`)
  }
  process.exit(0)
}

// ===================== 子命令: verify =====================
if (cmd === 'verify') {
  if (!fileArg) { console.error('用法：node scripts/ts-tests.mjs verify <file>'); process.exit(1) }
  const abs = resolve(root, fileArg)
  let src = readFileSync(abs, 'utf8')
  const { src: strippedSrc, removed } = stripTsNoCheck(src)

  if (!removed) {
    console.log(`ℹ ${fileArg} 已经没有 @ts-nocheck，直接运行检查...`)
  } else {
    restoreMap.set(abs, src)
    writeFileSync(abs, strippedSrc, 'utf8')
  }

  try {
    console.log(`⏳ 1/2 正在进行类型检查 (tsc)...`)
    const tscRes = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tests/tsconfig.json'], { cwd: root, encoding: 'utf8', shell: true })
    if (tscRes.status !== 0) {
      console.log(`✖ 类型检查失败！请先使用 check 命令修错。`)
      restoreAll()
      process.exit(1)
    }

    console.log(`⏳ 2/2 正在运行单元测试 (vitest)...`)
    const vitestRes = spawnSync('npx', ['vitest', 'run', fileArg], { cwd: root, encoding: 'utf8', shell: true, stdio: 'inherit' })
    if (vitestRes.status !== 0) {
      console.log(`✖ 测试运行失败！可能破坏了业务逻辑。`)
      restoreAll()
      process.exit(1)
    }

    // 全通过，清理保护网，不恢复原状
    restoreMap.clear()
    console.log(`🎉 验证通过！类型正确且单测通过，@ts-nocheck 已永久移除。`)
  } finally {
    restoreAll() // 兜底
  }
  process.exit(0)
}

// ===================== 子命令: check =====================
if (cmd === 'check') {
  if (!fileArg) { console.error('用法：node scripts/ts-tests.mjs check <file>'); process.exit(1) }
  const abs = resolve(root, fileArg)
  if (!existsSync(abs)) { console.error(`✖ 文件不存在：${fileArg}`); process.exit(1) }

  let src = readFileSync(abs, 'utf8')
  const { src: strippedSrc, removed } = stripTsNoCheck(src)
  if (removed) {
    restoreMap.set(abs, src)
    writeFileSync(abs, strippedSrc, 'utf8')
  }

  try {
    const res = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tests/tsconfig.json'], { cwd: root, encoding: 'utf8', shell: true })
    // 精确匹配：统一转正斜杠
    const unifiedRelTarget = relative(root, abs).replace(/\\/g, '/')
    const allOut = res.stdout + '\n' + res.stderr
    
    const errs = allOut.split('\n').filter(l => l.includes('error TS') && l.replace(/\\/g, '/').startsWith(unifiedRelTarget))

    if (errs.length === 0) {
      console.log(`✔ 无类型错误！现在运行 \`node scripts/ts-tests.mjs verify ${fileArg}\` 确立战果！`)
    } else {
      const byCode = {}
      errs.forEach(e => { const m = e.match(/error TS(\d+)/); if (m) byCode[m[1]] = (byCode[m[1]] || 0) + 1 })

      console.log(`✖ 发现 ${errs.length} 个类型错误`)
      console.log('📊 错误码分布: ' + Object.entries(byCode).map(([c, n]) => `TS${c}×${n}`).join('  '))

      console.log('\n📝 详情 (终端按住 Cmd/Ctrl 点击路径可直达代码):')
      errs.slice(0, 15).forEach(e => {
        const formatted = e.trim().replace(/^([^(]+)(\(\d+,\d+\))/, (match, fileRel, pos) => {
          return resolve(root, fileRel) + pos
        })
        console.log('  👉 ' + formatted)
      })
      if (errs.length > 15) console.log(`  ... 余下 ${errs.length - 15} 条错误已省略`)
    }
  } finally {
    restoreAll() // 强制恢复
  }
  process.exit(0)
}

// ===================== 子命令: status =====================
if (cmd === 'status') {
  const unitDir = resolve(root, 'tests/unit')
  const files = walkDir(unitDir)
  const nocheckFiles = [], cleanFiles = []

  files.forEach(f => /^\s*\/\/\s*@ts-nocheck/m.test(readFileSync(f, 'utf8')) ? nocheckFiles.push(f) : cleanFiles.push(f))

  if (nocheckFiles.length === 0) {
    console.log('🎉 进度总览：所有测试文件的 @ts-nocheck 均已解完！')
    process.exit(0)
  }

  console.log(`⏳ 正在扫描全局错误，生成作战图 (大约需要 40 秒，随时按 Ctrl+C 中断安全返回)...\n`)
  
  // 核心修复 Bug 1：用「全小写+正斜杠的相对路径」作为 Map 的 Key，彻底规避盘符大小写和斜杠方向问题
  const fileStats = {}
  nocheckFiles.forEach(f => {
    const unifiedKey = relative(root, f).replace(/\\/g, '/').toLowerCase()
    fileStats[unifiedKey] = { abs: f, count: 0, codes: {} }
  })

  let allOut = ''

  try {
    // 1. 批量剥离并纳入保护罩
    nocheckFiles.forEach(file => {
      const src = readFileSync(file, 'utf8')
      const { src: stripped, removed } = stripTsNoCheck(src)
      if (removed) {
        restoreMap.set(file, src)
        writeFileSync(file, stripped, 'utf8')
      }
    })

    // 2. 跑 tsc
    const res = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tests/tsconfig.json'], { cwd: root, encoding: 'utf8', shell: true })
    allOut = res.stdout + '\n' + res.stderr
  } finally {
    // 3. 无论成功失败，第一时间执行恢复
    restoreAll()
  }

  // 4. 解析全量错误日志
  allOut.split('\n').filter(l => l.includes('error TS')).forEach(line => {
    const match = line.match(/^([^(]+)\(\d+,\d+\): error TS(\d+)/)
    if (match) {
      // 提取出的路径也转正斜杠+全小写，实现完美匹配
      const unifiedKey = match[1].trim().replace(/\\/g, '/').toLowerCase()
      const code = match[2]
      if (fileStats[unifiedKey]) {
        fileStats[unifiedKey].count++
        fileStats[unifiedKey].codes[code] = (fileStats[unifiedKey].codes[code] || 0) + 1
      }
    }
  })

  const sorted = Object.values(fileStats)
    .map(stat => ({ fileRel: relative(root, stat.abs).replace(/\\/g, '/'), stat }))
    .sort((a, b) => a.stat.count - b.stat.count)

  if (values.export) {
    const csvLines = ['File,TotalErrors,TS2339,TS2345,Other']
    sorted.forEach(item => {
      const t2339 = item.stat.codes['2339'] || 0
      const t2345 = item.stat.codes['2345'] || 0
      const other = item.stat.count - t2339 - t2345
      csvLines.push(`${item.fileRel},${item.stat.count},${t2339},${t2345},${other}`)
    })
    writeFileSync(resolve(root, 'tests/type_migration_report.csv'), csvLines.join('\n'), 'utf8')

    const nextTarget = sorted.find(s => s.stat.count > 0) || sorted[0]
    const md = `# 测试类型修复交接文档 (自动生成)

## 📊 当前进度
- **总测试文件**: ${files.length}
- **已解文件**: ${cleanFiles.length} (${((cleanFiles.length / files.length) * 100).toFixed(1)}%)
- **待解文件**: ${nocheckFiles.length}
- **全局剩余错误**: ${sorted.reduce((sum, item) => sum + item.stat.count, 0)}

## 🎯 建议下一步接手
最容易修复的目标是：\`${nextTarget.fileRel}\` (包含 ${nextTarget.stat.count} 个错误)

执行以下命令开始：
\`\`\`bash
node scripts/ts-tests.mjs check ${nextTarget.fileRel}
\`\`\`
`
    writeFileSync(resolve(root, 'tests/TYPE_MIGRATION_TODO.md'), md, 'utf8')
    console.log(`✔ 已生成 tests/type_migration_report.csv 和 tests/TYPE_MIGRATION_TODO.md`)
  } else {
    console.log(`ℹ 进度总览：已解 ${cleanFiles.length} / 总计 ${files.length}。待处理：${nocheckFiles.length} 个。`)
    console.log(`🏆 推荐修复清单 (Top 10 容易修复的):`)
    sorted.slice(0, 10).forEach(item => {
      const icon = item.stat.count === 0 ? '✔' : '✖'
      console.log(` ${icon} [${String(item.stat.count).padStart(3, ' ')} 错] ${item.fileRel}`)
    })
    console.log(`💡 运行 \`node scripts/ts-tests.mjs status --export\` 导出详细报表与交接文档。`)
  }
  process.exit(0)
}

console.error(`✖ 未知命令：${cmd}`)
process.exit(1)