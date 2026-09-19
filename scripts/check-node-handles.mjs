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
 *   2. 例外（规则 1）：节点级「非标端口」豁免由真源 `contracts.ts::NODE_HANDLE_CONTRACT[].customHandles`
 *      机器可读声明、本脚本运行时派生（见 `customHandleNodeFiles`），**不在本闸手抄**；
 *      仅「实现定义文件」NodeShell（非 node type）留在此处。禁止真源与闸两处重复维护（SSOT）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸**（端口渲染路径 = 写法/分层偏好），但守的后果是正确性（漏口 = 边静默不渲染）。
 *   Q2 何时该改：**净新增"合法复合节点"被拦时，先问"能否让端口从 `NODE_HANDLE_CONTRACT` 派生"**；
 *               `HANDLE_EXEMPT` 出现**第 3 条同型例外**（非 node type 的实现文件）→ 判据该改。
 *   Q3 怎么改：优先改**真源** `contracts.ts::NODE_HANDLE_CONTRACT`（加 `customHandles: true`，端口真源，App/lazyNode 只允许派生）；
 *               `HANDLE_EXEMPT`（**本闸内清单，仅非 node type 文件**）**只收窄**，新增须逐条注明原因。
 *
 * 边界：
 *  - 只做文件级文本扫描（零新依赖），不做 AST；注释行整行跳过。
 *  - 扫描根复用 check-targets.mjs，避免新增目录形成校验盲区。
 *
 * 用法：
 *   node scripts/check-node-handles.mjs                 # 校验全部
 *   node scripts/check-node-handles.mjs src/components/canvas/nodes/VideoProcessNode.tsx
 */
import { readFileSync } from 'node:fs';
import { resolve, extname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultTargets } from './check-targets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

// ── 闸内「显式豁免」只保留**非 node type** 的实现定义文件 ──
// 节点级的「非标端口」豁免（如 ScriptBoxNode 走 overlayHandles）由真源
// `src/components/base/core/contracts.ts::NODE_HANDLE_CONTRACT[].customHandles` 机器可读声明、
// 本脚本扫描前运行时派生（见 `customHandleNodeFiles`），**本闸不再手抄**（SSOT：仅真源一份，TD-17-4）。
// key = 相对仓库根的路径（不带扩展名），value = 豁免原因（文档化，禁止裸加）。
//
// 收紧原则（2026-09-10 端口收口）：只有「端口数量/位置随数据动态变化，无法用单个
// targetHandleId / sourceHandleId 表达」的节点才允许豁免。凡「固定的一进一出」——
// 哪怕 handleId 是语义名（in / active / batch / merged-output）——一律走 NodeShell 声明式，
// 不得进白名单。历史教训：GridMerge/GridSplit/ImageBox/Group 都曾被错误豁免，掩盖了
// children 手写口定位基准错误（建边成功但线不显示）的真实隐患。
const HANDLE_EXEMPT = {
  'src/components/base/ui/NodeShell': '端口渲染的唯一标准实现，本身即定义处（非 node type，不属 NODE_HANDLE_CONTRACT）',
};

const SHOW_HANDLES_OFF_RE = /showHandles\s*=\s*\{\s*false\s*\}/;
const CUSTOM_HANDLE_RE = /<CustomHandle\b/;

const args = process.argv.slice(2);
const targets = args.length > 0 ? args.map((a) => resolve(root, a)) : defaultTargets(root);

// ── 加载端口真源（NODE_HANDLE_CONTRACT）并派生三组集合（规则 1/3 共用，须在扫描前就绪）──
// TD-17-4 · SSOT 收口：节点级「非标端口」豁免由真源 `customHandles: true` 机器可读声明，
// 此处运行时派生其节点文件路径，闸内不再手抄（避免漂移 → 闸与真源两处维护的债）。
let contractTargets = new Set();
let contractSources = new Set();
let customHandleNodeFiles = new Set();
try {
  const contracts = await import(
    pathToFileURL(resolve(root, 'src/components/base/core/contracts.ts')).href
  );
  for (const [type, h] of Object.entries(contracts.NODE_HANDLE_CONTRACT || {})) {
    if (h.targetHandleId) contractTargets.add(h.targetHandleId);
    if (h.sourceHandleId) contractSources.add(h.sourceHandleId);
    if (h.customHandles) {
      const pascal = type.charAt(0).toUpperCase() + type.slice(1);
      const rel = `src/components/canvas/nodes/${pascal}`;
      try {
        readFileSync(resolve(root, `${rel}.tsx`), 'utf8');
        customHandleNodeFiles.add(rel);
      } catch {
        // 推导不到 / 文件缺失 → 不豁免，交由规则 1 红出后回真源补（fail-safe）
      }
    }
  }
} catch (e) {
  console.error('  ✖ 无法加载 contracts.NODE_HANDLE_CONTRACT：', e.message);
  process.exit(1);
}

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
  if (HANDLE_EXEMPT[relNoExt] || customHandleNodeFiles.has(relNoExt)) continue; // 已登记特例（含真源派生的非标端口节点）

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

// ── 规则 3（TD-04-1）：节点文件声明的端口 ⊆ contracts.NODE_HANDLE_CONTRACT ──
// 背景：节点端口真源是各节点文件的 NodeShell targetHandleId/sourceHandleId prop。契约表
// contracts.NODE_HANDLE_CONTRACT 供 App 补边 + lazyNode 占位骨架消费。二者一旦不同步（节点新声明
// 了非默认口但契约表漏登记），App 恢复存量边/建边时补不正 handle → 边静默不渲染 / code-008。
// 本规则对账「节点文件里出现的每个 targetHandleId/sourceHandleId 字面量值，必须在契约表对应侧存在」，
// 漏登记即红（防漂移回潮）。


// 节点文件里的 NodeShell handle prop 字面量（只扫节点目录，排除注释行）
const NODE_DIR = resolve(root, 'src/components/nodes');
const TARGET_PROP_RE = /\btargetHandleId\s*=\s*"([^"]+)"/;
const SOURCE_PROP_RE = /\bsourceHandleId\s*=\s*"([^"]+)"/;
const declaredHandleFiles = [];
for (const file of defaultTargets(root)) {
  if (!file.startsWith(NODE_DIR + sep)) continue;
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(root, file).split(sep).join('/');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('*/')) continue;
    const tm = TARGET_PROP_RE.exec(lines[i]);
    if (tm && !contractTargets.has(tm[1])) {
      violations++;
      console.error(
        `  ✖ ${rel}:${i + 1}  targetHandleId="${tm[1]}" 未登记到 contracts.NODE_HANDLE_CONTRACT`,
      );
      console.error(`      → 在 contracts.NODE_HANDLE_CONTRACT[<type>].targetHandleId 补 "${tm[1]}"（防 App 补边漏 handle）。`);
    }
    const sm = SOURCE_PROP_RE.exec(lines[i]);
    if (sm && !contractSources.has(sm[1])) {
      violations++;
      console.error(
        `  ✖ ${rel}:${i + 1}  sourceHandleId="${sm[1]}" 未登记到 contracts.NODE_HANDLE_CONTRACT`,
      );
      console.error(`      → 在 contracts.NODE_HANDLE_CONTRACT[<type>].sourceHandleId 补 "${sm[1]}"（防 App 补边漏 handle）。`);
    }
    if (tm || sm) declaredHandleFiles.push(rel);
  }
}

if (violations === 0) {
  console.log(`\n节点端口契约校验通过 ✔（已扫描 ${targets.length} 个文件，特例 ${Object.keys(HANDLE_EXEMPT).length + customHandleNodeFiles.size} 个已登记（含真源派生）；契约表 target ${contractTargets.size} / source ${contractSources.size}）`);
  process.exit(0);
} else {
  console.error(`\n发现 ${violations} 处端口契约问题（会导致连线不渲染 / 补边漏 handle）✖`);
  process.exit(1);
}
