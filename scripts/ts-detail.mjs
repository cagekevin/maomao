/**
 * ts-detail.mjs — 测试类型错误的【逐条明细】查看器（只读，零工作区污染）
 *
 * 定位：M4「按优先级逐个解测试」的主力工具。m1-scan 给聚合分布（哪个文件多少错），
 *       本脚本给可操作的明细（哪一行、什么错码、TS 原话），供人工定位根因后下手改。
 *
 * 为什么不用 ts-tests.mjs 的 check：
 *   - check 每次只查 1 个文件、跑 1 次全量 tsc（~40s/次），批量排查 5 个文件要 3 分钟。
 *   - 本脚本跑【1 次】tsc，按文件名片段过滤出多个目标文件的全部错误。
 *   - 且 check 会临时改写工作区文件（依赖 finally 恢复），本脚本 0 写入。
 *
 * 用法：
 *   node scripts/ts-detail.mjs <片段> [片段...]      按文件名片段过滤（子串匹配，不分大小写）
 *   node scripts/ts-detail.mjs --all                 列出全部有错文件 × 错误数（等价分布视图）
 *   node scripts/ts-detail.mjs --all --src           额外纳入 src 连带错（M3 收口前量化用）
 *
 * 例：
 *   node scripts/ts-detail.mjs upstream              # 一次看全部 4 个 upstream 测试
 *   node scripts/ts-detail.mjs taskStore config      # 多个片段，任一命中即收录
 *
 * 实现要点（与 m1-scan.mjs 同源，踩坑记录 #2/#5）：
 *   - 复制 tests/unit → gitignored tmp/unit，在【副本】上剥 @ts-nocheck；工作区 0 写入，
 *     进程被杀也零污染。tmp/unit 与 tests/unit 同为根下第二层，相对导入解析结果一致。
 *   - 换行统一为 \n 后再解析（Windows tsc 输出是 CRLF，不统一会让行尾锚点失配）。
 *   - 【解析率自检】对比「含 error TS 的行数」与「正则成功解析的条数」，不等就报警并
 *     打印未解析样例——避免正则失配时静默输出「0 错」，把人骗过去（血泪：曾误判全绿）。
 *   - 正则刻意不加行尾 `$` 锚定：TS 错误消息可能含 `(`、换行等，宽松匹配更稳。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const { positionals: filters, values } = parseArgs({
  options: {
    all: { type: 'boolean' },
    src: { type: 'boolean' },
  },
  allowPositionals: true,
})

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const SRC_UNIT = resolve(root, 'tests', 'unit')
const TMP_UNIT = resolve(root, 'tmp', 'unit')
const TMP_TSCONFIG = resolve(root, 'tmp', 'tsconfig.json')

const wantAll = values.all || filters.length === 0
const wantSrc = Boolean(values.src)

/** 递归收集 .ts/.tsx */
function walkDir(dir, fileList = []) {
  if (!existsSync(dir)) return fileList
  for (const file of readdirSync(dir)) {
    const abs = join(dir, file)
    if (statSync(abs).isDirectory()) walkDir(abs, fileList)
    else if (abs.endsWith('.ts') || abs.endsWith('.tsx')) fileList.push(abs)
  }
  return fileList
}

/** 剥离顶部的 @ts-nocheck（保留 @vitest-environment 注解，踩坑记录 #4） */
function stripTsNoCheck(src) {
  const lines = src.split('\n')
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (/^\s*\/\/\s*@ts-nocheck\s*$/.test(lines[i])) { lines.splice(i, 1); break }
  }
  return lines.join('\n')
}

/** tmp/unit/xxx → tests/unit/xxx，便于对照工作区真实路径 */
function normPath(p) {
  const clean = p.trim().replace(/\\/g, '/')
  if (clean.startsWith('tmp/unit/')) return 'tests/unit/' + clean.slice('tmp/unit/'.length)
  if (clean.startsWith('./tmp/unit/')) return 'tests/unit/' + clean.slice('./tmp/unit/'.length)
  if (clean.startsWith('./src/')) return clean.slice(2)
  return clean
}

// ── 1. 重建副本 + 剥 nocheck ──
rmSync(TMP_UNIT, { recursive: true, force: true })
mkdirSync(TMP_UNIT, { recursive: true })
cpSync(SRC_UNIT, TMP_UNIT, { recursive: true })
for (const f of walkDir(TMP_UNIT)) writeFileSync(f, stripTsNoCheck(readFileSync(f, 'utf8')), 'utf8')

// ── 2. 临时 tsconfig（baseUrl=根，@/* → src）──
writeFileSync(TMP_TSCONFIG, JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    resolveJsonModule: true,
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    allowJs: true,
    checkJs: false,
    strict: false,
    noImplicitAny: false,
    strictNullChecks: false,
    types: ['node', 'vite/client', 'vitest/globals'],
    baseUrl: root,
    paths: { '@/*': ['./src/*'] },
  },
  include: [join(root, 'tmp', 'unit', '**', '*.ts'), join(root, 'tmp', 'unit', '**', '*.tsx')],
}, null, 2), 'utf8')

// ── 3. 跑 tsc（只读，扫副本）──
const res = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tmp/tsconfig.json'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
})
const allOut = ((res.stdout || '') + '\n' + (res.stderr || ''))
  .replace(/\x1b\[[0-9;]*m/g, '')   // 去 ANSI 色码
  .replace(/\r\n/g, '\n').replace(/\r/g, '\n')  // 统一换行：CRLF 会让行尾锚点失配

// ── 4. 解析 ──
const ERR_RE = /^([^(]+)\((\d+),(\d+)\): error (TS\d+):\s*(.*)/  // 刻意不加 $：错误信息可能含 ( 或换行
const errs = []
const unresolved = []
const lines = allOut.split('\n')
let errLineCount = 0

for (const line of lines) {
  if (!line.includes('error TS')) continue
  errLineCount++
  const m = line.match(ERR_RE)
  if (!m) { unresolved.push(line); continue }
  const file = normPath(m[1])
  errs.push({ file, line: Number(m[2]), col: Number(m[3]), code: m[4], msg: m[5].trim() })
}

rmSync(TMP_UNIT, { recursive: true, force: true })
rmSync(TMP_TSCONFIG, { recursive: true, force: true })

// ── 5. 解析率自检：正则失配时静默「0 错」会把人骗过去，必须显式暴露 ──
console.log(`[自检] tsc exit=${res.status}　含 error TS 的行=${errLineCount}　成功解析=${errs.length}`)
if (errLineCount > 0 && errs.length < errLineCount) {
  console.error(`⚠ 有 ${errLineCount - errs.length} 行未被解析（正则可能失配），样例：`)
  unresolved.slice(0, 5).forEach((l) => console.error('   ' + l.trim().slice(0, 160)))
}
if (errLineCount === 0) {
  console.log(res.status === 0 ? '✔ tsc 通过，0 类型错误。' : '✖ tsc 未产出错误行但退出码非 0，请检查环境。')
  process.exit(res.status === 0 ? 0 : 1)
}

// ── 6. 过滤 ──
const needles = filters.map((f) => f.toLowerCase())
const matched = errs.filter((e) => {
  if (!wantAll && !needles.some((n) => e.file.toLowerCase().includes(n))) return false
  if (!wantSrc && !e.file.startsWith('tests/unit/')) return false
  return true
})

if (matched.length === 0) {
  console.log(`\nℹ 无匹配错误。过滤条件：${wantAll ? '(全部)' : needles.join(', ')}`)
  console.log('  当前有错的文件（文件 × 错误数）：')
  const cnt = {}
  errs.forEach((e) => { cnt[e.file] = (cnt[e.file] || 0) + 1 })
  Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`   ${String(n).padStart(3)}  ${f}`))
  process.exit(0)
}

// ── 7. 输出明细 ──
matched.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
let cur = ''
for (const e of matched) {
  if (e.file !== cur) { cur = e.file; console.log(`\n════ ${cur} ════`) }
  console.log(`  ${String(e.line).padStart(4)}:${String(e.col).padStart(3)}  ${e.code}  ${e.msg.slice(0, 220)}`)
}

const byCode = {}
matched.forEach((e) => { byCode[e.code] = (byCode[e.code] || 0) + 1 })
const byFile = {}
matched.forEach((e) => { byFile[e.file] = (byFile[e.file] || 0) + 1 })

console.log(`\n──── 明细 ${matched.length} 条，涉及 ${Object.keys(byFile).length} 个文件`)
console.log('错误码：' + Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join('  '))
