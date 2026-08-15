#!/usr/bin/env node
/**
 * 一毛AI画布 · 缓存清理工具（跨平台：macOS / Windows）
 *
 * 用途：遇到怪事（登录异常、模型列表异常、图生图异常、接入点残留等）时，
 *       一键清理 localTool 的【缓存类 KV】，重置为干净状态。
 *
 * 安全边界（铁律）：
 *  - 只删【缓存类】KV 键（图片缓存 img_*、接入点、同步元数据、画布版本标记等），
 *    绝不碰业务数据：canvas-state-v1-* 画布内容 / auth_token 登录凭证 / projects
 *    / users / api_configs / app_settings / membership / video_model 等 全部保留。
 *  - 走 localTool 正规接口 /api/admin/clear-cache（内存+磁盘同步），不直接改 DB。
 *
 * 用法：
 *   node scripts/clear-cache.cjs            # 清理缓存类 KV（默认安全）
 *   node scripts/clear-cache.cjs --kv=KEY   # 只删指定 key（如 --kv=active_api_endpoint）
 *   node scripts/clear-cache.cjs --list     # 只列出当前所有 KV 键，不删除
 *
 * 环境变量：
 *   LT_BASE   localTool 地址，默认 http://127.0.0.1:18080
 *   LT_PORT   localTool 端口（LT_BASE 未设时生效）
 */

const BASE = process.env.LT_BASE || `http://127.0.0.1:${process.env.LT_PORT || 18080}`;

async function api(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${data.error || `HTTP ${r.status}`}`);
    return data;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function classify(keys) {
  const rows = keys.map((k) => {
    const business =
      k === 'auth_token' ||
      k.startsWith('canvas-state-v1-') ||
      ['projects', 'users', 'api_configs', 'app_settings', 'membership', 'video_model',
       'cloud_storage_config', 'customNodeTemplates', 'local_templates', 'presetPrompts',
       'modelSchedules', 'resources_seeded_to_sqlite', 'projects'].includes(k);
    return { key: k, business };
  });
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  console.log(`\n🧹 一毛AI画布缓存清理 (target: ${BASE})\n`);

  // 0) 确认 localTool 可达
  let keys;
  try {
    const d = await api('GET', '/api/admin/kv-list');
    keys = (d.keys || []).map((r) => r.key);
  } catch (e) {
    console.error(`  ❌ localTool 不可达（${BASE}）：${e.message}`);
    console.error(`     请先启动 localTool（./launch-all.command 2 / launch-all.ps1 2）。`);
    process.exitCode = 1;
    return;
  }
  if (!keys.length) {
    console.log('  ℹ️  KV 表为空，无需清理。');
    return;
  }

  // 1) --list：只列出，不删
  if (args.includes('--list')) {
    console.log('  当前 KV 键：');
    for (const r of classify(keys)) {
      console.log(`   ${r.business ? '🔒业务' : '🟡缓存'}  ${r.key}`);
    }
    return;
  }

  // 2) --kv=KEY：只删指定 key
  const kvArg = args.find((a) => a.startsWith('--kv='));
  if (kvArg) {
    const key = kvArg.slice('--kv='.length);
    const r = await api('POST', '/api/admin/clear-cache', {
      confirm: true, exactKeys: [key], prefixes: [],
    });
    console.log(r.deleted?.includes(key)
      ? `  ✅ 已删除: ${key}`
      : `  ℹ️  未找到/已不存在: ${key}`);
    return;
  }

  // 3) 默认：清理缓存类 KV
  const r = await api('POST', '/api/admin/clear-cache', { confirm: true });
  if (r.ok) {
    console.log(`  ✅ 已清理 ${r.count} 个缓存键：`);
    for (const k of r.deleted || []) console.log(`     · ${k}`);
    const remaining = keys.filter((k) => !(r.deleted || []).includes(k));
    const biz = remaining.filter((k) => classify([k])[0].business);
    console.log(`\n  🔒 已保留业务数据 ${biz.length} 项（画布内容/登录凭证/项目等）：`);
    for (const k of biz) console.log(`     · ${k}`);
  } else {
    console.error(`  ❌ 清理失败：${r.error || '未知错误'}`);
  }

  console.log('\n  💡 提示：若仍遇怪事，建议重启 localTool 一并清空官方权益内存缓存：');
  console.log('       Mac: ./launch-all.command 2   Win: launch-all.ps1 2');
  console.log('');
}

main().catch((e) => {
  console.error(`  ❌ 清理失败：${e.message}`);
  console.error(`     请确认 localTool 已启动（${BASE}）。`);
  process.exitCode = 1;
});
