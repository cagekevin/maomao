/**
 * check-targets.mjs
 * 各 check-* 契约脚本共享的【默认扫描根】，唯一事实来源。
 *
 * 背景（为什么要抽出来）：check-events / check-storage-keys / check-node-types 原本各自
 * `collectSources(join(root, 'src/components'))`，把范围写死在自己文件里。横切 hook 收口到
 * `src/hooks/` 之后，这些脚本仍只扫 components，19 个 hook 直接逃出所有契约校验
 * （表现为 check-keys 扫描文件数从 232 掉到 213，且 EVENTS 表里指向 hook 的 to/from
 * 全被误判为 stale/漂移）。
 *
 * 这里把扫描根集中成一处：以后新增顶层目录（如 src/hooks、未来的 src/context）
 * 只改本文件，避免「改了目录结构、忘了补校验范围」再次形成盲区。
 *
 * 另外：本文件是 ESM 侧拿「永久豁免清单 + 扩展名无关解析 + JSX 探测」的转出口，
 * 真实定义在 ts-exts.cjs（CJS，.cjs/.mjs 两边共用一份）。
 *
 * 界限：
 *  - 只列【应受契约校验】的源码目录；third-party / 生成物 / 测试夹具不在内。
 *  - 目录不存在时静默跳过（本地分支可能尚未创建该目录），保持脚本可用。
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createRequire } from 'node:module'

// 扩展名无关解析 + 永久豁免清单 + JSX 探测的唯一事实来源（CJS，供 .cjs/.mjs 共用）
const require = createRequire(import.meta.url)
const {
  SOURCE_EXTS,
  TS_EXEMPT_DIRS,
  TS_EXEMPT_FILES,
  isExempt,
  resolveSourceFile,
  hasJsx,
  hasJsxHintRaw,
  detectExt,
} = require('./ts-exts.cjs')

/** 受契约校验的源码目录（相对仓库根） */
export const SCAN_DIRS = ['src/components', 'src/hooks']

/** 受校验的源码扩展名 */
export const SCAN_EXTS = SOURCE_EXTS

/** 转出口：ESM 脚本（mv-sync-refs / extract-tailwind / check-node-types / check-storage-keys）从这里取，避免各写一份 */
export { SOURCE_EXTS, TS_EXEMPT_DIRS, TS_EXEMPT_FILES, isExempt, resolveSourceFile, hasJsx, hasJsxHintRaw, detectExt }

/**
 * 读取源码文件内容（扩展名无关）。
 *
 * 用途：诊断/一次性脚本（如 test_group_*.mjs）需要按路径读源码做静态断言，写死后继扩展名
 * 会在 TS 化那刻直接 ENOENT，且这类脚本不在任何门禁里，坏了长期无人发现（2026-09-02 实测
 * 4 个 group 诊断脚本全在指 projectStore.js / groupNodes.js）。统一走这里即可免疫后缀漂移。
 *
 * 更新(2026-09-04)：上述 4 个 group 诊断脚本（`test_all_positions.mjs` / `test_group_collapse|persist|size.mjs`）
 * 因全仓 0 引用已随治理清理删除，本函数的现存消费者只剩 `check-node-types.mjs` / `check-storage-keys.mjs` /
 * `mv-sync-refs.mjs`。保留上段历史推理（说明"为什么"要有扩展名无关解析），勿删。
 *
 * @param {string} abs 绝对路径，可带也可不带扩展名（'.../projectStore' 或 '.../projectStore.js'）
 * @returns {string} 文件内容
 */
export function readSourceFile(abs) {
  const hit = resolveSourceFile(abs)
  if (!hit) throw new Error(`[check-targets] 源码文件未找到（扩展名无关解析失败）: ${abs}`)
  return readFileSync(hit, 'utf8')
}

/** 递归收集 dir 下的源码文件绝对路径 */
export function collectSources(dir, acc = []) {
  if (!existsSync(dir)) return acc // 目录不存在 → 静默跳过
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectSources(full, acc)
    } else if (SCAN_EXTS.includes(extname(name))) {
      acc.push(full)
    }
  }
  return acc
}

/**
 * 默认扫描目标：SCAN_DIRS 下的全部源码文件。
 * @param {string} root 仓库根目录绝对路径
 * @returns {string[]} 文件绝对路径数组
 */
export function defaultTargets(root) {
  const out = []
  for (const d of SCAN_DIRS) collectSources(join(root, d), out)
  return out
}
