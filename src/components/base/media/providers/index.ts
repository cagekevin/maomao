/**
 * 内置来源 · **唯一 import 点**（自注册清单）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么用"模块副作用自注册"】（docs/136 §七）
 *  · 消费方**只需** `import { queryMediaRefs } from 'base/media/mediaRefRegistry'`
 *    就能用全部来源，不需要知道有几个 provider，更**不会漏 import 某个**（漏了 = 静默少一个 Tab）；
 *  · 新增来源 = 加一个文件 + 在此加一行（有**唯一清单**，不会漏）；
 *  · 本仓既有惯例（`nodes/index.ts` 注册节点、`commands/index.ts` 聚合命令）。
 *
 * ⚠️ **与 `check-arch` 的关系**：模块副作用注册**可能**被 `no-circular` 影响。
 * 若 `check:arch` 报环，退路是**显式注册**（`registerBuiltinMediaRefSources()` 由 App 调一次）；
 * **但优先自注册** —— 显式注册意味着"调用方可能忘"，又是一处手写清单。
 * ════════════════════════════════════════════════════════════════
 */
import { registerMediaRefSource } from '../mediaRefRegistry.ts';
import { canvasSourceProvider } from './canvasSource.ts';
import { librarySourceProvider } from './librarySource.ts';
import { generatedSourceProvider } from './generatedSource.ts';

registerMediaRefSource(canvasSourceProvider);
registerMediaRefSource(librarySourceProvider);
registerMediaRefSource(generatedSourceProvider);
