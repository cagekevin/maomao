/**
 * localTool KV 存储层 —— **re-export 壳**（2026-09-04 中间层折叠后）。
 *
 * 【折叠背景】kvStore 的 storageGet/storageSet/storageDelete + isKvKey + tryParse 中间层
 *   已折叠进 contentStore.ts（src 侧唯一消费者即它，是纯转发中间层）。折叠后：
 *   - 路由判定唯一入口收口到 contentStore.resolveBackend（三段式：登记键→pattern→启发式兜底）。
 *   - KV 降级统一为 contentStore 内部 writeKvWithFallback/readKvWithFallback/deleteKvWithFallback。
 *
 * 【为何保留本壳（而非删除文件）】两点既有引用仍从本文件 import：
 *   1. `CANVAS_STATE_PREFIX` —— projectStore.ts:12 经 storage/index.ts 引用；
 *   2. `kvGet/kvSet/kvDelete` —— tests/unit/logger.test.ts:45 存在 `await import('@/.../kvStore.ts')`
 *      动态 import 断言（删文件即断）。故保留本文件仅 re-export 这两个符号。
 *
 * 【KV 接口契约】（见 docs/18 §2）：
 *  - GET  /api/kv/get?key=<key>   → 返回解析后的值或 JSON null（key 不存在）
 *  - POST /api/kv/set {key,value} → { ok: true }
 *  - POST /api/kv/delete?key=<key> → { ok: true }（删不存在也 ok）
 */
import { CANVAS_STATE_PREFIX } from '../core/contracts.ts' // 单一来源：画布 KV 前缀统一在契约层

// 画布类 key 前缀（对齐官方 Ar.CANVAS_STATE_PREFIX，localTool KV 侧会带此前缀）
// re-export 兼容既有 `import { CANVAS_STATE_PREFIX } from './kvStore.js'`（如 projectStore）
export { CANVAS_STATE_PREFIX }

// kvGet / kvSet / kvDelete 底层转发收口到 localToolApi.ts（深模块），此处 re-export 兼容既有引用
export { kvGet, kvSet, kvDelete } from '../api/localToolApi.ts'
