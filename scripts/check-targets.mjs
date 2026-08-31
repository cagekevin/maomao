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
 * 界限：
 *  - 只列【应受契约校验】的源码目录；third-party / 生成物 / 测试夹具不在内。
 *  - 目录不存在时静默跳过（本地分支可能尚未创建该目录），保持脚本可用。
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'

/** 受契约校验的源码目录（相对仓库根） */
export const SCAN_DIRS = ['src/components', 'src/hooks']

/** 受校验的源码扩展名 */
export const SCAN_EXTS = ['.js', '.jsx', '.ts', '.tsx']

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
