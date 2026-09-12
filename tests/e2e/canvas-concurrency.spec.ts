/**
 * 画布快照并发写入 —— 真机级 E2E（docs/118 §6.2 场景 1/2/3/4/6 的自动化版）
 *
 * 【前置（人肉，脚本代不了）】
 *  1. localTool 必须起着 `http://127.0.0.1:18080`（CAS 的唯一裁决点就在它这儿）。
 *     dev server(5180) 由 playwright.config.ts 的 webServer 自动拉起。
 *  2. 跨源用例（本文件最后一个 describe）额外要求本机 18080 上**同时起着打包版页面**
 *     （即 `127.0.0.1:18080/` 能打开应用），并用 `E2E_CROSS_ORIGIN=1` 显式启用。
 *
 * 【本套件断言什么】
 *  - 场景 1：单实例 —— 标记→裁剪→保存 → 平移落盘 → 刷新后节点**仍是裁剪后的图**（回归，不许退化）；
 *  - 场景 2/4：双实例同源 —— 后开实例保存后，旧实例「只是平移一下画布」的写入被服务端
 *    409 拒绝（不再静默覆盖），且冲突在旧实例上**可见**；
 *  - 场景 5：刷新后数据仍是对方的新版本，且本窗口恢复可写（不会自己把自己卡死）；
 *  - 场景 6：快照落盘不含内联 dataURL（KB 级，不是 MB 级）。
 *
 * 【数据安全】两条策略，都不删用户数据：
 *  - 场景 1：向当前快照**追加**一个固定 id 的测试生图节点（只增不改），用例结束/失败都在
 *    finally 里把它摘掉；
 *  - 场景 2/3/6：只在「当前项目画布为空」时写测试节点；非空时只做只读断言 + 用户等价的平移手势。
 */
import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const LT = 'http://127.0.0.1:18080';
const PREFIX = 'canvas-state-v1-';
/** POST /api/kv/set 响应的匹配器（waitForResponse 用） */
const isKvSet = (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes('/api/kv/set') && r.request().method() === 'POST';

/** 从页面自己发出的 kv 请求里学到「当前项目」的快照 key（不依赖 localStorage 写盘时序）。 */
function trackProjectKey(page: Page): () => string {
  let key = '';
  page.on('request', (r) => {
    const m = r.url().match(/\/api\/kv\/(?:get|version)\?key=([^&]+)/);
    if (!m) return;
    const k = decodeURIComponent(m[1]);
    if (k.startsWith(PREFIX)) key = k;
  });
  return () => key;
}

async function kvVersion(request: APIRequestContext, key: string): Promise<number> {
  const res = await request.get(`${LT}/api/kv/version?key=${encodeURIComponent(key)}`);
  const body = await res.json();
  return Number(body?.data?.version) || 0;
}
async function kvSnapshot(request: APIRequestContext, key: string): Promise<any> {
  const res = await request.get(`${LT}/api/kv/get?key=${encodeURIComponent(key)}`);
  return await res.json();
}
/** 仅用于「画布为空」时补一个节点（无 ifVersion = 无条件写；空项目无数据可丢）。 */
async function kvSeedOneNode(request: APIRequestContext, key: string): Promise<void> {
  const res = await request.post(`${LT}/api/kv/set`, {
    data: {
      key,
      value: {
        schemaVersion: 1,
        nodes: [
          {
            id: 'e2e-node',
            type: 'textGenerateNode',
            position: { x: 0, y: 0 },
            data: { text: 'e2e' },
          },
        ],
        edges: [],
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

/** 用户眼里的「无害操作」：在空白区拖一下平移视窗 → 触发 handleViewportMoveEnd 落盘。 */
async function panCanvas(page: Page): Promise<void> {
  const box = await page.locator('.react-flow__pane').boundingBox();
  if (!box) throw new Error('未找到 .react-flow__pane');
  const x = box.x + 40;
  const y = box.y + box.height - 60; // 左下角空白区（避开节点）
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y - 60, { steps: 10 });
  await page.mouse.up();
}

const CONFLICT_TEXT = /本次改动未落盘/;

/**
 * 双实例冲突主流程（同源/跨源共用）。
 * @param aUrl 旧实例地址（跨源用例传打包版 http://127.0.0.1:18080/）
 */
async function twoInstanceConflictFlow(
  context: BrowserContext,
  request: APIRequestContext,
  aUrl: string,
): Promise<void> {
  // ── A 先开（旧实例）──
  const a: Page = await context.newPage();
  const keyOfA = trackProjectKey(a);
  const aFirstSave = a.waitForResponse(isKvSet, { timeout: 25000 }).catch(() => null);
  await a.goto(aUrl);
  await a.waitForSelector('.react-flow', { timeout: 20000 });

  // 空画布 → 不落盘（saveCanvasState 空画布跳过）→ 无法制造冲突：补一个测试节点后重载。
  const firstSave = await aFirstSave;
  if (!firstSave) {
    await a.waitForTimeout(2500);
    const key = keyOfA();
    expect(key, '未能从 A 的请求里学到当前项目快照 key').toBeTruthy();
    await kvSeedOneNode(request, key);
    const aSecondSave = a.waitForResponse(isKvSet, { timeout: 25000 });
    await a.reload();
    await a.waitForSelector('.react-flow', { timeout: 20000 });
    await aSecondSave; // A 的基线 = 这次写入后的版本
  }

  // ── B 后开 → 它保存后服务端版本前进，A 变成「旧实例」──
  const b: Page = await context.newPage();
  const bSave = b.waitForResponse(isKvSet, { timeout: 25000 });
  await b.goto('http://localhost:5180/');
  await b.waitForSelector('.react-flow', { timeout: 20000 });
  const bResp = await bSave;
  expect(bResp.status(), 'B（后开实例）的写入应被接受').toBe(200);

  const key = keyOfA();
  const serverV = await kvVersion(request, key);
  expect(serverV, '服务端应已有版本').toBeGreaterThan(0);

  // ① 冲突可见：同源走 BroadcastChannel（<1s）；跨源走 3s 版本轮询兜底。
  await expect(a.getByText(CONFLICT_TEXT)).toBeVisible({ timeout: 10000 });

  // ② A 只是平移一下画布 → 写入被 409 拒绝（旧实例不再能整包覆盖）
  const aSet = a.waitForResponse(isKvSet, { timeout: 12000 });
  await panCanvas(a);
  const resp = await aSet;
  expect(resp.status(), '旧实例写入必须被 409 拒绝').toBe(409);
  const conflictBody = await resp.json();
  expect(conflictBody?.error?.code).toBe('conflict');

  // ③ 对方数据未被抹掉：快照仍有节点；服务端版本单调不回退（A 的失败写入既没推进也没回退）
  const after = await kvSnapshot(request, key);
  expect(Array.isArray(after?.nodes) && after.nodes.length > 0).toBeTruthy();
  expect(await kvVersion(request, key)).toBeGreaterThanOrEqual(serverV);

  // ④ 刷新后 A 恢复干净可写（不把自己卡死）。先关掉 B —— 否则 B 的后续自动保存会让
  //    「A 刷新后必然 200」这件事变成竞态（B 可能在 A 的读→写之间又推进一次版本）。
  await b.close();
  const afterReload = a.waitForResponse(isKvSet, { timeout: 25000 }).catch(() => null);
  await a.reload();
  await a.waitForSelector('.react-flow', { timeout: 20000 });
  await expect(a.getByText(CONFLICT_TEXT)).toHaveCount(0);
  const reloaded = await afterReload;
  if (reloaded) expect(reloaded.status(), '刷新后重新保存应被接受').toBe(200);

  await a.close();
}

test.beforeAll(async ({ request }) => {
  let ok = false;
  try {
    ok = (await request.get(`${LT}/api/status`, { timeout: 4000 })).ok();
  } catch {
    /* 未启动 */
  }
  if (!ok) {
    throw new Error(
      `[canvas-concurrency] localTool ${LT} 未启动。本套件需要 18080 后端（docs/118 §6.3 前提）：` +
        '先起 localTool（npm run dev / dist），再跑 npm run test:e2e。',
    );
  }
});

// ════════════════════════════════════════════════════════════════════════
// 场景 1：单实例「编辑器保存 → 刷新不回退」（用户最初报障的最小回归护栏）
//
// 【为什么断言落在快照数据而不是 DOM 里的 <img>】
//   生图节点在「性能模式媒体降级」下会隐藏媒体（lodLevel ≥ 2，即画布缩得很小时
//   `isHidden('image')` 为真 → 不渲染 <img>，只显示「性能模式已隐藏」）。DOM 断言会因此
//   随画布缩放而假红。而用户报的症状本质是「保存后刷新，节点的图回退成旧图」——
//   等价于「快照里的 data.assetUrl 回退了」，数据层断言既稳定又直击症状。
//   图片写回换 URL 是 C5「先落盘再写回」的必然结果（dataURL → /files/<sha1>.png）。
// ════════════════════════════════════════════════════════════════════════
const TEST_NODE_ID = 'e2e-img-node';

/** 在页面里合成一张 400×300 的 PNG dataURL（避免往仓库里塞二进制 fixture）。 */
async function makeSeedDataUrl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#f6e05e';
      ctx.fillRect(0, 0, 200, 150);
    }
    return c.toDataURL('image/png');
  });
}

/** 读快照里测试节点的 data.assetUrl（缺节点返回 null）。 */
async function testNodeAssetUrl(request: APIRequestContext, key: string): Promise<string | null> {
  const snap = ((await kvSnapshot(request, key)) || {}) as Record<string, unknown>;
  const nodes = (Array.isArray(snap.nodes) ? snap.nodes : []) as Array<{
    id?: string;
    data?: { assetUrl?: unknown };
  }>;
  const n = nodes.find((x) => x?.id === TEST_NODE_ID);
  const url = n?.data?.assetUrl;
  return typeof url === 'string' && url ? url : null;
}

/** 只增不改：往当前快照追加（幂等）一个测试生图节点；不动用户既有节点。 */
async function seedTestImageNode(
  page: Page,
  request: APIRequestContext,
  key: string,
): Promise<void> {
  const snap = ((await kvSnapshot(request, key)) || {}) as Record<string, unknown>;
  const nodes = (Array.isArray(snap.nodes) ? snap.nodes : []) as Record<string, unknown>[];
  if (nodes.some((n) => n?.id === TEST_NODE_ID)) return; // 幂等：上次跑残留则复用
  const dataUrl = await makeSeedDataUrl(page);
  nodes.push({
    id: TEST_NODE_ID,
    type: 'imageGenerateNode',
    position: { x: 80, y: 80 },
    width: 420,
    height: 420,
    data: { assetUrl: dataUrl, aspectRatio: 'Auto', label: 'e2e-image' },
  });
  const res = await request.post(`${LT}/api/kv/set`, {
    data: {
      key,
      value: { ...snap, schemaVersion: snap.schemaVersion || 1, nodes, edges: snap.edges || [] },
    },
  });
  expect(res.ok(), '种子节点写入失败').toBeTruthy();
}

/** 收尾：把测试节点摘掉（读当前值再过滤，绝不回滚其它节点的内容）。 */
async function removeTestNode(request: APIRequestContext, key: string): Promise<void> {
  try {
    const snap = ((await kvSnapshot(request, key)) || {}) as Record<string, unknown>;
    const nodes = (Array.isArray(snap.nodes) ? snap.nodes : []).filter(
      (n) => (n as { id?: string })?.id !== TEST_NODE_ID,
    );
    await request.post(`${LT}/api/kv/set`, { data: { key, value: { ...snap, nodes } } });
  } catch {
    /* 清理失败不影响用例结论（残留下次会被幂等复用） */
  }
}

/**
 * 用户等价的编辑器裁剪：标记 → 裁剪 → 拖 SE 手柄 → 保存裁剪。
 * 是否真的裁到了东西，由「保存后快照主图 URL 是否变化」兜底断言（见用例内注释）。
 */
async function cropViaEditor(page: Page): Promise<void> {
  // 打开编辑器：直接点 DOM 按钮，不走 hover+click 的 actionability 流程 ——
  // 画布可能被缩到 0.1 级（节点只有几十像素），hover 会一直判定「不稳定/被遮挡」。
  // 这与本仓既有 __probe 的驱动方式一致（按钮在 DOM 里始终存在，不必真 hover）。
  const opened = await page.evaluate((id) => {
    const btn = document.querySelector(
      `.react-flow__node[data-id="${id}"] button[title="标记"]`,
    ) as HTMLElement | null;
    if (!btn) return false;
    btn.click();
    return true;
  }, TEST_NODE_ID);
  expect(opened, '未找到生图节点的「标记」按钮').toBe(true);

  // 编辑器是 portal 到 body 的覆盖层（z-ceiling + 标题含「图片编辑」），与既有 __probe 选择器一致
  const editor = page
    .locator('body > div[class*="z-ceiling"]')
    .filter({ hasText: '图片编辑' })
    .first();
  await expect(editor, '图片编辑器未打开').toBeVisible({ timeout: 15000 });

  await editor.getByRole('button', { name: '裁剪', exact: true }).click();
  const handle = editor.locator('.ReactCrop__drag-handle.ord-se');
  await expect(handle, '裁剪 SE 手柄未出现').toBeVisible({ timeout: 10000 });
  const box = await handle.boundingBox();
  if (!box) throw new Error('拿不到裁剪手柄位置');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2 - 120, { steps: 10 });
  await page.mouse.up();

  await editor.getByRole('button', { name: '保存裁剪' }).click();
  await expect(editor, '保存裁剪后编辑器未关闭').toBeHidden({ timeout: 15000 });
}

test.describe('画布快照 · 场景 1 单实例编辑器保存不回退', () => {
  test('标记→裁剪→保存 → 平移落盘 → 刷新仍是裁剪后的图', async ({ context, request }) => {
    test.slow(); // 编辑器交互 + 两次刷新，给足时间（默认 30s 偏紧）
    const page = await context.newPage();
    const keyOf = trackProjectKey(page);
    let key = '';
    try {
      await page.goto('http://localhost:5180/');
      await page.waitForSelector('.react-flow', { timeout: 20000 });
      await page.waitForTimeout(2500); // 等 initProjects 与首屏落盘稳定

      key = keyOf();
      expect(key, '未能从页面请求里学到当前项目快照 key').toBeTruthy();

      await seedTestImageNode(page, request, key);
      const urlBefore = await testNodeAssetUrl(request, key);
      expect(urlBefore, '种子节点的 assetUrl 未落到快照').toBeTruthy();

      await page.reload();
      await page.waitForSelector('.react-flow', { timeout: 20000 });
      await expect(
        page.locator(`.react-flow__node[data-id="${TEST_NODE_ID}"]`),
        '刷新后未渲染出种子节点',
      ).toBeAttached({ timeout: 20000 });

      await cropViaEditor(page);

      // 保存生效的证据：快照主图 URL 换了（文件名 = 内容 sha1）。
      // 若拖拽没生效、保存的是原图，重编码后字节与种子图一致 → URL 不变 → 这里会红，
      // 所以这也是「裁剪真的裁到了东西」的兜底判据。
      let urlAfterCrop: string | null = null;
      for (let i = 0; i < 20 && !urlAfterCrop; i++) {
        const cur = await testNodeAssetUrl(request, key);
        if (cur && cur !== urlBefore) urlAfterCrop = cur;
        else await page.waitForTimeout(1000);
      }
      expect(
        urlAfterCrop,
        '编辑器保存后快照主图 URL 未变化（裁剪未生效 / 保存的是原图）',
      ).toBeTruthy();
      expect(String(urlAfterCrop).startsWith('data:'), '快照主图不应是内联 dataURL').toBe(false);

      // 平移触发一次落盘（等这次保存被接受，确保刷新前内容已进 KV）
      const saved = page.waitForResponse(isKvSet, { timeout: 20000 }).catch(() => null);
      await panCanvas(page);
      const resp = await saved;
      expect(resp?.status(), '平移触发的落盘应被接受（不是 409）').toBe(200);

      // 刷新：节点主图不得回退（这正是用户报的「裁剪完还是原图」）
      await page.reload();
      await page.waitForSelector('.react-flow', { timeout: 20000 });
      await expect
        .poll(() => testNodeAssetUrl(request, key), { timeout: 20000 })
        .toBe(urlAfterCrop);
    } finally {
      await page.close().catch(() => {});
      if (key) await removeTestNode(request, key);
    }
  });
});

test.describe('画布并发写入 · 同源双实例（场景 2/4/5）', () => {
  test('后开实例保存 → 旧实例平移被 409 拒绝且冲突可见', async ({ context, request }) => {
    await twoInstanceConflictFlow(context, request, 'http://localhost:5180/');
  });

  test('场景3 等价（BroadcastChannel 不可用 = 跨源处境）→ 仅靠 3s 版本轮询，冲突仍可见且写入仍被拒', async ({
    context,
    request,
  }) => {
    // 复刻「跨源 / 跨浏览器 / 跨打包进程」下同源广播不通的处境：
    // 把 window.BroadcastChannel 置为 undefined（不能 delete —— 它是原型链上的属性）。
    // 此时 useCanvasSync 的 BroadcastChannel 分支抛错被吞，只剩服务端版本轮询能发现冲突。
    await context.addInitScript(() => {
      Object.defineProperty(window, 'BroadcastChannel', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });
    await twoInstanceConflictFlow(context, request, 'http://localhost:5180/');
  });

  test('场景6：快照落盘无内联 dataURL、体积为 KB 级', async ({ context, request }) => {
    const p = await context.newPage();
    const keyOf = trackProjectKey(p);
    await p.goto('http://localhost:5180/');
    await p.waitForSelector('.react-flow', { timeout: 20000 });
    await p.waitForTimeout(3000);
    const key = keyOf();
    test.skip(!key, '未观察到画布快照 key');
    const snap = await kvSnapshot(request, key);
    test.skip(!snap, '当前项目无快照（空画布）');
    const raw = JSON.stringify(snap);
    // 核心不变量：快照里不出现内联 dataURL（图片一律 /files/ 路径）——这才是「MB 级 → KB 级」的成因。
    // 体积上限只做粗粒度兜底：真实项目节点数/文本量差异很大，不拿它当严格断言。
    expect(raw.includes('"data:image/'), '快照不应出现内联 dataURL').toBe(false);
    expect(raw.length, `快照体积不应回到 MB 级，实际 ${raw.length}`).toBeLessThan(5_000_000);
    await p.close();
  });
});

test.describe('画布并发写入 · 跨源（打包版 18080 ↔ 开发口 5180）', () => {
  test.skip(
    process.env.E2E_CROSS_ORIGIN !== '1',
    '需本机 127.0.0.1:18080 起着打包版页面；设 E2E_CROSS_ORIGIN=1 启用（docs/118 §6.2 场景 3）',
  );

  test('跨源（BroadcastChannel 不通）→ 3s 版本轮询让冲突仍可见 + 写入仍被 409 拒绝', async ({
    context,
    request,
  }) => {
    await twoInstanceConflictFlow(context, request, 'http://127.0.0.1:18080/');
  });
});
