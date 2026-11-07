/**
 * type-check 包装器：跑 `tsc --noEmit`，结束后把「交付四问」打到 stdout。
 *
 * 【为什么存在（AGENTS.md §9.1）】四问必须写进交付回复，但 AI 常常只在心里过一遍 ——
 * 把它钉在 type-check 的输出末尾：每次类型检查都把这段话原样打出来，AI 读到即必须逐条照答。
 * 挂在这里而不是单独的提示文件，是因为 type-check 是每次改码都会跑的那条命令（pre-commit / gates 同款）。
 *
 * 【退出码】原样透传 tsc 的退出码 —— 包装器自己永不改变成败判定：
 * 失败仍非零（pre-commit / gates-run 照常拦），成功才 0。禁止在这里 `exit 0` 兜底。
 *
 * 【为什么用 node 而不是 shell 串联】`tsc; echo; exit $?` 在 Windows 上不兼容（`;` / `$?`），
 * 本仓有 Windows 使用场景（launch-all.ps1），故用 node 跨平台实现。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

const FOUR_QUESTIONS = `
────────────────────────────────────────────────────────────────────
【交付四问 · 必须写进本轮回复，不许只在心里想】（AGENTS.md §9.1）

1. 这轮动了哪个入口？**旧入口还在吗**？（\`git diff\` 里每个 \`export\` 逐个看）
2. 旧入口还在的话，它的消费者**全部**迁完了吗？没迁完 = 两条线 = **未完成**。
3. 同一能力数出几个入口？同前缀并存（\`Xxx\` 与 \`XxxOr\` / \`XxxRaw\`）或旧入口仍被调用 ⇒ **两条线**。
4. **这段代码下一个 AI 看得懂吗**？有没有**唯一范本可照抄对**？既看不懂又没范本 ⇒ 不许交付。

出现两条线（1–3）⇒ 不许写「已完成 / 已修复 / 已收口」，回去删掉其中一条。

> 绿 ≠ 对。\`npm run check\` 全绿只证明「你没踩坏现有测试」，证明不了「你没多造第二条路」。
────────────────────────────────────────────────────────────────────
`;

function printFourQuestions() {
  // 直接写 stdout：让 AI 与用户在同一段输出里都看得到，不依赖 stderr 被过滤
  process.stdout.write(FOUR_QUESTIONS);
}

if (!existsSync(tscBin)) {
  process.stderr.write(`[type-check] 找不到 tsc：${tscBin}（先 npm install）\n`);
  printFourQuestions();
  process.exit(1);
}

const result = spawnSync(process.execPath, [tscBin, '--noEmit'], {
  cwd: root,
  stdio: 'inherit',
});

// 无论 tsc 成败都打印：失败时更需要这四问（此时最可能只想着「修红」而多造一条路）
printFourQuestions();

if (result.error) {
  process.stderr.write(`[type-check] 启动 tsc 失败：${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
