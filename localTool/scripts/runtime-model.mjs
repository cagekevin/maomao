#!/usr/bin/env node
/**
 * runtime-model.mjs —— 本机模型资产的**统一取件入口**（plan 147 §一 / §2.3）。
 *
 * 【它是什么】`localTool/runtime-models/<modelId>/` 下每个模型的「看 / 接管 / 排查」三件事：
 *   - `list`   看全部（**现算磁盘事实**，不建 INDEX 副本 —— plan §7）
 *   - `init`   接管一个已下载好的文件 / 换权重后重算清单骨架（sha256 不手算）
 *   - `doctor` 排查：锚点是否命中 · 清单是否齐 · 文件是否就绪（**完整校验委托 `--check`**）
 *
 * 【落点真源与跨语言边界】服务端真源 = `src/paths.ts::getRuntimeModelDir`；本脚本是 Node、
 * **无法 import TS**，故以**自身位置**为锚（`__dirname/..` = `localTool/`，再拼 `runtime-models`）——
 * 这不是"落点判据的第二份"，而是"脚本自身位置"的派生。锚点写错会立刻可见：`doctor` 第一步就把
 * 解析出的绝对路径打出来，并检查它是否存在。
 *
 * 【为什么不自己实现 sha256 校验】完整校验逻辑（含本地镜像 / CDN 回退优先级）已在
 * `fetch-runtime-models.mjs` 里验证过 ⇒ `doctor` 直接**委托**它并原样透传退出码与输出，
 * 避免同一判据出现第二份实现（ADR-0057）。本脚本只在 `init` 里**计算**哈希（生成清单用），不重复"校验"判断。
 *
 * 用法：
 *   node localTool/scripts/runtime-model.mjs list                 # 全部模型概览
 *   node localTool/scripts/runtime-model.mjs list <modelId>       # 单模型文件明细
 *   node localTool/scripts/runtime-model.mjs init <modelId> [--from <文件|目录>]
 *   node localTool/scripts/runtime-model.mjs doctor [modelId]     # 不带 modelId 则查全部
 *
 * 环境变量：
 *   MAOMAO_ROOT  覆盖 localTool/ 根（与服务端 paths.ts 同名同义；测试隔离用）
 */
import { readFile, writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 脚本自身位置派生的锚点（见文件头「跨语言边界」）。 */
const LOCAL_TOOL_ROOT = process.env.MAOMAO_ROOT || path.join(__dirname, '..');
const ROOT = path.join(LOCAL_TOOL_ROOT, 'runtime-models');
const FETCH_SCRIPT = path.join(__dirname, 'fetch-runtime-models.mjs');

/** 入库例外：只有这两个文件进 git，扫目录生成清单时必须排除它们本身。 */
const NON_ASSET_FILES = new Set(['MANIFEST.json', 'README.md']);

function sha256Of(buf) {
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

/** 递归列目录（返回相对 <dir> 的 posix 风格路径，排序稳定）。 */
async function walkFiles(dir) {
  const out = [];
  const visit = async (d) => {
    for (const e of (await readdir(d, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) await visit(abs);
      else if (e.isFile()) out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  await visit(dir);
  return out.sort();
}

/** 已存在的模型目录名（含没有 MANIFEST 的 —— 那也要如实报出来）。 */
async function listModelIds() {
  if (!existsSync(ROOT)) return [];
  return (await readdir(ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function readManifest(modelId) {
  const p = path.join(ROOT, modelId, 'MANIFEST.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(await readFile(p, 'utf8'));
  } catch (e) {
    throw new Error(`MANIFEST.json 不是合法 JSON：${p}\n  ${e.message}`);
  }
}

function fmtMB(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── list：现算磁盘事实（不建 INDEX 副本）────────────────────────────────
async function cmdList(modelIdArg) {
  const ids = modelIdArg ? [modelIdArg] : await listModelIds();
  if (ids.length === 0) {
    console.log(`（${ROOT} 下暂无模型目录）`);
    return 0;
  }
  console.log(`模型资产根：${ROOT}\n`);
  let totalBytes = 0;
  let totalMissing = 0;

  for (const id of ids) {
    const manifest = await readManifest(id);
    if (!manifest) {
      console.log(`⚠️  ${id} —— 有目录但无 MANIFEST.json（未被体系接管）`);
      continue;
    }
    const files = manifest.files ?? [];
    let present = 0;
    let missing = 0;
    let bytes = 0;
    const missingNames = [];
    for (const f of files) {
      // 清单 path 相对 runtime-models/（与 depth-video 既有约定一致），故此处直接拼 ROOT。
      const abs = path.join(ROOT, f.path);
      if (!existsSync(abs)) {
        missing += 1;
        missingNames.push(f.path);
        continue;
      }
      const s = await stat(abs);
      if (f.size != null && s.size !== f.size) missing += 1;
      else present += 1;
      bytes += s.size;
    }
    totalBytes += bytes;
    totalMissing += missing;
    const state = missing === 0 ? `${present} 就绪` : `${present} 就绪 · 缺 ${missing}`;
    console.log(
      `${missing === 0 ? '✅' : '⚠️ '} ${id.padEnd(14)} ${String(files.length).padStart(3)} 个文件 · ` +
        `${fmtMB(bytes).padStart(9)} · ${manifest.runtime ?? '-'} · ${state}`,
    );
    if (manifest.description) console.log(`     ${manifest.description}`);
    if (modelIdArg) {
      for (const f of files) console.log(`       ${f.path}  ${fmtMB(f.size ?? 0)}`);
      // 缺失明细只在「单模型明细」模式打印；概览模式只报计数（明细属 doctor 的活）。
      for (const m of missingNames) console.log(`       ✗ 缺失：${m}`);
    }
  }

  console.log(
    `\n合计：${ids.length} 个目录 · ${fmtMB(totalBytes)} 已在磁盘` +
      (totalMissing ? ` · ⚠️ ${totalMissing} 个文件缺失/尺寸不符（跑 doctor 或 fetch 还原）` : ''),
  );
  return 0;
}

// ── init：接管文件 / 换权重后重算清单骨架 ────────────────────────────────
async function cmdInit(modelId, fromArg) {
  const dir = path.join(ROOT, modelId);
  if (fromArg) {
    if (!existsSync(fromArg)) throw new Error(`--from 路径不存在：${fromArg}`);
    const srcStat = await stat(fromArg);
    await mkdir(dir, { recursive: true });
    if (srcStat.isDirectory()) {
      // 目录：整体并入（保留内部结构）
      for (const rel of await walkFiles(fromArg)) {
        const dest = path.join(dir, rel);
        await mkdir(path.dirname(dest), { recursive: true });
        await copyFile(path.join(fromArg, rel), dest);
      }
      console.log(`已并入目录：${fromArg} → ${dir}`);
    } else {
      const dest = path.join(dir, path.basename(fromArg));
      await copyFile(fromArg, dest);
      console.log(`已接管文件：${fromArg} → ${dest}`);
    }
  }
  if (!existsSync(dir)) {
    throw new Error(`模型目录不存在：${dir}（先放文件，或用 --from 传入）`);
  }

  const previous = await readManifest(modelId);
  const prevByPath = new Map((previous?.files ?? []).map((f) => [f.path, f]));
  const keptSource = new Map(
    (previous?.files ?? []).filter((f) => f.source).map((f) => [f.path, f.source]),
  );

  const rels = (await walkFiles(dir)).filter((r) => !NON_ASSET_FILES.has(r));
  if (rels.length === 0) throw new Error(`目录里没有任何资产文件：${dir}`);

  const files = [];
  for (const rel of rels) {
    // 清单 path 相对 runtime-models/（含 <modelId>/ 前缀）—— 与 depth-video 既有约定一致。
    const manifestPath = `${modelId}/${rel}`;
    const abs = path.join(dir, rel);
    const buf = await readFile(abs);
    const entry = { path: manifestPath, size: buf.length, sha256: sha256Of(buf) };
    const src = keptSource.get(manifestPath);
    entry.source = src ?? '';
    files.push(entry);
  }

  const added = files.filter((f) => !prevByPath.has(f.path)).map((f) => f.path);
  const removed = [...prevByPath.keys()].filter((p) => !files.some((f) => f.path === p));
  const changed = files
    .filter((f) => prevByPath.has(f.path) && prevByPath.get(f.path).sha256 !== f.sha256)
    .map((f) => f.path);

  const manifest = {
    tool: modelId,
    runtime: previous?.runtime ?? 'browser',
    description: previous?.description ?? `（待补：这个模型是做什么用的）`,
    generatedAt: new Date().toISOString().slice(0, 10),
    sourceNote:
      previous?.sourceNote ??
      '各条 source 留空表示无可稳定直取的单文件 URL —— 网络/换机还原走网盘镜像（aliyun-models.py），' +
        '或在有直取 URL 时逐条补上 source。',
    files,
  };
  const outPath = path.join(dir, 'MANIFEST.json');
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`\n已写出清单：${outPath}（${files.length} 个文件）`);
  if (added.length) console.log(`  + 新增 ${added.length}：${added.join('、')}`);
  if (changed.length) console.log(`  ~ 哈希变更 ${changed.length}：${changed.join('、')}`);
  if (removed.length) console.log(`  - 从清单移除 ${removed.length}：${removed.join('、')}`);
  console.log('\n下一步（清单只保证"文件事实"，这两项要人来填）：');
  console.log('  1) MANIFEST.json 的 description —— 这个模型做什么用');
  console.log('  2) 若有可稳定直取的下载 URL，逐条补 source（留空则走网盘镜像）');
  console.log(`  3) 校验：node ${path.relative(process.cwd(), FETCH_SCRIPT)} ${modelId} --check`);
  return 0;
}

// ── doctor：锚点 / 清单 / 就绪度（完整校验委托 fetch --check）──────────────
function cmdDoctor(modelId) {
  let problems = 0;
  console.log('① 落点锚点');
  console.log(`   脚本位置：${__dirname}`);
  console.log(`   解析得：  ${ROOT}`);
  if (!existsSync(ROOT)) {
    console.log(
      '   ❌ 锚点未命中：该目录不存在 ⇒ 脚本位置与落点约定不一致（见文件头「跨语言边界」）',
    );
    return 1;
  }
  console.log('   ✅ 锚点命中');

  console.log('\n② 完整校验（委托 fetch-runtime-models.mjs --check，避免第二份实现）');
  const args = [FETCH_SCRIPT, ...(modelId ? [modelId] : []), '--check'];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.error) {
    console.log(`   ❌ 无法执行：${r.error.message}`);
    problems += 1;
  } else if (r.status !== 0) {
    problems += 1;
  }

  console.log(`\n结论：${problems === 0 ? '✅ 全部就绪' : `⚠️ ${problems} 项有问题（见上）`}`);
  return problems === 0 ? 0 : 1;
}

// ── 入口 ──────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const fromIdx = argv.indexOf('--from');
  // 【禁止静默降级】`--from` 无值（漏写路径，或下一个 token 又是开关）必须当场报错：
  // 否则会被当成"没传 --from" ⇒ 跳过接管、却照常生成清单并打印「已写出清单」，用户以为文件已接管（一诚实闸）。
  if (fromIdx >= 0 && (!argv[fromIdx + 1] || argv[fromIdx + 1].startsWith('--'))) {
    throw new Error('--from 缺少路径值（用法：init <modelId> --from <文件|目录>）');
  }
  const fromArg = fromIdx >= 0 ? argv[fromIdx + 1] : null;
  const modelId = argv.slice(1).find((a) => !a.startsWith('--') && a !== fromArg) ?? null;

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log('用法：');
    console.log(
      '  runtime-model.mjs list [modelId]                  # 看全部 / 单模型明细（现算磁盘）',
    );
    console.log(
      '  runtime-model.mjs init <modelId> [--from <路径>]  # 接管文件并生成/更新 MANIFEST',
    );
    console.log('  runtime-model.mjs doctor [modelId]                # 排查锚点 · 清单 · 就绪度');
    return 0;
  }
  if (cmd === 'list') return cmdList(modelId);
  if (cmd === 'init') {
    if (!modelId) throw new Error('init 需要 <modelId>（目录名 = modelId）');
    return cmdInit(modelId, fromArg);
  }
  if (cmd === 'doctor') return cmdDoctor(modelId);
  throw new Error(`未知子命令：${cmd}（可用：list / init / doctor）`);
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  });
