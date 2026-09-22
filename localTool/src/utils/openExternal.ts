/**
 * utils/openExternal — 拉起外部程序（资源管理器／访达／默认浏览器）的**唯一入口**。
 *
 * 【为什么收口】（143 · S9′ · 取证见任务书 §1.4）
 *   收口前是 **4 处各写一遍**，且**同语义不同实现**：
 *     · `routes/files.ts` ×2：`win32 ? 'explorer' : 'open'` —— **缺 Linux 分支** ⇒ Linux 下调 `open`
 *       （不存在）**必失败**，而两处都用 `catch {}` **静默吞掉**、仍返 200 + path
 *       ⇒ 违反「失败必须可见」（`ADR-0011` / `ADR-0003`）。
 *     · `routes/skills.ts` ×1：三分支（win32／darwin／else）✓ 但仍是第 3 份实现。
 *     · `index.ts` ×1（开浏览器）：`execSync` + `start`，超时 3000（与其余 5000 不一致）。
 *   ⇒ 本次把 **cmd 映射**与**超时**统一到此处；调用点只表达"打开什么"。
 *
 * 【为什么 `shell` 是参数，而不是统一走 shell】（`ADR-0031`：判据不同不合并）
 *   · Windows 的 `start` 是 **cmd 内建命令** ⇒ `execFileSync('start', …)` 必 `ENOENT` ⇒ **只能走 shell**；
 *   · 其余三处的 target **源自用户/磁盘**（目录名可含 `"`、`$()`、反引号，POSIX 文件名本就允许）
 *     ⇒ 拼命令行 = 把注入面直接交出去 ⇒ **必须走 argv**（TD-11-25 已裁）。
 *   ⇒ **形态不可统一**；能统一的只有数值与映射。⚠️ `shell: true` **只允许 target 由本仓自己拼出**
 *   的调用点使用（当前仅"开画布页"一处）。
 *
 * 【失败策略】本原语**抛**（不吞）—— 由调用点决定"失败要不要阻断请求"并**留痕**。
 *   4 个调用点的共识是"打开失败不阻断"（路径已如实返回，UI 可提示用户手动前往），
 *   但**必须可见**：各自 `catch` 后 `console.warn`（会被 logWriter 收进日志文件）。
 */
import { execFileSync, execSync } from 'node:child_process';

/** 拉起外部程序的统一超时（ms）。收口前 `index.ts` 是 3000、其余 5000 —— 统一取 5000（放宽，不是收紧）。 */
export const OPEN_EXTERNAL_TIMEOUT_MS = 5000;

/**
 * 按平台映射「打开」命令 —— **全仓唯一一份**，且是**纯函数**（平台作参数传入）。
 *
 * 【为什么导出且纯】收口前 `files.ts` 两处的映射是 `win32 ? 'explorer' : 'open'` ——
 * **缺 Linux 分支** ⇒ Linux 下调 `open`（不存在）必失败。这种"少一支"的缺陷**只有能逐支断言才拦得住**；
 * 而直接测 `openExternal` 会**真的拉起进程**（测试里不可接受）⇒ 把映射抽成纯函数单测（ADR-0049：落纯逻辑层）。
 */
export function resolveOpenCommand(platform: NodeJS.Platform, opts: { shell: boolean }): string {
  if (platform === 'win32') return opts.shell ? 'start' : 'explorer';
  if (platform === 'darwin') return 'open';
  return 'xdg-open'; // Linux/其他：收口前 files.ts 两处缺这一支 ⇒ 静默失败
}

/**
 * 拉起外部程序打开 `target`（文件／目录／URL）。
 * @param target 要打开的路径或 URL
 * @param opts.shell `true` 时经 shell（**仅** Windows `start` 需要；target 必须由本仓自己拼出）
 * @throws 拉起失败时抛（调用点负责留痕 + 决定是否阻断）
 */
export function openExternal(target: string, opts: { shell: boolean }): void {
  const cmd = resolveOpenCommand(process.platform, opts);
  if (opts.shell) {
    execSync(`${cmd} "${target}"`, { timeout: OPEN_EXTERNAL_TIMEOUT_MS });
  } else {
    // 参数经 argv 传递、不经 shell 解析 ⇒ 目录名里的 `"` / `$()` / 反引号**结构上**无法逃逸
    execFileSync(cmd, [target], { timeout: OPEN_EXTERNAL_TIMEOUT_MS });
  }
}
