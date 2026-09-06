#!/usr/bin/env node
/**
 * fetch-runtime-models.mjs
 * ───────────────────────────────────────────────────────────────────────
 * 依据 localTool/runtime-models/<tool>/MANIFEST.json 重新拉取「本机推理资源」
 * （模型权重 .onnx + 推理运行时 .wasm/.mjs/.js）。这些二进制不入库（见
 * .gitignore 与 docs/95-本机推理模型资源-GitHub规范.md），靠本脚本在本地 /
 * CI 重建。每次拉取都按 MANIFEST 的 sha256 校验，保证字节一致、可复现。
 *
 * 用法：
 *   node scripts/fetch-runtime-models.mjs                 # 拉取全部工具
 *   node scripts/fetch-runtime-models.mjs depth-video     # 仅拉取指定工具
 *   node scripts/fetch-runtime-models.mjs --check         # 仅校验，不下载
 *   node scripts/fetch-runtime-models.mjs --from C:\path\to\src   # 指定本地镜像
 *   node scripts/fetch-runtime-models.mjs --no-verify     # 跳过 sha256 校验（不推荐）
 *
 * 环境变量：
 *   DEPTH_VIDEO_SRC        本地镜像根目录（默认见 MANIFEST.localMirror.default），优先于下载
 *   TRANSFORMERS_VERSION  钉死 transformers.js CDN 版本（避免漂移导致 sha 不匹配）
 *   ONNXRUNTIME_VERSION   钉死 onnxruntime-web CDN 版本
 */
import { readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'runtime-models'); // localTool/runtime-models

function sha256Of(buf) {
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}
async function sha256File(p) {
  return sha256Of(await readFile(p));
}
async function fileSize(p) {
  return (await stat(p)).size;
}
function buildSource(manifest, f) {
  if (f.source) return f.source;
  const v = f.group && manifest.vendor?.[f.group];
  if (v) {
    const ver = process.env[v.versionEnv];
    const base = ver ? `${v.cdn}@${ver}` : v.cdn;
    return `${base}/${f.dist}`;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const noVerify = args.includes('--no-verify');
  const fromIdx = args.indexOf('--from');
  const fromArg = fromIdx >= 0 ? args[fromIdx + 1] : null;
  const toolArg = args.find((a) => !a.startsWith('--') && a !== fromArg);

  // 收集本仓所有 MANIFEST.json
  const manifests = [];
  if (toolArg) {
    manifests.push(path.join(ROOT, toolArg, 'MANIFEST.json'));
  } else {
    const entries = await readdir(ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const m = path.join(ROOT, e.name, 'MANIFEST.json');
        if (existsSync(m)) manifests.push(m);
      }
    }
  }
  if (manifests.length === 0) {
    console.error('未找到任何 MANIFEST.json（localTool/runtime-models/<tool>/MANIFEST.json）');
    process.exit(1);
  }

  let total = 0,
    ready = 0,
    fetched = 0,
    failed = 0;

  for (const m of manifests) {
    const tool = path.basename(path.dirname(m));
    const manifest = JSON.parse(await readFile(m, 'utf8'));
    console.log(`\n=== 工具: ${tool}（${manifest.files.length} 个文件）===`);
    const mirrorRoot =
      fromArg ||
      (manifest.localMirror?.env && process.env[manifest.localMirror.env]) ||
      manifest.localMirror?.default;

    for (const f of manifest.files) {
      total++;
      const target = path.join(ROOT, f.path);

      // 已存在且（尺寸 + sha）一致 → 跳过
      if (existsSync(target)) {
        const size = await fileSize(target);
        if (size === f.size && (noVerify || (await sha256File(target)) === f.sha256)) {
          ready++;
          console.log(`  ✓ ${f.path}`);
          continue;
        }
        if (size !== f.size)
          console.log(`  ~ ${f.path} 尺寸不符（本地 ${size} / 期望 ${f.size}），重新拉取`);
        else console.log(`  ~ ${f.path} sha256 不符，重新拉取`);
      }
      if (checkOnly) {
        failed++;
        console.log(`  ✗ 缺失/不符 ${f.path}`);
        continue;
      }

      // 1) 本地镜像优先（集成源目录，保证与现有磁盘字节一致）
      if (mirrorRoot && f.path) {
        const mp = path.join(mirrorRoot, f.path.replace(/^depth-video\//, ''));
        if (existsSync(mp)) {
          await mkdir(path.dirname(target), { recursive: true });
          await copyFile(mp, target);
          if (!noVerify && (await sha256File(target)) !== f.sha256) {
            failed++;
            console.log(`  ✗ ${f.path} 镜像 sha256 不符`);
            continue;
          }
          fetched++;
          console.log(`  + ${f.path}  （本地镜像）`);
          continue;
        }
      }

      // 2) CDN 下载（HuggingFace / jsDelivr）
      const url = buildSource(manifest, f);
      if (!url) {
        failed++;
        console.log(`  ✗ 无 source 且无本地镜像：${f.path}`);
        continue;
      }
      try {
        await mkdir(path.dirname(target), { recursive: true });
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!noVerify && sha256Of(buf) !== f.sha256) {
          failed++;
          const ver = f.group && manifest.vendor?.[f.group]?.versionEnv;
          console.log(`  ✗ ${f.path} 下载 sha256 不符（版本漂移？请钉 ${ver}）`);
          continue;
        }
        await writeFile(target, buf);
        fetched++;
        console.log(`  + ${f.path}  （下载）`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${f.path} 下载失败：${e.message}`);
      }
    }
  }

  console.log(`\n汇总：共 ${total}，已就绪 ${ready}，新拉取 ${fetched}，失败/缺失 ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
