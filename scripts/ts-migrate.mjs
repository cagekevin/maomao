/**
 * ts-migrate.mjs — TS 规范化重构的「机械部分」辅助脚本
 *
 * 【职责边界】本脚本只做可验证的机械工作，不做语义改造：
 *   ── 做：
 *     1. 按 JSX 有无自动判定新扩展名（有 JSX → .tsx；纯逻辑 → .ts），可 `--to` 覆盖。
 *     2. `git mv` 或 fs rename 完成改名。
 *     3. 全库重写「所有 import/require/动态导入」指向该模块的说明符扩展名。
 *        · 按【解析后的绝对路径】比对，天然规避同名 basename 误伤
 *          （如 base/ErrorBoundary vs director3d/ErrorBoundary）。
 *   ── 不做：类型标注 / Props 接口 / types.ts 抽离 / EVENTS 表 from/to 的文件名引用同步。
 *     这些是在改名后逐文件的人工活；改名后 EVENTS 引用漂移由 `npm run check:events` 暴露并手工同步。
 *
 * 【用法】
 *   node scripts/ts-migrate.mjs convert <file> [--to ts|tsx] [--dry]
 *       将 <file> 改名为目标扩展名（缺省按内容 JSX 判定），并全库重写其 import 说明符。
 *   node scripts/ts-migrate.mjs plan <dir>
 *       列出 <dir> 下待/可转文件 + 各自被引用次数（规划批次用，只读）。
 *   node scripts/ts-migrate.mjs update-imports <file> [--to ts|tsx] [--dry]
 *       仅重写 import 说明符（文件已改名时用）。
 *
 * 【注意】改完尺寸较大或被 EVENTS 引用的文件，务必跑 `npm run check:events` 确认反向校验仍自洽。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs'
import { resolve, join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

// 扫描根：前端原型 + 测试。localTool/网关为独立后端，不在本次前端 TS 化范围。
const SCAN_ROOTS = [join(root, 'src'), join(root, 'tests')]
const SCAN_EXTS = ['.js', '.jsx', '.ts', '.tsx']
const GIT_MV_EXTS = ['.js', '.jsx', '.ts', '.tsx']

/** 递归收集目录内指定扩展名文件 */
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      collectFiles(full, acc)
    } else if (SCAN_EXTS.includes(extname(name))) {
      acc.push(full)
    }
  }
  return acc
}

/** 简单 JSX 探测：文本里出现 HTML/组件式标签即视为 UI 文件 */
function hasJsx(code) {
  return /<\/?[A-Za-z][\w-]*(\s[^<>]*)?\/?>/.test(code)
}

/** 判定目标扩展名：--to 优先，否则按内容（引用 JSX → tsx，纯逻辑 → ts） */
function detectExt(code, toFlag) {
  if (toFlag) return toFlag === 'tsx' ? '.tsx' : '.ts'
  return hasJsx(code) ? '.tsx' : '.ts'
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 解析一个 import 说明符（相对/@/绝对）为绝对路径；裸包名返回 null */
function resolveSpec(spec, fromDir) {
  if (spec.startsWith('@/')) return resolve(root, 'src', spec.slice(2)) // '@' 别名 → src
  if (spec.startsWith('.')) return resolve(fromDir, spec)
  if (spec.startsWith('/')) return resolve(root, 'src', spec.slice(1))
  return null
}

/** 收集全部待扫描文件（去重，按修改时间排序做稳定基线） */
function allSources() {
  const set = new Set()
  for (const dir of SCAN_ROOTS) {
    if (!existsSync(dir)) continue
    collectFiles(dir, []).forEach((f) => set.add(f))
  }
  return [...set]
}

/**
 * 重写全库指向 oldAbs 的 import 说明符，把其扩展名换成 newExt。
 * 返回被改动文件的相对路径列表。
 */
function rewriteImports(oldAbs, newExt, dry = false) {
  const B = basename(oldAbs, extname(oldAbs)) // 模块名（含路径无关）
  const oldExt = extname(oldAbs)
  // 在引号内出现「路径…/B.oldExt」的说明符：捕获前引号、说明符前缀、后引号
  const RE = new RegExp(`(["'\x60])([^'"\x60]*?)${escapeRe(B)}\\.${escapeRe(oldExt.slice(1))}(["'\x60])`, 'g')
  const changed = []
  for (const file of allSources()) {
    if (file === oldAbs) continue // 跳过目标文件自身（已改名，不再指向旧路径）
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    let hit = false
    const next = src.replace(RE, (m, q1, prefix, q2) => {
      const fullSpec = prefix + B + oldExt // 完整说明符（不含引号）
      const cand = resolveSpec(fullSpec, dirname(file))
      // 仅当解析结果等于【目标文件被改名前的绝对路径】才改写，避免同名 basename 误伤
      if (cand !== null && cand === oldAbs) {
        hit = true
        return q1 + prefix + B + newExt + q2
      }
      return m
    })
    if (hit) {
      changed.push(file)
      if (!dry) writeFileSync(file, next, 'utf8') // --dry 只预览不落盘
    }
  }
  return changed.map((f) => f.replace(root + '/', ''))
}

/** 用 git mv 改名（非 git 跟踪文件退回 fs rename） */
function renameFile(oldAbs, newAbs) {
  const rel = oldAbs.replace(root + '/', '')
  const res = spawnSync('git', ['mv', '--', rel, newAbs.replace(root + '/', '')], { cwd: root })
  if (res.status === 0) return 'git mv'
  try { renameSync(oldAbs, newAbs); return 'fs rename' } catch { return null }
}

const arg = process.argv.slice(2)
const cmd = arg[0]
const fileArg = arg[1]
const toFlag = arg.includes('--to') ? arg[arg.indexOf('--to') + 1] : null
const dry = arg.includes('--dry')

if (cmd === 'plan') {
  const dir = resolve(root, fileArg || 'src')
  const files = collectFiles(dir, [])
    .filter((f) => ['.js', '.jsx'].includes(extname(f)))
    .map((f) => {
      const code = readFileSync(f, 'utf8')
      return { file: f.slice(root.length + 1), to: hasJsx(code) ? '.tsx' : '.ts' }
    })
    .sort((a, b) => a.file.localeCompare(b.file))
  const byTo = files.reduce((acc, f) => { acc[f.to] = (acc[f.to] || 0) + 1; return acc }, {})
  console.log(`\n待转 ${files.length} 个文件（tsx:${byTo['.tsx'] || 0} / ts:${byTo['.ts'] || 0}）`)
  for (const f of files) console.log('  ' + f.file.padEnd(70) + ' → ' + f.to)
  process.exit(0)
}

if (cmd === 'convert' || cmd === 'update-imports') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const oldAbs = resolve(root, fileArg)
  if (!existsSync(oldAbs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  const code = readFileSync(oldAbs, 'utf8')
  const toExt = detectExt(code, toFlag)
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + toExt

  if (cmd === 'convert' && !dry) {
    const how = renameFile(oldAbs, newAbs)
    if (!how) { console.error(`改名失败：${oldAbs}`); process.exit(1) }
    console.log(`✔ 改名 ${basename(oldAbs)} → ${basename(newAbs)}（${how}）`)
  }

  const changed = rewriteImports(oldAbs, toExt, dry)
  const rel = oldAbs.replace(root + '/', '')
  if (changed.length === 0) {
    console.log(`ℹ ${rel}：无其他文件引用其 import 说明符`)
  } else {
    console.log(`✔ 已同步 ${changed.length} 个文件的 import 说明符：`)
    for (const c of changed) console.log('   - ' + c)
  }
  if (dry) console.log('（--dry 仅预览，未实际落盘/改名）')
  process.exit(0)
}

console.error(`未知命令：${cmd}\n用法见文件头 JSDoc。`)
process.exit(1)