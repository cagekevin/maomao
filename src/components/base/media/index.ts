/**
 * 可引用媒体源 · 统一出口（横切地基）。
 *
 * 【消费方唯一入口】业务代码**只 import 本文件** —— 它保证内置 provider
 * （画布 / 素材库 / 生成）**已自注册**（漏 import = 静默少一个来源）。
 *
 * ⚠️ 【层籍（2026-09-20 裁定 · 与 `check-arch.mjs` 规则 2 判据对齐）】`base/media/` 是
 * **宿主 / 适配层**（与 `base/panels` 同族），**既不是横切地基、也不是业务域** ——
 * 它装配「媒体源注册表（零业务语义的协议层）+ 各域的源适配器（`providers/*`）」。
 * ⇒ 原红线「**禁** import 任何非 base 目录」**已作废**：它与 `media` 的层籍判定冲突，
 *   且本层从不在 `BASE_CROSS_CUTTING` 里 ⇒ **从来就没有机器守卫**（假护栏）。
 *   实测：`providers/canvasSource.ts`（→ canvas/resource）与 `librarySource.ts`（→ resource）
 *   正是靠读**各域**数据才能把来源接进协议。
 * ⇒ 仍须单向的只有一条：**业务域 → 本层**（反向仍是倒置）。判据全文见 `docs/adr/`（层籍三类）。
 *
 * ⚠️ 本层**只回答"有什么"**，不回答"怎么用"（`linkMediaRefsToProject` 那类
 * 依赖 `editor.media` 的适配器属业务，住在剪辑器改造区，**不在这里**）。
 *
 * 【本出口只导出"当下真有消费者"的符号（死代码闸纪律：不为假设的消费者预留 API = M6）】
 * 形状类型（`MediaRef` 等）由消费方按需直接从 `mediaRefTypes.ts` 取；
 * 其余查询/注册函数按需直接从 `mediaRefRegistry.ts` 取。
 * 本文件的**不可替代价值 = 副作用注册内置来源**（见下方 import）。
 */
// 副作用：注册内置来源（必须在 registry 使用前执行；本文件被 import 即完成）。
import './providers/index.ts';

export { listMediaRefSources, queryMediaRefs } from './mediaRefRegistry.ts';
// 落地事实判据（唯一实现）：画布与剪辑器两侧共用 —— 判据只此一份，两侧只做字段名适配。
// 只导出函数：形状类型由 mediaRefTypes.ts 直接取（本出口不为假设的消费者预留 API）。
export { mediaRefFactsOf } from './mediaRefTypes.ts';
