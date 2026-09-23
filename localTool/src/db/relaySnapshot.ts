/**
 * relaySnapshot — 「任务行里有没有 relay 快照（`_relayPoll`）」的**唯一实现**（ADR-0057 收口）。
 *
 * 【为什么住在 db 层】同一判据有两个消费方、分属不同模块：
 *  - `routes/tasks.ts`：`upsertTask` 判「该行是否由后端 relay-poll 持有执行句柄」（决定前端能否写执行态列）；
 *  - `relay-poll.ts`：`capabilityFromRow`（无句柄时报默认预算）· `getGenerateStatus` 的 D16
 *    （判「后端有没有持有」）· `initRelayPoller`（重建句柄）。
 * 放任一侧都会造成反向依赖（`relay-poll → routes/tasks` 已有 `upsertTask` 这一条；反向再加一条即循环）
 * ⇒ 真源立在**双方共同依赖的 db 层**（ADR-0057 动作 2：每个旧载体要么删除、要么改为指向真源）。
 *
 * 【为什么返回三态判别联合，而不是 `snapshot | null`】`absent`（没有快照字段）与
 * `unparsable`（`request_data` 不是合法 JSON）对**判据**同义（都 = 无快照），
 * 但对**留痕**不同义 —— 后者是脏数据，必须可见（ADR-0048：失败不许静默）。
 * 折成 `null` 会让消费方无从区分、进而各自重写解析（正是本次要收口的东西）。
 */

/** 读取结果：命中 / 无 / 解析不了（后两态判据同义、留痕不同义）。 */
export type RelaySnapshotRead<T> =
  { ok: true; snapshot: T } | { ok: false; reason: 'absent' | 'unparsable' };

/**
 * 取任务行的 relay 快照 `_relayPoll`。
 * @param row 任务行（`request_data` 允许是 JSON 串或已解析对象 —— DB 出库为串，内存态为对象）
 * @param T   调用方期望的快照形状（JSON.parse 边界只能由调用方声明；本模块不认识 relay 领域类型）
 */
export function readRelaySnapshot<T = Record<string, unknown>>(
  row: { request_data?: unknown } | undefined,
): RelaySnapshotRead<T> {
  const raw = row?.request_data;
  let snap: unknown;
  if (typeof raw === 'string') {
    try {
      snap = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'unparsable' };
    }
  } else {
    snap = raw;
  }
  const holder = snap as { _relayPoll?: unknown } | null | undefined;
  const value = holder && typeof holder === 'object' ? holder._relayPoll : undefined;
  if (value && typeof value === 'object') return { ok: true, snapshot: value as T };
  return { ok: false, reason: 'absent' };
}
