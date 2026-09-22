/**
 * openExternal — 平台映射三分支（143 · S9′）
 * ------------------------------------------------------------
 * 【为什么必须有】收口前 `routes/files.ts` 两处的映射是 `win32 ? 'explorer' : 'open'`
 * —— **缺 Linux 分支** ⇒ Linux 下调 `open`（不存在）必失败，且被 `catch {}` 静默吞掉、仍返 200。
 * 这类"少一支"的缺陷只有**逐支断言**才拦得住；而直接调 `openExternal` 会真的拉起进程
 * （测试里不可接受）⇒ 断言纯函数 `resolveOpenCommand`（ADR-0049：测试投入落纯逻辑层）。
 *
 * ⚠️ 本文件**不覆盖**"打开失败是否留痕" —— 那需要真拉起一个会失败的进程，成本与副作用都不可接受。
 *    该项按 ADR-0049 第 6 级**诚实声明 + 人读**（4 个调用点均已 `catch` 后 `console.warn`）。
 *
 * 运行：cd localTool && npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpenCommand, OPEN_EXTERNAL_TIMEOUT_MS } from '../src/utils/openExternal.ts';

test('三分支全覆盖：linux/darwin/win32 各返对应命令（files.ts 曾缺 linux ⇒ 静默失败）', () => {
  assert.equal(resolveOpenCommand('linux', { shell: false }), 'xdg-open');
  assert.equal(resolveOpenCommand('freebsd', { shell: false }), 'xdg-open'); // 非 win/mac 一律 xdg-open
  assert.equal(resolveOpenCommand('darwin', { shell: false }), 'open');
  assert.equal(resolveOpenCommand('win32', { shell: false }), 'explorer');
});

test('shell:true 只改变 win32 的命令（start 是 cmd 内建，argv 形态会 ENOENT）', () => {
  assert.equal(resolveOpenCommand('win32', { shell: true }), 'start');
  // 非 Windows：shell 开关不该改命令（它们都能 argv 调用）
  assert.equal(resolveOpenCommand('linux', { shell: true }), 'xdg-open');
  assert.equal(resolveOpenCommand('darwin', { shell: true }), 'open');
});

test('超时统一为 5000（收口前 index.ts 是 3000、其余 5000）', () => {
  assert.equal(OPEN_EXTERNAL_TIMEOUT_MS, 5000);
});
