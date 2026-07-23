// 给模板库添加初始种子数据（方便查看新 UI 效果）
const http = require('http');

const BASE = 'http://127.0.0.1:18080';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, headers: body ? { 'Content-Type': 'application/json' } : {} };
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function get(key) { return request('GET', `/api/kv/get?key=${key}`); }
function set(key, value) { return request('POST', '/api/kv/set', { key, value }); }

async function seed() {
  // 检测 localTool 是否可用
  try {
    await request('GET', '/api/kv/get?key=membership');
  } catch {
    console.error('❌ localTool (127.0.0.1:18080) 未运行，请先启动');
    process.exit(1);
  }

  // 读取现有的模板
  let current = await get('local_templates');
  let arr = Array.isArray(current) ? current : [];
  let existingNames = new Set(arr.map(t => t.name));

  const now = Date.now();
  const seeds = [
    {
      id: now,
      name: '小红书图文模板',
      category: 'image',
      nodeCount: 3,
      coverUrl: '',
      graphData: { nodes: [], edges: [] },
      isPublic: false,
      reviewStatus: 'approved',
      createdAt: new Date().toISOString()
    },
    {
      id: now + 1,
      name: '抖音口播视频流程',
      category: 'video',
      nodeCount: 5,
      coverUrl: '',
      graphData: { nodes: [], edges: [] },
      isPublic: false,
      reviewStatus: 'approved',
      createdAt: new Date().toISOString()
    },
    {
      id: now + 2,
      name: 'AI 文案生成工作流',
      category: 'text',
      nodeCount: 4,
      coverUrl: '',
      graphData: { nodes: [], edges: [] },
      isPublic: false,
      reviewStatus: 'approved',
      createdAt: new Date().toISOString()
    }
  ];

  // 去重后追加
  let added = 0;
  for (let tpl of seeds.reverse()) {
    if (!existingNames.has(tpl.name)) {
      arr.unshift(tpl);
      added++;
    }
  }

  if (added === 0) {
    console.log('♻️  种子模板已存在，跳过');
    return;
  }

  await set('local_templates', arr);
  console.log(`✅ 已添加 ${added} 个初始模板`);
  seeds.reverse().forEach(t => console.log(`   · ${t.name} (${t.category} · ${t.nodeCount}节点)`));
}

seed();
