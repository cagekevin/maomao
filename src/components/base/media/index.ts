/**
 * 可引用媒体源 · 统一出口（横切地基）。
 *
 * 【消费方唯一入口】业务代码**只 import 本文件** —— 它保证内置 provider
 * （画布 / 素材库 / 生成）**已自注册**（漏 import = 静默少一个来源）。
 *
 * ⚠️ 分层（check-arch 规则 2）：`base/media/` **禁** import 任何非 base 目录。
 * `videoEditor/`（业务）→ `base/media/`（地基）✅；反向 ❌。
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
