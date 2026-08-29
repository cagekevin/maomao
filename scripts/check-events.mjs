/**
 * check-events.mjs
 * 编译期（静态）校验 EventBus 契约登记表（contracts.js 的 EVENTS）的两面自洽：
 *
 *  ① 正向（代码 → 表）：任何对 eventBus 入口（publish / subscribe / subscribeOnce）
 *     传入的**字面量**事件名，必须已在 EVENTS 登记。漏登记 → 报错（exit 1）。
 *     （防裸事件名拼错 / 漏登记，原本只在运行时静默暴露）
 *
 *  ② 反向（表 → 代码）：EVENTS 表的 `to` / `from` 必须与代码实测的
 *     `subscribe('key'` / `publish('key'` 调用自洽。
 *     - 表 `to: []` 但代码里实际有 `subscribe('key'` → 报「登记表 to 滞后于代码」
 *       （即历史误判根因：表标无订阅方、实际已被订阅，导致误判为死事件）
 *     - 表 `to` 列了 `file:NN` 但代码对应文件里完全没有 `subscribe('key'` → 报「登记表 to 指向 stale」
 *     （from 同理）
 *     - 匹配按**文件级**判断，`to` 的 `:NN` 行号仅作审计参考、不做逐行硬匹配：
 *       目标文件内任意行有该事件即视为命中，避免文件增删行使行号漂移却误报红（系统性根因，见 matchesRef）。
 *
 * 背景：与 check-storage-keys.mjs 对称。EVENTS 表是唯一事实来源，但靠人工维护会
 * 行号漂移、登记滞后于代码。本脚本把「表与代码一致性」变为 CI 可拦截的事实，
 * 而非靠人工审计 / AI 读表自述下结论。零新依赖（复用 esbuild 已装）。
 *
 * 界限：
 *  - 只在「可执行代码」里拦截：纯注释行（// /* *）整行跳过，避免登记表/文档示例里
 *    的随手字符串因滞后于登记表而误报红。
 *  - 动态拼接/变量事件名无法静态判定，由运行时自洽，本脚本不拦（与存储键白名单一致）。
 *  - 仅 eventBus.js 导出的 publish/subscribe/subscribeOnce 视为事件总线入口；
 *    其余模块内部同名 subscribe(cb) 第一个参数是回调非事件名，正则会排除。
 *
 * 用法：
 *   node scripts/check-events.mjs                 # 校验全部 components
 *   node scripts/check-events.mjs src/App.jsx     # 指定文件
 */
import { build } from 'esbuild'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
  const mod = await import(pathToFileURL(resolve(root, 'src/components/base/contracts.js')).href)
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
    : (() => {
        // 默认扫 components 子树（原范围），并补扫 src 根目录的关键组件
        // （如 App.jsx 不在 components 下，却含事件总线订阅，漏扫会导致反向校验误报）
        const base = collectSources(join(root, 'src/components'))
        const rootSrc = join(root, 'src')
        for (const name of readdirSync(rootSrc)) {
          const full = join(rootSrc, name)
          if (statSync(full).isFile() && ['.js', '.jsx'].includes(extname(name))) {
            base.push(full)
          }
        }
        return base
      })()

let violations = 0

// 反向校验所需：实测每个事件名在代码中的 publish / subscribe 位置
const actualPublish = new Map() // eventName -> ['rel:line', ...]
const actualSubscribe = new Map() // eventName -> ['rel:line', ...]
const pushLoc = (map, name, loc) => {
  if (!map.has(name)) map.set(name, [])
  map.get(name).push(loc)
}

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
    const lineNo = i + 1
    // 跳过纯注释行：静态门禁只针对可执行代码里的裸字面量，
    // 登记表/文档/代码内示例引用因可能滞后于登记表，不应触发红建。
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) continue

    LITERAL_EVENT_RE.lastIndex = 0
    let m
    while ((m = LITERAL_EVENT_RE.exec(line)) !== null) {
      const fn = m[1]
      const name = m[3]
      const loc = `${rel}:${lineNo}`
      if (!isRegistered(name)) {
        violations++
        console.error(`  ✖ ${loc}  裸事件名未登记: ${fn}('${name}')`)
        continue
      }
      // 收集实测位置，供下方反向校验
      if (fn === 'publish') pushLoc(actualPublish, name, loc)
      else pushLoc(actualSubscribe, name, loc) // subscribe / subscribeOnce
    }
  }
}

// ── ② 反向校验：EVENTS 表的 to / from 必须与代码实测自洽 ──
// 表中引用形如 'file:NN' / ['file:NN', ...]，file 可能是简写文件名（含扩展名）
// 或相对路径。实际调用位置 actual* 已是 'relPath:line'（相对 src/components）。
// 匹配策略：用实际位置的 basename 与表 filename 比对，行号若表给定则比对。
function parseRefs(ref) {
  if (ref == null) return []
  const arr = Array.isArray(ref) ? ref : [ref]
  return arr
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => {
      const idx = s.lastIndexOf(':')
      // 支持两种写法：'file:NN'（含行号）或 'file'（仅文件名，省略行号）
      if (idx === -1) return { file: s, line: null }
      const file = s.slice(0, idx)
      const line = s.slice(idx + 1)
      return { file, line: line === '' || isNaN(Number(line)) ? null : Number(line) }
    })
}

// 取 relPath 的 basename（兼容 Windows 反斜杠）
function basename(p) {
  const norm = p.replace(/\\/g, '/')
  return norm.slice(norm.lastIndexOf('/') + 1)
}

// 判断一个实测位置 'rel:line' 是否落在 ref 指向的文件内（事件名已由外层按 name 过滤）。
// 【行号漂移容错 · 系统根因】表 ref 的 'file:NN' 行号仅作审计参考（供报错定位），**不做逐行硬匹配**：
//   代码任意增删行（加注释/抽函数/改 import）都会让行号下移/上移，若按行号硬拦，会把「行号漂移」
//   误报为「登记失效」，让 prebuild/prettest 在改动无关时反复红建（本脚本 :13 注释已承认该痛点）。
//   改为只要求「该事件在 ref 指向的文件内存在（任意行）」即视为登记命中；只有当目标文件内
//   完全找不到该事件的 publish/subscribe 时才判 stale —— 那才是真正的登记失效（订阅被删/文件改名）。
function matchesRef(loc, ref) {
  const idx = loc.lastIndexOf(':')
  const file = loc.slice(0, idx)
  return basename(file) === ref.file
}

for (const [name, entry] of Object.entries(EVENTS)) {
  if (typeof entry !== 'object' || entry === null) continue

  // from 对应 publish
  const fromRefs = parseRefs(entry.from)
  const realPublish = actualPublish.get(name) || []
  if (fromRefs.length === 0 && realPublish.length > 0) {
    violations++
    console.error(
      `  ✖ EVENTS['${name}'].from 滞后于代码：表中无 from，但代码实测有 publish -> ${realPublish.join(', ')}`
    )
  }
  for (const ref of fromRefs) {
    const hit = realPublish.some((loc) => matchesRef(loc, ref))
    if (!hit) {
      violations++
      console.error(
        `  ✖ EVENTS['${name}'].from 指向 stale/漂移: 表中 ${ref.file}${ref.line != null ? ':' + ref.line : ''} 未匹配到 publish('${name}')（实测: ${realPublish.join(', ') || '无'}）`
      )
    }
  }

  // to 对应 subscribe / subscribeOnce
  const toRefs = parseRefs(entry.to)
  const realSubscribe = actualSubscribe.get(name) || []
  if (toRefs.length === 0 && realSubscribe.length > 0) {
    violations++
    console.error(
      `  ✖ EVENTS['${name}'].to 滞后于代码：表中 to:[] 但代码实测有 subscribe -> ${realSubscribe.join(', ')}（历史误判根因：表标无订阅方、实际已被订阅）`
    )
  }
  for (const ref of toRefs) {
    const hit = realSubscribe.some((loc) => matchesRef(loc, ref))
    if (!hit) {
      violations++
      console.error(
        `  ✖ EVENTS['${name}'].to 指向 stale/漂移: 表中 ${ref.file}${ref.line != null ? ':' + ref.line : ''} 未匹配到 subscribe('${name}')（实测: ${realSubscribe.join(', ') || '无'}）`
      )
    }
  }
}

if (violations === 0) {
  console.log(`\n事件契约校验通过 ✔（已扫描 ${targets.length} 个文件，登记表与代码双向自洽）`)
  process.exit(0)
} else {
  console.error(`\n发现 ${violations} 处事件契约问题 ✖`)
  console.error('① 裸事件名未登记 或 ② 登记表 to/from 与代码实测不一致（滞后/漂移/stale）。')
  console.error('请同步更新 src/components/base/contracts.js 的 EVENTS（禁止仅凭表内 to:[] 判定死事件）。')
  process.exit(1)
}