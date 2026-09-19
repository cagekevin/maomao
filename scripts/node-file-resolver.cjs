/**
 * node-file-resolver.cjs
 * 节点组件文件「落点」的唯一事实来源（.mjs / .cjs 两侧共用）。
 *
 * 【背景：为什么必须有本文件（2026-09-19 · 域归位 A2「拆 canvas/nodes —— 11 件节点按产品 cat 归位」）】
 *   节点组件被拆到各能力域后，**多处脚本仍在各自拼 `canvas/nodes/...` 路径** ⇒
 *   「文件搬了、闸没搬」，且失败形态**静默**（不是报错，是闸悄悄变瞎 / 豁免悄悄失灵）：
 *     · check-node-handles.mjs  规则 1 豁免派生 → 文件找不到 ⇒ 豁免失效（build 硬红）；
 *                               规则 3 扫描根   → 覆盖 15 件掉到 4 件 ⇒ 规则 3 基本变瞎；
 *     · check-node-data.mjs     映射表 3 条路径 stale ⇒ --strict exit 1（build 硬红）；
 *                               收尾「未登记文件」检查只读 canvas/nodes ⇒ 失去防过期能力；
 *     · _smoke_checks.cjs       nodeTypes 单源校验（2026-09-19 先行修复，今并入本模块）。
 *   母体与 check-targets.mjs 同源（「改了目录结构、忘了补校验范围」），故同法收口：
 *   **位置只在本文件写一份，消费方一律经本模块解析，禁止再拼节点目录路径。**
 *
 * 【两类目录，别混用（本轮实测教训）】
 *   · COMPONENT_SEARCH_DIRS —— 「解析落点」用：包含**直挂域根**的节点（scriptbox/ · text/）。
 *   · NODE_DIRS（= 前者中以 /nodes 结尾的子集）—— 「按目录枚举/扫描」用。
 *     域根里混有 UI/工具文件（Select.tsx · ScriptBoxModal.tsx · scriptBoxPlaybookManager.tsx…），
 *     拿它当节点目录枚举会把它们全部误报成「未登记的节点」（本轮实测误报 10 件）。
 *
 * 【维护】新增节点落点只改下方 COMPONENT_SEARCH_DIRS（唯一可写点）。
 *
 * 消费方：check-node-handles.mjs · check-node-data.mjs · _smoke_checks.cjs
 */
'use strict';

const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

/**
 * 节点组件候选落点（相对仓库根，按序解析）。
 * 2026-09-19 A2 后的实际分布：canvas/nodes（Director3D/GhostTarget/Group/_template）·
 * image/nodes（7 件）· video/nodes（3 件）· text/（TextGenerate **直挂域根**）·
 * scriptbox/（ScriptBoxNode **直挂应用域根**）。含 /nodes 者为纯节点目录。
 */
const COMPONENT_SEARCH_DIRS = [
  'src/components/canvas/nodes',
  'src/components/image/nodes',
  'src/components/video/nodes',
  'src/components/text/nodes',
  'src/components/text',
  'src/components/scriptbox',
  'src/components/agent/nodes',
];

/** 组件可能的源码扩展名 */
const COMPONENT_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

/** 目录存在则返回（避免调用方各自 try/catch） */
function existingDir(abs) {
  try {
    return statSync(abs).isDirectory() ? abs : null;
  } catch {
    return null;
  }
}

/**
 * 「解析落点」用的候选目录（绝对路径，含直挂域根者）。
 * @param {string} root 仓库根绝对路径
 * @returns {string[]}
 */
function allComponentDirs(root) {
  return COMPONENT_SEARCH_DIRS.map((d) => existingDir(join(root, d))).filter(Boolean);
}

/**
 * 「按目录枚举/扫描」用的节点目录（绝对路径）—— 只取 /nodes 结尾者。
 * 域根不进此列：域根混有 UI/工具文件，枚举会把它们误当节点。
 * @param {string} root 仓库根绝对路径
 * @returns {string[]}
 */
function nodeDirs(root) {
  return COMPONENT_SEARCH_DIRS.filter((d) => d.endsWith('/nodes'))
    .map((d) => existingDir(join(root, d)))
    .filter(Boolean);
}

/**
 * 节点 type（camelCase）→ 组件文件名候选。
 * type 与文件名**非一一对应**（group→GroupNode · textGenerateNode→TextGenerate ·
 * director3dNode→Director3DNode），故给出候选集后**忽略大小写**比对真实文件名。
 * @param {string} type 如 scriptBoxNode
 * @returns {string[]} 如 ['ScriptBoxNode', 'ScriptBoxNodeNode', 'ScriptBox']
 */
function candidateNames(type) {
  const pascal = type.charAt(0).toUpperCase() + type.slice(1);
  const cands = [pascal, `${pascal}Node`];
  if (pascal.endsWith('Node')) cands.push(pascal.slice(0, -4));
  return cands;
}

/**
 * 建「组件文件名(去扩展名, 小写) → 绝对路径」索引（一次扫描，多次查询）。
 * 按 COMPONENT_SEARCH_DIRS 顺序扫描，先到先得 ⇒ 纯节点目录优先于域根，避免域根同名件抢位。
 * @param {string} root 仓库根绝对路径
 * @returns {Map<string, string>}
 */
function buildIndex(root) {
  const index = new Map();
  for (const dir of allComponentDirs(root)) {
    for (const name of readdirSync(dir)) {
      const ext = COMPONENT_EXTS.find((e) => name.endsWith(e));
      if (!ext) continue;
      const key = name.slice(0, -ext.length).toLowerCase();
      if (!index.has(key)) index.set(key, join(dir, name));
    }
  }
  return index;
}

/**
 * 节点 type → 组件文件绝对路径。
 * 找不到返回 null：调用方须**fail-loud**（点名真源），不得静默跳过 —— 静默跳过正是
 * 「闸变瞎却绿」的成因（见文件头）。
 * @param {string} root 仓库根绝对路径
 * @param {string} type 节点类型（NODE_HANDLE_CONTRACT 的键）
 * @param {Map<string,string>} [index] 复用 buildIndex 结果（可选）
 * @returns {string|null}
 */
function resolveNodeComponent(root, type, index) {
  const idx = index || buildIndex(root);
  for (const cand of candidateNames(type)) {
    const hit = idx.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

module.exports = {
  COMPONENT_SEARCH_DIRS,
  COMPONENT_EXTS,
  allComponentDirs,
  nodeDirs,
  candidateNames,
  buildIndex,
  resolveNodeComponent,
};
