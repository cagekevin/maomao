/**
 * protocol/template — 声明式协议的模板渲染（含 $whenPresent / $forEach 指令）。
 * 模板只能读取白名单里的受信变量，没有求值、表达式、动态别名或动态键。
 * 对应 AI-Canvas-tauri 的 modelProtocolTemplate.ts。
 */

import { readModelProtocolPathValues } from './response.js';
import {
  CONDITIONAL_VALUE_KEY,
  FOR_EACH_KEY,
  FOR_EACH_VARIABLE_ROOTS,
  FULL_TEMPLATE_RE,
  MODEL_PROTOCOL_MAX_FOR_EACH_ITEMS,
  OMIT_TEMPLATE_VALUE,
  TEMPLATE_RE,
  WHEN_PRESENT_KEY,
  isRecord,
} from './shared.js';
import type { ProtocolVariables } from '../types.js';

export interface RenderTemplateOptions {
  conditionalDirectives?: boolean;
  arrayItem?: boolean;
}

function resolveContextPath(context: ProtocolVariables, path: string): unknown {
  return readModelProtocolPathValues(context, path)[0];
}

export function renderTemplateString(template: string, context: ProtocolVariables): unknown {
  const fullMatch = FULL_TEMPLATE_RE.exec(template);
  if (fullMatch) {
    const resolved = resolveContextPath(context, fullMatch[1]);
    if (resolved === undefined) return OMIT_TEMPLATE_VALUE;
    return resolved;
  }
  return template.replace(TEMPLATE_RE, (_match, path) => {
    const resolved = resolveContextPath(context, path);
    if (resolved === undefined) throw new Error(`调用协议变量 ${path} 没有可用值`);
    if (typeof resolved === 'object') throw new Error(`调用协议变量 ${path} 不能嵌入字符串`);
    return String(resolved);
  });
}

function renderForEachDirective(
  directive: Record<string, unknown>,
  context: ProtocolVariables,
  options: RenderTemplateOptions,
): unknown[] {
  if (!options.conditionalDirectives) {
    throw new Error('调用协议数组展开项只能用于请求体数组元素');
  }
  const sourceTemplate = directive[FOR_EACH_KEY];
  if (typeof sourceTemplate !== 'string') throw new Error('调用协议数组展开变量无效');
  const sourcePath = FULL_TEMPLATE_RE.exec(sourceTemplate)?.[1];
  if (!sourcePath || sourcePath.includes('.') || !FOR_EACH_VARIABLE_ROOTS.has(sourcePath)) {
    throw new Error('调用协议数组展开变量无效');
  }
  const source = renderTemplateString(sourceTemplate, context);
  if (source === OMIT_TEMPLATE_VALUE || source === null) return [];
  if (!Array.isArray(source)) {
    throw new Error(`调用协议数组展开变量 ${sourcePath} 必须是字符串数组`);
  }
  if (source.length > MODEL_PROTOCOL_MAX_FOR_EACH_ITEMS) {
    throw new Error(
      `调用协议数组展开变量 ${sourcePath} 最多允许 ${MODEL_PROTOCOL_MAX_FOR_EACH_ITEMS} 项`,
    );
  }
  const template = directive[CONDITIONAL_VALUE_KEY];
  return source.flatMap((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`调用协议数组展开变量 ${sourcePath} 只能包含非空字符串`);
    }
    const rendered = renderTemplate(
      template,
      { ...context, [sourcePath]: item },
      {
        conditionalDirectives: true,
      },
    );
    if (rendered === OMIT_TEMPLATE_VALUE) return [];
    if (!rendered || typeof rendered !== 'object' || Array.isArray(rendered)) {
      throw new Error('调用协议数组展开项必须渲染为 JSON 对象');
    }
    return [rendered];
  });
}

export function renderTemplate(
  value: unknown,
  context: ProtocolVariables,
  options: RenderTemplateOptions = {},
): unknown {
  if (typeof value === 'string') return renderTemplateString(value, context);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isRecord(item) && Object.hasOwn(item, FOR_EACH_KEY)) {
        return renderForEachDirective(item, context, options);
      }
      const rendered = renderTemplate(item, context, {
        conditionalDirectives: options.conditionalDirectives,
        arrayItem: true,
      });
      return rendered === OMIT_TEMPLATE_VALUE ? [] : [rendered];
    });
  }
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, FOR_EACH_KEY)) {
      throw new Error('调用协议数组展开项只能用于请求体数组元素');
    }
    if (
      isRecord(value) &&
      (Object.hasOwn(value, WHEN_PRESENT_KEY) || Object.hasOwn(value, CONDITIONAL_VALUE_KEY))
    ) {
      if (!options.conditionalDirectives || !options.arrayItem) {
        throw new Error('调用协议条件项只能用于请求体数组元素');
      }
      const condition = renderTemplateString(String(value[WHEN_PRESENT_KEY]), context);
      const isMissing =
        condition === OMIT_TEMPLATE_VALUE ||
        condition === null ||
        (typeof condition === 'string' && !condition.trim()) ||
        (Array.isArray(condition) && condition.length === 0);
      if (isMissing) return OMIT_TEMPLATE_VALUE;
      return renderTemplate(value[CONDITIONAL_VALUE_KEY], context, {
        conditionalDirectives: true,
      });
    }
    const entries: [string, unknown][] = [];
    for (const [key, item] of Object.entries(value)) {
      const rendered = renderTemplate(item, context, {
        conditionalDirectives: options.conditionalDirectives,
      });
      if (rendered !== OMIT_TEMPLATE_VALUE) entries.push([key, rendered]);
    }
    return Object.fromEntries(entries);
  }
  return value;
}
