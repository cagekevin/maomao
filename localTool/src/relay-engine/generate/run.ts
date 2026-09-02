/**
 * generate/run — 四条生成入口共用的执行底座。
 *
 * 负责三件事：把模型引用收敛成「模型 ID + 协议」、套用内置预设、
 * 在真正花钱之前拦下「协议接不住参考素材」这类必失败的请求。
 */
import {
  executeModelProtocol,
  type ExecuteModelProtocolResult,
  type ModelProtocolVariables,
} from '../protocol/executor';
import {
  getDefaultCustomProtocol,
  modelProtocolUsesVariable,
  normalizeFrames8n1,
} from '../protocol/schema';
import { REFERENCE_PROTOCOL_VARIABLES } from '../protocol/variables';
import type { ModelExecutionProtocol, ProtocolJsonValue } from '../types/protocol';
import type { GeneralModelCategory } from '../types/connection';
import type { RelayCredential, RelayModelRef, RunModelInput } from '../contract';

/** 把 `RelayModelRef | string` 收敛成统一形状。 */
export function resolveModelRef(
  ref: RelayModelRef | string,
  fallbackCategory: GeneralModelCategory,
): { model: string; name: string; category: GeneralModelCategory; protocol?: ModelExecutionProtocol } {
  if (typeof ref === 'string') {
    return { model: ref, name: ref, category: fallbackCategory };
  }
  const protocol = ref.executionProfile?.preset === 'custom'
    ? ref.executionProfile.protocol
    : undefined;
  return {
    model: ref.model,
    name: ref.name ?? ref.model,
    category: ref.category ?? fallbackCategory,
    ...(protocol ? { protocol } : {}),
  };
}

/** 未显式给协议时，按类别套用内置预设。 */
export function resolveProtocol(
  protocol: ModelExecutionProtocol | undefined,
  category: GeneralModelCategory,
): ModelExecutionProtocol {
  if (protocol) return protocol;
  if (category === 'text') return getDefaultCustomProtocol('text');
  if (category === 'image') return getDefaultCustomProtocol('image');
  return getDefaultCustomProtocol(category);
}

/**
 * 连线/入参带了参考素材、但协议里一个参考字段都没有 → 直接失败。
 * 放行的话上游只会回一句「引用了第 1 张图但请求里一张图都没有」，用户完全看不出是本地配置问题。
 */
export function findUnusedReferenceVariables(
  protocol: unknown,
  variables: ModelProtocolVariables,
): string[] {
  const source = JSON.stringify(protocol);
  const provided = REFERENCE_PROTOCOL_VARIABLES.filter((name) => {
    const value = variables[name];
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value !== '';
  });
  return modelProtocolUsesVariable(source, ...provided) ? [] : provided;
}

/** 只保留有值的变量，避免把 undefined 写进请求体。 */
export function compactVariables(
  variables: ModelProtocolVariables,
): ModelProtocolVariables {
  return Object.fromEntries(
    Object.entries(variables).filter(([, value]) => value !== undefined),
  );
}

export { normalizeFrames8n1 };

/** 执行一次协议调用（四条生成入口最终都走到这里）。 */
export async function runModel(input: RunModelInput): Promise<ExecuteModelProtocolResult> {
  const protocol = resolveProtocol(input.protocol, input.category);
  const variables = compactVariables(input.variables as ModelProtocolVariables);
  const baseUrl = input.connection.baseUrl?.trim() || '';
  if (!baseUrl) throw new Error('连接未配置接口地址');

  if (!input.skipReferenceCheck) {
    const unused = findUnusedReferenceVariables(protocol, variables);
    if (unused.length > 0) {
      throw new Error(
        `调用协议里没有接收参考素材的字段（${unused.join('、')}），素材发不出去。`
          + '请在请求体 JSON 中按接口文档补上对应字段，或不要传入这些素材。',
      );
    }
  }

  return executeModelProtocol({
    apiKey: input.connection.apiKey || '',
    baseUrl,
    protocol,
    variables,
    signal: input.signal,
  });
}

export type { RelayCredential, RelayModelRef };
export type { ProtocolJsonValue };
