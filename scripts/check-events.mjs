/**
 * check-events.mjs
 * 编译期（静态）拦截「裸事件名字符串」—— EventBus 契约登记表的硬门禁。
 *
 * 背景：与 check-storage-keys.mjs 对称。eventBus 的 EVENTS 登记表（contracts.js）是
 * 唯一事实来源，裸事件名拼错/漏登记只在运行时才静默暴露"只监听未发布 / 只发布
 * 未监听"。本脚本补一层「编译期」静态校验，零新依赖（复用 esbuild 已装），
 * 不恢复全量 lint 门禁（CLAUDE.md §3.1）。
 *
 * 它扫描所有对 eventBus 入口（publish / subscribe / subscribeOnce）传入的**字面量**
 * 事件名字符串，校验该事件名是否在 contracts.js 的 EVENTS 登记。未登记 → 报错退出
 * （exit 1），可挂 CI / 冒烟 / health。
 *
 * 界限：
 *  - 只在「可执行代码」里拦截：纯注释行（// /* *）整行跳过，避免登记表/文档示例里
 *    的随手字符串因滞后于登记表而误报红。
 *  - 动态拼接/变量事件名无法静态判定，由运行时自洽，本脚本不拦（与存储键白名单一致）。
 *
 * 用法：
 *   node scripts/check-events.mjs                 # 校验全部 components
 *   node scripts/check-events.mjs src/App.jsx     # 指定文件
 */
import { build } from 'esbuild'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

// 事件总线入口函数名（第一个参数为事件名）
const EVENT_FNS = new Set(['publish', 'subscribe', 'subscribeOnce'])

// 字面量事件名正则：fn('name' 或 "name"，可含冒号/_/-（领域:动作 命名）
const LITERAL_EVENT_RE = new RegExp(
  `\\b(${[...EVENT_FNS].join('|')})\\s*\\(\\s*(['"])([a-zA-Z0-9:_-]+)\\2`,
  'g'
)

function collectSources(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectSources(full, acc)
    } else if (['.js', '.jsx'].includes(extname(name))) {
      acc.push(full)
    }
  }
  return acc
}

// ── 加载事件登记表 ──
let EVENTS = {}
try {
  const mod = await import(resolve(root, 'src/components/base/contracts.js'))
  EVENTS = mod.EVENTS || {}
} catch (e) {
  console.error('  ✖ 无法加载 contracts.js 事件登记表：', e.message)
  process.exit(1)
}

function isRegistered(name) {
  return name in EVENTS
}

const args = process.argv.slice(2)
const targets =
  args.length > 0
    ? args.map((a) => resolve(root, a))
    : collectSources(join(root, 'src/components'))

let violations = 0

for (const file of targets) {
  const rel = file.replace(root + '/', '')
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  // 跳过登记表自身与 eventBus 定义（其含文档示例，且自身是校验目标）
  if (rel.endsWith('contracts.js') || rel.endsWith('eventBus.js')) continue

  // 语法校验（esbuild，确保 JSX .jsx 也能读；失败仅警告不阻断扫描）
  try {
    await build({
      entryPoints: [file],
      bundle: false,
      write: false,
      format: 'esm',
      loader: { '.jsx': 'jsx' },
      jsx: 'automatic',
      logLevel: 'silent',
    })
  } catch { /* 语法问题交给 check-jsx，本脚本不重复报错 */ }

  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过纯注释行：静态门禁只针对可执行代码里的裸字面量，
    // 登记表/文档/代码内示例引用因可能滞后于登记表，不应触发红建。
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) continue

    LITERAL_EVENT_RE.lastIndex = 0
    let m
    while ((m = LITERAL_EVENT_RE.exec(line)) !== null) {
      const name = m[3]
      if (!isRegistered(name)) {
        violations++
        console.error(`  ✖ ${rel}:${i + 1}  裸事件名未登记: ${m[1]}('${name}')`)
      }
    }
  }
}

if (violations === 0) {
  console.log(`\n事件契约校验通过 ✔（已扫描 ${targets.length} 个文件）`)
  process.exit(0)
} else {
  console.error(`\n发现 ${violations} 处未登记裸事件名 ✖`)
  console.error('请先在 src/components/base/contracts.js 的 EVENTS 登记（禁止裸字符串事件名）。')
  process.exit(1)
}