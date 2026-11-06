/**
 * zustand persist × contentStore 的存储适配（152-V3 · 2026-11-06）—— 全仓**唯一**一份。
 *
 * 【解决什么】zustand `persist` 默认写**裸 localStorage**（物理键 = persist `name`，无 `yimao:` 前缀、
 * 不经 contentStore）→ 键进不了 `STORAGE_KEYS` 派生的备份清单（getLocalKeys() 读的是 contentStore
 * 的 `yimao:<键名>` 物理键），换机即丢。本适配把 persist 的物理读写改走 contentStore
 * （`backend:'local'` 通道）→ 键在 contracts.ts 登记后即自动进备份，「登记即进备份」不变量成立。
 *
 * 【为什么方法全 async】contentStore 的异步原语（contentGetAsync/contentSetAsync）内含
 * storageAdapter 的就绪语义：扩展环境预填完成前的**同步**读只会拿到「还不知道」（与「确实没有」
 * 同值 → 会把默认值误当真相，见 use-local-storage.ts 取证）。persist 原生支持 async StateStorage
 * （rehydrate 等 Promise），故读写一律走异步版。
 *
 * 【迁移语义（一次性，幂等）】persist 此前把数据写在**旧裸键**（物理位置 = 键名本身，无前缀），
 * 收编后首次 getItem 需把旧数据搬进 contentStore：
 *   - 新键已有值 → 不迁移；旧裸键残留顺手清除（防陈旧值复活/被误读）；
 *   - 新键无值 + 旧裸键有值 → contentSetAsync 写入，**写成功才删旧键**（写失败保留旧键，下次重试）；
 *   - 旧裸键损坏（非 JSON）→ 跳过迁移 + reportDegrade 留痕（表现 = 回默认值，但原因可查），不删旧键。
 * 迁移完成后数据**单路径**：persist ⇄ contentStore；旧裸键物理删除，全仓对它再无任何读路径。
 *
 * 【可抄口径】后续任何 zustand persist store 要进备份，照 keybindings-store.ts 一行接法：
 *   `storage: createJSONStorage(contentPersistStorage)` —— 禁止再造第二份适配。
 *   前置条件（结构性自锁）：键必须先在 contracts.ts STORAGE_KEYS 登记 —— contentStore 对未登记
 *   字面量键不分环境一律抛错（checkRegistered），适配层想绕登记都绕不过。
 */
import {
  contentGet,
  contentGetAsync,
  contentSetAsync,
  contentDeleteAsync,
} from '../core/contentStore.ts';
import { readLegacyRawKey, removeLegacyRawKey } from './legacyRawKey.ts';
import { reportDegrade } from '../core/log/degrade.ts';

/** zustand `createJSONStorage` 所需的最小存储接口（与 persist 的 StateStorage 结构等价）。
 *  故意**不 import zustand 类型** —— base/storage 不依赖任何状态库，靠结构兼容接线。 */
interface PersistStateStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

const DEGRADE_LAYER = 'storage/contentPersistStorage';

/**
 * 一次性迁移：旧裸键（persist 默认物理位置 = 键名本身）→ contentStore 新键。
 * 无 once 标记：getItem 只在 rehydrate 时被调（低频），幂等探测比缓存标记少一个可腐化状态。
 */
async function migrateLegacyRawOnce(key: string): Promise<void> {
  if (contentGet(key) !== undefined) {
    // 新键已有值（已迁移过 / 本会话已写）：旧裸键属陈旧残留，清除防「复活」
    removeLegacyRawKey(key);
    return;
  }
  const legacy = readLegacyRawKey(key);
  if (legacy.status === 'missing') return;
  if (legacy.status === 'corrupt') {
    // 旧键损坏：读不出、也无从迁移 —— 留痕（否则表现为「快捷键莫名回默认」且无人知道为什么）。
    // 不删旧键（人工介入前原样保留），也不阻塞后续读（本键按默认值起步）。
    reportDegrade({
      layer: DEGRADE_LAYER,
      key,
      e: new Error(`旧裸键内容损坏，已跳过迁移（rawLength=${legacy.raw.length}）`),
    });
    return;
  }
  try {
    await contentSetAsync(key, legacy.value);
  } catch (error) {
    // 写失败：旧键保留（数据未丢），下次 getItem 重试（幂等）
    reportDegrade({ layer: DEGRADE_LAYER, key, e: error as Error });
    return;
  }
  removeLegacyRawKey(key);
}

/** persist storage 工厂（每 store 配一次：`createJSONStorage(contentPersistStorage)`）。 */
export function contentPersistStorage(): PersistStateStorage {
  return {
    async getItem(key) {
      await migrateLegacyRawOnce(key);
      const v = await contentGetAsync(key);
      if (v === undefined || v === null) return null;
      // contentStore 存的是结构化值（loadFromLocal 会 JSON.parse），persist 需要 JSON 文本 → 回填
      return typeof v === 'string' ? v : JSON.stringify(v);
    },
    async setItem(key, value) {
      // persist 传来的 value 恒为 JSON 文本（它自己 stringify）；原样透传（contentStore 对字符串直存），
      // 与迁移写入同构（那边存 parse 后对象 → 落盘文本一致）
      await contentSetAsync(key, value);
    },
    async removeItem(key) {
      await contentDeleteAsync(key);
    },
  };
}
