/**
 * check-node-handles.mjs
 * 编译期（静态）拦截「端口手写失控」—— 节点端口契约的硬门禁。
 *
 * 背景（为什么要加本脚本）：
 *   React Flow 渲染一条边时，用 edge.sourceHandle / targetHandle 去源/目标节点的
 *   handleBounds 里查句柄位置；查不到就【静默不渲染那条边】（或报 code-008）。
 *   表现即「从输出端口拉出来、选节点、建好了，但连出来没有线」。
 *
 *   根因是端口渲染没有单一事实来源：NodeShell 提供 showHandles + sourceHandleId /
 *   targetHandleId 的标准端口渲染路径（端口渲染在「主框内部」，定位基准正确）；
 *   而部分节点用 showHandles={false} 关掉标准口后，在 children 里手写 <CustomHandle>。
 *   children 的定位基准是主框（不含标题栏），与 NodeShell 的端口层不一致；更严重的是
 *   手写口的 id/位置完全靠作者自觉，漏一个就出现「建边成功但线不显示」。
 *   历史事故：VideoProcessNode（视频处理）右侧 main-output 就属于此类。
 *
 * 规则（只拦「明确错误」，不拦合理特例）：
 *   1. 一个节点文件里若同时出现 `showHandles={false}`，说明作者显式接管了端口渲染，
 *      此时禁止在 JSX 里裸写 <CustomHandle .../>（应改用 NodeShell 的
 *      targetHandleId / sourceHandleId prop 声明，让端口走标准渲染路径）。
 *   2. 例外白名单 HANLE_EXEMPT：确实需要「非标位置/多端口」的复合节点
 *      （如 ScriptBoxNode 每镜头一个口、GridMergeNode 多输出口），
 *      逐个登记并注明原因，禁止默默新增。
 *
 * 边界：
 *  - 只做文件级文本扫描（零新依赖），不做 AST；注释行整行跳过。
 *  - 扫描根复用 check-targets.mjs，避免新增目录形成校验盲区。
 *
 * 用法：
 *   node scripts/check-node-handles.mjs                 # 校验全部
 *   node scripts/check-node-handles.mjs src/components/nodes/VideoProcessNode.tsx
 */
import { readFileSync } from 'node:fs';
import { resolve, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultTargets } from './check-targets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// ── 合理特例白名单（复合节点：非标位置 / 动态多端口，必须走手写口）──
// key = 相对仓库根的路径（不带扩展名），value = 豁免原因（文档化，禁止裸加）。
//
// 收紧原则（2026-09-10 端口收口）：只有「端口数量/位置随数据动态变化，无法用单个
// targetHandleId / sourceHandleId 表达」的节点才允许豁免。凡「固定的一进一出」——
// 哪怕 handleId 是语义名（in / active / batch / merged-output）——一律走 NodeShell 声明式，
// 不得进白名单。历史教训：GridMerge/GridSplit/ImageBox/Group 都曾被错误豁免，掩盖了
// children 手写口定位基准错误（建边成功但线不显示）的真实隐患。
const HANDLE_EXEMPT = {
  'src/components/nodes/ScriptBoxNode':
    '每镜头一个 source 口（shot-*）+ 左侧 in 口，端口数量随 data.shots 动态变化，非标一格；' +
    '且必须走 overlayHandles（挂根 div 基准正确），不能用 children（code-008）',
  'src/components/base/ui/NodeShell': '端口渲染的唯一标准实现，本身即定义处',
};

const SHOW_HANDLES_OFF_RE = /showHandles\s*=\s*\{\s*false\s*\}/;
const CUSTOM_HANDLE_RE = /<CustomHandle\b/;

const args = process.argv.slice(2);
const targets = args.length > 0 ? args.map((a) => resolve(root, a)) : defaultTargets(root);

let violations = 0;

for (const file of targets) {
  const rel = relative(root, file).split(sep).join('/');
  const relNoExt = rel.slice(0, rel.length - extname(rel).length);

  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  // 只关心同时「显式关闭标准口」且「手写 CustomHandle」的文件
  const lines = src.split('\n');
  const offLines = [];
  const handleLines = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) continue;
    if (SHOW_HANDLES_OFF_RE.test(lines[i])) offLines.push(i + 1);
    if (CUSTOM_HANDLE_RE.test(lines[i])) handleLines.push(i + 1);
  }

  if (offLines.length === 0 || handleLines.length === 0) continue;
  if (HANDLE_EXEMPT[relNoExt]) continue; // 已登记特例

  violations++;
  console.error(
    `  ✖ ${rel}:${handleLines.join(',')}  showHandles={false}（${offLines.join(',')}）却又手写 <CustomHandle>`,
  );
  console.error(
    `      → 端口请改走 NodeShell 的 targetHandleId / sourceHandleId prop（标准渲染路径，定位基准正确）；`,
  );
  console.error(
    `      → 确属复合节点（多口/动态口）需手写，请在 scripts/check-node-handles.mjs 的 HANDLE_EXEMPT 登记原因。`,
  );
}

if (violations === 0) {
  console.log(`\n节点端口契约校验通过 ✔（已扫描 ${targets.length} 个文件，特例 ${Object.keys(HANDLE_EXEMPT).length} 个已登记）`);
  process.exit(0);
} else {
  console.error(`\n发现 ${violations} 处端口手写失控（会导致连线不渲染）✖`);
  process.exit(1);
}
