const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.env.USERPROFILE, '.maomao-localtool', 'localtool.db');
  if (!fs.existsSync(dbPath)) { console.log('NO DB at', dbPath); return; }
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const res = db.exec(
    `SELECT task_id, status, submit_ack_at, request_data
       FROM tasks
      WHERE submit_ack_at IS NOT NULL
        AND request_data LIKE '%_relayPoll%'
      ORDER BY submit_ack_at DESC`
  );
  if (!res.length) { console.log('NO ROWS'); return; }
  const { columns, values } = res[0];
  const ci = (n) => columns.indexOf(n);

  const seg1 = [];
  const withTiming = [];
  for (const v of values) {
    const taskId = v[ci('task_id')];
    const status = v[ci('status')];
    const submitAck = v[ci('submit_ack_at')];
    let rd = null;
    try { rd = JSON.parse(v[ci('request_data')]); } catch { continue; }
    const snap = rd && rd._relayPoll;
    if (!snap || snap.capability !== 'image') continue;
    const startedAt = snap.startedAt;
    if (typeof startedAt !== 'number' || typeof submitAck !== 'number') continue;
    const s1 = (submitAck - startedAt) / 1000;
    seg1.push(s1);
    const st = rd.submitTiming;
    if (st) withTiming.push({ taskId, status, s1, ...st });
  }

  const fmt = (x) => (x == null ? '—' : x.toFixed(1) + 's');
  const stat = (arr) => {
    if (!arr.length) return 'n=0';
    const s = [...arr].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    return `n=${s.length} avg=${fmt(avg)} median=${fmt(s[Math.floor(s.length / 2)])} min=${fmt(s[0])} max=${fmt(s[s.length - 1])}`;
  };

  console.log('=== 段①（发送 Lovart 成功前，本地耗时）===');
  console.log('图片任务 seg1 :', stat(seg1));

  // 子步骤（仅含已带 submitTiming 的新任务）
  if (withTiming.length) {
    const pick = (k) => withTiming.map((r) => (r[k] != null ? r[k] / 1000 : 0));
    console.log('\n--- 子步骤（已埋点样本 n=' + withTiming.length + '）---');
    console.log('  queue(排队)  :', stat(pick('queueMs')));
    console.log('  egress(改URL):', stat(pick('egressMs')));
    console.log('  mode        :', stat(pick('modeMs')));
    console.log('  attach(参考图下载+传CDN):', stat(pick('attachmentsMs')));
    console.log('  send(发chat):', stat(pick('sendChatMs')));
    console.log('\n--- 最慢 10 条（含子步骤，ms）---');
    const slow = [...withTiming].sort((a, b) => b.totalMs - a.totalMs).slice(0, 10);
    for (const r of slow) {
      console.log(
        `total=${r.totalMs}ms queue=${r.queueMs} egress=${r.egressMs} mode=${r.modeMs} ` +
        `attach=${r.attachmentsMs} send=${r.sendChatMs} imgs=${r.imageCount}  ${r.taskId}`
      );
    }
  } else {
    console.log('\n（暂无带 submitTiming 的新样本——新提交的任务才会上报子步骤明细）');
  }
  db.close();
})().catch((e) => { console.error(e); process.exit(1); });
